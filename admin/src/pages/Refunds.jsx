import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CreditCard } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const Refunds = () => {
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/admin/bookings`, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } });
        setBookings(res.data);
      } catch (err) {
        console.error('Failed to fetch bookings', err);
      }
    };
    fetchBookings();
  }, []);

  const processRefund = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/admin/refunds`, { bookingId: selectedBooking, amount, reason }, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } });
      alert('Refund processed');
      setSelectedBooking('');
      setAmount('');
      setReason('');
    } catch (err) {
      console.error('Refund failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Process Refunds</h1>
      <div className="bg-white p-6 rounded-lg shadow max-w-md">
        <label className="block mb-4">
          Select Booking:
          <select value={selectedBooking} onChange={(e) => setSelectedBooking(e.target.value)} className="w-full p-2 border rounded mt-1">
            <option value="">Choose...</option>
            {bookings.map((b) => <option key={b.id} value={b.id}>{b.id} - {b.user}</option>)}
          </select>
        </label>
        <label className="block mb-4">
          Amount:
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-2 border rounded mt-1" />
        </label>
        <label className="block mb-4">
          Reason:
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full p-2 border rounded mt-1" />
        </label>
        <button onClick={processRefund} disabled={loading || !selectedBooking} className="bg-red-500 text-white px-4 py-2 rounded flex items-center">
          <CreditCard size={16} className="mr-2" />
          {loading ? 'Processing...' : 'Process Refund'}
        </button>
      </div>
    </div>
  );
};

export default Refunds;