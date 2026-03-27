export default function requireCompanyAdmin(req, res, next) {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // FIX: superadmin has full platform access — they don't need a companyId.
    // company_admin and host see only their own company data (enforced in controllers).
    if (user.role === 'superadmin') return next();
    if (user.role === 'company_admin' || user.role === 'host') return next();

    return res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
  } catch (err) {
    console.error('requireCompanyAdmin error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}