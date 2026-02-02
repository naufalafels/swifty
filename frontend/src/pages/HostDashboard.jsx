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
  FaHome,
  FaPlus,
  FaChevronDown,
  FaChevronUp,
  FaImage,
  FaComments,
  FaPaperPlane,
  FaTimes
} from "react-icons/fa";
import { getHostCars, createHostCar, getHostBookings, updateHostBookingStatus } from "../services/hostService";
import * as authService from "../utils/authService";
import api from "../utils/api";
import io from "socket.io-client";

// Vite-safe Socket URL resolution
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:7889` : "http://localhost:7889");

// Helper to pick a small image for car cards/thumbnails
const getCarThumb = (car) => {
  if (!car) return null;
  const images = Array.isArray(car.images) ? car.images : car?.image ? [car.image] : [];
  return images[0] || null;
};

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
  const [savingCar, setSavingCar] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [isHost, setIsHost] = useState(true);
  const [statusNote, setStatusNote] = useState("");
  const [carFormOpen, setCarFormOpen] = useState(false);
  const [carFormError, setCarFormError] = useState("");
  const [imagePreview, setImagePreview] = useState("");

  const [carForm, setCarForm] = useState({
    make: "",
    model: "",
    year: "",
    dailyRate: "",
    seats: "4",
    transmission: "Automatic",
    fuelType: "Gasoline",
    mileage: "",
    image: null,
    category: "Sedan",
  });

  // Messaging state
  const [messages, setMessages] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [socket, setSocket] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [showConversations, setShowConversations] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const user = authService.getCurrentUser?.();
    const allowed = Array.isArray(user?.roles) && user.roles.includes("host");
    setIsHost(allowed);
  }, []);

  useEffect(() => {
    let active = true;
    const user = authService.getCurrentUser?.();
    if (!user) return;

    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    setSocket(s);
    s.emit("joinUserRoom", user.id);

    s.on("privateMessage", (data) => {
      if (!active) return;
      setMessages((prev) => [...prev, data]);
    });

    api
      .get("/api/messages/host")
      .then((res) => {
        if (!active) return;
        setMessages(res.data || []);
      })
      .catch(() => setMsgError("Failed to load messages"));

    return () => {
      active = false;
      s.disconnect();
    };
  }, []);

  const me = authService.getCurrentUser?.()?.id;

  const conversations = useMemo(() => {
    const carMap = new Map(cars.map((c) => [String(c._id || c.id), c]));
    const map = {};
    messages.forEach((msg) => {
      const counterpartId = msg.fromUserId === me ? msg.toUserId : msg.fromUserId;
      const carKey = msg.carId || "no-car";
      const key = `${carKey}-${counterpartId}`;
      const car = carMap.get(String(msg.carId));
      const userName =
        msg.userName ||
        msg.fromName ||
        msg.toName ||
        msg.userEmail ||
        msg.email ||
        counterpartId;
      const userEmail = msg.userEmail || msg.email || msg.toEmail || msg.fromEmail || userName;
      const carModel = car?.model || car?.make || "Car";
      const carThumb = getCarThumb(car);
      const latest = map[key]?.lastMsg;
      if (!latest || new Date(msg.timestamp || msg.createdAt) > new Date(latest.timestamp || latest.createdAt)) {
        map[key] = { carId: msg.carId, userId: counterpartId, userName, userEmail, carModel, carThumb, lastMsg: msg };
      }
    });
    return Object.values(map);
  }, [messages, me, cars]);

  const activeThread = useMemo(() => {
    if (!selectedConversation || !me) return [];
    // FIFO: oldest -> newest
    return messages
      .filter(
        (msg) =>
          msg.carId === selectedConversation.carId &&
          ((msg.fromUserId === me && msg.toUserId === selectedConversation.userId) ||
            (msg.toUserId === me && msg.fromUserId === selectedConversation.userId))
      )
      .sort((a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt));
  }, [messages, selectedConversation, me]);

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedConversation || !socket) return;
    const payload = {
      toUserId: selectedConversation.userId,
      fromUserId: me,
      carId: selectedConversation.carId,
      message: newMessage.trim(),
      userName: selectedConversation.userName,
      userEmail: selectedConversation.userEmail,
    };
    api
      .post("/api/messages", payload)
      .then(() => {
        socket.emit("privateMessage", payload);
        setNewMessage("");
        setMsgError("");
      })
      .catch(() => setMsgError("Failed to send message"));
  };

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

  const validateCar = () => {
    const required = ["make", "model", "year", "dailyRate", "seats", "transmission", "fuelType"];
    for (const k of required) {
      if (!String(carForm[k] || "").trim()) {
        setCarFormError(`${k} is required`);
        return false;
      }
    }
    if (Number(carForm.dailyRate) <= 0 || Number.isNaN(Number(carForm.dailyRate))) {
      setCarFormError("dailyRate must be a positive number");
      return false;
    }
    if (Number(carForm.year) < 1900 || Number.isNaN(Number(carForm.year))) {
      setCarFormError("year is invalid");
      return false;
    }
    setCarFormError("");
    return true;
  };

  const handleImage = (file) => {
    setCarForm((f) => ({ ...f, image: file }));
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result || "");
      reader.readAsDataURL(file);
    } else {
      setImagePreview("");
    }
  };

  const submitCar = async (e) => {
    e.preventDefault();
    if (!validateCar()) return;
    setSavingCar(true);
    try {
      await createHostCar({
        ...carForm,
        year: Number(carForm.year),
        dailyRate: Number(carForm.dailyRate),
        seats: Number(carForm.seats),
        mileage: Number(carForm.mileage || 0),
      });
      setCarForm({
        make: "",
        model: "",
        year: "",
        dailyRate: "",
        seats: "4",
        transmission: "Automatic",
        fuelType: "Gasoline",
        mileage: "",
        image: null,
        category: "Sedan",
      });
      setImagePreview("");
      await loadCars();
    } catch (err) {
      setCarFormError(err?.response?.data?.message || "Failed to create car");
    } finally {
      setSavingCar(false);
    }
  };

  const setStatus = async (id, status) => {
    try {
      setUpdatingId(id + status);
      await updateHostBookingStatus(id, status, statusNote);
      await loadBookings();
      setStatusNote("");
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
                Your account hasn&apos;t been approved as a host yet. Swifty admins must approve you before you can access the Host Centre.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() => navigate("/host/onboard")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700"
            >
              Start Host Onboarding
            </button>
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              <FaHome /> Back to Frontpage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Host Centre</h1>
          <p className="text-sm text-slate-400">Add cars, manage bookings, view KYC, and keep audit notes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <FaHome /> Frontpage
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

      {/* Add Car (collapsible) */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 space-y-3">
        <button
          onClick={() => setCarFormOpen((v) => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <FaPlus className="text-emerald-400" />
            <h2 className="text-lg font-semibold">Add a Car</h2>
          </div>
          {carFormOpen ? <FaChevronUp /> : <FaChevronDown />}
        </button>

        {carFormOpen && (
          <div className="mt-2">
            <form onSubmit={submitCar} className="grid gap-3 sm:grid-cols-2">
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white"
                placeholder="Make*"
                value={carForm.make}
                onChange={(e) => setCarForm({ ...carForm, make: e.target.value })}
              />
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white"
                placeholder="Model*"
                value={carForm.model}
                onChange={(e) => setCarForm({ ...carForm, model: e.target.value })}
              />
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white"
                placeholder="Year*"
                type="number"
                value={carForm.year}
                onChange={(e) => setCarForm({ ...carForm, year: e.target.value })}
              />
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white"
                placeholder="Daily Rate (MYR)*"
                type="number"
                value={carForm.dailyRate}
                onChange={(e) => setCarForm({ ...carForm, dailyRate: e.target.value })}
              />
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white"
                placeholder="Seats*"
                type="number"
                value={carForm.seats}
                onChange={(e) => setCarForm({ ...carForm, seats: e.target.value })}
              />
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white"
                placeholder="Mileage (km)"
                type="number"
                value={carForm.mileage}
                onChange={(e) => setCarForm({ ...carForm, mileage: e.target.value })}
              />
              <select
                className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white"
                value={carForm.transmission}
                onChange={(e) => setCarForm({ ...carForm, transmission: e.target.value })}
              >
                <option>Automatic</option>
                <option>Manual</option>
              </select>
              <select
                className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white"
                value={carForm.fuelType}
                onChange={(e) => setCarForm({ ...carForm, fuelType: e.target.value })}
              >
                <option>Gasoline</option>
                <option>Diesel</option>
                <option>Hybrid</option>
                <option>Electric</option>
              </select>

              <div className="sm:col-span-2 space-y-2">
                <label className="text-sm text-slate-200 flex items-center gap-2">
                  <FaImage /> Upload image (jpg/png, max 5MB)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImage(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-200"
                />
                {imagePreview && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-auto max-h-[480px] object-contain rounded-md"
                    />
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={savingCar}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {savingCar ? "Saving..." : "Save Car"}
                </button>
                {carFormError && <span className="text-sm text-rose-300">{carFormError}</span>}
              </div>
            </form>
          </div>
        )}
      </section>

      {/* Cars */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <FaCar className="text-orange-400" />
          <h2 className="text-lg font-semibold">My Cars</h2>
        </div>
        {loadingCars ? (
          <div className="text-sm text-slate-300">Loading cars...</div>
        ) : cars.length === 0 ? (
          <div className="text-sm text-slate-300">No cars yet. Add a car above.</div>
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
                  <Pill tone="blue">{c.status || "available"}</Pill>
                </div>
                <div className="text-xs text-slate-400">Rate: {c.dailyRate ? `MYR ${c.dailyRate}` : "—"}</div>
                <div className="text-xs text-slate-400">Year: {c.year || "—"}</div>
                <div className="text-xs text-slate-400">Seats: {c.seats || "—"}</div>
                <div className="text-xs text-slate-400">Fuel: {c.fuelType || "—"}</div>
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
        <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:gap-3">
          <input
            className="w-full sm:w-80 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white"
            placeholder="Host note for status updates (audit)"
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
          />
          <span className="text-xs text-slate-400">Note is stored with the booking update.</span>
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
                        {b.details?.hostNote && (
                          <div className="text-amber-200">Host note: {b.details.hostNote}</div>
                        )}
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

      {/* Messaging widget */}
      {isHost && (
        <div className="fixed bottom-4 left-4 z-50">
          <button
            onClick={() => setIsChatOpen((p) => !p)}
            className="bg-orange-500 text-white p-3 rounded-full shadow-lg hover:bg-orange-600 transition md:p-4"
            aria-label="Toggle chat"
          >
            <FaComments className="text-lg md:text-xl" />
          </button>

          {isChatOpen && (
            <div className="mt-2 w-80 h-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl flex flex-col md:w-96 md:h-[28rem]">
              <div className="flex items-center justify-between p-3 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-white">Messages</h3>
                <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-white" aria-label="Close chat">
                  <FaTimes className="text-lg" />
                </button>
              </div>

              <div className="flex-1 p-3 overflow-y-auto bg-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400">Conversations</div>
                  <button
                    onClick={() => setShowConversations((p) => !p)}
                    className="text-xs text-orange-300 hover:text-orange-200"
                  >
                    {showConversations ? "Hide" : "Show"}
                  </button>
                </div>

                {showConversations && (
                  <>
                    {conversations.length === 0 && <div className="text-xs text-gray-500">No messages yet.</div>}
                    {conversations.map((conv) => (
                      <div
                        key={`${conv.carId || 'no-car'}-${conv.userId}`}
                        onClick={() => setSelectedConversation(conv)}
                        className={`p-2 mb-2 rounded cursor-pointer ${
                          selectedConversation?.carId === conv.carId && selectedConversation?.userId === conv.userId ? "bg-orange-600" : "bg-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {conv.carThumb ? (
                            <img
                              src={conv.carThumb}
                              alt="car"
                              className="w-10 h-10 object-cover rounded border border-gray-700"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-gray-700" />
                          )}
                          <div className="flex-1">
                            <div className="text-sm text-white line-clamp-1">{conv.userName || conv.userEmail}</div>
                            <div className="text-xs text-gray-300 line-clamp-1">{conv.carModel} · {conv.carId || "N/A"}</div>
                            <div className="text-xs text-gray-400 line-clamp-1">{conv.lastMsg?.message}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {selectedConversation && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-400 mb-2">Messages (oldest first):</div>
                    {activeThread.map((msg, idx) => {
                      const mine = msg.fromUserId === me;
                      return (
                        <div key={idx} className={`mb-2 text-sm ${mine ? "text-right" : "text-left"}`}>
                          <span className="bg-gray-700 p-2 rounded inline-block max-w-xs break-words">{msg.message}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-gray-700 bg-gray-900">
                {msgError && <div className="text-red-400 text-xs mb-2">{msgError}</div>}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Reply..."
                    className="flex-1 p-2 bg-gray-800 border border-gray-600 rounded text-sm"
                  />
                  <button onClick={sendMessage} className="bg-orange-500 text-white p-2 rounded hover:bg-orange-600">
                    <FaPaperPlane className="text-sm" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="text-red-400 text-sm">{error}</div>}
    </div>
  );
};

export default HostDashboard;