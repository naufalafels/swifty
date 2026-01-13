import mongoose from "mongoose";
import User from '../models/userModel.js';
import validator from "validator";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// TOKEN SETTINGS
const TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || '24h';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

const createToken = (userId) => {
    const secret = JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not defined on server.');
    return jwt.sign({ id: userId }, secret, { expiresIn: TOKEN_EXPIRES_IN });
}

// REGISTER FUNCTION
export async function register(req, res) {
    try {
        const name = String(req.body.name || "").trim();
        const emailRaw = String(req.body.email || "").trim();
        const email = validator.normalizeEmail(emailRaw) || emailRaw.toLowerCase();
        const password = String(req.body.password || "");

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required.'
            });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email.'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be atleast 8 characters.'
            });
        }

        const exists = await User.findOne({ email }).lean();
        if(exists) {
            return res.status(409).json({
                success: false,
                message: 'User already exists.'
            });
        }

        const newId = new mongoose.Types.ObjectId();
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            _id: newId,
            name,
            email,
            password: hashedPassword,
        });
        await user.save();

        const token = createToken(newId.toString());

        return res.status(201).json({
            success: true,
            message: 'Account has been created successfully!',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    }

    catch (err) {
        console.error('Registering Error', err);
        if (err.code === 11000)
            return res.status(409).json({
                success: false, 
                message: 'User already exists.'
            });

        return res.status(500).json({
            success: false,
            message: 'Server Error!'
        });
    }
}

// LOGIN FUNCTION
export async function login(req, res) {
    try {
        const emailRaw = String(req.body.email || "").trim();
        const email = validator.normalizeEmail(emailRaw) || emailRaw.toLowerCase();
        const password = String(req.body.password || "");

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required.'
            });
        }

        const user = await User.findOne({ email });
        if (!user)
        return res.status(401).json({
            success: false,
            message: 'Invalid email!'
        });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({
            success: false,
            message: 'Invalid password!'
        });

        // Sign token using the same JWT_SECRET that auth middleware will use
        const token = createToken(user._id.toString());
        return res.status(200).json({
            success: true,
            message: 'Login Successfully!',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    }

    catch (err) {
        console.error('Login Error!', err);
        return res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
}