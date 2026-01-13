// Protects admin routes: user must be authenticated and a company_admin (or superadmin)
export default function requireCompanyAdmin(req, res, next) {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // role check: allow superadmin too
    const role = user.role || user.roles || '';
    if (role === 'company_admin' || role === 'superadmin') return next();

    return res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
  } catch (err) {
    console.error('requireCompanyAdmin middleware error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}