import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getAdminToken } from '../utils/auth.js';
import { ToastContainer, toast } from 'react-toastify';
import { X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const CompanyProfileModal = ({ onClose = () => {}, onSaved = null }) => {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const token = getAdminToken();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/api/admin/company`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (mounted) setCompany(res.data.company);
      } catch (err) {
        console.error('Failed to load company', err);
        toast.error('Failed to load company profile');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [token]);

  const updateField = (k, v) => setCompany(c => ({ ...c, [k]: v }));
  const updateAddress = (k, v) => setCompany(c => ({ ...c, address: { ...(c?.address || {}), [k]: v } }));
  const updateContact = (k, v) => setCompany(c => ({ ...c, contact: { ...(c?.contact || {}), [k]: v } }));

  const handleFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    setLogoFile(f);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append('name', company.name || '');
      form.append('contact_email', company.contact?.email || '');
      form.append('contact_phone', company.contact?.phone || '');
      form.append('address_street', company.address?.street || '');
      form.append('address_city', company.address?.city || '');
      form.append('address_state', company.address?.state || '');
      form.append('address_zipCode', company.address?.zipCode || '');
      if (logoFile) form.append('logo', logoFile);
      // if company.location fields exist, append as lat/lng
      if (company.location?.coordinates) {
        form.append('location_lat', company.location.coordinates[1]);
        form.append('location_lng', company.location.coordinates[0]);
      }

      const res = await axios.put(`${API_BASE}/api/admin/company`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data?.success) {
        setCompany(res.data.company);
        toast.success('Company updated');
        if (typeof onSaved === 'function') onSaved(res.data.company);
        onClose();
      } else {
        toast.error(res.data?.message || 'Update failed');
      }
    } catch (err) {
      console.error('Update company', err);
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  if (!company && loading) return null;

  return (
    <>
      <ToastContainer />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-gray-900 rounded-lg w-full max-w-3xl p-6 relative">
          <button onClick={onClose} className="absolute right-3 top-3 p-1 rounded hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-xl font-semibold mb-4">Company Profile</h2>

          {!company ? (
            <div className="text-gray-300">Loading...</div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-sm text-gray-300">Name</label>
                <input className="w-full p-2 rounded bg-gray-800" value={company.name || ''} onChange={e => updateField('name', e.target.value)} />
              </div>

              <div>
                <label className="block mb-1 text-sm text-gray-300">Logo (upload)</label>
                <input type="file" accept="image/*" onChange={handleFileChange} className="w-full mb-2 p-2 rounded bg-gray-800" />
                {company.logo && !logoFile && <div className="mt-2"><img src={company.logo} alt="logo preview" className="h-16 object-contain" /></div>}
                {logoFile && <div className="mt-2"><img src={URL.createObjectURL(logoFile)} alt="preview" className="h-16 object-contain" /></div>}
              </div>

              <div>
                <label className="block mb-1 text-sm text-gray-300">Contact Email</label>
                <input className="w-full p-2 rounded bg-gray-800" value={company.contact?.email || ''} onChange={e => updateContact('email', e.target.value)} />
              </div>

              <div>
                <label className="block mb-1 text-sm text-gray-300">Phone</label>
                <input className="w-full p-2 rounded bg-gray-800" value={company.contact?.phone || ''} onChange={e => updateContact('phone', e.target.value)} />
              </div>

              <div>
                <label className="block mb-1 text-sm text-gray-300">Street</label>
                <input className="w-full p-2 rounded bg-gray-800" value={company.address?.street || ''} onChange={e => updateAddress('street', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input placeholder="City" className="p-2 rounded bg-gray-800" value={company.address?.city || ''} onChange={e => updateAddress('city', e.target.value)} />
                <input placeholder="State" className="p-2 rounded bg-gray-800" value={company.address?.state || ''} onChange={e => updateAddress('state', e.target.value)} />
              </div>

              <div>
                <label className="block mb-1 text-sm text-gray-300">Zip Code</label>
                <input className="w-full p-2 rounded bg-gray-800" value={company.address?.zipCode || ''} onChange={e => updateAddress('zipCode', e.target.value)} />
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-orange-600 rounded">
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button onClick={onClose} className="px-4 py-2 bg-gray-700 rounded">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CompanyProfileModal;