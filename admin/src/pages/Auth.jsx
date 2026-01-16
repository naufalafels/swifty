import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  adminLogin,
  adminRegister,
  saveAdminSession
} from '../utils/auth.js';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const AuthPage = ({ mode = 'login' }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [error, setError] = useState('');

  // data sources
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);

  // loading states for dropdowns
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [postcodeSearching, setPostcodeSearching] = useState(false);

  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    address_country: '',
    // hidden fields that will be auto-filled when detection succeeds
    location_lat: '',
    location_lng: '',
    logoFile: null
  });

  useEffect(() => {
    // load countries on mount
    const loadCountries = async () => {
      setLoadingCountries(true);
      try {
        const res = await axios.get('https://restcountries.com/v3.1/all?fields=name,cca2');
        const sorted = (res.data || [])
          .map((c) => ({ name: c?.name?.common || c?.name?.official || '', code: c?.cca2 || '' }))
          .filter(c => c.name)
          .sort((a, b) => a.name.localeCompare(b.name));
        setCountries(sorted);
      } catch (err) {
        console.warn('Failed to load countries', err);
        setCountries([]);
      } finally {
        setLoadingCountries(false);
      }
    };
    loadCountries();
  }, []);

  // Helper: update form values
  const onChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      setValues(v => ({ ...v, [name]: files[0] }));
    } else {
      setValues(v => ({ ...v, [name]: value }));
    }
    // when country changes, reset dependent fields
    if (name === 'address_country') {
      setStates([]);
      setCities([]);
      setValues(v => ({ ...v, state: '', city: '', zipCode: '' }));
      if (value) fetchStatesForCountry(value);
    }
    if (name === 'state') {
      setCities([]);
      setValues(v => ({ ...v, city: '', zipCode: '' }));
      if (value) fetchCitiesForState(values.address_country, value);
    }
    if (name === 'city') {
      // try to fetch postcode for country/state/city
      if (value) fetchPostcode(values.address_country, values.state, value);
    }
  };

  // detect location (fills lat/lng)
  const detectLocation = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValues((v) => ({
          ...v,
          location_lat: String(pos.coords.latitude),
          location_lng: String(pos.coords.longitude),
        }));
        setDetectingLocation(false);
      },
      (err) => {
        setGeoError(err?.message || 'Failed to obtain location');
        setDetectingLocation(false);
      },
      { timeout: 10000 }
    );
  };

  // fetch states using countriesnow.space (fallbacks available)
  const fetchStatesForCountry = async (countryName) => {
    setLoadingStates(true);
    setStates([]);
    try {
      const resp = await axios.post('https://countriesnow.space/api/v0.1/countries/states', { country: countryName }, { timeout: 10000 });
      if (resp?.data?.error === false && Array.isArray(resp?.data?.data?.states)) {
        const st = resp.data.data.states.map(s => (typeof s === 'string' ? { name: s } : { name: s?.name || '' })).filter(s => s.name);
        setStates(st);
      } else if (resp?.data?.data?.states && Array.isArray(resp.data.data.states)) {
        const st = resp.data.data.states.map(s => ({ name: s.name || s })).filter(s => s.name);
        setStates(st);
      } else {
        setStates([]); // no states list available
      }
    } catch (err) {
      console.warn('fetchStatesForCountry failed', err);
      setStates([]);
    } finally {
      setLoadingStates(false);
    }
  };

  // fetch cities using countriesnow.space
  const fetchCitiesForState = async (countryName, stateName) => {
    setLoadingCities(true);
    setCities([]);
    try {
      const resp = await axios.post('https://countriesnow.space/api/v0.1/countries/state/cities', { country: countryName, state: stateName }, { timeout: 10000 });
      if (resp?.data?.error === false && Array.isArray(resp?.data?.data)) {
        setCities(resp.data.data.map(c => ({ name: c })));
      } else if (Array.isArray(resp?.data?.data)) {
        setCities(resp.data.data.map(c => ({ name: c })));
      } else {
        setCities([]);
      }
    } catch (err) {
      console.warn('fetchCitiesForState failed', err);
      setCities([]);
    } finally {
      setLoadingCities(false);
    }
  };

  // attempt to auto-fill postcode using Nominatim (OpenStreetMap)
  const fetchPostcode = async (country, state, city) => {
    if (!country || !city) return;
    setPostcodeSearching(true);
    try {
      const params = new URLSearchParams({
        format: 'json',
        country,
        city,
        state: state || '',
        limit: '1',
        addressdetails: '1'
      });
      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
      const resp = await axios.get(url, { timeout: 10000 });
      const hits = resp?.data || [];
      if (Array.isArray(hits) && hits.length > 0) {
        const addr = hits[0].address || {};
        const postcode = addr.postcode || addr.postal_code || '';
        if (postcode) {
          setValues(v => ({ ...v, zipCode: postcode }));
          return;
        }
      }
    } catch (err) {
      console.warn('fetchPostcode failed', err);
    } finally {
      setPostcodeSearching(false);
    }
  };

  const doSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const form = new FormData();
        form.append('name', values.name);
        form.append('email', values.email);
        form.append('password', values.password);
        form.append('companyName', values.companyName);
        form.append('phone', values.phone || '');
        form.append('address_street', values.street || '');
        form.append('address_city', values.city || '');
        form.append('address_state', values.state || '');
        form.append('address_zipCode', values.zipCode || '');
        form.append('address_country', values.address_country || '');
        if (values.location_lat) form.append('location_lat', values.location_lat);
        if (values.location_lng) form.append('location_lng', values.location_lng);
        if (values.logoFile) form.append('logo', values.logoFile);

        // Use adminRegister helper which sends form to /api/admin/signup and expects cookie + token
        const data = await adminRegister(form);
        // adminRegister should return { accessToken | token, user } or success object per backend
        const token = data?.accessToken || data?.token || null;
        const user = data?.user || null;
        saveAdminSession(token, user);
        navigate('/');
        return;
      } else {
        // login via adminLogin which calls /api/auth/login (withCredentials) and returns accessToken,user
        const data = await adminLogin({ email: values.email, password: values.password });
        const token = data?.accessToken || data?.token || null;
        const user = data?.user || null;
        saveAdminSession(token, user);
        navigate('/');
        return;
      }
    } catch (err) {
      console.error('Auth error', err);
      const msg = err?.response?.data?.message || err.message || 'Request failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={doSubmit} className="w-full max-w-lg bg-gray-900 p-6 rounded-lg border border-gray-800">
        <h2 className="text-2xl font-bold mb-4">{mode === 'signup' ? 'Admin - Create account' : 'Admin Login'}</h2>

        {mode === 'signup' && (
          <>
            <label className="block mb-2">Your name</label>
            <input name="name" value={values.name} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" required />

            <label className="block mb-2">Company name</label>
            <input name="companyName" value={values.companyName} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" required />

            <label className="block mb-2">Phone</label>
            <input name="phone" value={values.phone} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" />

            <label className="block mb-2">Street</label>
            <input name="street" value={values.street} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="block mb-2">Country</label>
                <select
                  name="address_country"
                  value={values.address_country}
                  onChange={onChange}
                  className="w-full mb-3 p-2 rounded bg-gray-800 text-white"
                >
                  <option value="">{loadingCountries ? 'Loading countries...' : 'Choose a country'}</option>
                  {countries.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2">State / Region</label>
                {loadingStates ? (
                  <div className="p-2 text-sm text-gray-400">Loading states...</div>
                ) : states && states.length > 0 ? (
                  <select name="state" value={values.state} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-800 text-white">
                    <option value="">Choose a state</option>
                    {states.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                ) : (
                  <input name="state" value={values.state} onChange={onChange} placeholder="State / Region (manual)" className="w-full mb-3 p-2 rounded bg-gray-700" />
                )}
              </div>

              <div>
                <label className="block mb-2">City</label>
                {loadingCities ? (
                  <div className="p-2 text-sm text-gray-400">Loading cities...</div>
                ) : cities && cities.length > 0 ? (
                  <select name="city" value={values.city} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-800 text-white">
                    <option value="">Choose a city</option>
                    {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                ) : (
                  <input name="city" value={values.city} onChange={onChange} placeholder="City (manual)" className="w-full mb-3 p-2 rounded bg-gray-700" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-2">Zip / Postcode</label>
                <input name="zipCode" value={values.zipCode} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" />
                {postcodeSearching && <small className="text-xs text-gray-400">Looking up postcode...</small>}
              </div>

              <div>
                <label className="block mb-2">&nbsp;</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { detectLocation(); }} disabled={detectingLocation} className="px-3 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white">
                    {detectingLocation ? 'Detecting...' : 'Detect my location'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setValues(v => ({ ...v, location_lat: '', location_lng: '' })); setGeoError(''); }}
                    className="px-3 py-2 rounded bg-gray-700 text-white"
                  >
                    Clear
                  </button>
                </div>
                <div className="text-sm text-gray-300 mt-2">
                  {values.location_lat && values.location_lng ? (
                    <span>Detected coords: {values.location_lat}, {values.location_lng}</span>
                  ) : (
                    <span className="text-gray-500">No coords detected</span>
                  )}
                </div>
                {geoError && <small className="text-xs text-red-400 mt-1">{geoError}</small>}
              </div>
            </div>

            <label className="block mb-2">Logo (optional)</label>
            <input type="file" name="logoFile" onChange={onChange} className="w-full mb-3 text-sm text-gray-400" />
          </>
        )}

        <label className="block mb-2">Email</label>
        <input name="email" value={values.email} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" required />

        <label className="block mb-2">Password</label>
        <input name="password" value={values.password} onChange={onChange} type="password" className="w-full mb-3 p-2 rounded bg-gray-700" required />

        {error && <div className="text-red-400 mb-3">{error}</div>}

        <div className="flex items-center justify-between">
          <button disabled={loading} className="px-4 py-2 bg-orange-600 rounded text-white">
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Login'}
          </button>

          {mode === 'signup' ? (
            <button type="button" onClick={() => navigate('/login')} className="text-sm text-gray-400">Already have an account?</button>
          ) : (
            <button type="button" onClick={() => navigate('/signup')} className="text-sm text-gray-400">Become a company</button>
          )}
        </div>
      </form>
    </div>
  );
};

export default AuthPage;