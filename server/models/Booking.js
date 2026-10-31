import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    room_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    student_code: String,
    full_name: String,
    room_number: String,
    start_date: Date,
    end_date: Date,
    // PENDING = รอชำระเงิน, PAID = ชำระแล้ว รอ admin ตรวจสอบ, CONFIRMED = admin อนุมัติแล้ว,
    // REJECTED = admin ปฏิเสธการชำระเงิน (คืนเงินแล้ว), CANCELLED = ยกเลิก
    status: { type: String, enum: ['PENDING', 'PAID', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'], default: 'PENDING' },
    created_at: { type: Date, default: Date.now },
    // --- ข้อมูลการชำระเงิน (ระบบจำลอง ไม่มีการตัดเงินจริง) ---
    payment: {
        amount: Number,
        room_price: Number,
        deposit: Number,
        method: { type: String, enum: ['PROMPTPAY', 'CARD'] },
        card_last4: String,
        ref: String,
        paid_at: Date,
        refund_ref: String,
        refunded_at: Date
    },
    // --- ผลการตรวจสอบการชำระเงินโดย admin ---
    review: {
        action: { type: String, enum: ['APPROVED', 'REJECTED'] },
        reason: String,
        reviewed_by: String,
        reviewed_at: Date
    }
});

export default mongoose.model('Booking', bookingSchema, 'reservations');