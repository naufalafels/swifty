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
  getKycUploadUrls,  // ADD THIS
} from '../controllers/userController.js';
import authMiddleware from '../middlewares/auth.js';
// REMOVE: import { uploadKyc } from '../middlewares/uploadKyc.js';
import { loginLimiter } from '../middlewares/rateLimit.js';

const userRouter = express.Router();

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
userRouter.get('/kyc/upload-urls', authMiddleware, getKycUploadUrls);  // ADD THIS
userRouter.post('/kyc/submit', authMiddleware, submitKycMultipart);  // REMOVE uploadKyc.fields
userRouter.post('/kyc', authMiddleware, submitKyc);  // JSON submission
userRouter.get('/kyc', authMiddleware, getKyc);

// Protected: become host
userRouter.post('/host/onboard', authMiddleware, becomeHost);

// Protected: host fetch renter KYC by userId
userRouter.get('/host/kyc/:userId', authMiddleware, hostGetRenterKyc);

export default userRouter;