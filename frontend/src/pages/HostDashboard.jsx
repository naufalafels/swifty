import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, format, isWeekend } from "date-fns";
import { DateRange } from "react-date-range";
import {
  FaCalendarAlt,
  FaCar,
  FaClipboardCheck,
  FaDollarSign,
  FaFlag,
  FaHome,
  FaInfoCircle,
  FaList,
  FaMapMarkerAlt,
  FaPlus,
  FaSearch,
  FaShieldAlt,
  FaTimes,
  FaChevronDown
} from "react-icons/fa";
import {
  getHostCars,
  getHostBookings,
  getHostCalendar,
  blockServiceDates,
  getFlexiblePricing,
  upsertFlexiblePricing,
} from "../services/hostService";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

/* ───────────────────────── tiny reusable components ───────────────────────── */

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

const getCarLabel = (booking) => {
  if (typeof booking.car === "string") return booking.car;
  if (booking.car?.make && booking.car?.model) return `${booking.car.make} ${booking.car.model}`;
  if (booking.carId?.make && booking.carId?.model) return `${booking.carId.make} ${booking.carId.model}`;
  return "Car";
};

/* ───────────────────────── BookingCard ───────────────────────── */

const BookingCard = ({ booking }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
    <div className="flex items-center justify-between gap-2">
      <div className="font-semibold text-white flex items-center gap-2">
        <FaCar className="text-amber-400" />
        {getCarLabel(booking)}
      </div>
      <Pill tone="blue">{booking.status}</Pill>
    </div>
    <div className="text-sm text-slate-300 space-y-1">
      <div className="flex items-center gap-2">
        <FaCalendarAlt className="text-emerald-400" /> {formatDate(booking.pickupDate)} → {formatDate(booking.returnDate)}
      </div>
      <div className="flex items-center gap-2">
        <FaMapMarkerAlt className="text-sky-400" /> {booking.location || "Pickup/Return location"}
      </div>
    </div>
  </div>
);

/* ───────────────────────── PricingCard ───────────────────────── */

const PricingCard = ({ car, pricing, onSave }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [base, setBase] = useState(pricing?.baseDailyRate || car.dailyRate || 0);
  const [baseDep, setBaseDep] = useState(pricing?.baseDeposit || car.deposit || 0);
  const [weekend, setWeekend] = useState(pricing?.weekendMultiplier || 1);
  const [depWeekend, setDepWeekend] = useState(pricing?.depositWeekendMultiplier || 1);
  const [peak, setPeak] = useState(pricing?.peakMultipliers || []);

  const addPeak = () => setPeak((p) => [...p, { label: "Peak", start: "", end: "", multiplier: 1.2, depositMultiplier: 1.1 }]);
  const updatePeak = (idx, key, value) => setPeak((p) => p.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  const removePeak = (idx) => setPeak((p) => p.filter((_, i) => i !== idx));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2 text-white font-semibold">
          <FaDollarSign className="text-emerald-400" />
          Flexible Pricing — {car.make} {car.model}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Pill tone="amber">RM {base}</Pill>
          <Pill tone="blue">Dep RM {baseDep}</Pill>
          <span className="text-xs text-slate-400">{collapsed ? "Expand" : "Collapse"}</span>
        </div>
      </button>
      {!collapsed && (
        <div className="p-4 space-y-4 border-t border-slate-800">
          <div className="grid md:grid-cols-3 gap-4">
            <label className="flex flex-col text-sm text-slate-200 gap-1">
              Base daily rate (RM)
              <input type="number" min="0" value={base} onChange={(e) => setBase(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="flex flex-col text-sm text-slate-200 gap-1">
              Base deposit (RM)
              <input type="number" min="0" value={baseDep} onChange={(e) => setBaseDep(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="flex flex-col text-sm text-slate-200 gap-1">
              Weekend multiplier
              <input type="number" step="0.05" min="0.5" value={weekend} onChange={(e) => setWeekend(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
              <span className="text-xs text-slate-400">Applied on Saturday/Sunday</span>
            </label>
            <label className="flex flex-col text-sm text-slate-200 gap-1">
              Deposit weekend multiplier
              <input type="number" step="0.05" min="0.5" value={depWeekend} onChange={(e) => setDepWeekend(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm text-slate-200 flex items-center gap-2">
              <FaFlag className="text-amber-400" /> Peak multipliers
            </div>
            <button onClick={addPeak}
              className="text-sm bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg px-3 py-2 flex items-center gap-2">
              <FaPlus /> Add peak window
            </button>
          </div>

          {peak.length > 0 && (
            <div className="space-y-3">
              {peak.map((p, idx) => (
                <div key={idx} className="grid md:grid-cols-5 gap-3 bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                  <input value={p.label} onChange={(e) => updatePeak(idx, "label", e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" placeholder="Label" />
                  <input type="date" value={p.start} onChange={(e) => updatePeak(idx, "start", e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" />
                  <input type="date" value={p.end} onChange={(e) => updatePeak(idx, "end", e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" />
                  <input type="number" step="0.05" value={p.multiplier} onChange={(e) => updatePeak(idx, "multiplier", Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" placeholder="Rate x" />
                  <div className="flex gap-2">
                    <input type="number" step="0.05" value={p.depositMultiplier} onChange={(e) => updatePeak(idx, "depositMultiplier", Number(e.target.value))}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" placeholder="Deposit x" />
                    <button onClick={() => removePeak(idx)} className="bg-rose-700 hover:bg-rose-600 text-white rounded px-3 py-2">
                      <FaTimes />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={() => onSave({ baseDailyRate: base, baseDeposit: baseDep, weekendMultiplier: weekend, depositWeekendMultiplier: depWeekend, peakMultipliers: peak })}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 font-semibold">
              Save pricing
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ───────────────────────── buildDayCarsAndToday (fallback) ───────────────────────── */

const buildDayCarsAndToday = (bookings) => {
  const dayCars = {};
  const now = new Date();
  const todayIso = format(now, "yyyy-MM-dd");
  const pickupsToday = [];
  const returnsToday = [];
  const relevantStatuses = ["active", "pending", "upcoming", "completed"];

  bookings.forEach((b) => {
    const start = new Date(b.pickupDate);
    const end = new Date(b.returnDate || b.pickupDate);
    const carName = getCarLabel(b);
    const docType = b.verificationDocType || b.userId?.docType || (b.userId?.passportNumber ? "Passport" : b.userId?.nricNumber ? "NRIC" : null);
    const docId = b.verificationIdNumber || b.userId?.passportNumber || b.userId?.nricNumber || b.userId?.idNumber || null;
    const isRelevant = relevantStatuses.includes(b.status);

    let cur = start;
    while (cur <= end) {
      const isoDate = format(cur, "yyyy-MM-dd");
      if (!dayCars[isoDate]) dayCars[isoDate] = [];
      dayCars[isoDate].push({
        carId: b.car?.id || b.carId?._id || null,
        car: carName,
        bookingId: b._id,
        status: b.status,
        verificationDocType: docType,
        verificationIdNumber: docId,
      });
      cur = addDays(cur, 1);
    }

    if (isRelevant) {
      const pickupIso = format(start, "yyyy-MM-dd");
      const returnIso = format(end, "yyyy-MM-dd");
      if (pickupIso === todayIso) pickupsToday.push(b);
      if (returnIso === todayIso) returnsToday.push(b);
    }
  });

  return { dayCars, today: { pickups: pickupsToday, returns: returnsToday } };
};

/* ═══════════════════════════ CALENDAR CSS — WHITE BACKGROUND ═══════════════════════════ */

const CALENDAR_STYLES = `
  /* ── wrapper: white bg ── */
  .host-calendar .rdrCalendarWrapper,
  .host-calendar .rdrDateDisplayWrapper,
  .host-calendar .rdrMonths,
  .host-calendar .rdrMonth {
    background: #ffffff !important;
    color: #1e293b !important;
  }
  .host-calendar .rdrCalendarWrapper {
    border-radius: 12px !important;
    overflow: hidden;
    border: 1px solid #e2e8f0;
  }
  .host-calendar .rdrMonthAndYearWrapper {
    background: #ffffff !important;
    padding-top: 8px;
  }

  /* ── month & year selects ── */
  .host-calendar .rdrMonthName {
    color: #334155 !important;
    font-weight: 600 !important;
  }
  .host-calendar .rdrMonthAndYearPickers select {
    background: #f8fafc !important;
    color: #1e293b !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 6px !important;
    padding: 4px 8px !important;
    font-weight: 500 !important;
  }
  .host-calendar .rdrMonthAndYearPickers select:hover {
    background: #f1f5f9 !important;
  }
  .host-calendar .rdrMonthAndYearPickers select option {
    background: #ffffff !important;
    color: #1e293b !important;
  }

  /* ── nav arrows ── */
  .host-calendar .rdrNextPrevButton {
    background: #f1f5f9 !important;
    border-radius: 8px !important;
    border: 1px solid #e2e8f0 !important;
  }
  .host-calendar .rdrNextPrevButton:hover {
    background: #e2e8f0 !important;
  }
  .host-calendar .rdrPprevButton i {
    border-color: transparent #475569 transparent transparent !important;
  }
  .host-calendar .rdrNextButton i {
    border-color: transparent transparent transparent #475569 !important;
  }

  /* ── weekday labels ── */
  .host-calendar .rdrWeekDay {
    color: #64748b !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
  }

  /* ── date display inputs ── */
  .host-calendar .rdrDateDisplay {
    background-color: #ffffff !important;
    margin: 0 8px !important;
  }
  .host-calendar .rdrDateDisplayItem {
    background-color: #f8fafc !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 8px !important;
    box-shadow: none !important;
  }
  .host-calendar .rdrDateDisplayItem input {
    color: #1e293b !important;
  }
  .host-calendar .rdrDateDisplayItemActive {
    border-color: #10b981 !important;
  }

  /* ── day cells ── */
  .host-calendar .rdrDay {
    height: 56px !important;
    background: transparent !important;
  }

  /*
   * KEY FIX: DO NOT hide .rdrDayNumber — let the library render dates natively.
   * Just force the text colour to dark so it's visible on white bg.
   */
  .host-calendar .rdrDayNumber {
    position: absolute !important;
    top: 4px !important;
    left: 0 !important;
    right: 0 !important;
    bottom: auto !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 3 !important;
  }
  .host-calendar .rdrDayNumber span {
    color: #1e293b !important;
    font-weight: 700 !important;
    font-size: 14px !important;
  }
  .host-calendar .rdrDayPassive .rdrDayNumber span {
    color: #cbd5e1 !important;
  }
  .host-calendar .rdrDayDisabled .rdrDayNumber span {
    color: #cbd5e1 !important;
  }
  .host-calendar .rdrDayToday .rdrDayNumber span {
    color: #059669 !important;
    font-weight: 800 !important;
  }
  .host-calendar .rdrDayToday .rdrDayNumber span::after {
    background: #059669 !important;
  }

  /* ── selection range ── */
  .host-calendar .rdrStartEdge,
  .host-calendar .rdrEndEdge {
    background: rgba(16, 185, 129, 0.25) !important;
    border-radius: 8px !important;
  }
  .host-calendar .rdrInRange {
    background: rgba(16, 185, 129, 0.10) !important;
  }

  /* ── preview (hover) ── */
  .host-calendar .rdrDayStartPreview,
  .host-calendar .rdrDayEndPreview {
    border-color: rgba(16, 185, 129, 0.4) !important;
    border-radius: 8px !important;
  }
  .host-calendar .rdrDayInPreview {
    border-color: rgba(16, 185, 129, 0.2) !important;
  }

  /* ── hover ── */
  .host-calendar .rdrDay:not(.rdrDayPassive):not(.rdrDayDisabled):hover {
    cursor: pointer;
  }
  .host-calendar .rdrDay:not(.rdrDayPassive):not(.rdrDayDisabled):hover .host-cal-cell {
    background: #f1f5f9 !important;
    border-radius: 6px;
  }

  /* ── passive ── */
  .host-calendar .rdrDayPassive .host-cal-cell {
    opacity: 0.2 !important;
  }
  .host-calendar .rdrDayPassive {
    pointer-events: none;
  }

  /* ── disabled ── */
  .host-calendar .rdrDayDisabled {
    background-color: #f8fafc !important;
  }
  .host-calendar .rdrDayDisabled .host-cal-cell {
    opacity: 0.2 !important;
  }

  /* ── z-index layering ── */
  .host-calendar .rdrStartEdge,
  .host-calendar .rdrEndEdge,
  .host-calendar .rdrInRange,
  .host-calendar .rdrDayStartPreview,
  .host-calendar .rdrDayInPreview,
  .host-calendar .rdrDayEndPreview {
    z-index: 1 !important;
  }
  .host-calendar .host-cal-cell {
    z-index: 2 !important;
    position: relative !important;
  }
  /* .rdrDayNumber is z-index: 3 (set above) — always on top */
`;

/* ═══════════════════════════ MAIN DASHBOARD ═══════════════════════════ */

const HostDashboard = () => {
  const navigate = useNavigate();
  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [selectedCarIds, setSelectedCarIds] = useState([]);
  const [serviceDates, setServiceDates] = useState([{ startDate: new Date(), endDate: addDays(new Date(), 1), key: "selection" }]);
  const [selectedRange, setSelectedRange] = useState([{ startDate: new Date(), endDate: addDays(new Date(), 1), key: "selection" }]);
  const [pricingByCar, setPricingByCar] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);
  const [serviceError, setServiceError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [carsRes, bookingsRes, calendarRes] = await Promise.all([
          getHostCars(),
          getHostBookings(),
          getHostCalendar(),
        ]);
        if (!mounted) return;
        setCars(carsRes);
        setBookings(bookingsRes);
        let calData = calendarRes || {};
        if (!calData.dayCars || !calData.today) {
          const derived = buildDayCarsAndToday(bookingsRes || []);
          calData = { ...calData, ...derived };
        }
        setCalendar(calData);
        const map = {};
        await Promise.all(
          (carsRes || []).map(async (c) => {
            try {
              map[c._id] = await getFlexiblePricing(c._id);
            } catch {
              map[c._id] = { baseDailyRate: c.dailyRate || 0, baseDeposit: c.deposit || 0, weekendMultiplier: 1, depositWeekendMultiplier: 1, peakMultipliers: [] };
            }
          })
        );
        if (mounted) setPricingByCar(map);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const holidays = calendar?.holidays || [];
  const dayCars = calendar?.dayCars || {};
  const todayPickups = calendar?.today?.pickups || [];
  const todayReturns = calendar?.today?.returns || [];

  const holidayByDate = useMemo(() => {
    const m = new Map();
    holidays.forEach((h) => m.set(h.date, h));
    return m;
  }, [holidays]);

  const filteredCars = useMemo(() => {
    if (!filter.trim()) return cars;
    return cars.filter((c) =>
      `${c.make} ${c.model}`.toLowerCase().includes(filter.trim().toLowerCase())
    );
  }, [cars, filter]);

  const handleBlockService = async () => {
    setServiceError("");
    try {
      const dates = eachDay(selectedRange[0].startDate, selectedRange[0].endDate);
      const isoDates = dates.map((d) => format(d, "yyyy-MM-dd"));
      await blockServiceDates(selectedCarIds, isoDates);
      const updated = await getHostCalendar();
      let calData = updated || {};
      if (!calData.dayCars || !calData.today) {
        const derived = buildDayCarsAndToday(bookings || []);
        calData = { ...calData, ...derived };
      }
      setCalendar(calData);
      setSelectedCarIds([]);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to block service";
      setServiceError(msg);
    }
  };

  const handleSavePricing = async (carId, payload) => {
    const saved = await upsertFlexiblePricing(carId, payload);
    setPricingByCar((m) => ({ ...m, [carId]: saved }));
    setCars((list) =>
      list.map((c) =>
        c._id === carId
          ? { ...c, dailyRate: payload.baseDailyRate, deposit: payload.baseDeposit }
          : c
      )
    );
  };

  const selectedDayCars = selectedDay ? dayCars[selectedDay] || [] : [];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading host center…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-10">
      <style>{CALENDAR_STYLES}</style>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* ──── header ──── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")}
              className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2">
              <FaHome /> Home
            </button>
            <div>
              <div className="text-xs uppercase text-slate-500">Host Centre</div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FaHome className="text-emerald-400" /> Operations overview
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => navigate("/host/add-cars")}
              className="bg-emerald-600 hover:bg-emerald-500 rounded-lg px-4 py-2 flex items-center gap-2 font-semibold">
              <FaPlus /> Add cars
            </button>
            <button onClick={() => navigate("/profile")}
              className="bg-slate-800 hover:bg-slate-700 rounded-lg px-4 py-2 flex items-center gap-2 font-semibold">
              <FaShieldAlt /> Profile & security
            </button>
          </div>
        </div>

        {/* ──── stat cards ──── */}
        <div className="grid md:grid-cols-3 gap-4">
          <StatCard title="Cars" value={cars.length} icon={<FaCar />} tone="blue" />
          <StatCard title="Today pickups" value={todayPickups.length} icon={<FaClipboardCheck />} tone="emerald" />
          <StatCard title="Today returns" value={todayReturns.length} icon={<FaClipboardCheck />} tone="amber" />
        </div>

        {/* ──── quick find ──── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-slate-200">
            <FaSearch /> Quick find (20–40 cars)
          </div>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search by make/model"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-auto pr-1">
            {filteredCars.map((c) => (
              <div key={c._id} className="border border-slate-800 bg-slate-900 rounded-lg p-3 space-y-1">
                <div className="text-sm font-semibold text-white">{c.make} {c.model}</div>
                <div className="text-xs text-slate-400">{c.category} • {c.year}</div>
                <div className="text-xs text-slate-400">RM {c.dailyRate} / day</div>
                <div className="text-xs text-slate-400">Dep RM {c.deposit || 0}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Pill tone="slate">{c.transmission}</Pill>
                  <Pill tone="blue">{c.fuelType}</Pill>
                </div>
              </div>
            ))}
            {filteredCars.length === 0 && <div className="text-sm text-slate-400">No cars match your search.</div>}
          </div>
        </div>

        {/* ══════════════ CALENDAR + SIDEBAR ══════════════ */}
        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 font-semibold">
                <FaCalendarAlt className="text-emerald-400" /> Booking calendar
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500"></span> Holiday
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Cars booked
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300"></span> Weekend
                </span>
              </div>
            </div>

            <div className="host-calendar">
              <DateRange
                onChange={(item) => {
                  setSelectedRange([item.selection]);
                  setSelectedDay(format(item.selection.startDate, "yyyy-MM-dd"));
                }}
                ranges={selectedRange}
                rangeColors={["#10b981"]}
                minDate={new Date()}
                showMonthAndYearPickers
                months={2}
                direction="horizontal"
                showPreview={false}
                weekStartsOn={1}
                dayContentRenderer={(date) => {
                  const isoDate = format(date, "yyyy-MM-dd");
                  const carsOnDay = dayCars[isoDate] || [];
                  const holiday = holidayByDate.get(isoDate);
                  const isWknd = isWeekend(date);
                  const hasBookings = carsOnDay.length > 0;

                  // Light background tints on white
                  let bgClass = "";
                  if (holiday && hasBookings) bgClass = "bg-amber-100";
                  else if (holiday) bgClass = "bg-amber-50";
                  else if (hasBookings) bgClass = "bg-emerald-50";
                  else if (isWknd) bgClass = "bg-slate-100";

                  // Ring/border
                  let ringClass = "";
                  if (holiday) ringClass = "ring-2 ring-amber-400";
                  else if (hasBookings) ringClass = "ring-1 ring-emerald-400";
                  else if (isWknd) ringClass = "ring-1 ring-slate-200";

                  return (
                    <div className={`host-cal-cell w-full h-full flex flex-col items-center justify-end rounded-md overflow-hidden px-0.5 pb-[3px] pt-[20px] ${bgClass} ${ringClass}`}>
                      {/* Dots + labels sit BELOW the library's native date number */}
                      <div className="flex items-center gap-[3px]">
                        {holiday && (
                          <span className="w-[6px] h-[6px] rounded-full bg-amber-500 shadow-[0_0_3px_rgba(245,158,11,0.4)]" title={holiday.label}></span>
                        )}
                        {hasBookings && (
                          <span className="w-[6px] h-[6px] rounded-full bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.4)]" title={`${carsOnDay.length} car(s) booked`}></span>
                        )}
                      </div>

                      {/* car count */}
                      {hasBookings && (
                        <span className="text-[9px] leading-none text-emerald-700 font-bold mt-[1px]">
                          {carsOnDay.length} car{carsOnDay.length !== 1 ? "s" : ""}
                        </span>
                      )}

                      {/* short holiday label */}
                      {holiday && !hasBookings && (
                        <span className="text-[8px] leading-none text-amber-700 truncate max-w-[46px] mt-[1px] font-semibold">
                          {holiday.label.length > 10 ? holiday.label.slice(0, 10) + "…" : holiday.label}
                        </span>
                      )}
                    </div>
                  );
                }}
              />
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <FaInfoCircle /> Click a date to see full details in the sidebar. Holidays are informational for pricing.
            </div>
          </div>

          {/* ──── selected-day sidebar ──── */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <FaList className="text-emerald-400" /> Selected day detail
            </div>
            {selectedDay ? (
              <div className="space-y-2">
                <div className="text-sm text-slate-200 font-medium">{selectedDay}</div>
                {holidayByDate.get(selectedDay) && (
                  <div className="text-xs text-amber-300 bg-amber-900/40 border border-amber-800 rounded px-2 py-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span>
                    {holidayByDate.get(selectedDay).label} ({holidayByDate.get(selectedDay).type})
                  </div>
                )}
                {(dayCars[selectedDay] || []).length === 0 && (
                  <div className="text-sm text-slate-400">No cars booked.</div>
                )}
                <div className="space-y-2 max-h-56 overflow-auto pr-1">
                  {(dayCars[selectedDay] || []).map((c, idx) => (
                    <div key={idx} className="border border-slate-800 rounded-lg p-2 text-sm bg-slate-950/60">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold">{c.car}</span>
                        <Pill tone="blue">{c.status}</Pill>
                      </div>
                      <div className="text-xs text-slate-400">Booking #{c.bookingId}</div>
                      <div className="text-xs text-slate-300 mt-1">
                        Verification: {c.verificationDocType || "Not provided"} {c.verificationIdNumber ? `(${c.verificationIdNumber})` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">Select a date to see booked cars.</div>
            )}
          </div>
        </section>

        {/* ══════════════ SERVICE BLOCK + TODAY PICKUPS/RETURNS ══════════════ */}
        <section className="grid lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 lg:col-span-1">
            <div className="flex items-center gap-2 font-semibold">
              <FaFlag className="text-amber-400" /> Block cars for service
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Select cars (predictive, scrollable)</div>
              <PredictiveMultiSelect
                options={cars.map((c) => ({ value: c._id, label: `${c.make} ${c.model}` }))}
                value={selectedCarIds}
                onChange={setSelectedCarIds}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Service dates</div>
              <DateRange
                onChange={(item) => setServiceDates([item.selection])}
                ranges={serviceDates}
                rangeColors={["#f59e0b"]}
                minDate={new Date()}
                showPreview={false}
                weekStartsOn={1}
              />
            </div>
            {serviceError && <div className="text-xs text-rose-300">{serviceError}</div>}
            <button disabled={!selectedCarIds.length} onClick={handleBlockService}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg py-2 font-semibold">
              Block selected cars for these dates
            </button>
          </div>

          <div className="lg:col-span-2 grid gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  <FaList className="text-emerald-400" /> Today's pickups
                </div>
                <Pill tone="green">{todayPickups.length}</Pill>
              </div>
              <div className="space-y-3 max-h-64 overflow-auto pr-1">
                {todayPickups.length === 0 && <div className="text-slate-400 text-sm">No pickups today.</div>}
                {todayPickups.map((b) => (
                  <BookingCard key={b._id} booking={b} />
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  <FaList className="text-amber-400" /> Today's returns
                </div>
                <Pill tone="amber">{todayReturns.length}</Pill>
              </div>
              <div className="space-y-3 max-h-64 overflow-auto pr-1">
                {todayReturns.length === 0 && <div className="text-slate-400 text-sm">No returns today.</div>}
                {todayReturns.map((b) => (
                  <BookingCard key={b._id} booking={b} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════ FLEXIBLE PRICING ══════════════ */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FaDollarSign className="text-emerald-400" /> Flexible pricing per car
          </h2>
          <div className="space-y-4">
            {cars.map((c) => (
              <PricingCard
                key={c._id}
                car={c}
                pricing={pricingByCar[c._id]}
                onSave={(payload) => handleSavePricing(c._id, payload)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

/* ───────────────────────── StatCard ───────────────────────── */

const StatCard = ({ title, value, icon, tone = "slate" }) => {
  const tones = {
    slate: "from-slate-900 to-slate-800 border-slate-800",
    emerald: "from-emerald-900/60 to-emerald-800/40 border-emerald-700/50",
    amber: "from-amber-900/60 to-amber-800/40 border-amber-700/50",
    blue: "from-sky-900/60 to-sky-800/40 border-sky-700/50",
  };
  return (
    <div className={`bg-gradient-to-br ${tones[tone]} rounded-xl p-4 border`}>
      <div className="flex items-center justify-between text-slate-200">
        <div className="text-sm uppercase tracking-wide text-slate-400">{title}</div>
        <div className="text-lg">{icon}</div>
      </div>
      <div className="text-3xl font-bold mt-2 text-white">{value}</div>
    </div>
  );
};

/* ───────────────────────── PredictiveMultiSelect ───────────────────────── */

const PredictiveMultiSelect = ({ options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  );
  const toggle = (val) => {
    onChange((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-left text-white flex items-center justify-between">
        <span>{value.length ? `${value.length} car(s) selected` : "Select cars"}</span>
        <FaChevronDown className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg shadow-lg">
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to filter"
            className="w-full bg-slate-800 border-b border-slate-800 px-3 py-2 text-sm text-white" />
          <div className="max-h-48 overflow-auto">
            {filtered.map((opt) => (
              <label key={opt.value}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-800 text-white cursor-pointer">
                <input type="checkbox" checked={value.includes(opt.value)} onChange={() => toggle(opt.value)}
                  className="accent-emerald-500" />
                <span>{opt.label}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-400">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ───────────────────────── eachDay helper ───────────────────────── */

const eachDay = (start, end) => {
  const days = [];
  let cur = start;
  while (cur <= end) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
};

export default HostDashboard;