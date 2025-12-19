import express from 'express';
import passport from 'passport';
import { signup, login, getMe, getMyTickets, forgotPassword, verifyCode, resetPassword, resendCode } from '../controllers/auth.controller.js';
import { signupSchema, loginSchema, forgotPasswordSchema, verifyCodeSchema, resetPasswordSchema, validate } from '../validators/auth.validator.js';
import { protect } from '../middlewares/auth.middleware.js';
import generateToken from '../utils/generateToken.js';

const router = express.Router();

router.post('/signup', validate(signupSchema), signup);
router.post('/login', validate(loginSchema), login);
router.get('/me', protect, getMe);
router.get('/my-tickets', protect, getMyTickets);

// Password reset routes
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/verify-code', validate(verifyCodeSchema), verifyCode);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/resend-code', validate(forgotPasswordSchema), resendCode);

// Google OAuth routes
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=google_auth_failed`
  }),
  (req, res) => {
    // Generate JWT token
    const token = generateToken(req.user._id);

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${token}`);
  }
);

export default router;
