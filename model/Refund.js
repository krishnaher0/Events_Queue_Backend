import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },
  attendeeEntry: {
    type: mongoose.Schema.Types.ObjectId,
    required: true // Reference to the specific attendee entry in event.attendees array
  },
  ticketType: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  refundAmount: {
    type: Number,
    required: true,
    min: 0
  },
  reason: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processed'],
    default: 'pending',
    index: true
  },
  adminNotes: {
    type: String,
    maxlength: 500
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  processedAt: {
    type: Date
  },
  refundMethod: {
    type: String,
    enum: ['original_payment_method', 'bank_transfer', 'cash'],
    default: 'original_payment_method'
  },
  bankDetails: {
    accountName: String,
    accountNumber: String,
    bankName: String,
    branch: String
  },
  transactionId: {
    type: String // For tracking refund transaction
  }
}, {
  timestamps: true
});

// Index for efficient queries
refundSchema.index({ user: 1, status: 1, createdAt: -1 });
refundSchema.index({ event: 1, status: 1 });
refundSchema.index({ status: 1, createdAt: -1 });

// Virtual to check if refund is still eligible (within 24 hours before event)
refundSchema.virtual('isEligible').get(function() {
  if (!this.event || !this.event.startDate) return false;
  const eventDate = new Date(this.event.startDate);
  const now = new Date();
  const hoursDiff = (eventDate - now) / (1000 * 60 * 60);
  return hoursDiff > 24; // More than 24 hours before event
});

const Refund = mongoose.model('Refund', refundSchema);

export default Refund;
