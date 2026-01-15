// Events_Queue_Ba.../server.js (or app.js)

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import 'dotenv/config';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import productRoutes from './routes/productRoutes.js';
import venueRoutes from './routes/venueRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import path from 'path';
import paymentRoutes from './routes/paymentRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import communityRoutes from './routes/communityRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import refundRoutes from './routes/refundRoutes.js';
import jwt from 'jsonwebtoken';
import User from './model/User.js';
import Community from './model/Community.js';
import GroupChat from './model/GroupChat.js';

import passport from 'passport';


import configurePassport from './config/passport.js';
import organizerRoutes from './routes/organizerRoutes.js';


// Allow all origins (development). For production, replace this with a safe whitelist or use an env var.
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (e.g., Postman) and allow any browser origin
        callback(null, true);
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    optionsSuccessStatus: 204
};

// Initialize App and DB
connectDB();
configurePassport();
const app = express();


// Middleware Setup
// Use express.json() to parse incoming JSON data from the frontend
app.use(express.json());
// CORS middleware allows the React app (on a different port) to access this API
app.use(cors(corsOptions));
// Initialize Passport middleware
app.use(passport.initialize());

// Define Routes
// All requests starting with /api/auth will be handled by authRoutes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/products', productRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/refunds', refundRoutes);

// Start Server with Socket.io
const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// Make io globally accessible for notifications
app.set('io', io);

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.fullName} (${socket.user._id})`);

  // Join user's personal notification room
  socket.join(`user_${socket.user._id}`);
  console.log(`User ${socket.user._id} joined notification room`);

  // Join community chat room
  socket.on('join-community', async (communityId) => {
    try {
      const community = await Community.findById(communityId);

      if (!community) {
        socket.emit('error', { message: 'Community not found' });
        return;
      }

      // Check if user is a member
      const isMember = community.members.some(
        m => m.user.toString() === socket.user._id.toString()
      );

      if (!isMember) {
        socket.emit('error', { message: 'You must be a member to join the chat' });
        return;
      }

      socket.join(`community-${communityId}`);
      console.log(`${socket.user.fullName} joined community ${communityId}`);

      // Notify others that user joined
      socket.to(`community-${communityId}`).emit('user-joined', {
        user: {
          _id: socket.user._id,
          fullName: socket.user.fullName,
          avatar: socket.user.avatar
        }
      });
    } catch (error) {
      console.error('Join community error:', error);
      socket.emit('error', { message: 'Failed to join community' });
    }
  });

  // Send message
  socket.on('send-message', async (data) => {
    try {
      const { communityId, content } = data;

      const community = await Community.findById(communityId);
      if (!community) {
        socket.emit('error', { message: 'Community not found' });
        return;
      }

      // Check membership
      const isMember = community.members.some(
        m => m.user.toString() === socket.user._id.toString()
      );

      if (!isMember) {
        socket.emit('error', { message: 'You must be a member to send messages' });
        return;
      }

      // Get or create group chat
      let groupChat = await GroupChat.findById(community.groupChat);
      if (!groupChat) {
        groupChat = await GroupChat.create({ community: communityId });
        community.groupChat = groupChat._id;
        await community.save();
      }

      // Add message
      const message = {
        sender: socket.user._id,
        content,
        messageType: 'text',
      };

      groupChat.messages.push(message);
      await groupChat.save();

      // Populate sender info
      await groupChat.populate('messages.sender', 'fullName avatar');
      const newMessage = groupChat.messages[groupChat.messages.length - 1];

      // Broadcast to all users in the community
      io.to(`community-${communityId}`).emit('new-message', {
        message: newMessage
      });

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Add reaction
  socket.on('add-reaction', async (data) => {
    try {
      const { communityId, messageId, emoji } = data;

      const community = await Community.findById(communityId);
      const groupChat = await GroupChat.findById(community.groupChat);

      if (!groupChat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      const message = groupChat.messages.id(messageId);
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Toggle reaction
      const existingReaction = message.reactions.find(
        r => r.user.toString() === socket.user._id.toString() && r.emoji === emoji
      );

      if (existingReaction) {
        message.reactions = message.reactions.filter(
          r => !(r.user.toString() === socket.user._id.toString() && r.emoji === emoji)
        );
      } else {
        message.reactions.push({ user: socket.user._id, emoji });
      }

      await groupChat.save();

      // Broadcast reaction update
      io.to(`community-${communityId}`).emit('reaction-updated', {
        messageId,
        reactions: message.reactions
      });

    } catch (error) {
      console.error('Add reaction error:', error);
      socket.emit('error', { message: 'Failed to add reaction' });
    }
  });

  // User is typing
  socket.on('typing', (communityId) => {
    socket.to(`community-${communityId}`).emit('user-typing', {
      user: {
        _id: socket.user._id,
        fullName: socket.user.fullName
      }
    });
  });

  // User stopped typing
  socket.on('stop-typing', (communityId) => {
    socket.to(`community-${communityId}`).emit('user-stop-typing', {
      userId: socket.user._id
    });
  });

  // Leave community
  socket.on('leave-community', (communityId) => {
    socket.leave(`community-${communityId}`);
    console.log(`${socket.user.fullName} left community ${communityId}`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.fullName}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Socket.io enabled for real-time chat`);
});