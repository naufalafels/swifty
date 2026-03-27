import React, { useEffect, useState } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import axios from 'axios';
import { getAdminToken } from '../utils/auth.js';
import { TrendingUp, TrendingDown, Users, DollarSign, Activity, Car, ShoppingCart, ArrowUpRight, Percent, CalendarClock } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const StatCard = ({ icon: Icon, iconColor, title, value, subtitle, trend }) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
    <div className="flex items-center justify-between mb-3">
      <Icon className={`h-8 w-8 ${iconColor}`} />
      {trend !== undefined && (
        <span className={`flex items-center text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <h3 className="text-sm text-gray-500 font-medium">{title}</h3>
    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
  </div>
);

const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('12');
  const token = getAdminToken();

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/api/admin/analytics?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [period, token]);

  if (loading) return <div className="p-6 text-gray-500">Loading analytics...</div>;
  if (!data) return <div className="p-6 text-red-500">Failed to load analytics data.</div>;

  const fmt = (n) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 0 }).format(n || 0);

  const revenueChart = {
    labels: data.revenue?.labels || [],
    datasets: [
      { label: 'Revenue (MYR)', data: data.revenue?.values || [], backgroundColor: 'rgba(16, 185, 129, 0.7)', borderRadius: 6 },
      { label: 'Bookings', data: data.bookingTrend?.values || [], backgroundColor: 'rgba(99, 102, 241, 0.6)', borderRadius: 6 },
    ],
  };

  const dailyChart = {
    labels: data.dailyBookings?.labels || [],
    datasets: [{
      label: 'Daily Bookings',
      data: data.dailyBookings?.values || [],
      borderColor: 'rgba(99, 102, 241, 1)',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      fill: true,
      tension: 0.3,
    }],
  };

  const userGrowthChart = {
    labels: data.newUsers?.labels || [],
    datasets: [{
      label: 'New Users',
      data: data.newUsers?.values || [],
      borderColor: 'rgba(236, 72, 153, 1)',
      backgroundColor: 'rgba(236, 72, 153, 0.1)',
      fill: true,
      tension: 0.3,
    }],
  };

  const statusLabels = Object.keys(data.statusBreakdown || {});
  const statusValues = Object.values(data.statusBreakdown || {});
  const statusChart = {
    labels: statusLabels,
    datasets: [{ data: statusValues, backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#6366f1', '#ef4444', '#8b5cf6'] }],
  };

  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } } };

  return (
    <div className="flex-1 p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white">
          <option value="3">Last 3 Months</option>
          <option value="6">Last 6 Months</option>
          <option value="12">Last 12 Months</option>
          <option value="24">Last 24 Months</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon={DollarSign} iconColor="text-green-500" title="Total Revenue" value={fmt(data.totalRevenue)} trend={data.growth} />
        <StatCard icon={DollarSign} iconColor="text-emerald-600" title="Net Revenue" value={fmt(data.netRevenue)} subtitle={`Refunds: ${fmt(data.totalRefunded)}`} />
        <StatCard icon={Users} iconColor="text-blue-500" title="Total Users" value={data.totalUsers} />
        <StatCard icon={Activity} iconColor="text-purple-500" title="Total Bookings" value={data.totalBookings} subtitle={`Paid: ${data.paidBookings}`} />
        <StatCard icon={Car} iconColor="text-indigo-500" title="Fleet Size" value={data.totalCars} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={ShoppingCart} iconColor="text-orange-500" title="Avg Booking Value" value={fmt(data.avgBookingValue)} />
        <StatCard icon={Percent} iconColor="text-teal-500" title="Conversion Rate" value={`${data.conversionRate}%`} subtitle="Paid / Total bookings" />
        <StatCard icon={ArrowUpRight} iconColor="text-pink-500" title="Projected Next Month" value={fmt(data.projectedNextMonth)} subtitle="Linear projection" />
        <StatCard icon={CalendarClock} iconColor="text-amber-500" title="Admin Logins (30d)" value={data.adminLogins30d} subtitle="Admin activity proxy" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <h3 className="font-semibold mb-3">Monthly Revenue & Bookings</h3>
          <div className="h-72"><Bar data={revenueChart} options={chartOpts} /></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <h3 className="font-semibold mb-3">Daily Bookings (Last 30 Days)</h3>
          <div className="h-72"><Line data={dailyChart} options={chartOpts} /></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <h3 className="font-semibold mb-3">New User Growth</h3>
          <div className="h-72"><Line data={userGrowthChart} options={chartOpts} /></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <h3 className="font-semibold mb-3">Booking Status Breakdown</h3>
          <div className="h-72 max-w-sm mx-auto"><Doughnut data={statusChart} options={chartOpts} /></div>
        </div>
      </div>

      {/* Top Cars & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <h3 className="font-semibold mb-3">Top Performing Cars</h3>
          <div className="space-y-3">
            {(data.topCars || []).map((car, i) => (
              <div key={car._id || i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-lg font-bold text-gray-400 w-6">#{i + 1}</span>
                {car.carImage && <img src={car.carImage} alt="" className="w-12 h-12 rounded-lg object-cover" />}
                <div className="flex-1">
                  <p className="font-medium text-sm">{car.carName}</p>
                  <p className="text-xs text-gray-400">{car.bookingCount} bookings</p>
                </div>
                <span className="font-semibold text-green-600">{fmt(car.totalRevenue)}</span>
              </div>
            ))}
            {(!data.topCars || data.topCars.length === 0) && <p className="text-gray-400 text-sm">No data yet</p>}
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <h3 className="font-semibold mb-3">Payment Methods</h3>
          <div className="space-y-3">
            {(data.paymentMethods || []).map((pm, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-sm capitalize">{pm.method || 'Unknown'}</span>
                <div className="text-right">
                  <p className="font-semibold text-sm">{fmt(pm.revenue)}</p>
                  <p className="text-xs text-gray-400">{pm.count} transactions</p>
                </div>
              </div>
            ))}
            {(!data.paymentMethods || data.paymentMethods.length === 0) && <p className="text-gray-400 text-sm">No data yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;