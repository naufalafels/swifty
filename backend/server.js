import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import path from 'path';
import helmet from 'helmet';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';

import userRouter from './routes/userRoutes.js';
import carRouter from './routes/carRoutes.js';
import bookingRouter from './routes/bookingRoutes.js';
import paymentRouter from './routes/paymentRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import companyRouter from './routes/companyRoutes.js'; // NEW

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7889;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

connectDB();

// Middleware we need BEFORE body parsers for special routes (Stripe webhook requires raw body)
app.use(cookieParser());

// Serve uploads static files (allow cross origin)
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(path.join(process.cwd(), 'uploads'))
);

// IMPORTANT: mount raw body parser for Stripe webhook BEFORE express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// General middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ROUTES
app.use('/api/auth', userRouter); // auth routes
app.use('/api/cars', carRouter);
app.use('/api/bookings', bookingRouter);

// Mount payment router (webhook path already handled above by raw parser)
app.use('/api/payments', paymentRouter);

// Admin routes (protected by auth middleware inside the routes)
app.use('/api/admin', adminRouter);

// Public companies lookup (new)
app.use('/api/companies', companyRouter);

// health / ping route
app.get('/api/ping', (req, res) => res.json({ ok: true, time: Date.now() }));

// root
app.get('/', (req, res) => {
  res.send('API WORKING');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});