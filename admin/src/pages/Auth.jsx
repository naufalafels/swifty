import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2, MapPin, Globe2 } from 'lucide-react';
import { adminLogin, saveAdminSession } from '../utils/auth.js';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const AuthPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [error, setError] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Admin-only: just email/password; hosts/companies cannot self-signup here.
  const [values, setValues] = useState({
    email: '',
    password: '',
    // optional: capture admin login geo for audit
    location_lat: '',
    location_lng: '',
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
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
      { timeout: 8000 }
    );
  };

  const doSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await adminLogin({
        email: values.email.trim(),
        password: values.password,
        // optionally send coords for audit if backend supports it
        location_lat: values.location_lat,
        location_lng: values.location_lng,
      });

      const token = data?.accessToken || data?.token || null;
      const user = data?.user || null;
      if (!token) throw new Error('No token returned from admin login');

      saveAdminSession(token, user);

      // Optional audit log: send geo for admin login (ignore failure)
      if (values.location_lat && values.location_lng) {
        try {
          await axios.post(
            `${API_BASE}/api/admin/audit/login-geo`,
            { lat: values.location_lat, lng: values.location_lng },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (logErr) {
          console.warn('Audit log (geo) failed', logErr);
        }
      }

      navigate('/');
    } catch (err) {
      console.error('Auth error', err);
      const msg = err?.response?.data?.message || err.message || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl backdrop-blur">
        <div className="px-6 pt-6 pb-2 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-indigo-600/20 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-indigo-300" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Swifty Admin Console</p>
            <h1 className="text-xl font-semibold text-white">Admin Sign In</h1>
          </div>
        </div>

        <form onSubmit={doSubmit} className="px-6 pb-6 pt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Work Email</label>
            <input
              name="email"
              type="email"
              autoComplete="username"
              value={values.email}
              onChange={onChange}
              required
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="admin@company.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-300">Password</label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={onChange}
              required
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span className="flex items-center gap-2">
                <Globe2 className="h-4 w-4" />
                Optional: capture login location (audit)
              </span>
              <button
                type="button"
                onClick={detectLocation}
                disabled={detectingLocation}
                className="text-indigo-300 hover:text-indigo-200 text-xs"
              >
                {detectingLocation ? 'Detecting…' : 'Detect'}
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin className="h-4 w-4" />
              {values.location_lat && values.location_lng
                ? `Lat: ${values.location_lat} / Lng: ${values.location_lng}`
                : 'No coordinates captured'}
            </div>
            {geoError && <p className="text-xs text-amber-300">{geoError}</p>}
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign in as Admin'
            )}
          </button>

          <p className="text-xs text-slate-500 leading-relaxed">
            This console is restricted to Swifty corporate administrators. Host/company self-signup is disabled.
            Contact platform operations if you need access.
          </p>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;