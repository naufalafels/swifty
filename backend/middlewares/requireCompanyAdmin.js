export default function requireCompanyAdmin(req, res, next) {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Unauthorized' });

    if (user.role === 'company_admin' || user.role === 'superadmin') return next();
    return res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
  } catch (err) {
    console.error('requireCompanyAdmin error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}