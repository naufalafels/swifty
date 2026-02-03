import express from 'express';
import authMiddleWare from '../middlewares/auth.js';
import {
  createBooking,
  deleteBooking,
  getBookings,
  getMyBookings,
  updateBooking,
  updateBookingStatus,
  lookupBooking,
  getBookingById
} from '../controllers/bookingController.js';
import { uploads } from '../middlewares/uploads.js';

const bookingRouter = express.Router();

// Guest + logged-in booking creation (auth handled inside controller)
bookingRouter.post('/', uploads.single('carImage'), createBooking);

// Guest-friendly lookup by email/bookingId
bookingRouter.get('/lookup', lookupBooking);

// Authenticated: my bookings (for logged-in users)
bookingRouter.get('/mybooking', authMiddleWare, getMyBookings);

// Public list
bookingRouter.get('/', getBookings);

// Public: get single booking by id (used for payment result pages)
bookingRouter.get('/:id', getBookingById);

// Updates (kept as-is)
bookingRouter.put('/:id', uploads.single('carImage'), updateBooking);
bookingRouter.patch('/:id/status', authMiddleWare, updateBookingStatus);

// Delete (kept as-is)
bookingRouter.delete('/:id', authMiddleWare, deleteBooking);

export default bookingRouter;