export const saveAdminSession = (token, user) => {
  try {
    // Save token and user to both admin-specific keys and general keys so admin login
    // works regardless of whether backend/frontend uses 'token' or 'admin_token'.
    if (token) {
      localStorage.setItem('admin_token', token);
      localStorage.setItem('token', token);
    }
    if (user) {
      localStorage.setItem('admin_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
    }
  } catch (e) {}
};

export const clearAdminSession = () => {
  try {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('user');
  } catch (e) {}
};

export const getAdminToken = () => {
  try {
    // prefer admin_token but fall back to generic token if present
    const t1 = localStorage.getItem('admin_token');
    if (t1) return t1;
    return localStorage.getItem('token');
  } catch {
    return null;
  }
};

export const getAdminUser = () => {
  try {
    const raw = localStorage.getItem('admin_user') || localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};