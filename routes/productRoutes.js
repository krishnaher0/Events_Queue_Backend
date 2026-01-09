import express from 'express';
import {
  getProducts,
  getFeaturedProducts,
  getProductCategories,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProductsAdmin,
  toggleProductStatus,
  toggleFeatured,
} from '../controller/productController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { uploadProductImage } from '../config/cloudinary.js';

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/categories', getProductCategories);
router.get('/:id', getProduct);

// Admin routes
router.get('/admin/all', protect, authorize('admin'), getAllProductsAdmin);
router.post('/', protect, authorize('admin'), uploadProductImage.single('image'), createProduct);
router.put('/:id', protect, authorize('admin'), uploadProductImage.single('image'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);
router.put('/:id/toggle-status', protect, authorize('admin'), toggleProductStatus);
router.put('/:id/toggle-featured', protect, authorize('admin'), toggleFeatured);

export default router;
