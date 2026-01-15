import OrganizerRequest from '../model/OrganizerRequest.js';
import User from '../model/User.js';
import { createNotification } from './notificationController.js';

// Submit organizer request (for normal users)
export const submitOrganizerRequest = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if user already has a pending request
    const existingRequest = await OrganizerRequest.findOne({
      user: userId,
      status: 'pending',
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending organizer request',
      });
    }

    // Check if user is already an organizer
    const user = await User.findById(userId);
    if (user.role === 'organizer' || user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'You are already an organizer or admin',
      });
    }

    const organizerRequest = await OrganizerRequest.create({
      user: userId,
      ...req.body,
    });

    res.status(201).json({
      success: true,
      message: 'Organizer request submitted successfully',
      data: organizerRequest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get user's organizer request status
export const getMyOrganizerRequest = async (req, res) => {
  try {
    const request = await OrganizerRequest.findOne({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all organizer requests (Admin only)
export const getAllOrganizerRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    const requests = await OrganizerRequest.find(query)
      .populate('user', 'fullName email avatar')
      .populate('reviewedBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await OrganizerRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Approve organizer request (Admin only)
export const approveOrganizerRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { adminNotes } = req.body;

    const request = await OrganizerRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This request has already been processed',
      });
    }

    // Update request status
    request.status = 'approved';
    request.adminNotes = adminNotes;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    // Update user role to organizer
    await User.findByIdAndUpdate(request.user, {
      role: 'organizer',
    });

    // Send notification to user
    const io = req.app.get('io');
    if (io) {
      await createNotification(io, {
        recipient: request.user,
        sender: req.user._id,
        type: 'system',
        title: 'Organizer Request Approved',
        message: 'Congratulations! Your organizer request has been approved. You can now create and manage events.',
        link: '/create-event',
        data: {
          requestId: request._id,
          adminNotes: adminNotes
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Organizer request approved successfully',
      data: request,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Reject organizer request (Admin only)
export const rejectOrganizerRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { adminNotes } = req.body;

    const request = await OrganizerRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This request has already been processed',
      });
    }

    request.status = 'rejected';
    request.adminNotes = adminNotes;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    // Send notification to user
    const io = req.app.get('io');
    if (io) {
      await createNotification(io, {
        recipient: request.user,
        sender: req.user._id,
        type: 'system',
        title: 'Organizer Request Rejected',
        message: `Your organizer request has been rejected. ${adminNotes ? 'Reason: ' + adminNotes : 'Please contact support for more information.'}`,
        link: '/profile',
        data: {
          requestId: request._id,
          adminNotes: adminNotes
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Organizer request rejected',
      data: request,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get pending requests count (Admin only)
export const getPendingRequestsCount = async (req, res) => {
  try {
    const count = await OrganizerRequest.countDocuments({ status: 'pending' });

    res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
