import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
    building_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Building' },
    type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' },
    room_number: String,
    gender_restriction: String,
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'], default: 'ACTIVE' },
    updated_at: Date,
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }
});

export default mongoose.model('Room', roomSchema, 'rooms');