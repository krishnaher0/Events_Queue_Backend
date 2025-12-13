const Event = require('../models/Event');
const asyncHandler = require('express-async-handler');

// @desc    Get all events
// @route   GET /api/events
// @access  Public
const getEvents = asyncHandler(async (req, res) => {
    const events = await Event.find({});
    res.json(events);
});

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
const getEventById = asyncHandler(async (req, res) => {
    const event = await Event.findById(req.params.id);

    if (event) {
        res.json(event);
    } else {
        res.status(404);
        throw new Error('Event not found');
    }
});

// @desc    Create a event
// @route   POST /api/events
// @access  Private (Admin/Organizer)
const createEvent = asyncHandler(async (req, res) => {
    const { title, description, date, location, image } = req.body;

    const event = new Event({
        user: req.user._id,
        title,
        description,
        date,
        location,
        image
    });

    const createdEvent = await event.save();
    res.status(201).json(createdEvent);
});

// @desc    Update an event
// @route   PUT /api/events/:id
// @access  Private (Admin/Organizer)
const updateEvent = asyncHandler(async (req, res) => {
    const { title, description, date, location, image } = req.body;

    const event = await Event.findById(req.params.id);

    if (event) {
        // Check ownership or admin status if needed, but for now middleware handles role access
        event.title = title || event.title;
        event.description = description || event.description;
        event.date = date || event.date;
        event.location = location || event.location;
        event.image = image || event.image;

        const updatedEvent = await event.save();
        res.json(updatedEvent);
    } else {
        res.status(404);
        throw new Error('Event not found');
    }
});

// @desc    Delete an event
// @route   DELETE /api/events/:id
// @access  Private (Admin/Organizer)
const deleteEvent = asyncHandler(async (req, res) => {
    const event = await Event.findById(req.params.id);

    if (event) {
        await Event.deleteOne({ _id: event._id });
        res.json({ message: 'Event removed' });
    } else {
        res.status(404);
        throw new Error('Event not found');
    }
});

module.exports = {
    getEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent
};
