import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import userRouter from './routes/userRoutes.js';


const app = express();
const PORT = 7889;
dotenv.config();

connectDB();

// MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ROUTES
app.use('/api/auth', userRouter);

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