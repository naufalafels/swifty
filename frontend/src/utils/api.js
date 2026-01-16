// central axios instance that automatically attaches the in-memory Bearer token
// and attempts refresh-on-401. Uses authService for token storage and refresh.

import axios from "axios";
import * as authService from "./authService";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:7889";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // include cookies for refresh endpoint
});

// Attach current access token from authService
api.interceptors.request.use(
  (config) => {
    try {
      const token = authService.getAccessToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      // ignore
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// Response interceptor to handle 401 -> attempt refresh and retry once
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    if (!originalRequest) return Promise.reject(error);

    // Do not attempt refresh for refresh endpoint itself to avoid loops
    if (originalRequest.url && originalRequest.url.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    // avoid infinite loop: mark requests already retried
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshed = await authService.refresh();
        if (refreshed && refreshed.ok && authService.getAccessToken()) {
          // update the Authorization header and retry
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${authService.getAccessToken()}`;
          return api(originalRequest);
        }
      } catch (err) {
        // fall through to reject
      }
    }
    return Promise.reject(error);
  }
);

export default api;