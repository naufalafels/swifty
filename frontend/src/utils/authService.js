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
    const refreshBeforeMs = 30 * 1000;
    let timeout = Math.max(2000, msUntilExp - refreshBeforeMs);
    if (msUntilExp <= 2000) timeout = 2000;

    if (refreshTimerId) {
      clearTimeout(refreshTimerId);
      refreshTimerId = null;
    }

    refreshTimerId = setTimeout(async () => {
      try {
        const r = await refresh();
        if (!(r && r.ok)) {
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
    // ignore
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

export const register = async (payload) => {
  const url = `${API_BASE}/api/auth/register`;
  const res = await axios.post(url, payload, {
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

export const refresh = async () => {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const url = `${API_BASE}/api/auth/refresh`;
      const res = await axios.post(url, {}, { withCredentials: true });
      const data = res.data || {};
      const token = data.accessToken || data.token || null;
      if (token) {
        setAccessToken(token);
        if (data.user) setCurrentUser(data.user);
      } else {
        clearLocalSession();
      }
      return { ok: true, data };
    } catch (err) {
      clearLocalSession();
      return { ok: false, err };
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
};

export const logout = async () => {
  try {
    const url = `${API_BASE}/api/auth/logout`;
    await axios.post(url, {}, { withCredentials: true });
  } catch {}
  clearLocalSession();
};

export const ensureAuth = async () => {
  if (accessToken && currentUser) return currentUser;
  const { ok, data } = await refresh();
  if (ok && data?.user && data?.accessToken) {
    return data.user;
  }
  return null;
};

function authHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* KYC + Host APIs */
export const submitKyc = async (payload) => {
  const url = `${API_BASE}/api/auth/kyc`;
  const res = await axios.post(url, payload, { headers: { ...authHeaders(), "Content-Type": "application/json" } });
  return res.data;
};

export const getKyc = async () => {
  const url = `${API_BASE}/api/auth/kyc`;
  const res = await axios.get(url, { headers: authHeaders() });
  return res.data;
};

export const becomeHost = async (payload) => {
  const url = `${API_BASE}/api/auth/host/onboard`;
  const res = await axios.post(url, payload, { headers: { ...authHeaders(), "Content-Type": "application/json" } });
  return res.data;
};

export const hostGetRenterKyc = async (userId) => {
  const url = `${API_BASE}/api/auth/host/kyc/${userId}`;
  const res = await axios.get(url, { headers: authHeaders() });
  return res.data;
};