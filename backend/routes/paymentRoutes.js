import express from 'express';
import { createCheckoutSession, confirmPayment } from '../controllers/paymentController.js';
import { stripeWebhookHandler } from '../controllers/webhookController.js';

const paymentRouter = express.Router();

paymentRouter.post('/create-checkout-session', createCheckoutSession);

// keep both endpoints as aliases so old clients still work
paymentRouter.get('/confirm', confirmPayment);
paymentRouter.get('/confirm-payment', confirmPayment);

// webhook endpoint (Stripe will POST here)
paymentRouter.post('/webhook', stripeWebhookHandler);

export default paymentRouter;