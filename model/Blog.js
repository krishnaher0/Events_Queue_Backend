import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Blog title is required'],
    trim: true,
    minlength: 5,
    maxlength: 200,
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
  },
  content: {
    type: String,
    required: [true, 'Blog content is required'],
    minlength: 50,
  },
  excerpt: {
    type: String,
    maxlength: 300,
  },
  coverImage: {
    type: String,
    default: '',
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  category: {
    type: String,
    enum: ['Events', 'Technology', 'Lifestyle', 'Business', 'Entertainment', 'Education', 'Other'],
    default: 'Other',
  },
  tags: [{
    type: String,
    trim: true,
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published',
  },
  views: {
    type: Number,
    default: 0,
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  isFeatured: {
    type: Boolean,
    default: false,
  },
  publishedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Generate slug before saving
blogSchema.pre('save', async function() {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim() + '-' + Date.now();
  }

  // Generate excerpt if not provided
  if (this.isModified('content') && !this.excerpt) {
    this.excerpt = this.content.substring(0, 200).trim() + '...';
  }

  // Set published date when status is published and publishedAt is not set
  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

// Indexes for better query performance
blogSchema.index({ slug: 1 });
blogSchema.index({ author: 1 });
blogSchema.index({ category: 1 });
blogSchema.index({ status: 1 });
blogSchema.index({ publishedAt: -1 });
blogSchema.index({ views: -1 });

const Blog = mongoose.model('Blog', blogSchema);

export default Blog;
