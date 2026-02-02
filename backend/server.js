import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import helmet from 'helmet';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';

import userRouter from './routes/userRoutes.js';
import carRouter from './routes/carRoutes.js';
import bookingRouter from './routes/bookingRoutes.js';
import paymentRouter from './routes/paymentRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import companyRouter from './routes/companyRoutes.js';
import hostRouter from './routes/hostRoutes.js';
import messageRouter from './routes/messageRoutes.js';
import reviewRouter from './routes/reviewRoutes.js';

import { generalLimiter } from './middlewares/rateLimit.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7889;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer(app);
const CLIENT_ORIGIN = process.env.CLIENT_URL || process.env.FRONTEND_URL || "*";

const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, credentials: true, methods: ["GET", "POST"] },
});

// Attach io to app for use in routes if needed
app.set('io', io);

connectDB();

app.use(cookieParser());

app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(path.join(process.cwd(), 'uploads'))
);

app.use('/api/payments/razorpay/webhook', express.raw({ type: 'application/json' }));

app.use(cors({ origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN, credentials: true }));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', generalLimiter);

app.use('/api/auth', userRouter);
app.use('/api/cars', carRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/companies', companyRouter);
app.use('/api/host', hostRouter);
app.use('/api/messages', messageRouter);
app.use('/api/reviews', reviewRouter);

io.on('connection', (socket) => {
  socket.on('join', (room) => socket.join(room));
  socket.on('joinUserRoom', (userId) => socket.join(`user-${userId}`));

  socket.on('privateMessage', (data) => {
    if (!data?.toUserId || !data?.fromUserId) return;
    const payload = { ...data, timestamp: data.timestamp || new Date() };
    io.to(`user-${data.toUserId}`).emit('privateMessage', payload);
    socket.emit('privateMessage', payload); // Echo to sender for UI update
  });

  socket.on('message', (data) => socket.to(data.room).emit('message', data));
});

server.listen(PORT, () => console.log(`Server with Socket.io on ${PORT}`));

app.get('/api/ping', (req, res) => res.json({ ok: true, time: Date.now() }));
app.get('/', (req, res) => {
  res.send('API WORKING');
});