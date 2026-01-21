import dotenv from 'dotenv';
import crypto from 'crypto';
import Booking from '../models/bookingModel.js';

dotenv.config();

const verifySignature = (rawBody, signature, secret) => {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
};

// Extract helpers (covers payment/refund payload shapes)
const getOrderAndPaymentIds = (payload = {}) => {
  const paymentEntity = payload.payment?.entity || {};
  const orderEntity = payload.order?.entity || {};
  const refundEntity = payload.refund?.entity || {};

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

  return { razorpayOrderId, razorpayPaymentId, razorpayRefundId };
};

export const razorpayWebhookHandler = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (!webhookSecret) {
      console.warn('Razorpay webhook secret not configured');
      return res.status(500).send('Webhook secret not configured');
    }

    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || req.body; // express.raw provides Buffer
    if (!signature || !rawBody) {
      return res.status(400).send('Missing signature or body');
    }

    const isValid = verifySignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      return res.status(400).send('Invalid signature');
    }

    const event = JSON.parse(rawBody.toString());
    const { razorpayOrderId, razorpayPaymentId, razorpayRefundId } = getOrderAndPaymentIds(event.payload || {});

    // Payments captured / orders paid -> mark active/paid
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      if (razorpayOrderId) {
        await Booking.findOneAndUpdate(
          { razorpayOrderId },
          {
            paymentStatus: 'paid',
            status: 'active',
            razorpayPaymentId,
            razorpaySignature: signature
          }
        );
      }
      return res.json({ received: true });
    }

    // Payment failed -> mark failed/cancelled but keep record
    if (event.event === 'payment.failed') {
      if (razorpayOrderId) {
        await Booking.findOneAndUpdate(
          { razorpayOrderId },
          {
            paymentStatus: 'failed',
            status: 'cancelled',
            razorpayPaymentId,
            razorpaySignature: signature
          }
        );
      }
      return res.json({ received: true });
    }

    // Refund processed -> mark refunded/cancelled (24h cancellation promise)
    if (event.event === 'refund.processed') {
      if (razorpayOrderId || razorpayPaymentId) {
        await Booking.findOneAndUpdate(
          {
            $or: [
              { razorpayOrderId: razorpayOrderId || undefined },
              { razorpayPaymentId: razorpayPaymentId || undefined }
            ]
          },
          {
            paymentStatus: 'refunded',
            status: 'cancelled',
            razorpayPaymentId,
            razorpaySignature: signature,
            refundId: razorpayRefundId || ''
          }
        );
      }
      return res.json({ received: true });
    }

    // Refund failed -> flag for manual attention
    if (event.event === 'refund.failed') {
      if (razorpayOrderId || razorpayPaymentId) {
        await Booking.findOneAndUpdate(
          {
            $or: [
              { razorpayOrderId: razorpayOrderId || undefined },
              { razorpayPaymentId: razorpayPaymentId || undefined }
            ]
          },
          {
            paymentStatus: 'refund_failed',
            razorpayPaymentId,
            razorpaySignature: signature,
            refundId: razorpayRefundId || ''
          }
        );
      }
      return res.json({ received: true });
    }

    // Unhandled events: acknowledge to avoid retries, but log
    console.info('Unhandled Razorpay event', event.event);
    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).send();
  }
};