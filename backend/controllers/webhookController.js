import dotenv from 'dotenv';
import Stripe from 'stripe';
import Booking from '../models/bookingModel.js';

dotenv.config();
const getStripe = () => {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) throw new Error('Stripe secret key is not defined');
  return new Stripe(key);
};

export const stripeWebhookHandler = async (req, res) => {
  // IMPORTANT: express must be configured to expose raw body for this route.
  // In server.js, for this route use: express.raw({type: 'application/json'}) middleware.
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''; // set this in env (from Stripe)
  if (!webhookSecret) {
    console.warn('Stripe webhook secret not configured');
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle events
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;
      if (bookingId) {
        await Booking.findByIdAndUpdate(bookingId, {
          paymentStatus: 'paid',
          status: 'active',
          paymentIntentId: session.payment_intent || '',
          paymentDetails: {
            amount_total: session.amount_total || null,
            currency: session.currency || null
          }
        });
      } else {
        // fallback: find booking by session.id
        await Booking.findOneAndUpdate({ sessionId: session.id }, {
          paymentStatus: 'paid',
          status: 'active',
          paymentIntentId: session.payment_intent || '',
          paymentDetails: {
            amount_total: session.amount_total || null,
            currency: session.currency || null
          }
        });
      }
    }

    // respond 200
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).send();
  }
};