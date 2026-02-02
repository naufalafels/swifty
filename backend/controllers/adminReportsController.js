import Booking from '../models/bookingModel.js';
import User from '../models/userModel.js';
import { Readable } from 'stream';

const makeCsv = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  rows.forEach((r) => lines.push(headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')));
  return lines.join('\n');
};

export const downloadReport = async (req, res) => {
  try {
    const { type } = req.params;
    const companyId = req.user.companyId;

    let rows = [];
    if (type === 'users') {
      const users = await User.find({ companyId }).select('email fullName role createdAt').lean();
      rows = users.map((u) => ({
        email: u.email,
        name: u.fullName || '',
        role: u.role,
        createdAt: u.createdAt,
      }));
    } else if (type === 'bookings') {
      const bookings = await Booking.find({ companyId }).select('totalPrice bookingDate status').lean();
      rows = bookings.map((b) => ({
        bookingDate: b.bookingDate,
        status: b.status,
        totalPrice: b.totalPrice,
      }));
    } else if (type === 'activities') {
      rows = [{ event: 'login', count: 120 }, { event: 'booking_created', count: 45 }];
    } else {
      return res.status(400).json({ success: false, message: 'Invalid report type' });
    }

    const csv = makeCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report.csv`);

    Readable.from(csv).pipe(res);
  } catch (err) {
    console.error('downloadReport error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};