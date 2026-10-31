import mongoose from 'mongoose';

// บิลค่าห้องรายเดือน (เดือนแรกชำระไปแล้วตอนจอง บิลนี้เริ่มเดือนถัดไป)
const invoiceSchema = new mongoose.Schema({
    booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    student_code: String,
    full_name: String,
    room_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    room_number: String,
    month: { type: String, required: true }, // 'YYYY-MM'
    // รายการในบิล: ค่าห้อง + ค่าน้ำ + ค่าไฟ (ค่าน้ำ/ไฟ เพิ่มเมื่อ admin บันทึกมิเตอร์)
    items: [{
        type: { type: String, enum: ['RENT', 'WATER', 'ELECTRIC'] },
        label: String,
        units: Number,       // หน่วยที่ใช้ทั้งห้อง
        rate: Number,        // บาท/หน่วย
        share: Number,       // หารกันกี่คน
        amount: Number,
        _id: false
    }],
    utilities_recorded: { type: Boolean, default: false }, // บันทึกมิเตอร์น้ำ/ไฟแล้วหรือยัง (จ่ายได้เมื่อ true)
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

// บิลของการจองหนึ่งรายการ มีได้เดือนละใบ
invoiceSchema.index({ booking_id: 1, month: 1 }, { unique: true });

export default mongoose.model('Invoice', invoiceSchema, 'invoices');
