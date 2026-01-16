// Admin auth helper - in-memory token + cookie-based refresh
// Provides:
//  - saveAdminSession(token, user) / clearAdminSession()
//  - getAdminToken(), getAdminUser()
//  - adminLogin(credentials), adminRegister(payload)
//  - adminRefresh(), adminLogout()
//  - ensureAuth() to try refresh if no access token present

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
 * adminLogin: call login endpoint. Server should set refresh cookie (HttpOnly).
 * Accepts credentials: { email, password }.
 * Returns server response object.
 */
export const adminLogin = async (credentials) => {
  const res = await axios.post(`${API_BASE}/api/auth/login`, credentials, {
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
  });
  const data = res.data || {};
  accessToken = data?.accessToken || data?.token || accessToken;
  currentUser = data?.user || currentUser;
  return data;
};

/**
 * adminRegister: create admin account (if your backend returns token & sets cookie).
 * If your admin signup endpoint is /api/admin/signup, call that instead.
 */
export const adminRegister = async (payload) => {
  // payload can be FormData for multipart signup (logo)
  const url = `${API_BASE}/api/admin/signup`;
  const res = await axios.post(url, payload, {
    withCredentials: true,
    headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : { 'Content-Type': 'application/json' },
  });
  const data = res.data || {};
  accessToken = data?.accessToken || data?.token || accessToken;
  currentUser = data?.user || currentUser;
  return data;
};

/**
 * adminRefresh(): call refresh endpoint to rotate/renew tokens.
 * Server should read refresh cookie and return new accessToken and optionally user.
 * De-duplicated so concurrent calls share same promise.
 */
export const adminRefresh = async () => {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true });
      const data = res.data || {};
      accessToken = data?.accessToken || data?.token || accessToken;
      if (data?.user) currentUser = data.user;
      return { ok: true, data };
    } catch (err) {
      // clear client session on refresh failure
      accessToken = null;
      currentUser = null;
      return { ok: false, err };
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
};

/**
 * ensureAuth(): if access token present return true; otherwise attempt refresh.
 */
export const ensureAuth = async () => {
  if (getAdminToken()) return true;
  const r = await adminRefresh();
  return !!(r && r.ok && getAdminToken());
};

/**
 * adminLogout(): call server to revoke refresh cookie and clear client memory
 */
export const adminLogout = async () => {
  try {
    await axios.post(`${API_BASE}/api/auth/logout`, {}, { withCredentials: true, timeout: 3000 });
  } catch (err) {
    // ignore
  } finally {
    accessToken = null;
    currentUser = null;
  }
};