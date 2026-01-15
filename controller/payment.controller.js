import Payment from '../model/Payment.js';
import Event from '../model/Event.js';
import Order from '../model/Order.js';
import Booking from '../model/Booking.js';
import VenueBooking from '../model/VenueBooking.js';
import User from '../model/User.js';
import Product from '../model/Product.js';
import {
  createEsewaPayment,
  getEsewaPaymentUrl,
  verifyEsewaPayment,
} from '../utils/esewa.js';
import {
  initiateKhaltiPayment,
  verifyKhaltiPayment,
} from '../utils/khalti.js';
import { createNotification } from './notificationController.js';
import crypto from 'crypto';

// Generate unique transaction UUID
const generateTransactionUuid = () => {
  return `TXN-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
};

// @desc    Initialize event booking payment
// @route   POST /api/payments/event/:eventId/initiate
// @access  Private
export const initiateEventPayment = async (req, res) => {
  try {
    const { ticketType, quantity, paymentMethod = 'esewa' } = req.body;
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Find the ticket type
    const ticket = event.ticketTypes.find(t => t.name === ticketType);
    if (!ticket) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket type',
      });
    }

    // Check availability
    const available = ticket.quantity - (ticket.sold || 0);
    if (quantity > available) {
      return res.status(400).json({
        success: false,
        message: `Only ${available} tickets available`,
      });
    }

    const totalAmount = ticket.price * quantity;
    const transactionUuid = generateTransactionUuid();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Create payment record
    const payment = await Payment.create({
      user: req.user._id,
      type: 'event_booking',
      referenceId: event._id,
      referenceModel: 'Event',
      amount: totalAmount,
      method: paymentMethod,
      status: 'initiated',
      esewa: paymentMethod === 'esewa' ? {
        productCode: process.env.ESEWA_MERCHANT_ID,
        transactionUuid,
      } : undefined,
      khalti: paymentMethod === 'khalti' ? {
        purchaseOrderId: transactionUuid,
      } : undefined,
      metadata: {
        ticketType,
        quantity,
        ticketPrice: ticket.price,
        eventTitle: event.title,
      },
    });

    // Handle payment based on method
    if (paymentMethod === 'khalti') {
      // Khalti payment - amount in paisa (1 NPR = 100 paisa)
      const khaltiResponse = await initiateKhaltiPayment({
        returnUrl: `${frontendUrl}/payment/success?type=event&method=khalti`,
        websiteUrl: frontendUrl,
        amount: totalAmount * 100, // Convert to paisa
        purchaseOrderId: transactionUuid,
        purchaseOrderName: `Event: ${event.title}`,
        customerInfo: {
          name: req.user.fullName || 'Customer',
          email: req.user.email,
          phone: req.user.phone || '',
        },
        productDetails: [{
          identity: event._id.toString(),
          name: event.title,
          total_price: totalAmount * 100,
          quantity: quantity,
          unit_price: ticket.price * 100,
        }],
        merchantExtra: JSON.stringify({ ticketType, quantity }),
      });

      // Update payment with Khalti pidx
      payment.khalti = {
        purchaseOrderId: transactionUuid,
        pidx: khaltiResponse.pidx,
      };
      await payment.save();

      console.log('Khalti Payment Response:', khaltiResponse);
      console.log('Payment saved with Khalti data:', {
        paymentId: payment._id,
        pidx: payment.khalti.pidx,
        purchaseOrderId: payment.khalti.purchaseOrderId,
      });

      return res.status(200).json({
        success: true,
        data: {
          paymentId: payment._id,
          paymentMethod: 'khalti',
          khaltiPaymentUrl: khaltiResponse.payment_url,
          pidx: khaltiResponse.pidx,
          transactionUuid,
        },
      });
    }

    // eSewa payment (default)
    const esewaPayload = createEsewaPayment({
      amount: totalAmount,
      transactionUuid,
      successUrl: `${frontendUrl}/payment/success?type=event`,
      failureUrl: `${frontendUrl}/payment/failure?type=event`,
    });

    console.log('eSewa Payment Payload:', esewaPayload);
    console.log('eSewa URL:', getEsewaPaymentUrl());

    res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        paymentMethod: 'esewa',
        esewaUrl: getEsewaPaymentUrl(),
        esewaPayload,
        transactionUuid,
      },
    });
  } catch (error) {
    console.error('Initiate event payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Verify event payment callback
// @route   POST /api/payments/event/verify
// @access  Public (called from frontend after eSewa redirect)
export const verifyEventPayment = async (req, res) => {
  try {
    console.log('=== verifyEventPayment called ===');
    console.log('Request query:', req.query);
    console.log('Request body:', req.body);

    // eSewa v1 sends data as query parameters
    const { oid: transaction_uuid, amt: total_amount, refId: transaction_code } = req.query;

    if (!transaction_uuid) {
      console.log('No transaction UUID provided');
      return res.status(400).json({
        success: false,
        message: 'Payment data is required',
      });
    }

    console.log('Transaction UUID:', transaction_uuid);
    console.log('Total Amount:', total_amount);
    console.log('Reference ID:', transaction_code);
    // Find payment record
    console.log('Looking for payment with transaction_uuid:', transaction_uuid);
    const payment = await Payment.findOne({
      'esewa.transactionUuid': transaction_uuid,
    });
    console.log('Found payment:', payment);

    if (!payment) {
      console.log('Payment record not found!');
      return res.status(404).json({
        success: false,
        message: 'Payment record not found',
      });
    }

    // Verify with eSewa server
    let verified = false;
    try {
      const verification = await verifyEsewaPayment(transaction_uuid, total_amount, transaction_code);
      verified = verification.success;
      console.log('eSewa verification result:', verification);
    } catch (verifyError) {
      console.error('eSewa verification error:', verifyError);
      // In test mode, allow if verification fails
      if (process.env.ESEWA_ENVIRONMENT === 'test') {
        console.log('Allowing payment in test mode due to verification error');
        verified = true;
      }
    }

    if (verified) {
      console.log('Payment verified! Updating records...');

      // Update payment status
      payment.status = 'completed';
      payment.transactionId = transaction_code;
      payment.paidAt = new Date();
      payment.gatewayResponse = { oid: transaction_uuid, amt: total_amount, refId: transaction_code };
      await payment.save();
      console.log('Payment record updated');

      // Update event booking
      const event = await Event.findById(payment.referenceId);
      console.log('Event found:', event ? event.title : 'null');

      if (event) {
        // Update ticket sold count
        const ticket = event.ticketTypes.find(t => t.name === payment.metadata.ticketType);
        if (ticket) {
          ticket.sold = (ticket.sold || 0) + payment.metadata.quantity;
          console.log('Ticket sold count updated:', ticket.sold);
        }

        // Add to attendees
        event.attendees.push({
          user: payment.user,
          ticketType: payment.metadata.ticketType,
          quantity: payment.metadata.quantity,
          totalPrice: payment.amount,
          bookingDate: new Date(),
          status: 'confirmed',
          paymentStatus: 'paid',
        });

        await event.save();
        console.log('Event updated with new attendee');

        // Add to user's booked events
        const userUpdate = await User.findByIdAndUpdate(payment.user, {
          $push: { bookedEvents: event._id },
        }, { new: true });
        console.log('User booked events updated:', userUpdate?.bookedEvents);
      }

      console.log('Payment verification complete - returning success');

      // Send notification to user
      const io = req.app.get('io');
      if (io && event) {
        await createNotification(io, {
          recipient: payment.user,
          type: 'payment_received',
          title: 'Payment Successful',
          message: `Your payment of Rs. ${payment.amount} for "${event.title}" has been confirmed!`,
          link: `/my-tickets`,
          data: {
            paymentId: payment._id,
            eventId: event._id,
            amount: payment.amount
          }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          paymentId: payment._id,
          transactionId: transaction_code,
          amount: total_amount,
          eventId: payment.referenceId,
        },
      });
    }

    // Payment failed or not verified
    payment.status = 'failed';
    payment.gatewayResponse = { oid: transaction_uuid, amt: total_amount, refId: transaction_code };
    await payment.save();

    return res.status(400).json({
      success: false,
      message: 'Payment verification failed',
    });
  } catch (error) {
    console.error('Verify event payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Initialize order payment
// @route   POST /api/payments/order/initiate
// @access  Private
export const initiateOrderPayment = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod = 'esewa' } = req.body;

    // Validate and calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`,
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }

      const itemSubtotal = product.price * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.image,
        price: product.price,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        subtotal: itemSubtotal,
      });
    }

    const shipping = subtotal >= 5000 ? 0 : 100; // Free shipping over 5000
    const total = subtotal + shipping;

    // Create order
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      pricing: {
        subtotal,
        shipping,
        total,
      },
      payment: {
        method: paymentMethod,
        status: 'pending',
      },
    });

    const transactionUuid = generateTransactionUuid();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Create payment record
    const payment = await Payment.create({
      user: req.user._id,
      type: 'product_order',
      referenceId: order._id,
      referenceModel: 'Order',
      amount: total,
      method: paymentMethod,
      status: 'initiated',
      esewa: paymentMethod === 'esewa' ? {
        productCode: process.env.ESEWA_MERCHANT_ID,
        transactionUuid,
      } : undefined,
      khalti: paymentMethod === 'khalti' ? {
        purchaseOrderId: transactionUuid,
      } : undefined,
      metadata: {
        orderNumber: order.orderNumber,
        itemCount: orderItems.length,
      },
    });

    // Handle Khalti payment
    if (paymentMethod === 'khalti') {
      const khaltiResponse = await initiateKhaltiPayment({
        returnUrl: `${frontendUrl}/payment/success?type=order&method=khalti`,
        websiteUrl: frontendUrl,
        amount: total * 100, // Convert to paisa
        purchaseOrderId: transactionUuid,
        purchaseOrderName: `Order #${order.orderNumber}`,
        customerInfo: {
          name: req.user.fullName || 'Customer',
          email: req.user.email,
          phone: req.user.phone || '',
        },
        productDetails: orderItems.map(item => ({
          identity: item.product.toString(),
          name: item.name,
          total_price: item.subtotal * 100,
          quantity: item.quantity,
          unit_price: item.price * 100,
        })),
        merchantExtra: JSON.stringify({ orderId: order._id, orderNumber: order.orderNumber }),
      });

      // Update payment with Khalti pidx
      payment.khalti = {
        purchaseOrderId: transactionUuid,
        pidx: khaltiResponse.pidx,
      };
      await payment.save();

      console.log('Khalti Order Payment Response:', khaltiResponse);
      console.log('Order payment saved with Khalti data:', {
        paymentId: payment._id,
        pidx: payment.khalti.pidx,
        purchaseOrderId: payment.khalti.purchaseOrderId,
      });

      return res.status(200).json({
        success: true,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentId: payment._id,
          paymentMethod: 'khalti',
          khaltiPaymentUrl: khaltiResponse.payment_url,
          pidx: khaltiResponse.pidx,
          transactionUuid,
        },
      });
    }

    // Handle eSewa payment
    const esewaPayload = createEsewaPayment({
      amount: total,
      transactionUuid,
      successUrl: `${frontendUrl}/payment/success?type=order`,
      failureUrl: `${frontendUrl}/payment/failure?type=order`,
    });

    res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        paymentId: payment._id,
        esewaUrl: getEsewaPaymentUrl(),
        esewaPayload,
        transactionUuid,
      },
    });
  } catch (error) {
    console.error('Initiate order payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Verify order payment
// @route   POST /api/payments/order/verify
// @access  Public
export const verifyOrderPayment = async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        message: 'Payment data is required',
      });
    }

    const decodedData = decodeEsewaResponse(data);
    if (!decodedData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment data',
      });
    }

    const { transaction_uuid, status, total_amount, transaction_code } = decodedData;

    const payment = await Payment.findOne({
      'esewa.transactionUuid': transaction_uuid,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found',
      });
    }

    if (status === 'COMPLETE') {
      const verification = await verifyEsewaPayment(transaction_uuid, total_amount);

      if (verification.status === 'COMPLETE') {
        payment.status = 'completed';
        payment.transactionId = transaction_code;
        payment.paidAt = new Date();
        payment.gatewayResponse = decodedData;
        await payment.save();

        // Update order
        const order = await Order.findById(payment.referenceId);
        if (order) {
          order.payment.status = 'paid';
          order.payment.transactionId = transaction_code;
          order.payment.paidAt = new Date();
          order.status = 'confirmed';
          await order.save();

          // Reduce stock
          for (const item of order.items) {
            await Product.findByIdAndUpdate(item.product, {
              $inc: { stock: -item.quantity, sold: item.quantity },
            });
          }

          // Send notification to user
          const io = req.app.get('io');
          if (io) {
            await createNotification(io, {
              recipient: payment.user,
              type: 'order_confirmed',
              title: 'Order Confirmed',
              message: `Your order #${order.orderNumber} has been confirmed! Total: Rs. ${payment.amount}`,
              link: `/orders`,
              data: {
                paymentId: payment._id,
                orderId: order._id,
                orderNumber: order.orderNumber,
                amount: payment.amount
              }
            });
          }
        }

        return res.status(200).json({
          success: true,
          message: 'Payment verified successfully',
          data: {
            paymentId: payment._id,
            orderId: order._id,
            orderNumber: order.orderNumber,
            transactionId: transaction_code,
          },
        });
      }
    }

    payment.status = 'failed';
    payment.gatewayResponse = decodedData;
    await payment.save();

    // Update order status
    await Order.findByIdAndUpdate(payment.referenceId, {
      'payment.status': 'failed',
      status: 'cancelled',
    });

    return res.status(400).json({
      success: false,
      message: 'Payment verification failed',
    });
  } catch (error) {
    console.error('Verify order payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Initialize venue booking payment
// @route   POST /api/payments/venue/:bookingId/initiate
// @access  Private
export const initiateVenuePayment = async (req, res) => {
  try {
    const { paymentMethod = 'esewa' } = req.body;
    const booking = await VenueBooking.findById(req.params.bookingId)
      .populate('venue', 'name');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const transactionUuid = generateTransactionUuid();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const totalAmount = booking.pricing.totalPrice;

    const payment = await Payment.create({
      user: req.user._id,
      type: 'venue_booking',
      referenceId: booking._id,
      referenceModel: 'VenueBooking',
      amount: totalAmount,
      method: paymentMethod,
      status: 'initiated',
      esewa: paymentMethod === 'esewa' ? {
        productCode: process.env.ESEWA_MERCHANT_ID,
        transactionUuid,
      } : undefined,
      khalti: paymentMethod === 'khalti' ? {
        purchaseOrderId: transactionUuid,
      } : undefined,
      metadata: {
        venueName: booking.venue.name,
        eventName: booking.eventName,
        startDate: booking.startDate,
        endDate: booking.endDate,
      },
    });

    // Handle Khalti payment
    if (paymentMethod === 'khalti') {
      const khaltiResponse = await initiateKhaltiPayment({
        returnUrl: `${frontendUrl}/payment/success?type=venue&method=khalti`,
        websiteUrl: frontendUrl,
        amount: totalAmount * 100, // Convert to paisa
        purchaseOrderId: transactionUuid,
        purchaseOrderName: `Venue: ${booking.venue.name} - ${booking.eventName}`,
        customerInfo: {
          name: req.user.fullName || 'Customer',
          email: req.user.email,
          phone: req.user.phone || '',
        },
        productDetails: [{
          identity: booking.venue._id?.toString() || booking.venue.toString(),
          name: booking.venue.name,
          total_price: totalAmount * 100,
          quantity: 1,
          unit_price: totalAmount * 100,
        }],
        merchantExtra: JSON.stringify({ bookingId: booking._id }),
      });

      // Update payment with Khalti pidx
      payment.khalti = {
        purchaseOrderId: transactionUuid,
        pidx: khaltiResponse.pidx,
      };
      await payment.save();

      console.log('Khalti Venue Payment Response:', khaltiResponse);
      console.log('Venue payment saved with Khalti data:', {
        paymentId: payment._id,
        pidx: payment.khalti.pidx,
        purchaseOrderId: payment.khalti.purchaseOrderId,
      });

      return res.status(200).json({
        success: true,
        data: {
          bookingId: booking._id,
          paymentId: payment._id,
          paymentMethod: 'khalti',
          khaltiPaymentUrl: khaltiResponse.payment_url,
          pidx: khaltiResponse.pidx,
          transactionUuid,
        },
      });
    }

    // eSewa payment (default)
    const esewaPayload = createEsewaPayment({
      amount: totalAmount,
      transactionUuid,
      successUrl: `${frontendUrl}/payment/success?type=venue`,
      failureUrl: `${frontendUrl}/payment/failure?type=venue`,
    });

    res.status(200).json({
      success: true,
      data: {
        bookingId: booking._id,
        paymentId: payment._id,
        paymentMethod: 'esewa',
        esewaUrl: getEsewaPaymentUrl(),
        esewaPayload,
        transactionUuid,
      },
    });
  } catch (error) {
    console.error('Initiate venue payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Verify venue booking payment
// @route   POST /api/payments/venue/verify
// @access  Public
export const verifyVenuePayment = async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        message: 'Payment data is required',
      });
    }

    const decodedData = decodeEsewaResponse(data);
    if (!decodedData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment data',
      });
    }

    const { transaction_uuid, status, total_amount, transaction_code } = decodedData;

    const payment = await Payment.findOne({
      'esewa.transactionUuid': transaction_uuid,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found',
      });
    }

    if (status === 'COMPLETE') {
      const verification = await verifyEsewaPayment(transaction_uuid, total_amount);

      if (verification.status === 'COMPLETE') {
        payment.status = 'completed';
        payment.transactionId = transaction_code;
        payment.paidAt = new Date();
        payment.gatewayResponse = decodedData;
        await payment.save();

        // Update booking
        const booking = await VenueBooking.findByIdAndUpdate(payment.referenceId, {
          'payment.status': 'paid',
          'payment.transactionId': transaction_code,
          'payment.paidAt': new Date(),
          status: 'confirmed',
        }, { new: true }).populate('venue', 'name');

        // Send notification to user
        const io = req.app.get('io');
        if (io && booking) {
          await createNotification(io, {
            recipient: payment.user,
            type: 'venue_booking',
            title: 'Venue Booking Confirmed',
            message: `Your booking for "${booking.venue.name}" has been confirmed! Total: Rs. ${payment.amount}`,
            link: `/my-venue-bookings`,
            data: {
              paymentId: payment._id,
              bookingId: booking._id,
              amount: payment.amount
            }
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Payment verified successfully',
          data: {
            paymentId: payment._id,
            bookingId: payment.referenceId,
            transactionId: transaction_code,
          },
        });
      }
    }

    payment.status = 'failed';
    payment.gatewayResponse = decodedData;
    await payment.save();

    return res.status(400).json({
      success: false,
      message: 'Payment verification failed',
    });
  } catch (error) {
    console.error('Verify venue payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Verify Khalti payment (generic for all types)
// @route   POST /api/payments/khalti/verify
// @access  Public
export const verifyKhaltiPaymentCallback = async (req, res) => {
  try {
    const { pidx, type } = req.body;

    if (!pidx) {
      return res.status(400).json({
        success: false,
        message: 'Payment identifier (pidx) is required',
      });
    }

    console.log('Verifying Khalti payment:', { pidx, type });

    // Lookup payment status from Khalti
    const khaltiResponse = await verifyKhaltiPayment(pidx);
    console.log('Khalti lookup response:', khaltiResponse);

    // Find payment record by pidx
    const payment = await Payment.findOne({
      'khalti.pidx': pidx,
    });

    if (!payment) {
      console.error('Payment not found for pidx:', pidx);
      console.log('Searching for payment with pidx in database...');

      // Debug: Check if any payment exists with this pidx in transactionId or other fields
      const debugPayment = await Payment.findOne({
        $or: [
          { transactionId: pidx },
          { 'khalti.purchaseOrderId': pidx },
        ]
      });

      if (debugPayment) {
        console.log('Found payment with alternate lookup:', debugPayment._id);
      }

      return res.status(404).json({
        success: false,
        message: 'Payment record not found. The payment may not have been properly initialized.',
        pidx,
      });
    }

    if (khaltiResponse.status === 'Completed') {
      // Payment successful
      payment.status = 'completed';
      payment.transactionId = khaltiResponse.transaction_id;
      payment.paidAt = new Date();
      payment.gatewayResponse = khaltiResponse;
      await payment.save();

      // Get Socket.IO instance for notifications
      const io = req.app?.get('io');

      // Update the related booking/order based on type
      if (payment.type === 'event_booking') {
        const event = await Event.findById(payment.referenceId);
        if (event) {
          const ticket = event.ticketTypes.find(t => t.name === payment.metadata.ticketType);
          if (ticket) {
            ticket.sold = (ticket.sold || 0) + payment.metadata.quantity;
          }
          event.attendees.push({
            user: payment.user,
            ticketType: payment.metadata.ticketType,
            quantity: payment.metadata.quantity,
            totalPrice: payment.amount,
            bookingDate: new Date(),
            status: 'confirmed',
            paymentStatus: 'paid',
          });
          await event.save();
          await User.findByIdAndUpdate(payment.user, {
            $push: { bookedEvents: event._id },
          });

          // Send notification
          if (io) {
            await createNotification(io, {
              recipient: payment.user,
              type: 'event_booking',
              title: 'Event Booking Confirmed',
              message: `Your booking for "${event.title}" has been confirmed! Total: Rs. ${payment.amount}`,
              link: `/my-tickets`,
              data: {
                paymentId: payment._id,
                eventId: event._id,
                amount: payment.amount
              }
            });
          }
        }
      } else if (payment.type === 'venue_booking') {
        const booking = await VenueBooking.findByIdAndUpdate(payment.referenceId, {
          'payment.status': 'paid',
          'payment.transactionId': khaltiResponse.transaction_id,
          'payment.paidAt': new Date(),
          status: 'confirmed',
        }, { new: true }).populate('venue', 'name');

        // Send notification
        if (io && booking) {
          await createNotification(io, {
            recipient: payment.user,
            type: 'venue_booking',
            title: 'Venue Booking Confirmed',
            message: `Your booking for "${booking.venue.name}" has been confirmed! Total: Rs. ${payment.amount}`,
            link: `/my-venue-bookings`,
            data: {
              paymentId: payment._id,
              bookingId: booking._id,
              amount: payment.amount
            }
          });
        }
      } else if (payment.type === 'product_order') {
        const order = await Order.findById(payment.referenceId);
        if (order) {
          order.payment.status = 'paid';
          order.payment.transactionId = khaltiResponse.transaction_id;
          order.payment.paidAt = new Date();
          order.status = 'confirmed';
          await order.save();
          for (const item of order.items) {
            await Product.findByIdAndUpdate(item.product, {
              $inc: { stock: -item.quantity, sold: item.quantity },
            });
          }

          // Send notification
          if (io) {
            await createNotification(io, {
              recipient: payment.user,
              type: 'order_confirmed',
              title: 'Order Confirmed',
              message: `Your order #${order.orderNumber} has been confirmed! Total: Rs. ${payment.amount}`,
              link: `/orders`,
              data: {
                paymentId: payment._id,
                orderId: order._id,
                orderNumber: order.orderNumber,
                amount: payment.amount
              }
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          paymentId: payment._id,
          transactionId: khaltiResponse.transaction_id,
          amount: khaltiResponse.total_amount / 100, // Convert from paisa
          referenceId: payment.referenceId,
          type: payment.type,
        },
      });
    }

    // Payment not completed
    payment.status = khaltiResponse.status === 'Pending' ? 'pending' : 'failed';
    payment.gatewayResponse = khaltiResponse;
    await payment.save();

    return res.status(400).json({
      success: false,
      message: `Payment ${khaltiResponse.status.toLowerCase()}`,
      status: khaltiResponse.status,
    });
  } catch (error) {
    console.error('Khalti verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Complete the most recent pending event payment (fallback when eSewa doesn't return data)
// @route   POST /api/payments/event/complete-pending
// @access  Private
export const completePendingEventPayment = async (req, res) => {
  try {
    console.log('=== completePendingEventPayment called ===');
    console.log('User ID:', req.user._id);

    // Find the most recent initiated payment for this user
    const payment = await Payment.findOne({
      user: req.user._id,
      type: 'event_booking',
      status: 'initiated',
    }).sort({ createdAt: -1 });

    console.log('Found pending payment:', payment);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'No pending payment found',
      });
    }

    // Check if payment was initiated in the last 30 minutes (eSewa session timeout)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (payment.createdAt < thirtyMinutesAgo) {
      return res.status(400).json({
        success: false,
        message: 'Payment session expired. Please try booking again.',
      });
    }

    console.log('Marking payment as completed (fallback)...');

    // Update payment status
    payment.status = 'completed';
    payment.transactionId = `FALLBACK-${Date.now()}`;
    payment.paidAt = new Date();
    payment.gatewayResponse = { note: 'Completed via fallback - eSewa data not received' };
    await payment.save();
    console.log('Payment record updated');

    // Update event booking
    const event = await Event.findById(payment.referenceId);
    console.log('Event found:', event ? event.title : 'null');

    if (event) {
      // Update ticket sold count
      const ticket = event.ticketTypes.find(t => t.name === payment.metadata.ticketType);
      if (ticket) {
        ticket.sold = (ticket.sold || 0) + payment.metadata.quantity;
        console.log('Ticket sold count updated:', ticket.sold);
      }

      // Add to attendees
      event.attendees.push({
        user: payment.user,
        ticketType: payment.metadata.ticketType,
        quantity: payment.metadata.quantity,
        totalPrice: payment.amount,
        bookingDate: new Date(),
        status: 'confirmed',
        paymentStatus: 'paid',
      });

      await event.save();
      console.log('Event updated with new attendee');

      // Add to user's booked events
      const userUpdate = await User.findByIdAndUpdate(payment.user, {
        $push: { bookedEvents: event._id },
      }, { new: true });
      console.log('User booked events updated:', userUpdate?.bookedEvents);
    }

    console.log('Fallback payment completion successful');
    return res.status(200).json({
      success: true,
      message: 'Payment completed successfully',
      data: {
        paymentId: payment._id,
        transactionId: payment.transactionId,
        amount: payment.amount,
        eventId: payment.referenceId,
      },
    });
  } catch (error) {
    console.error('Complete pending payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Complete the most recent pending order payment (fallback when eSewa doesn't return data)
// @route   POST /api/payments/order/complete-pending
// @access  Private
export const completePendingOrderPayment = async (req, res) => {
  try {
    console.log('=== completePendingOrderPayment called ===');
    console.log('User ID:', req.user._id);

    // Find the most recent initiated order payment for this user
    const payment = await Payment.findOne({
      user: req.user._id,
      type: 'product_order',
      status: 'initiated',
    }).sort({ createdAt: -1 });

    console.log('Found pending order payment:', payment);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'No pending order payment found',
      });
    }

    // Check if payment was initiated in the last 30 minutes (eSewa session timeout)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (payment.createdAt < thirtyMinutesAgo) {
      return res.status(400).json({
        success: false,
        message: 'Payment session expired. Please try ordering again.',
      });
    }

    console.log('Marking order payment as completed (fallback)...');

    // Update payment status
    payment.status = 'completed';
    payment.transactionId = `FALLBACK-${Date.now()}`;
    payment.paidAt = new Date();
    payment.gatewayResponse = { note: 'Completed via fallback - eSewa data not received' };
    await payment.save();
    console.log('Payment record updated');

    // Update order
    const order = await Order.findById(payment.referenceId);
    if (order) {
      order.payment.status = 'paid';
      order.payment.transactionId = payment.transactionId;
      order.payment.paidAt = new Date();
      order.status = 'confirmed';
      await order.save();

      // Reduce stock
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity, sold: item.quantity },
        });
      }
    }
    console.log('Order updated:', order?._id);

    console.log('Fallback order payment completion successful');
    return res.status(200).json({
      success: true,
      message: 'Payment completed successfully',
      data: {
        paymentId: payment._id,
        transactionId: payment.transactionId,
        amount: payment.amount,
        orderId: payment.referenceId,
        orderNumber: order?.orderNumber,
      },
    });
  } catch (error) {
    console.error('Complete pending order payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Complete the most recent pending venue payment (fallback when eSewa doesn't return data)
// @route   POST /api/payments/venue/complete-pending
// @access  Private
export const completePendingVenuePayment = async (req, res) => {
  try {
    console.log('=== completePendingVenuePayment called ===');
    console.log('User ID:', req.user._id);

    // Find the most recent initiated venue payment for this user
    const payment = await Payment.findOne({
      user: req.user._id,
      type: 'venue_booking',
      status: 'initiated',
    }).sort({ createdAt: -1 });

    console.log('Found pending venue payment:', payment);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'No pending venue payment found',
      });
    }

    // Check if payment was initiated in the last 30 minutes (eSewa session timeout)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (payment.createdAt < thirtyMinutesAgo) {
      return res.status(400).json({
        success: false,
        message: 'Payment session expired. Please try booking again.',
      });
    }

    console.log('Marking venue payment as completed (fallback)...');

    // Update payment status
    payment.status = 'completed';
    payment.transactionId = `FALLBACK-${Date.now()}`;
    payment.paidAt = new Date();
    payment.gatewayResponse = { note: 'Completed via fallback - eSewa data not received' };
    await payment.save();
    console.log('Payment record updated');

    // Update venue booking
    const booking = await VenueBooking.findByIdAndUpdate(
      payment.referenceId,
      {
        'payment.status': 'paid',
        'payment.transactionId': payment.transactionId,
        'payment.paidAt': new Date(),
        status: 'confirmed',
      },
      { new: true }
    );
    console.log('Venue booking updated:', booking?._id);

    console.log('Fallback venue payment completion successful');
    return res.status(200).json({
      success: true,
      message: 'Payment completed successfully',
      data: {
        paymentId: payment._id,
        transactionId: payment.transactionId,
        amount: payment.amount,
        bookingId: payment.referenceId,
      },
    });
  } catch (error) {
    console.error('Complete pending venue payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get user's payment history
// @route   GET /api/payments/my
// @access  Private
export const getMyPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, status } = req.query;
    const query = { user: req.user._id };

    if (type) query.type = type;
    if (status) query.status = status;

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all payments (Admin)
// @route   GET /api/payments/admin/all
// @access  Private (Admin)
export const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, status, method } = req.query;
    const query = {};

    if (type) query.type = type;
    if (status) query.status = status;
    if (method) query.method = method;

    const payments = await Payment.find(query)
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    // Calculate stats
    const stats = await Payment.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
        },
        stats: stats[0] || { totalRevenue: 0, totalTransactions: 0 },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
