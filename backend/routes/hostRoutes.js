import express from "express";
import authMiddleware from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/auth.js";
import {
  getHostCars,
  createHostCar,
  getHostBookings,
  updateHostBookingStatus
} from "../controllers/hostController.js";

const router = express.Router();

// All host routes require auth + host role
router.use(authMiddleware, requireRoles(["host", "admin"]));

// Cars owned/managed by host
router.get("/cars", getHostCars);
router.post("/cars", createHostCar);

// Bookings for host-owned cars (with KYC visibility)
router.get("/bookings", getHostBookings);

// Update booking status (approve/reject/flag/cancel)
router.patch("/bookings/:id/status", updateHostBookingStatus);

export default router;