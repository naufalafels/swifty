import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { getAdminToken } from '../utils/auth.js';
import {
  Search, ChevronLeft, ChevronRight, FileText, ExternalLink,
  DollarSign, Clock, CheckCircle, XCircle, RefreshCw,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';
const fmt = (n) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 0 }).format(n || 0);

const statusBadge = (status) => {
  const map = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    expired: 'bg-gray-100 text-gray-600',
    refunded: 'bg-red-100 text-red-700',
    partially_refunded: 'bg-orange-100 text-orange-700',
    failed: 'bg-red-100 text-red-700',
  };
  return `px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`;
};

const statusIcon = (status) => {
  switch (status) {
    case 'paid': return <CheckCircle size={14} className="text-green-500" />;
    case 'expired': return <Clock size={14} className="text-gray-400" />;
    case 'refunded': case 'partially_refunded': return <RefreshCw size={14} className="text-red-500" />;
    case 'failed': return <XCircle size={14} className="text-red-500" />;
    default: return <Clock size={14} className="text-yellow-500" />;
  }
};

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [summary, setSummary] = useState({});
  const [filters, setFilters] = useState({ status: 'all', search: '', startDate: '', endDate: '' });
  const [detailModal, setDetailModal] = useState(null);
  const token = getAdminToken();

  const fetchInvoices = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const res = await axios.get(`${API_BASE}/api/admin/invoices?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInvoices(res.data.invoices || []);
      setPagination(res.data.pagination || {});
      setSummary(res.data.summary || {});
    } catch (err) {
      console.error('Failed to fetch invoices', err);
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const fetchDetail = async (invoiceId) => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDetailModal(res.data);
    } catch (err) {
      console.error('Failed to fetch invoice detail', err);
    }
  };

  return (
    <div className="flex-1 p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Invoices</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-xs text-gray-500 uppercase">Total Invoices</p>
          <p className="text-2xl font-bold">{summary.total || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-xs text-green-600 uppercase">Paid</p>
          <p className="text-2xl font-bold text-green-600">{summary.paid || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-xs text-yellow-600 uppercase">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{summary.pending || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-xs text-gray-500 uppercase">Expired</p>
          <p className="text-2xl font-bold text-gray-500">{summary.expired || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <p className="text-xs text-gray-500 uppercase">Total Revenue</p>
          <p className="text-2xl font-bold text-green-600">{fmt(summary.totalRevenue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input type="text" placeholder="Customer, email, invoice ID..."
              value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border rounded-lg text-sm">
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
      {loading ? <p className="text-gray-400 p-6">Loading invoices...</p> : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Car</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map((inv) => (
                  <tr key={inv.bookingId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{new Date(inv.bookingDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">...{inv.xenditInvoiceId.slice(-12)}</td>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium">{inv.customer}</p>
                      <p className="text-xs text-gray-400">{inv.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {inv.car?.image && <img src={inv.car.image} alt="" className="w-8 h-6 rounded object-cover" />}
                        <span>{inv.car?.make} {inv.car?.model}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">{fmt(inv.amount)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{inv.xenditPaymentMethod || '—'}<br />{inv.xenditPaymentChannel || ''}</td>
                    <td className="px-4 py-3">
                      <span className={`${statusBadge(inv.paymentStatus)} flex items-center gap-1 w-fit`}>
                        {statusIcon(inv.paymentStatus)} {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => fetchDetail(inv.xenditInvoiceId)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="View details">
                          <FileText size={16} />
                        </button>
                        {inv.xenditInvoiceUrl && (
                          <a href={inv.xenditInvoiceUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-gray-100 text-blue-500" title="Open Xendit invoice">
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400">No invoices found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
            <span className="text-sm text-gray-500">
              {pagination.total > 0
                ? `Showing ${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`
                : 'No results'}
            </span>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => fetchInvoices(pagination.page - 1)} className="p-2 rounded border bg-white disabled:opacity-50 hover:bg-gray-100"><ChevronLeft size={16} /></button>
              <button disabled={pagination.page >= pagination.pages} onClick={() => fetchInvoices(pagination.page + 1)} className="p-2 rounded border bg-white disabled:opacity-50 hover:bg-gray-100"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetailModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Invoice Detail</h2>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-gray-400 text-xs">Customer</p><p className="font-medium">{detailModal.booking?.customer}</p></div>
                <div><p className="text-gray-400 text-xs">Email</p><p>{detailModal.booking?.email}</p></div>
                <div><p className="text-gray-400 text-xs">Amount</p><p className="font-bold text-lg">{fmt(detailModal.booking?.amount)}</p></div>
                <div><p className="text-gray-400 text-xs">Payment Status</p><p><span className={statusBadge(detailModal.booking?.paymentStatus)}>{detailModal.booking?.paymentStatus}</span></p></div>
                <div><p className="text-gray-400 text-xs">Pickup</p><p>{new Date(detailModal.booking?.pickupDate).toLocaleDateString()}</p></div>
                <div><p className="text-gray-400 text-xs">Return</p><p>{new Date(detailModal.booking?.returnDate).toLocaleDateString()}</p></div>
              </div>
              {detailModal.booking?.paymentBreakdown && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 mb-2">Payment Breakdown</p>
                  <p>Rent: {fmt(detailModal.booking.paymentBreakdown.rent)} &bull; Insurance: {fmt(detailModal.booking.paymentBreakdown.insurance)} &bull; Deposit: {fmt(detailModal.booking.paymentBreakdown.deposit)}</p>
                </div>
              )}
              {detailModal.xendit && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs font-medium text-blue-600 mb-2">Xendit Live Data</p>
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(detailModal.xendit, null, 2)}</pre>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setDetailModal(null)} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;