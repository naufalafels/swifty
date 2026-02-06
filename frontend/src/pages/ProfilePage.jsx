import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  FaCheckCircle,
  FaUserShield,
  FaEdit,
  FaLock,
  FaShieldAlt,
  FaRocket,
  FaUserCog,
  FaMapMarkerAlt,
  FaInfoCircle,
  FaImage,
  FaSchool,
  FaBriefcase,
  FaPaw,
  FaBirthdayCake,
  FaLanguage,
  FaCity,
  FaIdCard,
  FaCloudUploadAlt,
  FaCarSide,
} from 'react-icons/fa';
import api from '../utils/api';
import * as authService from '../utils/authService';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';

const Badge = ({ children, tone = 'slate' }) => {
  const tones = {
    slate: 'bg-slate-800 text-slate-100 border-slate-700',
    amber: 'bg-amber-900/70 text-amber-100 border-amber-700/60',
    emerald: 'bg-emerald-900/70 text-emerald-100 border-emerald-700/60',
    blue: 'bg-blue-900/70 text-blue-100 border-blue-700/60',
  };
  return (
    <span className={`px-2 py-1 rounded-full border text-xs font-semibold ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
};

const Metric = ({ label, value, icon: Icon }) => (
  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg flex items-center gap-3">
    <div className="p-2 rounded-lg bg-slate-800 text-emerald-300">
      <Icon />
    </div>
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-2xl font-semibold text-white">{value}</div>
    </div>
  </div>
);

const maskPhone = (phone) => {
  if (!phone) return 'Not set';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 5) return '********';
  return `${digits.slice(0, 3)}*****${digits.slice(-3)}`;
};

const maskEmail = (email) => {
  if (!email) return 'Not set';
  const [user, domain] = email.split('@');
  if (!domain) return 'Not set';
  if (user.length <= 2) return `*${user.slice(-1)}@${domain}`;
  return `${user[0]}**${user.slice(-1)}@${domain}`;
};

const PreviewThumb = ({ file, url }) => {
  if (!file && !url) return null;
  const src = url || (file ? URL.createObjectURL(file) : null);
  return (
    <div className="w-24 h-16 border border-slate-700 rounded-md overflow-hidden bg-slate-800">
      {src ? <img src={src} alt="preview" className="w-full h-full object-cover" /> : null}
    </div>
  );
};

const ProfilePage = () => {
  const [user, setUser] = useState(() => {
    try {
      return authService.getCurrentUser?.() || null;
    } catch {
      return null;
    }
  });
  const [stats, setStats] = useState({ bookings: 0, completedTrips: 0, years: 0 });
  const [loading, setLoading] = useState(!user);
  const [error, setError] = useState('');
  const [isPersonalModalOpen, setIsPersonalModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordCheckField, setPasswordCheckField] = useState(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [submittingKyc, setSubmittingKyc] = useState(false);

  const [personalForm, setPersonalForm] = useState({
    legalName: '',
    birthdate: '',
    preferredName: '',
    phone: '',
    email: '',
    residentialAddress: '',
    mailingAddress: '',
    sameMailing: true,
    city: '',
    country: '',
    addressSearch: '',
  });

  const [aboutForm, setAboutForm] = useState({ about: '' });

  const [editExtras, setEditExtras] = useState({
    profilePic: null,
    school: '',
    work: '',
    pets: '',
    decade: '',
    languages: '',
    live: '',
  });

  const [kycForm, setKycForm] = useState({
    idType: 'NRIC',
    idNumber: '',
    frontFile: null,
    backFile: null,
  });

  const [locked, setLocked] = useState({ phone: true, email: true });
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState('');
  const addressDebounce = useRef(null);
  const addressAbort = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      try {
        const res = await api.get('/api/profile/stats');
        return res?.data ?? {};
      } catch (err) {
        // Swallow 404 (endpoint absent) and fall back to zeros; log others for debugging
        if (err?.response?.status !== 404) {
          console.error('profile stats error', err);
        }
        return {};
      }
    };

    const load = async () => {
      setLoading(true);
      try {
        const [meRes, statsData] = await Promise.allSettled([
          api.get('/api/auth/me'),
          loadStats(),
        ]);

        if (meRes.status === 'fulfilled') {
          const profile = meRes.value?.data?.user ?? meRes.value?.data ?? null;
          if (mounted) {
            setUser(profile);
            setPersonalForm({
              legalName: profile?.legalName || profile?.name || '',
              birthdate: profile?.birthdate || '',
              preferredName: profile?.preferredName || profile?.name || '',
              phone: profile?.phone || '',
              email: profile?.email || '',
              residentialAddress: profile?.address || '',
              mailingAddress: profile?.mailingAddress || profile?.address || '',
              sameMailing: profile?.mailingAddress ? profile?.mailingAddress === profile?.address : true,
              city: profile?.city || '',
              country: profile?.country || '',
              addressSearch: '',
            });
            setAboutForm({ about: profile?.about || '' });
            try {
              authService.setCurrentUser(profile);
            } catch {}
          }
        } else if (mounted) {
          setError(meRes.reason?.response?.data?.message || 'Failed to load profile');
        }

        if (mounted) {
          const s = statsData?.value ?? {};
          setStats({
            bookings: s.bookings ?? 0,
            completedTrips: s.completedTrips ?? 0,
            years: s.years ?? 0,
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
      if (addressDebounce.current) clearTimeout(addressDebounce.current);
      if (addressAbort.current) addressAbort.current.abort();
    };
  }, []);

  const isVerified = !!user?.kyc?.status && user.kyc.status === 'approved';
  const isHost = Array.isArray(user?.roles) && user.roles.includes('host');

  const completion = useMemo(() => {
    const checks = [
      { label: 'Legal Name', done: !!personalForm.legalName },
      { label: 'Birthdate', done: !!personalForm.birthdate },
      { label: 'Preferred Name', done: !!personalForm.preferredName },
      { label: 'Phone', done: !!personalForm.phone },
      { label: 'Email', done: !!personalForm.email },
      { label: 'Residential Address', done: !!personalForm.residentialAddress },
      { label: 'Mailing Address', done: !!personalForm.mailingAddress },
      { label: 'KYC', done: isVerified },
    ];
    const done = checks.filter((c) => c.done).length;
    const percent = Math.round((done / checks.length) * 100);
    return { percent, checks };
  }, [personalForm, isVerified]);

  const verifyPassword = async () => {
    try {
      await api.post('/api/auth/verify-password', { password: passwordValue });
      setLocked((prev) => ({ ...prev, [passwordCheckField]: false }));
      setIsPasswordModalOpen(false);
      setPasswordValue('');
      toast.success('Verified. You can now edit this field.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Password verification failed');
    }
  };

  const handleLockedFieldClick = (field) => {
    if (!locked[field]) return;
    setPasswordCheckField(field);
    setIsPasswordModalOpen(true);
  };

  const savePersonal = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        legalName: personalForm.legalName,
        birthdate: personalForm.birthdate,
        preferredName: personalForm.preferredName,
        phone: personalForm.phone,
        email: personalForm.email,
        address: personalForm.residentialAddress,
        mailingAddress: personalForm.sameMailing ? personalForm.residentialAddress : personalForm.mailingAddress,
        city: personalForm.city,
        country: personalForm.country,
      };
      const res = await api.put('/api/auth/update-profile', payload);
      setUser(res.data.user);
      authService.setCurrentUser(res.data.user);
      toast.success('Personal information updated');
      setIsPersonalModalOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const saveAbout = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.put('/api/auth/update-profile', { about: aboutForm.about });
      setUser(res.data.user);
      authService.setCurrentUser(res.data.user);
      toast.success('About me updated');
      setIsAboutModalOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const saveEditExtras = async (e) => {
    e.preventDefault();
    toast.info('Profile extras saved (stub). Wire to your API when ready.');
    setIsEditModalOpen(false);
  };

  const submitKyc = async (e) => {
    e.preventDefault();
    if (!kycForm.idNumber || !kycForm.frontFile) {
      toast.error('ID number and front image are required');
      return;
    }
    const fd = new FormData();
    fd.append('idType', kycForm.idType);
    fd.append('idNumber', kycForm.idNumber);
    if (kycForm.frontFile) fd.append('frontImage', kycForm.frontFile);
    if (kycForm.backFile) fd.append('backImage', kycForm.backFile);

    setSubmittingKyc(true);
    try {
      await api.post('/api/kyc/submit', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Identity submitted to Admin');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit identity');
    } finally {
      setSubmittingKyc(false);
    }
  };

  const fetchAddressSuggestions = (input) => {
    if (!input) {
      setAddressSuggestions([]);
      return;
    }
    if (addressDebounce.current) clearTimeout(addressDebounce.current);
    if (addressAbort.current) addressAbort.current.abort();
    addressDebounce.current = setTimeout(async () => {
      setPlacesLoading(true);
      setPlacesError('');
      const controller = new AbortController();
      addressAbort.current = controller;
      try {
        const res = await api.get('/api/places/autocomplete', { params: { input }, signal: controller.signal });
        const predictions = res?.data?.predictions || [];
        setAddressSuggestions(predictions.map((p) => p.description || p));
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          setPlacesError('Address lookup failed');
          setAddressSuggestions([]);
        }
      } finally {
        setPlacesLoading(false);
      }
    }, 300);
  };

  const applySuggestion = (text) => {
    setPersonalForm((p) => ({
      ...p,
      addressSearch: text,
      residentialAddress: text,
      mailingAddress: p.sameMailing ? text : p.mailingAddress,
    }));
    setAddressSuggestions([]);
  };

  const handleHostNavigate = () => {
    if (loading) return;
    navigate(isHost ? '/host/dashboard' : '/host/onboard');
  };

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-4">
        <Navbar />
        <div className="max-w-md text-center space-y-4 mt-10">
          <h1 className="text-2xl font-bold">You’re signed out</h1>
          <p className="text-slate-300">Please log in to view your profile and host centre.</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-10 pt-24 md:pt-28 space-y-8">
      <div className="flex justify-center w-full">
        <Navbar />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-500 flex items-center gap-2">
            <FaUserShield className="text-emerald-400" /> Profile
          </h1>
          <p className="text-sm text-slate-400">Your identity, privacy, and host journey in one place.</p>
        </div>
        {loading && <div className="text-xs text-slate-400">Refreshing profile…</div>}
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between text-sm text-slate-200">
          <div className="font-semibold">Profile completeness</div>
          <div>{completion.percent}%</div>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-orange-400 via-amber-400 to-emerald-400 transition-all" style={{ width: `${completion.percent}%` }} />
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {completion.checks.map((c) => (
            <Badge key={c.label} tone={c.done ? 'emerald' : 'amber'}>
              {c.done ? '✓' : '…'} {c.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 flex gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 border border-slate-700 flex items-center justify-center text-2xl text-white shadow-inner">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              {isVerified && (
                <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white rounded-full p-1.5 border border-slate-900">
                  <FaCheckCircle />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xl font-semibold text-white">{user?.name || 'Unnamed user'}</div>
              <div className="text-sm text-slate-300 flex items-center gap-2">
                <FaMapMarkerAlt className="text-emerald-400" />
                {user?.city && user?.country ? `${user.city}, ${user.country}` : 'Location hidden'}
              </div>
              <div className="text-sm text-slate-200">
                <span className="font-semibold">About me: </span>
                {user?.about || 'Tell others about you.'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
            <Metric icon={FaCarSide} label="Bookings" value={stats.bookings} />
            <Metric icon={FaCheckCircle} label="Completed Trips" value={stats.completedTrips} />
            <Metric icon={FaShieldAlt} label="Years on Swifty" value={stats.years} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <FaEdit /> Edit Profile
          </button>
          <button
            onClick={() => setIsAboutModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <FaInfoCircle /> Edit About Me
          </button>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 text-white text-lg font-semibold">
          <FaIdCard className="text-emerald-400" /> Identity Verification
        </div>
        <form className="space-y-3" onSubmit={submitKyc}>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm text-slate-200">
              ID Type
              <select
                value={kycForm.idType}
                onChange={(e) => setKycForm({ ...kycForm, idType: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
              >
                <option>NRIC</option>
                <option>Passport</option>
              </select>
            </label>
            <label className="text-sm text-slate-200">
              {kycForm.idType === 'NRIC' ? 'NRIC Number' : 'Passport Number'}
              <input
                value={kycForm.idNumber}
                onChange={(e) => setKycForm({ ...kycForm, idNumber: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                placeholder={kycForm.idType === 'NRIC' ? '111111223333' : 'A123456'}
                required
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm text-slate-200 flex flex-col gap-2">
              Upload Front (jpeg, jpg, png, pdf)
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800 cursor-pointer">
                  <FaCloudUploadAlt /> Choose file
                  <input
                    type="file"
                    accept=".jpeg,.jpg,.png,.pdf"
                    className="hidden"
                    onChange={(e) => setKycForm({ ...kycForm, frontFile: e.target.files?.[0] || null })}
                  />
                </label>
                <PreviewThumb file={kycForm.frontFile} />
              </div>
            </label>

            <label className="text-sm text-slate-200 flex flex-col gap-2">
              Upload Back (jpeg, jpg, png, pdf)
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800 cursor-pointer">
                  <FaCloudUploadAlt /> Choose file
                  <input
                    type="file"
                    accept=".jpeg,.jpg,.png,.pdf"
                    className="hidden"
                    onChange={(e) => setKycForm({ ...kycForm, backFile: e.target.files?.[0] || null })}
                  />
                </label>
                <PreviewThumb file={kycForm.backFile} />
              </div>
            </label>
          </div>

          <div className="text-xs text-slate-400">
            On submit, Legal Name, Email, ID type/number, and thumbnails are sent to Admin Verification.
          </div>

          <button
            type="submit"
            disabled={submittingKyc}
            className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-2 disabled:opacity-70"
          >
            <FaCheckCircle /> {submittingKyc ? 'Submitting…' : 'Submit for verification'}
          </button>
        </form>
      </div>

      {loading ? <div className="text-slate-200">Loading profile...</div> : null}
      {error ? <div className="text-rose-300 text-sm">{error}</div> : null}

      {/* Personal Information Modal */}
      {isPersonalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white text-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-3xl mx-4 space-y-4 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FaUserCog /> Personal Information
              </h2>
              <button onClick={() => setIsPersonalModalOpen(false)} className="text-slate-500 hover:text-slate-800">✕</button>
            </div>

            <form onSubmit={savePersonal} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm font-semibold text-slate-800">Legal Name
                  <input value={personalForm.legalName} onChange={(e) => setPersonalForm({ ...personalForm, legalName: e.target.value })} className="w-full mt-1 p-2 border rounded" required />
                </label>
                <label className="text-sm font-semibold text-slate-800">Birthdate (one-time)
                  <input type="date" value={personalForm.birthdate} onChange={(e) => setPersonalForm({ ...personalForm, birthdate: e.target.value })} className="w-full mt-1 p-2 border rounded" required />
                </label>
                <label className="text-sm font-semibold text-slate-800">Preferred first name
                  <input value={personalForm.preferredName} onChange={(e) => setPersonalForm({ ...personalForm, preferredName: e.target.value })} className="w-full mt-1 p-2 border rounded" />
                </label>
                <label className="text-sm font-semibold text-slate-800">Phone
                  <input
                    value={personalForm.phone}
                    onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                    className="w-full mt-1 p-2 border rounded"
                    placeholder="+60123456789"
                    onClick={() => handleLockedFieldClick('phone')}
                    readOnly={locked.phone}
                    aria-label="Phone (locked until verified)"
                  />
                  <div className="text-[11px] text-slate-500 mt-1">Will display as {maskPhone(personalForm.phone)}</div>
                </label>
                <label className="text-sm font-semibold text-slate-800">Email
                  <input
                    type="email"
                    value={personalForm.email}
                    onChange={(e) => setPersonalForm({ ...personalForm, email: e.target.value })}
                    className="w-full mt-1 p-2 border rounded"
                    placeholder="johndoe@vroomu.com"
                    required
                    onClick={() => handleLockedFieldClick('email')}
                    readOnly={locked.email}
                    aria-label="Email (locked until verified)"
                  />
                  <div className="text-[11px] text-slate-500 mt-1">Will display as {maskEmail(personalForm.email)}</div>
                </label>
                <label className="text-sm font-semibold text-slate-800">Search address
                  <input
                    value={personalForm.addressSearch}
                    onChange={(e) => {
                      setPersonalForm({ ...personalForm, addressSearch: e.target.value });
                      fetchAddressSuggestions(e.target.value);
                    }}
                    className="w-full mt-1 p-2 border rounded"
                    placeholder="Search address..."
                  />
                  <div className="text-[11px] text-slate-500 mt-1">Powered by Google Places proxy. Select a suggestion or use fallback fields.</div>
                  {placesLoading && <div className="text-[11px] text-slate-500 mt-1">Searching…</div>}
                  {placesError && <div className="text-[11px] text-rose-500 mt-1">{placesError}</div>}
                  {addressSuggestions.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-auto border border-slate-200 rounded-md bg-white shadow">
                      {addressSuggestions.map((s) => (
                        <button key={s} type="button" onClick={() => applySuggestion(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </label>
              </div>

              <label className="text-sm font-semibold text-slate-800">Residential Address
                <textarea
                  value={personalForm.residentialAddress}
                  onChange={(e) => setPersonalForm({ ...personalForm, residentialAddress: e.target.value })}
                  className="w-full mt-1 p-2 border rounded"
                  rows={3}
                  placeholder="Country / Region, House/Floor, Building, Street, Town, Postcode, City, State/Federal Territory"
                />
              </label>

              <div className="flex items-center gap-2">
                <input id="sameMailing" type="checkbox" checked={personalForm.sameMailing} onChange={(e) => setPersonalForm({ ...personalForm, sameMailing: e.target.checked })} className="w-4 h-4" />
                <label htmlFor="sameMailing" className="text-sm text-slate-700">Same as Residential Address?</label>
              </div>

              <label className="text-sm font-semibold text-slate-800">Mailing Address
                <textarea
                  value={personalForm.sameMailing ? personalForm.residentialAddress : personalForm.mailingAddress}
                  onChange={(e) => setPersonalForm({ ...personalForm, mailingAddress: e.target.value })}
                  disabled={personalForm.sameMailing}
                  className="w-full mt-1 p-2 border rounded disabled:opacity-60"
                  rows={3}
                  placeholder="Country / Region, House/Floor, Building, Street, Town, Postcode, City, State/Federal Territory"
                />
              </label>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm font-semibold text-slate-800">City
                  <input value={personalForm.city} onChange={(e) => setPersonalForm({ ...personalForm, city: e.target.value })} className="w-full mt-1 p-2 border rounded" />
                </label>
                <label className="text-sm font-semibold text-slate-800">Country
                  <input value={personalForm.country} onChange={(e) => setPersonalForm({ ...personalForm, country: e.target.value })} className="w-full mt-1 p-2 border rounded" />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="submit" className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700" disabled={loading}>
                  {loading ? 'Saving...' : 'Save changes'}
                </button>
                <button type="button" onClick={() => setIsPersonalModalOpen(false)} className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white text-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FaLock /> Verify to edit {passwordCheckField}
              </h2>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-500 hover:text-slate-800">✕</button>
            </div>
            <label className="text-sm font-semibold text-slate-800">Password
              <input type="password" value={passwordValue} onChange={(e) => setPasswordValue(e.target.value)} className="w-full mt-1 p-2 border rounded" placeholder="Enter your password" />
            </label>
            <div className="flex gap-2">
              <button onClick={verifyPassword} className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">Verify</button>
              <button onClick={() => { setIsPasswordModalOpen(false); setPasswordValue(''); }} className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {isAboutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white text-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-xl mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FaInfoCircle /> About me
              </h2>
              <button onClick={() => setIsAboutModalOpen(false)} className="text-slate-500 hover:text-slate-800">✕</button>
            </div>
            <form onSubmit={saveAbout} className="space-y-3">
              <label className="text-sm font-semibold text-slate-800">Tell us a little bit about yourself
                <textarea value={aboutForm.about} onChange={(e) => setAboutForm({ ...aboutForm, about: e.target.value.slice(0, 500) })} className="w-full mt-1 p-2 border rounded" rows={4} placeholder="Up to 500 characters" />
                <div className="text-xs text-slate-500 mt-1">{aboutForm.about.length}/500</div>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700" disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setIsAboutModalOpen(false)} className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white text-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 space-y-4 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FaEdit /> Edit Profile
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-500 hover:text-slate-800">✕</button>
            </div>

            <form className="space-y-3" onSubmit={saveEditExtras}>
              <label className="text-sm font-semibold text-slate-800 flex flex-col gap-2">
                Edit profile picture
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer">
                    <FaImage /> Choose image
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setEditExtras({ ...editExtras, profilePic: e.target.files?.[0] || null })} />
                  </label>
                  <PreviewThumb file={editExtras.profilePic} />
                </div>
              </label>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FaSchool className="text-emerald-500" /> Where I went to school
                </label>
                <input value={editExtras.school} onChange={(e) => setEditExtras({ ...editExtras, school: e.target.value })} className="w-full p-2 border rounded" placeholder="School" />

                <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FaBriefcase className="text-emerald-500" /> My work
                </label>
                <input value={editExtras.work} onChange={(e) => setEditExtras({ ...editExtras, work: e.target.value })} className="w-full p-2 border rounded" placeholder="Company / Role" />

                <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FaPaw className="text-emerald-500" /> Pets
                </label>
                <input value={editExtras.pets} onChange={(e) => setEditExtras({ ...editExtras, pets: e.target.value })} className="w-full p-2 border rounded" placeholder="Cats, dogs..." />

                <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FaBirthdayCake className="text-emerald-500" /> Decade I was born
                </label>
                <input value={editExtras.decade} onChange={(e) => setEditExtras({ ...editExtras, decade: e.target.value })} className="w-full p-2 border rounded" placeholder="e.g., 1990s" />

                <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FaLanguage className="text-emerald-500" /> Languages I speak
                </label>
                <input value={editExtras.languages} onChange={(e) => setEditExtras({ ...editExtras, languages: e.target.value })} className="w-full p-2 border rounded" placeholder="English, Malay..." />

                <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FaCity className="text-emerald-500" /> Where I live
                </label>
                <input value={editExtras.live} onChange={(e) => setEditExtras({ ...editExtras, live: e.target.value })} className="w-full p-2 border rounded" placeholder="City, Country" />
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="submit" className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">Save</button>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={handleHostNavigate}
          className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-70"
          disabled={loading}
          aria-label={isHost ? 'Go to Host Centre' : 'Become a Host'}
        >
          <FaRocket /> {isHost ? 'Host Centre' : 'Become a Host'}
        </button>
        <button onClick={() => setIsPersonalModalOpen(true)} className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-slate-900/70 border border-slate-800 text-white hover:bg-slate-800">
          <FaUserCog /> Personal Information
        </button>
        <button onClick={() => navigate('/profile/security')} className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-slate-900/70 border border-slate-800 text-white hover:bg-slate-800">
          <FaLock /> Login & Security
        </button>
        <button onClick={() => navigate('/profile/privacy')} className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-slate-900/70 border border-slate-800 text-white hover:bg-slate-800">
          <FaShieldAlt /> Privacy
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;