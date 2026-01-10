import Venue from '../model/Venue.js';
import VenueBooking from '../model/VenueBooking.js';
import { deleteImage, getPublicIdFromUrl } from '../config/cloudinary.js';

// @desc    Get all venues
// @route   GET /api/venues
// @access  Public
export const getVenues = async (req, res) => {
  try {
    const {
      type,
      city,
      minPrice,
      maxPrice,
      minCapacity,
      maxCapacity,
      amenities,
      search,
      sort = '-createdAt',
      page = 1,
      limit = 12,
    } = req.query;

    const query = { isActive: true, isApproved: true };

    if (type) query.type = type;
    if (city) query['address.city'] = { $regex: city, $options: 'i' };
    if (minPrice || maxPrice) {
      query['pricing.basePrice'] = {};
      if (minPrice) query['pricing.basePrice'].$gte = Number(minPrice);
      if (maxPrice) query['pricing.basePrice'].$lte = Number(maxPrice);
    }
    if (minCapacity || maxCapacity) {
      if (minCapacity) query['capacity.maximum'] = { $gte: Number(minCapacity) };
      if (maxCapacity) query['capacity.minimum'] = { $lte: Number(maxCapacity) };
    }
    if (amenities) {
      const amenitiesList = amenities.split(',');
      query.amenities = { $all: amenitiesList };
    }
    if (search) {
      query.$text = { $search: search };
    }

    const total = await Venue.countDocuments(query);
    const venues = await Venue.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      data: {
        venues,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / limit),
          total,
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

// @desc    Get featured venues
// @route   GET /api/venues/featured
// @access  Public
export const getFeaturedVenues = async (req, res) => {
  try {
    const venues = await Venue.find({
      isActive: true,
      isApproved: true,
      isFeatured: true,
    })
      .sort({ 'ratings.average': -1 })
      .limit(6);

    res.status(200).json({
      success: true,
      data: { venues },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get venue types with counts
// @route   GET /api/venues/types
// @access  Public
export const getVenueTypes = async (req, res) => {
  try {
    const types = await Venue.aggregate([
      { $match: { isActive: true, isApproved: true } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: { types },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get single venue
// @route   GET /api/venues/:id
// @access  Public
export const getVenue = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id)
      .populate('createdBy', 'fullName email');

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { venue },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create venue
// @route   POST /api/venues
// @access  Private (Admin)
export const createVenue = async (req, res) => {
  try {
    const venueData = {
      ...req.body,
      createdBy: req.user._id,
    };

    // Handle image upload
    if (req.file) {
      venueData.image = req.file.path;
    }

    // Handle multiple images
    if (req.files && req.files.length > 0) {
      venueData.images = req.files.map(file => file.path);
      if (!venueData.image && venueData.images.length > 0) {
        venueData.image = venueData.images[0];
      }
    }

    // Parse amenities if string
    if (typeof venueData.amenities === 'string') {
      venueData.amenities = venueData.amenities.split(',').map(a => a.trim()).filter(a => a);
    }

    // Parse rules if string
    if (typeof venueData.rules === 'string') {
      venueData.rules = venueData.rules.split(',').map(r => r.trim()).filter(r => r);
    }

    // Parse address if flat FormData
    if (req.body['address[street]'] || req.body['address[city]']) {
      venueData.address = {
        street: req.body['address[street]'] || '',
        city: req.body['address[city]'] || '',
        state: req.body['address[state]'] || '',
        country: req.body['address[country]'] || 'Nepal',
        zipCode: req.body['address[zipCode]'] || '',
      };
    }

    // Parse pricing if flat FormData
    if (req.body['pricing[basePrice]']) {
      venueData.pricing = {
        basePrice: Number(req.body['pricing[basePrice]']),
        pricePerHour: Number(req.body['pricing[pricePerHour]']) || undefined,
        pricePerDay: Number(req.body['pricing[pricePerDay]']) || undefined,
        currency: req.body['pricing[currency]'] || 'NPR',
      };
    }

    // Parse capacity if flat FormData
    if (req.body['capacity[maximum]']) {
      venueData.capacity = {
        minimum: Number(req.body['capacity[minimum]']) || 10,
        maximum: Number(req.body['capacity[maximum]']),
      };
    }

    // Admin creates are auto-approved
    if (req.user.role === 'admin') {
      venueData.isApproved = true;
    }

    const venue = await Venue.create(venueData);

    res.status(201).json({
      success: true,
      message: 'Venue created successfully',
      data: { venue },
    });
  } catch (error) {
    console.error('Create venue error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update venue
// @route   PUT /api/venues/:id
// @access  Private (Admin)
export const updateVenue = async (req, res) => {
  try {
    let venue = await Venue.findById(req.params.id);

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found',
      });
    }

    // Handle image upload
    if (req.file) {
      // Delete old image
      if (venue.image) {
        const publicId = getPublicIdFromUrl(venue.image);
        if (publicId) {
          await deleteImage(publicId).catch(err => console.error('Error deleting old image:', err));
        }
      }
      req.body.image = req.file.path;
    }

    venue = await Venue.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Venue updated successfully',
      data: { venue },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete venue
// @route   DELETE /api/venues/:id
// @access  Private (Admin)
export const deleteVenue = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found',
      });
    }

    // Delete images from Cloudinary
    if (venue.image) {
      const publicId = getPublicIdFromUrl(venue.image);
      if (publicId) {
        await deleteImage(publicId).catch(err => console.error('Error deleting image:', err));
      }
    }

    if (venue.images && venue.images.length > 0) {
      for (const img of venue.images) {
        const publicId = getPublicIdFromUrl(img);
        if (publicId) {
          await deleteImage(publicId).catch(err => console.error('Error deleting image:', err));
        }
      }
    }

    await venue.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Venue deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all venues for admin
// @route   GET /api/venues/admin/all
// @access  Private (Admin)
export const getAllVenuesAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, isApproved, isActive } = req.query;
    const query = {};

    if (type) query.type = type;
    if (isApproved !== undefined) query.isApproved = isApproved === 'true';
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const venues = await Venue.find(query)
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Venue.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        venues,
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

// @desc    Approve venue
// @route   PUT /api/venues/:id/approve
// @access  Private (Admin)
export const approveVenue = async (req, res) => {
  try {
    const venue = await Venue.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    );

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Venue approved successfully',
      data: { venue },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Toggle venue status
// @route   PUT /api/venues/:id/toggle-status
// @access  Private (Admin)
export const toggleVenueStatus = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found',
      });
    }

    venue.isActive = !venue.isActive;
    await venue.save();

    res.status(200).json({
      success: true,
      message: `Venue ${venue.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { venue },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Toggle featured status
// @route   PUT /api/venues/:id/toggle-featured
// @access  Private (Admin)
export const toggleVenueFeatured = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found',
      });
    }

    venue.isFeatured = !venue.isFeatured;
    await venue.save();

    res.status(200).json({
      success: true,
      message: `Venue ${venue.isFeatured ? 'featured' : 'unfeatured'} successfully`,
      data: { venue },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Check venue availability
// @route   GET /api/venues/:id/availability
// @access  Public
export const checkAvailability = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const venueId = req.params.id;

    const conflictingBookings = await VenueBooking.find({
      venue: venueId,
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } },
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        available: conflictingBookings.length === 0,
        conflictingBookings: conflictingBookings.map(b => ({
          startDate: b.startDate,
          endDate: b.endDate,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Book a venue
// @route   POST /api/venues/:id/book
// @access  Private
export const bookVenue = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found',
      });
    }

    if (!venue.isActive || !venue.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Venue is not available for booking',
      });
    }

    const {
      eventName,
      eventType,
      startDate,
      endDate,
      startTime,
      endTime,
      expectedGuests,
      requirements,
      notes,
    } = req.body;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start < now) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be in the future',
      });
    }

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date',
      });
    }

    // Check for conflicting bookings
    const conflictingBookings = await VenueBooking.find({
      venue: venue._id,
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start },
        },
      ],
    });

    if (conflictingBookings.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Venue is not available for the selected dates',
        conflictingBookings: conflictingBookings.map(b => ({
          startDate: b.startDate,
          endDate: b.endDate,
        })),
      });
    }

    // Calculate pricing
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) || 1;
    const basePrice = venue.pricing.basePrice * days;
    let additionalServices = 0;

    if (requirements) {
      if (requirements.catering && venue.amenities.catering) {
        additionalServices += venue.pricing.cateringPerPerson * expectedGuests;
      }
      if (requirements.decoration && venue.pricing.decorationPackage) {
        additionalServices += venue.pricing.decorationPackage;
      }
      if (requirements.audioVisual && venue.pricing.audioVisual) {
        additionalServices += venue.pricing.audioVisual;
      }
    }

    const totalPrice = basePrice + additionalServices;

    // Create booking
    const booking = await VenueBooking.create({
      user: req.user._id,
      venue: venue._id,
      eventName,
      eventType,
      startDate: start,
      endDate: end,
      startTime,
      endTime,
      expectedGuests,
      requirements: requirements || {},
      pricing: {
        basePrice,
        additionalServices,
        totalPrice,
      },
      notes,
      status: 'pending',
    });

    await booking.populate('venue', 'name image address pricing');

    res.status(201).json({
      success: true,
      message: 'Venue booking created successfully. Please proceed with payment.',
      data: { booking },
    });
  } catch (error) {
    console.error('Book venue error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get my venue bookings
// @route   GET /api/venues/bookings/my
// @access  Private
export const getMyVenueBookings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { user: req.user._id };

    if (status) query.status = status;

    const bookings = await VenueBooking.find(query)
      .populate('venue', 'name image address pricing')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await VenueBooking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get my venue bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get single venue booking
// @route   GET /api/venues/bookings/:id
// @access  Private
export const getVenueBooking = async (req, res) => {
  try {
    const booking = await VenueBooking.findById(req.params.id)
      .populate('venue', 'name image address pricing amenities')
      .populate('user', 'fullName email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check authorization
    if (booking.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    res.status(200).json({
      success: true,
      data: { booking },
    });
  } catch (error) {
    console.error('Get venue booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all venue bookings (Admin)
// @route   GET /api/venues/admin/bookings
// @access  Private (Admin)
export const getAllVenueBookingsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = {};

    if (status) query.status = status;

    const bookings = await VenueBooking.find(query)
      .populate('venue', 'name image address pricing')
      .populate('user', 'fullName email phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await VenueBooking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get all venue bookings admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

//