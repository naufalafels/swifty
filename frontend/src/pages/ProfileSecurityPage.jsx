import React, { useState } from 'react';
import { FaLock, FaShieldAlt } from 'react-icons/fa';
import api from '../utils/api';
import { toast } from 'react-toastify';

const ProfileSecurityPage = () => {
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

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
      <h1 className="text-2xl font-bold text-gray-500 flex items-center gap-2">
        <FaLock className="text-emerald-400" /> Login & Security
      </h1>
      <p className="text-sm text-slate-400">
        Update your password and keep your account secure. Deactivation should be confirmed by the user and is irreversible.
      </p>

      <form onSubmit={submit} className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
        <label className="block text-sm text-slate-200">New password
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full mt-1 p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
            required
          />
        </label>
        <label className="block text-sm text-slate-200">Confirm password
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            className="w-full mt-1 p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
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
            className="px-4 py-3 rounded-lg border border-rose-500 text-rose-200 hover:bg-rose-900/30"
          >
            Deactivate account
          </button>
        </div>
      </form>

      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex items-center gap-3 text-slate-200">
        <FaShieldAlt className="text-blue-300" />
        <div className="text-sm">
          Consider adding MFA/2FA in the future for stronger security. This page is scoped for password-only flows today.
        </div>
      </div>
    </div>
  );
};

export default ProfileSecurityPage;