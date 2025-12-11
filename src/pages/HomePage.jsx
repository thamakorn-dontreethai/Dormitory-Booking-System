import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './HomePage.css';
import { Link } from 'react-router-dom';

const API_URL = 'http://localhost:3001';

export default function HomePage() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/building-stats`)
      .then(res => { setStats(res.data); setLoading(false); })
      .catch(err => { console.error("Error fetching building stats:", err); setLoading(false); });
  }, []);

  const maleBuildings = stats.filter(b => b.gender_type === 'MALE');
  const femaleBuildings = stats.filter(b => b.gender_type === 'FEMALE');

  return (
    <div className="homepage-content-wrapper">
      <div className="page-container">
        {/* 1) เมนูซ้าย */}
        <nav className="left-sidebar card">
          <h3><i className="fa-solid fa-bars"></i> เมนูหลัก</h3>
          <ul>
            <li>
              <a href="#" className="active">
                <i className="fa-solid fa-house"></i> หน้าหลัก
              </a>
            </li>
            <li>
              <Link to="/LoginPage">
                <i className="fa-solid fa-bed" /> จองห้องพัก
              </Link>
            </li>
          </ul>

          <div className="fee-section">
            <h4><i className="fa-solid fa-hand-holding-dollar"></i> รายละเอียดค่าหอ</h4>
            <p>ห้อง 2 คน (แอร์) <span>11000.00/เทอม</span></p>
            <p>ห้อง 2 คน (พัดลม) <span>9000.00/เทอม</span></p>
            <p>ห้อง 4 คน (แอร์) <span>5500.00/เทอม</span></p>
            <p>ห้อง 4 คน (พัดลม) <span>4500.00/เทอม</span></p>
          </div>
        </nav>

        {/* 2) เฮดเดอร์สีม่วง (อยู่ข้างเมนูซ้าย) */}
        <header className="main-header">
          <div>
            <h1><i className="fa-solid fa-pumpkin"></i> Kasetsart University Sriracha Campus</h1>
            <span className="subtitle">ระบบจองหอพักนิสิต (👻)</span>
          </div>
        </header>

        {/* 3) เนื้อหากลาง */}
        <main className="center-content card">
          <h2><i className="fa-solid fa-bullhorn"></i> ประชาสัมพันธ์</h2>

          <div className="announcement-card">
            <h3>ประกาศปิดปรับปรุงระบบจองหอพัก</h3>
            <div className="date">1 พฤศจิกายน 2568</div>
            <p>เนื่องด้วย... จะมีการปิดปรับปรุงระบบในวันพรุ่งนี้ เวลา 00:00 - 02:00 น. เพื่อเพิ่มประสิทธิภาพการทำงาน ขออภัยในความไม่สะดวก</p>
          </div>

          <div className="announcement-card">
            <h3>กำหนดการเปิดจองหอพัก ภาคเรียนที่ 2/2568</h3>
            <div className="date">25 ตุลาคม 2568</div>
            <p>ระบบจะเปิดให้นิสิตชั้นปีที่ 1-3 จองห้องพักได้ในวันที่ 15 พฤศจิกายน 2568 เวลา 9:00 น. เป็นต้นไป...</p>
          </div>

          
        </main>
      </div>
    </div>
  );
}
