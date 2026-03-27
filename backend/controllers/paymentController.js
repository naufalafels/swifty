import dotenv from 'dotenv';
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
const XENDIT_SECRET_KEY = (process.env.XENDIT_SECRET_KEY || '').trim();
const BLOCKING_STATUSES = ['pending', 'active', 'upcoming'];

/**
 * Xendit REST API helper.
 * All Xendit calls go through this — no SDK needed, just fetch().
 * Uses Basic Auth with your secret key.
 */
const xenditRequest = async (endpoint, method = 'GET', body = null) => {
  const url = `https://api.xendit.co${endpoint}`;
  const headers = {
    'Authorization': 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64'),
    'Content-Type': 'application/json',
  };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data?.message || `Xendit API error: ${response.status}`);
    err.status = response.status;
    err.xenditError = data;
    throw err;
  }
  return data;
};

const ensureXenditConfig = () => {
  const ok = Boolean(XENDIT_SECRET_KEY);
  return { ok };
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

/**
 * Create a Xendit Invoice + awaiting_payment booking.
 * Replaces createRazorpayOrder.
 *
 * Flow:
 * 1. Validate input (same as before)
 * 2. Create booking in DB with status "awaiting_payment"
 * 3. Call Xendit POST /v2/invoices to create a hosted payment page
 * 4. Return the invoice URL to the frontend
 * 5. Frontend redirects user to invoice URL (no modal/SDK needed)
 * 6. Xendit sends webhook when user pays → webhookController handles it
 */
export const createXenditInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { ok } = ensureXenditConfig();
    if (!ok) {
      return res.status(503).json({
        success: false,
        message: 'Xendit keys are not configured. Set XENDIT_SECRET_KEY in the backend environment.'
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
      kycFromProfile,
      marketingConsent
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
    // The real conflict check happens in the webhook after Xendit confirms payment.

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
      console.warn('createXenditInvoice: failed to fetch canonical Car for companyId:', e?.message || e);
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
      marketingConsent: marketingConsent === true || marketingConsent === 'true',  // <-- ADD THIS
      kyc: {
        idType: normalizedKyc.idType || "passport",
        idNumber: normalizedKyc.idNumber || "",
        idCountry: normalizedKyc.idCountry || "MY",
        licenseReminderSent: false,
        licenseNote: "Please bring your valid driving license (domestic or international per Malaysian law).",
        frontImageUrl: normalizedKyc.frontImageUrl || "",
        backImageUrl: normalizedKyc.backImageUrl || "",
      },
      paymentGateway: 'xendit'
    };
    if (bookingCompanyId) bookingInput.companyId = bookingCompanyId;

    const createdArr = await Booking.create([bookingInput], { session });
    const booking = createdArr[0];
    const bookingIdStr = String(booking._id);

    await session.commitTransaction();
    session.endSession();

    // --- Create Xendit Invoice ---
    let invoice;
    try {
      const carName = carField?.make ? `${carField.make} ${carField.model || ''}`.trim() : 'Car Rental';

      invoice = await xenditRequest('/v2/invoices', 'POST', {
        external_id: bookingIdStr,
        amount: total,
        currency: (currency || DEFAULT_CURRENCY).toUpperCase(),
        description: `Swifty Car Rental - ${carName} (${pickupDate} to ${returnDate})`,
        customer: {
          given_names: String(customer ?? "Guest"),
          email: String(email ?? ""),
          mobile_number: String(phone ?? ""),
        },
        customer_notification_preference: {
          invoice_paid: ["email"],
        },
        success_redirect_url: `${FRONTEND_URL}/success?booking_id=${bookingIdStr}&payment_status=success`,
        failure_redirect_url: `${FRONTEND_URL}/cancel?booking_id=${bookingIdStr}&payment_status=failed`,
        // Invoice expires in 30 minutes (matches stale booking cleanup)
        invoice_duration: 1800,
        metadata: {
          bookingId: bookingIdStr,
          userId: String(finalUserId ?? ""),
          carId: String(carIdStr || ""),
          pickupDate: String(pickupDate || ""),
          returnDate: String(returnDate || ""),
        },
      });
    } catch (e) {
      // Xendit invoice creation failed — clean up the booking
      await Booking.findByIdAndUpdate(bookingIdStr, { status: 'cancelled', paymentStatus: 'failed' }).catch(() => {});
      console.error('Xendit invoice creation failed:', e?.stack || e);
      return res.status(500).json({ success: false, message: 'Failed to create payment invoice', error: String(e?.message || e) });
    }

    // Save Xendit invoice ID and URL to booking
    try {
      await Booking.findByIdAndUpdate(booking._id, {
        xenditInvoiceId: invoice.id || '',
        xenditInvoiceUrl: invoice.invoice_url || '',
      }).exec();
    } catch (err) {
      console.warn('Failed to persist xenditInvoiceId on booking', err);
    }

    return res.json({
      success: true,
      bookingId: booking._id,
      invoiceId: invoice.id,
      invoiceUrl: invoice.invoice_url,
      amount: total,
      currency: (currency || DEFAULT_CURRENCY).toUpperCase(),
      customer,
      email,
      phone,
    });
  } catch (error) {
    if (session.inTransaction()) {
      try { await session.abortTransaction(); } catch {}
    }
    session.endSession();
    console.error('Xendit Invoice Error', error?.stack || error);
    return res.status(500).json({ success: false, message: 'Failed to create payment invoice', error: String(error?.message || error) });
  }
};

/**
 * Verify payment status by proactively checking Xendit.
 *
 * Solves the race condition where the user is redirected back to the frontend
 * BEFORE the Xendit webhook has arrived and updated the booking in the DB.
 *
 * Flow:
 * 1. Look up the booking in the DB
 * 2. If already updated (paymentStatus !== 'pending'), return it immediately
 * 3. If still 'awaiting_payment', call Xendit GET /v2/invoices/:invoiceId
 * 4. If Xendit says PAID/SETTLED, run the same update logic as the webhook
 * 5. Return the (now-updated) booking
 */
export const verifyPaymentStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid bookingId' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // If the webhook already processed this booking, return immediately
    if (booking.paymentStatus === 'paid' || booking.status !== 'awaiting_payment') {
      return res.json({
        success: true,
        booking,
        source: 'database',
      });
    }

    // Booking is still awaiting_payment — proactively check Xendit
    const xenditInvoiceId = booking.xenditInvoiceId;
    if (!xenditInvoiceId) {
      // No invoice ID stored yet — can't check Xendit, return current state
      return res.json({
        success: true,
        booking,
        source: 'database',
        message: 'No Xendit invoice ID on booking yet — webhook may still be pending',
      });
    }

    let xenditInvoice;
    try {
      xenditInvoice = await xenditRequest(`/v2/invoices/${xenditInvoiceId}`, 'GET');
    } catch (e) {
      console.warn('verifyPaymentStatus: failed to fetch Xendit invoice', e?.message || e);
      // Can't reach Xendit — return current DB state
      return res.json({
        success: true,
        booking,
        source: 'database',
        message: 'Could not verify with Xendit — returning database state',
      });
    }

    const xenditStatus = (xenditInvoice.status || '').toUpperCase();

    // If Xendit says PAID or SETTLED, update the booking now
    if (xenditStatus === 'PAID' || xenditStatus === 'SETTLED') {
      // Double-check: if another request or the webhook already updated it, skip
      const freshBooking = await Booking.findById(bookingId);
      if (freshBooking.paymentStatus === 'paid' || freshBooking.status !== 'awaiting_payment') {
        return res.json({
          success: true,
          booking: freshBooking,
          source: 'database',
        });
      }

      // --- FIRST-PAY-FIRST-SERVE: same conflict check as webhook ---
      const conflict = await Booking.findOne({
        _id: { $ne: freshBooking._id },
        "car.id": freshBooking.car.id,
        status: { $in: BLOCKING_STATUSES },
        pickupDate: { $lte: freshBooking.returnDate },
        returnDate: { $gte: freshBooking.pickupDate },
      }).lean();

      if (conflict) {
        freshBooking.status = 'cancelled';
        freshBooking.paymentStatus = 'refunded';
        freshBooking.xenditPaymentId = xenditInvoice.payment_id || '';
        freshBooking.xenditPaymentMethod = xenditInvoice.payment_method || '';
        freshBooking.xenditPaymentChannel = xenditInvoice.payment_channel || '';
        await freshBooking.save();

        return res.json({
          success: true,
          booking: freshBooking,
          source: 'xendit_verify',
          message: 'Conflict detected — booking cancelled and refund initiated',
        });
      }

      // --- No conflict — update booking as paid ---
      const postStatus = computePostPaymentStatus(freshBooking.pickupDate);

      freshBooking.paymentStatus = 'paid';
      freshBooking.status = postStatus;
      freshBooking.xenditPaymentId = xenditInvoice.payment_id || '';
      freshBooking.xenditPaymentMethod = xenditInvoice.payment_method || '';
      freshBooking.xenditPaymentChannel = xenditInvoice.payment_channel || '';
      await freshBooking.save();

      // Update car bookings array and car status
      const carId = freshBooking.car?.id;
      if (carId) {
        await Car.updateOne(
          { _id: carId, "bookings.bookingId": { $ne: freshBooking._id } },
          { $push: { bookings: { bookingId: freshBooking._id, pickupDate: freshBooking.pickupDate, returnDate: freshBooking.returnDate, status: postStatus } } }
        ).catch(() => {});
        await Car.updateOne(
          { _id: carId, "bookings.bookingId": freshBooking._id },
          { $set: { "bookings.$.status": postStatus, "bookings.$.pickupDate": freshBooking.pickupDate, "bookings.$.returnDate": freshBooking.returnDate } }
        ).catch(() => {});
        await updateCarStatusBasedOnBookings(carId);
      }

      console.log(`verifyPaymentStatus: Booking ${bookingId} confirmed paid via Xendit check — status: ${postStatus}`);

      return res.json({
        success: true,
        booking: freshBooking,
        source: 'xendit_verify',
      });
    }

    // Xendit says EXPIRED
    if (xenditStatus === 'EXPIRED') {
      if (booking.status === 'awaiting_payment') {
        booking.status = 'cancelled';
        booking.paymentStatus = 'expired';
        await booking.save();
      }
      return res.json({
        success: true,
        booking,
        source: 'xendit_verify',
      });
    }

    // Xendit says PENDING or something else — return current state
    return res.json({
      success: true,
      booking,
      source: 'xendit_verify',
      xenditStatus,
      message: 'Payment not yet confirmed by Xendit',
    });
  } catch (error) {
    console.error('verifyPaymentStatus error', error?.stack || error);
    return res.status(500).json({ success: false, message: 'Failed to verify payment status', error: String(error?.message || error) });
  }
};

/**
 * Mark payment failure explicitly to unblock availability.
 * Called when user abandons the Xendit payment page without paying.
 * Kept from the original — logic is gateway-agnostic.
 */
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
      await Car.updateOne(
        { _id: carId },
        { $pull: { bookings: { bookingId: new mongoose.Types.ObjectId(bookingId) } } }
      ).catch(() => {});
      await updateCarStatusBasedOnBookings(carId);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('markPaymentFailed error', error?.stack || error);
    return res.status(500).json({ success: false, message: 'Failed to mark payment failed', error: String(error?.message || error) });
  }
};

// Export for use in webhookController
export { BLOCKING_STATUSES, computePostPaymentStatus, updateCarStatusBasedOnBookings };