import Order from '../model/Order.js';
import Product from '../model/Product.js';
import { createNotification } from './notificationController.js';

// @desc    Get my orders
// @route   GET /api/orders/my
// @access  Private
export const getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { user: req.user._id };

    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate('items.product', 'name image')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name image price')
      .populate('user', 'fullName email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check authorization
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    res.status(200).json({
      success: true,
      data: { order },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get order by order number
// @route   GET /api/orders/track/:orderNumber
// @access  Public
export const trackOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .select('orderNumber status items.name items.quantity pricing createdAt deliveredAt');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { order },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check authorization
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Can only cancel pending or confirmed orders
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel order in current status',
      });
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = req.body.reason || 'Cancelled by user';
    await order.save();

    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity, sold: -item.quantity },
      });
    }

    // Send notification to user
    const io = req.app.get('io');
    if (io) {
      await createNotification(io, {
        recipient: order.user,
        type: 'order_cancelled',
        title: 'Order Cancelled',
        message: `Your order #${order.orderNumber} has been cancelled. ${order.cancellationReason}`,
        link: `/orders`,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: { order },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders/admin/all
// @access  Private (Admin)
export const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentStatus } = req.query;
    const query = {};

    if (status) query.status = status;
    if (paymentStatus) query['payment.status'] = paymentStatus;

    const orders = await Order.find(query)
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    // Stats
    const stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ['$payment.status', 'paid'] }, '$pricing.total', 0],
            },
          },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          confirmedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'shipped'] }, 1, 0] },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
        },
        stats: stats[0] || {},
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private (Admin)
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber, notes } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (notes) order.notes = notes;
    if (status === 'delivered') order.deliveredAt = new Date();

    await order.save();

    // Send notification to user based on status
    const io = req.app.get('io');
    if (io) {
      let notificationData = {
        recipient: order.user,
        sender: req.user._id,
        link: `/orders`,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber
        }
      };

      switch (status) {
        case 'confirmed':
          notificationData.type = 'order_confirmed';
          notificationData.title = 'Order Confirmed';
          notificationData.message = `Your order #${order.orderNumber} has been confirmed and is being prepared.`;
          break;
        case 'processing':
          notificationData.type = 'order_confirmed';
          notificationData.title = 'Order Processing';
          notificationData.message = `Your order #${order.orderNumber} is now being processed.`;
          break;
        case 'shipped':
          notificationData.type = 'order_shipped';
          notificationData.title = 'Order Shipped';
          notificationData.message = `Your order #${order.orderNumber} has been shipped!${trackingNumber ? ` Tracking: ${trackingNumber}` : ''}`;
          notificationData.data.trackingNumber = trackingNumber;
          break;
        case 'delivered':
          notificationData.type = 'order_delivered';
          notificationData.title = 'Order Delivered';
          notificationData.message = `Your order #${order.orderNumber} has been delivered. Thank you for shopping with us!`;
          break;
        case 'cancelled':
          notificationData.type = 'order_cancelled';
          notificationData.title = 'Order Cancelled';
          notificationData.message = `Your order #${order.orderNumber} has been cancelled.`;
          break;
      }

      if (notificationData.type) {
        await createNotification(io, notificationData);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: { order },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get order stats (Admin)
// @route   GET /api/orders/admin/stats
// @access  Private (Admin)
export const getOrderStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 7);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayStats, weekStats, monthStats, overallStats] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfDay }, 'payment.status': 'paid' } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfWeek }, 'payment.status': 'paid' } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfMonth }, 'payment.status': 'paid' } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
      ]),
      Order.aggregate([
        { $match: { 'payment.status': 'paid' } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        today: todayStats[0] || { count: 0, revenue: 0 },
        week: weekStats[0] || { count: 0, revenue: 0 },
        month: monthStats[0] || { count: 0, revenue: 0 },
        overall: overallStats[0] || { count: 0, revenue: 0 },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
