import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import Car from "../models/carModel.js";
import Booking from "../models/bookingModel.js";

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

// Cars a host should see: hostId/ownerId match OR companyId match
export const getHostCars = async (req, res) => {
  try {
    const hostId = req.user?.id;
    const companyId = req.user?.companyId;
    const ors = [];
    if (hostId) ors.push({ hostId: hostId }, { ownerId: hostId }, { createdBy: hostId });
    if (companyId) {
      ors.push({ companyId: companyId });
      ors.push({ "company._id": companyId });
    }
    const query = ors.length ? { $or: ors } : {};
    const cars = await Car.find(query).lean();
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
        // clean up uploaded file if validation fails
        if (req.file?.filename) removeFileIfExists(path.join("car-images", req.file.filename));
        return res.status(400).json({ success: false, message: `${k} is required` });
      }
    }

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
      image: imagePath,
      status: body.status || "available",
      hostId,
      ownerId: hostId,
      createdBy: hostId,
      companyId: companyId || undefined,
    });

    return res.status(201).json({ success: true, data: car });
  } catch (err) {
    console.error("createHostCar error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Bookings for host-owned cars; include KYC and car snapshot
export const getHostBookings = async (req, res) => {
  try {
    const hostId = req.user?.id;
    const companyId = req.user?.companyId;
    const ors = [];
    if (hostId) {
      ors.push({ "car.hostId": hostId }, { "car.ownerId": hostId }, { "car.createdBy": hostId });
    }
    if (companyId) {
      ors.push({ companyId: companyId }, { "car.companyId": companyId }, { "car.company": companyId });
    }
    if (!ors.length) return res.json({ success: true, data: [] });

    const bookings = await Booking.find({ $or: ors })
      .sort({ pickupDate: -1 })
      .lean();

    return res.json({ success: true, data: bookings });
  } catch (err) {
    console.error("getHostBookings error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Approve/reject/flag/cancel booking
export const updateHostBookingStatus = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { status, note } = req.body || {};
    if (!status) return res.status(400).json({ success: false, message: "status is required" });

    const hostId = req.user?.id;
    const companyId = req.user?.companyId;
    const ors = [];
    if (hostId) ors.push({ "car.hostId": hostId }, { "car.ownerId": hostId }, { "car.createdBy": hostId });
    if (companyId) ors.push({ companyId: companyId }, { "car.companyId": companyId }, { "car.company": companyId });
    if (!ors.length) return res.status(403).json({ success: false, message: "Forbidden" });

    const booking = await Booking.findOne({ _id: bookingId, $or: ors });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    booking.status = status;
    if (note) {
      booking.details = {
        ...(booking.details || {}),
        hostNote: note,
      };
    }

    await booking.save();
    return res.json({ success: true, data: booking });
  } catch (err) {
    console.error("updateHostBookingStatus error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};