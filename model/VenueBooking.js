import mongoose from 'mongoose';

const venueBookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      required: true,
    },
    eventName: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    expectedGuests: {
      type: Number,
      required: true,
    },
    requirements: {
      catering: {
        type: Boolean,
        default: false,
      },
      decoration: {
        type: Boolean,
        default: false,
      },
      audioVisual: {
        type: Boolean,
        default: false,
      },
      parking: {
        type: Boolean,
        default: false,
      },
      other: String,
    },
    pricing: {
      basePrice: {
        type: Number,
        required: true,
      },
      additionalServices: {
        type: Number,
        default: 0,
      },
      totalPrice: {
        type: Number,
        required: true,
      },
    },
    payment: {
      method: {
        type: String,
        enum: ['esewa', 'khalti', 'bank_transfer', 'cash'],
      },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },
      transactionId: String,
      paidAt: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
    notes: String,
    cancelledAt: Date,
    cancellationReason: String,
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
venueBookingSchema.index({ user: 1 });
venueBookingSchema.index({ venue: 1 });
venueBookingSchema.index({ status: 1 });
venueBookingSchema.index({ startDate: 1, endDate: 1 });
venueBookingSchema.index({ 'payment.status': 1 });

const VenueBooking = mongoose.model('VenueBooking', venueBookingSchema);

export default VenueBooking;
