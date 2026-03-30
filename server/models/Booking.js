import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    room_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    student_code: String,
    full_name: String,
    room_number: String,
    start_date: Date,
    end_date: Date,
    status: { type: String, enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'], default: 'PENDING' },
    created_at: { type: Date, default: Date.now }
});

export default mongoose.model('Booking', bookingSchema, 'reservations');