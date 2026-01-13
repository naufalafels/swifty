import React, { useState } from 'react';
import axios from 'axios';
import { saveAdminSession } from '../utils/auth.js';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const AuthPage = ({ mode = 'login' }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zipCode: ''
  });
  const [error, setError] = useState('');

  const onChange = (e) => setValues(v => ({ ...v, [e.target.name]: e.target.value }));

  const doSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        // call admin signup endpoint
        const payload = {
          name: values.name,
          email: values.email,
          password: values.password,
          companyName: values.companyName,
          address: {
            street: values.street,
            city: values.city,
            state: values.state,
            zipCode: values.zipCode
          },
          phone: values.phone
        };
        const res = await axios.post(`${API_BASE}/api/admin/signup`, payload);
        if (res.data?.success) {
          saveAdminSession(res.data.token, res.data.user);
          navigate('/');
          return;
        }
        setError(res.data?.message || 'Signup failed');
      } else {
        // login via existing auth endpoint
        const res = await axios.post(`${API_BASE}/api/auth/login`, {
          email: values.email,
          password: values.password
        });
        if (res?.data?.success) {
          const token = res.data.token || res.data.accessToken || res.data.token;
          const user = res.data.user || { id: null, name: values.name };
          saveAdminSession(token, user);
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
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <form onSubmit={doSubmit} className="max-w-xl w-full bg-gray-800 p-8 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">{mode === 'signup' ? 'Admin - Create account' : 'Admin Login'}</h2>

        {mode === 'signup' && (
          <>
            <label className="block mb-2">Your name</label>
            <input name="name" value={values.name} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" />

            <label className="block mb-2">Company name</label>
            <input name="companyName" value={values.companyName} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" />

            <label className="block mb-2">Phone</label>
            <input name="phone" value={values.phone} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" />

            <label className="block mb-2">Address (street)</label>
            <input name="street" value={values.street} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" />
            <div className="grid grid-cols-2 gap-2">
              <input name="city" value={values.city} onChange={onChange} placeholder="City" className="p-2 rounded bg-gray-700" />
              <input name="state" value={values.state} onChange={onChange} placeholder="State" className="p-2 rounded bg-gray-700" />
            </div>
            <input name="zipCode" value={values.zipCode} onChange={onChange} placeholder="ZIP" className="w-full mt-3 p-2 rounded bg-gray-700" />
          </>
        )}

        <label className="block mt-3 mb-2">Email</label>
        <input name="email" value={values.email} onChange={onChange} className="w-full mb-3 p-2 rounded bg-gray-700" />

        <label className="block mb-2">Password</label>
        <input name="password" value={values.password} onChange={onChange} type="password" className="w-full mb-3 p-2 rounded bg-gray-700" />

        {error && <div className="text-red-400 mb-3">{error}</div>}

        <div className="flex items-center justify-between">
          <button disabled={loading} className="px-4 py-2 bg-orange-600 rounded">
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