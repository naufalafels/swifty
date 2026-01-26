import dotenv from 'dotenv';
import crypto from 'crypto';
import Booking from '../models/bookingModel.js';

dotenv.config();

const RAZORPAY_WEBHOOK_SECRET = (process.env.RAZORPAY_KEY_SECRET || '').trim();

/**
 * Timing-safe string comparison to avoid leak via timing attacks.
 */
const timingSafeEqualStr = (a = '', b = '') => {
  try {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) {
      // To keep timing similar, compare against itself
      return crypto.timingSafeEqual(bufA, bufA);
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
};

/**
 * Verify incoming webhook signature using rawBody and secret
 * rawBody: Buffer or string
 */
const verifySignature = (rawBody, signature, secret) => {
  if (!secret || !signature) return false;
  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''));
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return timingSafeEqualStr(expected, signature);
};

/**
 * Extract common ids and bookingId (from notes) in a resilient way.
 * Returns { razorpayOrderId, razorpayPaymentId, razorpayRefundId, bookingIdFromNotes }
 */
const extractIdsAndBookingFromPayload = (payload = {}) => {
  const paymentEntity = payload?.payload?.payment?.entity || payload?.payment?.entity || {};
  const orderEntity = payload?.payload?.order?.entity || payload?.order?.entity || {};
  const refundEntity = payload?.payload?.refund?.entity || payload?.refund?.entity || {};

  const razorpayOrderId =
    paymentEntity.order_id ||
    orderEntity.id ||
    refundEntity.order_id ||
    '';

  const razorpayPaymentId =
    paymentEntity.id ||
    paymentEntity.payment_id ||
    refundEntity.payment_id ||
    '';

  const razorpayRefundId = refundEntity.id || '';

  // Try to read bookingId from notes (Razorpay supports 'notes' on orders/payments)
  const notesFromPayment = paymentEntity.notes || {};
  const notesFromOrder = orderEntity.notes || {};
  const bookingIdFromNotes = notesFromPayment.bookingId || notesFromOrder.bookingId || '';

  return { razorpayOrderId, razorpayPaymentId, razorpayRefundId, bookingIdFromNotes, paymentEntity, orderEntity };
};

export const razorpayWebhookHandler = async (req, res) => {
  try {
    // raw body was provided by express.raw middleware in route
    const signature = req.headers['x-razorpay-signature'] || req.headers['x-razorpay_signature'] || '';
    const rawBodyBuffer = req.body; // Buffer from express.raw({type:'application/json'})

    if (!verifySignature(rawBodyBuffer, signature, RAZORPAY_WEBHOOK_SECRET)) {
      console.warn('Razorpay webhook signature verification failed');
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    // parse payload safely (we already had raw bytes, but need object for logic)
    let payload;
    try {
      // If middleware already parsed body into object (unlikely with express.raw), handle both cases.
      payload = Buffer.isBuffer(rawBodyBuffer) ? JSON.parse(rawBodyBuffer.toString('utf8')) : (req.body || {});
    } catch (e) {
      console.warn('Failed to parse webhook body JSON', e);
      return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
    }

    const event = payload?.event || '';
    const { razorpayOrderId, razorpayPaymentId, razorpayRefundId, bookingIdFromNotes, paymentEntity, orderEntity } =
      extractIdsAndBookingFromPayload(payload);

    // Build candidate booking query: try by razorpayOrderId first, then by bookingIdFromNotes (note), then by receipt in order entity.
    // This covers races where the booking document hasn't yet been updated with razorpayOrderId
    const candidateQueries = [];
    if (razorpayOrderId) candidateQueries.push({ razorpayOrderId });
    if (bookingIdFromNotes) {
      // bookingIdFromNotes may be an ObjectId string or receipt/booking id depending on how you stored it
      candidateQueries.push({ _id: bookingIdFromNotes });
      candidateQueries.push({ 'notes.bookingId': bookingIdFromNotes }); // defensive, in case you kept notes on booking doc
    }
    // also try to match by receipt if present on order (Razorpay order.receipt)
    const receipt = orderEntity?.receipt || '';
    if (receipt) candidateQueries.push({ _id: receipt });

    // Single merged query using $or if we have candidates
    const bookingQuery = candidateQueries.length ? { $or: candidateQueries } : null;

    // Helper to atomically set booking to paid
    const markBookingAsPaid = async (updateFields = {}) => {
      if (!bookingQuery) return null;

      // We must ensure idempotency:
      // - if a booking already has this razorpayPaymentId applied, do nothing
      // - if booking already has paymentStatus 'paid', do nothing
      const filter = {
        $and: [
          bookingQuery,
          { $or: [{ razorpayPaymentId: { $exists: false } }, { razorpayPaymentId: { $ne: razorpayPaymentId } }, { paymentStatus: { $ne: 'paid' } }] }
        ]
      };

      const update = {
        $set: Object.assign({
          paymentStatus: 'paid',
          status: 'active',
        }, updateFields),
        // record the payment id
        $setOnInsert: {},
      };

      // Also push a marker (the payment id) into processedWebhookEvents to have a simple processed history
      const options = { new: true };

      // Atomically find and update. If it returns null, it means nothing was updated (already processed perhaps)
      const updated = await Booking.findOneAndUpdate(filter, update, options).exec();
      return updated;
    };

    // Handle payment captured/authorized -> mark paid
    if (event === 'payment.captured' || event === 'payment.authorized' || event === 'payment.succeeded') {
      // prefer to use payment entity fields for granular info
      const amount = Number(paymentEntity?.amount || 0);
      const currency = paymentEntity?.currency || undefined;
      const paymentMethod = paymentEntity?.method || '';
      const capturedAt = paymentEntity?.created_at ? new Date(paymentEntity.created_at * 1000) : new Date();

      const updated = await markBookingAsPaid({
        razorpayPaymentId: razorpayPaymentId || '',
        razorpayOrderId: razorpayOrderId || '',
        razorpaySignature: signature,
        amount: isNaN(amount) ? undefined : (amount / 100), // Razorpay amounts are in paise
        currency: currency || undefined,
        paymentMethod,
        paymentCapturedAt: capturedAt
      });

      if (!updated) {
        // Either booking not found, or already processed. Try a safer fallback: if no booking found, attempt to find by payment notes booking id and set.
        if (bookingIdFromNotes) {
          const fallback = await Booking.findOne({ _id: bookingIdFromNotes }).exec();
          if (fallback && (!fallback.razorpayPaymentId || fallback.razorpayPaymentId !== razorpayPaymentId)) {
            fallback.paymentStatus = 'paid';
            fallback.status = 'active';
            fallback.razorpayPaymentId = razorpayPaymentId || fallback.razorpayPaymentId;
            fallback.razorpayOrderId = razorpayOrderId || fallback.razorpayOrderId;
            fallback.razorpaySignature = signature;
            await fallback.save().catch(err => console.warn('Fallback save failed', err));
            return res.json({ received: true, message: 'Fallback applied' });
          }
        }
        return res.json({ received: true, message: 'Already processed or booking not found' });
      }

      return res.json({ received: true });
    }

    // Payment failed -> mark failed/cancelled but keep record
    if (event === 'payment.failed' || event === 'payment.error') {
      if (!bookingQuery) return res.json({ received: true, message: 'No booking context' });

      const filter = {
        $and: [
          bookingQuery,
          { $or: [{ paymentStatus: { $ne: 'failed' } }, { razorpayPaymentId: { $ne: razorpayPaymentId } }] }
        ]
      };

      const update = {
        $set: {
          paymentStatus: 'failed',
          status: 'cancelled',
          razorpayPaymentId: razorpayPaymentId || '',
          razorpaySignature: signature
        },
      };

      const updated = await Booking.findOneAndUpdate(filter, update, { new: true }).exec();
      if (!updated) return res.json({ received: true, message: 'Already marked failed or booking not found' });
      return res.json({ received: true });
    }

    // Refund processed -> mark refunded/cancelled
    if (event === 'refund.processed' || event === 'refund.created' || event === 'refund.succeeded') {
      if (!bookingQuery) return res.json({ received: true, message: 'No booking context for refund' });

      const filter = bookingQuery;
      const update = {
        $set: {
          paymentStatus: 'refunded',
          status: 'cancelled',
          refundId: razorpayRefundId || ''
        }
      };
      await Booking.findOneAndUpdate(filter, update, { new: true }).exec();
      return res.json({ received: true });
    }

    // Unknown/unhandled events: acknowledge
    return res.json({ received: true, message: 'Event ignored' });
  } catch (error) {
    console.error('razorpayWebhookHandler error', error?.stack || error);
    // Do not disclose secret details to caller
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};