// Events_Queue_Ba.../server.js (or app.js)

import express from 'express';
import cors from 'cors';
import 'dotenv/config'; 
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import path from 'path';

import passport from 'passport';


import configurePassport from './config/passport.js';


// Allow all origins (development). For production, replace this with a safe whitelist or use an env var.
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (e.g., Postman) and allow any browser origin
        callback(null, true);
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    optionsSuccessStatus: 204
};

// Initialize App and DB
connectDB();
configurePassport();
const app = express();


// Middleware Setup
// Use express.json() to parse incoming JSON data from the frontend
app.use(express.json());
// CORS middleware allows the React app (on a different port) to access this API
app.use(cors(corsOptions));

// Define Routes
// All requests starting with /api/auth will be handled by authRoutes
app.use('/api/auth', authRoutes);

// Start Server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));