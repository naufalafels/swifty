import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import crypto from 'crypto';
import User from '../models/userModel.js';
import RefreshToken from '../models/refreshTokenModel.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const ACCESS_TOKEN_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || '15m'; // short lived
const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7); // days
const REFRESH_TOKEN_COOKIE_NAME = process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:7889';

function createAccessToken(userId, extra = {}) {
  return jwt.sign({ id: userId, ...extra }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex'); // opaque token
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function saveRefreshToken({ token, userId, expiresAt, createdByIp }) {
  const tokenHash = hashToken(token);
  const doc = new RefreshToken({
    tokenHash,
    userId,
    expiresAt,
    createdByIp: createdByIp || '',
    revoked: false,
  });
  await doc.save();
  return doc;
}

async function revokeRefreshTokenByHash(tokenHash, revokedByIp = '') {
  await RefreshToken.findOneAndUpdate({ tokenHash }, { revoked: true, revokedByIp }, { new: true }).exec();
}

async function revokeAllUserRefreshTokens(userId) {
  await RefreshToken.updateMany({ userId }, { revoked: true }).exec();
}

async function findRefreshTokenDoc(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const doc = await RefreshToken.findOne({ tokenHash }).lean();
  return doc || null;
}

/**
 * Set refresh cookie in response
 */
function setRefreshCookie(res, token, maxAgeSec) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeSec * 1000,
    path: '/', // allow refresh calls from any path under same origin
  };
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, cookieOptions);
}

/**
 * Clear refresh cookie
 */
function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/' });
}

/**
 * Helper to build user response object
 */
function userResponse(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId || null,
  };
}

/**
 * REGISTER
 */
export async function register(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    const emailRaw = String(req.body.email || "").trim();
    const email = validator.normalizeEmail(emailRaw) || emailRaw.toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const exists = await User.findOne({ email }).lean();
    if (exists) {
      return res.status(409).json({ success: false, message: 'User already exists.' });
    }

    const newId = new mongoose.Types.ObjectId();
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      _id: newId,
      name,
      email,
      password: hashedPassword,
    });
    await user.save();

    // Issue tokens: access token + refresh cookie
    const accessToken = createAccessToken(newId.toString());
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await saveRefreshToken({ token: refreshToken, userId: newId, expiresAt, createdByIp: req.ip || '' });

    // set cookie
    setRefreshCookie(res, refreshToken, REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60);

    return res.status(201).json({
      success: true,
      message: 'Account has been created successfully!',
      accessToken,
      user: userResponse(user),
    });
  } catch (err) {
    console.error('Registering Error', err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'User already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Server Error!' });
  }
}

/**
 * LOGIN
 */
export async function login(req, res) {
  try {
    const emailRaw = String(req.body.email || "").trim();
    const email = validator.normalizeEmail(emailRaw) || emailRaw.toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email!' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid password!' });

    const accessToken = createAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await saveRefreshToken({ token: refreshToken, userId: user._id, expiresAt, createdByIp: req.ip || '' });

    // set HttpOnly cookie with refresh token
    setRefreshCookie(res, refreshToken, REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60);

    return res.status(200).json({
      success: true,
      message: 'Login Successfully!',
      accessToken,
      user: userResponse(user),
    });
  } catch (err) {
    console.error('Login Error!', err);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
}

/**
 * REFRESH
 * Rotates refresh tokens. Expects client to send cookie named REFRESH_TOKEN_COOKIE_NAME.
 */
export async function refresh(req, res) {
  try {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });

    const saved = await findRefreshTokenDoc(token);
    if (!saved) {
      // token not found => possible reuse or invalid token
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    // check expiry & revocation
    if (saved.revoked) {
      // token reuse detected: revoke all tokens for user and require login
      await revokeAllUserRefreshTokens(saved.userId);
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: 'Refresh token revoked. Please login again.' });
    }

    if (new Date(saved.expiresAt) < new Date()) {
      await revokeRefreshTokenByHash(saved.tokenHash);
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: 'Refresh token expired. Please login again.' });
    }

    // Rotate: create new refresh token, mark old as revoked & replacedByToken
    const newToken = generateRefreshToken();
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await saveRefreshToken({ token: newToken, userId: saved.userId, expiresAt: newExpiresAt, createdByIp: req.ip || '' });

    // mark old as revoked and point to new
    await RefreshToken.findOneAndUpdate({ tokenHash: saved.tokenHash }, { revoked: true, replacedByToken: hashToken(newToken), revokedByIp: req.ip || '' }).exec();

    // issue new access token
    const accessToken = createAccessToken(saved.userId.toString());

    // set new cookie
    setRefreshCookie(res, newToken, REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60);

    // optionally return user profile
    const user = await User.findById(saved.userId).lean();
    return res.json({ success: true, accessToken, user: user ? userResponse(user) : null });
  } catch (err) {
    console.error('Refresh error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * LOGOUT
 * Revokes refresh token in cookie (if any) and clears cookie.
 */
export async function logout(req, res) {
  try {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (token) {
      const saved = await findRefreshTokenDoc(token);
      if (saved) {
        await revokeRefreshTokenByHash(saved.tokenHash, req.ip || '');
      }
    }
    clearRefreshCookie(res);
    return res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    console.error('Logout error', err);
    clearRefreshCookie(res);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * ME endpoint (protected)
 * Returns current user's profile. auth middleware attaches req.user.
 */
export async function me(req, res) {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, user: userResponse(user) });
  } catch (err) {
    console.error('Me error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}