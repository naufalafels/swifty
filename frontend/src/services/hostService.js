import api from "../utils/api";

export const getHostCars = async () => {
  const res = await api.get("/api/host/cars");
  return res.data;
};

export const getHostBookings = async () => {
  const res = await api.get("/api/host/bookings");
  return res.data;
};

export const updateHostBookingStatus = async (bookingId, status, note = "") => {
  const res = await api.patch(`/api/host/bookings/${bookingId}/status`, { status, note });
  return res.data;
};