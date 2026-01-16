import Event from '../model/Event.js';

// Get recommended events based on user's booking history
// This is personalized for all users - even without login, based on popular events
export const getRecommendedEvents = async (req, res) => {
  try {
    const userId = req.user?._id;
    const limit = parseInt(req.query.limit) || 6;

    // If user is logged in, get personalized recommendations
    if (userId) {
      return getPersonalizedRecommendations(req, res, userId, limit);
    }

    // For non-logged in users, show trending/popular events
    return getTrendingEvents(req, res, limit);
  } catch (error) {
    console.error('Error getting recommended events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommended events',
      error: error.message
    });
  }
};

// Get personalized recommendations for logged-in users based on their booking history
const getPersonalizedRecommendations = async (req, res, userId, limit) => {
  try {
    // Get events where user has bookings
    const userBookedEvents = await Event.find({
      'attendees.user': userId,
      'attendees.status': 'confirmed'
    })
      .populate('organizer', 'fullName email')
      .sort({ 'attendees.bookingDate': -1 })
      .limit(20); // Analyze last 20 bookings

    // If user has no bookings, return trending events
    if (!userBookedEvents || userBookedEvents.length === 0) {
      return getTrendingEvents(req, res, limit);
    }

    // Extract event IDs and prepare booking data
    const bookedEventIds = userBookedEvents.map(event => event._id);

    // Get user's attendee entries from each event
    const userBookings = userBookedEvents.map(event => {
      const userAttendee = event.attendees.find(
        attendee => attendee.user.toString() === userId.toString()
      );
      return {
        event: event,
        ticketType: userAttendee?.ticketType,
        quantity: userAttendee?.quantity,
        totalPrice: userAttendee?.totalPrice,
        bookingDate: userAttendee?.bookingDate
      };
    });

    // Analyze user preferences from booking history
    const preferences = analyzeUserPreferences(userBookings);

    // Find similar events based on preferences
    const recommendedEvents = await findSimilarEvents(preferences, bookedEventIds, limit);

    // If not enough recommendations, supplement with trending events
    if (recommendedEvents.length < limit) {
      const trendingEvents = await Event.find({
        _id: { $nin: [...bookedEventIds, ...recommendedEvents.map(e => e._id)] },
        status: 'published',
        startDate: { $gte: new Date() }
      })
        .populate('organizer', 'fullName email')
        .sort({ 'attendees.length': -1, createdAt: -1 })
        .limit(limit - recommendedEvents.length);

      recommendedEvents.push(...trendingEvents);
    }

    res.json({
      success: true,
      data: {
        events: recommendedEvents,
        basedOn: 'personal_history',
        preferences: {
          topCategories: preferences.topCategories.slice(0, 3),
          totalBookings: userBookings.length
        }
      }
    });
  } catch (error) {
    console.error('Error getting personalized recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get personalized recommendations',
      error: error.message
    });
  }
};

// Get trending events for users without booking history
const getTrendingEvents = async (req, res, limit) => {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get events with most bookings in the last week
    const trendingEvents = await Event.aggregate([
      {
        $match: {
          status: 'published',
          startDate: { $gte: now }
        }
      },
      {
        $addFields: {
          recentBookingCount: {
            $size: {
              $filter: {
                input: '$attendees',
                as: 'attendee',
                cond: { $gte: ['$$attendee.bookingDate', oneWeekAgo] }
              }
            }
          },
          totalBookings: { $size: '$attendees' }
        }
      },
      {
        $sort: {
          recentBookingCount: -1,
          totalBookings: -1,
          createdAt: -1
        }
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: 'users',
          localField: 'organizer',
          foreignField: '_id',
          as: 'organizerDetails'
        }
      },
      {
        $unwind: {
          path: '$organizerDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          organizer: {
            _id: '$organizerDetails._id',
            fullName: '$organizerDetails.fullName',
            email: '$organizerDetails.email'
          }
        }
      },
      {
        $project: {
          recentBookingCount: 0,
          organizerDetails: 0
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        events: trendingEvents,
        basedOn: 'trending'
      }
    });
  } catch (error) {
    console.error('Error getting trending events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending events',
      error: error.message
    });
  }
};

// Analyze user preferences from their booking history
const analyzeUserPreferences = (bookings) => {
  const preferences = {
    categories: {},
    venueTypes: {},
    priceRange: { min: Infinity, max: 0 },
    locations: {},
    ticketTypes: {}
  };

  bookings.forEach(booking => {
    const event = booking.event;
    if (!event) return;

    // Category preferences (weighted by recency)
    if (event.category) {
      preferences.categories[event.category] = (preferences.categories[event.category] || 0) + 1;
    }

    // Venue type preferences
    if (event.venueType) {
      preferences.venueTypes[event.venueType] = (preferences.venueTypes[event.venueType] || 0) + 1;
    }

    // Price range analysis
    if (booking.totalPrice) {
      preferences.priceRange.min = Math.min(preferences.priceRange.min, booking.totalPrice);
      preferences.priceRange.max = Math.max(preferences.priceRange.max, booking.totalPrice);
    }

    // Location preferences
    if (event.venueName) {
      const location = event.venueName.toLowerCase();
      preferences.locations[location] = (preferences.locations[location] || 0) + 1;
    }

    // Ticket type preferences
    if (booking.ticketType) {
      preferences.ticketTypes[booking.ticketType] = (preferences.ticketTypes[booking.ticketType] || 0) + 1;
    }
  });

  // Sort categories by frequency (most booked first)
  preferences.topCategories = Object.entries(preferences.categories)
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);

  // Sort venue types by frequency
  preferences.topVenueTypes = Object.entries(preferences.venueTypes)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  // Sort locations by frequency
  preferences.topLocations = Object.entries(preferences.locations)
    .sort((a, b) => b[1] - a[1])
    .map(([location]) => location)
    .slice(0, 5);

  return preferences;
};

// Find similar events based on user preferences with intelligent scoring
const findSimilarEvents = async (preferences, excludeEventIds, limit) => {
  try {
    // Build query based on preferences
    const query = {
      _id: { $nin: excludeEventIds },
      status: 'published',
      startDate: { $gte: new Date() }
    };

    // Prioritize events in user's top categories
    if (preferences.topCategories && preferences.topCategories.length > 0) {
      query.category = { $in: preferences.topCategories };
    }

    // Find matching events
    const events = await Event.find(query)
      .populate('organizer', 'fullName email')
      .limit(limit * 3); // Get more events for better scoring

    // Score each event based on similarity to user preferences
    const scoredEvents = events.map(event => {
      let score = 0;

      // Category match (highest weight - 40%)
      if (preferences.topCategories && preferences.topCategories.includes(event.category)) {
        const categoryIndex = preferences.topCategories.indexOf(event.category);
        score += (preferences.topCategories.length - categoryIndex) * 15;
      }

      // Venue type match (20%)
      if (preferences.topVenueTypes && preferences.topVenueTypes.includes(event.venueType)) {
        const venueIndex = preferences.topVenueTypes.indexOf(event.venueType);
        score += (preferences.topVenueTypes.length - venueIndex) * 7;
      }

      // Price range similarity (15%)
      if (event.pricing && event.pricing.length > 0 && preferences.priceRange.min !== Infinity) {
        const eventMinPrice = Math.min(...event.pricing.map(p => p.price));
        const eventMaxPrice = Math.max(...event.pricing.map(p => p.price));

        // Check if price ranges overlap
        if (
          (eventMinPrice >= preferences.priceRange.min && eventMinPrice <= preferences.priceRange.max) ||
          (eventMaxPrice >= preferences.priceRange.min && eventMaxPrice <= preferences.priceRange.max)
        ) {
          score += 5;
        }
      }

      // Location match (15%)
      if (event.venueName && preferences.topLocations && preferences.topLocations.length > 0) {
        const eventLocation = event.venueName.toLowerCase();
        const locationMatch = preferences.topLocations.some(loc =>
          eventLocation.includes(loc) || loc.includes(eventLocation)
        );
        if (locationMatch) {
          score += 5;
        }
      }

      // Popularity boost (10%) - events that others are booking
      if (event.attendees && event.attendees.length > 0) {
        score += Math.min(event.attendees.length / 5, 3);
      }

      // Recency boost - newer events get slight advantage
      const daysSinceCreation = (new Date() - new Date(event.createdAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation <= 7) {
        score += 2; // New events in last 7 days
      }

      return { event, score };
    });

    // Sort by score (highest first) and return top events
    const topEvents = scoredEvents
      .filter(item => item.score > 0) // Only return events with some relevance
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.event);

    return topEvents;
  } catch (error) {
    console.error('Error finding similar events:', error);
    return [];
  }
};

// Get user's recommendation insights (for profile/analytics)
export const getUserRecommendationInsights = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get events where user has bookings
    const userBookedEvents = await Event.find({
      'attendees.user': userId,
      'attendees.status': 'confirmed'
    })
      .populate('organizer', 'fullName email')
      .sort({ 'attendees.bookingDate': -1 });

    if (!userBookedEvents || userBookedEvents.length === 0) {
      return res.json({
        success: true,
        data: {
          insights: {
            totalBookings: 0,
            message: 'Start booking events to get personalized recommendations!'
          }
        }
      });
    }

    // Get user's attendee entries from each event
    const userBookings = userBookedEvents.map(event => {
      const userAttendee = event.attendees.find(
        attendee => attendee.user.toString() === userId.toString()
      );
      return {
        event: event,
        ticketType: userAttendee?.ticketType,
        quantity: userAttendee?.quantity,
        totalPrice: userAttendee?.totalPrice,
        bookingDate: userAttendee?.bookingDate
      };
    });

    const preferences = analyzeUserPreferences(userBookings);

    res.json({
      success: true,
      data: {
        insights: {
          totalBookings: userBookings.length,
          topCategories: preferences.topCategories.slice(0, 3),
          favoriteVenueType: preferences.topVenueTypes[0],
          priceRange: preferences.priceRange.min !== Infinity ? preferences.priceRange : null,
          topLocations: preferences.topLocations.slice(0, 3)
        }
      }
    });
  } catch (error) {
    console.error('Error getting recommendation insights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommendation insights',
      error: error.message
    });
  }
};
