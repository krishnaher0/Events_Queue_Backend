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
  getVenueBooking,
  getAllVenueBookingsAdmin,
} from '../controller/venueController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { uploadVenueImage } from '../config/cloudinary.js';

const router = express.Router();

// Public routes
router.get('/', getVenues);
router.get('/featured', getFeaturedVenues);
router.get('/types', getVenueTypes);

// User routes - MUST come before /:id routes
router.get('/bookings/my', protect, getMyVenueBookings);
router.get('/bookings/:id', protect, getVenueBooking);
router.post('/:id/book', protect, bookVenue);

// Public routes with :id parameter - MUST come after specific routes
router.get('/:id', getVenue);
router.get('/:id/availability', checkAvailability);

// Admin routes
router.get('/admin/all', protect, authorize('admin'), getAllVenuesAdmin);
router.get('/admin/bookings', protect, authorize('admin'), getAllVenueBookingsAdmin);

router.post('/', protect, authorize('admin'), uploadVenueImage.single('image'), createVenue);
router.put('/:id', protect, authorize('admin'), uploadVenueImage.single('image'), updateVenue);
router.delete('/:id', protect, authorize('admin'), deleteVenue);
router.put('/:id/approve', protect, authorize('admin'), approveVenue);
router.put('/:id/toggle-status', protect, authorize('admin'), toggleVenueStatus);
router.put('/:id/toggle-featured', protect, authorize('admin'), toggleVenueFeatured);


export default router;
