// small client-side helper for admin app
export const saveAdminSession = (token, user) => {
  try {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', JSON.stringify(user));
  } catch (e) {}
};

export const clearAdminSession = () => {
  try {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  } catch (e) {}
};

export const getAdminToken = () => {
  try { return localStorage.getItem('admin_token'); } catch { return null; }
};

export const getAdminUser = () => {
  try { return JSON.parse(localStorage.getItem('admin_user') || 'null'); } catch { return null; }
};