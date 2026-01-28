import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Save } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const LegalDocs = () => {
  const [terms, setTerms] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/admin/legal/terms`, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } });
        setTerms(res.data.terms || `Terms & Conditions for Swifty P2P Car Rental

1. Introduction: This service allows peer-to-peer car sharing. Users rent from hosts.

2. Liability: Hosts are responsible for vehicle condition. Users must return vehicles undamaged.

3. Payments: Processed securely via Stripe/Razorpay. Refunds per policy.

4. Verification: All users/hosts must verify identity.

5. Disputes: Handled via admin review.`);
      } catch (err) {
        console.error('Failed to fetch terms', err);
      }
    };
    fetchTerms();
  }, []);

  const saveTerms = async () => {
    setLoading(true);
    try {
      await axios.put(`${API_BASE}/api/admin/legal/terms`, { terms }, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } });
      alert('Saved successfully');
    } catch (err) {
      console.error('Failed to save', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Legal Documents</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Terms & Conditions</h2>
        <textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          className="w-full h-96 p-4 border rounded"
          placeholder="Edit terms here..."
        />
        <button onClick={saveTerms} disabled={loading} className="mt-4 bg-green-500 text-white px-4 py-2 rounded flex items-center">
          <Save size={16} className="mr-2" />
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default LegalDocs;