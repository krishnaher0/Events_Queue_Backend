// Events_Queue_Ba.../server.js (or app.js)

import express from 'express';
import cors from 'cors';
import 'dotenv/config'; 
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';

const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174']; // Add any other deployment URLs here later

const corsOptions = {
    origin: function (origin, callback) {
        // Check if the origin is in the allowed list or if it's a same-origin request (origin is undefined for tools like Postman)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    optionsSuccessStatus: 204
};

// Initialize App and DB
connectDB();
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