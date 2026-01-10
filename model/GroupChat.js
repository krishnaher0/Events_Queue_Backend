import mongoose from 'mongoose';

const groupChatSchema = new mongoose.Schema({
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true,
    index: true,
  },
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file'],
      default: 'text',
    },
    attachment: {
      url: String,
      fileName: String,
      fileSize: Number,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
    reactions: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      emoji: String,
    }],
    readBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      readAt: {
        type: Date,
        default: Date.now,
      },
    }],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroupChat.messages',
    },
    deletedAt: Date,
    isDeleted: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  }],
  participantsOnline: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  }],
  messageCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Update message count before saving
groupChatSchema.pre('save', function() {
  this.messageCount = this.messages.filter(m => !m.isDeleted).length;
});

// Indexes for better performance
groupChatSchema.index({ community: 1 });
groupChatSchema.index({ 'messages.createdAt': -1 });
groupChatSchema.index({ 'messages.sender': 1 });

const GroupChat = mongoose.model('GroupChat', groupChatSchema);

export default GroupChat;
