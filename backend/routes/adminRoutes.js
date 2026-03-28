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
  updateCompanyProfile,
  getKycList,
  approveKyc,
  rejectKyc
} from '../controllers/adminController.js';
import { getAnalytics } from '../controllers/adminAnalyticsController.js';
import { getAuditLogs, logAdminGeoLogin } from '../controllers/adminAuditController.js';
import {
  listUsers,
  listHosts,
  updateVerification,
  savePayoutReference,
  listPendingKyc,
  reviewKyc
} from '../controllers/adminVerificationController.js';
import { getTerms, updateTerms, getPublicTerms } from '../controllers/adminLegalController.js';
import { getEligibleRefunds, processRefund } from '../controllers/adminRefundController.js'; // FIX: Added getEligibleRefunds import
import { listInvoices, getInvoiceDetail } from '../controllers/adminInvoiceController.js'; // NEW: Invoices
import { getAdminProfile, updateAdminProfile, changeAdminPassword } from '../controllers/adminProfileController.js'; // NEW: Admin Profile
import { downloadReport } from '../controllers/adminReportsController.js';
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
const uploadCarImage = multer({ storage: carStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// Multer storage for admin avatars (NEW)
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), 'uploads', 'admin-avatars');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.floor(Math.random()*1e9)}${ext}`;
    cb(null, name);
  }
});
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 2 * 1024 * 1024 } });

// Public signup (accepts logo file)
router.post('/signup', uploadLogo.single('logo'), signupCompany);

// Public Terms for frontend
router.get('/public/legal/terms', getPublicTerms);

// Admin routes (protected)
router.use(authMiddleware);
router.use(requireCompanyAdmin);

// Cars
router.get('/cars', getAdminCars);
router.post('/cars', uploadCarImage.single('image'), createAdminCar);
router.put('/cars/:id', updateAdminCar);
router.delete('/cars/:id', deleteAdminCar);

// Bookings
router.get('/bookings', getAdminBookings);
router.patch('/bookings/:id/status', updateAdminBookingStatus);

// Company profile (kept for backward compatibility)
router.get('/company', getCompanyProfile);
router.put('/company', uploadLogo.single('logo'), updateCompanyProfile);

// Admin Profile (NEW — personal admin profile, NOT company)
router.get('/profile', getAdminProfile);
router.put('/profile', uploadAvatar.single('avatar'), updateAdminProfile);
router.put('/profile/password', changeAdminPassword);

// Analytics
router.get('/analytics', getAnalytics);

// Audit
router.get('/audit-logs', getAuditLogs);
router.post('/audit/login-geo', logAdminGeoLogin);

// Reports (kept — can remove if you don't need reports anymore)
router.get('/reports/:type', downloadReport);

// Legal docs (admin)
router.get('/legal/terms', getTerms);
router.put('/legal/terms', updateTerms);

// Verifications
router.get('/verifications/users', listUsers);
router.get('/verifications/hosts', listHosts);
router.post('/verifications/:type/:id/:action', updateVerification);
router.post('/verifications/hosts/:id/payout-reference', savePayoutReference);

// KYC review
router.get('/verification/kyc/pending', listPendingKyc);
router.post('/verification/kyc/:id', reviewKyc);

// KYC routes
router.get('/kyc', getKycList);
router.post('/kyc/:id/approve', approveKyc);
router.post('/kyc/:id/reject', rejectKyc);

// Refunds — FIX: Added the missing GET route
router.get('/refunds/eligible', getEligibleRefunds);  // THIS WAS MISSING — caused "Failed to load refund data"
router.post('/refunds', processRefund);

// Invoices (NEW)
router.get('/invoices', listInvoices);
router.get('/invoices/:invoiceId', getInvoiceDetail);

export default router;