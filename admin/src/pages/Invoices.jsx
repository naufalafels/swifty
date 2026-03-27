import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { getAdminToken, ensureAuth } from '../utils/auth.js';
import {
  Search, ChevronLeft, ChevronRight, ExternalLink, FileText,
  CheckCircle, Clock, XCircle, RotateCcw, DollarSign,
} from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const fmt = (n) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 0 }).format(n || 0);

const statusBadge = (status) => {
  const map = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    expired: 'bg-gray-100 text-gray-600',
    refunded: 'bg-red-100 text-red-700',
    partially_refunded: 'bg-orange-100 text-orange-700',
  };
  return `px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`;
};

const statusIcon = (status) => {
  switch (status) {
    case 'paid': return <CheckCircle size={14} className="text-green-500" />;
    case 'pending': return <Clock size={14} className="text-yellow-500" />;
    case 'expired': return <XCircle size={14} className="text-gray-400" />;
    case 'refunded': return <RotateCcw size={14} className="text-red-500" />;
    default: return <FileText size={14} className="text-gray-400" />;
  }
};

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'all', search: '', startDate: '', endDate: '' });
  const [expandedId, setExpandedId] = useState(null);

  // FIX: Removed `const token = getAdminToken();` from here.
  // The token was captured ONCE at mount and went stale after ensureAuth() refreshed it.

  const fetchInvoices = useCallback(async (page = 1) => {
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

      const params = new URLSearchParams({ page, limit: 50 });
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const res = await axios.get(`${API_BASE}/api/admin/invoices?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setInvoices(res.data.invoices || []);
      setPagination(res.data.pagination || { page: 1, limit: 50, total: 0, pages: 0 });
      setSummary(res.data.summary || {});
    } catch (err) {
      console.error('Failed to fetch invoices', err);
      toast.error(err?.response?.data?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [filters]);  // FIX: Removed `token` from deps

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  return (
    <div className="flex-1 p-6 bg-gray-50 min-h-screen">
      <ToastContainer />
      <h1 className="text-3xl font-bold mb-6">Invoices</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-xs text-gray-500 uppercase">Total Invoices</p>
          <p className="text-2xl font-bold">{summary.total || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-xs text-gray-500 uppercase flex items-center gap-1"><CheckCircle size={12} className="text-green-500" /> Paid</p>
          <p className="text-2xl font-bold text-green-600">{summary.paid || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-xs text-gray-500 uppercase flex items-center gap-1"><Clock size={12} className="text-yellow-500" /> Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{summary.pending || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-xs text-gray-500 uppercase flex items-center gap-1"><RotateCcw size={12} className="text-red-500" /> Refunded</p>
          <p className="text-2xl font-bold text-red-600">{summary.refunded || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-xs text-gray-500 uppercase flex items-center gap-1"><DollarSign size={12} className="text-green-500" /> Revenue</p>
          <p className="text-2xl font-bold text-green-700">{fmt(summary.totalRevenue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input type="text" placeholder="Customer, email, Xendit ID..." value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">From</label>
          <input type="date" value={filters.startDate} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
            className="px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">To</label>
          <input type="date" value={filters.endDate} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
            className="px-3 py-2 border rounded-lg text-sm" />
        </div>
      </div>

      {/* Table */}
      {loading ? <div className="p-6 text-gray-500">Loading invoices...</div> : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Xendit ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Car</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map((inv) => (
                  <React.Fragment key={inv.bookingId}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === inv.bookingId ? null : inv.bookingId)}>
                      <td className="px-4 py-3">{statusIcon(inv.paymentStatus)}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{inv.bookingDate ? new Date(inv.bookingDate).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">...{String(inv.xenditInvoiceId || '').slice(-10)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div>{inv.customer}</div>
                        <div className="text-xs text-gray-400">{inv.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {inv.car?.image && <img src={inv.car.image} alt="" className="w-8 h-6 rounded object-cover" />}
                          <span>{inv.car?.make} {inv.car?.model}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">{fmt(inv.amount)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 capitalize">{inv.xenditPaymentMethod || '—'}</td>
                      <td className="px-4 py-3"><span className={statusBadge(inv.paymentStatus)}>{inv.paymentStatus}</span></td>
                      <td className="px-4 py-3">
                        {inv.xenditInvoiceUrl && (
                          <a href={inv.xenditInvoiceUrl} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700" onClick={(e) => e.stopPropagation()}>
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </td>
                    </tr>
                    {expandedId === inv.bookingId && (
                      <tr>
                        <td colSpan={9} className="px-6 py-4 bg-gray-50">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-gray-400">Booking ID</p>
                              <p className="font-mono text-xs">{inv.bookingId}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Pickup Date</p>
                              <p>{inv.pickupDate ? new Date(inv.pickupDate).toLocaleDateString() : '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Return Date</p>
                              <p>{inv.returnDate ? new Date(inv.returnDate).toLocaleDateString() : '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Payment Channel</p>
                              <p className="capitalize">{inv.xenditPaymentChannel || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Phone</p>
                              <p>{inv.phone || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Currency</p>
                              <p>{inv.currency}</p>
                            </div>
                            {inv.paymentBreakdown && (
                              <>
                                <div>
                                  <p className="text-xs text-gray-400">Rent</p>
                                  <p>{fmt(inv.paymentBreakdown.rent)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400">Insurance</p>
                                  <p>{fmt(inv.paymentBreakdown.insurance)}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {invoices.length === 0 && (
                  <tr><td colSpan={9} className="px-6 py-10 text-center text-gray-400">No invoices found. Invoices appear here after a booking is created with Xendit payment.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
            <span className="text-sm text-gray-500">
              Showing {invoices.length > 0 ? ((pagination.page - 1) * pagination.limit) + 1 : 0}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => fetchInvoices(pagination.page - 1)}
                className="p-2 rounded border bg-white disabled:opacity-50 hover:bg-gray-100"><ChevronLeft size={16} /></button>
              <button disabled={pagination.page >= pagination.pages} onClick={() => fetchInvoices(pagination.page + 1)}
                className="p-2 rounded border bg-white disabled:opacity-50 hover:bg-gray-100"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;