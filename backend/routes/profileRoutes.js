import express from 'express';
import authMiddleware from '../middlewares/auth.js';
import { getProfileStats } from '../controllers/profileStatsController.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/stats', getProfileStats);

export default router;