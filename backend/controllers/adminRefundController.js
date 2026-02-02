import Refund from '../models/refundModel.js';
import Booking from '../models/bookingModel.js';

export const processRefund = async (req, res) => {
  try {
    const { bookingId, amount, reason } = req.body || {};
    if (!bookingId || amount == null) return res.status(400).json({ success: false, message: 'bookingId and amount are required' });
    if (amount < 0) return res.status(400).json({ success: false, message: 'amount must be positive' });

    const booking = await Booking.findOne({ _id: bookingId, companyId: req.user.companyId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // TODO: integrate Razorpay Curlec refund API. Currently records refund only.
    const refund = await Refund.create({
      bookingId,
      companyId: req.user.companyId,
      amount,
      reason,
      status: 'processed',
      processedBy: req.user.id,
    });

    booking.refundedAmount = (booking.refundedAmount || 0) + amount;
    await booking.save();

    return res.json({ success: true, refundId: refund._id });
  } catch (err) {
    console.error('processRefund error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};