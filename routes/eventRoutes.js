import express from 'express';
import {
  getEvents,
  getFeaturedEvents,
  getTrendingEvents,
  getEventsByCategory,
  getCategoryCounts,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  bookEvent,
  getMyEvents,
  getOrganizerStats,
  getOrganizerBookings,
  getAllEventsAdmin,
  approveEvent,
  rejectEvent,
  getAdminStats,
  getAllUsers,
  updateUserRole,
} from '../controller/eventController.js';
import { createEventSchema, updateEventSchema, validate } from '../validators/event.validator.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { uploadEventImage } from '../config/cloudinary.js';

const router = express.Router();

// Use Cloudinary storage for image uploads
const upload = uploadEventImage;

// Public routes
router.get('/', getEvents);
router.get('/featured', getFeaturedEvents);
router.get('/trending', getTrendingEvents);
router.get('/categories/counts', getCategoryCounts);
router.get('/category/:category', getEventsByCategory);

// Organizer routes (must be before /:id)
router.get('/my-events', protect, authorize('organizer', 'admin'), getMyEvents);
router.get('/organizer/stats', protect, authorize('organizer', 'admin'), getOrganizerStats);
router.get('/organizer/bookings', protect, authorize('organizer', 'admin'), getOrganizerBookings);

// Admin routes (must be before /:id)
router.get('/admin/all', protect, authorize('admin'), getAllEventsAdmin);
router.get('/admin/stats', protect, authorize('admin'), getAdminStats);
router.get('/admin/users', protect, authorize('admin'), getAllUsers);
router.put('/admin/users/:id/role', protect, authorize('admin'), updateUserRole);

// Single event route
router.get('/:id', getEvent);

// Multer error handling wrapper
const handleUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({
        success: false,
        message: 'Image upload failed',
        error: err.message,
      });
    }
    next();
  });
};

// Protected routes
router.post('/', protect, authorize('organizer', 'admin'), handleUpload, createEvent);
router.put('/:id', protect, upload.single('image'), updateEvent);
router.delete('/:id', protect, deleteEvent);
router.post('/:id/book', protect, bookEvent);

// Admin event actions
router.put('/:id/approve', protect, authorize('admin'), approveEvent);
router.put('/:id/reject', protect, authorize('admin'), rejectEvent);

export default router;
