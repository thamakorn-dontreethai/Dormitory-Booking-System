import mongoose from 'mongoose';

const buildingSchema = new mongoose.Schema({
    building_code: String,
    building_name: String,
    gender_type: String,
    deposit_amount: mongoose.Types.Decimal128
});

export default mongoose.model('Building', buildingSchema, 'buildings');