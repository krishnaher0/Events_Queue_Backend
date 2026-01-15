import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  testNotification
} from '../controller/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/test', testNotification);

// Debug endpoint to check socket status
router.get('/debug/socket-info', async (req, res) => {
  try {
    const io = req.app.get('io');
    const room = `user_${req.user._id}`;
    const socketsInRoom = await io.in(room).allSockets();
    const allSockets = await io.fetchSockets();

    res.json({
      success: true,
      data: {
        userId: req.user._id,
        userName: req.user.fullName,
        roomName: room,
        socketsInRoom: Array.from(socketsInRoom),
        socketCount: socketsInRoom.size,
        totalConnectedSockets: allSockets.length,
        allSocketsInfo: allSockets.map(s => ({
          id: s.id,
          userId: s.user?._id,
          userName: s.user?.fullName,
          rooms: Array.from(s.rooms)
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching socket info',
      error: error.message
    });
  }
});

router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
