import express from 'express';
import {
  login,
  register,
  refresh,
  logout,
  me,
  submitKycMultipart,
  getKyc,
  becomeHost,
  hostGetRenterKyc,
  updateProfile,
  verifyPassword,
} from '../controllers/userController.js';
import authMiddleware from '../middlewares/auth.js';
import { uploadKyc } from '../middlewares/uploadKyc.js';
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

// Protected: renter KYC (multipart, matches frontend /api/kyc/submit)
userRouter.post(
  '/kyc/submit',
  authMiddleware,
  uploadKyc.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 },
  ]),
  submitKycMultipart
);
userRouter.get('/kyc', authMiddleware, getKyc);

// Protected: become host
userRouter.post('/host/onboard', authMiddleware, becomeHost);

// Protected: host fetch renter KYC by userId
userRouter.get('/host/kyc/:userId', authMiddleware, hostGetRenterKyc);

export default userRouter;