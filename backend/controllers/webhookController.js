import dotenv from 'dotenv';
import crypto from 'crypto';
import Booking from '../models/bookingModel.js';

dotenv.config();

const verifySignature = (rawBody, signature, secret) => {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
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

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const payload = event.payload?.payment?.entity || event.payload?.order?.entity || {};
      const razorpayOrderId = payload.order_id || payload.id || '';
      const razorpayPaymentId = payload.id || payload.payment_id || '';

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
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).send();
  }
};