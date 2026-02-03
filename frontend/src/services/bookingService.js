import api from "../utils/api";
import * as authService from "../utils/authService";

/**
 * fetchMyBookings(options)
 * options: { signal } optional AbortController.signal
 * returns an array (backend currently returns array from getMyBookings)
 */
export async function fetchMyBookings(options = {}) {
  await authService.ensureAuth(); // ensure token before calling protected endpoint
  const res = await api.get("/api/bookings/mybooking", { signal: options.signal });
  return res.data;
}

/**
 * createBooking(payload, isFormData = false)
 * - payload: JSON object or FormData (if isFormData true)
 */
export async function createBooking(payload, isFormData = false) {
  if (isFormData) {
    const res = await api.post("/api/bookings", payload);
    return res.data;
  } else {
    const res = await api.post("/api/bookings", payload, {
      headers: { "Content-Type": "application/json" },
    });
    return res.data;
  }
}

/**
 * cancelBooking(bookingId)
 * Ensure a fresh access token (refresh-on-demand) before hitting the protected endpoint.
 */
export async function cancelBooking(bookingId) {
  await authService.ensureAuth(); // refresh token if needed; api will attach it
  const res = await api.patch(`/api/bookings/${bookingId}/status`, { status: "cancelled" });
  return res.data;
}

/**
 * lookupBooking (guest-friendly)
 * params: { email?: string, bookingId?: string }
 * returns { success, data: [...] }
 */
export async function lookupBooking(params) {
  const res = await api.get("/api/bookings/lookup", { params });
  return res.data;
}