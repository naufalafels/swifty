import express from 'express';
import { getClientCars } from '../controllers/clientController.js';

const router = express.Router();

// Public routes for client
router.get('/cars', getClientCars);

export default router;