import express from 'express';
import { getClientCars } from '../controllers/clientController.js';

const router = express.Router();

// Public routes for client
router.get('/', getClientCars);  // CHANGED: From '/cars' to '/' to handle /api/cars

export default router;