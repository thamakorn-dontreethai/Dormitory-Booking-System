import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
    building_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Building' },
    type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' },
    room_number: String,
    gender_restriction: String,
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'], default: 'ACTIVE' },
    // ค่าน้ำ/ค่าไฟเหมาจ่ายต่อเดือนของทั้งห้อง (หารเท่ากันตามจำนวนผู้พัก) 0 = ยังไม่ตั้ง
    water_fee: { type: Number, default: 0 },
    electric_fee: { type: Number, default: 0 },
    updated_at: Date,
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }
});

export default mongoose.model('Room', roomSchema, 'rooms');