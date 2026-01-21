import express from 'express';
import {
  createRazorpayOrder,
  verifyRazorpayPayment
} from '../controllers/paymentController.js';
import { razorpayWebhookHandler } from '../controllers/webhookController.js';

const paymentRouter = express.Router();

// Create order + pending booking
paymentRouter.post('/razorpay/order', createRazorpayOrder);

// Client-side verification hook (optional if you rely solely on webhooks)
paymentRouter.post('/razorpay/verify', verifyRazorpayPayment);

// Razorpay webhook
paymentRouter.post('/razorpay/webhook', razorpayWebhookHandler);

export default paymentRouter;