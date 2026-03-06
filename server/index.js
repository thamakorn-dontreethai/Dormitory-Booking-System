// index.js
import express from "express";
import sql from "mssql";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors({
  origin: 'http://localhost:5173',   // เปลี่ยนให้ตรงกับพอร์ต/โดเมนของเว็บคุณ
  credentials: true,                 // ถ้าใช้คุกกี้/Authorization header
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(cookieParser());

// แนะนำให้ระบุ origin ของเว็บคุณแทน true (เพื่อความปลอดภัย)
app.use(cors({
  origin: process.env.WEB_ORIGIN || true, // เช่น 'http://localhost:5173'
  credentials: true
}));

/* =========== DB POOL =========== */
const pool = new sql.ConnectionPool({
  server: process.env.MSSQL_SERVER,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    port: Number(process.env.MSSQL_PORT || 1433)
  }
});

// ให้แน่ใจว่า connect เสร็จก่อนใช้ทุก endpoint
const poolConnect = pool.connect();

/* =========== JWT HELPERS / MIDDLEWARE =========== */
const JWT_SECRET = process.env.JWT_SECRET || "MY_SUPER_SECRET_KEY_123";
const signToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || "8h" });

function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

/* =========== API: HOME PAGE STATS (ยังใช้ได้) =========== */
app.get("/api/building-stats", async (req, res) => {
  try {
    await poolConnect;
    const q = `
      SELECT
        b.building_id,
        b.building_name,
        b.gender_type,
        COUNT(r.room_id) AS total_rooms,
        SUM(CASE WHEN r.status = 'ACTIVE' THEN 1 ELSE 0 END) AS vacant_rooms,
        SUM(CASE WHEN r.status <> 'ACTIVE' THEN 1 ELSE 0 END) AS full_rooms
      FROM dbo.buildings AS b
      LEFT JOIN dbo.rooms AS r ON b.building_id = r.building_id
      GROUP BY b.building_id, b.building_name, b.gender_type
      ORDER BY b.building_id;
    `;
    const { recordset } = await pool.request().query(q);
    res.json(recordset);
  } catch (err) {
    console.error("SQL Error:", err);
    res.status(500).json({ success: false, message: "Server error while fetching building stats" });
  }
});

/* =========== API: ROOMS (filters) (ยังใช้ได้) =========== */
app.get("/api/rooms", async (req, res) => {
  const { gender, capacity, maxPrice, query: qtxt } = req.query;
  try {
    await poolConnect;
    const request = pool.request();
    let q = `
      SELECT
        r.room_id, r.room_number, r.gender_restriction, r.status,
        b.building_code, b.building_name,
        rt.type_code, rt.type_name, rt.capacity, rt.monthly_price, rt.cooling_type
      FROM dbo.rooms r
      JOIN dbo.room_types rt ON r.type_id = rt.type_id
      JOIN dbo.buildings b  ON r.building_id = b.building_id
    `;
    const where = [];
    where.push("r.status = 'ACTIVE'");
    if (gender && gender !== "ทั้งหมด") {
      where.push("r.gender_restriction = @gender");
      request.input("gender", sql.VarChar(10), String(gender).toUpperCase());
    }
    if (capacity && capacity !== "ทั้งหมด") {
      where.push("rt.capacity = @capacity");
      request.input("capacity", sql.Int, Number(capacity));
    }
    if (maxPrice) {
      where.push("rt.monthly_price <= @maxPrice");
      request.input("maxPrice", sql.Int, Number(maxPrice));
    }
    if (qtxt) {
      where.push("(b.building_name LIKE @qtxt OR rt.type_name LIKE @qtxt)");
      request.input("qtxt", sql.NVarChar, `%${qtxt}%`);
    }
    if (where.length) q += " WHERE " + where.join(" AND ");
    const { recordset } = await request.query(q);
    res.json(recordset);
  } catch (err) {
    console.error("SQL Error:", err);
    res.status(500).json({ message: "Error fetching rooms" });
  }
});

/* =========== API: LOGIN (ยังใช้ได้) =========== */
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: "Username and password are required" });
  try {
    await poolConnect;
    const rs = await pool.request()
      .input("username", sql.NVarChar, username)
      .query(`
        SELECT TOP 1
          student_id, student_code, full_name, gender, username, password
        FROM dbo.students
        WHERE username = @username
      `);
    if (!rs.recordset.length)
      return res.status(404).json({ success: false, message: "User not found" });
    const u = rs.recordset[0];
    if (u.password !== password)
      return res.status(401).json({ success: false, message: "Invalid password" });
    const token = signToken({
      sub: u.student_id,
      role: "student",
      name: u.full_name,
      gender: u.gender
    });
    res.json({
      success: true,
      message: "Login success",
      token,
      user: {
        student_id: u.student_id,
        student_code: u.student_code,
        username: u.username,
        full_name: u.full_name,
        gender: u.gender,
        role: "student"
      }
    });
  } catch (err) {
    console.error("Login API Error:", err);
    res.status(500).json({ success: false, message: err?.originalError?.message || "Server error" });
  }
});

/* =========== API: LOGOUT (ยังใช้ได้) =========== */
app.post("/api/logout", (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});

/* =========== API: ME (อ่านโปรไฟล์จาก token) (ยังใช้ได้) =========== */
app.get("/api/me", requireAuth, async (req, res) => {
  try {
    await poolConnect;
    const rs = await pool.request()
      .input("sid", sql.Int, req.user.sub)
      .query(`
        SELECT TOP 1
          student_id, student_code, username, full_name, gender, faculty, study_year
        FROM dbo.students
        WHERE student_id = @sid
      `);
    const u = rs.recordset[0];
    if (!u) return res.status(401).json({ message: "expired" });
    return res.json({
      user: {
        student_id: u.student_id,
        student_code: u.student_code,
        username: u.username,
        full_name: u.full_name,
        gender: u.gender,
        faculty: u.faculty,
        study_year: u.study_year,
        role: "student",
      }
    });
  } catch (err) {
    console.error("ME Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========== [API แก้ไข] GET MY CURRENT RESERVATION =========== */
app.get("/api/my-reservation", requireAuth, async (req, res) => {
  const studentId = req.user.sub;

  try {
    await poolConnect;
    const reservation = await pool.request()
      .input("studentId_fetch", sql.Int, studentId)
      .query(`
        SELECT TOP 1
          res.room_id, res.room_number,
          res.student_code, res.full_name,
          res.status,
          rt.type_name, rt.capacity, rt.monthly_price, rt.cooling_type
        FROM dbo.reservations res
        JOIN dbo.rooms r ON res.room_id = r.room_id
        JOIN dbo.room_types rt ON r.type_id = rt.type_id
        WHERE res.student_id = @studentId_fetch AND res.status IN ('PENDING', 'CONFIRMED')
      `);
  
    if (reservation.recordset.length > 0) {
      res.json({ reservation: reservation.recordset[0] });
    } else {
      res.json({ reservation: null });
    }

  } catch (err) {
    console.error("Get My Reservation Error:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์", error: err.message });
  }
});

/* =========== [API ใหม่] GET ALL RESERVATIONS FOR A ROOM =========== */
app.get("/api/reservations/by-room", requireAuth, async (req, res) => {
  const { room_id } = req.query;
  if (!room_id) {
    return res.status(400).json({ message: "Room ID is required" });
  }

  try {
    await poolConnect;
    const occupants = await pool.request()
      .input("roomId", sql.Int, room_id)
      .query(`
        SELECT 
          res.room_number,
          res.student_code,
          res.full_name,
          res.status
        FROM dbo.reservations res
        WHERE res.room_id = @roomId AND res.status IN ('PENDING', 'CONFIRMED')
      `);
    
    res.json({ reservations: occupants.recordset });

  } catch (err) {
    console.error("Get Reservations by Room Error:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์", error: err.message });
  }
});

/* =========== [API ใหม่] CONFIRM PAYMENT (SIMULATED) =========== */
app.patch("/api/my-reservation/confirm", requireAuth, async (req, res) => {
  const studentId = req.user.sub;

  try {
    await poolConnect;

    // 1. อัปเดตสถานะการจอง
    const updateResult = await pool.request()
      .input("sid", sql.Int, studentId)
      .query(`
        UPDATE dbo.reservations 
        SET status = 'CONFIRMED'
        WHERE student_id = @sid AND status = 'PENDING'
      `);

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบการจองที่รอการชำระเงิน" });
    }
    
    // 2. ดึงข้อมูลการจองที่อัปเดตแล้วส่งกลับไป
    const reservation = await pool.request()
      .input("studentId_fetch", sql.Int, studentId)
      .query(`
        SELECT TOP 1
          res.room_id, res.room_number,
          res.student_code, res.full_name,
          res.status,
          rt.type_name, rt.capacity, rt.monthly_price, rt.cooling_type
        FROM dbo.reservations res
        JOIN dbo.rooms r ON res.room_id = r.room_id
        JOIN dbo.room_types rt ON r.type_id = rt.type_id
        WHERE res.student_id = @studentId_fetch AND res.status = 'CONFIRMED'
      `);

    res.json({ 
      success: true, 
      message: "ชำระเงินสำเร็จ!", 
      reservation: reservation.recordset[0]
    });

  } catch (err) {
    console.error("Confirm Payment Error:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์", error: err.message });
  }
});

app.delete("/api/my-reservation", requireAuth, async (req, res) => {
  const studentId = req.user.sub;

  try {
    await poolConnect;

    // 1. ลบการจองที่ยัง Active อยู่
    const result = await pool.request()
      .input("sid", sql.Int, studentId)
      .query(`
        DELETE FROM dbo.reservations 
        WHERE student_id = @sid AND status IN ('PENDING', 'CONFIRMED')
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลการจองที่สามารถยกเลิกได้" });
    }
    
    res.json({ success: true, message: "ยกเลิกการจองสำเร็จ" });

  } catch (err) {
    console.error("Cancel Reservation Error:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์", error: err.message });
  }
});

/* =========== [API แก้ไข] CREATE RESERVATION =========== */
app.post("/api/reservations", requireAuth, async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { roomId } = req.body;
  const studentId = req.user.sub;

  if (!roomId) {
    return res.status(400).json({ success: false, message: "Room ID is required" });
  }

  try {
    await poolConnect;
    
    const existingBookingCheck = await pool.request()
      .input("studentId", sql.Int, studentId)
      .query(`
        SELECT COUNT(*) AS count 
        FROM dbo.reservations 
        WHERE student_id = @studentId AND status IN ('PENDING', 'CONFIRMED')
      `);

    if (existingBookingCheck.recordset[0].count > 0) {
      return res.status(409).json({
        success: false, 
        message: "คุณมีการจองที่ยังดำเนินการอยู่แล้ว ไม่สามารถจองซ้ำได้" 
      });
    }

    const roomStatusCheck = await pool.request()
      .input("roomId_check", sql.Int, roomId)
      .query(`
        SELECT 
          r.room_number,
          rt.capacity,
          (SELECT COUNT(*) FROM dbo.reservations WHERE room_id = @roomId_check AND status IN ('PENDING', 'CONFIRMED')) AS booked_count
        FROM dbo.rooms r
        JOIN dbo.room_types rt ON r.type_id = rt.type_id
        WHERE r.room_id = @roomId_check
      `);

    if (roomStatusCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบห้องพักนี้" });
    }

    const roomInfo = roomStatusCheck.recordset[0];

    if (roomInfo.booked_count >= roomInfo.capacity) {
      return res.status(409).json({ 
        success: false, 
        message: "ขออภัย ห้องนี้ถูกจองเต็มแล้ว" 
      });
    }

    const studentInfoResult = await pool.request()
      .input("studentId_fetch", sql.Int, studentId)
      .query(`SELECT student_code, full_name FROM dbo.students WHERE student_id = @studentId_fetch`);
    
    if (studentInfoResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนักศึกษา" });
    }
    const studentInfo = studentInfoResult.recordset[0];


    await pool.request()
      .input("studentId_insert", sql.Int, studentId)
      .input("studentCode_insert", sql.NVarChar, studentInfo.student_code)
      .input("fullName_insert", sql.NVarChar, studentInfo.full_name)
      .input("roomId_insert", sql.Int, roomId)
      .input("roomNumber_insert", sql.NVarChar, roomInfo.room_number)
      .query(`
        INSERT INTO dbo.reservations 
          (student_id, student_code, full_name, room_id, room_number, status, created_at, start_date, end_date)
        VALUES 
          (@studentId_insert, @studentCode_insert, @fullName_insert, @roomId_insert, @roomNumber_insert, 'PENDING', GETDATE(), GETDATE(), DATEADD(month, 5, GETDATE()))
      `);

    const newReservation = await pool.request()
      .input("studentId_new", sql.Int, studentId)
      .query(`
        SELECT 
          res.room_number,
          res.student_code,
          res.full_name,
          res.status
        FROM dbo.reservations res
        WHERE res.student_id = @studentId_new AND res.status = 'PENDING'
      `);

    res.status(201).json({ 
      success: true, 
      message: "ทำการจองห้องพักสำเร็จ! กรุณารอการยืนยัน",
      reservation: newReservation.recordset[0]
    });

  } catch (err) {
    console.error("Reservation Error:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์", error: err.message });
  }
});

// GET /api/buildings?gender=MALE|FEMALE
app.get('/api/buildings', async (req, res) => {
  try {
    await poolConnect;
    const gender = String(req.query.gender || '').toUpperCase();
    const rs = await pool.request()
      .input('g', sql.VarChar, gender)
      .query(`
        SELECT building_id, building_name, gender_type
        FROM dbo.buildings
        WHERE (@g='' OR gender_type=@g)
        ORDER BY building_id
      `);
    res.json(rs.recordset);
  } catch (err) {
    console.error('buildings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/rooms/by-building?building_id=1
app.get("/api/rooms/by-building", async (req, res) => {
  try {
    await poolConnect;
    const buildingId = Number(req.query.building_id);
    if (!buildingId) {
      return res.status(400).json({ message: "building_id is required" });
    }

    const q = `
      SELECT
        r.room_id, r.room_number, r.gender_restriction, r.status,
        rt.type_name, rt.capacity, rt.monthly_price, rt.cooling_type,
        (SELECT COUNT(*) FROM dbo.reservations res WHERE res.room_id = r.room_id AND res.status IN ('PENDING', 'CONFIRMED')) AS booked_count
      FROM dbo.rooms r
      JOIN dbo.room_types rt ON r.type_id = rt.type_id
      WHERE r.building_id = @bid
      ORDER BY TRY_CAST(r.room_number AS INT), r.room_number
    `;

    const { recordset } = await pool.request()
      .input("bid", sql.Int, buildingId)
      .query(q);

    res.json(recordset);
  } catch (err) {
    console.error("by-building Error:", err);
    res.status(500).json({ message: err?.originalError?.message || "Server error" });
  }
});

/* =========== ADMIN DASHBOARD STATS (ยังใช้ได้) =========== */
app.get("/api/admin/stats", async (req, res) => {
  try {
    await poolConnect;
    const q = `
      SELECT 
        (SELECT COUNT(*) FROM dbo.rooms WHERE status='ACTIVE') AS active_rooms,
        (SELECT COUNT(*) FROM dbo.students) AS total_students,
        (SELECT COUNT(*) FROM dbo.reservations WHERE status='CONFIRMED') AS staying,
        (SELECT COUNT(*) FROM dbo.reservations WHERE status='PENDING') AS pending
    `;
    const { recordset } = await pool.request().query(q);
    res.json(recordset[0]);
  } catch (err) {
    console.error("SQL Error:", err);
    res.status(500).json({ success: false, message: "Server error while fetching stats" });
  }
});

/* =========== HEALTH CHECK =========== */
app.get("/", (_req, res) => res.send("Server is running..."));

/* =========== START SERVER =========== */
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

