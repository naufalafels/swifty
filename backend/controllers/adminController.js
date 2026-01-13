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
const SERVER_URL = process.env.SERVER_URL || process.env.FRONTEND_URL || 'http://localhost:7889';

const signToken = (userId) => jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });

// Helper: build logo URL from uploaded file info (req.file)
const buildLogoUrl = (file) => {
  if (!file) return '';
  // uploads/company-logos/<filename>
  return `${SERVER_URL.replace(/\/$/, '')}/uploads/company-logos/${file.filename}`;
};

// Helper: construct address/contact from form fields (multipart sends strings)
const buildAddressFromBody = (body) => ({
  street: body.address_street || body.street || (body.address && body.address.street) || '',
  city: body.address_city || body.city || (body.address && body.address.city) || '',
  state: body.address_state || body.state || (body.address && body.address.state) || '',
  zipCode: body.address_zipCode || body.zipCode || (body.address && body.address.zipCode) || '',
});

// ---------------- Signup: create company + company_admin user (accepts multipart/logo file) ----------------
export const signupCompany = async (req, res) => {
  try {
    // multer may have placed file on req.file
    const { name, email, password, companyName, phone } = req.body;
    const address = buildAddressFromBody(req.body);

    if (!name || !email || !password || !companyName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // check user exists
    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ success: false, message: 'User already exists' });

    // create company
    const slug = companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    const companyData = {
      name: companyName,
      slug,
      address,
      contact: { phone, email },
    };

    // if file uploaded, set logo
    if (req.file) {
      companyData.logo = buildLogoUrl(req.file);
    } else if (req.body.logo) {
      companyData.logo = req.body.logo;
    }

    const company = await Company.create(companyData);

    // create user as company_admin
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hashed,
      role: 'company_admin',
      companyId: company._id
    });
    await user.save();

    // link owner
    company.ownerUserId = user._id;
    await company.save();

    const token = signToken(user._id.toString());

    return res.status(201).json({
      success: true,
      message: 'Company account created',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, companyId: user.companyId },
      company: { id: company._id, name: company.name, slug: company.slug, logo: company.logo }
    });
  } catch (err) {
    console.error('signupCompany error', err);
    return res.status(500).json({ success: false, message: 'Server error', error: String(err.message || err) });
  }
};

// ---------------- Admin: get cars (company scoped) ----------------
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

// ---------------- Admin: create car (company scoped) ----------------
export const createAdminCar = async (req, res) => {
  try {
    const user = req.user;
    const companyId = user.companyId || user.company || null;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });

    const body = req.body || {};
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

// ---------------- Admin: update car (company scoped) ----------------
export const updateAdminCar = async (req, res) => {
  try {
    const user = req.user;
    const companyId = user.companyId || null;
    const carId = req.params.id;
    const body = req.body || {};

    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });

    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ success: false, message: 'Car not found' });
    if (!car.companyId || car.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const allowed = ['make','model','year','color','category','seats','transmission','fuelType','mileage','dailyRate','image','status','location'];
    allowed.forEach(k => { if (body[k] !== undefined) car[k] = body[k]; });

    await car.save();
    return res.json({ success: true, car });
  } catch (err) {
    console.error('updateAdminCar', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------------- Admin: delete car (company scoped) ----------------
export const deleteAdminCar = async (req, res) => {
  try {
    const user = req.user;
    const companyId = user.companyId || null;
    const carId = req.params.id;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });

    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ success: false, message: 'Car not found' });
    if (!car.companyId || car.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await car.remove();
    return res.json({ success: true, message: 'Car deleted' });
  } catch (err) {
    console.error('deleteAdminCar', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------------- Admin: bookings (company scoped) ----------------
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

// ---------------- Company profile endpoints ----------------
export const getCompanyProfile = async (req, res) => {
  try {
    const user = req.user;
    const companyId = user.companyId || user.company || null;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });

    const company = await Company.findById(companyId).lean();
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    return res.json({ success: true, company });
  } catch (err) {
    console.error('getCompanyProfile error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateCompanyProfile = async (req, res) => {
  try {
    const user = req.user;
    const companyId = user.companyId || user.company || null;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });

    // Build payload from body fields (multipart/form-data possible)
    const payload = {};
    const allowed = ['name', 'isVerified'];
    allowed.forEach(k => { if (req.body[k] !== undefined) payload[k] = req.body[k]; });

    // address fields
    const address = buildAddressFromBody(req.body);
    payload.address = address;

    // contact
    payload.contact = {
      phone: req.body.contact_phone || req.body.phone || (req.body.contact && req.body.contact.phone) || '',
      email: req.body.contact_email || req.body.email || (req.body.contact && req.body.contact.email) || ''
    };

    // location - accept lat/lng fields if provided
    if (req.body.location_lat && req.body.location_lng) {
      const lat = parseFloat(req.body.location_lat);
      const lng = parseFloat(req.body.location_lng);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        payload.location = { type: 'Point', coordinates: [lng, lat] };
      }
    }

    // handle uploaded logo file (multer places it on req.file)
    if (req.file) {
      payload.logo = buildLogoUrl(req.file);
    } else if (req.body.logo) {
      payload.logo = req.body.logo;
    }

    const updated = await Company.findByIdAndUpdate(companyId, payload, { new: true }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Company not found' });

    return res.json({ success: true, company: updated });
  } catch (err) {
    console.error('updateCompanyProfile error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};