import express from 'express';
import authMiddleWare from '../middlewares/auth.js';
import {
  createBooking,
  deleteBooking,
  getBookings,
  getMyBookings,
  updateBooking,
  updateBookingStatus,
  lookupBooking
} from '../controllers/bookingController.js';
import { uploads } from '../middlewares/uploads.js';

const bookingRouter = express.Router();

// Guest + logged-in booking creation (auth handled inside controller)
bookingRouter.post('/', uploads.single('carImage'), createBooking);

// Guest-friendly lookup by email/bookingId
bookingRouter.get('/lookup', lookupBooking);

// Public list
bookingRouter.get('/', getBookings);

// Authenticated: my bookings (for logged-in users)
bookingRouter.get('/mybooking', authMiddleWare, getMyBookings);

// Updates (kept as-is)
bookingRouter.put('/:id', uploads.single('carImage'), updateBooking);
bookingRouter.patch('/:id/status', authMiddleWare, updateBookingStatus); // add auth here
bookingRouter.delete('/:id', deleteBooking);

export default bookingRouter;