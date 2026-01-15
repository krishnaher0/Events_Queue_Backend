import Notification from '../model/Notification.js';

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const { limit = 20, skip = 0, unreadOnly = false } = req.query;

    const query = { recipient: req.user._id };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .populate('sender', 'fullName avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.markAsRead();

    res.status(200).json({
      success: true,
      data: { notification }
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get unread count
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });

    res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Helper function to create and emit notification
export const createNotification = async (io, notificationData) => {
  try {
    console.log('📤 Creating notification for user:', notificationData.recipient);
    console.log('📤 Notification data:', {
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message
    });

    const notification = await Notification.create(notificationData);
    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'fullName avatar');

    // Emit to specific user via socket
    if (io) {
      const room = `user_${notificationData.recipient}`;
      const socketsInRoom = await io.in(room).allSockets();
      console.log(`📡 Emitting to room "${room}". Sockets in room:`, socketsInRoom.size);

      io.to(room).emit('notification', populatedNotification);
      console.log(`✅ Notification emitted to ${room}:`, populatedNotification.title);
    } else {
      console.warn('⚠️  Socket.IO instance not available!');
    }

    return populatedNotification;
  } catch (error) {
    console.error('❌ Create notification error:', error);
    throw error;
  }
};

// @desc    Test notification endpoint (for development)
// @route   POST /api/notifications/test
// @access  Private
export const testNotification = async (req, res) => {
  try {
    const io = req.app.get('io');

    const notification = await createNotification(io, {
      recipient: req.user._id,
      type: 'system',
      title: 'Test Notification',
      message: 'This is a test notification to verify the real-time notification system is working!',
      link: '/profile'
    });

    res.status(200).json({
      success: true,
      message: 'Test notification sent',
      data: { notification }
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
