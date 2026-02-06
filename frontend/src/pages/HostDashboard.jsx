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
        {booking.car || (booking.carId?.make && booking.carId?.model ? `${booking.carId.make} ${booking.carId.model}` : "Car")}
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
              <input
                type="number"
                min="0"
                value={base}
                onChange={(e) => setBase(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </label>

            <label className="flex flex-col text-sm text-slate-200 gap-1">
              Base deposit (RM)
              <input
                type="number"
                min="0"
                value={baseDep}
                onChange={(e) => setBaseDep(Number(e.target.value))}
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

            <label className="flex flex-col text-sm text-slate-200 gap-1">
              Deposit weekend multiplier
              <input
                type="number"
                step="0.05"
                min="0.5"
                value={depWeekend}
                onChange={(e) => setDepWeekend(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </label>
          </div>

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

          {peak.length > 0 && (
            <div className="space-y-3">
              {peak.map((p, idx) => (
                <div key={idx} className="grid md:grid-cols-5 gap-3 bg-slate-800/60 border border-slate-700 rounded-lg p-3">
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
                  <input
                    type="number"
                    step="0.05"
                    value={p.multiplier}
                    onChange={(e) => updatePeak(idx, "multiplier", Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
                    placeholder="Rate x"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.05"
                      value={p.depositMultiplier}
                      onChange={(e) => updatePeak(idx, "depositMultiplier", Number(e.target.value))}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
                      placeholder="Deposit x"
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
              onClick={() => onSave({
                baseDailyRate: base,
                baseDeposit: baseDep,
                weekendMultiplier: weekend,
                depositWeekendMultiplier: depWeekend,
                peakMultipliers: peak,
              })}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 font-semibold"
            >
              Save pricing
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Build fallback dayCars and today summaries from bookings if API omitted them
const buildDayCarsAndToday = (bookings) => {
  const dayCars = {};
  const now = new Date();
  const todayIso = format(now, "yyyy-MM-dd");
  const pickupsToday = [];
  const returnsToday = [];

  bookings.forEach((b) => {
    const start = new Date(b.pickupDate);
    const end = new Date(b.returnDate || b.pickupDate);
    const carName = b.car || (b.carId?.make && b.carId?.model ? `${b.carId.make} ${b.carId.model}` : "Car");
    const docType = b.verificationDocType || b.userId?.docType || (b.userId?.passportNumber ? "Passport" : b.userId?.nricNumber ? "NRIC" : null);
    const docId = b.verificationIdNumber || b.userId?.passportNumber || b.userId?.nricNumber || b.userId?.idNumber || null;

    let cur = start;
    while (cur <= end) {
      const isoDate = format(cur, "yyyy-MM-dd");
      if (!dayCars[isoDate]) dayCars[isoDate] = [];
      dayCars[isoDate].push({
        carId: b.carId?._id || null,
        car: carName,
        bookingId: b._id,
        status: b.status,
        verificationDocType: docType,
        verificationIdNumber: docId,
      });
      cur = addDays(cur, 1);
    }

    const pickupIso = format(start, "yyyy-MM-dd");
    const returnIso = format(end, "yyyy-MM-dd");
    if (pickupIso === todayIso) pickupsToday.push(b);
    if (returnIso === todayIso) returnsToday.push(b);
  });

  return { dayCars, today: { pickups: pickupsToday, returns: returnsToday } };
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
    return () => {
      mounted = false;
    };
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

  const dateRangeColor = (date) => {
    const isoDate = format(date, "yyyy-MM-dd");
    if (holidayByDate.has(isoDate)) return "ring-2 ring-amber-400";
    if (isWeekend(date)) return "ring-1 ring-emerald-500/60";
    return "";
  };

  const selectedDayCars = selectedDay ? dayCars[selectedDay] || [] : [];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading host center…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-10">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2"
            >
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
            <button
              onClick={() => navigate("/host/add-cars")}
              className="bg-emerald-600 hover:bg-emerald-500 rounded-lg px-4 py-2 flex items-center gap-2 font-semibold"
            >
              <FaPlus /> Add cars
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

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-slate-200">
            <FaSearch /> Quick find (20–40 cars)
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by make/model"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
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

        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <FaCalendarAlt className="text-emerald-400" /> Booking calendar (holidays highlighted, cars per day)
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Pill tone="amber">Holiday ring</Pill>
                <Pill tone="green">Weekend ring</Pill>
              </div>
            </div>
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
                return (
                  <div className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${dateRangeColor(date)}`}>
                    <span>{date.getDate()}</span>
                    {holiday && <span className="text-[10px] text-amber-300 truncate max-w-[64px]">{holiday.label}</span>}
                    {carsOnDay.slice(0, 2).map((c, idx) => (
                      <span key={idx} className="text-[10px] bg-slate-800 text-white px-1 rounded">
                        {c.car}
                      </span>
                    ))}
                    {carsOnDay.length > 2 && (
                      <span className="text-[10px] text-slate-300">+{carsOnDay.length - 2} more</span>
                    )}
                  </div>
                );
              }}
            />
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <FaInfoCircle /> Holidays are informational so you can adjust flexible pricing; selection is allowed.
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <FaList className="text-emerald-400" /> Selected day detail
            </div>
            {selectedDay ? (
              <div className="space-y-2">
                <div className="text-sm text-slate-200">{selectedDay}</div>
                {holidayByDate.get(selectedDay) && (
                  <div className="text-xs text-amber-300 bg-amber-900/40 border border-amber-800 rounded px-2 py-1">
                    Holiday: {holidayByDate.get(selectedDay).label} ({holidayByDate.get(selectedDay).type})
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

            <button
              disabled={!selectedCarIds.length}
              onClick={handleBlockService}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg py-2 font-semibold"
            >
              Block selected cars for these dates
            </button>
          </div>

          <div className="lg:col-span-2 grid gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  <FaList className="text-emerald-400" /> Today’s pickups
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
                  <FaList className="text-amber-400" /> Today’s returns
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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-left text-white flex items-center justify-between"
      >
        <span>{value.length ? `${value.length} car(s) selected` : "Select cars"}</span>
        <FaChevronDown className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to filter"
            className="w-full bg-slate-800 border-b border-slate-800 px-3 py-2 text-sm text-white"
          />
          <div className="max-h-48 overflow-auto">
            {filtered.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-800 text-white cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={value.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                  className="accent-emerald-500"
                />
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