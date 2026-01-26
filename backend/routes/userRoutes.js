import express from 'express';
import { login, register, refresh, logout, me, submitKyc, getKyc, becomeHost, hostGetRenterKyc } from '../controllers/userController.js';
import authMiddleware from '../middlewares/auth.js';

// Import login-specific rate limiter
import { loginLimiter } from '../middlewares/rateLimit.js';

const userRouter = express.Router();

// Public
// Apply the loginLimiter to the login route to limit brute-force attempts
userRouter.post('/login', loginLimiter, login);
userRouter.post('/register', register);

// Refresh and logout
userRouter.post('/refresh', refresh);
userRouter.post('/logout', logout);

// Protected: profile
userRouter.get('/me', authMiddleware, me);

// Protected: renter KYC
userRouter.post('/kyc', authMiddleware, submitKyc);
userRouter.get('/kyc', authMiddleware, getKyc);

// Protected: become host
userRouter.post('/host/onboard', authMiddleware, becomeHost);

// Protected: host fetch renter KYC by userId
userRouter.get('/host/kyc/:userId', authMiddleware, hostGetRenterKyc);

export default userRouter;