import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import http from 'http';

import path from 'path';
import helmet from 'helmet';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';
import { startStaleBookingCleanup } from './utils/cleanupStaleBookings.js';

import userRouter from './routes/userRoutes.js';
import bookingRouter from './routes/bookingRoutes.js';
import paymentRouter from './routes/paymentRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import companyRouter from './routes/companyRoutes.js';
import hostRouter from './routes/hostRoutes.js';
import messageRouter from './routes/messageRoutes.js';
import reviewRouter from './routes/reviewRoutes.js';
import profileRouter from './routes/profileRoutes.js';
import clientRoutes from './routes/clientRoutes.js';

import { generalLimiter } from './middlewares/rateLimit.js';
import authMiddleware from './middlewares/auth.js';
import { uploadKyc } from './middlewares/uploadKyc.js';
import { submitKycMultipart } from './controllers/userController.js';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { approveHost, rejectHost } from './controllers/adminController.js';

const app = express();
const PORT = process.env.PORT || 7889;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- ALLOWED ORIGINS (defined ONCE, used by both Express CORS and Socket.io) ---
const allowedOrigins = [
  'https://vroomoo.com',
  'https://www.vroomoo.com',
  'https://admin.vroomoo.com',
];

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173');
  allowedOrigins.push('http://localhost:5174');
}

// --- SERVER + SOCKET.IO ---
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.set('io', io);

// --- DATABASE ---
connectDB().then(() => {
  startStaleBookingCleanup();
}).catch((err) => {
  console.error('DB connection failed:', err);
});

// --- MIDDLEWARES ---
app.use(cookieParser());

// Redirect HTTP to HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// Serve uploads static files
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(path.join(process.cwd(), 'uploads'))
);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiter for all /api routes
app.use('/api', generalLimiter);

// --- ROUTES ---
app.use('/api/auth', userRouter);
app.use('/api/profile', profileRouter);
app.use('/api/cars', clientRoutes);
app.use('/api/bookings', bookingRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/companies', companyRouter);
app.use('/api/host', hostRouter);
app.use('/api/messages', messageRouter);
app.use('/api/reviews', reviewRouter);

// Google Places autocomplete proxy
app.get('/api/places/autocomplete', async (req, res) => {
  const { input } = req.query;
  if (!input) return res.json({ predictions: [] });
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(500).json({ predictions: [], error: 'Google Maps API key not configured' });
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:my&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    return res.json({ predictions: data.predictions || [] });
  } catch (err) {
    console.error('Places autocomplete error', err);
    return res.status(500).json({ predictions: [], error: 'Places lookup failed' });
  }
});

// Google Places geocode proxy
app.get('/api/places/geocode', async (req, res) => {
  const { address } = req.query;
  if (!address) return res.json({ results: [] });
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(500).json({ results: [], error: 'Google Maps API key not configured' });
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    return res.json({ results: data.results || [] });
  } catch (err) {
    console.error('Places geocode error', err);
    return res.status(500).json({ results: [], error: 'Geocode lookup failed' });
  }
});

// Host approval/rejection routes
app.post('/api/admin/host/:id/approve', authMiddleware, approveHost);
app.post('/api/admin/host/:id/reject', authMiddleware, rejectHost);

// KYC route
app.post(
  '/api/kyc/submit',
  authMiddleware,
  submitKycMultipart
);

// Upload route for files to S3
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

// --- SOCKET.IO EVENTS ---
io.on('connection', (socket) => {
  socket.on('join', (room) => socket.join(room));
  socket.on('joinUserRoom', (userId) => socket.join(`user-${userId}`));
  socket.on('privateMessage', (data) => {
    io.to(`user-${data.toUserId}`).emit('privateMessage', data);
    socket.emit('privateMessage', data);
  });
  socket.on('message', (data) => socket.to(data.room).emit('message', data));
});

// --- HEALTH + ROOT ---
app.get('/api/ping', (req, res) => res.json({ ok: true, time: Date.now() }));

app.get('/', (req, res) => {
  res.send('API WORKING');
});

// --- START SERVER ---
server.listen(PORT, () => console.log(`Server with Socket.io on ${PORT}`));