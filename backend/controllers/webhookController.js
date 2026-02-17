import dotenv from 'dotenv';
import Booking from '../models/bookingModel.js';
import Car from '../models/carModel.js';
import { BLOCKING_STATUSES, computePostPaymentStatus, updateCarStatusBasedOnBookings } from './paymentController.js';

dotenv.config();

const XENDIT_WEBHOOK_TOKEN = (process.env.XENDIT_WEBHOOK_TOKEN || '').trim();
const XENDIT_SECRET_KEY = (process.env.XENDIT_SECRET_KEY || '').trim();

/**
 * Xendit Webhook Handler
 * Replaces razorpayWebhookHandler.
 *
 * How Xendit webhooks work (different from Razorpay):
 * - Razorpay: sends HMAC signature in header, you verify with crypto
 * - Xendit: sends a plain token in x-callback-token header, you compare strings
 *
 * Xendit sends a POST with JSON body containing:
 *   - id: Xendit invoice ID
 *   - external_id: our bookingId (we set this when creating the invoice)
 *   - status: "PAID", "SETTLED", "EXPIRED", etc.
 *   - payment_method, payment_channel, paid_amount, currency, etc.
 *
 * Key statuses:
 *   - "PAID" → customer completed payment → mark booking as paid
 *   - "SETTLED" → money settled to your account → also treat as paid (idempotent)
 *   - "EXPIRED" → invoice timed out → mark booking as expired/cancelled
 */
export const xenditWebhookHandler = async (req, res) => {
  try {
    // --- Step 1: Verify webhook authenticity ---
    // Xendit sends x-callback-token header with every webhook
    // Compare it to your XENDIT_WEBHOOK_TOKEN from the dashboard
    const callbackToken = req.headers['x-callback-token'] || '';
    if (!XENDIT_WEBHOOK_TOKEN || callbackToken !== XENDIT_WEBHOOK_TOKEN) {
      console.warn('Xendit webhook token verification failed');
      return res.status(401).json({ success: false, message: 'Invalid webhook token' });
    }

    // --- Step 2: Parse payload ---
    // Xendit sends standard JSON (no need for express.raw like Razorpay)
    const payload = req.body || {};
    const {
      id: xenditInvoiceId,
      external_id: externalId,
      status,
      payment_method: paymentMethod,
      payment_channel: paymentChannel,
      payment_id: paymentId,
      paid_amount: paidAmount,
      currency,
    } = payload;

    // external_id is our bookingId (we set it in createXenditInvoice)
    const bookingId = externalId || '';
    if (!bookingId) {
      console.warn('Xendit webhook: no external_id (bookingId) in payload');
      return res.json({ received: true, message: 'No booking context' });
    }

    // --- Step 3: Find the booking ---
    const existingBooking = await Booking.findById(bookingId);
    if (!existingBooking) {
      console.warn(`Xendit webhook: booking ${bookingId} not found`);
      return res.json({ received: true, message: 'Booking not found' });
    }

    // --- Step 4: Idempotency check ---
    // Xendit may send the same webhook multiple times (retries)
    // We track processed events to avoid double-processing
    const eventKey = `${xenditInvoiceId}_${status}`;
    if (existingBooking.processedWebhookEvents?.includes(eventKey)) {
      return res.json({ received: true, message: 'Already processed' });
    }

    // --- Step 5: Handle PAID / SETTLED ---
    if (status === 'PAID' || status === 'SETTLED') {
      // If already paid, skip (idempotent)
      if (existingBooking.paymentStatus === 'paid') {
        return res.json({ received: true, message: 'Payment already recorded' });
      }

      // Only process bookings that are awaiting payment
      if (existingBooking.status !== 'awaiting_payment') {
        return res.json({ received: true, message: 'Booking not awaiting payment' });
      }

      // --- FIRST-PAY-FIRST-SERVE: check if someone else paid first ---
      // This is the same overlap check from the old verifyRazorpayPayment,
      // but now it lives in the webhook (since Xendit is redirect-based,
      // there's no client-side verify step)
      const conflict = await Booking.findOne({
        _id: { $ne: existingBooking._id },
        "car.id": existingBooking.car.id,
        status: { $in: BLOCKING_STATUSES },
        pickupDate: { $lte: existingBooking.returnDate },
        returnDate: { $gte: existingBooking.pickupDate },
      }).lean();

      if (conflict) {
        // Someone else paid first — mark as refunded and trigger refund
        existingBooking.status = 'cancelled';
        existingBooking.paymentStatus = 'refunded';
        existingBooking.xenditInvoiceId = xenditInvoiceId || existingBooking.xenditInvoiceId;
        existingBooking.xenditPaymentId = paymentId || '';
        existingBooking.xenditPaymentMethod = paymentMethod || '';
        existingBooking.xenditPaymentChannel = paymentChannel || '';
        existingBooking.processedWebhookEvents.push(eventKey);
        await existingBooking.save();

        // Auto-refund via Xendit
        try {
          await fetch(`https://api.xendit.co/v2/invoices/${xenditInvoiceId}/refunds`, {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64'),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: paidAmount || existingBooking.amount,
              reason: 'OTHERS',
            }),
          });
        } catch (refundErr) {
          console.error('Auto-refund failed, manual refund needed for invoice:', xenditInvoiceId, refundErr);
        }

        console.log(`Booking ${bookingId} cancelled (conflict) — refund initiated`);
        return res.json({ received: true, message: 'Conflict detected, refund initiated' });
      }

      // --- No conflict — first to pay wins ---
      const postStatus = computePostPaymentStatus(existingBooking.pickupDate);

      existingBooking.paymentStatus = 'paid';
      existingBooking.status = postStatus;
      existingBooking.xenditInvoiceId = xenditInvoiceId || existingBooking.xenditInvoiceId;
      existingBooking.xenditPaymentId = paymentId || '';
      existingBooking.xenditPaymentMethod = paymentMethod || '';
      existingBooking.xenditPaymentChannel = paymentChannel || '';
      existingBooking.processedWebhookEvents.push(eventKey);
      await existingBooking.save();

      // Push to car's bookings array and update car status
      const carId = existingBooking.car?.id;
      if (carId) {
        await Car.updateOne(
          { _id: carId, "bookings.bookingId": { $ne: existingBooking._id } },
          { $push: { bookings: { bookingId: existingBooking._id, pickupDate: existingBooking.pickupDate, returnDate: existingBooking.returnDate, status: postStatus } } }
        ).catch(() => {});
        await Car.updateOne(
          { _id: carId, "bookings.bookingId": existingBooking._id },
          { $set: { "bookings.$.status": postStatus, "bookings.$.pickupDate": existingBooking.pickupDate, "bookings.$.returnDate": existingBooking.returnDate } }
        ).catch(() => {});
        await updateCarStatusBasedOnBookings(carId);
      }

      console.log(`Booking ${bookingId} paid successfully — status: ${postStatus}`);
      return res.json({ received: true });
    }

    // --- Step 6: Handle EXPIRED ---
    // Xendit sends this when the invoice_duration (30 min) expires
    // without the customer paying
    if (status === 'EXPIRED') {
      if (existingBooking.status === 'awaiting_payment') {
        existingBooking.status = 'cancelled';
        existingBooking.paymentStatus = 'expired';
        existingBooking.processedWebhookEvents.push(eventKey);
        await existingBooking.save();
        console.log(`Booking ${bookingId} expired — cancelled`);
      }
      return res.json({ received: true });
    }

    // --- Step 7: Unknown status — acknowledge ---
    // Xendit expects a 200 response, otherwise it retries
    return res.json({ received: true, message: 'Event ignored' });
  } catch (error) {
    console.error('xenditWebhookHandler error', error?.stack || error);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};