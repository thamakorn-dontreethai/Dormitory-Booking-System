import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './HomePage.css';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

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
            <li>
              <Link to="/Admin">
                <i className="fa-solid fa-user-gear"></i> ผู้ดูแลระบบ
              </Link>
            </li>
          </ul>

          <div className="fee-section">
            <h4><i className="fa-solid fa-hand-holding-dollar"></i> รายละเอียดค่าหอ</h4>
            <p>ห้อง 2 คน (แอร์) <span>4000.00/เทอม</span></p>
            <p>ห้อง 2 คน (พัดลม) <span>3000.00/เทอม</span></p>
            <p>ห้อง 4 คน (แอร์) <span>2500.00/เทอม</span></p>
            <p>ห้อง 4 คน (พัดลม) <span>1500.00/เทอม</span></p>
          </div>
        </nav>

        {/* 2) เฮดเดอร์สีม่วง (อยู่ข้างเมนูซ้าย) */}
        <header className="main-header">
          <div>
            <h1><i className="fa-solid fa-pumpkin"></i> Dormitory Student System</h1>
            <span className="subtitle">ระบบจองหอพักนิสิต</span>
          </div>
        </header>

        {/* 3) เนื้อหากลาง */}
        <main className="center-content card">
          <h2><i className="fa-solid fa-bullhorn"></i> ประชาสัมพันธ์</h2>

          <div className="announcement-card">
            <h3>เปิดรับจองหอพักนิสิต ภาคเรียนที่ 1/2569</h3>
            <div className="date">31 มีนาคม 2569</div>
            <p>ระบบเปิดให้นิสิตชั้นปีที่ 1–4 จองห้องพักสำหรับภาคเรียนที่ 1/2569 ได้แล้วตั้งแต่วันนี้เป็นต้นไป จนถึงวันที่ 30 เมษายน 2569 หรือจนกว่าห้องจะเต็ม</p>
          </div>

          <div className="announcement-card">
            <h3>ประกาศผลการจองหอพัก ภาคเรียนที่ 2/2568</h3>
            <div className="date">15 มีนาคม 2569</div>
            <p>นิสิตที่ยืนยันการจองและชำระเงินเรียบร้อยแล้ว สามารถตรวจสอบสถานะห้องพักของท่านได้ในระบบ หากมีข้อสงสัยติดต่อเจ้าหน้าที่หอพักได้ในวันและเวลาราชการ</p>
          </div>

          <div className="announcement-card">
            <h3>แนวปฏิบัติการเข้าพักหอพักนิสิต ปีการศึกษา 2569</h3>
            <div className="date">1 มีนาคม 2569</div>
            <p>นิสิตที่เข้าพักใหม่ต้องนำเอกสารยืนยันตัวตน (บัตรประชาชน + บัตรนิสิต) มาแสดงที่สำนักงานหอพักในวันเข้าพัก พร้อมชำระค่าประกันความเสียหายตามอัตราที่กำหนด</p>
          </div>


        </main>
      </div>
    </div>
  );
}
