// Events_Queue_Ba.../controller/authController.js

import User from '../model/User.js';
import jwt from 'jsonwebtoken';
import 'dotenv/config'; 

// --- Helper Function ---
const generateToken = (id) => {
  // Uses the JWT_SECRET from your .env file
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' }); 
};

// --- 1. SIGNUP CONTROLLER ---
export const signupUser = async (req, res) => {
  // The 'role' field is automatically set to 'user' by default in the Mongoose schema
  const { fullName, email, password } = req.body; 

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Role will be 'user' by default, as defined in User.js
    const user = await User.create({ fullName, email, password }); 

    if (user) {
      res.status(201).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        // ✨ NEW: Include the role in the signup response
        role: user.role, 
        token: generateToken(user._id), 
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('CRITICAL SERVER ERROR:', error); 
    console.log('JWT_SECRET Status:', process.env.JWT_SECRET ? 'LOADED' : 'MISSING!');
    res.status(500).json({ message: 'Server error during signup' });
  }
};

// --- 2. LOGIN CONTROLLER ---
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    // Check if user exists AND if the password matches using the model method
    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        fullName: user.fullName, // Added fullName for consistency
        email: user.email,
        // ✨ NEW: Include the role in the login response
        role: user.role, 
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error during login' });
  }
};