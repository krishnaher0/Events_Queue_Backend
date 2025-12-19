import mongoose from 'mongoose';

const organizerRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  organizationName: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true,
  },
  organizationType: {
    type: String,
    enum: ['individual', 'company', 'nonprofit', 'government', 'educational'],
    required: true,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    minlength: 50,
  },
  website: {
    type: String,
    trim: true,
  },
  socialMedia: {
    facebook: String,
    instagram: String,
    twitter: String,
  },
  previousExperience: {
    type: String,
    required: true,
  },
  expectedEventsPerMonth: {
    type: Number,
    required: true,
  },
  eventCategories: [{
    type: String,
    enum: ['music', 'sports', 'arts', 'food', 'business', 'technology', 'education', 'charity', 'other'],
  }],
  documents: [{
    name: String,
    url: String,
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  adminNotes: {
    type: String,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

const OrganizerRequest = mongoose.model('OrganizerRequest', organizerRequestSchema);

export default OrganizerRequest;
