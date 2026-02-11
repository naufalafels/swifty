import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import crypto from 'crypto';
import User from '../models/userModel.js';
import RefreshToken from '../models/refreshTokenModel.js';
import { generateUploadUrl, generateDownloadUrl } from '../services/s3Service.js';  // NEW: S3 service
import { encrypt } from '../services/cryptoService.js';  // NEW: Crypto service
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const ACCESS_TOKEN_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 1);
const REFRESH_TOKEN_COOKIE_NAME = process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken';
const SERVER_URL = (process.env.SERVER_URL || 'http://localhost:7889').replace(/\/$/, '');

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

// NEW: Set admin token cookie for admin users
function setAdminTokenCookie(res, token) {
  const cookieOptions = {
    httpOnly: false,  // Allow SPA to read for Authorization headers
    secure: process.env.NODE_ENV === 'production',  // HTTPS only
    sameSite: 'strict',  // CSRF protection
    maxAge: 15 * 60 * 1000,  // 15 minutes (match access token)
    path: '/',
  };
  res.cookie('adminToken', token, cookieOptions);
}

function clearAdminTokenCookie(res) {
  res.clearCookie('adminToken', { path: '/' });
}

function buildKycUrl(fileName) {
  if (!fileName) return '';
  return `${SERVER_URL}/uploads/kyc/${fileName}`;  // Keep for legacy, but will be replaced
}

// NEW: Build signed URL for S3 key
async function buildSignedKycUrl(s3Key) {
  if (!s3Key) return '';
  return await generateDownloadUrl(s3Key);
}

function userResponse(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    roles: Array.isArray(user.roles) && user.roles.length ? user.roles : ['renter'],
    companyId: user.companyId || null,
    isHost: Array.isArray(user.roles) ? user.roles.includes('host') : false,
    legalName: user.legalName || '',
    preferredName: user.preferredName || '',
    birthdate: user.birthdate || '',
    phone: user.phone || '',
    address: user.address || '',
    mailingAddress: user.mailingAddress || '',
    city: user.city || '',
    country: user.country || '',
    about: user.about || '',
    privacy: user.privacy || { showCity: true, showAbout: true },
    kyc: user.kyc || { status: 'not_submitted' },
    createdAt: user.createdAt,
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

    // NEW: Set admin token cookie if user is admin
    if (user.role === 'company_admin') {
      setAdminTokenCookie(res, accessToken);
    }

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
      clearAdminTokenCookie(res);  // NEW: Clear admin cookie on revoke
      return res.status(401).json({ success: false, message: 'Refresh token revoked. Please login again.' });
    }

    if (new Date(saved.expiresAt) < new Date()) {
      await revokeRefreshTokenByHash(saved.tokenHash);
      clearRefreshCookie(res);
      clearAdminTokenCookie(res);  // NEW: Clear admin cookie on expiry
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
    // NEW: Set admin token cookie if user is admin
    if (user && user.role === 'company_admin') {
      setAdminTokenCookie(res, accessToken);
    }

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
    clearAdminTokenCookie(res);  // NEW: Clear admin cookie on logout
    return res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    console.error('Logout error', err);
    clearRefreshCookie(res);
    clearAdminTokenCookie(res);  // NEW: Clear admin cookie on error
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

// Verify password before sensitive edits
export async function verifyPassword(req, res) {
  try {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ success: false, message: 'Password required' });

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid password' });

    return res.json({ success: true });
  } catch (err) {
    console.error('verifyPassword error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Update profile (personal info, about, privacy)
export async function updateProfile(req, res) {
  try {
    const {
      legalName,
      preferredName,
      birthdate,
      phone,
      email,
      address,
      mailingAddress,
      sameMailing,
      city,
      country,
      about,
      privacy,
    } = req.body || {};

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (email && email !== user.email) {
      if (!validator.isEmail(email)) return res.status(400).json({ success: false, message: 'Invalid email' });
      user.email = validator.normalizeEmail(email) || email.toLowerCase();
    }

    if (legalName !== undefined) user.legalName = String(legalName).trim();
    if (preferredName !== undefined) user.preferredName = String(preferredName).trim();
    if (birthdate !== undefined) user.birthdate = birthdate;
    if (phone !== undefined) user.phone = String(phone).trim();
    if (address !== undefined) user.address = String(address).trim();
    if (mailingAddress !== undefined) {
      user.mailingAddress = sameMailing ? String(address || '') : String(mailingAddress || '');
    }
    if (city !== undefined) user.city = String(city).trim();
    if (country !== undefined) user.country = String(country).trim();
    if (about !== undefined) user.about = String(about);
    
    if (privacy && typeof privacy === 'object') {
      user.privacy = {
        showCity: privacy.showCity !== undefined ? !!privacy.showCity : user.privacy?.showCity ?? true,
        showAbout: privacy.showAbout !== undefined ? !!privacy.showAbout : user.privacy?.showAbout ?? true,
      };
    }

    await user.save();
    return res.json({ success: true, user: userResponse(user) });
  } catch (err) {
    console.error('updateProfile error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// UPDATED: submitKycMultipart - Accept keys in body, backKey optional
export async function submitKycMultipart(req, res) {
  try {
    const { idType = 'passport', idNumber = '', idCountry = 'MY', frontKey, backKey } = req.body || {};
    if (!idNumber.trim()) return res.status(400).json({ success: false, message: 'idNumber required' });
    if (!frontKey) return res.status(400).json({ success: false, message: 'frontKey required' });
    // backKey is optional

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const encryptedIdNumber = encrypt(idNumber.trim());

    user.kyc = {
      ...(user.kyc || {}),
      idType: String(idType).toLowerCase(),
      idNumber: encryptedIdNumber,
      idCountry: idCountry || 'MY',
      frontImageUrl: frontKey,
      backImageUrl: backKey || '',
      status: 'pending',
      statusReason: '',
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
    };

    await user.save();
    console.log('User saved successfully');

    return res.json({ success: true, kyc: user.kyc });
  } catch (err) {
    console.error('submitKycMultipart error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Renter: submit KYC (JSON, no files - for KycPage.jsx)
export async function submitKyc(req, res) {
  try {
    const { idType = 'passport', idNumber = '', idCountry = 'MY', frontImageUrl = '', backImageUrl = '' } = req.body || {};
    if (!idNumber.trim()) return res.status(400).json({ success: false, message: 'idNumber required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.kyc = {
      ...(user.kyc || {}),
      idType: String(idType).toLowerCase(),
      idNumber: idNumber.trim(),
      idCountry: idCountry || 'MY',
      frontImageUrl: frontImageUrl.trim(),
      backImageUrl: backImageUrl.trim(),
      status: 'pending',
      statusReason: '',
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
    };

    await user.save();
    return res.json({ success: true, message: 'KYC submitted', kyc: user.kyc });
  } catch (err) {
    console.error('submitKyc error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// UPDATED: getKyc - Return signed URLs
export async function getKyc(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const kyc = user.kyc || { status: 'not_submitted' };
    // NEW: Generate signed URLs for images
    if (kyc.frontImageUrl) kyc.frontImageUrl = await buildSignedKycUrl(kyc.frontImageUrl);
    if (kyc.backImageUrl) kyc.backImageUrl = await buildSignedKycUrl(kyc.backImageUrl);

    return res.json({ success: true, kyc });
  } catch (err) {
    console.error('getKyc error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function getKycUploadUrls(req, res) {
  try {
    const userId = req.user.id;
    console.log('Generating URLs for user:', userId);
    const frontKey = `kyc/${userId}/front-${Date.now()}.jpg`;
    const backKey = `kyc/${userId}/back-${Date.now()}.jpg`;
    console.log('Front key:', frontKey);
    console.log('Back key:', backKey);

    const urls = {
      front: await generateUploadUrl(frontKey, 'image/jpeg'),
      back: await generateUploadUrl(backKey, 'image/jpeg'),
    };
    console.log('URLs generated successfully');

    const keys = {
      front: frontKey,
      back: backKey,
    };

    res.json({ urls, keys });
  } catch (err) {
    console.error('Error generating upload URLs:', err);
    res.status(500).json({ message: 'Failed to generate upload URLs' });
  }
}

// Become a host
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

// UPDATED: hostGetRenterKyc - Return signed URLs
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

    const kyc = renter.kyc || { status: 'not_submitted' };
    // NEW: Generate signed URLs
    if (kyc.frontImageUrl) kyc.frontImageUrl = await buildSignedKycUrl(kyc.frontImageUrl);
    if (kyc.backImageUrl) kyc.backImageUrl = await buildSignedKycUrl(kyc.backImageUrl);

    return res.json({
      success: true,
      renter: {
        id: renter._id,
        name: renter.name,
        email: renter.email,
        kyc,
      },
    });
  } catch (err) {
    console.error('hostGetRenterKyc error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}