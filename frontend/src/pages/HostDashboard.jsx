import React, { useEffect, useState } from "react";
import { getHostCars, getHostBookings, updateHostBookingStatus } from "../services/hostService";
import { FaCheckCircle, FaTimesCircle, FaFlag, FaSyncAlt, FaExternalLinkAlt, FaCar } from "react-icons/fa";

const Pill = ({ children, color }) => (
  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{children}</span>
);

const HostDashboard = () => {
  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loadingCars, setLoadingCars] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [error, setError] = useState("");

  const loadCars = async () => {
    setLoadingCars(true);
    try {
      const res = await getHostCars();
      setCars(res.data || []);
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
      setBookings(res.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load bookings");
    } finally {
      setLoadingBookings(false);
    }
  };

  const setStatus = async (id, status) => {
    await updateHostBookingStatus(id, status);
    await loadBookings();
  };

  useEffect(() => {
    loadCars();
    loadBookings();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Host Center</h1>
        <button
          onClick={() => { loadCars(); loadBookings(); }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-800 text-white hover:bg-slate-700"
        >
          <FaSyncAlt /> Refresh
        </button>
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
          <div className="text-sm text-slate-300">No cars yet.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {cars.map((c) => (
              <div key={c._id} className="p-3 rounded border border-slate-800 bg-slate-900">
                <div className="font-semibold">{c.make} {c.model}</div>
                <div className="text-xs text-slate-400">Rate: {c.dailyRate ? `MYR ${c.dailyRate}` : "—"}</div>
                <div className="text-xs text-slate-400">Status: {c.status || "—"}</div>
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
                {bookings.map((b) => (
                  <tr key={b._id} className="border-t border-slate-800">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{b.car?.make || b.car?.name || "Car"}</div>
                      <div className="text-xs text-slate-400">{b.car?.model}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{b.customer}</div>
                      <div className="text-xs text-slate-400">{b.email}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {new Date(b.pickupDate).toLocaleDateString()} → {new Date(b.returnDate).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <Pill color="bg-slate-800 text-slate-100">{b.status}</Pill>
                    </td>
                    <td className="px-3 py-2 text-xs text-blue-300 space-y-1">
                      {b.kyc?.frontImageUrl && (
                        <div><a className="underline" href={b.kyc.frontImageUrl} target="_blank" rel="noreferrer">Front ID</a></div>
                      )}
                      {b.kyc?.backImageUrl && (
                        <div><a className="underline" href={b.kyc.backImageUrl} target="_blank" rel="noreferrer">Back ID</a></div>
                      )}
                      <div>ID: {b.kyc?.idType || "—"} {b.kyc?.idNumber || ""}</div>
                    </td>
                    <td className="px-3 py-2 space-x-2">
                      <button
                        onClick={() => setStatus(b._id, "approved")}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-700 text-white text-xs"
                      ><FaCheckCircle />Approve</button>
                      <button
                        onClick={() => setStatus(b._id, "rejected")}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-700 text-white text-xs"
                      ><FaTimesCircle />Reject</button>
                      <button
                        onClick={() => setStatus(b._id, "flagged")}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-600 text-white text-xs"
                      ><FaFlag />Flag</button>
                    </td>
                  </tr>
                ))}
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