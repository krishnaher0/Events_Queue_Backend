import mongoose from 'mongoose';

const communitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Community name is required'],
    trim: true,
    unique: true,
    minlength: 3,
    maxlength: 100,
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
  },
  description: {
    type: String,
    required: [true, 'Community description is required'],
    minlength: 20,
    maxlength: 1000,
  },
  coverImage: {
    type: String,
    default: '',
  },
  avatar: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    enum: ['Events', 'Technology', 'Lifestyle', 'Business', 'Entertainment', 'Education', 'Sports', 'Other'],
    default: 'Other',
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  posts: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
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
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  rules: [{
    title: String,
    description: String,
  }],
  privacy: {
    type: String,
    enum: ['public', 'private'],
    default: 'public',
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  },
  memberCount: {
    type: Number,
    default: 0,
  },
  postCount: {
    type: Number,
    default: 0,
  },
  groupChat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupChat',
  },
  isChatEnabled: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Generate slug before saving
communitySchema.pre('save', async function() {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim();
  }

  // Update member count
  this.memberCount = this.members.length;

  // Update post count
  this.postCount = this.posts.length;
});

// Indexes
communitySchema.index({ slug: 1 });
communitySchema.index({ creator: 1 });
communitySchema.index({ category: 1 });
communitySchema.index({ status: 1 });
communitySchema.index({ memberCount: -1 });

const Community = mongoose.model('Community', communitySchema);

export default Community;
