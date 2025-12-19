import mongoose from 'mongoose';

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Venue name is required'],
      trim: true,
      maxlength: [150, 'Venue name cannot exceed 150 characters'],
    },
    slug: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      required: [true, 'Venue description is required'],
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    shortDescription: {
      type: String,
      maxlength: [250, 'Short description cannot exceed 250 characters'],
    },
    type: {
      type: String,
      required: [true, 'Venue type is required'],
      enum: [
        'Conference Hall',
        'Banquet Hall',
        'Outdoor Venue',
        'Hotel',
        'Restaurant',
        'Stadium',
        'Auditorium',
        'Meeting Room',
        'Rooftop',
        'Garden',
        'Beach',
        'Other',
      ],
    },
    images: [{
      type: String,
    }],
    image: {
      type: String,
    },
    address: {
      street: String,
      city: {
        type: String,
        required: [true, 'City is required'],
      },
      state: String,
      country: {
        type: String,
        default: 'Nepal',
      },
      zipCode: String,
    },
    coordinates: {
      lat: Number,
      lng: Number,
    },
    capacity: {
      minimum: {
        type: Number,
        default: 10,
      },
      maximum: {
        type: Number,
        required: [true, 'Maximum capacity is required'],
      },
    },
    pricing: {
      basePrice: {
        type: Number,
        required: [true, 'Base price is required'],
      },
      pricePerHour: Number,
      pricePerDay: Number,
      currency: {
        type: String,
        default: 'NPR',
      },
    },
    amenities: [{
      type: String,
      enum: [
        'WiFi',
        'Parking',
        'Air Conditioning',
        'Sound System',
        'Projector',
        'Stage',
        'Catering',
        'Security',
        'Wheelchair Access',
        'Power Backup',
        'Green Room',
        'Changing Rooms',
        'Kitchen',
        'Bar',
        'Pool',
        'Garden',
        'Decoration',
        'Photography',
        'Videography',
      ],
    }],
    features: [{
      name: String,
      description: String,
    }],
    rules: [{
      type: String,
    }],
    availability: {
      monday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
      tuesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
      wednesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
      thursday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
      friday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
      saturday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
      sunday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    },
    contact: {
      phone: String,
      email: String,
      website: String,
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
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
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
venueSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now();
  }
  next();
});

// Text search index
venueSchema.index({ name: 'text', description: 'text', 'address.city': 'text' });
venueSchema.index({ type: 1 });
venueSchema.index({ 'address.city': 1 });
venueSchema.index({ 'pricing.basePrice': 1 });
venueSchema.index({ isActive: 1, isApproved: 1 });

const Venue = mongoose.model('Venue', venueSchema);

export default Venue;
