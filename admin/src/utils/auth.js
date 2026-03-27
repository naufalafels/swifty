// Admin auth helper - cookie-based token storage + in-memory fallback + scheduled refresh
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:7889";

let currentUser = null;
let refreshing = null;
let refreshTimerId = null;
let inMemoryToken = null;  // FIX: Fallback when cookie is blocked cross-origin

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
          inMemoryToken = null;  // FIX: Clear in-memory token too
          if (refreshTimerId) { clearTimeout(refreshTimerId); refreshTimerId = null; }
        }
      } catch {
        currentUser = null;
        inMemoryToken = null;  // FIX: Clear in-memory token too
        if (refreshTimerId) { clearTimeout(refreshTimerId); refreshTimerId = null; }
      }
    }, timeout);
  } catch {
    // ignore
  }
}

export const saveAdminSession = (token, user) => {
  // Store user and token (in-memory fallback)
  currentUser = user || null;
  inMemoryToken = token || null;  // FIX: Store in memory as fallback
  if (token) scheduleRefreshFromToken(token);
};

export const clearAdminSession = () => {
  currentUser = null;
  inMemoryToken = null;  // FIX: Clear in-memory token
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
};

// FIX: Try cookie first, fall back to in-memory token.
// The cookie may be blocked if admin SPA runs on a different origin than the API.
export const getAdminToken = () => getCookie('adminToken') || inMemoryToken;
export const getAdminUser = () => currentUser;

/* Auth API calls */
export const adminLogin = async (credentials) => {
  const res = await axios.post(`${API_BASE}/api/auth/login`, credentials, {
    withCredentials: true,  // Sends/receives cookies
    headers: { "Content-Type": "application/json" },
  });
  const data = res.data || {};
  // FIX: Read token from cookie OR response body (accessToken), store in memory as fallback
  const token = getCookie('adminToken') || data?.accessToken || data?.token;
  inMemoryToken = token || null;  // FIX: Always store in memory
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
  // FIX: Store token in memory from signup response
  const token = getCookie('adminToken') || data?.accessToken || data?.token;
  if (token) inMemoryToken = token;
  return data;
};

export const adminRefresh = async () => {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true });
      const data = res.data || {};
      // FIX: Read token from cookie OR response body, store in memory
      const token = getCookie('adminToken') || data?.accessToken || data?.token;
      inMemoryToken = token || null;  // FIX: Update in-memory token
      if (data?.user) currentUser = data.user;
      if (token) scheduleRefreshFromToken(token);
      return { ok: true, data };
    } catch (err) {
      currentUser = null;
      inMemoryToken = null;  // FIX: Clear in-memory token
      if (refreshTimerId) { clearTimeout(refreshTimerId); refreshTimerId = null; }
      return { ok: false, err };
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
};

export const ensureAuth = async () => {
  // FIX: getAdminToken() now checks cookie + in-memory fallback
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
    inMemoryToken = null;  // FIX: Clear in-memory token
    if (refreshTimerId) {
      clearTimeout(refreshTimerId);
      refreshTimerId = null;
    }
  }
};