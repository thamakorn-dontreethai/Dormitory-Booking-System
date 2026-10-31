import mongoose from 'mongoose';

// บิลรายเดือน 2 ประเภท
// - RENT    = ค่าห้อง ครบกำหนดตามวันที่จองของแต่ละคน (เดือนแรกชำระไปแล้วตอนจอง)
// - UTILITY = ค่าน้ำ-ค่าไฟ เหมาจ่ายต่อห้อง หารเท่ากันตามจำนวนผู้พัก ครบกำหนดสิ้นเดือน
const invoiceSchema = new mongoose.Schema({
    kind: { type: String, enum: ['RENT', 'UTILITY'], default: 'RENT' },
    booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    student_code: String,
    full_name: String,
    room_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    room_number: String,
    month: { type: String, required: true }, // 'YYYY-MM' ของรอบบิล
    period_start: Date, // ช่วงเวลาที่บิลนี้ครอบคลุม
    period_end: Date,
    items: [{
        type: { type: String, enum: ['RENT', 'WATER', 'ELECTRIC'] },
        label: String,
        room_fee: Number, // ค่าเหมาจ่ายทั้งห้อง (น้ำ/ไฟ)
        share: Number,    // หารกันกี่คน
        amount: Number,
        _id: false
    }],
    amount: { type: Number, required: true }, // ยอดรวมทุกรายการ
    due_date: Date,
    // UNPAID = ค้างชำระ, PAID = ชำระแล้ว รอ admin ตรวจสอบ, CONFIRMED = admin อนุมัติแล้ว
    status: { type: String, enum: ['UNPAID', 'PAID', 'CONFIRMED'], default: 'UNPAID' },
    payment: {
        method: { type: String, enum: ['PROMPTPAY', 'CARD'] },
        card_last4: String,
        ref: String,
        paid_at: Date
    },
    review: {
        action: { type: String, enum: ['APPROVED', 'REJECTED'] },
        reason: String,
        reviewed_by: String,
        reviewed_at: Date
    },
    // ประวัติการชำระที่ถูกปฏิเสธ (คืนเงินแล้ว)
    rejections: [{
        reason: String,
        payment_ref: String,
        refund_ref: String,
        reviewed_by: String,
        at: Date,
        _id: false
    }],
    created_at: { type: Date, default: Date.now }
});

// การจองหนึ่งรายการ มีบิลแต่ละประเภทได้เดือนละใบ
invoiceSchema.index({ booking_id: 1, kind: 1, month: 1 }, { unique: true });

export default mongoose.model('Invoice', invoiceSchema, 'invoices');
