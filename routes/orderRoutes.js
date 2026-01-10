import express from 'express';
import {
  getMyOrders,
  getOrder,
  trackOrder,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  getOrderStats,
} from '../controller/orderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// User routes - specific routes FIRST
router.get('/my', protect, getMyOrders);
router.get('/track/:orderNumber', trackOrder);
router.put('/:id/cancel', protect, cancelOrder);

// Admin routes
router.get('/admin/all', protect, authorize('admin'), getAllOrders);
router.get('/admin/stats', protect, authorize('admin'), getOrderStats);
router.put('/:id/status', protect, authorize('admin'), updateOrderStatus);

// Generic routes - MUST come LAST
router.get('/:id', protect, getOrder);

export default router;
