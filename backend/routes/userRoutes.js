import express from 'express';
import { login, register, refresh, logout, me } from '../controllers/userController.js';
import authMiddleware from '../middlewares/auth.js';

const userRouter = express.Router();

// Public
userRouter.post('/login', login);
userRouter.post('/register', register);

// Refresh and logout (works with HttpOnly cookie)
userRouter.post('/refresh', refresh);
userRouter.post('/logout', logout);

// Protected: get current user profile
userRouter.get('/me', authMiddleware, me);

export default userRouter;