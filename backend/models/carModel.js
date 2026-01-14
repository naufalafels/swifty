import mongoose from "mongoose";
const { Schema } = mongoose;

import Booking from "./bookingModel.js"; // used by computeAvailabilityForCars

const bookingSubSchema = new Schema({
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  pickupDate: Date,
  returnDate: Date,
  status: { type: String, enum: ['pending','active','completed','cancelled','upcoming'], default: 'pending' }
}, { _id: false });

const carSchema = new Schema({
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: Number,
  color: String,
  category: String,
  seats: Number,
  transmission: String,
  fuelType: String,
  mileage: Number,
  dailyRate: { type: Number, required: true },
  status: { type: String, enum: ['available','rented','maintenance'], default: 'available' },
  image: String,

  // Multi-tenant: which company owns this car
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },

  // optional pickup location
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },

  bookings: { type: [bookingSubSchema], default: [] }
}, { timestamps: true });

carSchema.index({ location: '2dsphere' });
carSchema.index({ companyId: 1 });

// Blocking statuses (same as booking controller)
const BLOCKING_STATUSES = ['pending', 'active', 'upcoming'];

/**
 * Compute availability for an array of car plain objects.
 * - queries Booking collection to get the authoritative bookings for the cars
 * - returns a new array of cars with `.bookings` (merged) and `.availability` fields
 *
 * Availability shape:
 * - { state: 'booked', until: ISODateString, source: 'bookings' }
 * - { state: 'available_until_reservation', daysAvailable: Number, nextBookingStarts: ISO, until: ISO }
 * - { state: 'fully_available', source: 'none' }
 */
carSchema.statics.computeAvailabilityForCars = async function (cars) {
  if (!Array.isArray(cars) || cars.length === 0) return [];

  // helper to normalize ID string
  const getIdStr = (v) => {
    try {
      if (!v) return null;
      if (typeof v === 'string') return v;
      if (v._id) return String(v._id);
      if (v.id) return String(v.id);
      return String(v);
    } catch { return null; }
  };

  // collect car ids
  const idMap = {};
  const carIds = [];
  for (const c of cars) {
    const cid = getIdStr(c._id || c.id);
    if (!cid) continue;
    idMap[cid] = true;
    carIds.push(cid);
  }

  // Fetch bookings for these cars (blocking statuses)
  let bookings = [];
  try {
    bookings = await Booking.find({
      "car.id": { $in: carIds },
      status: { $in: BLOCKING_STATUSES }
    }).lean();
  } catch (err) {
    // If booking query fails, we will still fallback to using car.bookings if present
    console.warn("computeAvailabilityForCars: failed to query bookings:", err);
    bookings = [];
  }

  // group bookings by car id
  const bookingsByCar = {};
  for (const b of bookings) {
    const cid = getIdStr(b?.car?.id);
    if (!cid) continue;
    bookingsByCar[cid] = bookingsByCar[cid] || [];
    bookingsByCar[cid].push(b);
  }

  // helper date normalizers
  const toDate = (v) => (v ? new Date(v) : null);
  const startOfDay = (d) => {
    if (!d) return null;
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const daysBetween = (from, to) => {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    try {
      const a = startOfDay(from);
      const b = startOfDay(to);
      return Math.ceil((b - a) / MS_PER_DAY);
    } catch {
      return 0;
    }
  };

  const today = new Date();
  const results = [];

  for (const car of cars) {
    const cid = getIdStr(car._id || car.id);
    // Start with any bookings present on the car doc (may be stale)
    const carBookingsFromDoc = Array.isArray(car.bookings) ? car.bookings.slice() : [];

    // bookings from Booking collection that we fetched
    const fromBookings = bookingsByCar[cid] || [];

    // Merge them and deduplicate by bookingId
    const merged = [];
    const seen = {};
    const pushIfNew = (entry, source) => {
      if (!entry) return;
      const bid = getIdStr(entry.bookingId || entry._id || entry.id);
      if (!bid) return;
      if (seen[bid]) return;
      seen[bid] = true;

      // normalize shape: ensure pickupDate and returnDate present as ISO strings
      const pickup = toDate(entry.pickupDate || entry.startDate || entry.start || entry.from);
      const ret = toDate(entry.returnDate || entry.endDate || entry.end || entry.to);
      merged.push({
        bookingId: bid,
        pickupDate: pickup ? pickup.toISOString() : null,
        returnDate: ret ? ret.toISOString() : null,
        status: entry.status || "pending",
        _source: source,
      });
    };

    for (const b of carBookingsFromDoc) pushIfNew(b, 'carDoc');
    for (const b of fromBookings) pushIfNew(b, 'bookingCol');

    // compute availability
    let availability = { state: "fully_available", source: "none" };

    // check bookings that cover today
    const overlapping = merged
      .map((b) => {
        const p = toDate(b.pickupDate);
        const r = toDate(b.returnDate);
        return p && r ? { pickup: p, return: r, raw: b } : null;
      })
      .filter(Boolean)
      .filter((b) => startOfDay(b.pickup) <= startOfDay(today) && startOfDay(today) <= startOfDay(b.return));

    if (overlapping.length > 0) {
      overlapping.sort((a, b) => b.return - a.return);
      availability = {
        state: "booked",
        until: overlapping[0].return.toISOString(),
        source: "bookings",
      };
    } else {
      // find next upcoming booking (pickup > today)
      const upcoming = merged
        .map((b) => {
          const p = toDate(b.pickupDate);
          const r = toDate(b.returnDate);
          return p && r ? { pickup: p, return: r, raw: b } : null;
        })
        .filter(Boolean)
        .filter((b) => startOfDay(b.pickup) > startOfDay(today))
        .sort((a, b) => a.pickup - b.pickup);

      if (upcoming.length > 0) {
        const next = upcoming[0];
        const daysAvailable = daysBetween(today, next.pickup);
        availability = {
          state: "available_until_reservation",
          daysAvailable,
          nextBookingStarts: next.pickup.toISOString(),
          until: next.return.toISOString(),
          source: "bookings",
        };
      } else {
        // no blocking bookings -> fully available
        availability = { state: "fully_available", source: "none" };
      }
    }

    // Attach merged bookings and availability to returned car object (do not modify original input object to avoid surprises)
    const out = { ...car, bookings: merged, availability };
    results.push(out);
  }

  return results;
};

export default mongoose.models.Car || mongoose.model('Car', carSchema);