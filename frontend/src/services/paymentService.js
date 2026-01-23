import api from "../utils/api";

/**
 * createRazorpayOrder(payloadOrFormData)
 * If FormData is passed, it will be sent as multipart/form-data (for file uploads).
 * Otherwise, JSON body is used.
 */
export async function createRazorpayOrder(body) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await api.post("/api/payments/razorpay/order", body, {
    headers: isFormData ? {} : { "Content-Type": "application/json" },
  });
  return res.data;
}

/**
 * verifyRazorpayPayment(body) - optional if you rely purely on webhook
 */
export async function verifyRazorpayPayment(body) {
  const res = await api.post("/api/payments/razorpay/verify", body, {
    headers: { "Content-Type": "application/json" },
  });
  return res.data;
}