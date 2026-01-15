import Product from '../model/Product.js';
import User from '../model/User.js';
import { deleteImage, getPublicIdFromUrl } from '../config/cloudinary.js';
import { createNotification } from './notificationController.js';

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res) => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      sort = '-createdAt',
      page = 1,
      limit = 12,
    } = req.query;

    const query = { isActive: true };

    if (category) query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (search) {
      query.$text = { $search: search };
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / limit),
          total,
          hasMore: page * limit < total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
export const getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true, isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(8);

    res.status(200).json({
      success: true,
      data: { products },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Public
export const getProductCategories = async (req, res) => {
  try {
    const categories = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { product },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create product
// @route   POST /api/products
// @access  Private (Admin)
export const createProduct = async (req, res) => {
  try {
    const productData = {
      ...req.body,
      createdBy: req.user._id,
    };

    // Handle image upload
    if (req.file) {
      productData.image = req.file.path;
    }

    // Handle multiple images
    if (req.files && req.files.length > 0) {
      productData.images = req.files.map(file => file.path);
      if (!productData.image && productData.images.length > 0) {
        productData.image = productData.images[0];
      }
    }

    // Parse sizes if string
    if (typeof productData.sizes === 'string') {
      try {
        productData.sizes = JSON.parse(productData.sizes);
      } catch (e) {
        productData.sizes = [];
      }
    }

    // Parse colors if string
    if (typeof productData.colors === 'string') {
      try {
        productData.colors = JSON.parse(productData.colors);
      } catch (e) {
        productData.colors = [];
      }
    }

    // Parse tags if string
    if (typeof productData.tags === 'string') {
      productData.tags = productData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    const product = await Product.create(productData);

    // Send notification to all users about new product (only featured ones to avoid spam)
    const io = req.app.get('io');
    if (io && product.isFeatured) {
      // Get all non-admin users to notify about new featured product
      const users = await User.find({ role: { $in: ['user', 'organizer'] } }).limit(100).select('_id');

      for (const user of users) {
        await createNotification(io, {
          recipient: user._id,
          sender: req.user._id,
          type: 'system',
          title: 'New Product Available',
          message: `Check out our new featured product: ${product.name}`,
          link: `/shop/${product._id}`,
          data: { productId: product._id }
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin)
export const updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Handle image upload
    if (req.file) {
      // Delete old image from Cloudinary
      if (product.image) {
        const publicId = getPublicIdFromUrl(product.image);
        if (publicId) {
          await deleteImage(publicId).catch(err => console.error('Error deleting old image:', err));
        }
      }
      req.body.image = req.file.path;
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Admin)
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Delete images from Cloudinary
    if (product.image) {
      const publicId = getPublicIdFromUrl(product.image);
      if (publicId) {
        await deleteImage(publicId).catch(err => console.error('Error deleting image:', err));
      }
    }

    if (product.images && product.images.length > 0) {
      for (const img of product.images) {
        const publicId = getPublicIdFromUrl(img);
        if (publicId) {
          await deleteImage(publicId).catch(err => console.error('Error deleting image:', err));
        }
      }
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all products for admin
// @route   GET /api/products/admin/all
// @access  Private (Admin)
export const getAllProductsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, isActive } = req.query;
    const query = {};

    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const products = await Product.find(query)
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Toggle product status
// @route   PUT /api/products/:id/toggle-status
// @access  Private (Admin)
export const toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    product.isActive = !product.isActive;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { product },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Toggle featured status
// @route   PUT /api/products/:id/toggle-featured
// @access  Private (Admin)
export const toggleFeatured = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    product.isFeatured = !product.isFeatured;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product ${product.isFeatured ? 'featured' : 'unfeatured'} successfully`,
      data: { product },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
