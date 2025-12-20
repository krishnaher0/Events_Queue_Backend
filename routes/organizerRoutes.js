import express from 'express';
import {
  submitOrganizerRequest,
  getMyOrganizerRequest,
  getAllOrganizerRequests,
  approveOrganizerRequest,
  rejectOrganizerRequest,
  getPendingRequestsCount,
} from '../controller/organizerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// User routes
router.post('/request', protect, submitOrganizerRequest);
router.get('/my-request', protect, getMyOrganizerRequest);

// Admin routes
router.get('/requests', protect, authorize('admin'), getAllOrganizerRequests);
router.get('/requests/pending-count', protect, authorize('admin'), getPendingRequestsCount);
router.put('/requests/:requestId/approve', protect, authorize('admin'), approveOrganizerRequest);
router.put('/requests/:requestId/reject', protect, authorize('admin'), rejectOrganizerRequest);

export default router;
