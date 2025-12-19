import express from 'express';
import {
  getVenues,
  getFeaturedVenues,
  getVenueTypes,
  getVenue,
  createVenue,
  updateVenue,
  deleteVenue,
  getAllVenuesAdmin,
  approveVenue,
  toggleVenueStatus,
  toggleVenueFeatured,
  checkAvailability,
  bookVenue,
  getMyVenueBookings,
  getAllVenueBookings,
  updateBookingStatus,
} from '../controllers/venueController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { uploadVenueImage } from '../config/cloudinary.js';

const router = express.Router();

// Public routes
router.get('/', getVenues);
router.get('/featured', getFeaturedVenues);
router.get('/types', getVenueTypes);
router.get('/:id', getVenue);
router.get('/:id/availability', checkAvailability);

// User routes
router.post('/:id/book', protect, bookVenue);
router.get('/bookings/my', protect, getMyVenueBookings);

// Admin routes
router.get('/admin/all', protect, authorize('admin'), getAllVenuesAdmin);
router.get('/bookings/admin', protect, authorize('admin'), getAllVenueBookings);
router.post('/', protect, authorize('admin'), uploadVenueImage.single('image'), createVenue);
router.put('/:id', protect, authorize('admin'), uploadVenueImage.single('image'), updateVenue);
router.delete('/:id', protect, authorize('admin'), deleteVenue);
router.put('/:id/approve', protect, authorize('admin'), approveVenue);
router.put('/:id/toggle-status', protect, authorize('admin'), toggleVenueStatus);
router.put('/:id/toggle-featured', protect, authorize('admin'), toggleVenueFeatured);
router.put('/bookings/:id/status', protect, authorize('admin'), updateBookingStatus);

export default router;
