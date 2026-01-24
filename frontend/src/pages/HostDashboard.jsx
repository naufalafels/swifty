import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaFlag,
  FaSyncAlt,
  FaExternalLinkAlt,
  FaCar,
  FaInfoCircle,
} from "react-icons/fa";
import { getHostCars, getHostBookings, updateHostBookingStatus } from "../services/hostService";
import * as authService from "../utils/authService";

const Pill = ({ children, tone = "slate" }) => {
  const tones = {
    slate: "bg-slate-800 text-slate-100",
    amber: "bg-amber-900 text-amber-200",
    green: "bg-emerald-900 text-emerald-200",
    red: "bg-rose-900 text-rose-100",
    blue: "bg-blue-900 text-blue-100",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const HostDashboard = () => {
  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loadingCars, setLoadingCars] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [isHost, setIsHost] = useState(true);
  const navigate = useNavigate();

  // Gate: only approved hosts should see Host Centre
  useEffect(() => {
    const user = authService.getCurrentUser?.();
    const allowed = Array.isArray(user?.roles) && user.roles.includes("host");
    setIsHost(allowed);
  }, []);

  const loadCars = async () => {
    setLoadingCars(true);
    try {
      const res = await getHostCars();
      const payload = res?.data?.data ?? res?.data ?? res ?? [];
      const list = Array.isArray(payload) ? payload : Array.isArray(payload.cars) ? payload.cars : [];
      setCars(list);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load cars");
    } finally {
      setLoadingCars(false);
    }
  };

  const loadBookings = async () => {
    setLoadingBookings(true);
    try {
      const res = await getHostBookings();
      const payload = res?.data?.data ?? res?.data ?? res ?? [];
      const list = Array.isArray(payload) ? payload : Array.isArray(payload.bookings) ? payload.bookings : [];
      setBookings(list);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load bookings");
    } finally {
      setLoadingBookings(false);
    }
  };

  const setStatus = async (id, status) => {
    try {
      setUpdatingId(id + status);
      await updateHostBookingStatus(id, status);
      await loadBookings();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update booking");
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    if (isHost) {
      loadCars();
      loadBookings();
    }
  }, [isHost]);

  const stats = useMemo(() => {
    const pending = bookings.filter((b) => b.status === "pending").length;
    const flagged = bookings.filter((b) => b.status === "flagged").length;
    const approved = bookings.filter((b) => b.status === "approved").length;
    return [
      { label: "Cars", value: cars.length, tone: "blue" },
      { label: "Approved", value: approved, tone: "green" },
      { label: "Pending", value: pending, tone: "amber" },
      { label: "Flagged", value: flagged, tone: "red" },
    ];
  }, [cars, bookings]);

  if (!isHost) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <FaInfoCircle className="mt-1" />
            <div>
              <h1 className="text-xl font-semibold mb-1">Become a Host</h1>
              <p className="text-sm text-amber-800">
                Your account hasn&apos;t been approved as a host yet. Complete onboarding to access the Host Centre.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/host/onboard")}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700"
          >
            Start Host Onboarding
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Host Centre</h1>
          <p className="text-sm text-slate-400">Manage your cars, bookings, and renter KYC in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadCars();
              loadBookings();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-800 text-white hover:bg-slate-700"
          >
            <FaSyncAlt /> Refresh
          </button>
          <button
            onClick={() => navigate("/host/onboard")}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            Update payout details
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col gap-2"
          >
            <div className="text-sm text-slate-400">{s.label}</div>
            <div className="text-2xl font-semibold text-white">{s.value}</div>
            <Pill tone={s.tone}>{s.label}</Pill>
          </div>
        ))}
      </div>

      {/* Cars */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <FaCar className="text-orange-400" />
          <h2 className="text-lg font-semibold">My Cars</h2>
        </div>
        {loadingCars ? (
          <div className="text-sm text-slate-300">Loading cars...</div>
        ) : cars.length === 0 ? (
          <div className="text-sm text-slate-300">No cars yet. Add a car from the admin portal.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {cars.map((c) => (
              <div
                key={c._id || c.id}
                className="p-3 rounded border border-slate-800 bg-slate-900/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">
                    {c.make} {c.model}
                  </div>
                  <Pill tone="blue">{c.status || "—"}</Pill>
                </div>
                <div className="text-xs text-slate-400">Rate: {c.dailyRate ? `MYR ${c.dailyRate}` : "—"}</div>
                <div className="text-xs text-slate-400">Year: {c.year || "—"}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bookings */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <FaExternalLinkAlt className="text-emerald-400" />
          <h2 className="text-lg font-semibold">Bookings</h2>
        </div>
        {loadingBookings ? (
          <div className="text-sm text-slate-300">Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="text-sm text-slate-300">No bookings yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="text-slate-300">
                <tr>
                  <th className="px-3 py-2">Car</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Dates</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">KYC</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {bookings.map((b) => {
                  const statusTone =
                    b.status === "approved"
                      ? "green"
                      : b.status === "flagged"
                      ? "red"
                      : b.status === "pending"
                      ? "amber"
                      : "slate";
                  return (
                    <tr key={b._id} className="border-t border-slate-800">
                      <td className="px-3 py-2">
                        <div className="font-semibold">{b.car?.make || b.car?.name || "Car"}</div>
                        <div className="text-xs text-slate-400">{b.car?.model}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold">{b.customer || b.userName || "—"}</div>
                        <div className="text-xs text-slate-400">{b.email || b.userEmail}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-300">
                        {formatDate(b.pickupDate)} → {formatDate(b.returnDate)}
                      </td>
                      <td className="px-3 py-2">
                        <Pill tone={statusTone}>{b.status || "—"}</Pill>
                      </td>
                      <td className="px-3 py-2 text-xs text-blue-300 space-y-1">
                        {b.kyc?.frontImageUrl && (
                          <div>
                            <a className="underline" href={b.kyc.frontImageUrl} target="_blank" rel="noreferrer">
                              Front ID
                            </a>
                          </div>
                        )}
                        {b.kyc?.backImageUrl && (
                          <div>
                            <a className="underline" href={b.kyc.backImageUrl} target="_blank" rel="noreferrer">
                              Back ID
                            </a>
                          </div>
                        )}
                        <div>ID: {b.kyc?.idType || "—"} {b.kyc?.idNumber || ""}</div>
                      </td>
                      <td className="px-3 py-2 space-x-2">
                        <button
                          onClick={() => setStatus(b._id, "approved")}
                          disabled={updatingId === b._id + "approved"}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-700 text-white text-xs disabled:opacity-60"
                        >
                          <FaCheckCircle /> Approve
                        </button>
                        <button
                          onClick={() => setStatus(b._id, "rejected")}
                          disabled={updatingId === b._id + "rejected"}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-700 text-white text-xs disabled:opacity-60"
                        >
                          <FaTimesCircle /> Reject
                        </button>
                        <button
                          onClick={() => setStatus(b._id, "flagged")}
                          disabled={updatingId === b._id + "flagged"}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-600 text-white text-xs disabled:opacity-60"
                        >
                          <FaFlag /> Flag
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error && <div className="text-red-400 text-sm">{error}</div>}
    </div>
  );
};

export default HostDashboard;