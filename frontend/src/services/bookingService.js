import api from "../utils/api";

/**
 * fetchMyBookings(options)
 * options: { signal } optional AbortController.signal
 * returns an array (backend currently returns array from getMyBookings)
 */
export async function fetchMyBookings(options = {}) {
  const res = await api.get("/api/bookings/mybooking", { signal: options.signal });
  // backend returns an array for this route
  return res.data;
}

/**
 * createBooking(payload, isFormData = false)
 * - payload: JSON object or FormData (if isFormData true)
 */
export async function createBooking(payload, isFormData = false) {
  if (isFormData) {
    // Do not set Content-Type manually with FormData
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
 */
export async function cancelBooking(bookingId) {
  const res = await api.patch(`/api/bookings/${bookingId}/status`, { status: "cancelled" });
  return res.data;
}