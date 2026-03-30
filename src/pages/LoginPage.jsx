import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://10.64.41.236:3001';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) navigate('/BookingPage', { replace: true });
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!username.trim() || !password.trim()) {
      setErr('กรุณากรอก Username และ Password');
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/login`, {
        username: username.trim(),
        password,
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/BookingPage', { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <button type="button" className="login-back-btn" onClick={() => navigate('/')}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        ย้อนกลับ
      </button>
      <div className="login-card">
        <h2 className="login-title">เข้าสู่ระบบนิสิต</h2>
        <p className="login-desc">กรุณากรอกข้อมูลเพื่อเข้าสู่ระบบ</p>
        <form className="login-form" onSubmit={onSubmit}>
          <div className="login-field">
            <label className="login-label">Username</label>
            <input
              className="login-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="กรอกรหัสนิสิต"
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label className="login-label">รหัสผ่าน</label>
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="กรอกรหัสผ่าน"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {err && <div className="login-error">{err}</div>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className="login-admin-link">
          ผู้ดูแลระบบ? <Link to="/AdminLogin">เข้าสู่ระบบ Admin</Link>
        </div>
      </div>
    </div>
  );
}