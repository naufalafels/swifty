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
    <div className="min-h-screen flex items-center justify-center text-slate-800 p-4 sm:p-6 bg-[#FFFBF5]">
      <div className="text-center max-w-lg w-full bg-white border border-orange-100 rounded-2xl p-6 sm:p-8 shadow-lg shadow-orange-100/40">
        <p className={`text-lg sm:text-xl font-semibold ${isSuccess ? "text-green-600" : "text-orange-500"}`}>
          {statusMsg}
        </p>
        <p className="text-sm text-slate-500 mt-3">
          You'll also receive an email with your booking details. If you need help, contact support with your booking ID.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
          <button
            onClick={() => navigate("/bookings", { replace: true })}
            className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
          >
            View My Bookings
          </button>
          <button
            onClick={() => navigate("/", { replace: true })}
            className="px-5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyPaymentPage;