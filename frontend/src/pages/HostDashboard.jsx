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
  FaShieldAlt,
  FaTimes
} from "react-icons/fa";
import {
  getHostCars,
  getHostBookings,
  getHostCalendar,
  blockServiceDates,
  getFlexiblePricing,
  upsertFlexiblePricing,
} from "../services/hostService";
import * as authService from "../utils/authService";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

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

const BookingCard = ({ booking }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
    <div className="flex items-center justify-between gap-2">
      <div className="font-semibold text-white flex items-center gap-2">
        <FaCar className="text-amber-400" />
        {booking.car || "Car"}
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

const PricingCard = ({ car, pricing, onSave }) => {
  const [base, setBase] = useState(pricing?.baseDailyRate || car.dailyRate || 0);
  const [weekend, setWeekend] = useState(pricing?.weekendMultiplier || 1);
  const [peak, setPeak] = useState(pricing?.peakMultipliers || []);

  const addPeak = () => {
    setPeak((p) => [...p, { label: "Peak", start: "", end: "", multiplier: 1.2 }]);
  };

  const updatePeak = (idx, key, value) => {
    setPeak((p) => p.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  };

  const removePeak = (idx) => setPeak((p) => p.filter((_, i) => i !== idx));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-semibold">
          <FaDollarSign className="text-emerald-400" />
          Flexible Pricing — {car.make} {car.model}
        </div>
        <Pill tone="amber">Base RM {base}</Pill>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <label className="flex flex-col text-sm text-slate-200 gap-1">
          Base daily rate (RM)
          <input
            type="number"
            min="0"
            value={base}
            onChange={(e) => setBase(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
        </label>

        <label className="flex flex-col text-sm text-slate-200 gap-1">
          Weekend multiplier
          <input
            type="number"
            step="0.05"
            min="0.5"
            value={weekend}
            onChange={(e) => setWeekend(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
          <span className="text-xs text-slate-400">Applied on Saturday/Sunday</span>
        </label>

        <div className="flex flex-col gap-2">
          <div className="text-sm text-slate-200 flex items-center gap-2">
            <FaFlag className="text-amber-400" /> Peak multipliers
          </div>
          <button
            onClick={addPeak}
            className="text-sm bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg px-3 py-2 flex items-center gap-2"
          >
            <FaPlus /> Add peak window
          </button>
        </div>
      </div>

      {peak.length > 0 && (
        <div className="space-y-3">
          {peak.map((p, idx) => (
            <div key={idx} className="grid md:grid-cols-4 gap-3 bg-slate-800/60 border border-slate-700 rounded-lg p-3">
              <input
                value={p.label}
                onChange={(e) => updatePeak(idx, "label", e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
                placeholder="Label"
              />
              <input
                type="date"
                value={p.start}
                onChange={(e) => updatePeak(idx, "start", e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
              />
              <input
                type="date"
                value={p.end}
                onChange={(e) => updatePeak(idx, "end", e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.05"
                  value={p.multiplier}
                  onChange={(e) => updatePeak(idx, "multiplier", Number(e.target.value))}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
                  placeholder="Multiplier"
                />
                <button
                  onClick={() => removePeak(idx)}
                  className="bg-rose-700 hover:bg-rose-600 text-white rounded px-3 py-2"
                >
                  <FaTimes />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => onSave({ baseDailyRate: base, weekendMultiplier: weekend, peakMultipliers: peak })}
          className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 font-semibold"
        >
          Save pricing
        </button>
      </div>
    </div>
  );
};

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
        setCalendar(calendarRes);
        const map = {};
        await Promise.all(
          (carsRes || []).map(async (c) => {
            try {
              map[c._id] = await getFlexiblePricing(c._id);
            } catch {
              map[c._id] = { baseDailyRate: c.dailyRate || 0, weekendMultiplier: 1, peakMultipliers: [] };
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
    return () => {
      mounted = false;
    };
  }, []);

  const todayPickups = calendar?.today?.pickups || [];
  const todayReturns = calendar?.today?.returns || [];
  const holidays = calendar?.holidays || [];

  const handleBlockService = async () => {
    const dates = eachDay(selectedRange[0].startDate, selectedRange[0].endDate);
    const isoDates = dates.map((d) => format(d, "yyyy-MM-dd"));
    await blockServiceDates(selectedCarIds, isoDates);
    const updated = await getHostCalendar();
    setCalendar(updated);
    setSelectedCarIds([]);
  };

  const handleSavePricing = async (carId, payload) => {
    const saved = await upsertFlexiblePricing(carId, payload);
    setPricingByCar((m) => ({ ...m, [carId]: saved }));
  };

  const dateRangeColor = (date) => {
    const iso = format(date, "yyyy-MM-dd");
    if (holidays.includes(iso)) return "ring-2 ring-amber-400";
    if (isWeekend(date)) return "ring-1 ring-emerald-500/60";
    return "";
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading host center…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-10">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-slate-500">Host Centre</div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FaHome className="text-emerald-400" /> Operations overview
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/host/onboard")}
              className="bg-emerald-600 hover:bg-emerald-500 rounded-lg px-4 py-2 flex items-center gap-2 font-semibold"
            >
              <FaPlus /> Add car / onboarding
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="bg-slate-800 hover:bg-slate-700 rounded-lg px-4 py-2 flex items-center gap-2 font-semibold"
            >
              <FaShieldAlt /> Profile & security
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <StatCard title="Cars" value={cars.length} icon={<FaCar />} tone="blue" />
          <StatCard title="Today pickups" value={todayPickups.length} icon={<FaClipboardCheck />} tone="emerald" />
          <StatCard title="Today returns" value={todayReturns.length} icon={<FaClipboardCheck />} tone="amber" />
        </div>

        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <FaCalendarAlt className="text-emerald-400" /> Booking calendar (holidays highlighted)
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Pill tone="amber">Holidays = amber ring</Pill>
                <Pill tone="green">Weekends = green ring</Pill>
              </div>
            </div>
            <DateRange
              onChange={(item) => setSelectedRange([item.selection])}
              ranges={selectedRange}
              rangeColors={["#10b981"]}
              minDate={new Date()}
              showMonthAndYearPickers
              showPreview={false}
              weekStartsOn={1}
              dayContentRenderer={(date) => (
                <div className={`w-full h-full flex items-center justify-center ${dateRangeColor(date)}`}>
                  {date.getDate()}
                </div>
              )}
            />
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <FaInfoCircle /> Holidays are informational so you can adjust flexible pricing; selection is still allowed.
            </div>
            {holidays.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-slate-200">
                {holidays.slice(0, 12).map((h) => (
                  <span key={h} className="px-2 py-1 rounded-full bg-amber-900/60 border border-amber-700/60">
                    {h}
                  </span>
                ))}
                {holidays.length > 12 && <span className="text-slate-400">…more in backend list</span>}
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <FaFlag className="text-amber-400" /> Block cars for service
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Select cars</div>
              <div className="grid grid-cols-2 gap-2">
                {cars.map((c) => (
                  <button
                    key={c._id}
                    onClick={() =>
                      setSelectedCarIds((ids) =>
                        ids.includes(c._id) ? ids.filter((id) => id !== c._id) : [...ids, c._id]
                      )
                    }
                    className={`rounded-lg border px-3 py-2 text-left ${
                      selectedCarIds.includes(c._id)
                        ? "bg-emerald-700 border-emerald-500"
                        : "bg-slate-800 border-slate-700"
                    }`}
                  >
                    <div className="text-sm font-semibold">{c.make} {c.model}</div>
                    <div className="text-xs text-slate-300">RM {c.dailyRate} / day</div>
                  </button>
                ))}
              </div>
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

            <button
              disabled={!selectedCarIds.length}
              onClick={handleBlockService}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg py-2 font-semibold"
            >
              Block selected cars for these dates
            </button>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <FaList className="text-emerald-400" /> Today’s pickups
              </div>
              <Pill tone="green">{todayPickups.length}</Pill>
            </div>
            <div className="space-y-3">
              {todayPickups.length === 0 && <div className="text-slate-400 text-sm">No pickups today.</div>}
              {todayPickups.map((b) => (
                <BookingCard key={b._id} booking={b} />
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <FaList className="text-amber-400" /> Today’s returns
              </div>
              <Pill tone="amber">{todayReturns.length}</Pill>
            </div>
            <div className="space-y-3">
              {todayReturns.length === 0 && <div className="text-slate-400 text-sm">No returns today.</div>}
              {todayReturns.map((b) => (
                <BookingCard key={b._id} booking={b} />
              ))}
            </div>
          </div>
        </section>

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