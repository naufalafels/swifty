import express from 'express';
import { createCheckoutSession, confirmPayment } from '../controllers/paymentController.js';
import { stripeWebhookHandler } from '../controllers/webhookController.js';

const paymentRouter = express.Router();

paymentRouter.post('/create-checkout-session', createCheckoutSession);
paymentRouter.get('/confirm-payment', confirmPayment);

// For webhooks, stripe requires raw body. When mounting in server.js, ensure to use express.raw for this endpoint.
paymentRouter.post('/webhook', stripeWebhookHandler);

export default paymentRouter;