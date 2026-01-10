import express from 'express';
import {
  getCommunities,
  getCommunity,
  createCommunity,
  updateCommunity,
  joinCommunity,
  leaveCommunity,
  createPost,
  getCommunityPosts,
  updatePost,
  deletePost,
  togglePostLike,
  addPostComment,
  deleteComment,
  getMyCommunities,
  getCommunitiesByCategory,
  manageModerator,
  getGroupChat,
  sendMessage,
  getChatMessages,
  editMessage,
  deleteMessage,
  addReaction,
  markMessagesAsRead,
} from '../controller/communityController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { uploadEventImage } from '../config/cloudinary.js';

const router = express.Router();

// Protected routes - Must be before dynamic routes to avoid conflicts
router.get('/my/communities', protect, getMyCommunities);
router.get('/by-category/all', optionalAuth, getCommunitiesByCategory);

// Public routes with optional authentication
router.get('/', optionalAuth, getCommunities);
router.get('/:slug', optionalAuth, getCommunity);

// Protected routes - Community Management
router.post('/', protect, uploadEventImage.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'avatar', maxCount: 1 }
]), createCommunity);
router.put('/:id', protect, uploadEventImage.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'avatar', maxCount: 1 }
]), updateCommunity);
router.post('/:id/join', protect, joinCommunity);
router.post('/:id/leave', protect, leaveCommunity);
router.post('/:id/moderators', protect, manageModerator);

// Protected routes - Posts Management
router.get('/:id/posts', getCommunityPosts);
router.post('/:id/posts', protect, uploadEventImage.single('image'), createPost);
router.put('/:communityId/posts/:postId', protect, uploadEventImage.single('image'), updatePost);
router.delete('/:communityId/posts/:postId', protect, deletePost);
router.post('/:communityId/posts/:postId/like', protect, togglePostLike);

// Protected routes - Comments Management
router.post('/:communityId/posts/:postId/comments', protect, addPostComment);
router.delete('/:communityId/posts/:postId/comments/:commentId', protect, deleteComment);

// Protected routes - Group Chat
router.get('/:id/chat', protect, getGroupChat);
router.get('/:id/chat/messages', protect, getChatMessages);
router.post('/:id/chat/messages', protect, uploadEventImage.single('attachment'), sendMessage);
router.put('/:id/chat/messages/:messageId', protect, editMessage);
router.delete('/:id/chat/messages/:messageId', protect, deleteMessage);
router.post('/:id/chat/messages/:messageId/reactions', protect, addReaction);
router.post('/:id/chat/read', protect, markMessagesAsRead);

export default router;
