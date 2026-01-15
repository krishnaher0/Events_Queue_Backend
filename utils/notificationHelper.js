import Notification from '../model/Notification.js';

/**
 * Create and emit notification via Socket.IO
 * @param {Object} io - Socket.IO instance from app.get('io')
 * @param {Object} data - Notification data
 * @param {String} data.recipient - User ID of the recipient
 * @param {String} data.sender - User ID of the sender (optional)
 * @param {String} data.type - Notification type
 * @param {String} data.title - Notification title
 * @param {String} data.message - Notification message
 * @param {String} data.link - Link to navigate (optional)
 * @param {Object} data.data - Additional data (optional)
 */
export const createAndEmitNotification = async (io, data) => {
  try {
    // Create notification in database
    const notification = await Notification.create({
      recipient: data.recipient,
      sender: data.sender,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
      data: data.data,
    });

    // Populate sender information
    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'fullName avatar');

    // Emit to specific user via socket
    if (io) {
      io.to(`user_${data.recipient}`).emit('notification', populatedNotification);
      console.log(`Notification sent to user_${data.recipient}`);
    }

    return populatedNotification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

/**
 * Create bulk notifications
 * @param {Object} io - Socket.IO instance
 * @param {Array} notificationsData - Array of notification data objects
 */
export const createBulkNotifications = async (io, notificationsData) => {
  try {
    const notifications = await Notification.insertMany(notificationsData);

    // Emit each notification to respective users
    if (io) {
      for (const notification of notifications) {
        const populated = await Notification.findById(notification._id)
          .populate('sender', 'fullName avatar');
        io.to(`user_${notification.recipient}`).emit('notification', populated);
      }
    }

    return notifications;
  } catch (error) {
    console.error('Create bulk notifications error:', error);
    throw error;
  }
};

/**
 * Notification templates for common scenarios
 */
export const NotificationTemplates = {
  // Event notifications
  eventBooked: (eventTitle, bookingId) => ({
    type: 'event_booking',
    title: 'Event Booked Successfully',
    message: `Your booking for "${eventTitle}" has been confirmed!`,
    link: `/my-tickets`,
    data: { bookingId }
  }),

  eventCreated: (eventTitle, eventId) => ({
    type: 'event_created',
    title: 'Event Created',
    message: `Your event "${eventTitle}" has been created and is pending approval.`,
    link: `/events/${eventId}`,
    data: { eventId }
  }),

  eventApproved: (eventTitle, eventId) => ({
    type: 'event_approved',
    title: 'Event Approved',
    message: `Your event "${eventTitle}" has been approved and is now live!`,
    link: `/events/${eventId}`,
    data: { eventId }
  }),

  eventRejected: (eventTitle, reason) => ({
    type: 'event_rejected',
    title: 'Event Rejected',
    message: `Your event "${eventTitle}" was rejected. Reason: ${reason}`,
    link: `/create-event`,
    data: { reason }
  }),

  // Order notifications
  orderPlaced: (orderId, totalAmount) => ({
    type: 'order_placed',
    title: 'Order Placed',
    message: `Your order #${orderId} has been placed successfully! Total: Rs. ${totalAmount}`,
    link: `/my-orders`,
    data: { orderId, totalAmount }
  }),

  orderConfirmed: (orderId) => ({
    type: 'order_confirmed',
    title: 'Order Confirmed',
    message: `Your order #${orderId} has been confirmed and is being prepared.`,
    link: `/my-orders`,
    data: { orderId }
  }),

  orderShipped: (orderId, trackingNumber) => ({
    type: 'order_shipped',
    title: 'Order Shipped',
    message: `Your order #${orderId} has been shipped! Tracking: ${trackingNumber}`,
    link: `/my-orders`,
    data: { orderId, trackingNumber }
  }),

  orderDelivered: (orderId) => ({
    type: 'order_delivered',
    title: 'Order Delivered',
    message: `Your order #${orderId} has been delivered. Thank you for shopping with us!`,
    link: `/my-orders`,
    data: { orderId }
  }),

  // Payment notifications
  paymentReceived: (amount, orderId) => ({
    type: 'payment_received',
    title: 'Payment Received',
    message: `Payment of Rs. ${amount} received successfully.`,
    link: `/my-orders`,
    data: { amount, orderId }
  }),

  paymentFailed: (amount, reason) => ({
    type: 'payment_failed',
    title: 'Payment Failed',
    message: `Payment of Rs. ${amount} failed. ${reason}`,
    link: `/cart`,
    data: { amount, reason }
  }),

  // Venue notifications
  venueBooked: (venueName, bookingId) => ({
    type: 'venue_booking',
    title: 'Venue Booked',
    message: `Your booking for "${venueName}" has been confirmed!`,
    link: `/my-venue-bookings`,
    data: { bookingId }
  }),

  venueApproved: (venueName, venueId) => ({
    type: 'venue_approved',
    title: 'Venue Approved',
    message: `Your venue "${venueName}" has been approved!`,
    link: `/venues/${venueId}`,
    data: { venueId }
  }),

  // System notifications
  welcomeMessage: () => ({
    type: 'system',
    title: 'Welcome to EventQueue!',
    message: 'Thank you for joining us. Explore events, shop products, and book venues!',
    link: '/'
  }),

  roleUpgraded: (newRole) => ({
    type: 'system',
    title: 'Role Updated',
    message: `Your role has been updated to ${newRole}!`,
    link: '/profile'
  })
};
