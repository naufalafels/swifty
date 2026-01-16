import axios from "axios";
import { getAdminToken, adminRefresh } from "./auth.js";

// API base
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:7889";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // important so refresh/logout cookies are sent to server
  headers: { Accept: "application/json" },
});

// Attach access token from in-memory auth helper
api.interceptors.request.use(
  (config) => {
    try {
      const token = getAdminToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // swallow
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// Response interceptor: attempt refresh on 401 and retry once
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    // Prevent infinite loop: mark retry and allow single retry
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshResult = await adminRefresh();
        if (refreshResult && refreshResult.ok) {
          // adminRefresh updates in-memory token; retry the original request
          return api(originalRequest);
        }
      } catch (e) {
        // fallthrough to reject below
      }
    }
    return Promise.reject(error);
  }
);

export default api;