import AuditLog from '../models/auditLogModel.js';

export const getAuditLogs = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const {
      page = 1,
      limit = 50,
      category,
      severity,
      userId: filterUserId,
      search,
      startDate,
      endDate,
    } = req.query;

    const filter = { companyId };

    // Category filter
    if (category && category !== 'all') {
      filter.category = category;
    }

    // Severity filter
    if (severity && severity !== 'all') {
      filter.severity = severity;
    }

    // User filter
    if (filterUserId) {
      filter.userId = filterUserId;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Text search on action/details
    if (search) {
      filter.$or = [
        { action: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    // Category summary for the filter bar
    const categoryCounts = await AuditLog.aggregate([
      { $match: { companyId } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    return res.json({
      success: true,
      logs: logs.map((l) => ({
        id: l._id,
        timestamp: l.createdAt,
        userId: l.userId,
        userName: l.userName || 'System',
        userEmail: l.userEmail || '',
        category: l.category,
        action: l.action,
        details: l.details,
        metadata: l.metadata || {},
        severity: l.severity,
        ip: l.ip,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
      categoryCounts: categoryCounts.reduce((acc, c) => {
        acc[c._id] = c.count;
        return acc;
      }, {}),
    });
  } catch (err) {
    console.error('getAuditLogs error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Called from admin Auth page (optional geo log)
export const logAdminGeoLogin = async (req, res) => {
  try {
    const companyId = req.user.companyId || null;
    const { lat, lng } = req.body || {};
    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name || '',
      userEmail: req.user.email || '',
      companyId,
      category: 'auth',
      action: 'admin_login_geo',
      details: `Admin login from IP ${req.ip}`,
      severity: 'info',
      ip: req.ip,
      userAgent: req.headers?.['user-agent'] || '',
      geo: { lat, lng },
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('logAdminGeoLogin error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};