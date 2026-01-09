import express from 'express';
import {
  initiateEventPayment,
  verifyEventPayment,
  completePendingEventPayment,
  initiateOrderPayment,
  verifyOrderPayment,
  initiateVenuePayment,
  verifyVenuePayment,
  completePendingVenuePayment,
  verifyKhaltiPaymentCallback,
  getMyPayments,
  getAllPayments,
} from '../controller/payment.controller.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Event payment routes
router.post('/event/:eventId/initiate', protect, initiateEventPayment); // Initiate event payment (eSewa/Khalti)
router.post('/event/verify', verifyEventPayment); // Verify event payment (callback)
router.post('/event/complete-pending', protect, completePendingEventPayment); // Complete pending event payment

// Order payment routes (for products)
router.post('/order/initiate', protect, initiateOrderPayment); // Initiate product order payment
router.post('/order/verify', verifyOrderPayment); // Verify product order payment

// Venue payment routes
router.post('/venue/:bookingId/initiate', protect, initiateVenuePayment); // Initiate venue booking payment
router.post('/venue/verify', verifyVenuePayment); // Verify venue booking payment
router.post('/venue/complete-pending', protect, completePendingVenuePayment); // Complete pending venue payment

// Khalti payment verification (generic for all types)
router.post('/khalti/verify', verifyKhaltiPaymentCallback);

// User payment history
router.get('/my', protect, getMyPayments);

// Admin: get all payments
router.get('/admin/all', protect, authorize('admin'), getAllPayments);

export default router;