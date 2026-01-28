import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, Eye } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const Verification = () => {
  const [users, setUsers] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, hostRes] = await Promise.all([
          axios.get(`${API_BASE}/api/admin/verifications/users`, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }),
          axios.get(`${API_BASE}/api/admin/verifications/hosts`, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }),
        ]);
        setUsers(userRes.data);
        setHosts(hostRes.data);
      } catch (err) {
        console.error('Failed to fetch verifications', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAction = async (id, type, action) => {
    try {
      await axios.post(`${API_BASE}/api/admin/verifications/${type}/${id}/${action}`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } });
      // Refresh data
      window.location.reload();
    } catch (err) {
      console.error('Action failed', err);
    }
  };

  const renderTable = (data, type) => (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white rounded-lg shadow">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Number</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pictures</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((item) => (
            <tr key={item.id}>
              <td className="px-6 py-4">{item.fullName}</td>
              <td className="px-6 py-4">{item.idNumber}</td>
              <td className="px-6 py-4">
                {item.pictures?.map((pic, idx) => (
                  <img key={idx} src={pic} alt="ID" className="w-16 h-16 inline mr-2 rounded" />
                ))}
              </td>
              <td className="px-6 py-4 space-x-2">
                <button onClick={() => handleAction(item.id, type, 'approve')} className="bg-green-500 text-white px-3 py-1 rounded">
                  <CheckCircle size={16} />
                </button>
                <button onClick={() => handleAction(item.id, type, 'reject')} className="bg-red-500 text-white px-3 py-1 rounded">
                  <XCircle size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) return <div className="p-6">Loading verifications...</div>;

  return (
    <div className="flex-1 p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">User and Host Verification</h1>
      <div className="mb-4">
        <button onClick={() => setActiveTab('users')} className={`mr-4 px-4 py-2 rounded ${activeTab === 'users' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>Users</button>
        <button onClick={() => setActiveTab('hosts')} className={`px-4 py-2 rounded ${activeTab === 'hosts' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>Hosts</button>
      </div>
      {activeTab === 'users' ? renderTable(users, 'users') : renderTable(hosts, 'hosts')}
    </div>
  );
};

export default Verification;