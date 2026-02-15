import Booking from '../models/bookingModel.js';

export function startStaleBookingCleanup() {
  const cleanup = async () => {
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 min old
      const result = await Booking.updateMany(
        { status: 'awaiting_payment', bookingDate: { $lte: cutoff } },
        { status: 'cancelled', paymentStatus: 'expired' }
      );
      if (result.modifiedCount > 0) {
        console.log(`Cleaned up ${result.modifiedCount} stale awaiting_payment bookings`);
      }
    } catch (err) {
      console.error('Stale booking cleanup error:', err);
    }
  };

  // Run on startup and then every 15 minutes
  cleanup();
  setInterval(cleanup, 15 * 60 * 1000);
}