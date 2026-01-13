import express from 'express';
import { signupCompany, getAdminCars, createAdminCar, getAdminBookings, updateAdminBookingStatus } from '../controllers/adminController.js';
import authMiddleware from '../middlewares/auth.js'; // your JWT auth middleware that sets req.user
import requireCompanyAdmin from '../middlewares/requireCompanyAdmin.js';

const router = express.Router();

// Public route for company signup (creates company + user)
router.post('/signup', signupCompany);

// Admin protected routes - require auth and admin role
router.use(authMiddleware);
router.use(requireCompanyAdmin);

router.get('/cars', getAdminCars);
router.post('/cars', createAdminCar);

router.get('/bookings', getAdminBookings);
router.patch('/bookings/:id/status', updateAdminBookingStatus);

export default router;