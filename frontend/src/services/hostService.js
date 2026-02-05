import api from "../utils/api";

export const getHostCars = async () => {
  const res = await api.get("/api/host/cars");
  return res.data?.data || [];
};

export const createHostCar = async (payload) => {
  // payload may contain File, so use FormData when caller needs it
  const res = await api.post("/api/host/cars", payload);
  return res.data?.data;
};

export const getHostBookings = async () => {
  const res = await api.get("/api/host/bookings");
  return res.data?.data || [];
};

export const updateHostBookingStatus = async (id, status, note = "") => {
  const res = await api.patch(`/api/host/bookings/${id}/status`, { status, note });
  return res.data?.data;
};

// New: holiday-aware calendar (bookings + service blocks + today summary)
export const getHostCalendar = async () => {
  const res = await api.get("/api/host/calendar");
  return res.data?.data;
};

// New: block car(s) for service
export const blockServiceDates = async (carIds, dates) => {
  const res = await api.post("/api/host/calendar/block", { carIds, dates });
  return res.data?.data;
};

// New: flexible pricing
export const getFlexiblePricing = async (carId) => {
  const res = await api.get(`/api/host/pricing/${carId}`);
  return res.data?.data;
};

export const upsertFlexiblePricing = async (carId, payload) => {
  const res = await api.put(`/api/host/pricing/${carId}`, payload);
  return res.data?.data;
};