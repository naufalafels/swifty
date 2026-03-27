import Booking from '../models/bookingModel.js';
import User from '../models/userModel.js';
import Car from '../models/carModel.js';
import AuditLog from '../models/auditLogModel.js';
import Refund from '../models/refundModel.js';

export const getAnalytics = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });

    const { period = '12' } = req.query; // months to look back
    const monthsBack = parseInt(period) || 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const [
      revenueAgg,
      totalUsers,
      totalBookings,
      totalCars,
      statusBreakdown,
      dailyBookings,
      topCars,
      refundAgg,
      newUsersAgg,
      paymentMethodAgg,
      loginCount,
    ] = await Promise.all([
      // Monthly revenue
      Booking.aggregate([
        { $match: { companyId, paymentStatus: 'paid', bookingDate: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$bookingDate' } },
            revenue: { $sum: { $ifNull: ['$amount', 0] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.countDocuments({ companyId }),
      Booking.countDocuments({ companyId }),
      Car.countDocuments({ companyId }),

      // Booking status breakdown
      Booking.aggregate([
        { $match: { companyId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Daily bookings (last 30 days)
      Booking.aggregate([
        { $match: { companyId, bookingDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$bookingDate' } },
            count: { $sum: 1 },
            revenue: { $sum: { $ifNull: ['$amount', 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Top performing cars
      Booking.aggregate([
        { $match: { companyId, paymentStatus: 'paid' } },
        {
          $group: {
            _id: '$car.id',
            carName: { $first: { $concat: [{ $ifNull: ['$car.make', ''] }, ' ', { $ifNull: ['$car.model', ''] }] } },
            carImage: { $first: '$car.image' },
            totalRevenue: { $sum: '$amount' },
            bookingCount: { $sum: 1 },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 },
      ]),

      // Refund totals
      Refund.aggregate([
        { $match: { companyId, createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalRefunded: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // New users per month
      User.aggregate([
        { $match: { companyId, createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Payment method breakdown
      Booking.aggregate([
        { $match: { companyId, paymentStatus: 'paid' } },
        {
          $group: {
            _id: { $ifNull: ['$xenditPaymentMethod', 'unknown'] },
            count: { $sum: 1 },
            revenue: { $sum: '$amount' },
          },
        },
      ]),

      // "Active visits" proxy — count admin logins in last 30 days
      AuditLog.countDocuments({
        companyId,
        category: 'auth',
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    // Build response
    const revenueLabels = revenueAgg.map((b) => b._id);
    const revenueValues = revenueAgg.map((b) => b.revenue);
    const bookingCountValues = revenueAgg.map((b) => b.count);
    const totalRevenue = revenueValues.reduce((a, b) => a + b, 0);
    const refundData = refundAgg[0] || { totalRefunded: 0, count: 0 };
    const netRevenue = totalRevenue - refundData.totalRefunded;

    // Growth calculation (compare last 2 months)
    let growth = 0;
    if (revenueValues.length >= 2) {
      const current = revenueValues[revenueValues.length - 1] || 0;
      const previous = revenueValues[revenueValues.length - 2] || 1;
      growth = Math.round(((current - previous) / (previous || 1)) * 100);
    }

    // Average booking value
    const paidBookings = revenueAgg.reduce((s, b) => s + b.count, 0);
    const avgBookingValue = paidBookings > 0 ? Math.round(totalRevenue / paidBookings) : 0;

    // Simple financial projection (linear regression on last 3 months)
    const lastThreeRevenues = revenueValues.slice(-3);
    let projectedNextMonth = 0;
    if (lastThreeRevenues.length >= 2) {
      const avgGrowthRate = lastThreeRevenues.reduce((acc, val, i, arr) => {
        if (i === 0) return acc;
        return acc + (val - arr[i - 1]) / (arr[i - 1] || 1);
      }, 0) / (lastThreeRevenues.length - 1);
      projectedNextMonth = Math.round(
        (lastThreeRevenues[lastThreeRevenues.length - 1] || 0) * (1 + avgGrowthRate)
      );
    }

    // Conversion rate (paid / total bookings)
    const conversionRate = totalBookings > 0
      ? Math.round((paidBookings / totalBookings) * 100)
      : 0;

    return res.json({
      success: true,
      // Summary cards
      totalRevenue,
      netRevenue,
      totalRefunded: refundData.totalRefunded,
      refundCount: refundData.count,
      totalUsers,
      totalBookings,
      totalCars,
      paidBookings,
      avgBookingValue,
      growth,
      conversionRate,
      projectedNextMonth,
      adminLogins30d: loginCount,

      // Chart data
      revenue: { labels: revenueLabels, values: revenueValues },
      bookingTrend: { labels: revenueLabels, values: bookingCountValues },
      dailyBookings: {
        labels: dailyBookings.map((d) => d._id),
        values: dailyBookings.map((d) => d.count),
        revenue: dailyBookings.map((d) => d.revenue),
      },
      newUsers: {
        labels: newUsersAgg.map((u) => u._id),
        values: newUsersAgg.map((u) => u.count),
      },

      // Breakdowns
      statusBreakdown: statusBreakdown.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
      paymentMethods: paymentMethodAgg.map((p) => ({ method: p._id, count: p.count, revenue: p.revenue })),
      topCars,
    });
  } catch (err) {
    console.error('getAnalytics error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};