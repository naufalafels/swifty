// central axios instance that automatically attaches the Bearer token from localStorage
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:7889";

const api = axios.create({
  baseURL: API_BASE,
  // If your app uses cookie-based auth, enable withCredentials:
  // withCredentials: true
});

// Inject Authorization header if token is present in localStorage
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem("token");
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

export default api;