import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, Eye, WalletCards } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const Verification = () => {
  const [users, setUsers] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [payoutEdits, setPayoutEdits] = useState({});
  const [savingPayout, setSavingPayout] = useState({});

  const authHeader = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [userRes, hostRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/verifications/users`, { headers: authHeader }),
        axios.get(`${API_BASE}/api/admin/verifications/hosts`, { headers: authHeader }),
      ]);
      setUsers(userRes.data || []);
      setHosts(hostRes.data || []);
      // prefill payout edits with existing payoutReference if present
      const initialPayouts = {};
      (hostRes.data || []).forEach((h) => {
        if (h.id) initialPayouts[h.id] = h.payoutReference || '';
      });
      setPayoutEdits(initialPayouts);
    } catch (err) {
      console.error('Failed to fetch verifications', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (id, type, action) => {
    try {
      await axios.post(
        `${API_BASE}/api/admin/verifications/${type}/${id}/${action}`,
        {},
        { headers: authHeader }
      );
      await fetchData();
    } catch (err) {
      console.error('Action failed', err);
    }
  };

  const savePayoutReference = async (hostId) => {
    const payoutReference = payoutEdits[hostId] || '';
    if (!payoutReference.trim()) {
      alert('Please enter a payout reference (e.g., bank account or Stripe/Razorpay ID).');
      return;
    }
    setSavingPayout((s) => ({ ...s, [hostId]: true }));
    try {
      await axios.post(
        `${API_BASE}/api/admin/verifications/hosts/${hostId}/payout-reference`,
        { payoutReference },
        { headers: authHeader }
      );
      await fetchData();
    } catch (err) {
      console.error('Failed to save payout reference', err);
    } finally {
      setSavingPayout((s) => ({ ...s, [hostId]: false }));
    }
  };

  const renderTable = (data, type) => {
    const isHost = type === 'hosts';
    const hasData = (data || []).length > 0;

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg shadow">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pictures</th>
              {isHost && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase flex items-center gap-2">
                  <WalletCards className="w-4 h-4" />
                  Payout Reference
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {!hasData && (
              <tr>
                <td
                  className="px-6 py-6 text-center text-sm text-gray-500"
                  colSpan={isHost ? 5 : 4}
                >
                  No records found.
                </td>
              </tr>
            )}
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{item.fullName}</td>
                <td className="px-6 py-4 text-gray-700">{item.idNumber}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {item.pictures?.map((pic, idx) => (
                      <img
                        key={idx}
                        src={pic}
                        alt="ID"
                        className="w-16 h-16 object-cover rounded border"
                      />
                    ))}
                    {!item.pictures?.length && (
                      <span className="text-xs text-gray-500">No pictures</span>
                    )}
                  </div>
                </td>
                {isHost && (
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={payoutEdits[item.id] ?? ''}
                        onChange={(e) =>
                          setPayoutEdits((p) => ({ ...p, [item.id]: e.target.value }))
                        }
                        placeholder="Bank acc / Stripe acct / Razorpay acc"
                        className="w-full rounded border px-3 py-2 text-sm focus:ring focus:ring-indigo-200"
                      />
                      <button
                        onClick={() => savePayoutReference(item.id)}
                        disabled={savingPayout[item.id]}
                        className="inline-flex items-center justify-center gap-2 rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                      >
                        {savingPayout[item.id] ? 'Saving…' : 'Save payout reference'}
                      </button>
                    </div>
                  </td>
                )}
                <td className="px-6 py-4 space-x-2">
                  <button
                    onClick={() => handleAction(item.id, type, 'approve')}
                    className="inline-flex items-center gap-1 rounded bg-green-500 px-3 py-1 text-sm font-semibold text-white hover:bg-green-400"
                  >
                    <CheckCircle size={16} />
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(item.id, type, 'reject')}
                    className="inline-flex items-center gap-1 rounded bg-red-500 px-3 py-1 text-sm font-semibold text-white hover:bg-red-400"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                  {item.documentsUrl && (
                    <a
                      href={item.documentsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-300"
                    >
                      <Eye size={16} />
                      View docs
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex-1 p-4 sm:p-6 bg-gray-100 min-h-screen">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Verification</h1>
          <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm">
            {['users', 'hosts'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab === 'users' ? 'Users' : 'Hosts (KYC + Payout)'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          {loading ? (
            <div className="text-sm text-gray-600">Loading verifications…</div>
          ) : activeTab === 'users' ? (
            renderTable(users, 'users')
          ) : (
            renderTable(hosts, 'hosts')
          )}
        </div>
      </div>
    </div>
  );
};

export default Verification;