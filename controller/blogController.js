import Blog from '../model/Blog.js';

// @desc    Get all blogs
// @route   GET /api/blogs
// @access  Public
export const getBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 12, category, status, search } = req.query;

    const query = {};

    // Only filter by status if explicitly provided
    if (status) {
      query.status = status;
    } else {
      // By default, show only published blogs
      query.status = 'published';
    }

    if (category && category !== 'all') query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const blogs = await Blog.find(query)
      .populate('author', 'fullName avatar email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Blog.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        blogs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
          hasMore: page * limit < total,
        },
      },
    });
  } catch (error) {
    console.error('Get blogs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get single blog
// @route   GET /api/blogs/:slug
// @access  Public
export const getBlog = async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug })
      .populate('author', 'fullName avatar email')
      .populate('comments.user', 'fullName avatar');

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found',
      });
    }

    // Increment views
    blog.views += 1;
    await blog.save();

    res.status(200).json({
      success: true,
      data: { blog },
    });
  } catch (error) {
    console.error('Get blog error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create blog
// @route   POST /api/blogs
// @access  Private
export const createBlog = async (req, res) => {
  try {
    const { title, content, excerpt, category, status } = req.body;

    // Handle tags from FormData - can be tags[] or tags
    let tagsData = req.body.tags || req.body['tags[]'];
    let processedTags = [];

    if (tagsData) {
      if (typeof tagsData === 'string') {
        processedTags = tagsData.split(',').map(tag => tag.trim());
      } else if (Array.isArray(tagsData)) {
        processedTags = tagsData;
      }
    }

    const blogData = {
      title,
      content,
      excerpt,
      category,
      tags: processedTags,
      author: req.user.id,
      coverImage: req.file ? req.file.path : '',
    };

    // Only include status if explicitly provided
    if (status) {
      blogData.status = status;
    }

    const blog = await Blog.create(blogData);

    await blog.populate('author', 'fullName avatar email');

    res.status(201).json({
      success: true,
      message: 'Blog created successfully',
      data: { blog },
    });
  } catch (error) {
    console.error('Create blog error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update blog
// @route   PUT /api/blogs/:id
// @access  Private
export const updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found',
      });
    }

    // Check ownership
    if (blog.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this blog',
      });
    }

    const { title, content, excerpt, category, status } = req.body;

    // Handle tags from FormData - can be tags[] or tags
    let tagsData = req.body.tags || req.body['tags[]'];
    let processedTags = blog.tags; // Keep existing tags by default

    if (tagsData) {
      if (typeof tagsData === 'string') {
        processedTags = tagsData.split(',').map(tag => tag.trim());
      } else if (Array.isArray(tagsData)) {
        processedTags = tagsData;
      }
    }

    blog.title = title || blog.title;
    blog.content = content || blog.content;
    blog.excerpt = excerpt || blog.excerpt;
    blog.category = category || blog.category;
    blog.tags = processedTags;
    blog.status = status || blog.status;

    if (req.file) {
      blog.coverImage = req.file.path;
    }

    await blog.save();
    await blog.populate('author', 'fullName avatar email');

    res.status(200).json({
      success: true,
      message: 'Blog updated successfully',
      data: { blog },
    });
  } catch (error) {
    console.error('Update blog error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete blog
// @route   DELETE /api/blogs/:id
// @access  Private
export const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found',
      });
    }

    // Check ownership
    if (blog.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this blog',
      });
    }

    await blog.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Blog deleted successfully',
    });
  } catch (error) {
    console.error('Delete blog error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Like/Unlike blog
// @route   POST /api/blogs/:id/like
// @access  Private
export const toggleLike = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found',
      });
    }

    const likeIndex = blog.likes.indexOf(req.user.id);

    if (likeIndex > -1) {
      blog.likes.splice(likeIndex, 1);
    } else {
      blog.likes.push(req.user.id);
    }

    await blog.save();

    res.status(200).json({
      success: true,
      data: { likes: blog.likes.length, isLiked: likeIndex === -1 },
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Add comment
// @route   POST /api/blogs/:id/comments
// @access  Private
export const addComment = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found',
      });
    }

    const { content } = req.body;

    blog.comments.push({
      user: req.user.id,
      content,
    });

    await blog.save();
    await blog.populate('comments.user', 'fullName avatar');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: { comments: blog.comments },
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get my blogs
// @route   GET /api/blogs/my
// @access  Private
export const getMyBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const blogs = await Blog.find({ author: req.user.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Blog.countDocuments({ author: req.user.id });

    res.status(200).json({
      success: true,
      data: {
        blogs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get my blogs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
