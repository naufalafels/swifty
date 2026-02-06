import User from '../models/userModel.js';

const baseProjection = { password: 0, refreshTokens: 0 };

const formatUser = (u) => ({
  id: u._id,
  fullName: u.fullName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
  email: u.email,
  phone: u.phone,
  idNumber: u.kyc?.idNumber || u.idNumber || u.documentId,
  kycStatus: u.kyc?.status || u.verificationStatus || 'pending',
  payoutReference: u.payoutReference || '',
  documents: u.documents || [],
  kyc: u.kyc || {},
});

export const listUsers = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const users = await User.find({ companyId, role: { $in: ['user', 'customer'] } }, baseProjection).limit(500).lean();
    return res.json(users.map(formatUser));
  } catch (err) {
    console.error('listUsers error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const listHosts = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const hosts = await User.find({ companyId, role: { $in: ['host', 'owner'] } }, baseProjection).limit(500).lean();
    return res.json(hosts.map(formatUser));
  } catch (err) {
    console.error('listHosts error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateVerification = async (req, res) => {
  try {
    const { type, id, action } = req.params;
    const companyId = req.user.companyId;
    const roleFilter = type === 'hosts' ? ['host', 'owner'] : ['user', 'customer'];

    const user = await User.findOne({ _id: id, companyId, role: { $in: roleFilter } });
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });

    const nextStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : null;
    if (!nextStatus) return res.status(400).json({ success: false, message: 'Invalid action' });

    // For KYC-backed flow, prefer kyc.status; keep legacy verificationStatus for compatibility
    user.kyc = {
      ...(user.kyc || {}),
      status: nextStatus,
      statusReason: req.body?.reason || user.kyc?.statusReason || '',
      reviewedAt: new Date(),
      reviewedBy: req.user.id,
    };
    user.verificationStatus = nextStatus;

    await user.save();

    return res.json({ success: true, status: nextStatus });
  } catch (err) {
    console.error('updateVerification error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const savePayoutReference = async (req, res) => {
  try {
    const { id } = req.params;
    const { payoutReference } = req.body || {};
    if (!payoutReference) return res.status(400).json({ success: false, message: 'payoutReference required' });

    const companyId = req.user.companyId;
    const user = await User.findOne({ _id: id, companyId, role: { $in: ['host', 'owner'] } });
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });

    user.payoutReference = payoutReference;
    await user.save();

    return res.json({ success: true });
  } catch (err) {
    console.error('savePayoutReference error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// List pending KYC for admin review
export const listPendingKyc = async (req, res) => {
  try {
    const users = await User.find(
      { companyId: req.user.companyId, 'kyc.status': { $in: ['pending'] } },
      baseProjection
    )
      .limit(200)
      .lean();
    return res.json({ success: true, users: users.map(formatUser) });
  } catch (err) {
    console.error('listPendingKyc error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Approve/reject a KYC
export const reviewKyc = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body || {};
    const nextStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : null;
    if (!nextStatus) return res.status(400).json({ success: false, message: 'Invalid action' });

    const user = await User.findOne({ _id: id, companyId: req.user.companyId });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.kyc = {
      ...(user.kyc || {}),
      status: nextStatus,
      statusReason: reason || '',
      reviewedAt: new Date(),
      reviewedBy: req.user.id,
    };
    user.verificationStatus = nextStatus;

    await user.save();
    return res.json({ success: true, status: nextStatus });
  } catch (err) {
    console.error('reviewKyc error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};