import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import AuditLog from '../models/auditLogModel.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:7889';

// GET /api/admin/profile
export const getAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -processedWebhookEvents -notifications')
      .lean();
    if (!user) return res.status(404).json({ success: false, message: 'Admin user not found' });

    return res.json({
      success: true,
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        profilePicture: user.profilePicture || '',
        legalName: user.legalName || '',
        preferredName: user.preferredName || '',
        birthdate: user.birthdate || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        zipCode: user.zipCode || '',
        country: user.country || '',
        about: user.about || '',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error('getAdminProfile error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/admin/profile
export const updateAdminProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, legalName, preferredName, birthdate, address, city, state, zipCode, country, about } = req.body || {};

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Admin user not found' });

    const prev = { name: user.name, phone: user.phone };

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (legalName !== undefined) user.legalName = legalName;
    if (preferredName !== undefined) user.preferredName = preferredName;
    if (birthdate !== undefined) user.birthdate = birthdate;
    if (address !== undefined) user.address = address;
    if (city !== undefined) user.city = city;
    if (state !== undefined) user.state = state;
    if (zipCode !== undefined) user.zipCode = zipCode;
    if (country !== undefined) user.country = country;
    if (about !== undefined) user.about = about;

    // Handle profile picture upload (multer field name: 'avatar')
    if (req.file) {
      user.profilePicture = `${SERVER_URL.replace(/\/$/, '')}/uploads/admin-avatars/${req.file.filename}`;
    }

    await user.save();

    // Audit log
    try {
      await AuditLog.create({
        userId,
        userName: user.name,
        userEmail: user.email,
        companyId: req.user.companyId,
        category: 'auth',
        action: 'admin_profile_updated',
        details: `Admin updated their personal profile`,
        severity: 'info',
        metadata: { targetType: 'user', targetId: userId, previousValue: prev, newValue: { name: user.name, phone: user.phone } },
        ip: req.ip,
      });
    } catch (e) { /* audit log should not break the flow */ }

    return res.json({
      success: true,
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profilePicture: user.profilePicture,
        legalName: user.legalName,
        preferredName: user.preferredName,
        birthdate: user.birthdate,
        address: user.address,
        city: user.city,
        state: user.state,
        zipCode: user.zipCode,
        country: user.country,
        about: user.about,
      },
    });
  } catch (err) {
    console.error('updateAdminProfile error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/admin/profile/password
export const changeAdminPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Admin user not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Audit log
    try {
      await AuditLog.create({
        userId,
        userName: user.name,
        userEmail: user.email,
        companyId: req.user.companyId,
        category: 'auth',
        action: 'admin_password_changed',
        details: 'Admin changed their password',
        severity: 'critical',
        ip: req.ip,
      });
    } catch (e) { /* don't break flow */ }

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('changeAdminPassword error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};