import api from "../utils/api";
import * as authService from "../utils/authService";

/**
 * fetchMyBookings(options)
 * options: { signal } optional AbortController.signal
 * returns an array (backend currently returns array from getMyBookings)
 */
export async function fetchMyBookings(options = {}) {
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
 * Attach Authorization if a user token is present.
 */
export async function cancelBooking(bookingId) {
  const user = authService.getCurrentUser();
  const headers = {};
  if (user?.token) headers.Authorization = `Bearer ${user.token}`;

  const res = await api.patch(
    `/api/bookings/${bookingId}/status`,
    { status: "cancelled" },
    { headers }
  );
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