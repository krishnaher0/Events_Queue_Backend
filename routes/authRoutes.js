// Events_Queue_Ba.../routes/authRoutes.js

import express from 'express';
import { signupUser, loginUser } from '../controller/authController.js';

const router = express.Router();

// Route for /api/auth/signup
router.post('/signup', signupUser);

// Route for /api/auth/login
router.post('/login', loginUser);

export default router;