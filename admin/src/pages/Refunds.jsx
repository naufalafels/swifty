import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getAdminToken } from '../utils/auth.js';
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
  const token = getAdminToken();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/admin/refunds/eligible`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEligible(res.data.eligible || []);
      setPastRefunds(res.data.pastRefunds || []);
    } catch (err) {
      console.error('Failed to fetch refund data', err);
      toast.error('Failed to load refund data');
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
      const res = await axios.post(
        `${API_BASE}/api/admin/refunds`,
        { bookingId, amount, reason },
        { headers: { Authorization: `Bearer ${token}` } }
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
                  <img src={b.car.image} alt="" className="w-16 h-12 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{b.car?.make} {b.car?.model} {b.car?.year}</p>
                  <p className="text-xs text-gray-400 truncate">
                    Booking: ...{String(b.bookingId).slice(-8)} &bull; {b.user?.name}
                  </p>
                </div>
                <PolicyBadge b={b} />
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-sm">{fmt(b.amount)}</p>
                  <p className="text-xs text-gray-400">{new Date(b.bookingDate).toLocaleDateString()}</p>
                </div>
                {expandedId === b.bookingId ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>

              {/* Expanded Detail */}
              {expandedId === b.bookingId && (
                <div className="border-t p-5 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Car Details */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2"><Car size={16} /> Car Details</h4>
                      {b.car?.image && (
                        <img
                          src={b.car.image} alt="" className="w-full h-36 rounded-lg object-cover cursor-pointer"
                          onClick={() => setModalImg(b.car.image)}
                        />
                      )}
                      <div className="text-sm space-y-1 bg-white p-3 rounded-lg">
                        <p><strong>Car:</strong> {b.car?.make} {b.car?.model} ({b.car?.year})</p>
                        <p><strong>Plate:</strong> {b.car?.plateNumber || '—'}</p>
                        <p><strong>Color:</strong> {b.car?.color || '—'}</p>
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
                            <img src={b.user.profileImage} alt="" className="w-14 h-14 rounded-full object-cover cursor-pointer" onClick={() => setModalImg(b.user.profileImage)} />
                          ) : (
                            <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-lg">
                              {(b.user?.name || '?')[0]?.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{b.user?.name}</p>
                            <p className="text-xs text-gray-400">{b.user?.email}</p>
                            <p className="text-xs text-gray-400">{b.user?.phone}</p>
                          </div>
                        </div>
                        <hr />
                        <p className="text-xs font-medium text-gray-500 uppercase">ID Document ({b.user?.kycIdType || '—'})</p>
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

                    {/* Booking & Policy Details + Refund Action */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2"><Shield size={16} /> Booking & Policy</h4>
                      <div className="bg-white p-3 rounded-lg text-sm space-y-2">
                        <p><strong>Booking ID:</strong> <span className="font-mono text-xs">{b.bookingId}</span></p>
                        <p className="flex items-center gap-1"><Calendar size={14} /> <strong>Pickup:</strong> {new Date(b.pickupDate).toLocaleDateString()}</p>
                        <p className="flex items-center gap-1"><Calendar size={14} /> <strong>Return:</strong> {new Date(b.returnDate).toLocaleDateString()}</p>
                        <hr />
                        <p><strong>Total:</strong> {fmt(b.amount)}</p>
                        <p className="text-xs text-gray-400">Rent: {fmt(b.paymentBreakdown?.rent)} &bull; Insurance: {fmt(b.paymentBreakdown?.insurance)} &bull; Deposit: {fmt(b.paymentBreakdown?.deposit)}</p>
                        <hr />
                        <p><strong>Insurance Plan:</strong> <span className="capitalize">{b.insurancePlan?.replace(/_/g, ' ')}</span></p>
                        <p><strong>24hr Policy:</strong> <PolicyBadge b={b} /></p>
                        {b.has24hrPolicy && b.policyExpiresAt && (
                          <p className="text-xs text-gray-400">Expires: {new Date(b.policyExpiresAt).toLocaleString()}</p>
                        )}
                        <p><strong>Hours Since Booking:</strong> {b.hoursSinceBooking}h</p>
                        {b.xenditInvoiceId && <p className="text-xs text-gray-400">Xendit: {b.xenditInvoiceId}</p>}
                      </div>

                      {/* Refund Action */}
                      <div className="bg-white p-3 rounded-lg border-2 border-dashed border-red-200 space-y-3">
                        <h5 className="font-semibold text-sm text-red-600 flex items-center gap-1">
                          <DollarSign size={14} /> Process Refund
                        </h5>
                        <div>
                          <label className="text-xs text-gray-500">Amount (MYR)</label>
                          <input
                            type="number"
                            min="0"
                            max={b.amount}
                            value={refundAmounts[b.bookingId] || ''}
                            onChange={(e) => setRefundAmounts((a) => ({ ...a, [b.bookingId]: e.target.value }))}
                            placeholder={`Max: ${b.amount}`}
                            className="w-full p-2 border rounded text-sm mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Reason</label>
                          <textarea
                            rows={2}
                            value={refundReasons[b.bookingId] || ''}
                            onChange={(e) => setRefundReasons((r) => ({ ...r, [b.bookingId]: e.target.value }))}
                            placeholder="e.g., 24hr cancellation policy"
                            className="w-full p-2 border rounded text-sm mt-1"
                          />
                        </div>
                        <button
                          onClick={() => handleProcessRefund(b.bookingId)}
                          disabled={processingId === b.bookingId}
                          className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <CreditCard size={16} />
                          {processingId === b.bookingId ? 'Processing...' : 'Process Refund via Xendit'}
                        </button>
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