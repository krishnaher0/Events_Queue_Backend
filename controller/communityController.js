import Community from '../model/Community.js';
import GroupChat from '../model/GroupChat.js';

// @desc    Get all communities
// @route   GET /api/communities
// @access  Public
export const getCommunities = async (req, res) => {
  try {
    const { page = 1, limit = 12, category, search } = req.query;
    const userId = req.user?.id; // Get user ID if authenticated

    const query = { status: 'active' };
    if (category && category !== 'all') query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const communities = await Community.find(query)
      .populate('creator', 'fullName avatar')
      .sort({ memberCount: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Add membership status for each community if user is authenticated
    const communitiesWithStatus = communities.map(community => {
      const communityObj = community.toObject();
      if (userId) {
        communityObj.isMember = community.members.some(
          m => m.user.toString() === userId
        );
        communityObj.isModerator = community.moderators.some(
          mod => mod.toString() === userId
        );
        communityObj.isCreator = community.creator._id.toString() === userId;
      } else {
        communityObj.isMember = false;
        communityObj.isModerator = false;
        communityObj.isCreator = false;
      }
      return communityObj;
    });

    const total = await Community.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        communities: communitiesWithStatus,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get communities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get single community
// @route   GET /api/communities/:slug
// @access  Public
export const getCommunity = async (req, res) => {
  try {
    const userId = req.user?.id;
    const community = await Community.findOne({ slug: req.params.slug })
      .populate('creator', 'fullName avatar email')
      .populate('moderators', 'fullName avatar')
      .populate('members.user', 'fullName avatar')
      .populate('posts.author', 'fullName avatar')
      .populate('posts.comments.user', 'fullName avatar');

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const communityObj = community.toObject();

    // Add membership status if user is authenticated
    if (userId) {
      communityObj.isMember = community.members.some(
        m => m.user._id.toString() === userId
      );
      communityObj.isModerator = community.moderators.some(
        mod => mod._id.toString() === userId
      );
      communityObj.isCreator = community.creator._id.toString() === userId;
    } else {
      communityObj.isMember = false;
      communityObj.isModerator = false;
      communityObj.isCreator = false;
    }

    res.status(200).json({
      success: true,
      data: { community: communityObj },
    });
  } catch (error) {
    console.error('Get community error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create community
// @route   POST /api/communities
// @access  Private
export const createCommunity = async (req, res) => {
  try {
    const { name, description, category, privacy, rules } = req.body;

    const community = await Community.create({
      name,
      description,
      category,
      privacy: privacy || 'public',
      creator: req.user.id,
      moderators: [req.user.id],
      members: [{ user: req.user.id }],
      coverImage: req.files?.coverImage ? req.files.coverImage[0].path : '',
      avatar: req.files?.avatar ? req.files.avatar[0].path : '',
      rules: rules ? JSON.parse(rules) : [],
    });

    await community.populate('creator', 'fullName avatar');

    res.status(201).json({
      success: true,
      message: 'Community created successfully',
      data: { community },
    });
  } catch (error) {
    console.error('Create community error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update community
// @route   PUT /api/communities/:id
// @access  Private
export const updateCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    // Check if user is creator or moderator
    const isModerator = community.moderators.includes(req.user.id);
    const isCreator = community.creator.toString() === req.user.id;

    if (!isModerator && !isCreator && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this community',
      });
    }

    const { name, description, category, privacy, rules } = req.body;

    community.name = name || community.name;
    community.description = description || community.description;
    community.category = category || community.category;
    community.privacy = privacy || community.privacy;
    community.rules = rules ? JSON.parse(rules) : community.rules;

    if (req.files?.coverImage) {
      community.coverImage = req.files.coverImage[0].path;
    }
    if (req.files?.avatar) {
      community.avatar = req.files.avatar[0].path;
    }

    await community.save();

    res.status(200).json({
      success: true,
      message: 'Community updated successfully',
      data: { community },
    });
  } catch (error) {
    console.error('Update community error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Join community
// @route   POST /api/communities/:id/join
// @access  Private
export const joinCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const isMember = community.members.some(m => m.user.toString() === req.user.id);

    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'Already a member of this community',
      });
    }

    community.members.push({ user: req.user.id });
    await community.save();

    res.status(200).json({
      success: true,
      message: 'Joined community successfully',
      data: { memberCount: community.memberCount },
    });
  } catch (error) {
    console.error('Join community error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Leave community
// @route   POST /api/communities/:id/leave
// @access  Private
export const leaveCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    if (community.creator.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Creator cannot leave the community',
      });
    }

    community.members = community.members.filter(m => m.user.toString() !== req.user.id);
    await community.save();

    res.status(200).json({
      success: true,
      message: 'Left community successfully',
    });
  } catch (error) {
    console.error('Leave community error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create post in community
// @route   POST /api/communities/:id/posts
// @access  Private
export const createPost = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const isMember = community.members.some(m => m.user.toString() === req.user.id);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You must be a member to post',
      });
    }

    const { content } = req.body;

    community.posts.unshift({
      author: req.user.id,
      content,
      image: req.file ? req.file.path : '',
    });

    await community.save();
    await community.populate('posts.author', 'fullName avatar');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: { post: community.posts[0] },
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Like/Unlike post
// @route   POST /api/communities/:communityId/posts/:postId/like
// @access  Private
export const togglePostLike = async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const post = community.posts.id(req.params.postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const likeIndex = post.likes.indexOf(req.user.id);

    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push(req.user.id);
    }

    await community.save();

    res.status(200).json({
      success: true,
      data: { likes: post.likes.length, isLiked: likeIndex === -1 },
    });
  } catch (error) {
    console.error('Toggle post like error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Add comment to post
// @route   POST /api/communities/:communityId/posts/:postId/comments
// @access  Private
export const addPostComment = async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const post = community.posts.id(req.params.postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const { content } = req.body;

    post.comments.push({
      user: req.user.id,
      content,
    });

    await community.save();
    await community.populate('posts.comments.user', 'fullName avatar');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: { comments: post.comments },
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

// @desc    Get my communities
// @route   GET /api/communities/my
// @access  Private
export const getMyCommunities = async (req, res) => {
  try {
    const communities = await Community.find({
      'members.user': req.user.id,
    })
      .populate('creator', 'fullName avatar')
      .sort({ createdAt: -1 });

    // Add status flags for each community
    const communitiesWithStatus = communities.map(community => {
      const communityObj = community.toObject();
      communityObj.isMember = true; // Always true for my communities
      communityObj.isModerator = community.moderators.some(
        mod => mod.toString() === req.user.id
      );
      communityObj.isCreator = community.creator._id.toString() === req.user.id;
      communityObj.canLeave = !communityObj.isCreator; // Creator cannot leave
      return communityObj;
    });

    res.status(200).json({
      success: true,
      data: { communities: communitiesWithStatus },
    });
  } catch (error) {
    console.error('Get my communities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get communities grouped by category
// @route   GET /api/communities/by-category
// @access  Public
export const getCommunitiesByCategory = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { limit = 3 } = req.query; // Limit per category

    const categories = ['Technology', 'Education', 'Tourism', 'Sports', 'Events', 'Business', 'Entertainment', 'Lifestyle', 'Other'];

    const communitiesByCategory = {};

    for (const category of categories) {
      const communities = await Community.find({
        status: 'active',
        category: category
      })
        .populate('creator', 'fullName avatar')
        .sort({ memberCount: -1, createdAt: -1 })
        .limit(parseInt(limit));

      // Add membership status
      const communitiesWithStatus = communities.map(community => {
        const communityObj = community.toObject();
        if (userId) {
          communityObj.isMember = community.members.some(
            m => m.user.toString() === userId
          );
          communityObj.isModerator = community.moderators.some(
            mod => mod.toString() === userId
          );
          communityObj.isCreator = community.creator._id.toString() === userId;
        } else {
          communityObj.isMember = false;
          communityObj.isModerator = false;
          communityObj.isCreator = false;
        }
        return communityObj;
      });

      if (communitiesWithStatus.length > 0) {
        communitiesByCategory[category] = communitiesWithStatus;
      }
    }

    res.status(200).json({
      success: true,
      data: { communitiesByCategory },
    });
  } catch (error) {
    console.error('Get communities by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get community posts with pagination
// @route   GET /api/communities/:id/posts
// @access  Public
export const getCommunityPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const community = await Community.findById(req.params.id)
      .populate('posts.author', 'fullName avatar')
      .populate('posts.comments.user', 'fullName avatar')
      .select('posts');

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const posts = community.posts.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: {
        posts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(community.posts.length / limit),
          total: community.posts.length,
        },
      },
    });
  } catch (error) {
    console.error('Get community posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update post
// @route   PUT /api/communities/:communityId/posts/:postId
// @access  Private
export const updatePost = async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const post = community.posts.id(req.params.postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check if user is the post author
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this post',
      });
    }

    const { content } = req.body;
    post.content = content || post.content;

    if (req.file) {
      post.image = req.file.path;
    }

    await community.save();

    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      data: { post },
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete post
// @route   DELETE /api/communities/:communityId/posts/:postId
// @access  Private
export const deletePost = async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const post = community.posts.id(req.params.postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check if user is the post author, moderator, or creator
    const isModerator = community.moderators.includes(req.user.id);
    const isCreator = community.creator.toString() === req.user.id;
    const isAuthor = post.author.toString() === req.user.id;

    if (!isAuthor && !isModerator && !isCreator && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post',
      });
    }

    post.remove();
    await community.save();

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete comment
// @route   DELETE /api/communities/:communityId/posts/:postId/comments/:commentId
// @access  Private
export const deleteComment = async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const post = community.posts.id(req.params.postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Check if user is the comment author, moderator, or creator
    const isModerator = community.moderators.includes(req.user.id);
    const isCreator = community.creator.toString() === req.user.id;
    const isAuthor = comment.user.toString() === req.user.id;

    if (!isAuthor && !isModerator && !isCreator && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment',
      });
    }

    comment.remove();
    await community.save();

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Add/Remove moderator
// @route   POST /api/communities/:id/moderators
// @access  Private (Creator only)
export const manageModerator = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    // Check if user is the creator
    if (community.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can manage moderators',
      });
    }

    const { userId, action } = req.body; // action: 'add' or 'remove'

    if (action === 'add') {
      if (community.moderators.includes(userId)) {
        return res.status(400).json({
          success: false,
          message: 'User is already a moderator',
        });
      }
      community.moderators.push(userId);
    } else if (action === 'remove') {
      community.moderators = community.moderators.filter(
        mod => mod.toString() !== userId
      );
    }

    await community.save();

    res.status(200).json({
      success: true,
      message: `Moderator ${action === 'add' ? 'added' : 'removed'} successfully`,
      data: { moderators: community.moderators },
    });
  } catch (error) {
    console.error('Manage moderator error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ===== GROUP CHAT FUNCTIONALITY =====

// @desc    Get or create group chat for community
// @route   GET /api/communities/:id/chat
// @access  Private (Members only)
export const getGroupChat = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id).populate('groupChat');

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    // Check if user is a member
    const isMember = community.members.some(m => m.user.toString() === req.user.id);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You must be a member to access the chat',
      });
    }

    let groupChat = community.groupChat;

    // Create group chat if it doesn't exist
    if (!groupChat) {
      groupChat = await GroupChat.create({
        community: community._id,
      });
      community.groupChat = groupChat._id;
      await community.save();
    }

    // Get chat with populated messages
    groupChat = await GroupChat.findById(groupChat._id)
      .populate('messages.sender', 'fullName avatar')
      .populate('messages.readBy.user', 'fullName');

    res.status(200).json({
      success: true,
      data: { groupChat },
    });
  } catch (error) {
    console.error('Get group chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Send message in group chat
// @route   POST /api/communities/:id/chat/messages
// @access  Private (Members only)
export const sendMessage = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    // Check if user is a member
    const isMember = community.members.some(m => m.user.toString() === req.user.id);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You must be a member to send messages',
      });
    }

    if (!community.isChatEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Chat is disabled for this community',
      });
    }

    let groupChat = await GroupChat.findById(community.groupChat);

    // Create group chat if it doesn't exist
    if (!groupChat) {
      groupChat = await GroupChat.create({
        community: community._id,
      });
      community.groupChat = groupChat._id;
      await community.save();
    }

    const { content, messageType = 'text', replyTo } = req.body;

    const message = {
      sender: req.user.id,
      content,
      messageType,
      replyTo: replyTo || null,
    };

    if (req.file) {
      message.attachment = {
        url: req.file.path,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      };
      message.messageType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';
    }

    groupChat.messages.push(message);
    await groupChat.save();
    await groupChat.populate('messages.sender', 'fullName avatar');

    const sentMessage = groupChat.messages[groupChat.messages.length - 1];

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message: sentMessage },
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get chat messages with pagination
// @route   GET /api/communities/:id/chat/messages
// @access  Private (Members only)
export const getChatMessages = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    // Check if user is a member
    const isMember = community.members.some(m => m.user.toString() === req.user.id);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You must be a member to access messages',
      });
    }

    const groupChat = await GroupChat.findById(community.groupChat)
      .populate('messages.sender', 'fullName avatar')
      .populate('messages.readBy.user', 'fullName');

    if (!groupChat) {
      return res.status(200).json({
        success: true,
        data: { messages: [], pagination: { total: 0 } },
      });
    }

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const messages = groupChat.messages
      .filter(m => !m.isDeleted)
      .reverse()
      .slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: {
        messages,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(groupChat.messageCount / limit),
          total: groupChat.messageCount,
        },
      },
    });
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Edit message
// @route   PUT /api/communities/:id/chat/messages/:messageId
// @access  Private
export const editMessage = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const groupChat = await GroupChat.findById(community.groupChat);

    if (!groupChat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    const message = groupChat.messages.id(req.params.messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Check if user is the message sender
    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this message',
      });
    }

    const { content } = req.body;
    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();

    await groupChat.save();

    res.status(200).json({
      success: true,
      message: 'Message updated successfully',
      data: { message },
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete message
// @route   DELETE /api/communities/:id/chat/messages/:messageId
// @access  Private
export const deleteMessage = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const groupChat = await GroupChat.findById(community.groupChat);

    if (!groupChat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    const message = groupChat.messages.id(req.params.messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Check if user is the message sender, moderator, or creator
    const isModerator = community.moderators.includes(req.user.id);
    const isCreator = community.creator.toString() === req.user.id;
    const isSender = message.sender.toString() === req.user.id;

    if (!isSender && !isModerator && !isCreator && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message',
      });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content = 'This message has been deleted';

    await groupChat.save();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Add reaction to message
// @route   POST /api/communities/:id/chat/messages/:messageId/reactions
// @access  Private
export const addReaction = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const groupChat = await GroupChat.findById(community.groupChat);

    if (!groupChat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    const message = groupChat.messages.id(req.params.messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    const { emoji } = req.body;

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      r => r.user.toString() === req.user.id && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove reaction
      message.reactions = message.reactions.filter(
        r => !(r.user.toString() === req.user.id && r.emoji === emoji)
      );
    } else {
      // Add reaction
      message.reactions.push({
        user: req.user.id,
        emoji,
      });
    }

    await groupChat.save();

    res.status(200).json({
      success: true,
      data: { reactions: message.reactions },
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Mark messages as read
// @route   POST /api/communities/:id/chat/read
// @access  Private
export const markMessagesAsRead = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const groupChat = await GroupChat.findById(community.groupChat);

    if (!groupChat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    const { messageIds } = req.body;

    messageIds.forEach(messageId => {
      const message = groupChat.messages.id(messageId);
      if (message) {
        const alreadyRead = message.readBy.some(
          r => r.user.toString() === req.user.id
        );
        if (!alreadyRead) {
          message.readBy.push({
            user: req.user.id,
          });
        }
      }
    });

    await groupChat.save();

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
