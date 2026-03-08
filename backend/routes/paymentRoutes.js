import express from 'express';
import {
  createXenditInvoice,
  markPaymentFailed,
  verifyPaymentStatus,
} from '../controllers/paymentController.js';
import { xenditWebhookHandler } from '../controllers/webhookController.js';
import { uploads } from '../middlewares/uploads.js';

const paymentRouter = express.Router();

// Create Xendit invoice + pending booking (accepts KYC images as multipart/form-data)
paymentRouter.post(
  '/xendit/create-invoice',
  uploads.fields([
    { name: 'kycFront', maxCount: 1 },
    { name: 'kycBack', maxCount: 1 }
  ]),
  createXenditInvoice
);

// Xendit webhook — receives payment confirmation from Xendit servers
// Uses standard JSON body (no express.raw needed like Razorpay)
paymentRouter.post('/xendit/webhook', xenditWebhookHandler);

// Verify payment status — proactively checks Xendit when webhook hasn't arrived yet
// Called by the frontend PaymentResultPage to resolve the race condition
paymentRouter.get('/xendit/verify/:bookingId', verifyPaymentStatus);

// Mark payment as failed (when user abandons payment page)
paymentRouter.post('/xendit/failed', markPaymentFailed);

export default paymentRouter;