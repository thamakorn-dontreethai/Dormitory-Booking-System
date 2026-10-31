import mongoose from 'mongoose';

// เลขมิเตอร์น้ำ/ไฟของห้อง ประจำเดือน
const meterReadingSchema = new mongoose.Schema({
    room_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    room_number: String,
    month: { type: String, required: true }, // 'YYYY-MM'
    water_prev: Number,
    water_curr: Number,
    elec_prev: Number,
    elec_curr: Number,
    recorded_by: String,
    recorded_at: Date
});

meterReadingSchema.index({ room_id: 1, month: 1 }, { unique: true });

export default mongoose.model('MeterReading', meterReadingSchema, 'meter_readings');
