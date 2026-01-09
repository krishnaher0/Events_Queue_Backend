import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
    },
    venue: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Venue'
    },
    type: {
        type: String,
        enum: ['event', 'venue'],
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    tickets: {
        type: Number,
        default: 1
    },
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled'],
        default: 'confirmed'
    },
    paymentId: {
        type: String
    }
}, {
    timestamps: true
});

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;