import Refund from '../model/Refund.js';
import Event from '../model/Event.js';
import Payment from '../model/Payment.js';
import { createNotification } from './notificationController.js';

// @desc    Request a refund
// @route   POST /api/refunds/request
// @access  Private
export const requestRefund = async (req, res) => {
  try {
    const { eventId, attendeeEntryId, reason, bankDetails } = req.body;

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if event is more than 24 hours away
    const eventDate = new Date(event.startDate);
    const now = new Date();
    const hoursDiff = (eventDate - now) / (1000 * 60 * 60);

    if (hoursDiff <= 24) {
      return res.status(400).json({
        success: false,
        message: 'Refund requests must be made at least 24 hours before the event'
      });
    }

    // Find the attendee entry
    const attendeeEntry = event.attendees.id(attendeeEntryId);
    if (!attendeeEntry) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Verify the ticket belongs to the user
    if (attendeeEntry.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to request refund for this ticket'
      });
    }

    // Check if ticket is confirmed and paid
    if (attendeeEntry.status !== 'confirmed' || attendeeEntry.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed and paid tickets can be refunded'
      });
    }

    // Check if refund already requested
    const existingRefund = await Refund.findOne({
      user: req.user._id,
      event: eventId,
      attendeeEntry: attendeeEntryId,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingRefund) {
      return res.status(400).json({
        success: false,
        message: 'Refund already requested for this ticket'
      });
    }

    // Find the payment
    const payment = await Payment.findOne({
      user: req.user._id,
      referenceId: eventId,
      type: 'event_booking',
      status: 'completed'
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    // Create refund request
    const refund = await Refund.create({
      user: req.user._id,
      event: eventId,
      payment: payment._id,
      attendeeEntry: attendeeEntryId,
      ticketType: attendeeEntry.ticketType,
      quantity: attendeeEntry.quantity,
      refundAmount: attendeeEntry.totalPrice,
      reason,
      bankDetails,
      status: 'pending'
    });

    // Update attendee status
    attendeeEntry.status = 'refund_requested';
    await event.save();

    // Populate refund data
    const populatedRefund = await Refund.findById(refund._id)
      .populate('user', 'fullName email phone')
      .populate('event', 'title startDate startTime')
      .populate('payment', 'transactionId method');

    // Notify admin about refund request
    const io = req.app.get('io');
    if (io) {
      // Get all admins
      const User = (await import('../model/User.js')).default;
      const admins = await User.find({ role: 'admin' });

      for (const admin of admins) {
        await createNotification(io, {
          recipient: admin._id,
          sender: req.user._id,
          type: 'system',
          title: 'New Refund Request',
          message: `${req.user.fullName} has requested a refund for ${event.title}`,
          link: '/admin/refunds',
          data: {
            refundId: refund._id,
            eventId: eventId,
            amount: attendeeEntry.totalPrice
          }
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Refund request submitted successfully',
      data: populatedRefund
    });
  } catch (error) {
    console.error('Request refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get my refund requests
// @route   GET /api/refunds/my
// @access  Private
export const getMyRefunds = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { user: req.user._id };

    if (status) query.status = status;

    const refunds = await Refund.find(query)
      .populate('event', 'title startDate startTime image')
      .populate('payment', 'transactionId method')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Refund.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        refunds,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get my refunds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all refund requests (Admin)
// @route   GET /api/refunds/admin/all
// @access  Private (Admin)
export const getAllRefunds = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) query.status = status;

    const refunds = await Refund.find(query)
      .populate('user', 'fullName email phone')
      .populate('event', 'title startDate startTime')
      .populate('payment', 'transactionId method amount')
      .populate('reviewedBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Refund.countDocuments(query);

    // Get stats
    const stats = await Refund.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$refundAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        refunds,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total
        },
        stats
      }
    });
  } catch (error) {
    console.error('Get all refunds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Approve refund request (Admin)
// @route   PUT /api/refunds/:id/approve
// @access  Private (Admin)
export const approveRefund = async (req, res) => {
  try {
    const { adminNotes, refundMethod } = req.body;

    const refund = await Refund.findById(req.params.id)
      .populate('event')
      .populate('user', 'fullName email');

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund request not found'
      });
    }

    if (refund.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This refund request has already been processed'
      });
    }

    // Update refund status
    refund.status = 'approved';
    refund.adminNotes = adminNotes;
    refund.refundMethod = refundMethod || 'original_payment_method';
    refund.reviewedBy = req.user._id;
    refund.reviewedAt = new Date();
    await refund.save();

    // Update event attendee status
    const event = await Event.findById(refund.event._id);
    const attendeeEntry = event.attendees.id(refund.attendeeEntry);
    if (attendeeEntry) {
      attendeeEntry.status = 'refunded';
      attendeeEntry.paymentStatus = 'refunded';

      // Return ticket to available pool
      const ticket = event.ticketTypes.find(t => t.name === refund.ticketType);
      if (ticket) {
        ticket.sold = Math.max(0, (ticket.sold || 0) - refund.quantity);
      }

      await event.save();
    }

    // Send notification to user
    const io = req.app.get('io');
    if (io) {
      await createNotification(io, {
        recipient: refund.user._id,
        sender: req.user._id,
        type: 'payment_received',
        title: 'Refund Approved',
        message: `Your refund request for ${refund.event.title} has been approved. Amount: NPR ${refund.refundAmount}`,
        link: '/my-tickets',
        data: {
          refundId: refund._id,
          eventId: refund.event._id,
          amount: refund.refundAmount
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Refund approved successfully',
      data: refund
    });
  } catch (error) {
    console.error('Approve refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Reject refund request (Admin)
// @route   PUT /api/refunds/:id/reject
// @access  Private (Admin)
export const rejectRefund = async (req, res) => {
  try {
    const { adminNotes } = req.body;

    if (!adminNotes) {
      return res.status(400).json({
        success: false,
        message: 'Admin notes are required when rejecting a refund'
      });
    }

    const refund = await Refund.findById(req.params.id)
      .populate('event')
      .populate('user', 'fullName email');

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund request not found'
      });
    }

    if (refund.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This refund request has already been processed'
      });
    }

    // Update refund status
    refund.status = 'rejected';
    refund.adminNotes = adminNotes;
    refund.reviewedBy = req.user._id;
    refund.reviewedAt = new Date();
    await refund.save();

    // Restore attendee status
    const event = await Event.findById(refund.event._id);
    const attendeeEntry = event.attendees.id(refund.attendeeEntry);
    if (attendeeEntry) {
      attendeeEntry.status = 'confirmed';
      await event.save();
    }

    // Send notification to user
    const io = req.app.get('io');
    if (io) {
      await createNotification(io, {
        recipient: refund.user._id,
        sender: req.user._id,
        type: 'system',
        title: 'Refund Request Rejected',
        message: `Your refund request for ${refund.event.title} has been rejected. Reason: ${adminNotes}`,
        link: '/my-tickets',
        data: {
          refundId: refund._id,
          eventId: refund.event._id
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Refund rejected',
      data: refund
    });
  } catch (error) {
    console.error('Reject refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Mark refund as processed (Admin)
// @route   PUT /api/refunds/:id/process
// @access  Private (Admin)
export const processRefund = async (req, res) => {
  try {
    const { transactionId, adminNotes } = req.body;

    const refund = await Refund.findById(req.params.id)
      .populate('event')
      .populate('user', 'fullName email');

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund request not found'
      });
    }

    if (refund.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved refunds can be marked as processed'
      });
    }

    // Update refund status
    refund.status = 'processed';
    refund.transactionId = transactionId;
    if (adminNotes) refund.adminNotes = adminNotes;
    refund.processedAt = new Date();
    await refund.save();

    // Send notification to user
    const io = req.app.get('io');
    if (io) {
      await createNotification(io, {
        recipient: refund.user._id,
        sender: req.user._id,
        type: 'payment_received',
        title: 'Refund Processed',
        message: `Your refund of NPR ${refund.refundAmount} for ${refund.event.title} has been processed.`,
        link: '/my-tickets',
        data: {
          refundId: refund._id,
          eventId: refund.event._id,
          transactionId: transactionId
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Refund marked as processed',
      data: refund
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get refund statistics (Admin)
// @route   GET /api/refunds/admin/stats
// @access  Private (Admin)
export const getRefundStats = async (req, res) => {
  try {
    const stats = {
      pending: await Refund.countDocuments({ status: 'pending' }),
      approved: await Refund.countDocuments({ status: 'approved' }),
      rejected: await Refund.countDocuments({ status: 'rejected' }),
      processed: await Refund.countDocuments({ status: 'processed' }),
      totalRefundAmount: 0,
      processedRefundAmount: 0
    };

    const totalRefund = await Refund.aggregate([
      { $match: { status: { $in: ['approved', 'processed'] } } },
      { $group: { _id: null, total: { $sum: '$refundAmount' } } }
    ]);

    const processedRefund = await Refund.aggregate([
      { $match: { status: 'processed' } },
      { $group: { _id: null, total: { $sum: '$refundAmount' } } }
    ]);

    if (totalRefund.length > 0) stats.totalRefundAmount = totalRefund[0].total;
    if (processedRefund.length > 0) stats.processedRefundAmount = processedRefund[0].total;

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get refund stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
