const Booking = require('../models/Booking');
const asyncHandler = require('express-async-handler');

// @desc    Create a booking
// @route   POST /api/bookings
// @access  Private
const createBooking = asyncHandler(async (req, res) => {
    const { type, eventId, venueId, date, tickets, totalAmount, paymentId } = req.body;

    const booking = new Booking({
        user: req.user._id,
        type,
        event: type === 'event' ? eventId : undefined,
        venue: type === 'venue' ? venueId : undefined,
        date,
        tickets,
        totalAmount,
        paymentId
    });

    const createdBooking = await booking.save();
    res.status(201).json(createdBooking);
});

// @desc    Get user bookings
// @route   GET /api/bookings/my
// @access  Private
const getMyBookings = asyncHandler(async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate('event', 'title image location date')
        .populate('venue', 'name images address')
        .sort({ createdAt: -1 });
    res.json(bookings);
});

module.exports = { createBooking, getMyBookings };
