import mongoose from "mongoose";
const { Schema } = mongoose;

import Booking from "./bookingModel.js"; // used by computeAvailabilityForCars

const bookingSubSchema = new Schema({
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  pickupDate: Date,
  returnDate: Date,
  status: {
    type: String,
    enum: ['awaiting_payment','pending','active','completed','cancelled','upcoming'],
    default: 'awaiting_payment'
  }
}, { _id: false });

// ─── FIX: flexiblePricing sub-schemas (were missing — Mongoose strict mode silently
//     dropped every upsertFlexiblePricing write because the field wasn't in the schema) ───
const peakMultiplierSchema = new Schema({
  label:             { type: String, default: "Peak" },
  start:             { type: String, default: "" },
  end:               { type: String, default: "" },
  multiplier:        { type: Number, default: 1.2 },
  depositMultiplier: { type: Number, default: 1.1 },
}, { _id: false });

const flexiblePricingSchema = new Schema({
  baseDailyRate:            { type: Number, default: 0 },
  baseDeposit:              { type: Number, default: 0 },
  weekendMultiplier:        { type: Number, default: 1 },
  depositWeekendMultiplier: { type: Number, default: 1 },
  peakMultipliers:          { type: [peakMultiplierSchema], default: [] },
}, { _id: false });

const carSchema = new Schema({
  make:         { type: String, required: true },
  model:        { type: String, required: true },
  year:         Number,
  color:        String,
  category:     String,
  seats:        Number,
  transmission: String,
  fuelType:     String,
  petrolType:   { type: [String], default: [] },
  mileage:      Number,
  dailyRate:    { type: Number, required: true },
  deposit:      { type: Number, default: 0 },
  gasUsage:     { type: String, default: "" },

  // FIX: description was used in carController.createCar but was missing from schema
  description:  { type: String, default: "" },

  // FIX: plateNumber used in frontend car detail cards but was missing from schema
  plateNumber:  { type: String, default: "" },

  status: { type: String, enum: ['available','rented','maintenance'], default: 'available' },
  image:  String,

  // ─── Ownership fields ───
  // FIX: hostId, ownerId, createdBy are all used in hostCarFilter() and createHostCar()
  //     but were missing from the schema, so host car lookups silently returned nothing
  hostId:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
  ownerId:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

  // Always owned by a User (Host)
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  companyName: { type: String, default: '' },

  // optional pickup location
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },

  // ─── FIX: flexiblePricing was referenced everywhere but missing from schema ───
  // Without this field Mongoose strict mode silently drops all pricing writes
  flexiblePricing: { type: flexiblePricingSchema, default: () => ({}) },

  // ─── FIX: serviceBlocks — THE core missing field causing the entire feature to fail ───
  // hostController.blockServiceDates() saves ISO date strings here via $addToSet.
  // Without this field in the schema, Mongoose strict mode silently drops every single
  // write, meaning no dates were ever persisted and booking creation never saw them.
  serviceBlocks: { type: [String], default: [] },

  bookings: { type: [bookingSubSchema], default: [] }

}, { timestamps: true });

carSchema.index({ location: '2dsphere' });
carSchema.index({ companyId: 1 });
carSchema.index({ hostId: 1 });
carSchema.index({ ownerId: 1 });

// Blocking statuses (same as booking controller)
const BLOCKING_STATUSES = ['pending', 'active', 'upcoming'];

/**
 * Compute availability for an array of car plain objects.
 * - Queries Booking collection to get the authoritative bookings for the cars.
 * - FIX: Now also reads car.serviceBlocks so service-blocked days show as
 *   unavailable on the car listing page and block new bookings visually.
 *
 * Availability shape:
 * - { state: 'booked', until: ISODateString, source: 'bookings' }
 * - { state: 'service_block', source: 'serviceBlocks' }
 * - { state: 'available_until_reservation', daysAvailable, nextBookingStarts, until, source }
 * - { state: 'fully_available', source: 'none' }
 */
carSchema.statics.computeAvailabilityForCars = async function (cars) {
  if (!Array.isArray(cars) || cars.length === 0) return [];

  const getIdStr = (v) => {
    try {
      if (!v) return null;
      if (typeof v === 'string') return v;
      if (v._id) return String(v._id);
      if (v.id) return String(v.id);
      return String(v);
    } catch { return null; }
  };

  const carIds = [];
  for (const c of cars) {
    const cid = getIdStr(c._id || c.id);
    if (cid) carIds.push(cid);
  }

  // Fetch active bookings for these cars
  let bookings = [];
  try {
    bookings = await Booking.find({
      "car.id": { $in: carIds },
      status: { $in: BLOCKING_STATUSES }
    }).lean();
  } catch (err) {
    console.warn("computeAvailabilityForCars: failed to query bookings:", err);
    bookings = [];
  }

  // Group bookings by car id
  const bookingsByCar = {};
  for (const b of bookings) {
    const cid = getIdStr(b?.car?.id);
    if (!cid) continue;
    bookingsByCar[cid] = bookingsByCar[cid] || [];
    bookingsByCar[cid].push(b);
  }

  const toDate = (v) => (v ? new Date(v) : null);
  const startOfDay = (d) => {
    if (!d) return null;
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const isoDate = (d) => {
    if (!d) return null;
    return startOfDay(d).toISOString().slice(0, 10);
  };
  const daysBetween = (from, to) => {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    try {
      return Math.ceil((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);
    } catch { return 0; }
  };

  const today = new Date();
  const todayIso = isoDate(today);
  const results = [];

  for (const car of cars) {
    const cid = getIdStr(car._id || car.id);

    // Merge car.bookings (embedded, may be stale) with live Booking collection results
    const carBookingsFromDoc = Array.isArray(car.bookings) ? car.bookings.slice() : [];
    const fromBookings = bookingsByCar[cid] || [];

    const merged = [];
    const seen = {};
    const pushIfNew = (entry, source) => {
      if (!entry) return;
      const bid = getIdStr(entry.bookingId || entry._id || entry.id);
      if (!bid || seen[bid]) return;
      seen[bid] = true;
      const pickup = toDate(entry.pickupDate || entry.startDate || entry.start || entry.from);
      const ret    = toDate(entry.returnDate  || entry.endDate   || entry.end   || entry.to);
      merged.push({
        bookingId: bid,
        pickupDate: pickup ? pickup.toISOString() : null,
        returnDate: ret    ? ret.toISOString()    : null,
        status: entry.status || "pending",
        _source: source,
      });
    };
    for (const b of carBookingsFromDoc) pushIfNew(b, 'carDoc');
    for (const b of fromBookings)       pushIfNew(b, 'bookingCol');

    // ─── FIX: Build a Set of service-blocked ISO dates for O(1) lookup ───
    const serviceBlockSet = new Set(
      Array.isArray(car.serviceBlocks)
        ? car.serviceBlocks.map((d) => String(d).slice(0, 10)).filter(Boolean)
        : []
    );

    // ── Compute availability ──────────────────────────────────────────────
    let availability = { state: "fully_available", source: "none" };

    // FIX: If today itself is a service block, report it immediately
    if (serviceBlockSet.has(todayIso)) {
      availability = { state: "service_block", source: "serviceBlocks" };
    } else {
      // Check if any booking covers today
      const overlapping = merged
        .map((b) => {
          const p = toDate(b.pickupDate);
          const r = toDate(b.returnDate);
          return p && r ? { pickup: p, return: r, raw: b } : null;
        })
        .filter(Boolean)
        .filter((b) =>
          startOfDay(b.pickup) <= startOfDay(today) &&
          startOfDay(today) <= startOfDay(b.return)
        );

      if (overlapping.length > 0) {
        overlapping.sort((a, b) => b.return - a.return);
        availability = {
          state: "booked",
          until: overlapping[0].return.toISOString(),
          source: "bookings",
        };
      } else {
        // Find next future booking
        const upcomingBookings = merged
          .map((b) => {
            const p = toDate(b.pickupDate);
            const r = toDate(b.returnDate);
            return p && r ? { pickup: p, return: r, raw: b } : null;
          })
          .filter(Boolean)
          .filter((b) => startOfDay(b.pickup) > startOfDay(today))
          .sort((a, b) => a.pickup - b.pickup);

        // FIX: Find the next future service block date
        const futureServiceDates = Array.from(serviceBlockSet)
          .filter((d) => d > todayIso)
          .sort();

        const nextBooking     = upcomingBookings.length    > 0 ? upcomingBookings[0]    : null;
        const nextServiceIso  = futureServiceDates.length  > 0 ? futureServiceDates[0]  : null;

        if (!nextBooking && !nextServiceIso) {
          availability = { state: "fully_available", source: "none" };
        } else {
          // Whichever comes first — booking or service block — wins
          let useBooking = false;
          if      ( nextBooking && !nextServiceIso)  useBooking = true;
          else if (!nextBooking &&  nextServiceIso)  useBooking = false;
          else {
            useBooking = isoDate(nextBooking.pickup) <= nextServiceIso;
          }

          if (useBooking && nextBooking) {
            availability = {
              state: "available_until_reservation",
              daysAvailable: daysBetween(today, nextBooking.pickup),
              nextBookingStarts: nextBooking.pickup.toISOString(),
              until: nextBooking.return.toISOString(),
              source: "bookings",
            };
          } else if (nextServiceIso) {
            const nextServiceDate = new Date(`${nextServiceIso}T00:00:00.000Z`);
            availability = {
              state: "available_until_reservation",
              daysAvailable: daysBetween(today, nextServiceDate),
              nextBookingStarts: nextServiceDate.toISOString(),
              until: nextServiceDate.toISOString(),
              source: "serviceBlocks",
            };
          }
        }
      }
    }

    results.push({ ...car, bookings: merged, availability });
  }

  return results;
};

export default mongoose.models.Car || mongoose.model('Car', carSchema);