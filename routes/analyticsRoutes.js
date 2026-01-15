import express from 'express';
import {
  getAdminAnalytics,
  getEventAnalytics,
  getOrderAnalytics
} from '../controller/analyticsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require admin authentication
router.use(protect);
router.use(authorize('admin'));

// Analytics routes
router.get('/admin/overview', getAdminAnalytics);
router.get('/admin/events', getEventAnalytics);
router.get('/admin/orders', getOrderAnalytics);

export default router;
