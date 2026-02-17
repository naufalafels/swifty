import api from "../utils/api";

/**
 * createXenditInvoice(payloadOrFormData)
 * Creates a booking + Xendit invoice on the backend.
 * Returns { invoiceUrl, bookingId, invoiceId, amount, currency }
 *
 * If FormData is passed, it will be sent as multipart/form-data (for KYC file uploads).
 * Otherwise, JSON body is used.
 *
 * Replaces: createRazorpayOrder
 */
export async function createXenditInvoice(body) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await api.post("/api/payments/xendit/create-invoice", body, {
    headers: isFormData ? {} : { "Content-Type": "application/json" },
  });
  return res.data;
}

/**
 * markPaymentFailed(body: { bookingId })
 * Explicitly cancel a pending booking when user abandons the payment page.
 *
 * Same as before — the logic is gateway-agnostic.
 * Only the route path changed from /razorpay/failed to /xendit/failed.
 */
export async function markPaymentFailed(body) {
  const res = await api.post("/api/payments/xendit/failed", body, {
    headers: { "Content-Type": "application/json" },
  });
  return res.data;
}

// REMOVED: verifyRazorpayPayment
// Xendit uses server-to-server webhooks for payment confirmation.
// No client-side verification is needed (or possible) with Xendit's redirect flow.