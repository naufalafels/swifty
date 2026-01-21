import express from 'express';
import authMiddleWare from '../middlewares/auth.js';
import { createBooking ,deleteBooking,getBookings, getMyBookings, updateBooking, updateBookingStatus } from '../controllers/bookingController.js';
import { uploads } from '../middlewares/uploads.js';

const bookingRouter = express.Router();

// Allow guest and logged-in users to create bookings (auth handled inside controller)
bookingRouter.post('/', uploads.single('carImage'), createBooking);

// Public list
bookingRouter.get('/', getBookings);

// Authenticated: my bookings
bookingRouter.get('/mybooking', authMiddleWare, getMyBookings);

// Update booking (no auth in original; keep as-is)
bookingRouter.put('/:id', uploads.single('carImage'), updateBooking);
bookingRouter.patch('/:id/status', updateBookingStatus);
bookingRouter.delete('/:id', deleteBooking);

export default bookingRouter;