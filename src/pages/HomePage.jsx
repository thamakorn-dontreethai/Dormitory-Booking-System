import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './HomePage.css';
import { useNavigate } from 'react-router-dom';
import { getStudentSession, isAdminLoggedIn, logoutStudent } from '../utils/auth';

const API_URL = import.meta.env.VITE_API_URL || '';
const THEME_KEY = 'hp-theme';

const ROOM_RATES = [
  { name: 'ห้อง 2 คน', cooling: 'แอร์', price: 4000 },
  { name: 'ห้อง 2 คน', cooling: 'พัดลม', price: 3000 },
  { name: 'ห้อง 4 คน', cooling: 'แอร์', price: 2500 },
  { name: 'ห้อง 4 คน', cooling: 'พัดลม', price: 1500 },
];

const ANNOUNCEMENTS = [
  {
    tag: 'เปิดรับจอง',
    title: 'เปิดรับจองหอพักนิสิต ภาคเรียนที่ 1/2569',
    date: '31 มี.ค. 2569',
    body: 'ระบบเปิดให้นิสิตชั้นปีที่ 1–4 จองห้องพักสำหรับภาคเรียนที่ 1/2569 ได้แล้วตั้งแต่วันนี้เป็นต้นไป จนถึงวันที่ 30 เมษายน 2569 หรือจนกว่าห้องจะเต็ม',
  },
  {
    tag: 'ประกาศผล',
    title: 'ประกาศผลการจองหอพัก ภาคเรียนที่ 2/2568',
    date: '15 มี.ค. 2569',
    body: 'นิสิตที่ยืนยันการจองและชำระเงินเรียบร้อยแล้ว สามารถตรวจสอบสถานะห้องพักของท่านได้ในระบบ หากมีข้อสงสัยติดต่อเจ้าหน้าที่หอพักได้ในวันและเวลาราชการ',
  },
];

const minRate = Math.min(...ROOM_RATES.map(r => r.price));

const BOOKING_STATUS = {
  PENDING: { text: 'รอชำระค่าจอง', tone: 'warn' },
  PAID: { text: 'รอเจ้าหน้าที่ตรวจสอบ', tone: 'info' },
  CONFIRMED: { text: 'ยืนยันแล้ว', tone: 'ok' },
};

// ธีมเริ่มต้น: ที่เคยเลือกไว้ > ตามการตั้งค่าเครื่อง
const initialTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ใช้ค่าตามเครื่อง */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const scrollToId = (id) => (e) => {
  e?.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [user, setUser] = useState(() => getStudentSession());
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [booking, setBooking] = useState(null); // การจองของฉัน (เมื่อ login)
  const [bills, setBills] = useState(null);     // บิลของฉัน (เมื่อ login)

  // บริการที่ต้อง login: ยังไม่ login -> ไปหน้า login แล้วกลับมาหน้าที่กดไว้
  const goStudentPage = (path) => () => {
    if (getStudentSession()) navigate(path);
    else navigate('/LoginPage', { state: { from: path } });
  };
  const goAdmin = (e) => {
    e?.preventDefault();
    navigate(isAdminLoggedIn() ? '/Admin' : '/AdminLogin');
  };
  const handleLogout = () => {
    logoutStudent();
    setUser(null);
    setBooking(null);
    setBills(null);
  };
  const navTo = (id) => (e) => {
    setMenuOpen(false);
    scrollToId(id)(e);
  };
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ไม่จำก็ได้ */ }
  };

  useEffect(() => {
    axios.get(`${API_URL}/api/building-stats`)
      .then(res => setStats(Array.isArray(res.data) ? res.data : []))
      .catch(() => setStats([]));
  }, []);

  // login แล้ว: ดึงสถานะการจองและบิลมาแสดงบนปุ่มหลัก
  useEffect(() => {
    if (!user) return;
    axios.get(`${API_URL}/api/my-reservation`)
      .then(res => setBooking(res.data?.reservation || null))
      .catch(() => setBooking(null));
    axios.get(`${API_URL}/api/my-invoices`)
      .then(res => setBills(Array.isArray(res.data) ? res.data : []))
      .catch(() => setBills(null));
  }, [user]);

  const maleCount = stats.filter(b => b.gender_type === 'MALE').length;
  const femaleCount = stats.filter(b => b.gender_type === 'FEMALE').length;

  const unpaidBills = (bills || []).filter(b => b.status === 'UNPAID');
  const unpaidTotal = unpaidBills.reduce((s, b) => s + b.amount, 0);
  const bookingStatus = booking && BOOKING_STATUS[booking.status];
  // มีการจองแล้ว: ยังไม่จ่ายค่าจอง -> หน้าชำระ, จ่ายแล้ว -> ห้องของฉัน
  const myRoomPath = !booking ? '/BookingPage' : booking.status === 'PENDING' ? '/PaymentPage' : '/BillsPage';

  // ข้อความสถานะบนปุ่มหลัก
  const bookingHint = !user
    ? 'เลือกอาคาร ดูห้องว่าง และจองออนไลน์'
    : booking
      ? <>ห้อง {booking.room_number} · <span className={`hp-pill ${bookingStatus?.tone}`}>{bookingStatus?.text || booking.status}</span></>
      : 'ยังไม่มีการจอง · เลือกห้องได้เลย';
  const billsHint = !user
    ? 'ดูบิลรายเดือน จ่ายผ่าน PromptPay หรือบัตร'
    : bills === null
      ? 'กำลังโหลด...'
      : unpaidBills.length
        ? <><span className="hp-pill warn">ค้างชำระ {unpaidBills.length} บิล</span> รวม {unpaidTotal.toLocaleString('th-TH')} บาท</>
        : <><span className="hp-pill ok">ไม่มียอดค้าง</span> ดูประวัติบิลได้</>;

  return (
    <div className="hp" data-theme={theme}>
      {/* ===== Navbar ===== */}
      <nav className="hp-nav">
        <div className="hp-nav-inner">
          <a href="#top" className="hp-brand" onClick={navTo('top')}>
            <span className="hp-brand-mark" aria-hidden="true"><i className="fa-solid fa-house-chimney"></i></span>
            <span className="hp-brand-name">หอพักนิสิต</span>
          </a>

          <div className="hp-nav-tools">
            <button
              className="hp-icon-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
              title={theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}
            >
              <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <button
              className="hp-icon-btn hp-menu-toggle"
              aria-label="เปิดเมนู"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(o => !o)}
            >
              <i className={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
            </button>
          </div>

          <div className={`hp-nav-menu ${menuOpen ? 'open' : ''}`}>
            <ul className="hp-nav-links">
              <li><a href="#news" onClick={navTo('news')}>ประกาศ</a></li>
              <li><a href="#rates" onClick={navTo('rates')}>ค่าหอพัก</a></li>
              <li><a href="/Admin" onClick={goAdmin}>เจ้าหน้าที่</a></li>
            </ul>
            <div className="hp-nav-auth">
              {user ? (
                <>
                  <span className="hp-user" title={user.full_name}>
                    <span className="hp-avatar">{(user.full_name || '?').trim().charAt(0)}</span>
                    <span className="hp-user-name">{user.full_name}</span>
                  </span>
                  <button className="hp-btn ghost" onClick={handleLogout}>ออกจากระบบ</button>
                </>
              ) : (
                <button className="hp-btn solid" onClick={() => navigate('/LoginPage')}>
                  <i className="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบ
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ===== Hero เต็มจอ + ปุ่มหลัก 2 ปุ่ม ===== */}
      <header className="hp-hero" id="top">
        <div className="hp-hero-bg" aria-hidden="true">
          <span className="hp-blob a"></span>
          <span className="hp-blob b"></span>
          <span className="hp-blob c"></span>
        </div>

        <div className="hp-hero-inner">
          <p className="hp-greet">
            {user ? <>สวัสดี, <b>{user.full_name}</b> 👋</> : 'ยินดีต้อนรับสู่ระบบหอพักนิสิต 👋'}
          </p>
          <h1>วันนี้ต้องการทำอะไร?</h1>

          <div className="hp-actions">
            <button className="hp-action" onClick={goStudentPage(myRoomPath)}>
              <span className="hp-action-icon"><i className={`fa-solid ${booking ? 'fa-door-open' : 'fa-bed'}`}></i></span>
              <span className="hp-action-text">
                <strong>{booking ? 'ห้องของฉัน' : 'จองห้องพัก'}</strong>
                <small>{bookingHint}</small>
              </span>
              <i className="fa-solid fa-arrow-right hp-action-go"></i>
            </button>

            <button className="hp-action" onClick={goStudentPage('/BillsPage')}>
              <span className="hp-action-icon alt"><i className="fa-solid fa-receipt"></i></span>
              <span className="hp-action-text">
                <strong>ค่าห้อง / น้ำ / ไฟ</strong>
                <small>{billsHint}</small>
              </span>
              <i className="fa-solid fa-arrow-right hp-action-go"></i>
            </button>
          </div>

          {!user && (
            <p className="hp-hero-note">
              <i className="fa-solid fa-circle-info"></i> ต้องเข้าสู่ระบบก่อนใช้งาน · ยังไม่มีบัญชี?{' '}
              <a href="/RegisterPage" onClick={(e) => { e.preventDefault(); navigate('/RegisterPage'); }}>สมัครสมาชิก</a>
            </p>
          )}
        </div>
      </header>

      <main className="hp-main">
        {/* ===== กล่องสรุป ===== */}
        <section className="hp-stats" aria-label="ข้อมูลหอพัก">
          <div className="hp-stat">
            <span className="hp-stat-icon"><i className="fa-solid fa-building"></i></span>
            <div>
              <strong>{stats.length || '–'}</strong>
              <span>อาคาร (ชาย {maleCount || '–'} · หญิง {femaleCount || '–'})</span>
            </div>
          </div>
          <div className="hp-stat">
            <span className="hp-stat-icon"><i className="fa-solid fa-tag"></i></span>
            <div>
              <strong>{minRate.toLocaleString('th-TH')} ฿</strong>
              <span>ค่าห้องเริ่มต้น / เดือน</span>
            </div>
          </div>
          <div className="hp-stat">
            <span className="hp-stat-icon"><i className="fa-solid fa-calendar-check"></i></span>
            <div>
              <strong>วันที่ 10</strong>
              <span>กำหนดชำระทุกเดือน</span>
            </div>
          </div>
          <div className="hp-stat">
            <span className="hp-stat-icon"><i className="fa-solid fa-qrcode"></i></span>
            <div>
              <strong>ออนไลน์</strong>
              <span>PromptPay · บัตรเครดิต/เดบิต</span>
            </div>
          </div>
        </section>

        <div className="hp-grid">
          {/* ===== ประกาศ ===== */}
          <section className="hp-card" id="news">
            <h2><i className="fa-solid fa-bullhorn"></i> ประกาศล่าสุด</h2>
            <ul className="hp-news">
              {ANNOUNCEMENTS.map(a => (
                <li key={a.title}>
                  <div className="hp-news-meta">
                    <span className="hp-pill ok">{a.tag}</span>
                    <time>{a.date}</time>
                  </div>
                  <h3>{a.title}</h3>
                  <p>{a.body}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* ===== ค่าหอพัก ===== */}
          <section className="hp-card" id="rates">
            <h2><i className="fa-solid fa-coins"></i> ค่าหอพัก</h2>
            <table className="hp-table">
              <thead>
                <tr><th>ประเภทห้อง</th><th><i className="fa-solid fa-snowflake"></i> แอร์</th><th><i className="fa-solid fa-fan"></i> พัดลม</th></tr>
              </thead>
              <tbody>
                {['ห้อง 2 คน', 'ห้อง 4 คน'].map(name => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    {['แอร์', 'พัดลม'].map(c => {
                      const r = ROOM_RATES.find(x => x.name === name && x.cooling === c);
                      return <td key={c}>{r ? r.price.toLocaleString('th-TH') : '–'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="hp-notes">
              <li>ราคาเป็นบาทต่อเดือน ต่อคน</li>
              <li>ค่าน้ำ-ค่าไฟคิดตามมิเตอร์ของห้อง หารเท่ากันตามจำนวนผู้พัก</li>
              <li>ชำระเงินประกันพร้อมค่าห้องเดือนแรกตอนจอง</li>
            </ul>
          </section>
        </div>
      </main>

      <footer className="hp-footer">
        <span>© ระบบหอพักนิสิต</span>
        <span>ติดต่อเจ้าหน้าที่หอพักได้ในวันและเวลาราชการ</span>
      </footer>
    </div>
  );
}
