import React, { useState } from 'react';
import axios from 'axios';
import { saveAdminSession } from '../utils/auth.js';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const AuthPage = ({ mode = 'login' }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [geoError, setGeoError] = useState('');
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
  const [error, setError] = useState('');

  const onChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      setValues(v => ({ ...v, [name]: files[0] }));
    } else {
      setValues(v => ({ ...v, [name]: value }));
    }
  };

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

  const doSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        // send multipart/form-data with optional logo file and auto-detected location
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
        // country
        form.append('address_country', values.address_country || '');
        // optional geo coordinates (if detected)
        if (values.location_lat) form.append('location_lat', values.location_lat);
        if (values.location_lng) form.append('location_lng', values.location_lng);
        if (values.logoFile) form.append('logo', values.logoFile);

        const res = await axios.post(`${API_BASE}/api/admin/signup`, form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data?.success) {
          saveAdminSession(res.data.token, res.data.user);
          navigate('/');
          return;
        }
        setError(res.data?.message || 'Signup failed');
      } else {
        // login
        const res = await axios.post(`${API_BASE}/api/auth/login`, {
          email: values.email,
          password: values.password
        }, {
          headers: { 'Content-Type': 'application/json' }
        });

        if (res.data?.token) {
          saveAdminSession(res.data.token, res.data.user);
          navigate('/');
          return;
        }
        setError(res.data?.message || 'Login failed');
      }
    } catch (err) {
      console.error('Auth error', err);
      setError(err?.response?.data?.message || err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={doSubmit} className="w-full max-w-md bg-gray-900 p-6 rounded-lg border border-gray-800">
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-2">City</label>
                <input name="city" value={values.city} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" />
              </div>
              <div>
                <label className="block mb-2">State</label>
                <input name="state" value={values.state} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" />
              </div>
            </div>

            <label className="block mb-2">Zip Code</label>
            <input name="zipCode" value={values.zipCode} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" />

            {/* Country field */}
            <label className="block mb-2">Country</label>
            <input name="address_country" value={values.address_country} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" placeholder="e.g. Malaysia" />

            {/* Location detection */}
            <div className="mb-3">
              <label className="block mb-2 text-sm text-gray-300">Detect company location</label>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={detectingLocation}
                  className="px-3 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white"
                >
                  {detectingLocation ? 'Detecting...' : 'Detect my location'}
                </button>
                <div className="text-sm text-gray-300">
                  {values.location_lat && values.location_lng ? (
                    <span>Detected: {values.location_lat}, {values.location_lng}</span>
                  ) : (
                    <span className="text-gray-500">No coordinates detected</span>
                  )}
                </div>
              </div>
              {geoError && <small className="text-xs text-red-400 mt-1">{geoError}</small>}
              <small className="text-xs text-gray-400 mt-1 block">Detection is optional; coordinates are used to improve client-side location filtering.</small>
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