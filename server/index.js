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
import Invoice from './models/Invoice.js';
import MeterReading from './models/MeterReading.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// สถานะที่ถือว่าการจองยัง "ใช้งานอยู่" (กันที่ในห้อง และจองซ้ำไม่ได้)
const ACTIVE_STATUSES = ['PENDING', 'PAID', 'CONFIRMED'];

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
// --- GET /api/building-stats ---
app.get('/api/building-stats', async (req, res) => {
    try {
        const buildings = await Building.find();
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
            status: { $in: ACTIVE_STATUSES }
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
            status: { $in: ACTIVE_STATUSES }
        }).populate('room_id', 'room_number type_id')
            .populate({ path: 'room_id', populate: { path: 'type_id', select: 'type_name' } });

        if (!reservation) {
            // ถ้าการจองล่าสุดถูก admin ปฏิเสธ ให้ส่งเหตุผลกลับไปแสดงให้นิสิตเห็น
            const latest = await Booking.findOne({ student_id: req.user.id }).sort({ created_at: -1 });
            const last_rejection = latest?.status === 'REJECTED' ? {
                room_number: latest.room_number,
                reason: latest.review?.reason,
                reviewed_at: latest.review?.reviewed_at,
                amount: latest.payment?.amount,
                refund_ref: latest.payment?.refund_ref
            } : null;
            return res.json({ reservation: null, last_rejection });
        }

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
            status: { $in: ACTIVE_STATUSES }
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
            status: { $in: ACTIVE_STATUSES }
        }).select('student_code full_name room_number status'); // ไม่ส่งข้อมูลการชำระเงินของคนอื่น

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
            status: { $in: ACTIVE_STATUSES }
        });

        if (!reservation) {
            return res.status(404).json({ message: 'ไม่พบการจอง' });
        }

        // ชำระเงินแล้วยกเลิกเองไม่ได้ ต้องติดต่อเจ้าหน้าที่
        if (reservation.status !== 'PENDING') {
            return res.status(400).json({ message: 'ชำระเงินแล้ว ไม่สามารถยกเลิกการจองได้ กรุณาติดต่อเจ้าหน้าที่' });
        }

        // คืนสถานะห้องกลับเป็น ACTIVE
        await Room.findByIdAndUpdate(reservation.room_id, { status: 'ACTIVE' });

        await Booking.deleteOne({ _id: reservation._id });
        res.json({ message: 'ยกเลิกการจองสำเร็จ' });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// ===== ระบบชำระเงินจำลอง (Demo) — ไม่มีการตัดเงินจริง =====

// คำนวณยอดที่ต้องชำระ: ค่าห้อง (จาก room_types) + เงินประกัน (จาก buildings)
const getPaymentSummary = async (reservation) => {
    const room = await Room.findById(reservation.room_id)
        .populate('type_id', 'type_name monthly_price cooling_type')
        .populate('building_id', 'building_name deposit_amount');
    const room_price = Number(room?.type_id?.monthly_price?.toString() || 0);
    const deposit = Number(room?.building_id?.deposit_amount?.toString() || 0);
    return {
        kind: 'BOOKING',
        reserve_id: reservation._id,
        room_number: reservation.room_number,
        type_name: room?.type_id?.type_name,
        cooling_type: room?.type_id?.cooling_type,
        building_name: room?.building_id?.building_name,
        status: reservation.status,
        room_price,
        deposit,
        items: [
            { label: 'ค่าห้องพัก (เดือนแรก)', amount: room_price },
            { label: 'เงินประกันหอพัก', amount: deposit }
        ],
        amount: room_price + deposit,
        payment: reservation.payment?.ref ? reservation.payment : null,
        review: reservation.review?.action ? reservation.review : null
    };
};

// เลขอ้างอิงธุรกรรมจำลอง เช่น PAY-20261031-4F7A2C
const makePaymentRef = (prefix = 'PAY') => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(16).slice(2, 8).toUpperCase().padEnd(6, '0');
    return `${prefix}-${date}-${rand}`;
};

// คืนเงินจำลอง: บันทึกเลขอ้างอิงการคืนเงิน (ถ้าเคยชำระและยังไม่เคยคืน)
const refundPayment = (reservation) => {
    if (!reservation.payment?.ref || reservation.payment.refund_ref) return;
    reservation.payment.refund_ref = makePaymentRef('REFUND');
    reservation.payment.refunded_at = new Date();
};

// ตรวจเลขบัตรด้วย Luhn algorithm
const isValidCardNumber = (num) => {
    if (!/^\d{16}$/.test(num)) return false;
    let sum = 0;
    for (let i = 0; i < 16; i++) {
        let d = Number(num[15 - i]);
        if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
        sum += d;
    }
    return sum % 10 === 0;
};

// บัตรทดสอบที่จำลองว่า "ถูกปฏิเสธ"
const DECLINED_TEST_CARD = '4000000000000002';

// --- GET /api/my-reservation/payment (สรุปยอดที่ต้องชำระ / ใบเสร็จ) ---
app.get('/api/my-reservation/payment', verifyToken, async (req, res) => {
    try {
        const reservation = await Booking.findOne({
            student_id: req.user.id,
            status: { $in: ACTIVE_STATUSES }
        });
        if (!reservation) return res.status(404).json({ message: 'ไม่พบการจอง' });
        res.json(await getPaymentSummary(reservation));
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// ตรวจข้อมูลการชำระเงินจาก body (ใช้ร่วมกันทั้งค่าจองและบิลรายเดือน)
// body: { method: 'PROMPTPAY' } หรือ { method: 'CARD', card_number, card_name, card_expiry, card_cvc }
// คืนค่า { error, status } ถ้าไม่ผ่าน หรือ { method, card_last4 } ถ้าผ่าน
const validatePaymentInput = (body) => {
    const { method } = body;
    if (!['PROMPTPAY', 'CARD'].includes(method)) {
        return { status: 400, error: 'กรุณาเลือกช่องทางการชำระเงิน' };
    }
    if (method === 'PROMPTPAY') return { method };

    const card_number = String(body.card_number || '').replace(/\s/g, '');
    const card_name = String(body.card_name || '').trim();
    const card_expiry = String(body.card_expiry || '').trim();
    const card_cvc = String(body.card_cvc || '').trim();

    if (!isValidCardNumber(card_number)) {
        return { status: 400, error: 'หมายเลขบัตรไม่ถูกต้อง' };
    }
    if (!card_name) {
        return { status: 400, error: 'กรุณากรอกชื่อบนบัตร' };
    }
    const exp = card_expiry.match(/^(\d{2})\/(\d{2})$/);
    const expMonth = exp ? Number(exp[1]) : 0;
    // บัตรใช้ได้ถึงสิ้นเดือนที่หมดอายุ
    if (!exp || expMonth < 1 || expMonth > 12 || new Date(2000 + Number(exp[2]), expMonth, 1) <= new Date()) {
        return { status: 400, error: 'วันหมดอายุบัตรไม่ถูกต้องหรือบัตรหมดอายุแล้ว' };
    }
    if (!/^\d{3}$/.test(card_cvc)) {
        return { status: 400, error: 'CVC ต้องเป็นตัวเลข 3 หลัก' };
    }
    if (card_number === DECLINED_TEST_CARD) {
        return { status: 402, error: 'ธนาคารปฏิเสธการชำระเงิน กรุณาใช้บัตรอื่น' };
    }
    return { method, card_last4: card_number.slice(-4) }; // เก็บแค่ 4 หลักท้าย ไม่เก็บเลขบัตรเต็ม/CVC
};

// --- POST /api/my-reservation/pay (ชำระค่าจอง) ---
app.post('/api/my-reservation/pay', verifyToken, async (req, res) => {
    const input = validatePaymentInput(req.body);
    if (input.error) return res.status(input.status).json({ message: input.error });
    const { method, card_last4 } = input;

    try {
        const reservation = await Booking.findOne({ student_id: req.user.id, status: 'PENDING' });
        if (!reservation) {
            return res.status(404).json({ message: 'ไม่พบการจองที่รอชำระเงิน' });
        }

        const summary = await getPaymentSummary(reservation);
        reservation.status = 'PAID'; // รอ admin ตรวจสอบ
        reservation.payment = {
            amount: summary.amount,
            room_price: summary.room_price,
            deposit: summary.deposit,
            method,
            card_last4,
            ref: makePaymentRef(),
            paid_at: new Date()
        };
        await reservation.save();

        res.json({
            success: true,
            message: 'ชำระเงินสำเร็จ! รอเจ้าหน้าที่ตรวจสอบ',
            receipt: await getPaymentSummary(reservation)
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
        const reservation = await Booking.findById(req.params.id);
        if (!reservation) return res.status(404).json({ message: 'ไม่พบการจอง' });

        reservation.status = status;
        // ถ้ายกเลิก ให้คืนสถานะห้องเป็น ACTIVE และคืนเงิน (ถ้าชำระแล้ว)
        if (status === 'CANCELLED') {
            await Room.findByIdAndUpdate(reservation.room_id, { status: 'ACTIVE' });
            refundPayment(reservation);
            // ยกเลิกการจองแล้ว บิลรายเดือนที่ยังไม่ได้จ่ายก็ไม่ต้องเก็บ
            await Invoice.deleteMany({ booking_id: reservation._id, status: 'UNPAID' });
        }
        await reservation.save();
        res.json({ message: 'อัปเดตสำเร็จ', reservation });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- POST /api/admin/reservations/:id/review (ตรวจสอบการชำระเงิน) ---
// body: { action: 'APPROVED' } หรือ { action: 'REJECTED', reason: '...' }
app.post('/api/admin/reservations/:id/review', verifyAdmin, async (req, res) => {
    const { action } = req.body;
    const reason = String(req.body.reason || '').trim();

    if (!['APPROVED', 'REJECTED'].includes(action)) {
        return res.status(400).json({ message: 'action ต้องเป็น APPROVED หรือ REJECTED' });
    }
    if (action === 'REJECTED' && !reason) {
        return res.status(400).json({ message: 'กรุณาระบุเหตุผลที่ปฏิเสธ' });
    }

    try {
        const reservation = await Booking.findById(req.params.id);
        if (!reservation) return res.status(404).json({ message: 'ไม่พบการจอง' });
        if (reservation.status !== 'PAID') {
            return res.status(400).json({ message: 'ตรวจสอบได้เฉพาะรายการที่ชำระเงินแล้ว (รอตรวจสอบ)' });
        }

        reservation.review = {
            action,
            reason: reason || undefined,
            reviewed_by: req.user.username,
            reviewed_at: new Date()
        };

        if (action === 'APPROVED') {
            reservation.status = 'CONFIRMED';
        } else {
            reservation.status = 'REJECTED'; // ที่ในห้องว่างให้คนอื่นจองได้ทันที
            refundPayment(reservation);
        }
        await reservation.save();

        res.json({
            message: action === 'APPROVED'
                ? 'อนุมัติการชำระเงินแล้ว'
                : `ปฏิเสธการชำระเงินแล้ว ระบบคืนเงิน ${reservation.payment?.amount ?? 0} บาท`,
            reservation
        });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// ===== ค่าห้องรายเดือน (Invoices) =====

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// Date -> 'YYYY-MM' (ตามเวลาเครื่อง server)
const toMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

// กำหนดชำระ: วันที่ 10 ของเดือนนั้น สิ้นวัน
const dueDateOf = (month) => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 10, 23, 59, 59);
};

const isOverdue = (invoice) => invoice.status === 'UNPAID' && invoice.due_date && invoice.due_date < new Date();

// อัตราค่าน้ำ/ไฟ (บาทต่อหน่วย) ตั้งค่าได้ใน .env
const WATER_RATE = Number(process.env.WATER_RATE) || 18;
const ELECTRIC_RATE = Number(process.env.ELECTRIC_RATE) || 8;

const round2 = (n) => Math.round(n * 100) / 100;

const rentItem = (amount) => ({ type: 'RENT', label: 'ค่าห้องพัก', amount });

// รายการค่าน้ำ/ไฟของนิสิต 1 คน: หน่วยที่ใช้ทั้งห้อง × อัตรา ÷ จำนวนคนในห้อง
const utilityItems = (reading, share) => {
    const waterUnits = reading.water_curr - reading.water_prev;
    const elecUnits = reading.elec_curr - reading.elec_prev;
    return [
        { type: 'WATER', label: 'ค่าน้ำ', units: waterUnits, rate: WATER_RATE, share, amount: round2(waterUnits * WATER_RATE / share) },
        { type: 'ELECTRIC', label: 'ค่าไฟ', units: elecUnits, rate: ELECTRIC_RATE, share, amount: round2(elecUnits * ELECTRIC_RATE / share) }
    ];
};

// ใส่ค่าน้ำ/ไฟจากมิเตอร์ให้บิลที่ยังไม่ชำระของห้องนั้นในเดือนนั้น (หารเท่ากันตามจำนวนบิลในห้อง)
const applyMeterToInvoices = async (reading) => {
    const invoices = await Invoice.find({ room_id: reading.room_id, month: reading.month });
    const share = invoices.length;
    for (const inv of invoices.filter(i => i.status === 'UNPAID')) {
        const rent = inv.items.find(it => it.type === 'RENT') || rentItem(inv.amount);
        const items = [rent, ...utilityItems(reading, share)];
        inv.items = items;
        inv.amount = round2(items.reduce((s, it) => s + it.amount, 0));
        inv.utilities_recorded = true;
        await inv.save();
    }
    return invoices.length;
};

// ข้อมูลบิลสำหรับแสดงผล/ชำระเงิน (รูปแบบเดียวกับ getPaymentSummary)
const getInvoiceSummary = async (invoice, { withRoom = true } = {}) => {
    let building_name, type_name;
    if (withRoom) {
        const booking = await Booking.findById(invoice.booking_id).populate({
            path: 'room_id',
            populate: [{ path: 'type_id', select: 'type_name' }, { path: 'building_id', select: 'building_name' }]
        });
        building_name = booking?.room_id?.building_id?.building_name;
        type_name = booking?.room_id?.type_id?.type_name;
    }
    const lastRejection = invoice.rejections?.length ? invoice.rejections[invoice.rejections.length - 1] : null;
    return {
        kind: 'INVOICE',
        invoice_id: invoice._id,
        month: invoice.month,
        room_number: invoice.room_number,
        building_name,
        type_name,
        status: invoice.status,
        due_date: invoice.due_date,
        overdue: isOverdue(invoice),
        items: invoice.items?.length ? invoice.items : [rentItem(invoice.amount)],
        utilities_recorded: !!invoice.utilities_recorded,
        amount: invoice.amount,
        payment: invoice.payment?.ref ? { ...invoice.payment.toObject(), amount: invoice.amount } : null,
        review: invoice.review?.action ? invoice.review : null,
        last_rejection: invoice.status === 'UNPAID' ? lastRejection : null
    };
};

// --- GET /api/my-invoices (บิลค่าห้องของฉัน) ---
app.get('/api/my-invoices', verifyToken, async (req, res) => {
    try {
        const invoices = await Invoice.find({ student_id: req.user.id }).sort({ month: 1 }); // เดือนเก่าก่อน จ่ายบิลที่ค้างนานก่อน
        res.json(await Promise.all(invoices.map(inv => getInvoiceSummary(inv, { withRoom: false }))));
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- GET /api/my-invoices/:id (รายละเอียดบิล / ใบเสร็จ) ---
app.get('/api/my-invoices/:id', verifyToken, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'ไม่พบบิล' });
        const invoice = await Invoice.findOne({ _id: req.params.id, student_id: req.user.id });
        if (!invoice) return res.status(404).json({ message: 'ไม่พบบิล' });
        res.json(await getInvoiceSummary(invoice));
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- POST /api/my-invoices/:id/pay (ชำระบิลรายเดือน) ---
app.post('/api/my-invoices/:id/pay', verifyToken, async (req, res) => {
    const input = validatePaymentInput(req.body);
    if (input.error) return res.status(input.status).json({ message: input.error });

    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'ไม่พบบิล' });
        const invoice = await Invoice.findOne({ _id: req.params.id, student_id: req.user.id });
        if (!invoice) return res.status(404).json({ message: 'ไม่พบบิล' });
        if (invoice.status !== 'UNPAID') {
            return res.status(400).json({ message: 'บิลนี้ชำระแล้ว' });
        }
        if (!invoice.utilities_recorded) {
            return res.status(400).json({ message: 'บิลยังไม่สมบูรณ์ รอเจ้าหน้าที่บันทึกค่าน้ำ-ค่าไฟ' });
        }

        invoice.status = 'PAID'; // รอ admin ตรวจสอบ
        invoice.payment = {
            method: input.method,
            card_last4: input.card_last4,
            ref: makePaymentRef(),
            paid_at: new Date()
        };
        invoice.review = undefined;
        await invoice.save();

        res.json({
            success: true,
            message: 'ชำระเงินสำเร็จ! รอเจ้าหน้าที่ตรวจสอบ',
            receipt: await getInvoiceSummary(invoice)
        });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- POST /api/admin/invoices/generate (ออกบิลประจำเดือน) ---
// body: { month: 'YYYY-MM' } ออกบิลให้ทุกการจองที่ยืนยันแล้ว และเดือนนั้นอยู่ในสัญญา (ไม่รวมเดือนแรกที่จ่ายตอนจอง)
app.post('/api/admin/invoices/generate', verifyAdmin, async (req, res) => {
    const month = String(req.body.month || '');
    if (!MONTH_PATTERN.test(month)) {
        return res.status(400).json({ message: 'รูปแบบเดือนไม่ถูกต้อง (YYYY-MM)' });
    }

    try {
        const bookings = await Booking.find({ status: 'CONFIRMED' })
            .populate({ path: 'room_id', populate: { path: 'type_id', select: 'monthly_price' } });

        let created = 0, existed = 0, outOfContract = 0;
        const touchedRooms = new Set();
        for (const b of bookings) {
            const startMonth = toMonthKey(b.start_date);
            const endMonth = toMonthKey(b.end_date);
            // เดือนแรก (startMonth) ชำระไปแล้วตอนจอง
            if (month <= startMonth || month > endMonth) { outOfContract++; continue; }
            if (await Invoice.exists({ booking_id: b._id, month })) { existed++; continue; }

            const rent = Number(b.room_id?.type_id?.monthly_price?.toString() || 0);
            await Invoice.create({
                booking_id: b._id,
                student_id: b.student_id,
                student_code: b.student_code,
                full_name: b.full_name,
                room_id: b.room_id?._id,
                room_number: b.room_number,
                month,
                items: [rentItem(rent)],
                amount: rent,
                due_date: dueDateOf(month)
            });
            created++;
            if (b.room_id?._id) touchedRooms.add(String(b.room_id._id));
        }

        // ถ้าห้องไหนบันทึกมิเตอร์เดือนนี้ไว้แล้ว ให้คิดค่าน้ำ/ไฟใหม่ (จำนวนคนหารเปลี่ยน)
        for (const roomId of touchedRooms) {
            const reading = await MeterReading.findOne({ room_id: roomId, month });
            if (reading) await applyMeterToInvoices(reading);
        }

        res.json({
            message: created
                ? `ออกบิลเดือน ${month} แล้ว ${created} รายการ`
                : `ไม่มีบิลใหม่สำหรับเดือน ${month}`,
            created,
            existed,
            out_of_contract: outOfContract
        });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- GET /api/admin/meters?month=YYYY-MM (ห้องที่มีบิลเดือนนั้น + เลขมิเตอร์) ---
app.get('/api/admin/meters', verifyAdmin, async (req, res) => {
    const month = String(req.query.month || '');
    if (!MONTH_PATTERN.test(month)) {
        return res.status(400).json({ message: 'รูปแบบเดือนไม่ถูกต้อง (YYYY-MM)' });
    }
    try {
        const invoices = await Invoice.find({ month, room_id: { $ne: null } });
        const rooms = new Map();
        for (const inv of invoices) {
            const key = String(inv.room_id);
            if (!rooms.has(key)) rooms.set(key, { room_id: inv.room_id, room_number: inv.room_number, occupants: [], locked: false });
            const room = rooms.get(key);
            room.occupants.push(inv.full_name);
            if (inv.status !== 'UNPAID') room.locked = true; // มีคนชำระแล้ว แก้มิเตอร์ไม่ได้
        }

        const result = [];
        for (const room of rooms.values()) {
            const reading = await MeterReading.findOne({ room_id: room.room_id, month });
            // เลขเดิมตั้งต้น = เลขล่าสุดของเดือนก่อนหน้า
            const previous = await MeterReading.findOne({ room_id: room.room_id, month: { $lt: month } }).sort({ month: -1 });
            result.push({
                ...room,
                reading,
                suggested_prev: previous ? { water: previous.water_curr, elec: previous.elec_curr } : null
            });
        }
        result.sort((a, b) => String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true }));

        res.json({ month, rates: { water: WATER_RATE, electric: ELECTRIC_RATE }, rooms: result });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- PUT /api/admin/meters (บันทึกมิเตอร์ห้อง แล้วคิดค่าน้ำ/ไฟลงบิลของทุกคนในห้อง) ---
// body: { room_id, month, water_prev, water_curr, elec_prev, elec_curr }
app.put('/api/admin/meters', verifyAdmin, async (req, res) => {
    const { room_id } = req.body;
    const month = String(req.body.month || '');
    if (!MONTH_PATTERN.test(month)) {
        return res.status(400).json({ message: 'รูปแบบเดือนไม่ถูกต้อง (YYYY-MM)' });
    }
    if (!mongoose.isValidObjectId(room_id)) {
        return res.status(400).json({ message: 'ไม่พบห้อง' });
    }

    const fields = ['water_prev', 'water_curr', 'elec_prev', 'elec_curr'];
    const values = {};
    for (const f of fields) {
        const raw = req.body[f];
        const n = Number(raw);
        if (raw === '' || raw === null || raw === undefined || !Number.isFinite(n) || n < 0) {
            return res.status(400).json({ message: 'กรุณากรอกเลขมิเตอร์ให้ครบ (ตัวเลขไม่ติดลบ)' });
        }
        values[f] = n;
    }
    if (values.water_curr < values.water_prev) {
        return res.status(400).json({ message: 'เลขมิเตอร์น้ำครั้งนี้ต้องไม่น้อยกว่าครั้งก่อน' });
    }
    if (values.elec_curr < values.elec_prev) {
        return res.status(400).json({ message: 'เลขมิเตอร์ไฟครั้งนี้ต้องไม่น้อยกว่าครั้งก่อน' });
    }

    try {
        const invoices = await Invoice.find({ room_id, month });
        if (!invoices.length) {
            return res.status(400).json({ message: 'ห้องนี้ยังไม่มีบิลเดือนนี้ กรุณาออกบิลก่อน' });
        }
        if (invoices.some(i => i.status !== 'UNPAID')) {
            return res.status(400).json({ message: 'มีนิสิตในห้องนี้ชำระบิลเดือนนี้แล้ว ไม่สามารถแก้มิเตอร์ได้' });
        }

        const reading = await MeterReading.findOneAndUpdate(
            { room_id, month },
            { ...values, room_id, month, room_number: invoices[0].room_number, recorded_by: req.user.username, recorded_at: new Date() },
            { upsert: true, new: true }
        );
        const count = await applyMeterToInvoices(reading);
        const updated = await Invoice.find({ room_id, month });

        res.json({
            message: `บันทึกมิเตอร์ห้อง ${reading.room_number} แล้ว อัปเดตบิล ${count} รายการ`,
            reading,
            invoices: updated.map(inv => ({ ...inv.toObject(), overdue: isOverdue(inv) }))
        });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- GET /api/admin/invoices (รายการบิลทั้งหมด, กรองด้วย ?month=YYYY-MM) ---
app.get('/api/admin/invoices', verifyAdmin, async (req, res) => {
    try {
        const filter = {};
        if (MONTH_PATTERN.test(String(req.query.month || ''))) filter.month = req.query.month;
        const invoices = await Invoice.find(filter).sort({ month: -1, room_number: 1 });
        res.json(invoices.map(inv => ({ ...inv.toObject(), overdue: isOverdue(inv) })));
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// --- POST /api/admin/invoices/:id/review (ตรวจสอบการชำระบิล) ---
// body: { action: 'APPROVED' } หรือ { action: 'REJECTED', reason }
app.post('/api/admin/invoices/:id/review', verifyAdmin, async (req, res) => {
    const { action } = req.body;
    const reason = String(req.body.reason || '').trim();

    if (!['APPROVED', 'REJECTED'].includes(action)) {
        return res.status(400).json({ message: 'action ต้องเป็น APPROVED หรือ REJECTED' });
    }
    if (action === 'REJECTED' && !reason) {
        return res.status(400).json({ message: 'กรุณาระบุเหตุผลที่ปฏิเสธ' });
    }

    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'ไม่พบบิล' });
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ message: 'ไม่พบบิล' });
        if (invoice.status !== 'PAID') {
            return res.status(400).json({ message: 'ตรวจสอบได้เฉพาะบิลที่ชำระแล้ว (รอตรวจสอบ)' });
        }

        const review = { action, reason: reason || undefined, reviewed_by: req.user.username, reviewed_at: new Date() };
        if (action === 'APPROVED') {
            invoice.status = 'CONFIRMED';
            invoice.review = review;
        } else {
            // ปฏิเสธ: คืนเงิน แล้วให้บิลกลับเป็นค้างชำระ นิสิตชำระใหม่ได้
            invoice.rejections.push({
                reason,
                payment_ref: invoice.payment?.ref,
                refund_ref: makePaymentRef('REFUND'),
                reviewed_by: req.user.username,
                at: new Date()
            });
            invoice.status = 'UNPAID';
            invoice.payment = undefined;
            invoice.review = review;
        }
        await invoice.save();

        res.json({
            message: action === 'APPROVED'
                ? 'อนุมัติการชำระบิลแล้ว'
                : `ปฏิเสธการชำระบิลแล้ว ระบบคืนเงิน ${invoice.amount} บาท บิลกลับเป็นค้างชำระ`,
            invoice: { ...invoice.toObject(), overdue: isOverdue(invoice) }
        });
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
// --- สร้างนิสิตใหม่ (ใช้ร่วมกันระหว่างสมัครเองและ admin เพิ่ม) ---
const STUDENT_FIELDS = ['student_code', 'full_name', 'email', 'phone', 'gender', 'faculty', 'study_year', 'username', 'password'];

const createStudent = async (body, res) => {
    const data = {};
    for (const key of STUDENT_FIELDS) data[key] = String(body[key] ?? '').trim();

    const missing = STUDENT_FIELDS.filter(key => !data[key]);
    if (missing.length) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
    }
    if (!['MALE', 'FEMALE'].includes(data.gender)) {
        return res.status(400).json({ message: 'เพศไม่ถูกต้อง' });
    }
    const studyYear = Number(data.study_year);
    if (!Number.isInteger(studyYear) || studyYear < 1 || studyYear > 8) {
        return res.status(400).json({ message: 'ชั้นปีต้องเป็นตัวเลข 1-8' });
    }
    if (data.password.length < 6) {
        return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    try {
        // เช็คซ้ำ
        const existing = await Student.findOne({
            $or: [{ student_code: data.student_code }, { email: data.email }, { username: data.username }]
        });
        if (existing) {
            return res.status(400).json({ message: 'รหัสนิสิต, อีเมล หรือ username ซ้ำ' });
        }

        const password_hash = await bcrypt.hash(data.password, 10);

        const student = new Student({
            student_code: data.student_code,
            full_name: data.full_name,
            email: data.email,
            phone: data.phone,
            gender: data.gender,
            faculty: data.faculty,
            study_year: studyYear,
            username: data.username,
            password_hash,
            created_at: new Date()
        });
        await student.save();

        const { password_hash: _, ...safeStudent } = student.toObject(); // ไม่ส่ง password กลับ
        return res.status(201).json({ message: 'เพิ่มนิสิตสำเร็จ', student: safeStudent });
    } catch (err) {
        return res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
};

// --- POST /api/register (นิสิตสมัครสมาชิกเอง) ---
app.post('/api/register', (req, res) => createStudent(req.body, res));

// --- POST /api/admin/students (เพิ่มนิสิต) ---
app.post('/api/admin/students', verifyAdmin, (req, res) => createStudent(req.body, res));

// --- GET /api/admin/dashboard ---
app.get('/api/admin/dashboard', verifyAdmin, async (req, res) => {
    try {
        const [
            totalStudents,
            totalRooms,
            activeRooms,
            pendingRes,
            paidRes,
            confirmedRes,
            rejectedRes,
            cancelledRes,
            recentRes,
            paidInvoices
        ] = await Promise.all([
            Student.countDocuments(),
            Room.countDocuments(),
            Room.countDocuments({ status: 'ACTIVE' }),
            Booking.countDocuments({ status: 'PENDING' }),
            Booking.countDocuments({ status: 'PAID' }),
            Booking.countDocuments({ status: 'CONFIRMED' }),
            Booking.countDocuments({ status: 'REJECTED' }),
            Booking.countDocuments({ status: 'CANCELLED' }),
            Booking.find().sort({ created_at: -1 }).limit(5),
            Invoice.countDocuments({ status: 'PAID' })
        ]);

        res.json({
            totalStudents,
            totalRooms,
            activeRooms,
            occupiedRooms: totalRooms - activeRooms,
            pendingRes,
            paidRes,
            confirmedRes,
            rejectedRes,
            cancelledRes,
            recentRes,
            paidInvoices
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

// --- เพิ่มสถานะใหม่ (PAID, REJECTED) ลงใน $jsonSchema validator ของ collection reservations ---
// แก้เฉพาะ enum ของ status ส่วนอื่นของ validator คงเดิม
const syncReservationStatusValidator = async () => {
    const db = mongoose.connection.db;
    const [info] = await db.listCollections({ name: 'reservations' }).toArray();
    const schema = info?.options?.validator?.$jsonSchema;
    const statusEnum = schema?.properties?.status?.enum;
    if (!statusEnum) return; // ไม่มี validator ก็ไม่ต้องทำอะไร

    const required = Booking.schema.path('status').enumValues;
    const missing = required.filter(s => !statusEnum.includes(s));
    if (!missing.length) return;

    schema.properties.status.enum = [...statusEnum, ...missing];
    await db.command({ collMod: 'reservations', validator: { $jsonSchema: schema } });
    console.log(`✅ reservations validator: เพิ่มสถานะ ${missing.join(', ')}`);
};

// --- บิลที่ออกก่อนมีระบบค่าน้ำ/ไฟ: เติม room_id และรายการค่าห้อง (items) ให้ ---
const backfillInvoiceItems = async () => {
    const old = await Invoice.find({ $or: [{ room_id: null }, { items: { $size: 0 } }] });
    for (const inv of old) {
        if (!inv.room_id) {
            const booking = await Booking.findById(inv.booking_id);
            if (booking) inv.room_id = booking.room_id;
        }
        if (!inv.items?.length) inv.items = [rentItem(inv.amount)];
        await inv.save();
    }
    if (old.length) console.log(`✅ invoices: อัปเดตบิลรูปแบบเก่า ${old.length} รายการ`);
};

// --- Connect MongoDB ---
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('MongoDB Connected!');
        await hashExistingPasswords();
        await syncAdminFromEnv();
        await syncReservationStatusValidator();
        await backfillInvoiceItems();
    })
    .catch(err => console.error('MongoDB Error:', err));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));