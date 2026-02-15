import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';

import Booking from '../models/bookingModel.js';
import Car from '../models/carModel.js';
import User from '../models/userModel.js';

dotenv.config();

const FRONTEND_URL = (process.env.FRONTEND_URL || '').trim() || 'http://localhost:5173';
const DEFAULT_CURRENCY = (process.env.DEFAULT_CURRENCY || 'MYR').toUpperCase();
const JWT_SECRET = (process.env.JWT_SECRET || 'your_jwt_secret_here');
const BLOCKING_STATUSES = ['pending', 'active', 'upcoming'];

const ensureRazorpayConfig = () => {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const ok = Boolean(keyId && keySecret);
  return { ok, keyId, keySecret };
};

const getRazorpay = () => {
  const { ok, keyId, keySecret } = ensureRazorpayConfig();
  if (!ok) throw new Error('Razorpay keys are not configured');
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

const getUserIdFromRequest = (req) => {
  try {
    const auth = req.headers?.authorization || req.headers?.Authorization;
    if (!auth) return null;
    const parts = String(auth).split(' ');
    if (parts.length !== 2) return null;
    const token = parts[1];
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload && (payload.id || payload._id)) return String(payload.id ?? payload._id);
    return null;
  } catch {
    return null;
  }
};

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');
const computePostPaymentStatus = (pickupDate) => {
  const now = new Date();
  const pd = new Date(pickupDate);
  if (!Number.isNaN(pd.getTime()) && pd > now) return 'upcoming';
  return 'active';
};

// Only mark "rented" when NOW overlaps an active/upcoming/pending booking
const updateCarStatusBasedOnBookings = async (carId, session = null) => {
  if (!carId) return;
  const now = new Date();
  const count = await Booking.countDocuments({
    "car.id": carId,
    status: { $in: BLOCKING_STATUSES },
    pickupDate: { $lte: now },
    returnDate: { $gte: now },
  }).session(session);
  const newStatus = count > 0 ? "rented" : "available";
  await Car.findByIdAndUpdate(carId, { status: newStatus }, { session });
};

// Create or reuse a guest user so bookings always have a userId
const getOrCreateGuestUser = async ({ name, email, phone }) => {
  if (!email) throw new Error('Email is required for guest booking');
  const existing = await User.findOne({ email }).lean();
  if (existing) return existing._id;

  const password = crypto.randomBytes(12).toString('hex');
  const hashed = await bcrypt.hash(password, 10);

  const guest = await User.create({
    name: name || 'Guest',
    email,
    phone: phone || '',
    password: hashed,
    role: 'guest'
  });

  return guest._id;
};

export const createRazorpayOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { ok } = ensureRazorpayConfig();
    if (!ok) {
      return res.status(503).json({
        success: false,
        message: 'Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the backend environment.'
      });
    }

    if (!req.body) return res.status(400).json({ success: false, message: 'Request body is missing' });

    session.startTransaction();

    const tokenUserId = getUserIdFromRequest(req);
    let {
      userId: providedUserId,
      customer,
      email,
      phone,
      car,
      pickupDate,
      returnDate,
      amount,
      paymentBreakdown,
      details,
      address,
      carImage,
      currency,
      kyc,
      kycFromProfile
    } = req.body;

    const total = Number(amount);
    if (!total || Number.isNaN(total) || total <= 0) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }
    if (!email) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "Email required" });
    }
    if (!pickupDate || !returnDate) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "pickupDate and returnDate required" });
    }

    // Guest email guard: block guest checkout with registered (non-guest) email
    if (!tokenUserId && !providedUserId) {
      const existing = await User.findOne({ email: normalizeEmail(email) }).select('role').lean();
      if (existing && existing.role !== 'guest') {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        return res.status(400).json({ success: false, message: 'User Email is Registered. Please log in to continue.' });
      }
    }

    const pd = new Date(pickupDate);
    const rd = new Date(returnDate);
    if (Number.isNaN(pd.getTime()) || Number.isNaN(rd.getTime())) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "Invalid dates" });
    }
    if (rd < pd) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "returnDate must be same or after pickupDate" });
    }

    let carField = car;
    if (typeof car === 'string') {
      try { carField = JSON.parse(car); } catch { carField = { name: car }; }
    }

    const carRef = carField && (carField.id || carField._id);
    const carIdStr = carRef ? String(carRef) : null;
    if (!carIdStr || !mongoose.Types.ObjectId.isValid(carIdStr)) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "Valid car id is required" });
    }

    // No overlap guard here — first-pay-first-serve.
    // Multiple users can create awaiting_payment bookings for the same dates.
    // The real conflict check happens in verifyRazorpayPayment after payment succeeds.

    let finalUserId = tokenUserId || providedUserId || null;
    if (!finalUserId) {
      finalUserId = await getOrCreateGuestUser({ name: customer, email, phone });
    }
    if (!mongoose.Types.ObjectId.isValid(finalUserId)) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid userId format' });
    }

    let bookingCompanyId = null;
    try {
      if (carIdStr) {
        const canonicalCar = await Car.findById(carIdStr).lean();
        if (canonicalCar) {
          const canonicalCompany = canonicalCar.company || canonicalCar.companyId || null;
          if (canonicalCompany) {
            carField = { ...(carField || {}), companyId: canonicalCompany, companyName: canonicalCar.companyName || (canonicalCar.company && canonicalCar.company.name) || "" };
            bookingCompanyId = canonicalCompany;
          }
        }
      }
    } catch (e) {
      console.warn('createRazorpayOrder: failed to fetch canonical Car for companyId:', e?.message || e);
    }

    // --- KYC handling: skip upload for approved users ---
    let normalizedKyc;

    if (kycFromProfile === 'true' && finalUserId) {
      // Approved user — pull KYC from their profile
      const userDoc = await User.findById(finalUserId).select('kyc').lean();
      if (userDoc?.kyc?.status === 'approved') {
        normalizedKyc = {
          idType: userDoc.kyc.idType || 'passport',
          idNumber: userDoc.kyc.idNumber || '',
          idCountry: userDoc.kyc.idCountry || 'MY',
          frontImageUrl: userDoc.kyc.frontImageUrl || '',
          backImageUrl: userDoc.kyc.backImageUrl || '',
        };
      } else {
        await session.abortTransaction(); session.endSession();
        return res.status(400).json({ success: false, message: 'KYC not approved. Please submit your ID.' });
      }
    } else {
      // Guest or unapproved user — use uploaded files
      const kycFront = req.files?.kycFront?.[0] || null;
      const kycBack = req.files?.kycBack?.[0] || null;
      const toUrl = (fileObj) => fileObj ? `/uploads/${path.basename(fileObj.path)}` : '';

      normalizedKyc = {
        ...(typeof kyc === 'string' ? (() => { try { return JSON.parse(kyc); } catch { return {}; } })() : (kyc || {})),
        frontImageUrl: kycFront ? toUrl(kycFront) : (kyc?.frontImageUrl || ''),
        backImageUrl: kycBack ? toUrl(kycBack) : (kyc?.backImageUrl || ''),
      };
    }

    const bookingInput = {
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
      status: "awaiting_payment",
      currency: (currency || DEFAULT_CURRENCY).toUpperCase(),
      paymentBreakdown: typeof paymentBreakdown === "string" ? JSON.parse(paymentBreakdown) : (paymentBreakdown || {}),
      kyc: {
        idType: normalizedKyc.idType || "passport",
        idNumber: normalizedKyc.idNumber || "",
        idCountry: normalizedKyc.idCountry || "MY",
        licenseReminderSent: false,
        licenseNote: "Please bring your valid driving license (domestic or international per Malaysian law).",
        frontImageUrl: normalizedKyc.frontImageUrl || "",
        backImageUrl: normalizedKyc.backImageUrl || "",
      },
      paymentGateway: 'razorpay'
    };
    if (bookingCompanyId) bookingInput.companyId = bookingCompanyId;

    const createdArr = await Booking.create([bookingInput], { session });
    const booking = createdArr[0];
    const bookingIdForCleanup = booking._id && String(booking._id);

    await session.commitTransaction();
    session.endSession();

    const razorpay = getRazorpay();
    let order;
    try {
      order = await razorpay.orders.create({
        amount: Math.round(total * 100),
        currency: (currency || DEFAULT_CURRENCY).toUpperCase(),
        receipt: booking._id.toString(),
        notes: {
          bookingId: booking._id.toString(),
          userId: String(finalUserId ?? ""),
          carId: String(carIdStr || ""),
          pickupDate: String(pickupDate || ""),
          returnDate: String(returnDate || "")
        }
      });
    } catch (e) {
      if (bookingIdForCleanup) {
        await Booking.findByIdAndUpdate(bookingIdForCleanup, { status: 'cancelled', paymentStatus: 'failed' }).catch(() => {});
      }
      console.error('Razorpay order creation failed:', e?.stack || e);
      return res.status(500).json({ success: false, message: 'Failed to create Razorpay order', error: String(e?.message || e) });
    }

    try {
      await Booking.findByIdAndUpdate(booking._id, { razorpayOrderId: order.id }).exec();
    } catch (err) {
      console.warn('Failed to persist razorpayOrderId on booking', err);
    }

    return res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      bookingId: booking._id,
      key: process.env.RAZORPAY_KEY_ID,
      customer,
      email,
      phone,
      redirect: {
        success: `${FRONTEND_URL}/success?booking_id=${booking._id}&payment_status=success`,
        cancel: `${FRONTEND_URL}/cancel?booking_id=${booking._id}&payment_status=cancelled`
      }
    });
  } catch (error) {
    if (session.inTransaction()) {
      try { await session.abortTransaction(); } catch {}
    }
    session.endSession();
    console.error('Razorpay Order Error', error?.stack || error);
    return res.status(500).json({ success: false, message: 'Failed to create Razorpay order', error: String(error?.message || error) });
  }
};

// Client-side verification — FIRST-PAY-FIRST-SERVE overlap check lives here
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
    }

    const secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = hmac.digest('hex');

    if (digest !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // --- Fetch the booking and validate it is still awaiting payment ---
    const bookingDoc = await Booking.findById(bookingId);
    if (!bookingDoc) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // If already paid, return early (idempotent)
    if (bookingDoc.paymentStatus === 'paid') {
      return res.json({ success: true, message: 'Payment already recorded' });
    }

    // Only allow verification for awaiting_payment bookings
    if (bookingDoc.status !== 'awaiting_payment') {
      return res.status(400).json({ success: false, message: 'Booking is not awaiting payment' });
    }

    // --- FIRST-PAY-FIRST-SERVE: check if someone else paid first ---
    const conflict = await Booking.findOne({
      _id: { $ne: bookingDoc._id },
      "car.id": bookingDoc.car.id,
      status: { $in: BLOCKING_STATUSES },
      pickupDate: { $lte: bookingDoc.returnDate },
      returnDate: { $gte: bookingDoc.pickupDate },
    }).lean();

    if (conflict) {
      // Someone else completed payment first — cancel and refund this booking
      bookingDoc.status = 'cancelled';
      bookingDoc.paymentStatus = 'refunded';
      bookingDoc.razorpayOrderId = razorpay_order_id;
      bookingDoc.razorpayPaymentId = razorpay_payment_id;
      bookingDoc.razorpaySignature = razorpay_signature;
      await bookingDoc.save();

      // Auto-refund via Razorpay
      try {
        const razorpay = getRazorpay();
        await razorpay.payments.refund(razorpay_payment_id, { speed: 'normal' });
      } catch (refundErr) {
        console.error('Auto-refund failed, manual refund needed for payment:', razorpay_payment_id, refundErr);
      }

      return res.status(409).json({
        success: false,
        message: 'Sorry, this car was just booked by another user for the selected dates. Your payment will be refunded.',
        refund: true,
      });
    }

    // --- No conflict — first to pay wins. Promote to blocking status. ---
    const postStatus = computePostPaymentStatus(bookingDoc.pickupDate);

    bookingDoc.paymentStatus = 'paid';
    bookingDoc.status = postStatus;
    bookingDoc.razorpayOrderId = razorpay_order_id;
    bookingDoc.razorpayPaymentId = razorpay_payment_id;
    bookingDoc.razorpaySignature = razorpay_signature;
    await bookingDoc.save();

    // Push to car's bookings array and update car status
    const carId = bookingDoc.car?.id;
    if (carId) {
      await Car.updateOne(
        { _id: carId, "bookings.bookingId": { $ne: bookingDoc._id } },
        { $push: { bookings: { bookingId: bookingDoc._id, pickupDate: bookingDoc.pickupDate, returnDate: bookingDoc.returnDate, status: postStatus } } }
      ).catch(() => {});
      await Car.updateOne(
        { _id: carId, "bookings.bookingId": bookingDoc._id },
        { $set: { "bookings.$.status": postStatus, "bookings.$.pickupDate": bookingDoc.pickupDate, "bookings.$.returnDate": bookingDoc.returnDate } }
      ).catch(() => {});
      await updateCarStatusBasedOnBookings(carId);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('verifyRazorpayPayment error', error?.stack || error);
    return res.status(500).json({ success: false, message: 'Payment verification failed', error: String(error?.message || error) });
  }
};

// Mark payment failure explicitly to unblock availability
export const markPaymentFailed = async (req, res) => {
  try {
    const { bookingId } = req.body || {};
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid bookingId' });
    }

    const updated = await Booking.findByIdAndUpdate(
      bookingId,
      { paymentStatus: 'failed', status: 'cancelled' },
      { new: true }
    ).exec();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const carId = updated?.car?.id;
    if (carId) {
      // Remove from car's bookings array entirely
      await Car.updateOne(
        { _id: carId },
        { $pull: { bookings: { bookingId: mongoose.Types.ObjectId(bookingId) } } }
      ).catch(() => {});
      await updateCarStatusBasedOnBookings(carId);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('markPaymentFailed error', error?.stack || error);
    return res.status(500).json({ success: false, message: 'Failed to mark payment failed', error: String(error?.message || error) });
  }
};