import express from 'express';
import { createCheckoutSession, confirmPayment } from '../controllers/paymentController.js';

const paymentRouter = express.Router();

paymentRouter.post('/create-checkout-session', createCheckoutSession);
paymentRouter.get('/confirm-payment', confirmPayment);

export default paymentRouter;