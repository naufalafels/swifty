import express from 'express';
import {
  createRazorpayOrder,
  verifyRazorpayPayment
} from '../controllers/paymentController.js';
import { razorpayWebhookHandler } from '../controllers/webhookController.js';
import { uploads } from '../middlewares/uploads.js';

const paymentRouter = express.Router();

// Create order + pending booking (accepts KYC images as multipart/form-data)
paymentRouter.post(
  '/razorpay/order',
  uploads.fields([
    { name: 'kycFront', maxCount: 1 },
    { name: 'kycBack', maxCount: 1 }
  ]),
  createRazorpayOrder
);

// Client-side verification hook (optional if you rely solely on webhooks)
paymentRouter.post('/razorpay/verify', verifyRazorpayPayment);

// Razorpay webhook
// IMPORTANT: use express.raw middleware here so we can verify signature against the exact raw bytes
paymentRouter.post(
  '/razorpay/webhook',
  // accept only application/json raw body for signature verification
  express.raw({ type: 'application/json' }),
  razorpayWebhookHandler
);

export default paymentRouter;