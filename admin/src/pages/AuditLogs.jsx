import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { getAdminToken } from '../utils/auth.js';
import { Search, Filter, ChevronLeft, ChevronRight, AlertTriangle, Info, AlertCircle, Download } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'auth', label: '🔐 Auth' },
  { value: 'price_change', label: '💰 Price Changes' },
  { value: 'booking', label: '📅 Bookings' },
  { value: 'verification', label: '✅ Verifications' },
  { value: 'refund', label: '💸 Refunds' },
  { value: 'car_management', label: '🚗 Car Management' },
  { value: 'company', label: '🏢 Company' },
  { value: 'system', label: '⚙️ System' },
];

const SEVERITIES = [
  { value: 'all', label: 'All Severity' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

const severityIcon = (sev) => {
  switch (sev) {
    case 'critical': return <AlertCircle size={16} className="text-red-500" />;
    case 'warning': return <AlertTriangle size={16} className="text-yellow-500" />;
    default: return <Info size={16} className="text-blue-400" />;
  }
};

const severityBadge = (sev) => {
  const colors = {
    critical: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-700',
  };
  return `px-2 py-0.5 rounded text-xs font-medium ${colors[sev] || colors.info}`;
};

const categoryBadge = (cat) => {
  const colors = {
    auth: 'bg-purple-100 text-purple-800',
    price_change: 'bg-orange-100 text-orange-800',
    booking: 'bg-green-100 text-green-800',
    verification: 'bg-teal-100 text-teal-800',
    refund: 'bg-red-100 text-red-800',
    car_management: 'bg-indigo-100 text-indigo-800',
    company: 'bg-gray-100 text-gray-800',
    system: 'bg-slate-100 text-slate-700',
  };
  return `px-2 py-0.5 rounded text-xs font-medium ${colors[cat] || colors.system}`;
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [categoryCounts, setCategoryCounts] = useState({});
  const [filters, setFilters] = useState({
    category: 'all',
    severity: 'all',
    search: '',
    startDate: '',
    endDate: '',
  });
  const [expandedRow, setExpandedRow] = useState(null);
  const token = getAdminToken();

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.severity !== 'all') params.append('severity', filters.severity);
      if (filters.search) params.append('search', filters.search);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const res = await axios.get(`${API_BASE}/api/admin/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs(res.data.logs || []);
      setPagination(res.data.pagination || { page: 1, limit: 50, total: 0, pages: 0 });
      setCategoryCounts(res.data.categoryCounts || {});
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleExport = () => {
    const csvRows = [
      ['Timestamp', 'User', 'Email', 'Category', 'Severity', 'Action', 'Details', 'IP'].join(','),
      ...logs.map(l =>
        [
          new Date(l.timestamp).toISOString(),
          `"${l.userName}"`,
          `"${l.userEmail}"`,
          l.category,
          l.severity,
          `"${l.action}"`,
          `"${(l.details || '').replace(/"/g, '""')}"`,
          l.ip,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="flex-1 p-6 bg-gray-100 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <button onClick={handleExport} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Category summary pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(categoryCounts).map(([cat, count]) => (
          <button key={cat} onClick={() => setFilters(f => ({ ...f, category: f.category === cat ? 'all' : cat }))}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${filters.category === cat ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'}`}>
            {CATEGORIES.find(c => c.value === cat)?.label || cat} ({count})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input type="text" placeholder="Search actions, users..." value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Category</label>
          <select value={filters.category} onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
            className="px-3 py-2 border rounded-lg text-sm">
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Severity</label>
          <select value={filters.severity} onChange={(e) => setFilters(f => ({ ...f, severity: e.target.value }))}
            className="px-3 py-2 border rounded-lg text-sm">
            {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">From</label>
          <input type="date" value={filters.startDate} onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
            className="px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">To</label>
          <input type="date" value={filters.endDate} onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
            className="px-3 py-2 border rounded-lg text-sm" />
        </div>
      </div>

      {/* Table */}
      {loading ? <div className="p-6 text-gray-500">Loading audit logs...</div> : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}>
                      <td className="px-4 py-3">{severityIcon(log.severity)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{log.userName}</div>
                        <div className="text-gray-400 text-xs">{log.userEmail}</div>
                      </td>
                      <td className="px-4 py-3"><span className={categoryBadge(log.category)}>{log.category}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{log.action}</td>
                      <td className="px-4 py-3"><span className={severityBadge(log.severity)}>{log.severity}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.ip}</td>
                    </tr>
                    {expandedRow === log.id && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <div className="text-sm space-y-2">
                            <p><strong>Details:</strong> {log.details || '—'}</p>
                            {log.metadata?.previousValue != null && (
                              <p><strong>Previous Value:</strong> <code className="bg-red-50 px-2 py-0.5 rounded text-red-700">{JSON.stringify(log.metadata.previousValue)}</code></p>
                            )}
                            {log.metadata?.newValue != null && (
                              <p><strong>New Value:</strong> <code className="bg-green-50 px-2 py-0.5 rounded text-green-700">{JSON.stringify(log.metadata.newValue)}</code></p>
                            )}
                            {log.metadata?.targetType && <p><strong>Target:</strong> {log.metadata.targetType} ({String(log.metadata.targetId)})</p>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">No audit logs found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
            <span className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => fetchLogs(pagination.page - 1)}
                className="p-2 rounded border bg-white disabled:opacity-50 hover:bg-gray-100"><ChevronLeft size={16} /></button>
              <button disabled={pagination.page >= pagination.pages} onClick={() => fetchLogs(pagination.page + 1)}
                className="p-2 rounded border bg-white disabled:opacity-50 hover:bg-gray-100"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;