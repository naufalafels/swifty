import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import path from 'path';
import helmet from 'helmet';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';
import userRouter from './routes/userRoutes.js';
import carRouter from './routes/carRoutes.js';


const app = express();
const PORT = 7889;
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

connectDB();

// MIDDLEWARES
app.use(cors());
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    '/uploads', (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', "*");
        next();
    },
    express.static(path.join(process.cwd(), 'uploads'))
)


// ROUTES
app.use('/api/auth', userRouter);
app.use('/api/cars', carRouter);

app.get('api/ping', (req, res) => res.json({
    ok: true,
    time: Date.now()
}))


// LISTEN
app.get('/', (req, res) => {
    res.send('API WORKING')
});

app.listen(PORT, () => {
    console.log(`Server Started on http://localhost:${PORT}`)
});