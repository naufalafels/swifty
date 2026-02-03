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

  useEffect(() => {
    if (!bookingId) return;
    setLoading(true);
    setError("");
    api
      .get(`/api/bookings/${bookingId}`)
      .then((res) => setBooking(res.data?.data || null))
      .catch((err) => {
        setError(err?.response?.data?.message || "Failed to load booking details.");
      })
      .finally(() => setLoading(false));
  }, [bookingId]);

  const isSuccess = paymentStatus === "success";
  const isCancelled = paymentStatus === "cancelled";

  const deposit = booking?.paymentBreakdown?.deposit ?? 0;
  const paid = booking?.amount ?? 0;
  const carName = booking?.car?.make ? `${booking.car.make} ${booking.car.model || ""}`.trim() : "Car";
  const companyName = booking?.car?.companyName || booking?.companyName || "—";

  const headline = isSuccess ? "Payment Successful" : isCancelled ? "Payment Failed. Try Again" : "Payment Status";
  const headlineIcon = isSuccess ? <FaCheckCircle className="text-green-400 text-3xl" /> : <FaTimesCircle className="text-red-400 text-3xl" />;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-3xl bg-gray-800/60 border border-gray-700 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          {headlineIcon}
          <h1 className="text-2xl font-semibold">{headline}</h1>
        </div>

        {bookingId ? (
          <p className="text-sm text-gray-300 mb-4">Booking ID: <span className="font-mono">{bookingId}</span></p>
        ) : (
          <p className="text-sm text-gray-400 mb-4">No booking reference was provided.</p>
        )}

        {loading && <p className="text-gray-300">Loading booking details...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {booking && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <FaCar className="text-orange-400" /> <span>Car</span>
              </div>
              <div className="text-lg font-semibold">{carName}</div>
              <div className="text-xs text-gray-400 mt-1">Pickup: {new Date(booking.pickupDate).toLocaleDateString()}</div>
              <div className="text-xs text-gray-400">Return: {new Date(booking.returnDate).toLocaleDateString()}</div>
            </div>

            <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <FaBuilding className="text-orange-400" /> <span>Company</span>
              </div>
              <div className="text-lg font-semibold">{companyName}</div>
              <div className="text-xs text-gray-400 mt-1">Status: {booking.status}</div>
              <div className="text-xs text-gray-400">Payment Status: {booking.paymentStatus}</div>
            </div>

            <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 md:col-span-2">
              <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <FaWallet className="text-orange-400" /> <span>Payment</span>
              </div>
              <div className="flex justify-between text-sm text-gray-200">
                <span>Paid Online</span>
                <span className="font-semibold">{currency(paid, booking.currency || "MYR")}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-200 mt-2">
                <span>Deposit (pay at counter)</span>
                <span className="font-semibold">{currency(deposit || 0, booking.currency || "MYR")}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/bookings", { replace: true })}
            className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2"
          >
            <FaArrowLeft /> My Bookings
          </button>
          <button
            onClick={() => navigate("/", { replace: true })}
            className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
          >
            Back to Home
          </button>
          {(!isSuccess || isCancelled) && booking?.car?.id && (
            <button
              onClick={() => navigate(`/cars/${booking.car.id}`, { replace: false })}
              className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
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