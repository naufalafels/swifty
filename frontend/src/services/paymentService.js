import api from "../utils/api";

/**
 * createRazorpayOrder(payload)
 * payload should include: customer, email, phone, car, pickupDate, returnDate,
 * amount, paymentBreakdown, details, address, carImage, currency, kyc
 * Returns { orderId, bookingId, key, amount, currency, redirect }
 */
export async function createRazorpayOrder(payload) {
  const res = await api.post("/api/payments/razorpay/order", payload, {
    headers: { "Content-Type": "application/json" },
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