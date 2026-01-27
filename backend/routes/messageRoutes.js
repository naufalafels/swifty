import express from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/userModel.js'; // Add this import
import authenticateToken from '../middlewares/auth.js';

const router = express.Router();

// Get messages for a car conversation
router.get('/car/:carId', authenticateToken, async (req, res) => {
  try {
    const { carId } = req.params;
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const messages = await Message.find({
      carId,
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all messages for the logged-in host
router.get('/host', authenticateToken, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const messages = await Message.find({
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
    const { toUserId: companyId, carId, message } = req.body;
    // Find the host user for this company
    const hostUser = await User.findOne({ companyId, roles: { $in: ["host"] } });
    if (!hostUser) return res.status(404).json({ message: 'Host not found for this company' });

    const toUserId = hostUser._id;
    const newMessage = new Message({
      fromUserId: req.user.id,
      toUserId,
      carId,
      message,
    });
    await newMessage.save();

    // Emit to the host's room
    const io = req.app.get('io');
    io.to(`user-${toUserId}`).emit('privateMessage', {
      fromUserId: req.user.id,
      toUserId,
      carId,
      message,
      timestamp: newMessage.timestamp,
    });
    // Also emit to sender for UI update
    io.to(`user-${req.user.id}`).emit('privateMessage', {
      fromUserId: req.user.id,
      toUserId,
      carId,
      message,
      timestamp: newMessage.timestamp,
    });

    res.status(201).json(newMessage);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;