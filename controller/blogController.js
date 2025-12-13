const Blog = require('../models/Blog');
const asyncHandler = require('express-async-handler');

// @desc    Get all blogs
// @route   GET /api/blogs
// @access  Public
const getBlogs = asyncHandler(async (req, res) => {
    const blogs = await Blog.find({}).populate('author', 'name');
    res.json(blogs);
});

// @desc    Create a blog post
// @route   POST /api/blogs
// @access  Private
const createBlog = asyncHandler(async (req, res) => {
    const { title, content, image, tags } = req.body;
    const blog = new Blog({
        title,
        content,
        image,
        author: req.user._id,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });
    const createdBlog = await blog.save();
    res.status(201).json(createdBlog);
});

module.exports = { getBlogs, createBlog };
