import express from 'express';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import {
  getRecommendedEvents,
  getUserRecommendationInsights
} from '../controller/recommendationController.js';

const router = express.Router();

// Public route - works for both logged in and guest users
router.get('/events', optionalAuth, getRecommendedEvents);

// Protected route - get user's recommendation insights
router.get('/insights', protect, getUserRecommendationInsights);

export default router;
