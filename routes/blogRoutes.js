import express from 'express';
import {
  getBlogs,
  getBlog,
  createBlog,
  updateBlog,
  deleteBlog,
  toggleLike,
  addComment,
  getMyBlogs,
} from '../controller/blogController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadEventImage } from '../config/cloudinary.js'; // Reuse for blog images

const router = express.Router();

// Public routes
router.get('/', getBlogs);
router.get('/:slug', getBlog);

// Protected routes
router.get('/my/blogs', protect, getMyBlogs);
router.post('/', protect, uploadEventImage.single('coverImage'), createBlog);
router.put('/:id', protect, uploadEventImage.single('coverImage'), updateBlog);
router.delete('/:id', protect, deleteBlog);
router.post('/:id/like', protect, toggleLike);
router.post('/:id/comments', protect, addComment);

export default router;
