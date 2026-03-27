import mongoose from 'mongoose';
import Refund from '../models/refundModel.js';
import Booking from '../models/bookingModel.js';
import User from '../models/userModel.js';
import AuditLog from '../models/auditLogModel.js';
import { generateDownloadUrl } from '../services/s3Service.js';

const XENDIT_SECRET_KEY = (process.env.XENDIT_SECRET_KEY || '').trim();

// GET /api/admin/refunds/eligible
export const getEligibleRefunds = async (req, res) => {
  try {
    // FIX: Superadmin sees ALL data. company_admin sees only their company.
    const rawCompanyId = req.user.companyId;
    const isSuperAdmin = req.user.role === 'superadmin';

    let companyMatch = {};
    if (!isSuperAdmin) {
      if (!rawCompanyId) {
        return res.status(400).json({ success: false, message: 'No company associated with user' });
      }
      companyMatch = { companyId: new mongoose.Types.ObjectId(String(rawCompanyId)) };
    }

    const bookings = await Booking.find({
      ...companyMatch,
      paymentStatus: { $in: ['paid'] },
      status: { $in: ['pending', 'upcoming', 'active'] },
    })
      .sort({ bookingDate: -1 })
      .lean();

    const enriched = await Promise.all(
      bookings.map(async (b) => {
        const user = await User.findById(b.userId)
          .select('name email phone profilePicture kyc')
          .lean();

        const bookingDate = new Date(b.bookingDate);
        const now = new Date();
        const hoursSinceBooking = (now - bookingDate) / (1000 * 60 * 60);
        const is24hrEligible = hoursSinceBooking <= 24;
        const insurancePlan = b.paymentBreakdown?.insurancePlan || 'full_excess';
        const has24hrPolicy = insurancePlan === '24hr_cancellation' || insurancePlan === 'premium';

        // Generate pre-signed S3 URLs for KYC images (or fallback to stored URLs)
        let kycFrontUrl = '';
        let kycBackUrl = '';
        try {
          const userKycFront = user?.kyc?.frontImageUrl || b.kyc?.frontImageUrl || '';
          const userKycBack = user?.kyc?.backImageUrl || b.kyc?.backImageUrl || '';
          if (userKycFront && !userKycFront.startsWith('http')) {
            kycFrontUrl = await generateDownloadUrl(userKycFront);
          } else {
            kycFrontUrl = userKycFront;
          }
          if (userKycBack && !userKycBack.startsWith('http')) {
            kycBackUrl = await generateDownloadUrl(userKycBack);
          } else {
            kycBackUrl = userKycBack;
          }
        } catch (e) {
          kycFrontUrl = user?.kyc?.frontImageUrl || b.kyc?.frontImageUrl || '';
          kycBackUrl = user?.kyc?.backImageUrl || b.kyc?.backImageUrl || '';
        }

        return {
          bookingId: b._id,
          bookingDate: b.bookingDate,
          pickupDate: b.pickupDate,
          returnDate: b.returnDate,
          amount: b.amount,
          currency: b.currency || 'MYR',
          status: b.status,
          paymentStatus: b.paymentStatus,
          xenditInvoiceId: b.xenditInvoiceId || '',

          insurancePlan,
          insuranceCost: b.paymentBreakdown?.insurance || 0,
          has24hrPolicy,
          is24hrEligible,
          hoursSinceBooking: Math.round(hoursSinceBooking * 10) / 10,
          policyExpiresAt: has24hrPolicy
            ? new Date(bookingDate.getTime() + 24 * 60 * 60 * 1000)
            : null,

          car: {
            id: b.car?.id,
            make: b.car?.make || '',
            model: b.car?.model || '',
            year: b.car?.year || '',
            image: b.car?.image || b.carImage || '',
            plateNumber: b.car?.plateNumber || '',
            color: b.car?.color || '',
            category: b.car?.category || '',
            dailyRate: b.car?.dailyRate || 0,
            transmission: b.car?.transmission || '',
            fuelType: b.car?.fuelType || '',
            seats: b.car?.seats || 0,
          },

          user: {
            id: b.userId,
            name: user?.name || b.customer || '',
            email: user?.email || b.email || '',
            phone: user?.phone || b.phone || '',
            profileImage: user?.profilePicture || '',
            kycFrontImage: kycFrontUrl,
            kycBackImage: kycBackUrl,
            kycIdType: user?.kyc?.idType || b.kyc?.idType || '',
            kycIdNumber: user?.kyc?.idNumber || b.kyc?.idNumber || '',
            kycIdCountry: user?.kyc?.idCountry || b.kyc?.idCountry || '',
          },

          paymentBreakdown: {
            rent: b.paymentBreakdown?.rent || 0,
            insurance: b.paymentBreakdown?.insurance || 0,
            deposit: b.paymentBreakdown?.deposit || 0,
          },

          refundAmount: b.refundAmount || 0,
          refundDate: b.refundDate || null,
        };
      })
    );

    // Past refunds
    const pastRefunds = await Refund.find(companyMatch)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('processedBy', 'name email')
      .populate('bookingId', 'customer email car amount pickupDate returnDate')
      .lean();

    return res.json({ success: true, eligible: enriched, pastRefunds });
  } catch (err) {
    console.error('getEligibleRefunds error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/admin/refunds
export const processRefund = async (req, res) => {
  try {
    const { bookingId, amount, reason } = req.body || {};
    if (!bookingId || amount == null)
      return res.status(400).json({ success: false, message: 'bookingId and amount are required' });
    const refundAmt = parseFloat(amount);
    if (Number.isNaN(refundAmt) || refundAmt <= 0)
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });

    // FIX: superadmin can refund any booking; company_admin only their own
    const isSuperAdmin = req.user.role === 'superadmin';
    const bookingQuery = { _id: bookingId };
    if (!isSuperAdmin && req.user.companyId) {
      bookingQuery.companyId = req.user.companyId;
    }

    const booking = await Booking.findOne(bookingQuery);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    if (refundAmt > booking.amount)
      return res.status(400).json({ success: false, message: 'Refund amount exceeds booking amount' });

    // Attempt Xendit refund via API
    let xenditRefundId = '';
    let xenditRefundStatus = 'pending';
    if (booking.xenditInvoiceId && XENDIT_SECRET_KEY) {
      try {
        const xenditRes = await fetch(
          `https://api.xendit.co/v2/invoices/${booking.xenditInvoiceId}/refunds`,
          {
            method: 'POST',
            headers: {
              Authorization: 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64'),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: refundAmt,
              reason: reason || 'OTHERS',
            }),
          }
        );
        const xenditData = await xenditRes.json();
        if (xenditRes.ok) {
          xenditRefundId = xenditData.id || '';
          xenditRefundStatus = 'processed';
        } else {
          console.warn('Xendit refund API error:', xenditData);
          xenditRefundStatus = 'pending';
        }
      } catch (xenditErr) {
        console.error('Xendit refund API call failed:', xenditErr.message);
        xenditRefundStatus = 'pending';
      }
    }

    const refund = await Refund.create({
      bookingId,
      companyId: booking.companyId || req.user.companyId,  // FIX: use the booking's companyId
      amount: refundAmt,
      reason: reason || '',
      status: xenditRefundStatus,
      processedBy: req.user.id,
      xenditRefundId,
    });

    // Update booking
    booking.refundAmount = (booking.refundAmount || 0) + refundAmt;
    booking.refundDate = new Date();
    booking.refundId = xenditRefundId || refund._id.toString();
    if (booking.refundAmount >= booking.amount) {
      booking.paymentStatus = 'refunded';
      booking.status = 'cancelled';
    } else {
      booking.paymentStatus = 'partially_refunded';
    }
    await booking.save();

    // Audit log
    try {
      await AuditLog.create({
        userId: req.user.id,
        userName: req.user.name || '',
        userEmail: req.user.email || '',
        companyId: booking.companyId || req.user.companyId,
        category: 'refund',
        action: `Refund processed: MYR ${refundAmt} for booking ${bookingId}`,
        details: `Reason: ${reason || 'N/A'}. Xendit ID: ${xenditRefundId || 'manual/pending'}`,
        severity: 'warning',
        metadata: {
          targetType: 'booking',
          targetId: bookingId,
          previousValue: { paymentStatus: 'paid' },
          newValue: { refundAmount: refundAmt, paymentStatus: booking.paymentStatus },
        },
        ip: req.ip,
      });
    } catch (logErr) {
      console.error('Audit log failed for refund:', logErr.message);
    }

    return res.json({
      success: true,
      refundId: refund._id,
      xenditRefundId,
      xenditRefundStatus,
    });
  } catch (err) {
    console.error('processRefund error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};