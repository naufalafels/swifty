import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import Company from '../models/companyModel.js';
import Car from '../models/carModel.js';
import Booking from '../models/bookingModel.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const TOKEN_EXPIRES = process.env.TOKEN_EXPIRES || '24h';

// Helper to sign token
const signToken = (userId) => jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });

// Create company + company_admin user in one step
export const signupCompany = async (req, res) => {
  try {
    const { name, email, password, companyName, address = {}, location = null, phone } = req.body;
    if (!name || !email || !password || !companyName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Check if email exists
    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ success: false, message: 'User already exists' });

    // Create Company
    const slug = companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    const company = await Company.create({
      name: companyName,
      slug,
      address,
      location: location ? { type: 'Point', coordinates: location } : undefined,
      contact: { phone, email },
    });

    // Create User as company_admin
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hashed,
      role: 'company_admin',
      companyId: company._id
    });
    await user.save();

    // link company owner
    company.ownerUserId = user._id;
    await company.save();

    const token = signToken(user._id.toString());

    return res.status(201).json({
      success: true,
      message: 'Company account created',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, companyId: user.companyId },
      company: { id: company._id, name: company.name, slug: company.slug }
    });
  } catch (err) {
    console.error('signupCompany error', err);
    return res.status(500).json({ success: false, message: 'Server error', error: String(err.message || err) });
  }
};

// Admin: get cars for this company
export const getAdminCars = async (req, res) => {
  try {
    const user = req.user;
    const companyId = user.companyId || user.company || null;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });

    const cars = await Car.find({ companyId }).lean();
    return res.json({ success: true, cars });
  } catch (err) {
    console.error('getAdminCars error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Admin: create a car for this company
export const createAdminCar = async (req, res) => {
  try {
    const user = req.user;
    const companyId = user.companyId || user.company || null;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });

    const body = req.body || {};
    // minimal validation
    const required = ['make','model','year','dailyRate'];
    for (const f of required) if (!body[f]) return res.status(400).json({ success: false, message: `${f} is required` });

    const car = await Car.create({
      make: body.make,
      model: body.model,
      year: body.year,
      color: body.color,
      category: body.category || 'Sedan',
      seats: body.seats || 4,
      transmission: body.transmission || 'Automatic',
      fuelType: body.fuelType || 'Gasoline',
      mileage: body.mileage || 0,
      dailyRate: Number(body.dailyRate || 0),
      image: body.image || '',
      status: body.status || 'available',
      companyId,
      location: body.location ? { type: 'Point', coordinates: body.location } : undefined
    });

    return res.status(201).json({ success: true, car });
  } catch (err) {
    console.error('createAdminCar error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Admin: get bookings for this company
export const getAdminBookings = async (req, res) => {
  try {
    const user = req.user;
    const companyId = user.companyId || user.company || null;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });

    const bookings = await Booking.find({ companyId }).sort({ bookingDate: -1 }).lean();
    return res.json({ success: true, bookings });
  } catch (err) {
    console.error('getAdminBookings error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Admin: update booking status (company can change own bookings)
export const updateAdminBookingStatus = async (req, res) => {
  try {
    const user = req.user;
    const companyId = user.companyId || user.company || null;
    const bookingId = req.params.id;
    const { status } = req.body;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });
    if (!status) return res.status(400).json({ success: false, message: 'Status is required' });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!booking.companyId || booking.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    booking.status = status;
    await booking.save();
    return res.json({ success: true, booking });
  } catch (err) {
    console.error('updateAdminBookingStatus error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};