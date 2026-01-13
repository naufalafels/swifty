import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  signupCompany,
  getAdminCars,
  createAdminCar,
  updateAdminCar,
  deleteAdminCar,
  getAdminBookings,
  updateAdminBookingStatus,
  getCompanyProfile,
  updateCompanyProfile
} from '../controllers/adminController.js';
import authMiddleware from '../middlewares/auth.js';
import requireCompanyAdmin from '../middlewares/requireCompanyAdmin.js';

const router = express.Router();

// Multer storage for company logos
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), 'uploads', 'company-logos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.floor(Math.random()*1e9)}${ext}`;
    cb(null, name);
  }
});
const uploadLogo = multer({ storage: logoStorage, limits: { fileSize: 2 * 1024 * 1024 } });

// Multer storage for car images
const carStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), 'uploads', 'car-images');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.floor(Math.random()*1e9)}${ext}`;
    cb(null, name);
  }
});
const uploadCarImage = multer({ storage: carStorage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// Public signup (accepts logo file)
router.post('/signup', uploadLogo.single('logo'), signupCompany);

// Admin routes (protected)
router.use(authMiddleware);
router.use(requireCompanyAdmin);

// Cars
router.get('/cars', getAdminCars);
router.post('/cars', uploadCarImage.single('image'), createAdminCar); // accept image upload
router.put('/cars/:id', uploadCarImage.single('image'), updateAdminCar);
router.delete('/cars/:id', deleteAdminCar);

// Bookings
router.get('/bookings', getAdminBookings);
router.patch('/bookings/:id/status', updateAdminBookingStatus);

// Company profile
router.get('/company', getCompanyProfile);
router.put('/company', uploadLogo.single('logo'), updateCompanyProfile);

export default router;