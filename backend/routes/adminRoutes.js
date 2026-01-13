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

// multer storage
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
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB

// Public signup (accepts logo file)
router.post('/signup', upload.single('logo'), signupCompany);

// Admin routes (protected)
router.use(authMiddleware);
router.use(requireCompanyAdmin);

// Cars
router.get('/cars', getAdminCars);
router.post('/cars', createAdminCar);
router.put('/cars/:id', updateAdminCar);
router.delete('/cars/:id', deleteAdminCar);

// Bookings
router.get('/bookings', getAdminBookings);
router.patch('/bookings/:id/status', updateAdminBookingStatus);

// Company profile
router.get('/company', getCompanyProfile);
router.put('/company', upload.single('logo'), updateCompanyProfile);

export default router;