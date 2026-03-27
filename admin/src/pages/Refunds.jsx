import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getAdminToken, ensureAuth } from '../utils/auth.js';
import {
  CreditCard, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Car, User, FileText, Shield, Calendar, DollarSign, Image,
} from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const fmt = (n) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 0 }).format(n || 0);

const PolicyBadge = ({ b }) => {
  if (!b.has24hrPolicy)
    return <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">No 24hr Policy</span>;
  if (b.is24hrEligible)
    return (
      <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700 flex items-center gap-1">
        <CheckCircle size={12} /> 24hr Active ({Math.round(24 - b.hoursSinceBooking)}h left)
      </span>
    );
  return (
    <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 flex items-center gap-1">
      <XCircle size={12} /> 24hr Expired ({b.hoursSinceBooking}h ago)
    </span>
  );
};

const ImageModal = ({ src, onClose }) => {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <img src={src} alt="Full size" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
};

const Refunds = () => {
  const [eligible, setEligible] = useState([]);
  const [pastRefunds, setPastRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [refundAmounts, setRefundAmounts] = useState({});
  const [refundReasons, setRefundReasons] = useState({});
  const [tab, setTab] = useState('eligible');
  const [modalImg, setModalImg] = useState(null);

  // FIX: Removed `const token = getAdminToken();` from here.
  // Token was captured ONCE at mount and went stale after ensureAuth() refreshed it.

  const fetchData = async () => {
    setLoading(true);
    try {
      // FIX: Ensure auth is valid, THEN get fresh token
      await ensureAuth();
      const token = getAdminToken();
      if (!token) {
        toast.error('Not authenticated. Please log in again.');
        setLoading(false);
        return;
      }

      const res = await axios.get(`${API_BASE}/api/admin/refunds/eligible`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setEligible(res.data.eligible || []);
      setPastRefunds(res.data.pastRefunds || []);
    } catch (err) {
      console.error('Failed to fetch refund data', err);
      toast.error(err?.response?.data?.message || 'Failed to load refund data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProcessRefund = async (bookingId) => {
    const amount = parseFloat(refundAmounts[bookingId]);
    const reason = refundReasons[bookingId] || '';
    if (!amount || amount <= 0) {
      toast.error('Enter a valid refund amount');
      return;
    }

    setProcessingId(bookingId);
    try {
      // FIX: Get fresh token for the POST request too
      await ensureAuth();
      const token = getAdminToken();

      const res = await axios.post(
        `${API_BASE}/api/admin/refunds`,
        { bookingId, amount, reason },
        { headers: { Authorization: `Bearer ${token}` }, withCredentials: true }
      );
      toast.success(
        `Refund ${res.data.xenditRefundStatus === 'processed' ? 'processed via Xendit' : 'recorded (pending Xendit)'}`
      );
      fetchData();
      setExpandedId(null);
      setRefundAmounts((a) => ({ ...a, [bookingId]: '' }));
      setRefundReasons((r) => ({ ...r, [bookingId]: '' }));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Refund failed');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading refund data...</div>;

  return (
    <div className="flex-1 p-6 bg-gray-50 min-h-screen">
      <ToastContainer />
      <ImageModal src={modalImg} onClose={() => setModalImg(null)} />
      <h1 className="text-3xl font-bold mb-6">Refund Management</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setTab('eligible')}
          className={`px-4 py-2 rounded-lg font-medium transition ${tab === 'eligible' ? 'bg-gray-800 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}
        >
          Eligible Bookings ({eligible.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 rounded-lg font-medium transition ${tab === 'history' ? 'bg-gray-800 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}
        >
          Refund History ({pastRefunds.length})
        </button>
      </div>

      {/* Eligible tab */}
      {tab === 'eligible' && (
        <div className="space-y-4">
          {eligible.length === 0 && <p className="text-gray-400 text-center py-10">No bookings eligible for refund.</p>}
          {eligible.map((b) => (
            <div key={b.bookingId} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Summary Row */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === b.bookingId ? null : b.bookingId)}
              >
                {b.car?.image && (
                  <img src={b.car.image} alt="" className="w-16 h-12 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{b.car?.make} {b.car?.model} {b.car?.year}</span>
                    <PolicyBadge b={b} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {b.user?.name} • {b.user?.email} • Booked: {b.bookingDate ? new Date(b.bookingDate).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{fmt(b.amount)}</p>
                  <p className="text-xs text-gray-400">{b.status}</p>
                </div>
                {expandedId === b.bookingId ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>

              {/* Expanded Details */}
              {expandedId === b.bookingId && (
                <div className="border-t p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Car Details */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2"><Car size={16} /> Car Details</h4>
                      <div className="bg-white p-3 rounded-lg space-y-1 text-sm">
                        {b.car?.image && <img src={b.car.image} alt="" className="w-full h-32 object-cover rounded-lg mb-2" />}
                        <p><strong>Make:</strong> {b.car?.make || '—'}</p>
                        <p><strong>Model:</strong> {b.car?.model || '—'}</p>
                        <p><strong>Year:</strong> {b.car?.year || '—'}</p>
                        <p><strong>Color:</strong> {b.car?.color || '—'}</p>
                        <p><strong>Plate:</strong> {b.car?.plateNumber || '—'}</p>
                        <p><strong>Category:</strong> {b.car?.category || '—'}</p>
                        <p><strong>Transmission:</strong> {b.car?.transmission || '—'}</p>
                        <p><strong>Fuel:</strong> {b.car?.fuelType || '—'}</p>
                        <p><strong>Seats:</strong> {b.car?.seats || '—'}</p>
                        <p><strong>Daily Rate:</strong> {fmt(b.car?.dailyRate)}</p>
                      </div>
                    </div>

                    {/* User Details + KYC IDs */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2"><User size={16} /> User / Guest Details</h4>
                      <div className="bg-white p-3 rounded-lg space-y-3">
                        <div className="flex items-center gap-3">
                          {b.user?.profileImage ? (
                            <img src={b.user.profileImage} alt="" className="w-12 h-12 rounded-full object-cover cursor-pointer" onClick={() => setModalImg(b.user.profileImage)} />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-400"><User size={20} /></div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{b.user?.name || '—'}</p>
                            <p className="text-xs text-gray-500">{b.user?.email || '—'}</p>
                            <p className="text-xs text-gray-500">{b.user?.phone || '—'}</p>
                          </div>
                        </div>
                        <hr />
                        <h5 className="text-xs font-semibold text-gray-500 uppercase">KYC / ID Documents</h5>
                        <p className="text-sm"><strong>ID Type:</strong> {b.user?.kycIdType || '—'}</p>
                        <p className="text-sm"><strong>ID Number:</strong> {b.user?.kycIdNumber || '—'}</p>
                        <p className="text-sm"><strong>Country:</strong> {b.user?.kycIdCountry || '—'}</p>

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Front ID</p>
                            {b.user?.kycFrontImage ? (
                              <img src={b.user.kycFrontImage} alt="Front ID" className="w-full h-24 object-cover rounded cursor-pointer border" onClick={() => setModalImg(b.user.kycFrontImage)} />
                            ) : (
                              <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">No image</div>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Back ID</p>
                            {b.user?.kycBackImage ? (
                              <img src={b.user.kycBackImage} alt="Back ID" className="w-full h-24 object-cover rounded cursor-pointer border" onClick={() => setModalImg(b.user.kycBackImage)} />
                            ) : (
                              <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">No image</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Booking & Payment Details + Refund Action */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2"><FileText size={16} /> Booking & Payment</h4>
                      <div className="bg-white p-3 rounded-lg space-y-1 text-sm">
                        <p><strong>Booking ID:</strong> <span className="font-mono text-xs">{b.bookingId}</span></p>
                        <p><strong>Pickup:</strong> {b.pickupDate ? new Date(b.pickupDate).toLocaleDateString() : '—'}</p>
                        <p><strong>Return:</strong> {b.returnDate ? new Date(b.returnDate).toLocaleDateString() : '—'}</p>
                        <p><strong>Status:</strong> {b.status}</p>
                        <p><strong>Payment:</strong> {b.paymentStatus}</p>
                        <p><strong>Xendit Invoice:</strong> <span className="font-mono text-xs">{b.xenditInvoiceId || '—'}</span></p>
                        <hr className="my-2" />
                        <p><strong>Insurance Plan:</strong> {b.insurancePlan}</p>
                        <p><strong>Insurance Cost:</strong> {fmt(b.insuranceCost)}</p>
                        <hr className="my-2" />
                        <p><strong>Rent:</strong> {fmt(b.paymentBreakdown?.rent)}</p>
                        <p><strong>Insurance:</strong> {fmt(b.paymentBreakdown?.insurance)}</p>
                        <p><strong>Deposit:</strong> {fmt(b.paymentBreakdown?.deposit)}</p>
                        <p className="font-semibold"><strong>Total:</strong> {fmt(b.amount)}</p>
                      </div>

                      {/* Refund Form */}
                      <div className="bg-white p-3 rounded-lg border-2 border-dashed border-gray-300">
                        <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Process Refund</h5>
                        <div className="space-y-2">
                          <input
                            type="number"
                            placeholder={`Max: ${b.amount}`}
                            value={refundAmounts[b.bookingId] || ''}
                            onChange={(e) => setRefundAmounts((a) => ({ ...a, [b.bookingId]: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                            max={b.amount}
                            min={0}
                          />
                          <input
                            type="text"
                            placeholder="Reason (optional)"
                            value={refundReasons[b.bookingId] || ''}
                            onChange={(e) => setRefundReasons((r) => ({ ...r, [b.bookingId]: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                          />
                          <button
                            onClick={() => handleProcessRefund(b.bookingId)}
                            disabled={processingId === b.bookingId}
                            className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            {processingId === b.bookingId ? 'Processing...' : 'Process Refund'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Booking</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pastRefunds.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      ...{String(r.bookingId?._id || r.bookingId).slice(-8)}
                    </td>
                    <td className="px-4 py-3 text-sm">{r.bookingId?.customer || '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-red-600">{fmt(r.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{r.reason || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.status === 'processed' ? 'bg-green-100 text-green-700' : r.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.processedBy?.name || '—'}</td>
                  </tr>
                ))}
                {pastRefunds.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">No refund history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Refunds;