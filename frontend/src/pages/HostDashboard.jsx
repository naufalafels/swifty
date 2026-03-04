import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, format, isWeekend } from "date-fns";
import { DateRange } from "react-date-range";
import {
  FaCalendarAlt,
  FaCar,
  FaClipboardCheck,
  FaDollarSign,
  FaEnvelope,
  FaExclamationTriangle,
  FaFlag,
  FaHome,
  FaIdCard,
  FaInfoCircle,
  FaList,
  FaMapMarkerAlt,
  FaPhone,
  FaPlus,
  FaSearch,
  FaShieldAlt,
  FaSpinner,
  FaTimes,
  FaUser,
  FaChevronDown,
  FaWrench
} from "react-icons/fa";
import {
  getHostCars,
  getHostBookings,
  getHostCalendar,
  blockServiceDates,
  getFlexiblePricing,
  upsertFlexiblePricing,
  getBookingCustomerDetail,
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
    orange: "bg-orange-900 text-orange-200",
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
        customerName: b.customer || b.userId?.name || "Unknown",
        customerEmail: b.email || b.userId?.email || "",
        customerPhone: b.phone || b.userId?.phone || "",
        pickupDate: b.pickupDate,
        returnDate: b.returnDate,
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

/* ───────────────────────── CustomerDetailModal ───────────────────────── */

const CustomerDetailModal = ({ detail, loading, onClose, enlargedImage, setEnlargedImage }) => {
  if (!detail && !loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-auto space-y-4"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FaUser className="text-emerald-400" /> Customer Detail
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <FaTimes size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
            <FaSpinner className="animate-spin" /> Loading customer details…
          </div>
        ) : detail ? (
          <>
            {/* Customer Info */}
            <div className="space-y-2 text-sm">
              <div className="text-xs uppercase text-slate-500 tracking-wide font-semibold">Customer Information</div>
              <div className="flex items-center gap-2">
                <FaUser className="text-slate-500 w-4" />
                <span className="text-slate-400">Name:</span>
                <span className="text-white font-medium">{detail.customerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <FaEnvelope className="text-slate-500 w-4" />
                <span className="text-slate-400">Email:</span>
                <span className="text-white font-medium">{detail.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <FaPhone className="text-slate-500 w-4" />
                <span className="text-slate-400">Phone:</span>
                <span className="text-white font-medium">{detail.phone || "—"}</span>
              </div>
            </div>

            {/* Car & Booking */}
            <div className="space-y-2 text-sm border-t border-slate-800 pt-3">
              <div className="text-xs uppercase text-slate-500 tracking-wide font-semibold">Booking Details</div>
              <div className="flex items-center gap-2">
                <FaCar className="text-amber-400 w-4" />
                <span className="text-slate-400">Car:</span>
                <span className="text-white font-medium">{detail.carMake} {detail.carModel} {detail.carYear ? `(${detail.carYear})` : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <FaCalendarAlt className="text-emerald-400 w-4" />
                <span className="text-slate-400">Pickup:</span>
                <span className="text-white font-medium">{formatDate(detail.pickupDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <FaCalendarAlt className="text-amber-400 w-4" />
                <span className="text-slate-400">Return:</span>
                <span className="text-white font-medium">{formatDate(detail.returnDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <FaClipboardCheck className="text-sky-400 w-4" />
                <span className="text-slate-400">Status:</span>
                <Pill tone="blue">{detail.status}</Pill>
              </div>
              <div className="flex items-center gap-2">
                <FaList className="text-slate-500 w-4" />
                <span className="text-slate-400">Booking #:</span>
                <span className="text-white font-mono text-xs">{detail.bookingId}</span>
              </div>
              {detail.amount > 0 && (
                <div className="flex items-center gap-2">
                  <FaDollarSign className="text-emerald-400 w-4" />
                  <span className="text-slate-400">Amount:</span>
                  <span className="text-white font-medium">RM {detail.amount}</span>
                  <Pill tone={detail.paymentStatus === "paid" ? "green" : "amber"}>{detail.paymentStatus}</Pill>
                </div>
              )}
            </div>

            {/* Identification */}
            <div className="space-y-2 text-sm border-t border-slate-800 pt-3">
              <div className="text-xs uppercase text-slate-500 tracking-wide font-semibold">Identification</div>
              <div className="flex items-center gap-2">
                <FaIdCard className="text-sky-400 w-4" />
                <span className="text-slate-400">ID Type:</span>
                <span className="text-white font-medium uppercase">{detail.idType || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <FaShieldAlt className="text-sky-400 w-4" />
                <span className="text-slate-400">ID Number:</span>
                <span className="text-white font-mono">{detail.idNumber || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <FaFlag className="text-sky-400 w-4" />
                <span className="text-slate-400">Country:</span>
                <span className="text-white font-medium">{detail.idCountry || "—"}</span>
              </div>
            </div>

            {/* ID Images */}
            <div className="border-t border-slate-800 pt-3 space-y-3">
              <div className="text-xs uppercase text-slate-500 tracking-wide font-semibold">Identification Images</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Front</div>
                  {detail.frontImageUrl ? (
                    <img
                      src={detail.frontImageUrl}
                      alt="ID Front"
                      className="w-full rounded-lg border border-slate-700 cursor-pointer hover:opacity-80 hover:border-emerald-500 transition object-cover max-h-48"
                      onClick={() => setEnlargedImage(detail.frontImageUrl)}
                    />
                  ) : (
                    <div className="w-full h-32 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center text-xs text-slate-500">
                      No front image
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Back</div>
                  {detail.backImageUrl ? (
                    <img
                      src={detail.backImageUrl}
                      alt="ID Back"
                      className="w-full rounded-lg border border-slate-700 cursor-pointer hover:opacity-80 hover:border-emerald-500 transition object-cover max-h-48"
                      onClick={() => setEnlargedImage(detail.backImageUrl)}
                    />
                  ) : (
                    <div className="w-full h-32 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center text-xs text-slate-500">
                      No back image
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-400 py-6 text-center">No customer data available.</div>
        )}
      </div>

      {/* Enlarged image overlay */}
      {enlargedImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => { e.stopPropagation(); setEnlargedImage(null); }}>
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setEnlargedImage(null)}
              className="absolute -top-3 -right-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full w-8 h-8 flex items-center justify-center z-10 shadow-lg">
              <FaTimes />
            </button>
            <img src={enlargedImage} alt="ID Enlarged" className="max-w-full max-h-[85vh] rounded-xl border border-slate-600 shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
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

  /* ── service block calendar (amber theme) ── */
  .service-calendar .rdrCalendarWrapper,
  .service-calendar .rdrDateDisplayWrapper,
  .service-calendar .rdrMonths,
  .service-calendar .rdrMonth {
    background: #ffffff !important;
    color: #1e293b !important;
  }
  .service-calendar .rdrCalendarWrapper {
    border-radius: 12px !important;
    overflow: hidden;
    border: 1px solid #fcd34d;
    width: 100% !important;
  }
  .service-calendar .rdrMonth {
    width: 100% !important;
  }
  .service-calendar .rdrMonthAndYearWrapper {
    background: #fffbeb !important;
    padding-top: 8px;
  }
  .service-calendar .rdrMonthAndYearPickers select {
    background: #fef3c7 !important;
    color: #92400e !important;
    border: 1px solid #fcd34d !important;
    border-radius: 6px !important;
    padding: 4px 8px !important;
    font-weight: 600 !important;
  }
  .service-calendar .rdrWeekDay {
    color: #b45309 !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
  }
  .service-calendar .rdrDayNumber span {
    color: #1e293b !important;
    font-weight: 700 !important;
  }
  .service-calendar .rdrDayDisabled {
    background-color: #fff1f2 !important;
  }
  .service-calendar .rdrDayDisabled .rdrDayNumber span {
    color: #fca5a5 !important;
    text-decoration: line-through !important;
  }
  .service-calendar .rdrStartEdge,
  .service-calendar .rdrEndEdge {
    background: rgba(245, 158, 11, 0.35) !important;
    border-radius: 8px !important;
  }
  .service-calendar .rdrInRange {
    background: rgba(245, 158, 11, 0.15) !important;
  }
  .service-calendar .rdrDayToday .rdrDayNumber span {
    color: #d97706 !important;
    font-weight: 800 !important;
  }
  .service-calendar .rdrDayToday .rdrDayNumber span::after {
    background: #d97706 !important;
  }
  .service-calendar .rdrNextPrevButton {
    background: #fef3c7 !important;
    border-radius: 8px !important;
    border: 1px solid #fcd34d !important;
  }
`;

/* ═══════════════════════════ MAIN DASHBOARD ═══════════════════════════ */

const HostDashboard = () => {
  const navigate = useNavigate();
  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [selectedCarIds, setSelectedCarIds] = useState([]);
  // FIX 1: serviceDates is the source of truth for the service block date picker
  const [serviceDates, setServiceDates] = useState([{ startDate: new Date(), endDate: addDays(new Date(), 1), key: "selection" }]);
  const [selectedRange, setSelectedRange] = useState([{ startDate: new Date(), endDate: addDays(new Date(), 1), key: "selection" }]);
  const [pricingByCar, setPricingByCar] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [serviceError, setServiceError] = useState("");

  // Customer detail modal state
  const [customerModal, setCustomerModal] = useState(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState(null);

  const handleViewCustomer = async (bookingId) => {
    if (!bookingId) return;
    setCustomerLoading(true);
    setCustomerModal(null);
    setEnlargedImage(null);
    try {
      const detail = await getBookingCustomerDetail(bookingId);
      setCustomerModal(detail);
    } catch (err) {
      console.error("Failed to fetch customer detail", err);
      setCustomerModal(null);
    } finally {
      setCustomerLoading(false);
    }
  };

  const closeCustomerModal = () => {
    setCustomerModal(null);
    setCustomerLoading(false);
    setEnlargedImage(null);
  };

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

  // ─── FIX 1: Use serviceDates (not selectedRange) when blocking ───
  const handleBlockService = async () => {
    setServiceError("");
    try {
      const dates = eachDay(serviceDates[0].startDate, serviceDates[0].endDate);
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
      setServiceDates([{ startDate: new Date(), endDate: addDays(new Date(), 1), key: "selection" }]);
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

  // Selected range display helpers
  const selectedRangeObj = selectedRange[0] || null;
  const selectedDates = selectedRangeObj ? eachDay(selectedRangeObj.startDate, selectedRangeObj.endDate) : [];
  const selectedRangeLabel = selectedRangeObj
    ? `${format(selectedRangeObj.startDate, "dd/MM/yyyy")} → ${format(selectedRangeObj.endDate, "dd/MM/yyyy")}`
    : "Select dates";

  const selectedRangeCars = selectedDates.flatMap((d) => {
    const isoStr = format(d, "yyyy-MM-dd");
    const items = dayCars[isoStr] || [];
    const bookingEntries = items.map((c) => ({ ...c, __dateLabel: format(d, "dd/MM/yyyy"), __isoDate: isoStr }));

    // FIX: Also include service block entries for this date
    const serviceBlocks = calendar?.serviceBlocks || [];
    const serviceEntries = serviceBlocks
      .filter((sb) => String(sb.date).slice(0, 10) === isoStr)
      .map((sb) => ({
        car: sb.car || "Car",
        status: "service",
        __dateLabel: format(d, "dd/MM/yyyy"),
        __isoDate: isoStr,
        __isServiceBlock: true,
      }));

    return [...bookingEntries, ...serviceEntries];
  });

  // Holidays that fall within the selected date range
  const holidaysInRange = useMemo(() => {
    return selectedDates
      .map((d) => {
        const isoStr = format(d, "yyyy-MM-dd");
        const holiday = holidayByDate.get(isoStr);
        return holiday ? { ...holiday, dateLabel: format(d, "dd/MM/yyyy") } : null;
      })
      .filter(Boolean);
  }, [selectedDates, holidayByDate]);

  // ─── FIX 2 & 3: Derive data for selected cars in the service block ───

  // Full car objects for selected IDs — used to render detail cards
  const selectedCarsData = useMemo(
    () => cars.filter((c) => selectedCarIds.includes(c._id)),
    [cars, selectedCarIds]
  );

  // FIX 3: Collect every date where a selected car already has a booking
  // so we can disable those days on the service date picker
  const bookedDatesForSelectedCars = useMemo(() => {
    if (!selectedCarIds.length) return [];
    const dateSet = new Set();
    Object.entries(dayCars).forEach(([isoDate, entries]) => {
      entries.forEach((entry) => {
        if (entry.carId && selectedCarIds.includes(entry.carId)) {
          dateSet.add(isoDate);
        }
      });
    });
    // Convert ISO strings to Date objects at noon to avoid timezone edge cases
    return Array.from(dateSet).map((iso) => new Date(`${iso}T12:00:00`));
  }, [selectedCarIds, dayCars]);

  // Check if the current service date selection overlaps any booked date
  const serviceOverlapDates = useMemo(() => {
    if (!bookedDatesForSelectedCars.length) return [];
    const bookedIsos = new Set(
      bookedDatesForSelectedCars.map((d) => format(d, "yyyy-MM-dd"))
    );
    return eachDay(serviceDates[0].startDate, serviceDates[0].endDate)
      .map((d) => format(d, "yyyy-MM-dd"))
      .filter((iso) => bookedIsos.has(iso));
  }, [serviceDates, bookedDatesForSelectedCars]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading host center…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-10">
      <style>{CALENDAR_STYLES}</style>

      {/* Customer Detail Modal */}
      {(customerModal || customerLoading) && (
        <CustomerDetailModal
          detail={customerModal}
          loading={customerLoading}
          onClose={closeCustomerModal}
          enlargedImage={enlargedImage}
          setEnlargedImage={setEnlargedImage}
        />
      )}

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
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-400"></span> Service block
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

                  // FIX: Check if any service block exists for this date
                  const serviceBlocks = calendar?.serviceBlocks || [];
                  const serviceBlocksOnDay = serviceBlocks.filter(
                    (sb) => String(sb.date).slice(0, 10) === isoDate
                  );
                  const hasServiceBlock = serviceBlocksOnDay.length > 0;

                  let bgClass = "";
                  if (holiday && hasBookings) bgClass = "bg-amber-100";
                  else if (holiday) bgClass = "bg-amber-50";
                  else if (hasServiceBlock && hasBookings) bgClass = "bg-orange-50";
                  else if (hasServiceBlock) bgClass = "bg-orange-50";
                  else if (hasBookings) bgClass = "bg-emerald-50";
                  else if (isWknd) bgClass = "bg-slate-100";

                  let ringClass = "";
                  if (holiday) ringClass = "ring-2 ring-amber-400";
                  else if (hasServiceBlock) ringClass = "ring-2 ring-orange-400";
                  else if (hasBookings) ringClass = "ring-1 ring-emerald-400";
                  else if (isWknd) ringClass = "ring-1 ring-slate-200";

                  return (
                    <div className={`host-cal-cell relative w-full h-full flex flex-col items-center justify-end rounded-md overflow-hidden px-0.5 pb-[3px] pt-[20px] ${bgClass} ${ringClass}`}>
                      <div className="absolute inset-x-0 top-1 flex justify-center pointer-events-none z-30">
                        <span className="text-slate-900 font-bold text-sm leading-none">{format(date, "d")}</span>
                      </div>
                      <div className="flex items-center gap-[3px] z-20">
                        {holiday && (
                          <span className="w-[6px] h-[6px] rounded-full bg-amber-500 shadow-[0_0_3px_rgba(245,158,11,0.4)]" title={holiday.label}></span>
                        )}
                        {hasBookings && (
                          <span className="w-[6px] h-[6px] rounded-full bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.4)]" title={`${carsOnDay.length} car(s) booked`}></span>
                        )}
                        {hasServiceBlock && (
                          <span className="w-[6px] h-[6px] rounded-full bg-orange-400 shadow-[0_0_3px_rgba(251,146,60,0.4)]" title={`${serviceBlocksOnDay.length} car(s) in service`}></span>
                        )}
                      </div>
                      {hasBookings && (
                        <span className="text-[9px] leading-none text-emerald-700 font-bold mt-[1px] z-20">
                          {carsOnDay.length} car{carsOnDay.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {hasServiceBlock && !hasBookings && (
                        <span className="text-[8px] leading-none text-orange-600 font-bold mt-[1px] z-20">
                          🔧 {serviceBlocksOnDay.length}
                        </span>
                      )}
                      {holiday && !hasBookings && !hasServiceBlock && (
                        <span className="text-[8px] leading-none text-amber-700 truncate max-w-[46px] mt-[1px] font-semibold z-20">
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
            {selectedDates.length > 0 ? (
              <div className="space-y-3">
                <div className="text-sm text-slate-200 font-medium">{selectedRangeLabel}</div>

                {/* ── Holidays in selected range ── */}
                {holidaysInRange.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                      <FaFlag /> Holidays in selected range
                    </div>
                    {holidaysInRange.map((h, idx) => (
                      <div key={`holiday-${h.date}-${idx}`} className="text-xs text-amber-200 bg-amber-900/30 border border-amber-800/40 rounded px-2 py-1.5 flex items-center gap-2">
                        <FaCalendarAlt className="text-amber-500 shrink-0" />
                        <span className="font-medium">{h.dateLabel}</span>
                        <span className="text-amber-300">—</span>
                        <span>{h.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Bookings + Service Blocks in selected range (grouped by day with dividers) ── */}
                {selectedRangeCars.length === 0 && (
                  <div className="text-sm text-slate-400">No cars booked or blocked in this range.</div>
                )}
                <div className="space-y-1 max-h-[400px] overflow-auto pr-1">
                  {(() => {
                    let lastDate = null;
                    return selectedRangeCars.map((c, idx) => {
                      const showDivider = c.__dateLabel !== lastDate;
                      lastDate = c.__dateLabel;

                      return (
                        <React.Fragment key={`${c.bookingId || "sb"}-${c.__dateLabel}-${idx}`}>
                          {/* Day divider */}
                          {showDivider && (
                            <div className={`flex items-center gap-2 ${idx > 0 ? "pt-3 mt-2 border-t border-slate-700" : ""}`}>
                              <FaCalendarAlt className="text-emerald-400 text-xs shrink-0" />
                              <span className="text-xs font-semibold text-emerald-400">{c.__dateLabel}</span>
                              <div className="flex-1 h-px bg-slate-700" />
                            </div>
                          )}

                          {/* FIX: Service block card — rendered differently from booking cards */}
                          {c.__isServiceBlock ? (
                            <div className="border border-orange-800/50 rounded-lg p-3 text-sm bg-orange-950/40">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-semibold text-orange-200 flex items-center gap-1.5">
                                  <FaWrench className="text-orange-400 shrink-0" /> {c.car}
                                </span>
                                <Pill tone="orange">service</Pill>
                              </div>
                              <div className="text-xs text-orange-300 mt-1 flex items-center gap-1.5">
                                <FaFlag className="text-orange-500 shrink-0" /> Blocked for maintenance / service
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {c.__dateLabel}
                              </div>
                            </div>
                          ) : (
                            /* Booking card (existing) */
                            <div
                              className="border border-slate-800 rounded-lg p-3 text-sm bg-slate-950/60 cursor-pointer hover:border-emerald-500 hover:bg-slate-950/80 transition-all group"
                              onClick={() => handleViewCustomer(c.bookingId)}
                            >
                              {/* Car Make & Model + Status */}
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-semibold text-white flex items-center gap-1.5">
                                  <FaCar className="text-amber-400 shrink-0" /> {c.car}
                                </span>
                                <Pill tone="blue">{c.status}</Pill>
                              </div>

                              {/* Booking Number */}
                              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                                <FaList className="text-slate-500 shrink-0" /> Booking #{c.bookingId}
                              </div>

                              {/* Identification — only show if doc type exists */}
                              {c.verificationDocType && (
                                <div className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                                  <FaIdCard className="text-sky-400 shrink-0" />
                                  {c.verificationDocType}
                                  {c.verificationIdNumber ? `: ${c.verificationIdNumber}` : ""}
                                </div>
                              )}

                              {/* Customer Name */}
                              {c.customerName && c.customerName !== "Unknown" && (
                                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                                  <FaUser className="text-slate-500 shrink-0" /> {c.customerName}
                                </div>
                              )}

                              {/* Click hint */}
                              <div className="text-[10px] text-gray-400 mt-1.5 group-hover:text-emerald-500 transition-opacity">
                                Click to view full customer details & ID images →
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">Select a date range to see booked cars.</div>
            )}
          </div>
        </section>

        {/* ══════════════ SERVICE BLOCK + TODAY PICKUPS/RETURNS ══════════════ */}
        <section className="grid lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 lg:col-span-1">
            <div className="flex items-center gap-2 font-semibold">
              <FaFlag className="text-amber-400" /> Block cars for maintenance
            </div>

            {/* ── Step 1: Select cars ── */}
            <div className="space-y-2">
              <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Step 1 — Select cars</div>
              <PredictiveMultiSelect
                options={cars.map((c) => ({
                  value: c._id,
                  // FIX 2: Richer label includes year so host can distinguish duplicates
                  label: `${c.make} ${c.model}${c.year ? ` (${c.year})` : ""}${c.plateNumber ? ` · ${c.plateNumber}` : ""}`,
                }))}
                value={selectedCarIds}
                onChange={setSelectedCarIds}
              />
            </div>

            {/* FIX 2: Car detail cards for each selected car ── */}
            {selectedCarsData.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Selected car details</div>
                <div className="space-y-2 max-h-48 overflow-auto pr-1">
                  {selectedCarsData.map((c) => (
                    <div
                      key={c._id}
                      className="bg-slate-800/70 border border-amber-800/50 rounded-lg px-3 py-2 flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white flex items-center gap-1.5 truncate">
                          <FaCar className="text-amber-400 shrink-0" />
                          {c.make} {c.model}
                          {c.year && <span className="text-slate-400 font-normal">({c.year})</span>}
                        </div>
                        {c.plateNumber && (
                          <div className="text-xs text-amber-300 font-mono mt-0.5">{c.plateNumber}</div>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {c.category && <span className="text-xs text-slate-400">{c.category}</span>}
                          {c.transmission && <span className="text-xs text-slate-400">{c.transmission}</span>}
                          {c.fuelType && <span className="text-xs text-slate-400">{c.fuelType}</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          RM {c.dailyRate}/day · Dep RM {c.deposit || 0}
                        </div>
                      </div>
                      {/* Remove button for this car */}
                      <button
                        onClick={() => setSelectedCarIds((prev) => prev.filter((id) => id !== c._id))}
                        className="shrink-0 text-slate-500 hover:text-rose-400 transition mt-0.5"
                        title="Remove"
                      >
                        <FaTimes size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 2: Pick service dates ── */}
            <div className="space-y-2">
              <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Step 2 — Pick service dates</div>

              {/* FIX 3: Legend for the service calendar */}
              {selectedCarIds.length > 0 && (
                <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400"></span>
                    Booked — cannot block
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    Available to block
                  </span>
                </div>
              )}

              {/* FIX 3: Service DateRange now disables booked dates for selected cars */}
              <div className="service-calendar">
                <DateRange
                  onChange={(item) => setServiceDates([item.selection])}
                  ranges={serviceDates}
                  rangeColors={["#f59e0b"]}
                  minDate={new Date()}
                  showPreview={false}
                  weekStartsOn={1}
                  disabledDates={bookedDatesForSelectedCars}
                />
              </div>
            </div>

            {/* FIX 3: Overlap warning ── */}
            {serviceOverlapDates.length > 0 && (
              <div className="bg-rose-950/60 border border-rose-700/50 rounded-lg px-3 py-2 flex items-start gap-2 text-xs text-rose-300">
                <FaExclamationTriangle className="text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-rose-200 mb-0.5">Booking conflict detected</div>
                  The selected date range overlaps with existing bookings on{" "}
                  <span className="font-mono text-rose-100">
                    {serviceOverlapDates.slice(0, 3).join(", ")}
                    {serviceOverlapDates.length > 3 ? ` + ${serviceOverlapDates.length - 3} more` : ""}
                  </span>. Those dates are disabled and will be skipped when blocking.
                </div>
              </div>
            )}

            {serviceError && <div className="text-xs text-rose-300">{serviceError}</div>}

            <button
              disabled={!selectedCarIds.length}
              onClick={handleBlockService}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg py-2 font-semibold flex items-center justify-center gap-2"
            >
              <FaFlag />
              Block {selectedCarIds.length > 0 ? `${selectedCarIds.length} car${selectedCarIds.length > 1 ? "s" : ""}` : "selected cars"} for these dates
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
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to filter by make, model, plate…"
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