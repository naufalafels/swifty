import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getAdminToken } from '../utils/auth.js';
import { ToastContainer, toast } from 'react-toastify';
import { Save, Upload } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const CompanyProfile = () => {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const token = getAdminToken();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/api/admin/company`, { headers: { Authorization: `Bearer ${token}` }});
        if (mounted) setCompany(res.data.company);
      } catch (err) {
        console.error('Failed to load company', err);
        toast.error('Failed to load company profile');
      } finally { if (mounted) setLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, [token]);

  const updateField = (k, v) => setCompany(c => ({ ...c, [k]: v }));
  const updateAddress = (k, v) => setCompany(c => ({ ...c, address: { ...(c?.address || {}), [k]: v } }));
  const updateContact = (k, v) => setCompany(c => ({ ...c, contact: { ...(c?.contact || {}), [k]: v } }));
  const updateSocial = (k, v) => setCompany(c => ({ ...c, social: { ...(c?.social || {}), [k]: v } }));
  const updateBusiness = (k, v) => setCompany(c => ({ ...c, business: { ...(c?.business || {}), [k]: v } }));
  const handleFileChange = (e) => setLogoFile(e.target.files?.[0] || null);

  const handleSave = async () => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append('name', company.name || '');
      form.append('description', company.description || '');
      form.append('website', company.website || '');
      form.append('industry', company.industry || '');
      form.append('founded', company.founded || '');
      form.append('employees', company.employees || '');
      form.append('contact_email', company.contact?.email || '');
      form.append('contact_phone', company.contact?.phone || '');
      form.append('contact_fax', company.contact?.fax || '');
      form.append('address_street', company.address?.street || '');
      form.append('address_city', company.address?.city || '');
      form.append('address_state', company.address?.state || '');
      form.append('address_zipCode', company.address?.zipCode || '');
      form.append('address_country', company.address?.country || '');
      form.append('social_facebook', company.social?.facebook || '');
      form.append('social_twitter', company.social?.twitter || '');
      form.append('social_linkedin', company.social?.linkedin || '');
      form.append('business_registration', company.business?.registration || '');
      form.append('business_taxId', company.business?.taxId || '');
      if (logoFile) form.append('logo', logoFile);
      if (company.location?.coordinates) {
        form.append('location_lat', company.location.coordinates[1]);
        form.append('location_lng', company.location.coordinates[0]);
      }

      const res = await axios.put(`${API_BASE}/api/admin/company`, form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        setCompany(res.data.company);
        toast.success('Company updated');
      } else {
        toast.error(res.data?.message || 'Update failed');
      }
    } catch (err) {
      console.error('Update company', err);
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally { setLoading(false); }
  };

  if (!company && loading) return <div className="p-6">Loading company profile...</div>;

  return (
    <div className="flex-1 p-6 bg-gray-100 min-h-screen">
      <ToastContainer />
      <h1 className="text-3xl font-bold mb-6">Company Profile</h1>
      <div className="bg-white p-6 rounded-lg shadow-lg space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-2 text-sm font-medium">Company Name</label>
            <input
              type="text"
              value={company?.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">Website</label>
            <input
              type="url"
              value={company?.website || ''}
              onChange={(e) => updateField('website', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">Industry</label>
            <input
              type="text"
              value={company?.industry || ''}
              onChange={(e) => updateField('industry', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">Founded Year</label>
            <input
              type="number"
              value={company?.founded || ''}
              onChange={(e) => updateField('founded', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">Number of Employees</label>
            <input
              type="number"
              value={company?.employees || ''}
              onChange={(e) => updateField('employees', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block mb-2 text-sm font-medium">Description</label>
            <textarea
              value={company?.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              className="w-full p-3 border rounded"
              rows="4"
            />
          </div>
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium">Logo</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full p-3 border rounded"
          />
          {(company?.logo || logoFile) && (
            <img
              src={logoFile ? URL.createObjectURL(logoFile) : company.logo}
              alt="Company Logo"
              className="mt-4 h-20 object-contain"
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block mb-2 text-sm font-medium">Contact Email</label>
            <input
              type="email"
              value={company?.contact?.email || ''}
              onChange={(e) => updateContact('email', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">Phone</label>
            <input
              type="tel"
              value={company?.contact?.phone || ''}
              onChange={(e) => updateContact('phone', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">Fax</label>
            <input
              type="tel"
              value={company?.contact?.fax || ''}
              onChange={(e) => updateContact('fax', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-2 text-sm font-medium">Street Address</label>
            <input
              type="text"
              value={company?.address?.street || ''}
              onChange={(e) => updateAddress('street', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">City</label>
            <input
              type="text"
              value={company?.address?.city || ''}
              onChange={(e) => updateAddress('city', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">State</label>
            <input
              type="text"
              value={company?.address?.state || ''}
              onChange={(e) => updateAddress('state', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">Zip Code</label>
            <input
              type="text"
              value={company?.address?.zipCode || ''}
              onChange={(e) => updateAddress('zipCode', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block mb-2 text-sm font-medium">Country</label>
            <input
              type="text"
              value={company?.address?.country || ''}
              onChange={(e) => updateAddress('country', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block mb-2 text-sm font-medium">Facebook</label>
            <input
              type="url"
              value={company?.social?.facebook || ''}
              onChange={(e) => updateSocial('facebook', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">Twitter</label>
            <input
              type="url"
              value={company?.social?.twitter || ''}
              onChange={(e) => updateSocial('twitter', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">LinkedIn</label>
            <input
              type="url"
              value={company?.social?.linkedin || ''}
              onChange={(e) => updateSocial('linkedin', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-2 text-sm font-medium">Business Registration Number</label>
            <input
              type="text"
              value={company?.business?.registration || ''}
              onChange={(e) => updateBusiness('registration', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">Tax ID</label>
            <input
              type="text"
              value={company?.business?.taxId || ''}
              onChange={(e) => updateBusiness('taxId', e.target.value)}
              className="w-full p-3 border rounded"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Save size={20} className="mr-2" />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyProfile;