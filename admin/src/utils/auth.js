// Admin auth helper - cookie-based token storage + scheduled refresh
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:7889";

let currentUser = null;
let refreshing = null;
let refreshTimerId = null;

/* Helpers */
function parseJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    // base64 decode payload (browser has atob)
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

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function scheduleRefreshFromToken(token) {
  try {
    if (!token) return;
    const payload = parseJwt(token);
    if (!payload || !payload.exp) return;
    // exp is in seconds since epoch
    const expMs = payload.exp * 1000;
    const now = Date.now();
    const msUntilExp = expMs - now;
    // refresh 30 seconds before expiry, but at least 2 seconds in future
    const refreshBeforeMs = 30 * 1000;
    let timeout = Math.max(2000, msUntilExp - refreshBeforeMs);
    if (msUntilExp <= 2000) timeout = 2000;

    if (refreshTimerId) {
      clearTimeout(refreshTimerId);
      refreshTimerId = null;
    }
    refreshTimerId = setTimeout(async () => {
      try {
        const r = await adminRefresh();
        if (!(r && r.ok)) {
          // failed refresh -> clear session
          currentUser = null;
          if (refreshTimerId) { clearTimeout(refreshTimerId); refreshTimerId = null; }
        }
      } catch {
        currentUser = null;
        if (refreshTimerId) { clearTimeout(refreshTimerId); refreshTimerId = null; }
      }
    }, timeout);
  } catch {
    // ignore
  }
}

export const saveAdminSession = (token, user) => {
  // Token is in cookies; just store user and schedule refresh
  currentUser = user || null;
  if (token) scheduleRefreshFromToken(token);
};

export const clearAdminSession = () => {
  currentUser = null;
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
};

export const getAdminToken = () => getCookie('adminToken');  // Read from cookies
export const getAdminUser = () => currentUser;

/* Auth API calls */
export const adminLogin = async (credentials) => {
  const res = await axios.post(`${API_BASE}/api/auth/login`, credentials, {
    withCredentials: true,  // Sends/receives cookies
    headers: { "Content-Type": "application/json" },
  });
  const data = res.data || {};
  // Token is now in cookie; read it for client-side scheduling
  const token = getCookie('adminToken') || data?.token;
  currentUser = data?.user || currentUser;
  if (token) scheduleRefreshFromToken(token);
  return data;
};

export const adminRegister = async (payload) => {
  const url = `${API_BASE}/api/admin/signup`;
  const res = await axios.post(url, payload, {
    withCredentials: true,
    headers: payload instanceof FormData ? {} : { "Content-Type": "application/json" },
  });
  const data = res.data || {};
  return data;
};

export const adminRefresh = async () => {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true });
      const data = res.data || {};
      const token = getCookie('adminToken') || data?.token;
      if (data?.user) currentUser = data.user;
      if (token) scheduleRefreshFromToken(token);
      return { ok: true, data };
    } catch (err) {
      currentUser = null;
      if (refreshTimerId) { clearTimeout(refreshTimerId); refreshTimerId = null; }
      return { ok: false, err };
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
};

export const ensureAuth = async () => {
  if (getAdminToken()) return true;
  const r = await adminRefresh();
  return !!(r && r.ok && getAdminToken());
};

export const adminLogout = async () => {
  try {
    await axios.post(`${API_BASE}/api/auth/logout`, {}, { withCredentials: true, timeout: 3000 });
  } catch (err) {
    // ignore
  } finally {
    currentUser = null;
    if (refreshTimerId) { clearTimeout(refreshTimerId); refreshTimerId = null; }
  }
};