import Car from "../models/carModel.js";
import Company from "../models/companyModel.js";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";

// ─── NEW: Helper to compute effective daily rate & deposit for a given date ───
function computeEffectivePrice(flexiblePricing, dateStr) {
  const fp = flexiblePricing || {};
  const baseRate = Number(fp.baseDailyRate) || 0;
  const baseDeposit = Number(fp.baseDeposit) || 0;
  const weekendMul = Number(fp.weekendMultiplier) || 1;
  const depWeekendMul = Number(fp.depositWeekendMultiplier) || 1;
  const peakMultipliers = Array.isArray(fp.peakMultipliers) ? fp.peakMultipliers : [];

  let rateMultiplier = 1;
  let depositMultiplier = 1;

  // Check weekend (Saturday=6, Sunday=0)
  const d = new Date(dateStr);
  const day = d.getDay();
  if (day === 0 || day === 6) {
    rateMultiplier = weekendMul;
    depositMultiplier = depWeekendMul;
  }

  // Check peak periods (peak overrides weekend if higher)
  for (const peak of peakMultipliers) {
    if (peak.start && peak.end && dateStr >= peak.start && dateStr <= peak.end) {
      rateMultiplier = Math.max(rateMultiplier, Number(peak.multiplier) || 1);
      depositMultiplier = Math.max(depositMultiplier, Number(peak.depositMultiplier) || 1);
    }
  }

  return {
    dailyRate: Math.round(baseRate * rateMultiplier * 100) / 100,
    deposit: Math.round(baseDeposit * depositMultiplier * 100) / 100,
    rateMultiplier,
    depositMultiplier,
  };
}

// ─── NEW: Compute total rent + deposit for a date range using flexible pricing ───
function computeFlexibleTotal(flexiblePricing, pickupDateStr, returnDateStr) {
  const fp = flexiblePricing || {};
  const baseRate = Number(fp.baseDailyRate) || 0;
  const baseDeposit = Number(fp.baseDeposit) || 0;

  if (!pickupDateStr || !returnDateStr) {
    return { totalRent: baseRate, effectiveDeposit: baseDeposit, days: 1, perDay: [] };
  }

  const start = new Date(pickupDateStr);
  const end = new Date(returnDateStr);
  const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

  let totalRent = 0;
  let maxDepositMultiplier = 1;
  const perDay = [];

  for (let i = 0; i < days; i++) {
    const cur = new Date(start);
    cur.setDate(cur.getDate() + i);
    const isoStr = cur.toISOString().slice(0, 10);
    const eff = computeEffectivePrice(fp, isoStr);
    totalRent += eff.dailyRate;
    maxDepositMultiplier = Math.max(maxDepositMultiplier, eff.depositMultiplier);
    perDay.push({ date: isoStr, dailyRate: eff.dailyRate, rateMultiplier: eff.rateMultiplier });
  }

  const effectiveDeposit = Math.round(baseDeposit * maxDepositMultiplier * 100) / 100;

  return { totalRent: Math.round(totalRent * 100) / 100, effectiveDeposit, days, perDay };
}

/**
 * GET /api/cars/:id/pricing?pickupDate=YYYY-MM-DD&returnDate=YYYY-MM-DD
 * Public endpoint — returns flexible pricing breakdown for selected dates.
 */
export const getCarPricing = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid car id" });
    }

    const car = await Car.findById(id).select("flexiblePricing dailyRate deposit").lean();
    if (!car) return res.status(404).json({ message: "Car not found" });

    const fp = car.flexiblePricing || {
      baseDailyRate: car.dailyRate || 0,
      baseDeposit: car.deposit || 0,
      weekendMultiplier: 1,
      depositWeekendMultiplier: 1,
      peakMultipliers: [],
    };

    const { pickupDate, returnDate } = req.query;
    const result = computeFlexibleTotal(fp, pickupDate, returnDate);

    return res.json({
      success: true,
      data: {
        flexiblePricing: fp,
        ...result,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Also export the helper so it can be used in bookingController if needed ───
export { computeEffectivePrice, computeFlexibleTotal };

/**
 * Create a car
 * Accepts multipart/form-data with optional file (handled by multer in routes)
 * Stores image path in DB as "car-images/<filename>" so frontend can build URL with /uploads/<path>
 */
export const createCar = async (req, res, next) => {
  try {
    const {
      make,
      model,
      dailyRate,
      category,
      description,
      year,
      color,
      seats,
      transmission,
      fuelType,
      mileage,
      status,
    } = req.body;

    if (!make || !model || !dailyRate) {
      return res.status(400).json({
        message: "Make, Model, or/and DailyRate is required!",
      });
    }

    let imageFilename = req.body.image || "";
    if (req.file) {
      // store with folder prefix so later URL becomes /uploads/car-images/<filename>
      imageFilename = `car-images/${req.file.filename}`;
    }

    const car = new Car({
      make,
      model,
      year: year ? Number(year) : undefined,
      color: color || "",
      category: category || "Sedan",
      seats: seats ? Number(seats) : 4,
      transmission: transmission || "Automatic",
      fuelType: fuelType || "Gasoline",
      mileage: mileage ? Number(mileage) : 0,
      dailyRate: Number(dailyRate),
      status: status || "available",
      image: imageFilename || "",
      description: description || "",
    });

    const saved = await car.save();
    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/cars
 * Supports query params: page, limit, search, category, status
 * Uses .lean() + Car.computeAvailabilityForCars (static) to attach availability to plain objects.
 */
export const getCars = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 12);
    const search = (req.query.search || "").trim();
    const category = (req.query.category || "").trim();
    const status = (req.query.status || "").trim();

    const query = {};
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ make: { $regex: re } }, { model: { $regex: re } }, { color: { $regex: re } }];
    }
    if (category) query.category = category;
    if (status) query.status = status;

    const total = await Car.countDocuments(query);

    // Query cars without populate first
    let cars = await Car.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    console.log('Model has companyName?', Car.schema.path('companyName') ? 'Yes' : 'No');
    console.log('DB name:', mongoose.connection.db.databaseName);
    cars.forEach(car => {
      if (car._id.toString() === '698e933fb204efd32c048775') {
        console.log('Car from DB query:', car);
      }
    });

    // Save original serviceBlocks before computeAvailability may transform them
    const serviceBlocksByCar = {};
    cars.forEach(c => {
      serviceBlocksByCar[String(c._id)] = c.serviceBlocks || [];
    });

    let carsWithAvailability = cars;
    if (Array.isArray(cars) && cars.length && typeof Car.computeAvailabilityForCars === "function") {
      try {
        carsWithAvailability = await Car.computeAvailabilityForCars(cars);
      } catch (err) {
        console.warn("computeAvailabilityForCars failed:", err);
        carsWithAvailability = cars;
      }
    }

    // Ensure each returned car includes company info normalized under `company` and,
    // if car.location is missing, copy company.location into car.location so client filtering works.
    const normalized = await Promise.all(carsWithAvailability.map(async (c) => {
      const car = { ...c };

      // Defensively restore serviceBlocks if lost during computeAvailability
      if (!car.serviceBlocks || !car.serviceBlocks.length) {
        const origBlocks = serviceBlocksByCar[String(car._id)];
        if (origBlocks && origBlocks.length) {
          car.serviceBlocks = origBlocks;
        }
      }

      if (car.companyId) {
        const company = await Company.findById(car.companyId).select('name slug logo address location').lean();
        if (company) {
          car.company = {
            id: company._id,
            name: company.name,
            slug: company.slug,
            logo: company.logo,
            address: company.address || {},
            location: company.location || null,
          };
        } else {
          car.company = null;
        }
      } else {
        car.company = null;
      }

      // If car has no location, but company has, copy it so frontend can use car.location consistently
      if ((!car.location || !car.location.coordinates || car.location.coordinates.length === 0) && car.company && car.company.location) {
        car.location = car.company.location;
      }

      // remove companyId to avoid confusion
      delete car.companyId;
      return car;
    }));

    return res.json({
      page,
      pages: Math.ceil(total / limit),
      total,
      data: normalized,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/cars/:id
 */
export const getCarById = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid car id" });
    }

    const car = await Car.findById(id).lean();
    if (!car) return res.status(404).json({ message: "Car not found" });

    // Save original serviceBlocks before computeAvailability may transform them
    const originalServiceBlocks = car.serviceBlocks || [];

    let carWithAvailability = car;
    if (typeof Car.computeAvailabilityForCars === "function") {
      try {
        const arr = await Car.computeAvailabilityForCars([car]);
        carWithAvailability = arr && arr[0] ? arr[0] : car;
        // Preserve serviceBlocks from the original car document — computeAvailabilityForCars may strip it
        if (!carWithAvailability.serviceBlocks || !carWithAvailability.serviceBlocks.length) {
          carWithAvailability.serviceBlocks = originalServiceBlocks;
        }
      } catch (err) {
        console.warn("computeAvailabilityForCars failed for single car:", err);
      }
    }

    // attempt to populate company info for single car response
    try {
      const company = carWithAvailability.companyId ? await Company.findById(carWithAvailability.companyId).lean() : null;
      if (company) {
        carWithAvailability.company = {
          id: company._id,
          name: company.name,
          slug: company.slug,
          logo: company.logo,
          address: company.address || {},
          location: company.location || null,
        };
        if ((!carWithAvailability.location || !carWithAvailability.location.coordinates || carWithAvailability.location.coordinates.length === 0) && company.location) {
          carWithAvailability.location = company.location;
        }
      }
      delete carWithAvailability.companyId;
    } catch (err) {
      // non-fatal
    }

    return res.json({ success: true, data: carWithAvailability });
  } catch (err) {
    next(err);
  }
};

/**
 * Update car
 * Accepts multipart upload (req.file) or body.image (string).
 * Removes old image file if replaced/removed.
 */
export const updateCar = async (req, res, next) => {
  try {
    const carId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(carId)) {
      return res.status(400).json({ message: "Invalid car id" });
    }

    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ message: "Car not found" });

    // Handle image replacement (expect route multer to store to uploads/car-images)
    if (req.file) {
      // delete old file if present
      if (car.image) {
        const oldPath = path.join(process.cwd(), "uploads", car.image);
        fs.unlink(oldPath, (err) => {
          if (err) console.warn("Failed to delete old image:", err);
        });
      }
      car.image = `car-images/${req.file.filename}`;
    } else if (req.body.image !== undefined) {
      // if empty string => delete existing file
      if (!req.body.image && car.image) {
        const oldPath = path.join(process.cwd(), "uploads", car.image);
        fs.unlink(oldPath, (err) => {
          if (err) console.warn("Failed to delete old image:", err);
        });
        car.image = "";
      } else if (req.body.image) {
        // allow setting image path string (e.g., existing path)
        car.image = body.image;
      }
    }

    const fields = [
      "make",
      "model",
      "year",
      "color",
      "category",
      "seats",
      "transmission",
      "fuelType",
      "mileage",
      "dailyRate",
      "status",
      "description",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        if (["year", "seats", "mileage", "dailyRate"].includes(f)) car[f] = Number(req.body[f]);
        else car[f] = req.body[f];
      }
    });

    const updated = await car.save();
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete car
 */
export const deleteCar = async (req, res, next) => {
  try {
    const carId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(carId)) {
      return res.status(400).json({ message: "Invalid car id" });
    }

    const car = await Car.findByIdAndDelete(carId);
    if (!car) return res.status(404).json({ message: "Car not found" });

    if (car.image) {
      const filePath = path.join(process.cwd(), "uploads", car.image);
      fs.unlink(filePath, (err) => {
        if (err) console.warn("Failed to delete image file:", err);
      });
    }

    return res.json({ success: true, message: "Car deleted successfully!" });
  } catch (err) {
    next(err);
  }
};

export default {
  createCar,
  getCars,
  getCarById,
  getCarPricing,
  updateCar,
  deleteCar,
};