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
      kyc
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

    // Parse car if sent as JSON string
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

    // Ensure userId (auth user or guest)
    let finalUserId = tokenUserId || providedUserId || null;
    if (!finalUserId) {
      finalUserId = await getOrCreateGuestUser({ name: customer, email, phone });
    }
    if (!mongoose.Types.ObjectId.isValid(finalUserId)) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid userId format' });
    }

    // Enrich car with company
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

    // Normalize KYC with uploaded files (kycFront, kycBack)
    const kycFront = req.files?.kycFront?.[0] || null;
    const kycBack = req.files?.kycBack?.[0] || null;
    const toUrl = (fileObj) => fileObj ? `/uploads/${path.basename(fileObj.path)}` : '';

    const normalizedKyc = {
      ...(typeof kyc === 'string' ? (() => { try { return JSON.parse(kyc); } catch { return {}; } })() : (kyc || {})),
      frontImageUrl: kycFront ? toUrl(kycFront) : (kyc?.frontImageUrl || ''),
      backImageUrl: kycBack ? toUrl(kycBack) : (kyc?.backImageUrl || ''),
    };

    // Conflict check inside the transaction to prevent double booking
    const conflict = await Booking.findOne({
      "car.id": new mongoose.Types.ObjectId(carIdStr),
      status: { $in: BLOCKING_STATUSES },
      pickupDate: { $lte: rd },
      returnDate: { $gte: pd },
    }).session(session).lean();

    if (conflict) {
      await session.abortTransaction(); session.endSession();
      return res.status(409).json({ success: false, message: "Car is not available for the selected dates" });
    }

    // Create pending booking
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
      status: "pending",
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

    // Create razorpay order AFTER booking successfully created.
    const razorpay = getRazorpay();
    let order;
    try {
      order = await razorpay.orders.create({
        amount: Math.round(total * 100), // in paise
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

    // Persist razorpayOrderId atomically (avoid in-memory save race)
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

// Optional client-side verification (in addition to webhook)
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

    const filter = {
      _id: bookingId,
      $or: [
        { razorpayPaymentId: { $exists: false } },
        { razorpayPaymentId: { $ne: razorpay_payment_id } },
        { paymentStatus: { $ne: 'paid' } }
      ]
    };

    const update = {
      $set: {
        paymentStatus: 'paid',
        status: 'active',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      }
    };

    const updated = await Booking.findOneAndUpdate(filter, update, { new: true }).exec();
    if (!updated) {
      const maybe = await Booking.findById(bookingId).lean().exec();
      if (!maybe) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }
      return res.json({ success: true, message: 'Payment already recorded' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('verifyRazorpayPayment error', error?.stack || error);
    return res.status(500).json({ success: false, message: 'Payment verification failed', error: String(error?.message || error) });
  }
};