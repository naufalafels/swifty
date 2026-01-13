import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getAdminToken } from '../utils/auth.js';
import { ToastContainer, toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const CompanyProfile = () => {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const token = getAdminToken();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const fetchCompany = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/api/admin/company`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!cancelled) setCompany(res.data.company);
      } catch (err) {
        console.error('Fetch company error', err);
        toast.error('Failed to load company profile');
        if (err?.response?.status === 401) {
          navigate('/login');
        }
      } finally { if (!cancelled) setLoading(false); }
    };
    fetchCompany();
    return () => { cancelled = true; };
  }, [token, navigate]);

  const updateField = (field, value) => {
    setCompany(c => ({ ...c, [field]: value }));
  };

  const updateAddressField = (field, value) => {
    setCompany(c => ({ ...c, address: { ...(c?.address || {}), [field]: value } }));
  };

  const onSave = async () => {
    setLoading(true);
    try {
      const payload = {
        name: company.name,
        address: company.address,
        contact: company.contact,
        location: company.location
      };
      const res = await axios.put(`${API_BASE}/api/admin/company`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success('Company profile updated');
        setCompany(res.data.company);
      } else {
        toast.error(res.data?.message || 'Update failed');
      }
    } catch (err) {
      console.error('Update company error', err);
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally { setLoading(false); }
  };

  if (loading && !company) return <div className="p-6 text-white">Loading...</div>;
  if (!company) return <div className="p-6 text-white">No company data</div>;

  return (
    <div className="p-6 text-white max-w-3xl mx-auto">
      <ToastContainer />
      <h2 className="text-2xl font-bold mb-4">Company Profile</h2>

      <div className="mb-4">
        <label className="block text-sm text-gray-300">Name</label>
        <input value={company.name || ''} onChange={e => updateField('name', e.target.value)} className="w-full p-2 rounded bg-gray-800" />
      </div>

      <h3 className="text-lg font-semibold mt-4">Address</h3>
      <div className="grid grid-cols-1 gap-3">
        <input placeholder="Street" value={company.address?.street || ''} onChange={e => updateAddressField('street', e.target.value)} className="p-2 rounded bg-gray-800" />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="City" value={company.address?.city || ''} onChange={e => updateAddressField('city', e.target.value)} className="p-2 rounded bg-gray-800" />
          <input placeholder="State" value={company.address?.state || ''} onChange={e => updateAddressField('state', e.target.value)} className="p-2 rounded bg-gray-800" />
        </div>
        <input placeholder="Zip Code" value={company.address?.zipCode || ''} onChange={e => updateAddressField('zipCode', e.target.value)} className="p-2 rounded bg-gray-800" />
      </div>

      <h3 className="text-lg font-semibold mt-4">Contact</h3>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Email" value={company.contact?.email || ''} onChange={e => updateField('contact', { ...(company.contact || {}), email: e.target.value })} className="p-2 rounded bg-gray-800" />
        <input placeholder="Phone" value={company.contact?.phone || ''} onChange={e => updateField('contact', { ...(company.contact || {}), phone: e.target.value })} className="p-2 rounded bg-gray-800" />
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={onSave} className="px-4 py-2 bg-orange-600 rounded" disabled={loading}>Save</button>
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-gray-700 rounded">Back</button>
      </div>
    </div>
  );
};

export default CompanyProfile;