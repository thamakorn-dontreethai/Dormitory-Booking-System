import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const FIELDS = [
  { label: 'รหัสนิสิต', key: 'student_code', placeholder: '6630202111', autoComplete: 'off' },
  { label: 'ชื่อ-สกุล', key: 'full_name', placeholder: 'สมชาย ใจดี', autoComplete: 'name' },
  { label: 'อีเมล', key: 'email', placeholder: 'somchai@ku.th', type: 'email', autoComplete: 'email' },
  { label: 'เบอร์โทร', key: 'phone', placeholder: '0812341234', type: 'tel', autoComplete: 'tel' },
  { label: 'คณะ', key: 'faculty', placeholder: 'DST', autoComplete: 'off' },
  { label: 'ชั้นปี', key: 'study_year', placeholder: '1', type: 'number', autoComplete: 'off' },
  { label: 'Username', key: 'username', placeholder: 'ใช้สำหรับเข้าสู่ระบบ', autoComplete: 'username' },
  { label: 'รหัสผ่าน', key: 'password', placeholder: 'อย่างน้อย 6 ตัวอักษร', type: 'password', autoComplete: 'new-password' },
  { label: 'ยืนยันรหัสผ่าน', key: 'confirm_password', placeholder: 'กรอกรหัสผ่านอีกครั้ง', type: 'password', autoComplete: 'new-password' },
];

const EMPTY_FORM = {
  student_code: '', full_name: '', email: '', phone: '', gender: 'MALE',
  faculty: '', study_year: '', username: '', password: '', confirm_password: '',
};

export default function RegisterPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onChange = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (FIELDS.some(f => !String(form[f.key]).trim())) {
      setErr('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    if (form.password.length < 6) {
      setErr('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (form.password !== form.confirm_password) {
      setErr('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setLoading(true);
    try {
      const { confirm_password, ...payload } = form;
      await axios.post(`${API_URL}/api/register`, payload);
      navigate('/LoginPage', {
        replace: true,
        state: { registered: true, username: form.username.trim() },
      });
    } catch (e) {
      setErr(e?.response?.data?.message || 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <button type="button" className="login-back-btn" onClick={() => navigate('/LoginPage')}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        ย้อนกลับ
      </button>
      <div className="login-card register-card">
        <h2 className="login-title">สมัครสมาชิกนิสิต</h2>
        <p className="login-desc">กรอกข้อมูลเพื่อสร้างบัญชีสำหรับจองหอพัก</p>
        <form className="login-form" onSubmit={onSubmit}>
          {FIELDS.map(f => (
            <div key={f.key} className="login-field">
              <label className="login-label">{f.label}</label>
              <input
                className="login-input"
                type={f.type || 'text'}
                value={form[f.key]}
                onChange={onChange(f.key)}
                placeholder={f.placeholder}
                disabled={loading}
                autoComplete={f.autoComplete}
                {...(f.key === 'study_year' ? { min: 1, max: 8 } : {})}
              />
            </div>
          ))}

          <div className="login-field">
            <label className="login-label">เพศ</label>
            <select
              className="login-input"
              value={form.gender}
              onChange={onChange('gender')}
              disabled={loading}
            >
              <option value="MALE">ชาย</option>
              <option value="FEMALE">หญิง</option>
            </select>
          </div>

          {err && <div className="login-error">{err}</div>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
          </button>
        </form>

        <div className="login-admin-link">
          มีบัญชีอยู่แล้ว? <Link to="/LoginPage">เข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  );
}
