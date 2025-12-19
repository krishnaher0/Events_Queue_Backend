import User from '../model/User.js';
import generateToken from '../utils/generateToken.js';
import { sendVerificationCode, sendPasswordResetSuccess } from '../utils/sendEmail.js';

// Generate 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Register new user
// @route   POST /api/auth/signup
// @access  Public
export const signup = async (req, res) => {
  try {
    const { fullName, email, phoneNumber, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      phoneNumber,
      password,
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
        token,
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

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
        token,
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

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('bookedEvents');

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          avatar: user.avatar,
          bookedEvents: user.bookedEvents,
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

// @desc    Forgot password - send verification code
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address',
      });
    }

    // Generate verification code
    const code = generateVerificationCode();

    // Save code and expiry (10 minutes)
    user.resetPasswordCode = code;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    // Send email
    const emailSent = await sendVerificationCode(email, code);

    if (!emailSent) {
      user.resetPasswordCode = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Verify reset code
// @route   POST /api/auth/verify-code
// @access  Public
export const verifyCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    // Find user with reset code fields
    const user = await User.findOne({ email }).select('+resetPasswordCode +resetPasswordExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address',
      });
    }

    // Check if code exists and is not expired
    if (!user.resetPasswordCode || !user.resetPasswordExpires) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new one.',
      });
    }

    if (Date.now() > user.resetPasswordExpires) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.',
      });
    }

    if (user.resetPasswordCode !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Code verified successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { email, code, password } = req.body;

    // Find user with reset code fields
    const user = await User.findOne({ email }).select('+resetPasswordCode +resetPasswordExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address',
      });
    }

    // Verify code again
    if (!user.resetPasswordCode || user.resetPasswordCode !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code',
      });
    }

    if (Date.now() > user.resetPasswordExpires) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.',
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send success email
    await sendPasswordResetSuccess(email, user.fullName);

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get user's booked events (My Tickets)
// @route   GET /api/auth/my-tickets
// @access  Private
export const getMyTickets = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'bookedEvents',
      populate: {
        path: 'organizer',
        select: 'fullName email'
      }
    });

    // Get detailed booking info from each event's attendees
    const tickets = [];
    for (const event of user.bookedEvents || []) {
      const booking = event.attendees?.find(
        a => a.user?.toString() === req.user._id.toString()
      );

      tickets.push({
        _id: booking?._id || event._id,
        event: {
          _id: event._id,
          title: event.title,
          description: event.shortDescription || event.description?.substring(0, 150),
          image: event.image,
          startDate: event.startDate,
          endDate: event.endDate,
          startTime: event.startTime,
          endTime: event.endTime,
          venueName: event.venueName,
          venueType: event.venueType,
          address: event.address,
          category: event.category,
          organizer: event.organizer,
        },
        ticketType: booking?.ticketType || 'Standard',
        quantity: booking?.quantity || 1,
        totalPrice: booking?.totalPrice || 0,
        bookingDate: booking?.bookingDate || event.createdAt,
        status: booking?.status || 'confirmed',
      });
    }

    // Sort by booking date (most recent first)
    tickets.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

    res.status(200).json({
      success: true,
      data: {
        tickets,
        total: tickets.length,
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

// @desc    Resend verification code
// @route   POST /api/auth/resend-code
// @access  Public
export const resendCode = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address',
      });
    }

    // Generate new verification code
    const code = generateVerificationCode();

    // Save code and expiry (10 minutes)
    user.resetPasswordCode = code;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    // Send email
    const emailSent = await sendVerificationCode(email, code);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'New verification code sent to your email',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
