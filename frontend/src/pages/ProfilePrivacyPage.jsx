import React, { useEffect, useState } from 'react';
import { FaShieldAlt, FaEye, FaArrowLeft } from 'react-icons/fa';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const ProfilePrivacyPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ showCity: true, showAbout: true });
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/api/auth/me');
        if (!mounted) return;
        const profile = res?.data?.user ?? res?.data ?? {};
        setForm({
          showCity: profile?.privacy?.showCity ?? true,
          showAbout: profile?.privacy?.showAbout ?? true,
        });
      } catch {
        toast.error('Failed to load privacy settings');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/api/auth/update-profile', { privacy: form });
      toast.success('Privacy updated');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update privacy');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-10 text-slate-200">Loading privacy...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
      <button
        onClick={() => navigate('/profile')}
        className="inline-flex items-center gap-2 text-slate-500 hover:text-gray-700"
      >
        <FaArrowLeft /> Back to Profile
      </button>

      <h1 className="text-2xl font-bold text-gray-500 flex items-center gap-2">
        <FaShieldAlt className="text-emerald-400" /> Privacy
      </h1>
      <p className="text-sm text-slate-400">Control what parts of your profile others can see.</p>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-200">Show my home city and country</div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={form.showCity}
              onChange={(e) => setForm({ ...form, showCity: e.target.checked })}
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 transition"></div>
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition peer-checked:translate-x-5" />
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-200">Show About me</div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={form.showAbout}
              onChange={(e) => setForm({ ...form, showAbout: e.target.checked })}
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 transition"></div>
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition peer-checked:translate-x-5" />
          </label>
        </div>

        <button
          onClick={save}
          className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-2"
          disabled={saving}
        >
          <FaEye /> {saving ? 'Saving...' : 'Save privacy'}
        </button>
      </div>
    </div>
  );
};

export default ProfilePrivacyPage;