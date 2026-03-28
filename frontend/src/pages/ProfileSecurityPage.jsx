import React, { useState } from 'react';
import { FaArrowLeft, FaLock, FaShieldAlt } from 'react-icons/fa';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const ProfileSecurityPage = () => {
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.put('/api/auth/update-password', { password: form.password });
      toast.success('Password updated');
      setForm({ password: '', confirm: '' });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
      <button
        onClick={() => navigate('/profile')}
        className="inline-flex items-center gap-2 text-slate-500 hover:text-gray-700"
      >
        <FaArrowLeft /> Back to Profile
      </button>

      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <FaLock className="text-emerald-400" /> Login & Security
      </h1>
      <p className="text-sm text-slate-500">
        Update your password and keep your account secure. Deactivation should be confirmed by the user and is irreversible.
      </p>

      <form onSubmit={submit} className="bg-white border border-orange-100 rounded-xl p-5 space-y-3 shadow-sm">
        <label className="block text-sm text-slate-700">New password
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full mt-1 p-3 rounded-lg bg-orange-50/50 border border-orange-200 text-slate-800"
            required
          />
        </label>
        <label className="block text-sm text-slate-700">Confirm password
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            className="w-full mt-1 p-3 rounded-lg bg-orange-50/50 border border-orange-200 text-slate-800"
            required
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>
          <button
            type="button"
            onClick={() => toast.warn('Account deactivation flow should call /api/auth/deactivate')}
            className="px-4 py-3 rounded-lg border border-rose-400 text-rose-600 hover:bg-rose-50"
          >
            Deactivate account
          </button>
        </div>
      </form>

      <div className="bg-white border border-orange-100 rounded-xl p-4 flex items-center gap-3 text-slate-600 shadow-sm">
        <FaShieldAlt className="text-blue-500" />
        <div className="text-sm">
          Consider adding MFA/2FA in the future for stronger security. This page is scoped for password-only flows today.
        </div>
      </div>
    </div>
  );
};

export default ProfileSecurityPage;