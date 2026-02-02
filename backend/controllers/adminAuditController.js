import AuditLog from '../models/auditLogModel.js';

export const getAuditLogs = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const logs = await AuditLog.find({ companyId })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    return res.json(
      logs.map((l) => ({
        id: l._id,
        timestamp: l.createdAt,
        user: l.userId || 'system',
        action: l.action,
        details: l.details,
      }))
    );
  } catch (err) {
    console.error('getAuditLogs error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Optional geo login log called from admin Auth page
export const logAdminGeoLogin = async (req, res) => {
  try {
    const companyId = req.user.companyId || null;
    const { lat, lng } = req.body || {};
    await AuditLog.create({
      userId: req.user.id,
      companyId,
      action: 'admin_login_geo',
      details: 'Admin login with geo coordinates',
      ip: req.ip,
      geo: { lat, lng },
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('logAdminGeoLogin error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};