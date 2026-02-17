import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import Car from "../models/carModel.js";
import Booking from "../models/bookingModel.js";
import User from "../models/userModel.js";
import { getMalaysiaHolidays, buildHolidayByDate } from "../utils/holidaysMY.js";
import { generateDownloadUrl } from "../services/s3Service.js";
import { decrypt } from "../services/cryptoService.js";

function asObjectId(v) {
  if (!v) return null;
  try {
    return mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null;
  } catch {
    return null;
  }
}

const removeFileIfExists = (p) => {
  if (!p) return;
  const full = path.join(process.cwd(), "uploads", p);
  fs.unlink(full, () => {});
};

const hostCarFilter = (user) => {
  const hostId = user?.id;
  const companyId = user?.companyId;
  const ors = [];
  if (hostId) ors.push({ hostId }, { ownerId: hostId }, { createdBy: hostId });
  if (companyId) ors.push({ companyId }, { "company._id": companyId });
  return ors.length ? { $or: ors } : {};
};

const eachDayInclusive = (start, end) => {
  const out = [];
  let cur = new Date(start);
  const to = new Date(end);
  while (cur <= to) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

const iso = (d) => new Date(d).toISOString().slice(0, 10);

function sameDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// Cars a host should see
export const getHostCars = async (req, res) => {
  try {
    const cars = await Car.find(hostCarFilter(req.user)).lean();
    return res.json({ success: true, data: cars });
  } catch (err) {
    console.error("getHostCars error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Create a car as a host (accepts multipart image)
export const createHostCar = async (req, res) => {
  try {
    const hostId = req.user?.id;
    if (!hostId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const companyId = req.user?.companyId || null;
    const body = req.body || {};

    const required = ["make", "model", "year", "dailyRate", "seats", "transmission", "fuelType"];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || String(body[k]).trim() === "") {
        if (req.file?.filename) removeFileIfExists(path.join("car-images", req.file.filename));
        return res.status(400).json({ success: false, message: `${k} is required` });
      }
    }

    // Fetch the latest user data from DB to ensure hostProfile is up-to-date
    const user = await User.findById(hostId).select('hostProfile.location hostProfile.companyName');

    const imagePath = req.file ? `car-images/${req.file.filename}` : (body.image || body.imageUrl || "");

    const car = await Car.create({
      make: body.make,
      model: body.model,
      year: Number(body.year),
      color: body.color || "",
      category: body.category || "Sedan",
      seats: Number(body.seats) || 4,
      transmission: body.transmission || "Automatic",
      fuelType: body.fuelType || "Gasoline",
      mileage: Number(body.mileage) || 0,
      dailyRate: Number(body.dailyRate || 0),
      deposit: Number(body.deposit || 0),
      gasUsage: body.gasUsage || "",
      petrolType: body.petrolType || "",
      image: imagePath,
      status: body.status || "available",
      hostId,
      ownerId: hostId,
      createdBy: hostId,
      companyId: companyId || undefined,
      location: user?.hostProfile?.location || { type: 'Point', coordinates: [0, 0] },
      companyName: user?.hostProfile?.companyName || "",
      flexiblePricing: {
        baseDailyRate: Number(body.dailyRate || 0),
        baseDeposit: Number(body.deposit || 0),
        weekendMultiplier: 1,
        depositWeekendMultiplier: 1,
        peakMultipliers: [],
      },
      serviceBlocks: [],
    });

    return res.status(201).json({ success: true, data: car });
  } catch (err) {
    console.error("createHostCar error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Bookings for host-owned cars
// BUG 1 FIX: Query by "car.id" (embedded car snapshot) instead of top-level "carId"
export const getHostBookings = async (req, res) => {
  try {
    const cars = await Car.find(hostCarFilter(req.user)).select("_id").lean();
    const carIds = cars.map((c) => c._id);
    if (!carIds.length) return res.json({ success: true, data: [] });

    const bookings = await Booking.find({ "car.id": { $in: carIds } })
      .populate("userId")
      .lean();

    return res.json({ success: true, data: bookings });
  } catch (err) {
    console.error("getHostBookings error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update booking status (approve/reject/flag/cancel)
export const updateHostBookingStatus = async (req, res) => {
  try {
    const id = asObjectId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid booking id" });

    const { status, note } = req.body || {};
    const allowed = ["approved", "rejected", "flagged", "cancelled", "completed"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const booking = await Booking.findByIdAndUpdate(
      id,
      { status, statusNote: note || "" },
      { new: true }
    );

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    return res.json({ success: true, data: booking });
  } catch (err) {
    console.error("updateHostBookingStatus error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Host calendar (bookings + per-day car occupancy + holidays + verification meta)
// BUG 1 FIX: Query by "car.id" instead of "carId"
// BUG 2 FIX: Filter only relevant booking statuses so dayCars populates correctly
// BUG 3 FIX: Fetch holidays dynamically via Nager.Date API
export const getHostCalendar = async (req, res) => {
  try {
    // BUG 3 FIX: Dynamically fetch holidays for current year + next year
    const currentYear = new Date().getFullYear();
    const holidays = await getMalaysiaHolidays([currentYear, currentYear + 1]);

    const cars = await Car.find(hostCarFilter(req.user)).select("_id make model serviceBlocks flexiblePricing").lean();
    const carIds = cars.map((c) => c._id);
    if (!carIds.length) {
      return res.json({
        success: true,
        data: { holidays, bookings: [], serviceBlocks: [], dayCars: {}, today: { pickups: [], returns: [] } },
      });
    }

    // BUG 1 FIX: Query "car.id" (the embedded ObjectId inside the car snapshot)
    // BUG 2 FIX: Only include bookings with active/relevant statuses
    const activeStatuses = ["active", "pending", "upcoming", "completed"];
    const bookings = await Booking.find({
      "car.id": { $in: carIds },
      status: { $in: activeStatuses },
    })
      .select("pickupDate returnDate status car bookingDate location verificationDocType verificationIdNumber userId customer email phone kyc")
      .populate("userId", "name email phone docType idNumber passportNumber nricNumber verificationStatus kyc")
      .lean();

    const serviceBlocks = cars.flatMap((c) =>
      (c.serviceBlocks || []).map((d) => ({
        date: d,
        car: `${c.make} ${c.model}`,
        type: "service",
      }))
    );

    // Build per-day car occupancy with verification info + customer info
    const dayCars = {};
    for (const b of bookings) {
      const start = new Date(b.pickupDate);
      const end = new Date(b.returnDate || b.pickupDate);
      const days = eachDayInclusive(start, end);
      // BUG 1 FIX: b.car is an embedded object { id, make, model, ... }, not a populated ref
      const carName = b.car
        ? `${b.car.make || ""} ${b.car.model || ""}`.trim()
        : "Car";
      const docType =
        b.verificationDocType ||
        b.userId?.docType ||
        (b.userId?.passportNumber ? "Passport" : b.userId?.nricNumber ? "NRIC" : null);
      const docId =
        b.verificationIdNumber ||
        b.userId?.passportNumber ||
        b.userId?.nricNumber ||
        b.userId?.idNumber ||
        null;

      for (const d of days) {
        const key = iso(d);
        if (!dayCars[key]) dayCars[key] = [];
        dayCars[key].push({
          carId: b.car?.id || null,
          car: carName || "Car",
          bookingId: b._id,
          status: b.status,
          verificationDocType: docType,
          verificationIdNumber: docId,
          // Customer info for sidebar display
          customerName: b.customer || b.userId?.name || "Unknown",
          customerEmail: b.email || b.userId?.email || "",
          customerPhone: b.phone || b.userId?.phone || "",
          pickupDate: b.pickupDate,
          returnDate: b.returnDate,
        });
      }
    }

    const pickupsToday = bookings.filter((b) => sameDay(b.pickupDate, new Date()));
    const returnsToday = bookings.filter((b) => sameDay(b.returnDate, new Date()));

    return res.json({
      success: true,
      data: {
        holidays,
        bookings,
        serviceBlocks,
        dayCars,
        today: {
          pickups: pickupsToday,
          returns: returnsToday,
        },
      },
    });
  } catch (err) {
    console.error("getHostCalendar error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET booking customer detail with signed KYC image URLs
export const getBookingCustomerDetail = async (req, res) => {
  try {
    const bookingId = asObjectId(req.params.bookingId);
    if (!bookingId) return res.status(400).json({ success: false, message: "Invalid booking id" });

    // Verify this booking belongs to one of the host's cars
    const cars = await Car.find(hostCarFilter(req.user)).select("_id").lean();
    const carIds = cars.map((c) => String(c._id));

    const booking = await Booking.findById(bookingId).populate("userId").lean();
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const bookingCarId = String(booking.car?.id || "");
    if (!carIds.includes(bookingCarId)) {
      return res.status(403).json({ success: false, message: "Not authorized to view this booking" });
    }

    const user = booking.userId;
    const userKyc = user?.kyc || {};
    const bookingKyc = booking.kyc || {};

    // Determine ID type and number (prefer user KYC, fallback to booking KYC)
    const idType = userKyc.idType || bookingKyc.idType || "N/A";
    const idCountry = userKyc.idCountry || bookingKyc.idCountry || "MY";

    // Try to decrypt the ID number
    let idNumber = "N/A";
    const rawIdNumber = userKyc.idNumber || bookingKyc.idNumber || "";
    if (rawIdNumber) {
      try {
        idNumber = decrypt(rawIdNumber);
      } catch {
        idNumber = rawIdNumber;
      }
    }

    // Generate signed URLs for KYC images
    // Priority: user KYC images > booking KYC images
    const frontKey = userKyc.frontImageUrl || bookingKyc.frontImageUrl || "";
    const backKey = userKyc.backImageUrl || bookingKyc.backImageUrl || "";

    let frontImageUrl = null;
    if (frontKey) {
      if (frontKey.startsWith("http")) {
        frontImageUrl = frontKey;
      } else {
        try {
          frontImageUrl = await generateDownloadUrl(frontKey);
        } catch (err) {
          console.error("Error generating front signed URL", err);
        }
      }
    }

    let backImageUrl = null;
    if (backKey) {
      if (backKey.startsWith("http")) {
        backImageUrl = backKey;
      } else {
        try {
          backImageUrl = await generateDownloadUrl(backKey);
        } catch (err) {
          console.error("Error generating back signed URL", err);
        }
      }
    }

    return res.json({
      success: true,
      data: {
        customerName: booking.customer || user?.name || "Unknown",
        email: booking.email || user?.email || "",
        phone: booking.phone || user?.phone || "",
        idType,
        idNumber,
        idCountry,
        frontImageUrl,
        backImageUrl,
        carMake: booking.car?.make || "",
        carModel: booking.car?.model || "",
        carYear: booking.car?.year || "",
        pickupDate: booking.pickupDate,
        returnDate: booking.returnDate,
        status: booking.status,
        bookingId: booking._id,
        amount: booking.amount || 0,
        paymentStatus: booking.paymentStatus || "pending",
      },
    });
  } catch (err) {
    console.error("getBookingCustomerDetail error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Block selected car(s) for service (prevent blocking active booking days)
// BUG 1 FIX: Query by "car.id" instead of "carId"
export const blockServiceDates = async (req, res) => {
  try {
    const { carIds = [], dates = [] } = req.body || {};
    if (!Array.isArray(carIds) || !carIds.length) {
      return res.status(400).json({ success: false, message: "carIds required" });
    }
    const cleanDates = (dates || []).map((d) => String(d).slice(0, 10)).filter(Boolean);
    if (!cleanDates.length) return res.status(400).json({ success: false, message: "dates required" });

    // fetch conflicting bookings
    const conflicts = await Booking.find({
      "car.id": { $in: carIds.map(asObjectId).filter(Boolean) },
      $or: cleanDates.map((d) => ({
        pickupDate: { $lte: new Date(`${d}T23:59:59.999Z`) },
        returnDate: { $gte: new Date(`${d}T00:00:00.000Z`) },
      })),
    })
      .select("car.id pickupDate returnDate status")
      .lean();

    if (conflicts.length) {
      const byCar = {};
      for (const c of conflicts) {
        const cid = String(c.car?.id);
        if (!byCar[cid]) byCar[cid] = [];
        byCar[cid].push({ pickupDate: c.pickupDate, returnDate: c.returnDate, status: c.status });
      }
      return res.status(400).json({
        success: false,
        message: "Some dates overlap active bookings. Cannot block service on booked days.",
        conflicts: byCar,
      });
    }

    await Car.updateMany(
      { _id: { $in: carIds.map(asObjectId).filter(Boolean) } },
      { $addToSet: { serviceBlocks: { $each: cleanDates } } }
    );
    return res.json({ success: true, data: { carIds, dates: cleanDates } });
  } catch (err) {
    console.error("blockServiceDates error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Flexible pricing per car (with deposit flexibility)
export const getFlexiblePricing = async (req, res) => {
  try {
    const carId = asObjectId(req.params.carId);
    if (!carId) return res.status(400).json({ success: false, message: "Invalid car id" });
    const car = await Car.findById(carId).select("flexiblePricing dailyRate deposit");
    if (!car) return res.status(404).json({ success: false, message: "Car not found" });
    const fp = car.flexiblePricing || {
      baseDailyRate: car.dailyRate || 0,
      baseDeposit: car.deposit || 0,
      weekendMultiplier: 1,
      depositWeekendMultiplier: 1,
      peakMultipliers: [],
    };
    return res.json({ success: true, data: fp });
  } catch (err) {
    console.error("getFlexiblePricing error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const upsertFlexiblePricing = async (req, res) => {
  try {
    const carId = asObjectId(req.params.carId);
    if (!carId) return res.status(400).json({ success: false, message: "Invalid car id" });

    const { baseDailyRate, baseDeposit = 0, weekendMultiplier, depositWeekendMultiplier, peakMultipliers = [] } = req.body || {};
    if (baseDailyRate === undefined || baseDailyRate === null) {
      return res.status(400).json({ success: false, message: "baseDailyRate required" });
    }

    const safePeak = (Array.isArray(peakMultipliers) ? peakMultipliers : [])
      .map((p) => ({
        label: p.label || "Peak",
        start: String(p.start || "").slice(0, 10),
        end: String(p.end || "").slice(0, 10),
        multiplier: Number(p.multiplier || 1),
        depositMultiplier: Number(p.depositMultiplier || 1),
      }))
      .filter((p) => p.start && p.end && p.multiplier > 0 && p.depositMultiplier > 0);

    const car = await Car.findByIdAndUpdate(
      carId,
      {
        $set: {
          dailyRate: Number(baseDailyRate),
          deposit: Number(baseDeposit),
          flexiblePricing: {
            baseDailyRate: Number(baseDailyRate),
            baseDeposit: Number(baseDeposit),
            weekendMultiplier: Number(weekendMultiplier || 1),
            depositWeekendMultiplier: Number(depositWeekendMultiplier || 1),
            peakMultipliers: safePeak,
          },
        },
      },
      { new: true }
    );

    if (!car) return res.status(404).json({ success: false, message: "Car not found" });
    return res.json({ success: true, data: car.flexiblePricing });
  } catch (err) {
    console.error("upsertFlexiblePricing error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};