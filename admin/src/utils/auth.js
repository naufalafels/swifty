// Admin auth helper - in-memory token + cookie-based refresh
// Replaces previous localStorage-based helpers.

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7889';

let accessToken = null;
let currentUser = null;
let refreshing = null;

export const saveAdminSession = (token, user) => {
  accessToken = token || null;
  currentUser = user || null;
};

export const clearAdminSession = () => {
  accessToken = null;
  currentUser = null;
};

export const getAdminToken = () => accessToken;
export const getAdminUser = () => currentUser;

/**
 * adminLogin: call admin login endpoint. Server should set refresh cookie (HttpOnly).
 */
export const adminLogin = async (credentials) => {
  const res = await axios.post(`${API_BASE}/api/admin/login`, credentials, { withCredentials: true });
  const data = res.data || {};
  accessToken = data?.accessToken || data?.token || null;
  currentUser = data?.user || null;
  return data;
};

export const adminRefresh = async () => {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/admin/refresh`, {}, { withCredentials: true });
      const data = res.data || {};
      accessToken = data?.accessToken || data?.token || null;
      currentUser = data?.user || null;
      return { ok: true, data };
    } catch (err) {
      accessToken = null;
      currentUser = null;
      return { ok: false, err };
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
};

export const adminLogout = async () => {
  try {
    await axios.post(`${API_BASE}/api/admin/logout`, {}, { withCredentials: true });
  } catch {}
  accessToken = null;
  currentUser = null;
};