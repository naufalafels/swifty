import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import authMiddleware, { requireRoles } from "../middlewares/auth.js";
import {
  getHostCars,
  createHostCar,
  getHostBookings,
  updateHostBookingStatus
} from "../controllers/hostController.js";

const router = express.Router();

// Multer storage for host car images (reuse car-images folder)
const carStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), "uploads", "car-images");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || "";
    const name = `${Date.now()}-${Math.floor(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});
const uploadCarImage = multer({ storage: carStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// All host routes require auth + host role
router.use(authMiddleware, requireRoles(["host", "admin"]));

// Cars owned/managed by host
router.get("/cars", getHostCars);
router.post("/cars", uploadCarImage.single("image"), createHostCar);

// Bookings for host-owned cars (with KYC visibility)
router.get("/bookings", getHostBookings);

// Update booking status (approve/reject/flag/cancel)
router.patch("/bookings/:id/status", updateHostBookingStatus);

export default router;