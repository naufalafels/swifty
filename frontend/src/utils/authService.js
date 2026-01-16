// Central auth service (in-memory access token + refresh via HttpOnly cookie)
// - login() calls POST /api/auth/login with credentials (withCredentials:true).
// - refresh() calls POST /api/auth/refresh (expects server to read HttpOnly cookie).
// - logout() calls POST /api/auth/logout and clears in-memory tokens.
// - getAccessToken()/getCurrentUser() provide in-memory values for other modules.

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:7889";

// In-memory store (cleared on full page reload)
let accessToken = null;
let currentUser = null;
let refreshing = null; // Promise to de-duplicate concurrent refreshes

export const setAccessToken = (t) => {
  accessToken = t || null;
};

export const getAccessToken = () => accessToken;

export const setCurrentUser = (u) => {
  currentUser = u || null;
};

export const getCurrentUser = () => currentUser;

/**
 * login(credentials)
 * - POST /api/auth/login
 * - Server may set an HttpOnly refresh cookie.
 * - Server is expected to return { accessToken, user } or { token, user } or { user }.
 */
export const login = async (credentials) => {
  const url = `${API_BASE}/api/auth/login`;
  const res = await axios.post(url, credentials, { withCredentials: true, headers: { "Content-Type": "application/json" } });
  const data = res.data || {};
  const token = data.accessToken || data.token || null;
  const user = data.user || null;
  setAccessToken(token);
  setCurrentUser(user);
  return data;
};

/**
 * register (optional)
 * - POST /api/auth/register
 */
export const register = async (payload) => {
  const url = `${API_BASE}/api/auth/register`;
  const res = await axios.post(url, payload, { withCredentials: true, headers: { "Content-Type": "application/json" } });
  const data = res.data || {};
  const token = data.accessToken || data.token || null;
  const user = data.user || null;
  setAccessToken(token);
  setCurrentUser(user);
  return data;
};

/**
 * refresh()
 * - POST /api/auth/refresh
 * - Server should read refresh cookie and return new accessToken and optionally user
 * - This function is de-duplicated so multiple simultaneous calls share the same promise
 */
export const refresh = async () => {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const url = `${API_BASE}/api/auth/refresh`;
      const res = await axios.post(url, {}, { withCredentials: true });
      const data = res.data || {};
      const token = data.accessToken || data.token || null;
      const user = data.user || null;
      setAccessToken(token);
      if (user) setCurrentUser(user);
      return { ok: true, data };
    } catch (err) {
      // clear local memory state on refresh failure
      setAccessToken(null);
      setCurrentUser(null);
      return { ok: false, err };
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
};

/**
 * ensureAuth(): make sure access token is available, otherwise attempt refresh
 * returns boolean: true if access token is present or obtained, false otherwise
 */
export const ensureAuth = async () => {
  if (getAccessToken()) return true;
  const r = await refresh();
  return !!(r && r.ok && getAccessToken());
};

/**
 * logout()
 * - POST /api/auth/logout (server should clear HttpOnly refresh cookie and revoke tokens)
 * - Clear in-memory tokens regardless of server result
 */
export const logout = async () => {
  try {
    const url = `${API_BASE}/api/auth/logout`;
    await axios.post(url, {}, { withCredentials: true, timeout: 3000 });
  } catch (err) {
    // ignore network errors
  } finally {
    setAccessToken(null);
    setCurrentUser(null);
  }
};