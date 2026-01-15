import mongoose from "mongoose";
import Booking from "../models/bookingModel.js";
import Car from "../models/carModel.js";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const BLOCKING_STATUSES = ["pending", "active", "upcoming"];

function tryParseJSON(v) {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

function idToString(v) {
  if (v === null || v === undefined) return null;
  try {
    if (typeof v === "string") return v;
    if (v && (v._id || v.id)) return String(v._id || v.id);
    return String(v);
  } catch {
    return null;
  }
}

function toObjectIdIfValid(val) {
  if (!val) return null;
  try {
    if (typeof val === "string" && mongoose.Types.ObjectId.isValid(val)) return mongoose.Types.ObjectId(val);
    if (val instanceof mongoose.Types.ObjectId) return val;
    if (typeof val === "string") return mongoose.Types.ObjectId(val);
  } catch (e) {
    return null;
  }
  return null;
}

function deleteLocalFileIfPresent(filePath) {
  if (!filePath) return;
  const filename = filePath.replace(/^\/?uploads\/?/, "");
  const full = path.join(UPLOADS_DIR, filename);
  fs.unlink(full, (err) => {
    if (err) console.warn("Failed to delete file:", full, err);
  });
}

/**
 * Build the car snapshot stored inside booking.car
 * Attempts to extract companyId/companyName from several shapes.
 */
function buildCarSummary(src) {
  src = src || {};
  const id = idToString(src.id || src._id || null);

  // company extraction: accept src.company (object or id), src.companyId, src.company_id, src.companyName
  let companyId = null;
  let companyName = null;

  if (src.company) {
    // company may be string id or object
    if (typeof src.company === "string") companyId = src.company;
    else if (src.company._id || src.company.id) companyId = idToString(src.company._id || src.company.id);
    if (src.company.name) companyName = src.company.name;
  }

  if (!companyId && (src.companyId || src.company_id)) companyId = idToString(src.companyId || src.company_id);
  if (!companyName && (src.companyName || src.company_name)) companyName = src.companyName || src.company_name;

  return {
    id: id || null,
    make: src.make || src.name || null,
    model: src.model || null,
    year: src.year ? Number(src.year) : null,
    dailyRate: src.dailyRate ? Number(src.dailyRate) : 0,
    seats: src.seats ? Number(src.seats) : 4,
    transmission: src.transmission || src.trans || null,
    fuelType: src.fuelType || src.fuel || null,
    mileage: src.mileage ? Number(src.mileage) : null,
    image: src.image || src.carImage || "",
    // keep companyId as string here; we'll convert to ObjectId when saving top-level or nested fields where appropriate
    companyId: companyId ? String(companyId) : null,
    companyName: companyName || "",
  };
}

/**
 * Recompute car.status depending on blocking bookings
 */
async function updateCarStatusBasedOnBookings(carId, session = null) {
  if (!carId) return;
  const now = new Date();
  const count = await Booking.countDocuments({
    "car.id": carId,
    status: { $in: BLOCKING_STATUSES },
    returnDate: { $gte: now },
  }).session(session);
  const newStatus = count > 0 ? "rented" : "available";
  await Car.findByIdAndUpdate(carId, { status: newStatus }, { session });
}

// CREATE BOOKING
export const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let { customer, email, phone, car, pickupDate, returnDate, amount, details, address, carImage } =
      req.body;

    if (!customer || !email || !car || !pickupDate || !returnDate) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const pickup = new Date(pickupDate);
    const ret = new Date(returnDate);
    if (Number.isNaN(pickup.getTime()) || Number.isNaN(ret.getTime()) || pickup > ret) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Invalid pickup or return date" });
    }

    // Determine car summary and company info
    let carSummary = null;
    if (typeof car === "string" && /^[0-9a-fA-F]{24}$/.test(car)) {
      const carDoc = await Car.findById(car).session(session).lean();
      if (!carDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: "Car not found" });
      }
      carSummary = buildCarSummary(carDoc);
      // If company on carDoc is populated in some shape, prefer it
      if (!carSummary.companyId && (carDoc.company || carDoc.companyId)) {
        const c = carDoc.company || carDoc.companyId;
        carSummary.companyId = idToString(c);
        carSummary.companyName = (carDoc.company && carDoc.company.name) || carDoc.companyName || carSummary.companyName || "";
      }
    } else {
      const parsed = tryParseJSON(car) || car;
      carSummary = buildCarSummary(parsed);
      if (!carSummary.id) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: "Invalid car payload" });
      }
      const carExists = await Car.exists({ _id: carSummary.id }).session(session);
      if (!carExists) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: "Car not found" });
      }
      const carDoc = await Car.findById(carSummary.id).session(session).lean();
      if (carDoc) {
        const cs = buildCarSummary(carDoc);
        if (!carSummary.companyId) carSummary.companyId = cs.companyId;
        if (!carSummary.companyName) carSummary.companyName = cs.companyName;
      }
    }

    const carId = carSummary.id;

    // Defensive: ensure company info comes from canonical Car record when available
    if (carSummary.id) {
      try {
        const canonicalCar = await Car.findById(carSummary.id).session(session).lean();
        if (canonicalCar && (canonicalCar.companyId || canonicalCar.company)) {
          const c = canonicalCar.company || canonicalCar.companyId;
          carSummary.companyId = idToString(c);
          carSummary.companyName = canonicalCar.companyName || (canonicalCar.company && canonicalCar.company.name) || carSummary.companyName || "";
        }
      } catch (e) {
        // non-fatal: proceed with whatever company info we have
        console.warn("createBooking: failed to fetch canonical car for companyId:", e);
      }
    }

    // Compose bookingData. Embed car snapshot with company info if available.
    const bookingData = {
      userId: req.user && (req.user.id || req.user._id) ? (req.user.id || req.user._id) : null,
      customer,
      email,
      phone,
      car: {
        // try to store id as ObjectId if valid
        id: carSummary.id && mongoose.Types.ObjectId.isValid(carSummary.id) ? mongoose.Types.ObjectId(carSummary.id) : carSummary.id,
        make: carSummary.make,
        model: carSummary.model,
        year: carSummary.year,
        dailyRate: carSummary.dailyRate,
        image: carSummary.image,
        // nested company fields: store as ObjectId if valid, else null (Mongoose will store according to schema)
        companyId: carSummary.companyId && mongoose.Types.ObjectId.isValid(carSummary.companyId) ? mongoose.Types.ObjectId(carSummary.companyId) : (carSummary.companyId || null),
        companyName: carSummary.companyName || "",
      },
      carImage: carImage || carSummary.image || "",
      pickupDate: pickup,
      returnDate: ret,
      amount: Number(amount || 0),
      details: tryParseJSON(details),
      address: tryParseJSON(address),
      paymentStatus: "pending",
      status: "pending",
    };

    // Top-level companyId (for admin filters) — set as ObjectId if possible
    if (carSummary.companyId) {
      const oid = toObjectIdIfValid(carSummary.companyId);
      bookingData.companyId = oid || null;
    }

    // Create booking document inside transaction
    const createdArr = await Booking.create([bookingData], { session });
    const createdBooking = createdArr[0];

    // create booking entry for car document
    const bookingEntry = {
      bookingId: createdBooking._id,
      pickupDate: createdBooking.pickupDate,
      returnDate: createdBooking.returnDate,
      status: createdBooking.status,
    };

    // Atomically push to car.bookings only if no overlapping blocking bookings exist
    const carUpdate = await Car.findOneAndUpdate(
      {
        _id: carId,
        bookings: {
          $not: {
            $elemMatch: {
              status: { $in: BLOCKING_STATUSES },
              pickupDate: { $lte: ret },
              returnDate: { $gte: pickup },
            },
          },
        },
      },
      { $push: { bookings: bookingEntry } },
      { session, new: true }
    );

    if (!carUpdate) {
      // Conflict found, abort
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ success: false, message: "Car is not available for the selected dates" });
    }

    // Recompute car.status
    await updateCarStatusBasedOnBookings(carId, session);

    await session.commitTransaction();
    session.endSession();

    const saved = await Booking.findById(createdBooking._id).lean();
    return res.status(201).json({ success: true, booking: saved });
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error("Error creating booking:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

// GET BOOKINGS (public)
export const getBookings = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 12, 100);
    const search = req.query.search ? req.query.search.trim() : "";
    const status = req.query.status ? req.query.status.trim() : "";
    const carFilter = req.query.car ? req.query.car.trim() : "";
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    const companyFilter = req.query.company ? req.query.company.trim() : "";

    const query = {};
    if (search) {
      const q = { $regex: search, $options: "i" };
      query.$or = [{ customer: q }, { email: q }, { "car.make": q }, { "car.model": q }];
    }

    if (status) query.status = status;
    if (carFilter) {
      if (/^[0-9a-fA-F]{24}$/.test(carFilter)) query["car.id"] = carFilter;
      else query.$or = [...(query.$or || []), { "car.make": { $regex: carFilter, $options: "i" } }, { "car.model": { $regex: carFilter, $options: "i" } }];
    }

    if (companyFilter) {
      if (/^[0-9a-fA-F]{24}$/.test(companyFilter)) {
        // try top-level first, fallback to snapshot
        query.$or = query.$or || [];
        query.$or.push({ companyId: companyFilter }, { "car.companyId": companyFilter });
      } else {
        query["car.companyName"] = { $regex: companyFilter, $options: "i" };
      }
    }

    if (from || to) {
      query.pickupDate = {};
      if (from) query.pickupDate.$gte = from;
      if (to) query.pickupDate.$lte = to;
    }

    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
      .sort({ bookingDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ page, pages: Math.ceil(total / limit), total, data: bookings });
  } catch (err) {
    next(err);
  }
};

// GET MY BOOKINGS (user)
export const getMyBookings = async (req, res, next) => {
  try {
    if (!req.user || (!(req.user.id || req.user._id))) return res.status(401).json({ success: false, message: "Unauthorized" });
    const userId = req.user.id || req.user._id;
    const bookings = await Booking.find({ userId }).sort({ bookingDate: -1 }).lean();
    return res.json(bookings);
  } catch (err) {
    next(err);
  }
};

// UPDATE BOOKING
export const updateBooking = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Booking not found" });
    }

    const prevCarId = booking.car && (booking.car.id ? idToString(booking.car.id) : null);

    // image handling
    if (req.file) {
      if (booking.carImage && booking.carImage.startsWith("/uploads/")) deleteLocalFileIfPresent(booking.carImage);
      booking.carImage = `/uploads/${req.file.filename}`;
    } else if (req.body.carImage !== undefined) {
      if (req.body.carImage && !String(req.body.carImage).startsWith("/uploads/") && booking.carImage && booking.carImage.startsWith("/uploads/")) {
        deleteLocalFileIfPresent(booking.carImage);
      }
      booking.carImage = req.body.carImage || booking.carImage;
    }

    const updatable = ["customer", "email", "phone", "car", "pickupDate", "returnDate", "bookingDate", "status", "amount", "details", "address"];
    for (let i = 0; i < updatable.length; i++) {
      const f = updatable[i];
      if (req.body[f] === undefined) continue;
      if (["pickupDate", "returnDate", "bookingDate"].indexOf(f) >= 0) booking[f] = new Date(req.body[f]);
      else if (f === "amount") booking[f] = Number(req.body[f]);
      else if (f === "details" || f === "address") booking[f] = tryParseJSON(req.body[f]);
      else if (f === "car") {
        const c = tryParseJSON(req.body.car);
        if (c) {
          const summary = buildCarSummary(c);
          if (!summary.id && booking.car && booking.car.id) summary.id = idToString(booking.car.id);
          if (!summary.companyId && booking.car && booking.car.companyId) summary.companyId = idToString(booking.car.companyId);
          if (!summary.companyName && booking.car && booking.car.companyName) summary.companyName = booking.car.companyName || "";
          // assign snapshot fields
          booking.car = {
            id: summary.id && mongoose.Types.ObjectId.isValid(summary.id) ? mongoose.Types.ObjectId(summary.id) : summary.id,
            make: summary.make,
            model: summary.model,
            year: summary.year,
            dailyRate: summary.dailyRate,
            image: summary.image,
            companyId: summary.companyId && mongoose.Types.ObjectId.isValid(summary.companyId) ? mongoose.Types.ObjectId(summary.companyId) : (summary.companyId || null),
            companyName: summary.companyName || "",
          };

          // Defensive: if we have a car id, ensure companyId comes from canonical Car record when available
          if (summary.id) {
            try {
              const canonicalCar = await Car.findById(summary.id).session(session).lean();
              if (canonicalCar && (canonicalCar.companyId || canonicalCar.company)) {
                const cval = canonicalCar.company || canonicalCar.companyId;
                booking.car.companyId = (cval && mongoose.Types.ObjectId.isValid(cval)) ? mongoose.Types.ObjectId(cval) : (cval || booking.car.companyId);
                booking.companyId = toObjectIdIfValid(cval) || booking.companyId || null;
              } else {
                // keep top-level companyId in sync with snapshot if present
                if (summary.companyId) {
                  booking.companyId = toObjectIdIfValid(summary.companyId) || null;
                } else {
                  booking.companyId = null;
                }
              }
            } catch (e) {
              console.warn("updateBooking: failed to fetch canonical car for companyId:", e);
              if (summary.companyId) {
                booking.companyId = toObjectIdIfValid(summary.companyId) || null;
              } else {
                booking.companyId = null;
              }
            }
          } else {
            // keep top-level companyId in sync
            if (summary.companyId) {
              booking.companyId = toObjectIdIfValid(summary.companyId) || null;
            } else {
              booking.companyId = null;
            }
          }
        }
      } else {
        booking[f] = req.body[f];
      }
    }

    // If dates or car changed, ensure no overlap on new car
    const newCarId = booking.car && booking.car.id ? idToString(booking.car.id) : null;
    const pickup = booking.pickupDate;
    const ret = booking.returnDate;
    if (newCarId) {
      const conflict = await Booking.findOne({
        _id: { $ne: booking._id },
        "car.id": newCarId,
        status: { $in: BLOCKING_STATUSES },
        pickupDate: { $lte: ret },
        returnDate: { $gte: pickup },
      }).session(session);
      if (conflict) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ success: false, message: "Updated booking conflicts with existing booking for this car" });
      }
    }

    const updated = await booking.save({ session });

    // If car changed, move booking entry between cars
    if (prevCarId && prevCarId !== newCarId) {
      await Car.findByIdAndUpdate(prevCarId, { $pull: { bookings: { bookingId: updated._id } } }, { session });
      const bookingEntry = { bookingId: updated._id, pickupDate: updated.pickupDate, returnDate: updated.returnDate, status: updated.status };
      const newCarUpdate = await Car.findOneAndUpdate(
        {
          _id: newCarId,
          bookings: {
            $not: {
              $elemMatch: {
                status: { $in: BLOCKING_STATUSES },
                pickupDate: { $lte: updated.returnDate },
                returnDate: { $gte: updated.pickupDate },
              },
            },
          },
        },
        { $push: { bookings: bookingEntry } },
        { session, new: true }
      );
      if (!newCarUpdate) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ success: false, message: "Updated booking conflicts with existing booking on target car" });
      }

      // ensure top-level companyId updated from snapshot
      const newCompanyId = updated.car && updated.car.companyId ? idToString(updated.car.companyId) : null;
      if (newCompanyId) {
        updated.companyId = toObjectIdIfValid(newCompanyId) || null;
        await updated.save({ session });
      } else {
        updated.companyId = null;
        await updated.save({ session });
      }

      await updateCarStatusBasedOnBookings(prevCarId, session);
      await updateCarStatusBasedOnBookings(newCarId, session);
    } else {
      // update bookings entry inside car doc if present, and recompute status
      try {
        if (newCarId) {
          await Car.findByIdAndUpdate(newCarId, { $set: { "bookings.$[elem].status": updated.status, "bookings.$[elem].pickupDate": updated.pickupDate, "bookings.$[elem].returnDate": updated.returnDate } }, { arrayFilters: [{ "elem.bookingId": updated._id }], session });
        }
      } catch (e) {
        // ignore
      }
      await updateCarStatusBasedOnBookings(newCarId, session);
    }

    await session.commitTransaction();
    session.endSession();

    res.json(updated);
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    next(err);
  }
};

// UPDATE STATUS
export const updateBookingStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { status } = req.body;
    if (!status) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Status is required" });
    }
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Booking not found" });
    }

    booking.status = status;
    const updated = await booking.save({ session });

    try {
      const carId = booking.car && booking.car.id ? idToString(booking.car.id) : null;
      if (carId) {
        await Car.findByIdAndUpdate(carId, { $set: { "bookings.$[elem].status": status } }, { arrayFilters: [{ "elem.bookingId": booking._id }], session });
      }
    } catch (e) {
      // ignore
    }

    const carId = booking.car && booking.car.id ? idToString(booking.car.id) : null;
    await updateCarStatusBasedOnBookings(carId, session);

    await session.commitTransaction();
    session.endSession();

    res.json(updated);
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    next(err);
  }
};

// DELETE BOOKING
export const deleteBooking = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.carImage && String(booking.carImage).startsWith("/uploads/")) deleteLocalFileIfPresent(booking.carImage);

    const carId = booking.car && booking.car.id ? idToString(booking.car.id) : null;

    await booking.remove({ session });

    if (carId) {
      await Car.findByIdAndUpdate(carId, { $pull: { bookings: { bookingId: booking._id } } }, { session });
      await updateCarStatusBasedOnBookings(carId, session);
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Booking deleted successfully" });
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    next(err);
  }
};