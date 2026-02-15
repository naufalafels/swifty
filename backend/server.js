import dotenv from 'dotenv';
dotenv.config();  // MOVED TO TOP

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import http from 'http';
import https from 'https';  // NEW: For HTTPS
import fs from 'fs';        // NEW: For certs

import path from 'path';
import helmet from 'helmet';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';
import { startStaleBookingCleanup } from './utils/cleanupStaleBookings.js';

import userRouter from './routes/userRoutes.js';
// import carRouter from './routes/carRoutes.js';  // REMOVED: No longer needed
import bookingRouter from './routes/bookingRoutes.js';
import paymentRouter from './routes/paymentRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import companyRouter from './routes/companyRoutes.js';
import hostRouter from './routes/hostRoutes.js';
import messageRouter from './routes/messageRoutes.js';
import reviewRouter from './routes/reviewRoutes.js';
import profileRouter from './routes/profileRoutes.js';
import clientRoutes from './routes/clientRoutes.js';  // ADDED: Import client routes

import { generalLimiter } from './middlewares/rateLimit.js';
import authMiddleware from './middlewares/auth.js';
import { uploadKyc } from './middlewares/uploadKyc.js';  // Keep if used elsewhere
// REMOVED: handleS3Upload (not needed for client-side upload)
import { submitKycMultipart } from './controllers/userController.js';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { approveHost, rejectHost } from './controllers/adminController.js';  // NEW

const app = express();
const PORT = process.env.PORT || 7889;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NEW: HTTPS setup
let server;
if (process.env.NODE_ENV === 'production') {
  // Use real certs in prod
  const sslOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH || './key.pem'),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH || './cert.pem'),
  };
  server = https.createServer(sslOptions, app);
} else {
  // HTTP for dev, or HTTPS with self-signed
  server = http.createServer(app);  // Change to https.createServer if using self-signed
}

const io = new Server(server, { cors: { origin: "*", credentials: true } });

// Attach io to app for use in routes
app.set('io', io);

// Connect to DB, then start stale booking cleanup
connectDB().then(() => {
  startStaleBookingCleanup();
}).catch((err) => {
  console.error('DB connection failed:', err);
});

app.use(cookieParser());

// NEW: Redirect HTTP to HTTPS in prod
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// Serve uploads static files (allow cross origin) - Keep for legacy, but remove if not needed
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(path.join(process.cwd(), 'uploads'))
);

// Raw body for Razorpay webhook
app.use('/api/payments/razorpay/webhook', express.raw({ type: 'application/json' }));

// General middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general API rate limiter to all /api routes
app.use('/api', generalLimiter);

// ROUTES
app.use('/api/auth', userRouter);
app.use('/api/profile', profileRouter);
app.use('/api/cars', clientRoutes);  // UPDATED: Use clientRoutes for /api/cars
app.use('/api/bookings', bookingRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/companies', companyRouter);
app.use('/api/host', hostRouter);
app.use('/api/messages', messageRouter);
app.use('/api/reviews', reviewRouter);

// NEW: Host approval/rejection routes
app.post('/api/admin/host/:id/approve', authMiddleware, approveHost);
app.post('/api/admin/host/:id/reject', authMiddleware, rejectHost);

// UPDATED: KYC route (client-side S3 upload, no files/multer)
app.post(
  '/api/kyc/submit',
  authMiddleware,
  submitKycMultipart
);

// NEW: Upload route for files to S3
const s3Client = new S3Client({ region: 'ap-southeast-1' });
const BUCKET_NAME = 'swifty-kyc-uploads';
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/auth/kyc/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file' });
    const key = `kyc/${req.user.id}/${Date.now()}-${req.file.originalname}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });
    await s3Client.send(command);
    res.json({ key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// socket.io
io.on('connection', (socket) => {
  socket.on('join', (room) => socket.join(room));
  socket.on('joinUserRoom', (userId) => socket.join(`user-${userId}`));
  socket.on('privateMessage', (data) => {
    io.to(`user-${data.toUserId}`).emit('privateMessage', data);
    socket.emit('privateMessage', data); // Echo to sender for UI update
  });
  socket.on('message', (data) => socket.to(data.room).emit('message', data));
});

// health / ping route
app.get('/api/ping', (req, res) => res.json({ ok: true, time: Date.now() }));

// root
app.get('/', (req, res) => {
  res.send('API WORKING');
});

// SINGLE listen (avoid double app.listen)
server.listen(PORT, () => console.log(`Server with Socket.io on ${PORT}`));