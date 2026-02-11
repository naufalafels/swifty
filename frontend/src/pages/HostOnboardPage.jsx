import React, { useRef, useState, useEffect } from 'react';
import { FaCheckCircle, FaChevronLeft, FaChevronRight, FaRocket, FaList, FaCarSide, FaMapMarkerAlt, FaGlobe, FaInfoCircle, FaImage } from 'react-icons/fa';
import * as authService from '../utils/authService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { LoadScript, StandaloneSearchBox } from '@react-google-maps/api';

const HostOnboardPage = () => {
  // Use authService directly instead of context
  const [user, setUser] = useState(() => {
    try {
      return authService.getCurrentUser?.() || null;
    } catch {
      return null;
    }
  });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [company, setCompany] = useState({
    payoutAccountRef: '',
    companyName: '',
    ssmNumber: '',
    // Removed nricNumber
    notes: '',
  });

  const [vehicle, setVehicle] = useState({
    make: '',
    model: '',
    year: '',
    dailyRate: '',
    seats: '',
    shiftType: '',
    fuelType: '',
    petrolType: [],
    carType: '',
    image: null,
  });

  const [imagePreview, setImagePreview] = useState(null);

  const [location, setLocation] = useState({
    search: '',
    selectedAddress: '',
    latitude: '',
    longitude: '',
    useCoords: false,
  });

  const [floaty, setFloaty] = useState('');
  const floatyTimerRef = useRef(null);

  const searchBoxRef = useRef(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Guard: Redirect if applying for host
  useEffect(() => {
    if (user?.applyingForHost) {
      toast.info('Your application is pending approval.');
      navigate('/profile');
    }
  }, [user?.applyingForHost, navigate]);

  const isEmpty = (v) => !v || String(v).trim() === '';

  const showFloaty = (msg) => {
    setFloaty(msg);
    if (floatyTimerRef.current) clearTimeout(floatyTimerRef.current);
    floatyTimerRef.current = setTimeout(() => setFloaty(''), 4000);
  };

  const validateStep1 = () => {
    const missing = [];
    if (isEmpty(company.companyName)) missing.push('Company name');
    if (isEmpty(company.ssmNumber)) missing.push('SSM number');
    // Removed nricNumber validation
    if (isEmpty(company.payoutAccountRef)) missing.push('Payout account reference');
    if (missing.length) {
      const msg = 'Complete first step before moving on';
      toast.error(`Step 1: ${missing.join(', ')}`);
      showFloaty(msg);
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const missing = [];
    if (isEmpty(vehicle.make)) missing.push('Make');
    if (isEmpty(vehicle.model)) missing.push('Model');
    if (isEmpty(vehicle.year)) missing.push('Manufactured year');
    if (isEmpty(vehicle.dailyRate)) missing.push('Daily rate');
    if (isEmpty(vehicle.seats)) missing.push('Seats');
    if (isEmpty(vehicle.shiftType)) missing.push('Shift type');
    if (isEmpty(vehicle.fuelType)) missing.push('Fuel type');
    if (isEmpty(vehicle.carType)) missing.push('Car type');
    if (vehicle.fuelType === 'Petrol' && (!vehicle.petrolType || vehicle.petrolType.length === 0)) missing.push('Petrol type');
    if (!vehicle.image) missing.push('Vehicle image');
    if (missing.length) {
      const msg = 'Complete vehicle step before publishing';
      toast.error(`Step 2: ${missing.join(', ')}`);
      showFloaty(msg);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => Math.min(3, s + 1));
  };

  const prev = () => setStep((s) => Math.max(1, s - 1));

  const publish = async () => {
    if (!validateStep2()) return; // gate publish on step 2 completeness
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('payoutAccountRef', company.payoutAccountRef);
      formData.append('notes', company.notes);
      formData.append('companyName', company.companyName);  // NEW
      formData.append('ssmNumber', company.ssmNumber);      // NEW
      // Removed nricNumber
      formData.append('vehicle', JSON.stringify({
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        dailyRate: vehicle.dailyRate,
        seats: vehicle.seats,
        shiftType: vehicle.shiftType,
        fuelType: vehicle.fuelType,
        petrolType: vehicle.petrolType,
        carType: vehicle.carType,
      }));
      if (vehicle.image) formData.append('vehicleImage', vehicle.image);

      await authService.becomeHost(formData); // Assuming authService.becomeHost accepts FormData
      // Update user state locally (since no context)
      setUser(prev => prev ? { ...prev, applyingForHost: true } : null);
      authService.setCurrentUser({ ...user, applyingForHost: true }); // Update globally
      toast.success('Host onboarding submitted. Admin will review.');
      navigate('/profile');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit host onboarding');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceChanged = () => {
    if (!searchBoxRef.current) return;
    const places = searchBoxRef.current.getPlaces();
    if (!places || places.length === 0) return;
    const place = places[0];
    const formatted = place.formatted_address || place.name || '';
    let lat = '';
    let lng = '';
    if (place.geometry?.location) {
      lat = place.geometry.location.lat()?.toFixed(6) || '';
      lng = place.geometry.location.lng()?.toFixed(6) || '';
    }

    setLocation((p) => ({
      ...p,
      search: formatted,
      selectedAddress: formatted,
      latitude: lat,
      longitude: lng,
      useCoords: false,
    }));
  };

  const toggleCoords = async () => {
    setLocation((p) => ({ ...p, useCoords: !p.useCoords }));
    if (location.useCoords) {
      setLocation((p) => ({ ...p, latitude: '', longitude: '' }));
      return;
    }
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported in this browser.');
      setLocation((p) => ({ ...p, useCoords: false }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude?.toFixed(6) || '';
        const lng = pos.coords.longitude?.toFixed(6) || '';
        setLocation((p) => ({ ...p, latitude: lat, longitude: lng, useCoords: true }));
        toast.success('Coordinates captured from your location.');
      },
      (err) => {
        console.error('Geolocation error', err);
        toast.error('Unable to fetch location. Please allow location access or enter manually.');
        setLocation((p) => ({ ...p, useCoords: false }));
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVehicle({ ...vehicle, image: file });
      setImagePreview(URL.createObjectURL(file));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <button
        onClick={() => navigate('/profile')}
        className="inline-flex items-center gap-2 text-slate-500 hover:text-gray-700"
      >
        <FaChevronLeft /> Back to Profile
      </button>

      <div className="flex items-center gap-2 text-gray-500 text-2xl font-bold">
        <FaRocket className="text-emerald-400" /> Become a Host
      </div>
      <div className="text-sm text-slate-400">
        Step-by-step wizard: Company → Vehicle → Publish (with summary).
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`rounded-lg border px-2 py-2 ${
              s === step ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 text-slate-200 border-slate-800'
            }`}
          >
            {s === 1 ? 'Tell us about your company' : s === 2 ? 'Add a vehicle' : 'Publish'}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="text-sm text-white font-semibold flex items-center gap-2">
            <FaList /> Company details
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm text-slate-200">Company name
              <input
                value={company.companyName}
                onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                required
              />
            </label>
            <label className="text-sm text-slate-200">SSM number
              <input
                value={company.ssmNumber}
                onChange={(e) => setCompany({ ...company, ssmNumber: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                required
              />
            </label>
            {/* Removed NRIC number input */}
            <label className="text-sm text-slate-200">Payout account reference (Razorpay Curlec)
              <input
                value={company.payoutAccountRef}
                onChange={(e) => setCompany({ ...company, payoutAccountRef: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                placeholder="CURLEC-REF-123"
                required
              />
            </label>
          </div>

          <label className="text-sm text-slate-200">Notes (optional)
            <textarea
              value={company.notes}
              onChange={(e) => setCompany({ ...company, notes: e.target.value })}
              className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
              rows={3}
            />
          </label>

          {/* Company Location */}
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/70 space-y-3">
            <div className="text-sm text-white font-semibold flex items-center gap-2">
              <FaMapMarkerAlt className="text-emerald-400" /> Company Location
            </div>

            <label className="text-sm text-slate-200 block">Search address (Google Places)
              <div className="relative mt-1">
                {apiKey ? (
                  <LoadScript googleMapsApiKey={apiKey} libraries={['places']}>
                    <StandaloneSearchBox onLoad={(ref) => (searchBoxRef.current = ref)} onPlacesChanged={handlePlaceChanged}>
                      <input
                        value={location.search}
                        onChange={(e) => setLocation((p) => ({ ...p, search: e.target.value }))}
                        placeholder="Start typing an address..."
                        className="w-full p-3 rounded bg-slate-800 border border-slate-700 text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </StandaloneSearchBox>
                  </LoadScript>
                ) : (
                  <input
                    value={location.search}
                    onChange={(e) => setLocation((p) => ({ ...p, search: e.target.value }))}
                    placeholder="Start typing an address..."
                    className="w-full p-3 rounded bg-slate-800 border border-slate-700 text-white focus:border-emerald-500 focus:outline-none"
                  />
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Select a place to auto-fill address and coordinates.</div>
            </label>

            <div className="flex items-center gap-2">
              <input
                id="useCoords"
                type="checkbox"
                checked={location.useCoords}
                onChange={toggleCoords}
                className="w-4 h-4 accent-emerald-500"
              />
              <label htmlFor="useCoords" className="text-sm text-slate-200 inline-flex items-center gap-2">
                <FaGlobe className="text-emerald-400" /> Use my current coordinates (auto-fill)
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm text-slate-200">Latitude
                <input
                  value={location.latitude}
                  onChange={(e) => setLocation((p) => ({ ...p, latitude: e.target.value }))}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  placeholder="e.g., 3.1390"
                />
              </label>
              <label className="text-sm text-slate-200">Longitude
                <input
                  value={location.longitude}
                  onChange={(e) => setLocation((p) => ({ ...p, longitude: e.target.value }))}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  placeholder="e.g., 101.6869"
                />
              </label>
            </div>

            {(location.selectedAddress || (location.latitude && location.longitude)) && (
              <div className="text-xs text-emerald-300">
                Selected: {location.selectedAddress || 'Coordinates only'}{' '}
                {(location.latitude && location.longitude) ? `(${location.latitude}, ${location.longitude})` : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="text-sm text-white font-semibold flex items-center gap-2">
            <FaCarSide /> Vehicle details
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm text-slate-200">Make
              <input
                value={vehicle.make}
                onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                required
              />
            </label>
            <label className="text-sm text-slate-200">Model
              <input
                value={vehicle.model}
                onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                required
              />
            </label>
            <label className="text-sm text-slate-200">Manufactured year
              <input
                value={vehicle.year}
                onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                placeholder="2023"
                required
              />
            </label>
            <label className="text-sm text-slate-200">Daily rate (MYR)
              <input
                value={vehicle.dailyRate}
                onChange={(e) => setVehicle({ ...vehicle, dailyRate: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                placeholder="Flexible pricing supported"
                required
              />
            </label>
            <label className="text-sm text-slate-200">Seats
              <select
                value={vehicle.seats}
                onChange={(e) => setVehicle({ ...vehicle, seats: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
              >
                <option value="">Select</option>
                {[2, 4, 5, 7, 8, 12].map((s) => (
                  <option key={s} value={s}>
                    {s} seater
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-200">Shift type
              <select
                value={vehicle.shiftType}
                onChange={(e) => setVehicle({ ...vehicle, shiftType: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
              >
                <option value="">Select</option>
                <option>Automatic</option>
                <option>Manual</option>
              </select>
            </label>
            <label className="text-sm text-slate-200">Fuel type
              <select
                value={vehicle.fuelType}
                onChange={(e) => setVehicle({ ...vehicle, fuelType: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
              >
                <option value="">Select</option>
                <option>Petrol</option>
                <option>Diesel</option>
                <option>Hybrid</option>
                <option>Electric</option>
              </select>
            </label>
            {vehicle.fuelType === 'Petrol' && (
              <div className="col-span-2">
                <label className="text-sm text-slate-200">Petrol type (check all that apply)
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {['Ron95', 'Ron97', 'Ron100', 'Ethanol', 'E85'].map(type => (
                      <label key={type} className="flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={vehicle.petrolType.includes(type)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...vehicle.petrolType, type]
                              : vehicle.petrolType.filter(t => t !== type);
                            setVehicle({ ...vehicle, petrolType: updated });
                          }}
                          className="accent-emerald-500"
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </label>
              </div>
            )}
            <label className="text-sm text-slate-200">Car type
              <select
                value={vehicle.carType}
                onChange={(e) => setVehicle({ ...vehicle, carType: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
              >
                <option value="">Select</option>
                {['Hatchback', 'Sedan', 'SUV', 'MPV', 'Truck', 'Van', 'Luxury', 'Classic'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <div className="col-span-2">
              <label className="text-sm text-slate-200">Vehicle image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  required
                />
              </label>
              {imagePreview && (
                <div className="mt-2">
                  <img src={imagePreview} alt="Vehicle Preview" className="w-32 h-32 object-cover rounded border" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="text-sm text-white font-semibold flex items-center gap-2">
            <FaCheckCircle className="text-emerald-400" /> Summary
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-200">
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
              <div className="font-semibold text-white mb-1">Company</div>
              <div>Company name: {company.companyName || '—'}</div>
              <div>SSM: {company.ssmNumber || '—'}</div>
              {/* Removed NRIC */}
              <div>Payout ref: {company.payoutAccountRef || '—'}</div>
              <div>
                Location:{' '}
                {location.selectedAddress ||
                  (location.latitude && location.longitude
                    ? `${location.latitude}, ${location.longitude}`
                    : '—')}
              </div>
            </div>
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
              <div className="font-semibold text-white mb-1">Vehicle</div>
              <div>
                {vehicle.make || 'Make'} {vehicle.model || 'Model'} {vehicle.year ? `(${vehicle.year})` : ''}
              </div>
              <div>Daily rate: {vehicle.dailyRate || '—'}</div>
              <div>Seats: {vehicle.seats || '—'} | Shift: {vehicle.shiftType || '—'}</div>
              <div>Fuel: {vehicle.fuelType || '—'} {vehicle.fuelType === 'Petrol' && vehicle.petrolType.length > 0 ? `(${vehicle.petrolType.join(', ')})` : ''}</div>
              <div>Type: {vehicle.carType || '—'}</div>
              {imagePreview && <img src={imagePreview} alt="Vehicle Preview" className="w-16 h-16 object-cover rounded mt-2" />}
            </div>
          </div>
          <div className="text-xs text-slate-400">
            When you publish, details go to Admin for validation. After approval, you will see Host Centre.
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={prev}
          disabled={step === 1}
          className="px-4 py-3 rounded-lg border border-slate-700 text-slate-500 hover:bg-slate-800 disabled:opacity-0 inline-flex items-center gap-2"
        >
          <FaChevronLeft /> Back
        </button>
        {step < 3 ? (
          <button
            onClick={handleNext}
            className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-2"
          >
            Next <FaChevronRight />
          </button>
        ) : (
          <button
            onClick={publish}
            disabled={loading}
            className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-2"
          >
            <FaCheckCircle /> {loading ? 'Publishing...' : 'Publish to marketplace'}
          </button>
        )}
      </div>

      {floaty && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-amber-400 text-slate-900 rounded-full shadow-lg px-4 py-2 text-sm font-semibold flex items-center gap-2">
            <FaInfoCircle /> {floaty}
          </div>
        </div>
      )}
    </div>
  );
};

export default HostOnboardPage;