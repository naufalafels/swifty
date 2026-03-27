import Booking from '../models/bookingModel.js';
import User from '../models/userModel.js';

const XENDIT_SECRET_KEY = (process.env.XENDIT_SECRET_KEY || '').trim();

/**
 * Strategy for Invoices with Xendit:
 *
 * Xendit creates invoices when you call POST /v2/invoices — you already do this in paymentController.
 * Every booking with a xenditInvoiceId IS an invoice. So we don't need a separate Invoice collection.
 *
 * This controller:
 * 1. Lists all bookings that have a xenditInvoiceId (= all invoices)
 * 2. Fetches live status from Xendit API for any individual invoice
 * 3. Provides a "view invoice" link that redirects to Xendit's hosted invoice page
 *
 * The xenditInvoiceUrl is already stored on each booking from createXenditInvoice.
 */

// GET /api/admin/invoices — List all invoices (= bookings with xenditInvoiceId)
export const listInvoices = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company' });

    const { page = 1, limit = 50, status, search, startDate, endDate } = req.query;

    const filter = { companyId, xenditInvoiceId: { $ne: '' } };

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

    // Summarize
    const allInvoiceBookings = await Booking.find({ companyId, xenditInvoiceId: { $ne: '' } })
      .select('paymentStatus amount')
      .lean();
    const summary = {
      total: allInvoiceBookings.length,
      paid: allInvoiceBookings.filter((b) => b.paymentStatus === 'paid').length,
      pending: allInvoiceBookings.filter((b) => b.paymentStatus === 'pending').length,
      expired: allInvoiceBookings.filter((b) => b.paymentStatus === 'expired').length,
      refunded: allInvoiceBookings.filter((b) => ['refunded', 'partially_refunded'].includes(b.paymentStatus)).length,
      totalRevenue: allInvoiceBookings
        .filter((b) => b.paymentStatus === 'paid')
        .reduce((s, b) => s + (b.amount || 0), 0),
    };

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

// GET /api/admin/invoices/:invoiceId — Fetch live Xendit invoice details
export const getInvoiceDetail = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    if (!invoiceId) return res.status(400).json({ success: false, message: 'invoiceId required' });

    // Local data
    const booking = await Booking.findOne({
      xenditInvoiceId: invoiceId,
      companyId: req.user.companyId,
    }).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Invoice not found' });

    // Fetch live from Xendit
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
      xendit: xenditData, // Full Xendit response (if available)
    });
  } catch (err) {
    console.error('getInvoiceDetail error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};