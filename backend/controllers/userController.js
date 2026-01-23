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
const ACCESS_TOKEN_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 1);
const REFRESH_TOKEN_COOKIE_NAME = process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:7889';

function createAccessToken(userId, extra = {}) {
  return jwt.sign({ id: userId, ...extra }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
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

function setRefreshCookie(res, token, maxAgeSec) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeSec * 1000,
    path: '/',
  };
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, cookieOptions);
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/' });
}

function userResponse(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    roles: Array.isArray(user.roles) && user.roles.length ? user.roles : ['renter'],
    companyId: user.companyId || null,
    kyc: user.kyc || { status: 'not_submitted' },
    isHost: Array.isArray(user.roles) ? user.roles.includes('host') : false,
  };
}

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
      roles: ['renter'],
    });
    await user.save();

    const accessToken = createAccessToken(newId.toString());
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await saveRefreshToken({ token: refreshToken, userId: newId, expiresAt, createdByIp: req.ip || '' });
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

    const accessToken = createAccessToken(user._id.toString(), {
      role: user.role,
      companyId: user.companyId || null,
      roles: user.roles || ['renter'],
    });
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await saveRefreshToken({ token: refreshToken, userId: user._id, expiresAt, createdByIp: req.ip || '' });
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

export async function refresh(req, res) {
  try {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });

    const saved = await findRefreshTokenDoc(token);
    if (!saved) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    if (saved.revoked) {
      await revokeAllUserRefreshTokens(saved.userId);
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: 'Refresh token revoked. Please login again.' });
    }

    if (new Date(saved.expiresAt) < new Date()) {
      await revokeRefreshTokenByHash(saved.tokenHash);
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: 'Refresh token expired. Please login again.' });
    }

    const newToken = generateRefreshToken();
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await saveRefreshToken({ token: newToken, userId: saved.userId, expiresAt: newExpiresAt, createdByIp: req.ip || '' });
    await RefreshToken.findOneAndUpdate(
      { tokenHash: saved.tokenHash },
      { revoked: true, replacedByToken: hashToken(newToken), revokedByIp: req.ip || '' }
    ).exec();

    const accessToken = createAccessToken(saved.userId.toString());
    setRefreshCookie(res, newToken, REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60);
    const user = await User.findById(saved.userId).lean();
    return res.json({ success: true, accessToken, user: user ? userResponse(user) : null });
  } catch (err) {
    console.error('Refresh error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

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

/** Renter: submit KYC (NRIC/Passport only) */
export async function submitKyc(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const idType = String(req.body.idType || 'passport').toLowerCase();
    if (!['passport', 'nric'].includes(idType)) {
      return res.status(400).json({ success: false, message: 'idType must be passport or nric' });
    }

    const idNumber = String(req.body.idNumber || '').trim();
    const idCountry = String(req.body.idCountry || 'MY').trim() || 'MY';
    const frontImageUrl = String(req.body.frontImageUrl || '').trim();
    const backImageUrl = String(req.body.backImageUrl || '').trim();

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.kyc = {
      idType,
      idNumber,
      idCountry,
      frontImageUrl,
      backImageUrl,
      status: 'pending',
      statusReason: '',
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
    };

    await user.save();
    return res.json({ success: true, message: 'KYC submitted for host review', kyc: user.kyc });
  } catch (err) {
    console.error('submitKyc error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/** Renter: get own KYC */
export async function getKyc(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.json({ success: true, kyc: user.kyc || { status: 'not_submitted' } });
  } catch (err) {
    console.error('getKyc error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/** Become a host */
export async function becomeHost(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const payoutAccountRef = String(req.body.payoutAccountRef || '').trim();
    const notes = String(req.body.notes || '').trim();

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const roles = Array.isArray(user.roles) ? [...new Set([...user.roles, 'host'])] : ['host'];
    user.roles = roles;

    user.hostProfile = {
      payoutProvider: 'razorpay_curlec_my',
      payoutAccountRef,
      notes,
      onboardingCompletedAt: new Date(),
    };

    await user.save();

    return res.json({
      success: true,
      message: 'Host role enabled. You can now list cars; renter KYC will be shown to you for in-person validation.',
      user: userResponse(user),
    });
  } catch (err) {
    console.error('becomeHost error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/** Host: fetch renter KYC by userId (for in-person validation) */
export async function hostGetRenterKyc(req, res) {
  try {
    const hostRoles = req.user?.roles || [];
    const legacy = req.user?.role;
    const isHost = hostRoles.includes('host') || legacy === 'company_admin' || legacy === 'superadmin';
    if (!isHost) return res.status(403).json({ success: false, message: 'Forbidden' });

    const renterId = req.params?.userId;
    if (!renterId || !mongoose.Types.ObjectId.isValid(renterId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const renter = await User.findById(renterId).lean();
    if (!renter) return res.status(404).json({ success: false, message: 'User not found' });

    // Only return KYC metadata, not password, etc.
    return res.json({
      success: true,
      renter: {
        id: renter._id,
        name: renter.name,
        email: renter.email,
        kyc: renter.kyc || { status: 'not_submitted' },
      },
    });
  } catch (err) {
    console.error('hostGetRenterKyc error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}