import express from 'express';
import {
  requestRefund,
  getMyRefunds,
  getAllRefunds,
  approveRefund,
  rejectRefund,
  processRefund,
  getRefundStats
} from '../controller/refundController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// User routes
router.post('/request', protect, requestRefund);
router.get('/my', protect, getMyRefunds);

// Admin routes
router.get('/admin/all', protect, authorize('admin'), getAllRefunds);
router.get('/admin/stats', protect, authorize('admin'), getRefundStats);
router.put('/:id/approve', protect, authorize('admin'), approveRefund);
router.put('/:id/reject', protect, authorize('admin'), rejectRefund);
router.put('/:id/process', protect, authorize('admin'), processRefund);

export default router;
