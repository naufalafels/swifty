import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import api from '../utils/api'; // uses admin auth token via interceptor

const LegalDocs = () => {
  const [terms, setTerms] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTerms = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/api/admin/legal/terms');
        setTerms(res.data?.terms || '');
      } catch (err) {
        console.error('Failed to fetch terms', err);
        setError('Failed to fetch terms');
      } finally {
        setLoading(false);
      }
    };
    fetchTerms();
  }, []);

  const saveTerms = async () => {
    setLoading(true);
    setError('');
    try {
      await api.put('/api/admin/legal/terms', { terms });
      alert('Saved successfully');
    } catch (err) {
      console.error('Failed to save', err);
      setError(err?.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Legal Documents</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Terms & Conditions</h2>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          className="w-full h-96 p-4 border rounded"
          placeholder="Edit terms here..."
        />
        <button
          onClick={saveTerms}
          disabled={loading}
          className="mt-4 bg-green-500 text-white px-4 py-2 rounded flex items-center"
        >
          <Save size={16} className="mr-2" />
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default LegalDocs;