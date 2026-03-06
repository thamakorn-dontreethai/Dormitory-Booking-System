import React, { useState } from 'react'; 
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css'; // เราจะสร้างไฟล์ CSS นี้ในขั้นตอนถัดไป

const API_URL = 'http://localhost:3001';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [params] = useSearchParams();
  const navigate = useNavigate();

const onSubmit = async (e) => {
  e.preventDefault();
  setErr('');
  try {
    const { data } = await axios.post(`${API_URL}/api/login`, { username, password });
localStorage.setItem('token', data.token);
localStorage.setItem('user', JSON.stringify(data.user));
navigate('/BookingPage', { replace: true });

  } catch (e) {
    setErr(e?.response?.data?.message || 'เข้าสู่ระบบไม่สำเร็จ');
  }
};

  return (
    <div className="login-wrapper">
      <h2>เข้าสู่ระบบนิสิต</h2>
      <form onSubmit={onSubmit}>
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="รหัสนิสิต / username" />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="รหัสผ่าน" />
        {err && <div className="error">{err}</div>}
        <button type="submit">เข้าสู่ระบบ</button>
      </form>
    </div>
  );
}
