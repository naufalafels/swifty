import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import Company from '../models/companyModel.js';
import Car from '../models/carModel.js';
import Booking from '../models/bookingModel.js';
import { sendHostApprovalEmail, sendHostRejectionEmail } from '../services/emailService.js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const TOKEN_EXPIRES = process.env.TOKEN_EXPIRES || '24h';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:7889';

// FIX: signToken now accepts a user object and embeds role, companyId, roles in the JWT.
// Previously it only embedded { id }, which meant after signup the auth middleware
// fast-path would set companyId: null — breaking analytics, invoices, refunds, etc.
const signToken = (userOrId) => {
  if (typeof userOrId === 'object' && userOrId !== null) {
    return jwt.sign({
      id: userOrId._id?.toString() || userOrId.id?.toString(),
      name: userOrId.name || '',
      email: userOrId.email || '',
      role: userOrId.role || 'user',
      roles: Array.isArray(userOrId.roles) ? userOrId.roles : ['renter'],
      companyId: userOrId.companyId?.toString() || null,
    }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
  }
  // Fallback for plain string ID (shouldn't happen after fix, but safe)
  return jwt.sign({ id: userOrId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
};

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
  country: body.address_country || body.country || (body.address && body.address.country) || ''
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

    // Optional: accept location latitude/longitude and store as GeoJSON Point
    const rawLat = req.body.location_lat ?? req.body.lat ?? req.body.latitude;
    const rawLng = req.body.location_lng ?? req.body.lng ?? req.body.longitude;
    if (rawLat !== undefined && rawLng !== undefined && rawLat !== '' && rawLng !== '') {
      const lat = parseFloat(rawLat);
      const lng = parseFloat(rawLng);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        companyData.location = { type: 'Point', coordinates: [lng, lat] };
      }
    }

    const company = await Company.create(companyData);

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed, role: 'company_admin', companyId: company._id });
    await user.save();

    company.ownerUserId = user._id;
    await company.save();

    // FIX: Pass the full user object so JWT includes role + companyId
    const token = signToken(user);

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
    const isSuperAdmin = req.user.role === 'superadmin';

    if (!isSuperAdmin && !companyId) {
      return res.status(400).json({ success: false, message: 'No company associated with user' });
    }

    const filter = isSuperAdmin ? {} : { companyId };
    const cars = await Car.find(filter).lean();
    return res.json({ success: true, cars });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};  

// create car for company (accepts image on req.file)
// Updated: when request doesn't provide a valid location, fall back to company's location (if any)
export const createAdminCar = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const isSuperAdmin = req.user.role === 'superadmin';

    // Superadmin can create cars for any company (pass companyId in body)
    // company_admin creates for their own company
    let targetCompanyId = companyId;
    if (isSuperAdmin) {
      targetCompanyId = req.body.companyId || companyId;
    }
    if (!targetCompanyId) {
      return res.status(400).json({ success: false, message: 'No company associated. Superadmin: pass companyId in body.' });
    }

    const company = await Company.findById(targetCompanyId).lean();
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const body = req.body || {};
    const required = ['make','model','year','dailyRate'];
    for (const f of required) if (!body[f]) return res.status(400).json({ success: false, message: `${f} is required` });

    const imageUrl = req.file ? buildCarImageUrl(req.file) : (body.image || "");

    let carLocation;
    if (body.location) {
      try {
        if (typeof body.location === 'string' && body.location.trim().startsWith('[')) {
          const coords = JSON.parse(body.location);
          if (Array.isArray(coords) && coords.length >= 2) {
            carLocation = { type: 'Point', coordinates: coords };
          }
        } else if (Array.isArray(body.location) && body.location.length >= 2) {
          carLocation = { type: 'Point', coordinates: body.location };
        } else if (typeof body.location === 'object' && body.location.type === 'Point' && Array.isArray(body.location.coordinates)) {
          carLocation = body.location;
        }
      } catch (err) {
        carLocation = undefined;
      }
    }

    if (!carLocation && company && company.location && company.location.type === 'Point' && Array.isArray(company.location.coordinates)) {
      carLocation = company.location;
    }

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
      deposit: Number(body.deposit || 0),
      gasUsage: body.gasUsage || '',
      image: imageUrl,
      status: body.status || 'available',
      companyId: targetCompanyId,
      companyName: company.name,
      location: carLocation ? carLocation : undefined
    });

    return res.status(201).json({ success: true, car });
  } catch (err) {
    console.error('createAdminCar error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// update car for company (accepts image on req.file)
export const updateAdminCar = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const isSuperAdmin = req.user.role === 'superadmin';
    const carId = req.params.id;

    if (!isSuperAdmin && !companyId) {
      return res.status(400).json({ success: false, message: 'No company associated with user' });
    }

    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ success: false, message: 'Car not found' });

    // company_admin can only update their own company's cars
    if (!isSuperAdmin && (!car.companyId || car.companyId.toString() !== companyId.toString())) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const body = req.body || {};
    const allowed = ['make','model','year','color','category','seats','transmission','fuelType','mileage','dailyRate','deposit','gasUsage','status','location'];

    const previousValues = {};
    const newValues = {};
    allowed.forEach(k => {
      if (body[k] !== undefined) {
        previousValues[k] = car[k];
        car[k] = body[k];
        newValues[k] = body[k];
      }
    });

    if (req.file) {
      car.image = buildCarImageUrl(req.file);
    } else if (body.image) {
      car.image = body.image;
    }

    await car.save();

    // Create audit log
    try {
      const { default: AuditLog } = await import('../models/auditLogModel.js');

      const isPriceChange = previousValues.dailyRate !== undefined || previousValues.deposit !== undefined;
      const category = isPriceChange ? 'price_change' : 'car_management';
      const severity = isPriceChange ? 'warning' : 'info';

      let action = '';
      let details = '';

      if (isPriceChange) {
        const parts = [];
        if (previousValues.dailyRate !== undefined && String(previousValues.dailyRate) !== String(newValues.dailyRate)) {
          parts.push(`Daily rate: MYR ${previousValues.dailyRate} → MYR ${newValues.dailyRate}`);
        }
        if (previousValues.deposit !== undefined && String(previousValues.deposit) !== String(newValues.deposit)) {
          parts.push(`Deposit: MYR ${previousValues.deposit} → MYR ${newValues.deposit}`);
        }
        action = `Price changed on ${car.make} ${car.model} (${car.year})`;
        details = parts.length > 0 ? parts.join('; ') : 'Price fields updated (no value change)';
      } else {
        const changedFields = Object.keys(newValues).filter(k => String(previousValues[k]) !== String(newValues[k]));
        action = `Car updated: ${car.make} ${car.model} (${car.year})`;
        details = changedFields.length > 0 ? `Changed: ${changedFields.join(', ')}` : 'Car fields updated';
      }

      await AuditLog.create({
        userId: req.user.id,
        userName: req.user.name || '',
        userEmail: req.user.email || '',
        companyId: car.companyId || req.user.companyId || null,  // Use car's companyId for superadmin
        category,
        action,
        details,
        severity,
        metadata: {
          targetType: 'car',
          targetId: carId,
          carId: carId,
          previousValue: previousValues,
          newValue: newValues,
        },
        ip: req.ip,
      });
    } catch (logErr) {
      console.error('Audit log failed for updateAdminCar:', logErr.message);
    }

    return res.json({ success: true, car });
  } catch (err) {
    console.error('updateAdminCar', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteAdminCar = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const isSuperAdmin = req.user.role === 'superadmin';
    const carId = req.params.id;

    if (!isSuperAdmin && !companyId) {
      return res.status(400).json({ success: false, message: 'No company associated with user' });
    }

    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ success: false, message: 'Car not found' });

    if (!isSuperAdmin && (!car.companyId || car.companyId.toString() !== companyId.toString())) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await car.remove();
    return res.json({ success: true, message: 'Car deleted' });
  } catch (err) {
    console.error('deleteAdminCar', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// bookings (superadmin sees ALL)
export const getAdminBookings = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const isSuperAdmin = req.user.role === 'superadmin';

    if (!isSuperAdmin && !companyId) {
      return res.status(400).json({ success: false, message: 'No company associated with user' });
    }

    const filter = isSuperAdmin ? {} : { companyId };
    const bookings = await Booking.find(filter).sort({ bookingDate: -1 }).lean();
    return res.json({ success: true, bookings });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateAdminBookingStatus = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const isSuperAdmin = req.user.role === 'superadmin';
    const bookingId = req.params.id;
    const { status } = req.body;

    if (!isSuperAdmin && !companyId) {
      return res.status(400).json({ success: false, message: 'No company associated with user' });
    }
    if (!status) return res.status(400).json({ success: false, message: 'Status is required' });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // company_admin can only update their own company's bookings
    if (!isSuperAdmin && (!booking.companyId || booking.companyId.toString() !== companyId.toString())) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    booking.status = status;
    await booking.save();
    return res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// company profile — superadmin sees first company or a summary
export const getCompanyProfile = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const isSuperAdmin = req.user.role === 'superadmin';

    if (!isSuperAdmin && !companyId) {
      return res.status(400).json({ success: false, message: 'No company associated with user' });
    }

    let company;
    if (isSuperAdmin && !companyId) {
      // Superadmin has no company — return the first one or null (graceful)
      company = await Company.findOne({}).lean();
    } else {
      company = await Company.findById(companyId).lean();
    }

    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    return res.json({ success: true, company });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
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

// UPDATED: KYC list for admin - Fetch from User model
import { generateDownloadUrl } from '../services/s3Service.js';
import { decrypt } from '../services/cryptoService.js';

export const getKycList = async (req, res) => {
  try {
    const users = await User.find({ 'kyc.status': { $exists: true } }).lean();
    const result = await Promise.all(users.map(async (user) => {
      const kyc = user.kyc || {};
      let frontUrl = null;
      if (kyc.frontImageUrl) {
        if (kyc.frontImageUrl.startsWith('http')) {
          frontUrl = kyc.frontImageUrl;
        } else {
          try {
            frontUrl = await generateDownloadUrl(kyc.frontImageUrl);
          } catch (err) {
            console.error('Error generating front URL', err);
          }
        }
      }
      let backUrl = null;
      if (kyc.backImageUrl) {
        if (kyc.backImageUrl.startsWith('http')) {
          backUrl = kyc.backImageUrl;
        } else {
          try {
            backUrl = await generateDownloadUrl(kyc.backImageUrl);
          } catch (err) {
            console.error('Error generating back URL', err);
          }
        }
      }
      let idNum = 'N/A';
      try {
        idNum = kyc.idNumber ? decrypt(kyc.idNumber) : 'N/A';
      } catch (err) {
        idNum = kyc.idNumber || 'N/A';
      }

      // UPDATED: Fetch car from user.initialCar (pending) or Cars collection (approved)
      let firstCar = user.initialCar;
      if (!firstCar && user.roles && user.roles.includes('host')) {
        const cars = await Car.find({ companyId: user._id }).lean();
        firstCar = cars[0];
      }

      return {
        id: user._id,
        userId: user._id,
        fullName: user.name,
        idNumber: idNum,
        status: kyc.status || 'pending',
        frontImageUrl: frontUrl,
        backImageUrl: backUrl,
        statusReason: kyc.statusReason || '',
        payoutReference: user.hostProfile?.payoutAccountRef || '',
        isHost: Array.isArray(user.roles) ? user.roles.includes('host') : false,
        isApplyingForHost: !!user.applyingForHost,
        hostStatus: user.hostStatus || 'none',
        companyName: user.hostProfile?.companyName || '',
        ssmNumber: user.hostProfile?.ssmNumber || '',
        carId: firstCar?._id || null,
        carMake: firstCar?.make || '',
        carModel: firstCar?.model || '',
        carYear: firstCar?.year || '',
        carColor: firstCar?.color || '',
        carCategory: firstCar?.category || '',
        carSeats: firstCar?.seats || '',
        carTransmission: firstCar?.transmission || '',
        carFuelType: firstCar?.fuelType || '',
        carPetrolType: firstCar?.petrolType || [],
        carMileage: firstCar?.mileage || '',
        carDailyRate: firstCar?.dailyRate || '',
        carDeposit: firstCar?.deposit || '',
        carGasUsage: firstCar?.gasUsage || '',
        carImage: firstCar?.image || '',
      };
    }));
    res.json(result);
  } catch (err) {
    console.error('getKycList error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const approveKyc = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.kyc) return res.status(404).json({ message: 'KYC not found' });
    user.kyc.status = 'approved';
    user.kyc.reviewedAt = new Date();

    // Add 'host' role and update status
    if (user.applyingForHost) {
      user.roles = Array.isArray(user.roles) ? [...new Set([...user.roles, 'host'])] : ['host'];
      user.applyingForHost = false;
      user.hostStatus = 'approved';
      if (!user.notifications) user.notifications = [];
      user.notifications.unshift({ message: 'Your host application has been approved! You are now a host.', read: false, createdAt: new Date() });
    }

    await user.save();
    res.json({ message: 'Approved' });
  } catch (err) {
    console.error('approveKyc error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const rejectKyc = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.kyc) return res.status(404).json({ message: 'KYC not found' });
    user.kyc.status = 'rejected';
    user.kyc.statusReason = reason || 'Rejected by admin';
    user.kyc.reviewedAt = new Date();

    // UPDATED: If applying for host, reject and notify
    if (user.applyingForHost) {
      user.applyingForHost = false;
      user.hostStatus = 'rejected';
      user.rejectionReason = reason || 'Rejected by admin';
      if (!user.notifications) user.notifications = [];
      user.notifications.unshift({ message: `Your host application was rejected: ${reason || 'Rejected by admin'}`, read: false, createdAt: new Date() });
    }

    await user.save();
    res.json({ message: 'Rejected' });
  } catch (err) {
    console.error('rejectKyc error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Approve host application (KYC remains approved)
export const approveHost = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user || !user.applyingForHost) return res.status(404).json({ message: 'Host application not found' });
    user.roles = Array.isArray(user.roles) ? [...new Set([...user.roles, 'host'])] : ['host'];
    user.applyingForHost = false;
    user.hostStatus = 'approved';
    if (!user.notifications) user.notifications = [];
    user.notifications.unshift({ message: 'Host Application is Approved: Host Centre is available.', read: false, createdAt: new Date() });
    if (user.initialCar && user.initialCar.make && user.initialCar.model && user.initialCar.year && user.initialCar.dailyRate) {
      try {
        const carData = {
          make: user.initialCar.make,
          model: user.initialCar.model,
          year: user.initialCar.year,
          dailyRate: user.initialCar.dailyRate,
          color: user.initialCar.color || '',
          category: user.initialCar.category || 'Sedan',
          seats: user.initialCar.seats || 4,
          transmission: user.initialCar.transmission || 'Automatic',
          fuelType: user.initialCar.fuelType || 'Gasoline',
          petrolType: user.initialCar.petrolType || [],
          mileage: user.initialCar.mileage || 0,
          deposit: user.initialCar.deposit || 0,
          gasUsage: user.initialCar.gasUsage || "",
          image: user.initialCar.image || '',
          companyId: user._id,
          companyName: user.hostProfile?.companyName || '',
          status: 'available',
          location: user.hostProfile?.location || { type: 'Point', coordinates: [101.6869, 3.1390] },
        };
        await Car.create(carData);
        user.initialCar = null;
        console.log('Car created successfully for user:', user._id);
      } catch (carError) {
        console.error('Failed to create car for user:', user._id, carError.message);
        // Continue approving the host even if car creation fails
      }
    } else {
      console.error('Invalid initialCar data for user:', user._id);
    }
    await user.save();

    // Send approval email
    sendHostApprovalEmail(user.email, user.name).catch(err =>
      console.error('Host approval email failed:', err)
    );

    res.json({ message: 'Host approved' });
  } catch (err) {
    console.error('approveHost error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Reject host application (KYC remains approved)
export const rejectHost = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = await User.findById(id);
    if (!user || !user.applyingForHost) return res.status(404).json({ message: 'Host application not found' });
    user.applyingForHost = false;
    user.hostStatus = 'rejected';
    user.rejectionReason = reason || 'Rejected by admin';
    if (!user.notifications) user.notifications = [];
    user.notifications.unshift({ message: `Host Application is Rejected: ${reason || 'Rejected by admin'}`, read: false, createdAt: new Date() });
    await user.save();

    // Send rejection email
    sendHostRejectionEmail(user.email, user.name, reason).catch(err =>
      console.error('Host rejection email failed:', err)
    );

    res.json({ message: 'Host rejected' });
  } catch (err) {
    console.error('rejectHost error', err);
    res.status(500).json({ message: 'Server error' });
  }
};