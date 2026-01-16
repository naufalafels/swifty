// frontend/src/utils/authService.js
// In-memory auth helper with scheduled refresh for the client app.

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:7889";

let accessToken = null;
let currentUser = null;
let refreshing = null;
let refreshTimerId = null;

/* Utility: parse JWT payload in browser */
function parseJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      Array.prototype.map
        .call(atob(payload), (c) => {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/* Schedule a refresh based on token expiry (refresh 30s before exp) */
function scheduleRefreshFromToken(token) {
  try {
    if (!token) return;
    const payload = parseJwt(token);
    if (!payload || !payload.exp) return;
    const expMs = payload.exp * 1000;
    const now = Date.now();
    const msUntilExp = expMs - now;
    const refreshBeforeMs = 30 * 1000; // refresh 30s before expiry
    let timeout = Math.max(2000, msUntilExp - refreshBeforeMs);
    if (msUntilExp <= 2000) timeout = 2000;

    // clear any existing timer
    if (refreshTimerId) {
      clearTimeout(refreshTimerId);
      refreshTimerId = null;
    }

    refreshTimerId = setTimeout(async () => {
      try {
        const r = await refresh();
        if (!(r && r.ok)) {
          // failed refresh -> clear session
          accessToken = null;
          currentUser = null;
          if (refreshTimerId) { clearTimeout(refreshTimerId); refreshTimerId = null; }
        }
      } catch {
        accessToken = null;
        currentUser = null;
        if (refreshTimerId) { clearTimeout(refreshTimerId); refreshTimerId = null; }
      }
    }, timeout);
  } catch {
    // ignore scheduling errors
  }
}

/* Public helpers */
export const setAccessToken = (t) => {
  accessToken = t || null;
  if (accessToken) scheduleRefreshFromToken(accessToken);
};

export const getAccessToken = () => accessToken;

export const setCurrentUser = (u) => {
  currentUser = u || null;
};

export const getCurrentUser = () => currentUser;

export const clearLocalSession = () => {
  accessToken = null;
  currentUser = null;
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
};

/* Auth API calls */

/**
 * login(credentials)
 * - POST /api/auth/login
 * - Server sets HttpOnly refresh cookie and returns access token + user
 */
export const login = async (credentials) => {
  const url = `${API_BASE}/api/auth/login`;
  const res = await axios.post(url, credentials, {
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
  });
  const data = res.data || {};
  const token = data.accessToken || data.token || null;
  const user = data.user || null;
  setAccessToken(token);
  setCurrentUser(user);
  return data;
};

/**
 * register(payload)
 * - POST /api/auth/register (if you use a different route adjust accordingly)
 */
export const register = async (payload, isFormData = false) => {
  const url = `${API_BASE}/api/auth/register`;
  const res = await axios.post(url, payload, {
    withCredentials: true,
    headers: isFormData ? {} : { "Content-Type": "application/json" },
  });
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
 * - De-duplicated so parallel calls share same promise
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
      clearLocalSession();
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
    clearLocalSession();
  }
};