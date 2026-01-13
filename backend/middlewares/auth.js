import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/userModel.js'; // ensure correct relative path
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

export default async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers?.authorization || req.headers?.Authorization;
    if (!auth) {
      return res.status(401).json({ success: false, message: 'Authorization header missing' });
    }

    const parts = String(auth).split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ success: false, message: 'Invalid authorization format' });
    }

    const token = parts[1];
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid authentication token' });
    }

    // If payload already contains full user info (role/companyId), attach and continue
    if (payload && (payload.role || payload.companyId)) {
      req.user = payload;
      return next();
    }

    // Otherwise load the user from DB using id inside payload
    const userId = payload?.id || payload?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Invalid token payload' });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // Attach minimal normalized user object
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      companyId: user.companyId || null,
    };

    next();
  } catch (err) {
    console.error('Auth middleware unexpected error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}