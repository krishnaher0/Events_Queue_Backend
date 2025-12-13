const Community = require('../models/Community');
const asyncHandler = require('express-async-handler');

// @desc    Get all communities
// @route   GET /api/communities
// @access  Public
const getCommunities = asyncHandler(async (req, res) => {
    const communities = await Community.find({});
    res.json(communities);
});

// @desc    Create a community
// @route   POST /api/communities
// @access  Private
const createCommunity = asyncHandler(async (req, res) => {
    const { name, description, image } = req.body;
    const community = new Community({
        name,
        description,
        image,
        creator: req.user._id,
        members: [req.user._id] // Creator is the first member
    });
    const createdCommunity = await community.save();
    res.status(201).json(createdCommunity);
});

module.exports = { getCommunities, createCommunity };
