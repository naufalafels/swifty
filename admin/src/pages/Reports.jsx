import React, { useState } from 'react';
import axios from 'axios';
import { Download } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const Reports = () => {
  const [type, setType] = useState('users');
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/admin/reports/${type}`, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-report.pdf`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error('Failed to generate report', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Reports</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <label className="block mb-4">
          Report Type:
          <select value={type} onChange={(e) => setType(e.target.value)} className="ml-2 p-2 border rounded">
            <option value="users">Users</option>
            <option value="bookings">Bookings</option>
            <option value="activities">Activities</option>
          </select>
        </label>
        <button onClick={generateReport} disabled={loading} className="bg-blue-500 text-white px-4 py-2 rounded flex items-center">
          <Download size={16} className="mr-2" />
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>
    </div>
  );
};

export default Reports;