import Booking from '../models/bookingModel.js';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

dotenv.config();

const FRONTEND_URL = (process.env.FRONTEND_URL || '').trim() || 'http://localhost:5173';
const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || "2022-11-15";
const DEFAULT_CURRENCY = (process.env.DEFAULT_CURRENCY || 'aud').toLowerCase();
const JWT_SECRET = (process.env.JWT_SECRET || 'your_jwt_secret_here');

const getStripe = () => {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) throw new Error('Stripe secret key is not defined in environment variables');
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
};

const getUserIdFromRequest = (req) => {
  try {
    const auth = req.headers?.authorization || req.headers?.Authorization;
    if (!auth) return null;
    const parts = String(auth).split(' ');
    if (parts.length !== 2) return null;
    const token = parts[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload && (payload.id || payload._id)) return String(payload.id ?? payload._id);
      return null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
};

export const createCheckoutSession = async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ success: false, message: 'Request body is missing' });

    // Attempt to derive userId from server-side (JWT) if not provided by client
    let providedUserId = req.body.userId;
    const tokenUserId = getUserIdFromRequest(req);
    const userId = tokenUserId || providedUserId || null;

    const {
      customer,
      email,
      phone,
      car,
      pickupDate,
      returnDate,
      amount,
      details,
      address,
      carImage,
      currency
    } = req.body;

    // Basic validation
    const total = Number(amount);
    if (!total || Number.isNaN(total) || total <= 0) return res.status(400).json({ success: false, message: "Invalid amount" });
    if (!email) return res.status(400).json({ success: false, message: "Email required" });
    if (!pickupDate || !returnDate) return res.status(400).json({ success: false, message: "pickupDate and returnDate required" });

    const pd = new Date(pickupDate);
    const rd = new Date(returnDate);
    if (Number.isNaN(pd.getTime()) || Number.isNaN(rd.getTime())) return res.status(400).json({ success: false, message: "Invalid dates" });
    if (rd < pd) return res.status(400).json({ success: false, message: "returnDate must be same or after pickupDate" });

    let carField = car;
    if (typeof car === 'string') {
      try { carField = JSON.parse(car); } catch { carField = { name: car }; }
    }

    // Ensure we have a valid userId for booking model (booking.userId is required)
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: missing user authentication' });
    }

    let finalUserId = userId;
    if (!mongoose.Types.ObjectId.isValid(finalUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId format' });
    }

    // Create booking (pending)
    let booking;
    try {
      booking = await Booking.create({
        userId: finalUserId,
        customer: String(customer ?? ""),
        email: String(email ?? ""),
        phone: String(phone ?? ""),
        car: carField ?? {},
        carImage: String(carImage ?? ""),
        pickupDate: pd,
        returnDate: rd,
        amount: total,
        paymentStatus: "pending",
        details: typeof details === "string" ? JSON.parse(details) : (details || {}),
        address: typeof address === "string" ? JSON.parse(address) : (address || {}),
        status: "pending",
        currency: (currency || DEFAULT_CURRENCY).toUpperCase(),
      });
    } catch (err) {
      console.error('Booking.create failed:', err && err.stack ? err.stack : err);
      return res.status(500).json({ success: false, message: 'Failed to create booking', error: String(err.message || err) });
    }

    let stripe;
    try { stripe = getStripe(); } catch (err) {
      await Booking.findByIdAndDelete(booking._id).catch(() => {});
      console.error('Stripe config error:', err && err.stack ? err.stack : err);
      return res.status(500).json({ success: false, message: 'Payment configuration error', error: String(err.message || err) });
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: email || undefined,
        line_items: [
          {
            price_data: {
              currency: (currency || DEFAULT_CURRENCY).toLowerCase(),
              product_data: {
                name: (carField && (carField.name || carField.title)) || "Car Rental",
                description: `Rental ${pd.toISOString().split('T')[0]} → ${rd.toISOString().split('T')[0]}`,
              },
              unit_amount: Math.round(total * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&payment_status=success`,
        cancel_url: `${FRONTEND_URL}/cancel?payment_status=cancelled`,
        metadata: {
          bookingId: booking._id.toString(),
          userId: String(finalUserId ?? ""),
          carId: String((carField && (carField.id || carField._id)) || ""),
          pickupDate: String(pickupDate || ""),
          returnDate: String(returnDate || ""),
        },
      });
    } catch (stripeErr) {
      console.error('Stripe session creation failed:', stripeErr && stripeErr.stack ? stripeErr.stack : stripeErr);
      await Booking.findByIdAndDelete(booking._id).catch(() => {});
      return res.status(500).json({ success: false, message: 'Failed to create Stripe checkout session', error: String(stripeErr.message || stripeErr) });
    }

    booking.sessionId = session.id;
    booking.stripeSession = { id: session.id, url: session.url || null };
    await booking.save().catch((err) => console.warn('Failed to save stripeSession on booking', err));

    return res.json({
      success: true,
      id: session.id,
      url: session.url,
      bookingId: booking._id
    });

  } catch (error) {
    console.error('Checkout Session Error', error && error.stack ? error.stack : error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// Confirm payment endpoint (must be exported as named export)
export const confirmPayment = async (req, res) => { 
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ success: false, message: 'Session ID is required' });

    let stripe;
    try { stripe = getStripe(); } catch (err) {
      return res.status(500).json({ success: false, message: 'Payment configuration error.', error: err.message });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    if (session.payment_status !== 'paid')
      return res.status(400).json({ success: false, message: `Payment not completed. Status=${session.payment_status}`, session });

    const bookingId = session.metadata?.bookingId;

    let order = null;
    if (bookingId) {
      order = await Booking.findByIdAndUpdate(bookingId, {
        paymentStatus: 'paid',
        status: 'active',
        paymentIntentId: session.payment_intent || '',
        paymentDetails: {
          amount_total: session.amount_total || null,
          currency: session.currency || null
        },
      }, { new: true });
    }

    if (!order) {
      order = await Booking.findOneAndUpdate({ sessionId: session_id }, {
        paymentStatus: 'paid',
        status: 'active',
        paymentIntentId: session.payment_intent || '',
        paymentDetails: {
          amount_total: session.amount_total || null,
          currency: session.currency || null
        },
      }, { new: true });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Booking not found for this session.' });
    }

    return res.json({ success: true, message: 'Payment confirmed', booking: order });
  } catch (err) {
    console.error('confirmPayment error', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal error' });
  }
};