import express from 'express';
import {
  login,
  register,
  refresh,
  logout,
  me,
  submitKycMultipart,
  submitKyc,
  getKyc,
  becomeHost,
  hostGetRenterKyc,
  updateProfile,
  verifyPassword,
  getKycUploadUrls,
  approveHost,  // NEW
  rejectHost,   // NEW
  approveKyc,   // Keep for KYC
  rejectKyc,    // Keep for KYC
} from '../controllers/userController.js';
import authMiddleware from '../middlewares/auth.js';
import { loginLimiter } from '../middlewares/rateLimit.js';
import multer from 'multer';

const userRouter = express.Router();

// Multer for vehicle image
const vehicleUpload = multer({
  dest: 'uploads/car-images/',  // Match buildCarImageUrl
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Public
userRouter.post('/login', loginLimiter, login);
userRouter.post('/register', register);

// Refresh and logout
userRouter.post('/refresh', refresh);
userRouter.post('/logout', logout);

// Protected: profile
userRouter.get('/me', authMiddleware, me);
userRouter.post('/verify-password', authMiddleware, verifyPassword);
userRouter.put('/update-profile', authMiddleware, updateProfile);

// Protected: renter KYC
userRouter.get('/kyc/upload-urls', authMiddleware, getKycUploadUrls);
userRouter.post('/kyc/submit', authMiddleware, submitKycMultipart);
userRouter.post('/kyc', authMiddleware, submitKyc);
userRouter.get('/kyc', authMiddleware, getKyc);

// Protected: become host
userRouter.post('/host/onboard', authMiddleware, vehicleUpload.single('vehicleImage'), becomeHost);

// Protected: host fetch renter KYC by userId
userRouter.get('/host/kyc/:userId', authMiddleware, hostGetRenterKyc);

// NEW: Admin host approval/rejection (separate from KYC)
userRouter.post('/host/:id/approve', authMiddleware, approveHost);
userRouter.post('/host/:id/reject', authMiddleware, rejectHost);

// Keep KYC approve/reject for users
userRouter.post('/kyc/:id/approve', authMiddleware, approveKyc);
userRouter.post('/kyc/:id/reject', authMiddleware, rejectKyc);

export default userRouter;