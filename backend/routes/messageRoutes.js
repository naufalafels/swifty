import express from 'express';
import Message from '../models/Message.js';
import authenticateToken from '../middlewares/auth.js'; // Assume this exists

const router = express.Router();

// Get messages for a car conversation
router.get('/car/:carId', authenticateToken, async (req, res) => {
  try {
    const { carId } = req.params;
    const userId = req.user.id;
    const messages = await Message.find({
      carId,
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { toUserId, carId, message } = req.body;
    const newMessage = new Message({
      fromUserId: req.user.id,
      toUserId,
      carId,
      message,
    });
    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;