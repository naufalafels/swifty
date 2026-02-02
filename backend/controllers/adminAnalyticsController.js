import Booking from '../models/bookingModel.js';
import User from '../models/userModel.js';

export const getAnalytics = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });

    const [bookingAgg, userCount, bookingCount] = await Promise.all([
      Booking.aggregate([
        { $match: { companyId } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$bookingDate' } },
            revenue: { $sum: { $ifNull: ['$totalPrice', 0] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.countDocuments({ companyId }),
      Booking.countDocuments({ companyId }),
    ]);

    const labels = bookingAgg.map((b) => b._id);
    const revenueValues = bookingAgg.map((b) => b.revenue);
    const usageValues = bookingAgg.map((b) => b.count);

    const totalRevenue = revenueValues.reduce((a, b) => a + b, 0);
    const avgResponseTime = 180; // placeholder; swap with real SRE metric if available

    return res.json({
      success: true,
      totalRevenue,
      totalUsers: userCount,
      totalBookings: bookingCount,
      activeUsers: Math.max(5, Math.floor(userCount * 0.35)), // heuristic
      avgResponseTime,
      revenue: { labels, values: revenueValues },
      usage: { labels, values: usageValues },
    });
  } catch (err) {
    console.error('getAnalytics error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};