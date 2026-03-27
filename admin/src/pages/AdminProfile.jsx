import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getAdminToken } from '../utils/auth.js';
import { ToastContainer, toast } from 'react-toastify';
import { Save, Upload, Lock, User, Mail, Phone, MapPin } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const AdminProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const token = getAdminToken();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/api/admin/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (mounted) setProfile(res.data.profile);
      } catch (err) {
        console.error('Failed to load admin profile', err);
        toast.error('Failed to load profile');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [token]);

  const updateField = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const form = new FormData();
      if (profile.name !== undefined) form.append('name', profile.name);
      if (profile.phone !== undefined) form.append('phone', profile.phone);
      if (profile.legalName !== undefined) form.append('legalName', profile.legalName);
      if (profile.preferredName !== undefined) form.append('preferredName', profile.preferredName);
      if (profile.birthdate !== undefined) form.append('birthdate', profile.birthdate);
      if (profile.address !== undefined) form.append('address', profile.address);
      if (profile.city !== undefined) form.append('city', profile.city);
      if (profile.state !== undefined) form.append('state', profile.state);
      if (profile.zipCode !== undefined) form.append('zipCode', profile.zipCode);
      if (profile.country !== undefined) form.append('country', profile.country);
      if (profile.about !== undefined) form.append('about', profile.about);
      if (avatarFile) form.append('avatar', avatarFile);

      const res = await axios.put(`${API_BASE}/api/admin/profile`, form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        setProfile(res.data.profile);
        setAvatarFile(null);
        toast.success('Profile updated');
      } else {
        toast.error(res.data?.message || 'Update failed');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      return toast.error('Fill in both password fields');
    }
    if (passwordForm.newPassword !== passwordForm.confirm) {
      return toast.error('New passwords do not match');
    }
    if (passwordForm.newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setChangingPassword(true);
    try {
      const res = await axios.put(
        `${API_BASE}/api/admin/profile/password`,
        { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        toast.success('Password changed');
        setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' });
      } else {
        toast.error(res.data?.message || 'Failed');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Password change failed');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading profile...</div>;
  if (!profile) return <div className="p-6 text-red-500">Failed to load profile.</div>;

  return (
    <div className="flex-1 p-6 bg-gray-50 min-h-screen">
      <ToastContainer />
      <h1 className="text-3xl font-bold mb-6">Admin Profile</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Avatar + Basic Info */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <div className="flex flex-col items-center">
            {(profile.profilePicture || avatarFile) ? (
              <img
                src={avatarFile ? URL.createObjectURL(avatarFile) : profile.profilePicture}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-4 border-gray-100"
              />
            ) : (
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-3xl">
                {(profile.name || '?')[0]?.toUpperCase()}
              </div>
            )}
            <label className="mt-3 cursor-pointer flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
              <Upload size={14} /> Change Photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <hr />
          <div className="text-center">
            <p className="font-semibold text-lg">{profile.name}</p>
            <p className="text-sm text-gray-400">{profile.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-700 capitalize">{profile.role?.replace('_', ' ')}</span>
          </div>
          <div className="text-xs text-gray-400 text-center">
            <p>Member since {new Date(profile.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Middle: Personal Details */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4 lg:col-span-2">
          <h2 className="font-semibold text-lg flex items-center gap-2"><User size={18} /> Personal Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Display Name</label>
              <input type="text" value={profile.name || ''} onChange={(e) => updateField('name', e.target.value)} className="w-full p-2.5 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Legal Name</label>
              <input type="text" value={profile.legalName || ''} onChange={(e) => updateField('legalName', e.target.value)} className="w-full p-2.5 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Preferred Name</label>
              <input type="text" value={profile.preferredName || ''} onChange={(e) => updateField('preferredName', e.target.value)} className="w-full p-2.5 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Email (read-only)</label>
              <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-gray-50 text-gray-500">
                <Mail size={14} /> {profile.email}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Phone</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-3 text-gray-400" />
                <input type="tel" value={profile.phone || ''} onChange={(e) => updateField('phone', e.target.value)} className="w-full p-2.5 pl-9 border rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Birthdate</label>
              <input type="date" value={profile.birthdate || ''} onChange={(e) => updateField('birthdate', e.target.value)} className="w-full p-2.5 border rounded-lg" />
            </div>
          </div>

          <hr />
          <h3 className="font-semibold flex items-center gap-2"><MapPin size={16} /> Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">Street Address</label>
              <input type="text" value={profile.address || ''} onChange={(e) => updateField('address', e.target.value)} className="w-full p-2.5 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">City</label>
              <input type="text" value={profile.city || ''} onChange={(e) => updateField('city', e.target.value)} className="w-full p-2.5 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">State</label>
              <input type="text" value={profile.state || ''} onChange={(e) => updateField('state', e.target.value)} className="w-full p-2.5 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Zip Code</label>
              <input type="text" value={profile.zipCode || ''} onChange={(e) => updateField('zipCode', e.target.value)} className="w-full p-2.5 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Country</label>
              <input type="text" value={profile.country || ''} onChange={(e) => updateField('country', e.target.value)} className="w-full p-2.5 border rounded-lg" />
            </div>
          </div>

          <hr />
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">About</label>
            <textarea rows={3} value={profile.about || ''} onChange={(e) => updateField('about', e.target.value)} className="w-full p-2.5 border rounded-lg" placeholder="A short bio..." />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Password Change Section */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border p-6 max-w-xl">
        <h2 className="font-semibold text-lg flex items-center gap-2 mb-4"><Lock size={18} /> Change Password</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Current Password</label>
            <input type="password" value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
              className="w-full p-2.5 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">New Password</label>
            <input type="password" value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
              className="w-full p-2.5 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Confirm New Password</label>
            <input type="password" value={passwordForm.confirm}
              onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
              className="w-full p-2.5 border rounded-lg" />
          </div>
          <button
            onClick={handlePasswordChange}
            disabled={changingPassword}
            className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
          >
            <Lock size={16} /> {changingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;