import Event from '../model/Event.js';
import User from '../model/User.js';
import { deleteImage, getPublicIdFromUrl } from '../config/cloudinary.js';

// @desc    Get all events
// @route   GET /api/events
// @access  Public
export const getEvents = async (req, res) => {
  try {
    const {
      category,
      search,
      location,
      date,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;

    // Query for published and approved events, or show all for demo purposes
    const query = {
      $or: [
        { status: 'published', isApproved: true },
        { status: 'published' },
        { status: 'draft' } 
      ]
    };

    if (category) query.category = category;
    if (location) query.location = { $regex: location, $options: 'i' };
    if (date) query.date = { $gte: new Date(date) };
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (search) {
      query.$text = { $search: search };
    }

    const total = await Event.countDocuments(query);
    const events = await Event.find(query)
      .populate('organizer', 'fullName email')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / limit),
          totalEvents: total,
          hasMore: page * limit < total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get featured events
// @route   GET /api/events/featured
// @access  Public
export const getFeaturedEvents = async (req, res) => {
  try {
    const events = await Event.find({
      isFeatured: true,
      startDate: { $gte: new Date() }
    })
      .populate('organizer', 'fullName email')
      .sort({ startDate: 1 })
      .limit(6);

    res.status(200).json({
      success: true,
      data: { events },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get trending events
// @route   GET /api/events/trending
// @access  Public
export const getTrendingEvents = async (req, res) => {
  try {
    const events = await Event.find({})
      .populate('organizer', 'fullName email')
      .sort({ views: -1, createdAt: -1 })
      .limit(6);

    res.status(200).json({
      success: true,
      data: { events },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get events by category
// @route   GET /api/events/category/:category
// @access  Public
export const getEventsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const events = await Event.find({
      category
    })
      .populate('organizer', 'fullName email')
      .sort({ startDate: 1 });

    res.status(200).json({
      success: true,
      data: { events },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get category counts
// @route   GET /api/events/categories/counts
// @access  Public
export const getCategoryCounts = async (req, res) => {
  try {
    const counts = await Event.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: { counts },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
export const getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'fullName email')
      .populate('attendees', 'fullName email');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { event },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create event
// @route   POST /api/events
// @access  Private
export const createEvent = async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      organizer: req.user._id,
    };

    // Parse ticketTypes if it's a string (from FormData)
    if (typeof eventData.ticketTypes === 'string') {
      try {
        eventData.ticketTypes = JSON.parse(eventData.ticketTypes);
      } catch (e) {
        eventData.ticketTypes = [];
      }
    }

    // Parse tags if it's a comma-separated string
    if (typeof eventData.tags === 'string' && eventData.tags) {
      eventData.tags = eventData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    // Parse isFree boolean
    if (typeof eventData.isFree === 'string') {
      eventData.isFree = eventData.isFree === 'true';
    }

    // Parse isApproved boolean
    if (typeof eventData.isApproved === 'string') {
      eventData.isApproved = eventData.isApproved === 'true';
    }

    // Parse totalCapacity to number
    if (eventData.totalCapacity) {
      eventData.totalCapacity = parseInt(eventData.totalCapacity, 10);
    }

    // Handle address fields from FormData (e.g., address[street], address[city])
    if (req.body['address[street]'] || req.body['address[city]']) {
      eventData.address = {
        street: req.body['address[street]'] || '',
        city: req.body['address[city]'] || '',
        state: req.body['address[state]'] || '',
        country: req.body['address[country]'] || '',
        zipCode: req.body['address[zipCode]'] || '',
      };
      // Clean up the flat address fields
      delete eventData['address[street]'];
      delete eventData['address[city]'];
      delete eventData['address[state]'];
      delete eventData['address[country]'];
      delete eventData['address[zipCode]'];
    }

    if (req.file) {
      // Cloudinary returns the URL in req.file.path
      eventData.image = req.file.path;
    }

    const event = await Event.create(eventData);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: { event },
    });
  } catch (error) {
    console.error('Create event error:', error);

    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private
export const updateEvent = async (req, res) => {
  try {
    let event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Check ownership
    if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this event',
      });
    }

    if (req.file) {
      // Delete old image from Cloudinary if exists
      if (event.image) {
        const publicId = getPublicIdFromUrl(event.image);
        if (publicId) {
          await deleteImage(publicId).catch(err => console.error('Error deleting old image:', err));
        }
      }
      // Cloudinary returns the URL in req.file.path
      req.body.image = req.file.path;
    }

    event = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: { event },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Check ownership
    if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this event',
      });
    }

    // Delete image from Cloudinary if exists
    if (event.image) {
      const publicId = getPublicIdFromUrl(event.image);
      if (publicId) {
        await deleteImage(publicId).catch(err => console.error('Error deleting image:', err));
      }
    }

    await event.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Book event
// @route   POST /api/events/:id/book
// @access  Private
export const bookEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Check if already booked
    if (event.attendees.includes(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You have already booked this event',
      });
    }

    // Check capacity
    if (event.capacity && event.attendees.length >= event.capacity) {
      return res.status(400).json({
        success: false,
        message: 'Event is fully booked',
      });
    }

    // Add user to attendees
    event.attendees.push(req.user._id);
    await event.save();

    // Add event to user's booked events
    await User.findByIdAndUpdate(req.user._id, {
      $push: { bookedEvents: event._id }
    });

    res.status(200).json({
      success: true,
      message: 'Event booked successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get my events (Organizer)
// @route   GET /api/events/my-events
// @access  Private (Organizer/Admin)
export const getMyEvents = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { organizer: req.user._id };

    if (status) query.status = status;

    const events = await Event.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        events,
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

// @desc    Get organizer dashboard stats
// @route   GET /api/events/organizer/stats
// @access  Private (Organizer/Admin)
export const getOrganizerStats = async (req, res) => {
  try {
    const organizerId = req.user._id;

    const totalEvents = await Event.countDocuments({ organizer: organizerId });
    const publishedEvents = await Event.countDocuments({ organizer: organizerId, status: 'published' });
    const draftEvents = await Event.countDocuments({ organizer: organizerId, status: 'draft' });

    const events = await Event.find({ organizer: organizerId });

    let totalBookings = 0;
    let totalRevenue = 0;

    events.forEach(event => {
      if (event.attendees) {
        totalBookings += event.attendees.length;
      }
      if (event.ticketTypes) {
        event.ticketTypes.forEach(ticket => {
          totalRevenue += (ticket.sold || 0) * ticket.price;
        });
      }
    });

    res.status(200).json({
      success: true,
      data: {
        totalEvents,
        publishedEvents,
        draftEvents,
        totalBookings,
        totalRevenue,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get organizer's recent bookings
// @route   GET /api/events/organizer/bookings
// @access  Private (Organizer/Admin)
export const getOrganizerBookings = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const events = await Event.find({ organizer: req.user._id })
      .populate('attendees', 'fullName email avatar')
      .select('title attendees startDate ticketTypes');

    // Create booking records
    let allBookings = [];
    events.forEach(event => {
      if (event.attendees && Array.isArray(event.attendees)) {
        event.attendees.forEach((attendee, index) => {
          allBookings.push({
            user: attendee,
            eventTitle: event.title,
            eventId: event._id,
            eventDate: event.startDate,
            bookingDate: event.createdAt,
          });
        });
      }
    });

    // Sort by most recent
    allBookings.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

    // Paginate
    const start = (page - 1) * limit;
    const paginatedBookings = allBookings.slice(start, start + parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        bookings: paginatedBookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(allBookings.length / limit),
          total: allBookings.length,
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

// @desc    Get all events for admin
// @route   GET /api/events/admin/all
// @access  Private (Admin)
export const getAllEventsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, isApproved } = req.query;
    const query = {};

    if (status) query.status = status;
    if (isApproved !== undefined) query.isApproved = isApproved === 'true';

    const events = await Event.find(query)
      .populate('organizer', 'fullName email avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        events,
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

// @desc    Approve event
// @route   PUT /api/events/:id/approve
// @access  Private (Admin)
export const approveEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    event.isApproved = true;
    event.status = 'published';
    event.approvedBy = req.user._id;
    event.approvedAt = new Date();
    await event.save();

    res.status(200).json({
      success: true,
      message: 'Event approved successfully',
      data: { event },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Reject event
// @route   PUT /api/events/:id/reject
// @access  Private (Admin)
export const rejectEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    event.isApproved = false;
    event.status = 'cancelled';
    await event.save();

    res.status(200).json({
      success: true,
      message: 'Event rejected',
      data: { event },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get admin dashboard stats
// @route   GET /api/events/admin/stats
// @access  Private (Admin)
export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalEvents = await Event.countDocuments();
    const pendingEvents = await Event.countDocuments({ status: 'pending' });
    const publishedEvents = await Event.countDocuments({ status: 'published' });
    const totalOrganizers = await User.countDocuments({ role: 'organizer' });

    // Revenue calculation
    const events = await Event.find();
    let totalRevenue = 0;
    let totalBookings = 0;

    events.forEach(event => {
      if (event.attendees) {
        totalBookings += event.attendees.length;
      }
      if (event.ticketTypes) {
        event.ticketTypes.forEach(ticket => {
          totalRevenue += (ticket.sold || 0) * ticket.price;
        });
      }
    });

    // Get recent activity
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('fullName email role createdAt avatar');

    const recentEvents = await Event.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('organizer', 'fullName')
      .select('title status createdAt organizer image category');

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalEvents,
        pendingEvents,
        publishedEvents,
        totalOrganizers,
        totalRevenue,
        totalBookings,
        recentUsers,
        recentEvents,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all users (Admin)
// @route   GET /api/events/admin/users
// @access  Private (Admin)
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    const query = {};

    if (role) query.role = role;

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-password');

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
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

// @desc    Update user role (Admin)
// @route   PUT /api/events/admin/users/:id/role
// @access  Private (Admin)
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
