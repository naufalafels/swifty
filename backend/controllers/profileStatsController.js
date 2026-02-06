import Booking from '../models/bookingModel.js';

export const getProfileStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    const [bookings, completed] = await Promise.all([
      Booking.countDocuments({ userId }),
      Booking.countDocuments({ userId, status: 'completed' }),
    ]);

    const createdAt = req.user.createdAt || now;
    const years = Math.max(0, Math.floor((now - createdAt) / (365 * 24 * 60 * 60 * 1000)));

    return res.json({
      success: true,
      bookings,
      completedTrips: completed,
      years,
    });
  } catch (err) {
    console.error('getProfileStats error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};