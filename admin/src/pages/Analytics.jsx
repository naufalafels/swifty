import React, { useEffect, useState } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import axios from 'axios';
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/admin/analytics`, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } });
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div className="p-6">Loading analytics...</div>;

  const revenueData = {
    labels: data?.revenue?.labels || [],
    datasets: [{ label: 'Revenue ($)', data: data?.revenue?.values || [], backgroundColor: 'rgba(75, 192, 192, 0.6)' }],
  };

  const usageData = {
    labels: data?.usage?.labels || [],
    datasets: [{ label: 'Bookings', data: data?.usage?.values || [], borderColor: 'rgba(153, 102, 255, 1)', fill: false }],
  };

  const performanceData = {
    labels: ['Active Users', 'Total Bookings', 'Avg Response Time'],
    datasets: [{ data: [data?.activeUsers || 0, data?.totalBookings || 0, data?.avgResponseTime || 0], backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'] }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
    },
  };

  return (
    <div className="flex-1 p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <DollarSign className="h-8 w-8 text-green-500 mb-2" />
          <h3 className="text-lg font-semibold">Revenue</h3>
          <p className="text-2xl">${data?.totalRevenue || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <Users className="h-8 w-8 text-blue-500 mb-2" />
          <h3 className="text-lg font-semibold">Users</h3>
          <p className="text-2xl">{data?.totalUsers || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <Activity className="h-8 w-8 text-purple-500 mb-2" />
          <h3 className="text-lg font-semibold">Bookings</h3>
          <p className="text-2xl">{data?.totalBookings || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <TrendingUp className="h-8 w-8 text-orange-500 mb-2" />
          <h3 className="text-lg font-semibold">Growth</h3>
          <p className="text-2xl">+{data?.growth || 0}%</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Revenue Trends</h3>
          <div className="h-64">
            <Bar data={revenueData} options={chartOptions} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Usage Over Time</h3>
          <div className="h-64">
            <Line data={usageData} options={chartOptions} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
          <div className="h-64 mx-auto max-w-md">
            <Doughnut data={performanceData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;