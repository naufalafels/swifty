import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

// Verifies token and attaches req.user = { id, name, email, role, companyId }
export default async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers?.authorization || req.headers?.Authorization;
    if (!auth) return res.status(401).json({ success: false, message: 'Authorization header missing' });

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

    // If token already contains role/companyId, attach
    if (payload && (payload.role || payload.companyId)) {
      req.user = {
        id: payload.id || payload._id,
        name: payload.name || null,
        email: payload.email || null,
        role: payload.role || 'user',
        companyId: payload.companyId || null
      };
      return next();
    }

    // Otherwise load user from DB to get latest role/companyId
    const userId = payload?.id || payload?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Invalid token payload' });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      companyId: user.companyId || null
    };

    return next();
  } catch (err) {
    console.error('Auth middleware error', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}