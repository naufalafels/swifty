import Car from "../models/carModel.js";
import Company from "../models/companyModel.js";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";

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

    // populate company data (name, slug, logo, address, location) so frontend can filter by company.city/location
    let cars = await Car.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'companyId', select: 'name slug logo address location' })
      .lean();

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
    const normalized = carsWithAvailability.map((c) => {
      const car = { ...c };
      if (car.companyId && typeof car.companyId === 'object') {
        car.company = {
          id: car.companyId._id || car.companyId.id,
          name: car.companyId.name,
          slug: car.companyId.slug,
          logo: car.companyId.logo,
          address: car.companyId.address || {},
          location: car.companyId.location || null,
        };
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
    });

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

    let carWithAvailability = car;
    if (typeof Car.computeAvailabilityForCars === "function") {
      try {
        const arr = await Car.computeAvailabilityForCars([car]);
        carWithAvailability = arr && arr[0] ? arr[0] : car;
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
        car.image = req.body.image;
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
  updateCar,
  deleteCar,
};