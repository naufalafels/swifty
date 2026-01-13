import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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

// Configure multer storage for company logos
const storage = multer.diskStorage({
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
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit

// Public: create company + admin (accepts multipart/form-data with optional logo field)
router.post('/signup', upload.single('logo'), signupCompany);

// Protected admin routes
router.use(authMiddleware);
router.use(requireCompanyAdmin);

// cars
router.get('/cars', getAdminCars);
router.post('/cars', createAdminCar);
router.put('/cars/:id', updateAdminCar);
router.delete('/cars/:id', deleteAdminCar);

// bookings
router.get('/bookings', getAdminBookings);
router.patch('/bookings/:id/status', updateAdminBookingStatus);

// company profile (allow multipart upload for logo)
router.get('/company', getCompanyProfile);
router.put('/company', upload.single('logo'), updateCompanyProfile);

export default router;