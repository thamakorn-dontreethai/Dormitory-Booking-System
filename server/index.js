import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import Student from './models/Student.js';
import Room from './models/Room.js';
import Booking from './models/Booking.js';
import dotenv from 'dotenv';
import cors from 'cors';
import Building from './models/Building.js';
import RoomType from './models/RoomType.js';
import Admin from './models/Admin.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// --- Middleware ตรวจ JWT ---
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ message: 'ไม่พบ Token กรุณาเข้าสู่ระบบ' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Token ไม่ถูกต้องหรือหมดอายุ' });
    }
};

// --- POST /api/login ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'กรุณากรอก username และ password' });
    }

    try {
        const student = await Student.findOne({ username });

        if (!student) {
            return res.status(401).json({ message: 'Username หรือ Password ไม่ถูกต้อง' });
        }

        // เทียบ password ด้วย bcrypt
        const isMatch = await bcrypt.compare(password, student.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Username หรือ Password ไม่ถูกต้อง' });
        }

        const token = jwt.sign(
            { id: student._id, username: student.username, student_code: student.student_code },
            process.env.JWT_SECRET || 'secret123',
            { expiresIn: process.env.JWT_EXPIRES || '1h' }
        );

        res.json({
            message: 'เข้าสู่ระบบสำเร็จ',
            token,
            user: {
                id: student._id,
                username: student.username,
                full_name: student.full_name,
                student_code: student.student_code,
                gender: student.gender
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่ Server', error: err.message });
    }
});

const hashExistingPasswords = async () => {
    const students = await mongoose.connection.collection('students').find().toArray();

    for (const student of students) {
        // เช็คว่า hash แล้วยัง (bcrypt hash จะขึ้นต้นด้วย $2b$)
        if (!student.password_hash.startsWith('$2b$')) {
            const hashed = await bcrypt.hash(student.password_hash, 10);
            await mongoose.connection.collection('students').updateOne(
                { _id: student._id },
                { $set: { password_hash: hashed } }
            );
            console.log(`✅ hashed: ${student.username}`);
        }
    }
};

// --- POST /api/booking (ต้อง login ก่อน) ---
app.post('/api/booking', verifyToken, async (req, res) => {
    const { roomId, start_date, end_date } = req.body;
    const studentId = req.user.id; // ดึงจาก token

    if (!roomId || !start_date || !end_date) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ' });
    }

    try {
        // 1. ตรวจสอบห้อง
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ message: 'ไม่พบห้องพัก' });
        }
        if (room.status !== 'ACTIVE') {
            return res.status(400).json({ message: 'ห้องนี้ไม่ว่าง' });
        }

        // 2. ดึงข้อมูล student
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลนิสิต' });
        }

        // 3. สร้าง reservation (snapshot ณ เวลาจอง)
        const newBooking = new Booking({
            student_id: student._id,
            room_id: room._id,
            student_code: student.student_code,  // snapshot
            full_name: student.full_name,          // snapshot
            room_number: room.room_number,         // snapshot
            start_date: new Date(start_date),
            end_date: new Date(end_date),
            status: 'PENDING',
            created_at: new Date()
        });
        await newBooking.save();

        // 4. อัปเดตสถานะห้อง
        room.status = 'INACTIVE';
        room.updated_at = new Date();
        room.updated_by = student._id;
        await room.save();

        res.status(201).json({
            message: 'จองห้องสำเร็จ รอการอนุมัติ',
            booking: newBooking
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- GET /api/rooms (ดูห้องว่าง) ---
app.get('/api/rooms', async (req, res) => {
    try {
        const rooms = await Room.find({ status: 'ACTIVE' })
            .populate('building_id', 'building_name gender_type')
            .populate('type_id', 'type_name monthly_price cooling_type capacity');

        res.json(rooms);
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});
// --- GET /api/buildings (filter ตาม gender) ---
app.get('/api/buildings', async (req, res) => {
    try {
        const { gender } = req.query;
        const query = gender ? { gender_type: gender } : {};
        const buildings = await Building.find(query);
        res.json(buildings.map(b => ({
            building_id: b._id,
            building_name: b.building_name,
            gender_type: b.gender_type,
            deposit_amount: b.deposit_amount
        })));
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- GET /api/rooms/by-building ---
app.get('/api/rooms/by-building', async (req, res) => {
    try {
        const { building_id } = req.query;
        if (!building_id) return res.status(400).json({ message: 'กรุณาระบุ building_id' });

        const rooms = await Room.find({ building_id: new mongoose.Types.ObjectId(building_id) })
            .populate('type_id', 'type_name capacity monthly_price cooling_type');

        // นับจำนวนคนที่จองแต่ละห้องแล้ว
        const reservations = await Booking.find({
            room_id: { $in: rooms.map(r => r._id) },
            status: { $in: ['PENDING', 'CONFIRMED'] }
        });

        const bookedCountMap = {};
        reservations.forEach(r => {
            const key = r.room_id.toString();
            bookedCountMap[key] = (bookedCountMap[key] || 0) + 1;
        });

        const result = rooms.map(r => ({
            room_id: r._id,
            room_number: r.room_number,
            type_name: r.type_id?.type_name || '-',
            capacity: r.type_id?.capacity || 0,
            monthly_price: r.type_id?.monthly_price?.toString() || '0',
            cooling_type: r.type_id?.cooling_type || '-',
            status: r.status,
            booked_count: bookedCountMap[r._id.toString()] || 0,
            is_disabled: r.status !== 'ACTIVE' ? 1 : 0
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- GET /api/my-reservation ---
app.get('/api/my-reservation', verifyToken, async (req, res) => {
    try {
        const reservation = await Booking.findOne({
            student_id: req.user.id,
            status: { $in: ['PENDING', 'CONFIRMED'] }
        }).populate('room_id', 'room_number type_id')
            .populate({ path: 'room_id', populate: { path: 'type_id', select: 'type_name' } });

        if (!reservation) return res.json({ reservation: null });

        res.json({
            reservation: {
                reserve_id: reservation._id,
                room_id: reservation.room_id?._id,
                room_number: reservation.room_number,
                type_name: reservation.room_id?.type_id?.type_name,
                status: reservation.status,
                start_date: reservation.start_date,
                end_date: reservation.end_date
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});
// --- POST /api/reservations (จองห้อง) ---
app.post('/api/reservations', verifyToken, async (req, res) => {
    const { roomId } = req.body;
    const studentId = req.user.id;

    try {
        // เช็คว่าจองแล้วหรือยัง
        const existing = await Booking.findOne({
            student_id: studentId,
            status: { $in: ['PENDING', 'CONFIRMED'] }
        });
        if (existing) {
            return res.status(400).json({ message: 'คุณมีการจองอยู่แล้ว' });
        }

        const room = await Room.findById(roomId).populate('type_id');
        if (!room) return res.status(404).json({ message: 'ไม่พบห้องพัก' });
        if (room.status !== 'ACTIVE') return res.status(400).json({ message: 'ห้องนี้ไม่เปิดให้จอง' });

        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: 'ไม่พบข้อมูลนิสิต' });

        const newBooking = new Booking({
            student_id: student._id,
            room_id: room._id,
            student_code: student.student_code,
            full_name: student.full_name,
            room_number: room.room_number,
            start_date: new Date(),
            end_date: new Date(new Date().setMonth(new Date().getMonth() + 6)),
            status: 'PENDING',
            created_at: new Date()
        });
        await newBooking.save();

        res.status(201).json({
            message: 'จองห้องสำเร็จ รอการชำระเงิน',
            reservation: {
                student_code: student.student_code,
                full_name: student.full_name,
                room_number: room.room_number,
                status: 'PENDING'
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- GET /api/reservations/by-room (ดูผู้จองในห้อง) ---
app.get('/api/reservations/by-room', async (req, res) => {
    try {
        const { room_id } = req.query;
        const reservations = await Booking.find({
            room_id: new mongoose.Types.ObjectId(room_id),
            status: { $in: ['PENDING', 'CONFIRMED'] }
        });

        res.json({ reservations });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- DELETE /api/my-reservation (ยกเลิกการจอง) ---
app.delete('/api/my-reservation', verifyToken, async (req, res) => {
    try {
        const reservation = await Booking.findOne({
            student_id: req.user.id,
            status: { $in: ['PENDING', 'CONFIRMED'] }
        });

        if (!reservation) {
            return res.status(404).json({ message: 'ไม่พบการจอง' });
        }

        // คืนสถานะห้องกลับเป็น ACTIVE
        await Room.findByIdAndUpdate(reservation.room_id, { status: 'ACTIVE' });
        await Booking.deleteOne({ _id: reservation._id });

        res.json({ message: 'ยกเลิกการจองสำเร็จ' });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- PATCH /api/my-reservation/confirm (จำลองชำระเงิน) ---
app.patch('/api/my-reservation/confirm', verifyToken, async (req, res) => {
    try {
        const reservation = await Booking.findOne({
            student_id: req.user.id,
            status: 'PENDING'
        });

        if (!reservation) {
            return res.status(404).json({ message: 'ไม่พบการจองที่รอชำระเงิน' });
        }

        reservation.status = 'CONFIRMED';
        await reservation.save();

        res.json({
            success: true,
            message: 'ชำระเงินสำเร็จ!',
            reservation: {
                reserve_id: reservation._id,
                room_number: reservation.room_number,
                status: reservation.status
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});
// --- Admin Middleware ---
const verifyAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'ไม่พบ Token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
        if (!decoded.isAdmin) return res.status(403).json({ message: 'ไม่มีสิทธิ์ Admin' });
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Token ไม่ถูกต้อง' });
    }
};

// --- POST /api/admin/login ---
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'กรุณากรอก username และ password' });
    }
    try {
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({ message: 'Username หรือ Password ไม่ถูกต้อง' });
        }
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Username หรือ Password ไม่ถูกต้อง' });
        }
        const token = jwt.sign(
            { username: admin.username, isAdmin: true, role: admin.role },
            process.env.JWT_SECRET || 'secret123',
            { expiresIn: '8h' }
        );
        return res.json({ token });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่ Server', error: err.message });
    }
});

// --- GET /api/admin/reservations ---
app.get('/api/admin/reservations', verifyAdmin, async (req, res) => {
    try {
        const reservations = await Booking.find()
            .sort({ created_at: -1 });
        res.json(reservations);
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- PATCH /api/admin/reservations/:id ---
app.patch('/api/admin/reservations/:id', verifyAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const reservation = await Booking.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!reservation) return res.status(404).json({ message: 'ไม่พบการจอง' });

        // ถ้ายกเลิก ให้คืนสถานะห้องเป็น ACTIVE
        if (status === 'CANCELLED') {
            await Room.findByIdAndUpdate(reservation.room_id, { status: 'ACTIVE' });
        }
        res.json({ message: 'อัปเดตสำเร็จ', reservation });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- GET /api/admin/students ---
app.get('/api/admin/students', verifyAdmin, async (req, res) => {
    try {
        const students = await Student.find({}, { password_hash: 0 }); // ไม่ส่ง password
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- DELETE /api/admin/students/:id ---
app.delete('/api/admin/students/:id', verifyAdmin, async (req, res) => {
    try {
        await Student.findByIdAndDelete(req.params.id);
        res.json({ message: 'ลบนิสิตสำเร็จ' });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- GET /api/admin/rooms ---
app.get('/api/admin/rooms', verifyAdmin, async (req, res) => {
    try {
        const rooms = await Room.find()
            .populate('building_id', 'building_name')
            .populate('type_id', 'type_name capacity monthly_price cooling_type');
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- PATCH /api/admin/rooms/:id ---
app.patch('/api/admin/rooms/:id', verifyAdmin, async (req, res) => {
    try {
        const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!room) return res.status(404).json({ message: 'ไม่พบห้อง' });
        res.json({ message: 'อัปเดตห้องสำเร็จ', room });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- DELETE /api/admin/rooms/:id ---
app.delete('/api/admin/rooms/:id', verifyAdmin, async (req, res) => {
    try {
        await Room.findByIdAndDelete(req.params.id);
        res.json({ message: 'ลบห้องสำเร็จ' });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});
// --- POST /api/admin/students (เพิ่มนิสิต) ---
app.post('/api/admin/students', verifyAdmin, async (req, res) => {
    try {
        const { student_code, full_name, email, phone, gender, faculty, study_year, username, password } = req.body;

        // เช็คซ้ำ
        const existing = await Student.findOne({ $or: [{ student_code }, { email }, { username }] });
        if (existing) {
            return res.status(400).json({ message: 'รหัสนิสิต, อีเมล หรือ username ซ้ำ' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const student = new Student({
            student_code, full_name, email, phone, gender,
            faculty, study_year: Number(study_year),
            username, password_hash, created_at: new Date()
        });
        await student.save();

        res.status(201).json({ message: 'เพิ่มนิสิตสำเร็จ', student });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});
// --- GET /api/admin/dashboard ---
app.get('/api/admin/dashboard', verifyAdmin, async (req, res) => {
    try {
        const [
            totalStudents,
            totalRooms,
            activeRooms,
            pendingRes,
            confirmedRes,
            cancelledRes,
            recentRes
        ] = await Promise.all([
            Student.countDocuments(),
            Room.countDocuments(),
            Room.countDocuments({ status: 'ACTIVE' }),
            Booking.countDocuments({ status: 'PENDING' }),
            Booking.countDocuments({ status: 'CONFIRMED' }),
            Booking.countDocuments({ status: 'CANCELLED' }),
            Booking.find().sort({ created_at: -1 }).limit(5)
        ]);

        res.json({
            totalStudents,
            totalRooms,
            activeRooms,
            occupiedRooms: totalRooms - activeRooms,
            pendingRes,
            confirmedRes,
            cancelledRes,
            recentRes
        });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- Sync admin จาก .env ไปยัง MongoDB ---
const syncAdminFromEnv = async () => {
    const username = process.env.ADMIN_USER?.trim();
    const password = process.env.ADMIN_PASS?.trim();
    if (!username || !password) return;
    const hashed = await bcrypt.hash(password, 10);
    await Admin.findOneAndUpdate(
        { username },
        { username, password: hashed, role: 'admin' },
        { upsert: true }
    );
    console.log(`✅ Admin synced: ${username}`);
};

// --- Connect MongoDB ---
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('MongoDB Connected!');
        await hashExistingPasswords();
        await syncAdminFromEnv();
    })
    .catch(err => console.error('MongoDB Error:', err));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));