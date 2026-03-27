import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../utils/api";
import { FaCheckCircle, FaTimesCircle, FaCar, FaBuilding, FaWallet, FaArrowLeft, FaRedo } from "react-icons/fa";

const currency = (n, c = "MYR") =>
  (Number(n) || 0).toLocaleString("en-MY", { style: "currency", currency: c, maximumFractionDigits: 0 });

const PaymentResultPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search || ""), [location.search]);
  const bookingId = params.get("booking_id");
  const paymentStatus = params.get("payment_status");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(null);

  // ✅ FIX Bug #2: On failure/cancel, immediately tell backend to clean up
  useEffect(() => {
    if ((paymentStatus === 'failed' || paymentStatus === 'cancelled') && bookingId) {
      api.post('/api/payments/xendit/failed', { bookingId }).catch(() => {});
    }
  }, [paymentStatus, bookingId]);

  useEffect(() => {
    if (!bookingId) return;
    let attempts = 0;
    const maxAttempts = 8;
    const delays = [0, 2000, 3000, 3000, 5000, 5000, 5000, 5000];
    let timer;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await api.get(`/api/payments/xendit/verify/${bookingId}`);
        const data = res.data?.booking || null;
        setBooking(data);

        if (data?.paymentStatus === 'paid' || data?.status !== 'awaiting_payment' || attempts >= maxAttempts) {
          setLoading(false);
          return;
        }

        attempts++;
        timer = setTimeout(poll, delays[attempts] || 5000);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load booking details.");
        setLoading(false);
      }
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bookingId]);

  const isSuccess = paymentStatus === "success";
  const isCancelled = paymentStatus === "cancelled" || paymentStatus === "failed";

  const deposit = booking?.paymentBreakdown?.deposit ?? 0;
  const paid = booking?.amount ?? 0;
  const carName = booking?.car?.make ? `${booking.car.make} ${booking.car.model || ""}`.trim() : "Car";
  const companyName = booking?.car?.companyName || booking?.companyName || "—";

  const headline = isSuccess ? "Payment Successful" : isCancelled ? "Payment Failed. Try Again" : "Payment Status";
  const headlineIcon = isSuccess ? <FaCheckCircle className="text-green-500 text-3xl" /> : <FaTimesCircle className="text-red-500 text-3xl" />;

  return (
    <div className="min-h-screen bg-[#FFFBF5] text-slate-800 flex items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-3xl bg-white border border-orange-100 rounded-2xl p-6 sm:p-8 shadow-lg shadow-orange-100/40">
        <div className="flex items-center gap-3 mb-6">
          {headlineIcon}
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-800">{headline}</h1>
        </div>

        {bookingId ? (
          <p className="text-sm text-slate-500 mb-4">Booking ID: <span className="font-mono text-slate-700">{bookingId}</span></p>
        ) : (
          <p className="text-sm text-slate-400 mb-4">No booking reference was provided.</p>
        )}

        {loading && <p className="text-slate-500">Loading booking details...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {booking && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <FaCar className="text-orange-500" /> <span>Car</span>
              </div>
              <div className="text-lg font-semibold text-slate-800">{carName}</div>
              <div className="text-xs text-slate-500 mt-1">Pickup: {new Date(booking.pickupDate).toLocaleDateString()}</div>
              <div className="text-xs text-slate-500">Return: {new Date(booking.returnDate).toLocaleDateString()}</div>
            </div>

            <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <FaBuilding className="text-orange-500" /> <span>Company</span>
              </div>
              <div className="text-lg font-semibold text-slate-800">{companyName}</div>
              <div className="text-xs text-slate-500 mt-1">Status: {booking.status}</div>
              <div className="text-xs text-slate-500">Payment Status: {booking.paymentStatus}</div>
            </div>

            <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4 md:col-span-2">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <FaWallet className="text-orange-500" /> <span>Payment</span>
              </div>
              <div className="flex justify-between text-sm text-slate-700">
                <span>Paid Online</span>
                <span className="font-semibold">{currency(paid, booking.currency || "MYR")}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-700 mt-2">
                <span>Deposit (pay at counter)</span>
                <span className="font-semibold">{currency(deposit || 0, booking.currency || "MYR")}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
          <button
            onClick={() => navigate("/bookings", { replace: true })}
            className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <FaArrowLeft /> My Bookings
          </button>
          <button
            onClick={() => navigate("/", { replace: true })}
            className="px-5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
          >
            Back to Home
          </button>
          {(!isSuccess || isCancelled) && booking?.car?.id && (
            <button
              onClick={() => navigate(`/cars/${booking.car.id}`, { replace: false })}
              className="px-5 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <FaRedo /> Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentResultPage;