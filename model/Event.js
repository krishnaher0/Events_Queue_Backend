import mongoose from 'mongoose';

const ticketTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  sold: {
    type: Number,
    default: 0,
  },
  description: String,
});

const eventSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    minlength: 3,
    maxlength: 100,
  },
  slug: {
    type: String,
    unique: true,
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    minlength: 10,
    maxlength: 5000,
  },
  shortDescription: {
    type: String,
    maxlength: 200,
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Business Seminar',
      'Social & Networking',
      'Sports & Fitness',
      'Food & Drink',
      'Workshops',
      'Arts & Culture',
      'Technology',
      'Health & Wellness',
      'Education',
      'Charity',
      'Other'
    ],
  },
  tags: [{
    type: String,
    trim: true,
  }],
  image: {
    type: String,
    default: '',
  },
  gallery: [{
    type: String,
  }],

  // Date & Time
  startDate: {
    type: Date,
    required: [true, 'Event start date is required'],
  },
  endDate: {
    type: Date,
  },
  startTime: {
    type: String,
    required: [true, 'Event start time is required'],
  },
  endTime: {
    type: String,
  },

  // Location
  venueType: {
    type: String,
    enum: ['physical', 'online', 'hybrid'],
    default: 'physical',
  },
  venueName: {
    type: String,
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
  },
  coordinates: {
    lat: Number,
    lng: Number,
  },
  onlineLink: {
    type: String,
  },

  // Tickets & Pricing
  ticketTypes: [ticketTypeSchema],
  isFree: {
    type: Boolean,
    default: false,
  },
  currency: {
    type: String,
    default: 'NPR',
  },
  totalCapacity: {
    type: Number,
    min: 1,
  },

  // Additional Details
  ageRestriction: {
    type: String,
    enum: ['all', '18+', '21+', 'kids'],
    default: 'all',
  },
  refundPolicy: {
    type: String,
  },
  termsAndConditions: {
    type: String,
  },
  contactEmail: {
    type: String,
  },
  contactPhone: {
    type: String,
  },

  // Organizer
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Bookings
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    ticketType: String,
    quantity: Number,
    totalPrice: Number,
    bookingDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['confirmed', 'pending', 'cancelled'],
      default: 'confirmed',
    },
  }],

  // Status & Visibility
  status: {
    type: String,
    enum: ['draft', 'pending', 'published', 'cancelled', 'completed'],
    default: 'draft',
  },
  isApproved: {
    type: Boolean,
    default: false,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
    type: Date,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  isPublic: {
    type: Boolean,
    default: true,
  },

  // Analytics
  views: {
    type: Number,
    default: 0,
  },
  shares: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Generate slug before saving
eventSchema.pre('save', function(next) {
  if (this.isModified('title') || !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') + '-' + Date.now();
  }
  next();
});

// Virtual for total tickets sold
eventSchema.virtual('totalTicketsSold').get(function() {
  return this.ticketTypes.reduce((total, ticket) => total + ticket.sold, 0);
});

// Virtual for total revenue
eventSchema.virtual('totalRevenue').get(function() {
  return this.ticketTypes.reduce((total, ticket) => total + (ticket.sold * ticket.price), 0);
});

// Index for better search performance
eventSchema.index({ title: 'text', description: 'text', 'address.city': 'text' });
eventSchema.index({ category: 1, startDate: 1 });
eventSchema.index({ isFeatured: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ status: 1, isApproved: 1 });

const Event = mongoose.model('Event', eventSchema);

export default Event;
