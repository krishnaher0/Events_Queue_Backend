import Event from '../model/Event.js';
import Order from '../model/Order.js';
import Venue from '../model/Venue.js';
import Payment from '../model/Payment.js';

// @desc    Get admin analytics overview
// @route   GET /api/analytics/admin/overview
// @access  Private/Admin
export const getAdminAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get total counts
    const [totalEvents, totalOrders, totalVenueBookings, totalRevenue] = await Promise.all([
      Event.countDocuments(),
      Order.countDocuments(),
      Venue.aggregate([
        { $unwind: '$bookings' },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0)
    ]);

    // Get revenue by period
    const revenueByPeriod = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Get events by category
    const eventsByCategory = await Event.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get events by status
    const eventsByStatus = await Event.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get top events by bookings
    const topEvents = await Event.aggregate([
      {
        $project: {
          title: 1,
          category: 1,
          attendeeCount: { $size: { $ifNull: ['$attendees', []] } },
          views: 1,
          image: 1
        }
      },
      { $sort: { attendeeCount: -1 } },
      { $limit: 5 }
    ]);

    // Get orders by status
    const ordersByStatus = await Order.aggregate([
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent activities (last 10)
    const recentEvents = await Event.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title category status createdAt organizer')
      .populate('organizer', 'fullName');

    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('orderNumber orderStatus pricing createdAt user')
      .populate('user', 'fullName');

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalEvents,
          totalOrders,
          totalVenueBookings,
          totalRevenue: Math.round(totalRevenue)
        },
        charts: {
          revenueByPeriod: revenueByPeriod.map(r => ({
            date: `${r._id.year}-${String(r._id.month).padStart(2, '0')}-${String(r._id.day).padStart(2, '0')}`,
            revenue: r.revenue,
            count: r.count
          })),
          eventsByCategory,
          eventsByStatus,
          ordersByStatus,
          topEvents
        },
        recent: {
          events: recentEvents,
          orders: recentOrders
        }
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get event analytics
// @route   GET /api/analytics/admin/events
// @access  Private/Admin
export const getEventAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Events created over time
    const eventsOverTime = await Event.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Bookings over time
    const bookingsOverTime = await Event.aggregate([
      { $unwind: '$attendees' },
      {
        $match: {
          'attendees.bookingDate': { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$attendees.bookingDate' },
            month: { $month: '$attendees.bookingDate' },
            day: { $dayOfMonth: '$attendees.bookingDate' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$attendees.totalPrice' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        eventsOverTime: eventsOverTime.map(e => ({
          date: `${e._id.year}-${String(e._id.month).padStart(2, '0')}-${String(e._id.day).padStart(2, '0')}`,
          count: e.count
        })),
        bookingsOverTime: bookingsOverTime.map(b => ({
          date: `${b._id.year}-${String(b._id.month).padStart(2, '0')}-${String(b._id.day).padStart(2, '0')}`,
          count: b.count,
          revenue: b.revenue
        }))
      }
    });
  } catch (error) {
    console.error('Event analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get order analytics
// @route   GET /api/analytics/admin/orders
// @access  Private/Admin
export const getOrderAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Orders over time
    const ordersOverTime = await Order.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.total' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Top products
    const topProducts = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        ordersOverTime: ordersOverTime.map(o => ({
          date: `${o._id.year}-${String(o._id.month).padStart(2, '0')}-${String(o._id.day).padStart(2, '0')}`,
          count: o.count,
          revenue: o.revenue
        })),
        topProducts
      }
    });
  } catch (error) {
    console.error('Order analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
