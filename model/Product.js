import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [100, 'Product name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    shortDescription: {
      type: String,
      maxlength: [200, 'Short description cannot exceed 200 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    comparePrice: {
      type: Number,
      min: [0, 'Compare price cannot be negative'],
    },
    currency: {
      type: String,
      default: 'NPR',
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Event Apparel',
        'Desk & Stationery',
        'Bags & Accessories',
        'Event Supplies',
        'Tech & Gadgets',
        'Food & Beverages',
        'Sports & Fitness',
        'Merchandise',
        'Other',
      ],
    },
    subcategory: {
      type: String,
    },
    images: [{
      type: String,
    }],
    image: {
      type: String,
    },
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
    },
    sizes: [{
      name: String,
      stock: Number,
      price: Number,
    }],
    colors: [{
      name: String,
      hex: String,
      stock: Number,
    }],
    attributes: [{
      name: String,
      value: String,
    }],
    tags: [{
      type: String,
    }],
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    ratings: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    sold: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Generate slug before saving
productSchema.pre('save', function () {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now();
  }
});

// Text search index
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ isActive: 1 });

const Product = mongoose.model('Product', productSchema);

export default Product;
