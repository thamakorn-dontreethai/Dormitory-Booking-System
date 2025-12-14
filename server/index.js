import express from "express";
import sql from "mssql";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const app = express();

app.use(cors({
  origin: process.env.WEB_ORIGIN,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

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

const poolConnect = pool.connect();

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || "8h"
  });

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

app.get("/api/building-stats", async (_req, res) => {
  try {
    await poolConnect;
    const { recordset } = await pool.request().query(`
      SELECT
        b.building_id,
        b.building_name,
        b.gender_type,
        COUNT(r.room_id) AS total_rooms,
        SUM(CASE WHEN r.status = 'ACTIVE' THEN 1 ELSE 0 END) AS vacant_rooms,
        SUM(CASE WHEN r.status <> 'ACTIVE' THEN 1 ELSE 0 END) AS full_rooms
      FROM dbo.buildings b
      LEFT JOIN dbo.rooms r ON b.building_id = r.building_id
      GROUP BY b.building_id, b.building_name, b.gender_type
      ORDER BY b.building_id
    `);
    res.json(recordset);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Missing credentials" });
  }

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

    if (!rs.recordset.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const u = rs.recordset[0];
    if (u.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = signToken({
      sub: u.student_id,
      role: "student",
      name: u.full_name
    });

    res.json({
      token,
      user: {
        student_id: u.student_id,
        student_code: u.student_code,
        full_name: u.full_name,
        gender: u.gender,
        role: "student"
      }
    });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

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

    if (!rs.recordset.length) {
      return res.status(401).json({ message: "Expired token" });
    }

    res.json({ user: rs.recordset[0] });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/my-reservation", requireAuth, async (req, res) => {
  try {
    await poolConnect;
    const rs = await pool.request()
      .input("sid", sql.Int, req.user.sub)
      .query(`
        SELECT TOP 1
          res.room_number,
          res.status,
          rt.type_name,
          rt.capacity,
          rt.monthly_price
        FROM dbo.reservations res
        JOIN dbo.rooms r ON res.room_id = r.room_id
        JOIN dbo.room_types rt ON r.type_id = rt.type_id
        WHERE res.student_id = @sid
          AND res.status IN ('PENDING', 'CONFIRMED')
      `);

    res.json({ reservation: rs.recordset[0] || null });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/", (_req, res) => {
  res.send("Server is running");
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
