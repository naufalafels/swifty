import express from 'express';
import Review from '../models/Review.js';
import authenticateToken from '../middlewares/auth.js';

const router = express.Router();

// Get reviews for a car
router.get('/car/:carId', async (req, res) => {
  try {
    const reviews = await Review.find({ carId: req.params.carId }).populate('reviewerId', 'name');
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit review
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { bookingId, revieweeId, carId, rating, comment } = req.body;
    const newReview = new Review({
      bookingId,
      reviewerId: req.user.id,
      revieweeId,
      carId,
      rating,
      comment,
    });
    await newReview.save();
    res.status(201).json(newReview);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;