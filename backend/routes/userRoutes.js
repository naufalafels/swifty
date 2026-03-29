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
  approveHost,
  rejectHost,
  approveKyc,
  rejectKyc,
  googleSignIn,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} from '../controllers/userController.js';
import authMiddleware from '../middlewares/auth.js';
import { loginLimiter } from '../middlewares/rateLimit.js';
import multer from 'multer';

const userRouter = express.Router();

// Multer for vehicle image
const vehicleUpload = multer({
  dest: 'uploads/car-images/',
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Public
userRouter.post('/login', loginLimiter, login);
userRouter.post('/register', register);
userRouter.post('/google', googleSignIn);            // Google Sign-In
userRouter.get('/verify-email', verifyEmail);         // Email verification
userRouter.post('/forgot-password', forgotPassword);
userRouter.post('/reset-password', resetPassword);

// Refresh and logout
userRouter.post('/refresh', refresh);
userRouter.post('/logout', logout);

// Protected: profile
userRouter.get('/me', authMiddleware, me);
userRouter.post('/verify-password', authMiddleware, verifyPassword);
userRouter.put('/update-profile', authMiddleware, updateProfile);
userRouter.post('/resend-verification', authMiddleware, resendVerification);

// Protected: renter KYC
userRouter.get('/kyc/upload-urls', authMiddleware, getKycUploadUrls);
userRouter.post('/kyc/submit', authMiddleware, submitKycMultipart);
userRouter.post('/kyc', authMiddleware, submitKyc);
userRouter.get('/kyc', authMiddleware, getKyc);

// Protected: become host
userRouter.post('/host/onboard', authMiddleware, vehicleUpload.single('vehicleImage'), becomeHost);

// Protected: host fetch renter KYC by userId
userRouter.get('/host/kyc/:userId', authMiddleware, hostGetRenterKyc);

// Admin host approval/rejection
userRouter.post('/host/:id/approve', authMiddleware, approveHost);
userRouter.post('/host/:id/reject', authMiddleware, rejectHost);

// KYC approve/reject
userRouter.post('/kyc/:id/approve', authMiddleware, approveKyc);
userRouter.post('/kyc/:id/reject', authMiddleware, rejectKyc);

export default userRouter;