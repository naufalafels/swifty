import mongoose from "mongoose";
import Booking from "../models/bookingModel.js";
import Car from "../models/carModel.js";
import User from "../models/userModel.js";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import bcrypt from "bcryptjs";

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

const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");
const escapeRegex = (str = "") => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Build the car snapshot stored inside booking.car
 */
function buildCarSummary(src) {
  src = src || {};
  const id = idToString(src.id || src._id || null);

  let companyId = null;
  let companyName = null;

  if (src.company) {
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
    companyId: companyId ? String(companyId) : null,
    companyName: companyName || "",
  };
}

/**
 * Set car.status = "rented" ONLY if a blocking booking overlaps "now"
 * Otherwise, keep it "available" so future bookings don’t block advance rentals.
 */
async function updateCarStatusBasedOnBookings(carId, session = null) {
  if (!carId) return;
  const now = new Date();
  const count = await Booking.countDocuments({
    "car.id": carId,
    status: { $in: BLOCKING_STATUSES },
    pickupDate: { $lte: now },
    returnDate: { $gte: now },
  }).session(session);
  const newStatus = count > 0 ? "rented" : "available";
  await Car.findByIdAndUpdate(carId, { status: newStatus }, { session });
}

// Create or reuse a guest user so bookings always have a userId
const getOrCreateGuestUser = async ({ name, email, phone }) => {
  if (!email) throw new Error("Email is required for guest booking");
  const existing = await User.findOne({ email }).lean();
  if (existing) return existing._id;

  const password = crypto.randomBytes(12).toString("hex");
  const hashed = await bcrypt.hash(password, 10);

  const guest = await User.create({
    name: name || "Guest",
    email,
    phone: phone || "",
    password: hashed,
    role: "guest",
  });
  return guest._id;
};

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

    let carSummary = null;
    if (typeof car === "string" && /^[0-9a-fA-F]{24}$/.test(car)) {
      const carDoc = await Car.findById(car).session(session).lean();
      if (!carDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: "Car not found" });
      }
      carSummary = buildCarSummary(carDoc);
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

    if (carSummary.id) {
      try {
        const canonicalCar = await Car.findById(carSummary.id).session(session).lean();
        if (canonicalCar && (canonicalCar.companyId || canonicalCar.company)) {
          const c = canonicalCar.company || canonicalCar.companyId;
          carSummary.companyId = idToString(c);
          carSummary.companyName = canonicalCar.companyName || (canonicalCar.company && canonicalCar.company.name) || carSummary.companyName || "";
        }
      } catch (e) {
        console.warn("createBooking: failed to fetch canonical car for companyId:", e);
      }
    }

    let userId = null;
    if (req.user && (req.user.id || req.user._id)) {
      userId = req.user.id || req.user._id;
    } else {
      userId = await getOrCreateGuestUser({ name: customer, email, phone });
    }

    const bookingData = {
      userId,
      customer,
      email,
      phone,
      car: {
        id: carSummary.id && mongoose.Types.ObjectId.isValid(carSummary.id) ? mongoose.Types.ObjectId(carSummary.id) : carSummary.id,
        make: carSummary.make,
        model: carSummary.model,
        year: carSummary.year,
        dailyRate: carSummary.dailyRate,
        image: carSummary.image,
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

    if (carSummary.companyId) {
      const oid = toObjectIdIfValid(carSummary.companyId);
      bookingData.companyId = oid || null;
    }

    const createdArr = await Booking.create([bookingData], { session });
    const createdBooking = createdArr[0];

    const bookingEntry = {
      bookingId: createdBooking._id,
      pickupDate: createdBooking.pickupDate,
      returnDate: createdBooking.returnDate,
      status: createdBooking.status,
    };

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
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ success: false, message: "Car is not available for the selected dates" });
    }

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

// GET MY BOOKINGS (user) — also claim guest bookings by matching email
export const getMyBookings = async (req, res, next) => {
  try {
    if (!req.user || (!(req.user.id || req.user._id))) return res.status(401).json({ success: false, message: "Unauthorized" });
    const userId = req.user.id || req.user._id;
    const userEmail = normalizeEmail(req.user.email);
    const query = [{ userId }];
    if (userEmail) {
      query.push({ email: { $regex: `^${escapeRegex(userEmail)}$`, $options: "i" } });
    }
    const bookings = await Booking.find({ $or: query }).sort({ bookingDate: -1 }).lean();

    if (userEmail) {
      const claimableIds = bookings
        .filter((b) => normalizeEmail(b.email) === userEmail && String(b.userId) !== String(userId))
        .map((b) => b._id);
      if (claimableIds.length) {
        await Booking.updateMany({ _id: { $in: claimableIds } }, { userId });
      }
    }

    return res.json(bookings);
  } catch (err) {
    next(err);
  }
};

// LOOKUP BOOKINGS (guest-friendly) by email and/or bookingId
export const lookupBooking = async (req, res, next) => {
  try {
    const { email, bookingId } = req.query;
    if (!email && !bookingId) {
      return res.status(400).json({ success: false, message: "email or bookingId is required" });
    }

    const query = {};
    if (email) query.email = { $regex: `^${email}$`, $options: "i" };

    let results = [];
    if (bookingId) {
      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({ success: false, message: "Invalid bookingId" });
      }
      const doc = await Booking.findOne({ _id: bookingId, ...query }).lean();
      results = doc ? [doc] : [];
    } else {
      results = await Booking.find(query).sort({ bookingDate: -1 }).limit(50).lean();
    }

    return res.json({ success: true, data: results });
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

          if (summary.id) {
            try {
              const canonicalCar = await Car.findById(summary.id).session(session).lean();
              if (canonicalCar && (canonicalCar.companyId || canonicalCar.company)) {
                const cval = canonicalCar.company || canonicalCar.companyId;
                booking.car.companyId = (cval && mongoose.Types.ObjectId.isValid(cval)) ? mongoose.Types.ObjectId(cval) : (cval || booking.car.companyId);
                booking.companyId = toObjectIdIfValid(cval) || booking.companyId || null;
              } else {
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
      try {
        if (newCarId) {
          await Car.findByIdAndUpdate(newCarId, { $set: { "bookings.$[elem].status": updated.status, "bookings.$[elem].pickupDate": updated.pickupDate, "bookings.$[elem].returnDate": updated.returnDate } }, { arrayFilters: [{ "elem.bookingId": updated._id }], session });
        }
      } catch (e) {
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

// UPDATE STATUS (auth required & must own booking, or email match -> claim)
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
    if (!req.user || !(req.user.id || req.user._id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ message: "Unauthorized" });
    }

    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Booking not found" });
    }

    const bookingUserId = booking.userId ? String(booking.userId) : null;
    const requesterId = String(req.user.id || req.user._id || "");
    const emailsMatch = normalizeEmail(booking.email) && normalizeEmail(req.user.email) && normalizeEmail(booking.email) === normalizeEmail(req.user.email);

    if (!bookingUserId || bookingUserId !== requesterId) {
      if (!emailsMatch) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({ message: "Forbidden: not your booking" });
      }
      booking.userId = req.user.id || req.user._id;
    }

    booking.status = status;
    const updated = await booking.save({ session });

    try {
      const carId = booking.car && booking.car.id ? idToString(booking.car.id) : null;
      if (carId) {
        if (status === "cancelled") {
          await Car.findByIdAndUpdate(carId, { $pull: { bookings: { bookingId: booking._id } } }, { session });
        } else {
          await Car.findByIdAndUpdate(carId, { $set: { "bookings.$[elem].status": status } }, { arrayFilters: [{ "elem.bookingId": booking._id }], session });
        }
      }
    } catch (e) {
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