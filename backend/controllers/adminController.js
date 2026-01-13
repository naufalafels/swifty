import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import Company from '../models/companyModel.js';
import Car from '../models/carModel.js';
import Booking from '../models/bookingModel.js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const TOKEN_EXPIRES = process.env.TOKEN_EXPIRES || '24h';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:7889';

const signToken = (userId) => jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });

const buildLogoUrl = (file) => {
  if (!file) return '';
  return `${SERVER_URL.replace(/\/$/, '')}/uploads/company-logos/${file.filename}`;
};
const buildCarImageUrl = (file) => {
  if (!file) return '';
  return `${SERVER_URL.replace(/\/$/, '')}/uploads/car-images/${file.filename}`;
};
const buildAddressFromBody = (body) => ({
  street: body.address_street || body.street || (body.address && body.address.street) || '',
  city: body.address_city || body.city || (body.address && body.address.city) || '',
  state: body.address_state || body.state || (body.address && body.address.state) || '',
  zipCode: body.address_zipCode || body.zipCode || (body.address && body.address.zipCode) || '',
});

// signup company (company logo optional)
export const signupCompany = async (req, res) => {
  try {
    const { name, email, password, companyName, phone } = req.body;
    const address = buildAddressFromBody(req.body);
    if (!name || !email || !password || !companyName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ success: false, message: 'User already exists' });

    const slug = companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    const companyData = { name: companyName, slug, address, contact: { phone, email } };
    if (req.file) companyData.logo = buildLogoUrl(req.file);
    else if (req.body.logo) companyData.logo = req.body.logo;

    const company = await Company.create(companyData);

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed, role: 'company_admin', companyId: company._id });
    await user.save();

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

// get cars for admin's company
export const getAdminCars = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });
    const cars = await Car.find({ companyId }).lean();
    return res.json({ success: true, cars });
  } catch (err) { console.error(err); return res.status(500).json({ success:false, message:'Server error' }); }
};

// create car for company (accepts image on req.file)
export const createAdminCar = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });

    const body = req.body || {};
    const required = ['make','model','year','dailyRate'];
    for (const f of required) if (!body[f]) return res.status(400).json({ success: false, message: `${f} is required` });

    const imageUrl = req.file ? buildCarImageUrl(req.file) : (body.image || "");

    const car = await Car.create({
      make: body.make,
      model: body.model,
      year: Number(body.year),
      color: body.color || '',
      category: body.category || 'Sedan',
      seats: Number(body.seats) || 4,
      transmission: body.transmission || 'Automatic',
      fuelType: body.fuelType || 'Gasoline',
      mileage: Number(body.mileage) || 0,
      dailyRate: Number(body.dailyRate || 0),
      image: imageUrl,
      status: body.status || 'available',
      companyId,
      location: body.location ? { type: 'Point', coordinates: body.location } : undefined
    });

    return res.status(201).json({ success: true, car });
  } catch (err) {
    console.error('createAdminCar error', err);
    return res.status(500).json({ success:false, message:'Server error' });
  }
};

// update car for company (accepts image on req.file)
export const updateAdminCar = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const carId = req.params.id;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });

    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ success:false, message:'Car not found' });
    if (!car.companyId || car.companyId.toString() !== companyId.toString()) return res.status(403).json({ success:false, message:'Forbidden' });

    const body = req.body || {};
    const allowed = ['make','model','year','color','category','seats','transmission','fuelType','mileage','dailyRate','status','location'];
    allowed.forEach(k => { if (body[k] !== undefined) car[k] = body[k]; });

    if (req.file) {
      car.image = buildCarImageUrl(req.file);
    } else if (body.image) {
      car.image = body.image;
    }

    await car.save();
    return res.json({ success: true, car });
  } catch (err) {
    console.error('updateAdminCar', err);
    return res.status(500).json({ success:false, message:'Server error' });
  }
};

export const deleteAdminCar = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const carId = req.params.id;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company associated with user' });

    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ success:false, message:'Car not found' });
    if (!car.companyId || car.companyId.toString() !== companyId.toString()) return res.status(403).json({ success:false, message:'Forbidden' });

    await car.remove();
    return res.json({ success: true, message: 'Car deleted' });
  } catch (err) {
    console.error('deleteAdminCar', err);
    return res.status(500).json({ success:false, message:'Server error' });
  }
};

// bookings
export const getAdminBookings = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ success:false, message:'No company associated with user' });
    const bookings = await Booking.find({ companyId }).sort({ bookingDate: -1 }).lean();
    return res.json({ success: true, bookings });
  } catch (err) { console.error(err); return res.status(500).json({ success:false, message:'Server error' }); }
};

export const updateAdminBookingStatus = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const bookingId = req.params.id;
    const { status } = req.body;
    if (!companyId) return res.status(400).json({ success:false, message:'No company associated with user' });
    if (!status) return res.status(400).json({ success:false, message:'Status is required' });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success:false, message:'Booking not found' });
    if (!booking.companyId || booking.companyId.toString() !== companyId.toString()) return res.status(403).json({ success:false, message:'Forbidden' });

    booking.status = status;
    await booking.save();
    return res.json({ success:true, booking });
  } catch (err) { console.error(err); return res.status(500).json({ success:false, message:'Server error' }); }
};

// company profile
export const getCompanyProfile = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ success:false, message:'No company associated with user' });
    const company = await Company.findById(companyId).lean();
    if (!company) return res.status(404).json({ success:false, message:'Company not found' });
    return res.json({ success:true, company });
  } catch (err) { console.error(err); return res.status(500).json({ success:false, message:'Server error' }); }
};

export const updateCompanyProfile = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ success:false, message:'No company associated with user' });

    const payload = {};
    if (req.body.name) payload.name = req.body.name;
    payload.address = buildAddressFromBody(req.body);
    payload.contact = {
      phone: req.body.contact_phone || req.body.phone || (req.body.contact && req.body.contact.phone) || '',
      email: req.body.contact_email || req.body.email || (req.body.contact && req.body.contact.email) || ''
    };
    if (req.body.location_lat && req.body.location_lng) {
      const lat = parseFloat(req.body.location_lat);
      const lng = parseFloat(req.body.location_lng);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) payload.location = { type: 'Point', coordinates: [lng, lat] };
    }
    if (req.file) payload.logo = buildLogoUrl(req.file);
    else if (req.body.logo) payload.logo = req.body.logo;

    const updated = await Company.findByIdAndUpdate(companyId, payload, { new: true }).lean();
    if (!updated) return res.status(404).json({ success:false, message:'Company not found' });
    return res.json({ success:true, company: updated });
  } catch (err) { console.error(err); return res.status(500).json({ success:false, message:'Server error' }); }
};