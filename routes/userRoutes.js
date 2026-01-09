const express = require('express');
const router = express.Router();
const {
    registerUser,
    authUser,
    forgotPassword,
    verifyResetCode,
    resetPassword,
    getUserProfile
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', registerUser);
router.post('/login', authUser);

// Password reset routes (email verification only for password reset)
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-code', verifyResetCode);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/profile', protect, getUserProfile);

module.exports = router;
