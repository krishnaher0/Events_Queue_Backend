import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['event_booking', 'product_order', 'venue_booking'],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'referenceModel',
    },
    referenceModel: {
      type: String,
      required: true,
      enum: ['Event', 'Order', 'VenueBooking'],
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'NPR',
    },
    method: {
      type: String,
      enum: ['esewa', 'khalti', 'cod', 'bank_transfer', 'cash'],
      required: true,
    },
    status: {
      type: String,
      enum: ['initiated', 'pending', 'completed', 'failed', 'refunded', 'cancelled'],
      default: 'initiated',
    },
    // eSewa specific fields
    esewa: {
      productCode: String,
      transactionUuid: String,
      signature: String,
      refId: String,
    },
    // Khalti specific fields
    khalti: {
      pidx: String,
      purchaseOrderId: String,
      transactionId: String,
    },
    transactionId: String,
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    paidAt: Date,
    refundedAt: Date,
    refundAmount: Number,
    refundReason: String,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ user: 1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ 'esewa.transactionUuid': 1 });
paymentSchema.index({ 'khalti.pidx': 1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
