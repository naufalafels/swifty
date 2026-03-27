import mongoose from 'mongoose';
import Booking from '../models/bookingModel.js';

const XENDIT_SECRET_KEY = (process.env.XENDIT_SECRET_KEY || '').trim();

/**
 * Xendit Invoice Strategy:
 * Every booking with a xenditInvoiceId IS an invoice. We don't need a separate collection.
 * 
 * FIX: superadmin sees ALL invoices across all companies.
 * company_admin sees only their company's invoices.
 */

// GET /api/admin/invoices
export const listInvoices = async (req, res) => {
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

    const { page = 1, limit = 50, status, search, startDate, endDate } = req.query;

    const filter = { ...companyMatch, xenditInvoiceId: { $exists: true, $ne: '' } };

    if (status && status !== 'all') {
      filter.paymentStatus = status;
    }

    if (search) {
      filter.$or = [
        { customer: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { xenditInvoiceId: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      filter.bookingDate = {};
      if (startDate) filter.bookingDate.$gte = new Date(startDate);
      if (endDate) filter.bookingDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ bookingDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Booking.countDocuments(filter),
    ]);

    // Summary via aggregation
    const summaryAgg = await Booking.aggregate([
      { $match: { ...companyMatch, xenditInvoiceId: { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] } },
          expired: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'expired'] }, 1, 0] } },
          refunded: { $sum: { $cond: [{ $in: ['$paymentStatus', ['refunded', 'partially_refunded']] }, 1, 0] } },
          totalRevenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, { $ifNull: ['$amount', 0] }, 0] } },
        },
      },
    ]);

    const summary = summaryAgg[0] || { total: 0, paid: 0, pending: 0, expired: 0, refunded: 0, totalRevenue: 0 };

    const invoices = bookings.map((b) => ({
      bookingId: b._id,
      xenditInvoiceId: b.xenditInvoiceId,
      xenditInvoiceUrl: b.xenditInvoiceUrl || '',
      customer: b.customer || '',
      email: b.email || '',
      phone: b.phone || '',
      amount: b.amount || 0,
      currency: b.currency || 'MYR',
      paymentStatus: b.paymentStatus,
      bookingStatus: b.status,
      bookingDate: b.bookingDate,
      pickupDate: b.pickupDate,
      returnDate: b.returnDate,
      xenditPaymentMethod: b.xenditPaymentMethod || '',
      xenditPaymentChannel: b.xenditPaymentChannel || '',
      paymentBreakdown: b.paymentBreakdown || {},
      car: {
        make: b.car?.make || '',
        model: b.car?.model || '',
        year: b.car?.year || '',
        image: b.car?.image || b.carImage || '',
        plateNumber: b.car?.plateNumber || '',
      },
    }));

    return res.json({
      success: true,
      invoices,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      summary,
    });
  } catch (err) {
    console.error('listInvoices error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/admin/invoices/:invoiceId
export const getInvoiceDetail = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    if (!invoiceId) return res.status(400).json({ success: false, message: 'invoiceId required' });

    // FIX: superadmin can view any invoice; company_admin only their own
    const isSuperAdmin = req.user.role === 'superadmin';
    const query = { xenditInvoiceId: invoiceId };
    if (!isSuperAdmin && req.user.companyId) {
      query.companyId = req.user.companyId;
    }

    const booking = await Booking.findOne(query).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Invoice not found' });

    // Optionally fetch live Xendit data
    let xenditData = null;
    if (XENDIT_SECRET_KEY) {
      try {
        const xenditRes = await fetch(`https://api.xendit.co/v2/invoices/${invoiceId}`, {
          headers: {
            Authorization: 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64'),
          },
        });
        if (xenditRes.ok) {
          xenditData = await xenditRes.json();
        }
      } catch (e) {
        console.warn('Xendit invoice fetch failed:', e.message);
      }
    }

    return res.json({
      success: true,
      booking: {
        bookingId: booking._id,
        customer: booking.customer,
        email: booking.email,
        phone: booking.phone,
        amount: booking.amount,
        currency: booking.currency,
        paymentStatus: booking.paymentStatus,
        status: booking.status,
        bookingDate: booking.bookingDate,
        pickupDate: booking.pickupDate,
        returnDate: booking.returnDate,
        paymentBreakdown: booking.paymentBreakdown,
        car: booking.car,
      },
      xendit: xenditData,
    });
  } catch (err) {
    console.error('getInvoiceDetail error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};