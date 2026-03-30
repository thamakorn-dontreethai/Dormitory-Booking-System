// models/RoomType.js
import mongoose from 'mongoose';

const roomTypeSchema = new mongoose.Schema({
    type_code: String,
    type_name: String,
    capacity: Number,
    monthly_price: mongoose.Types.Decimal128,
    cooling_type: String
});

export default mongoose.model('RoomType', roomTypeSchema, 'room_types'); 