import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const VerifyPaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { statusMsg, isSuccess } = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    const paymentStatus = params.get("payment_status");
    const bookingId = params.get("booking_id");
    const msgBase = bookingId ? `Booking ID: ${bookingId}` : "";
    if (paymentStatus === "success") {
      return { statusMsg: `Payment successful. ${msgBase}`, isSuccess: true };
    }
    if (paymentStatus === "cancelled") {
      return { statusMsg: `Payment was cancelled. ${msgBase}`, isSuccess: false };
    }
    return { statusMsg: "Payment status unknown. Please check your email for booking details.", isSuccess: false };
  }, [location.search]);

  return (
    <div className="min-h-screen flex items-center justify-center text-white p-4 bg-gray-900">
      <div className="text-center max-w-lg bg-gray-800/60 border border-gray-700 rounded-2xl p-8 shadow-xl">
        <p className={`text-xl font-semibold ${isSuccess ? "text-green-400" : "text-orange-300"}`}>
          {statusMsg}
        </p>
        <p className="text-sm opacity-80 mt-3">
          You’ll also receive an email with your booking details. If you need help, contact support with your booking ID.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => navigate("/bookings", { replace: true })}
            className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white"
          >
            View My Bookings
          </button>
          <button
            onClick={() => navigate("/", { replace: true })}
            className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyPaymentPage;