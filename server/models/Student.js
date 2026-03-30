import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
    student_code: String,
    full_name: String,
    email: String,
    phone: String,
    gender: String,
    faculty: String,
    study_year: Number,
    username: String,
    password_hash: String,
    created_at: Date
});

export default mongoose.model('Student', studentSchema, 'students');