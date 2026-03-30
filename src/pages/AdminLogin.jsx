import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminLogin.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.0.120:3001';

export default function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr('');
        setLoading(true);
        try {
            const { data } = await axios.post(`${API_URL}/api/admin/login`, { username, password });
            localStorage.setItem('adminToken', data.token);
            navigate('/Admin');
        } catch (e) {
            setErr(e?.response?.data?.message || 'เข้าสู่ระบบไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="al-wrapper">
            <button type="button" className="al-back-btn" onClick={() => navigate('/')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                ย้อนกลับ
            </button>

            <div className="al-card">
                <h2 className="al-title">เข้าสู่ระบบ Admin</h2>
                <p className="al-desc">กรุณากรอกข้อมูลเพื่อเข้าสู่ระบบผู้ดูแล</p>

                <form className="al-form" onSubmit={onSubmit}>
                    <div className="al-field">
                        <label className="al-label">ชื่อผู้ใช้</label>
                        <input
                            className="al-input"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Username"
                            disabled={loading}
                            autoComplete="username"
                        />
                    </div>

                    <div className="al-field">
                        <label className="al-label">รหัสผ่าน</label>
                        <input
                            className="al-input"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Password"
                            disabled={loading}
                            autoComplete="current-password"
                        />
                    </div>

                    {err && <div className="al-error">{err}</div>}

                    <button className="al-btn" type="submit" disabled={loading}>
                        {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                    </button>
                </form>
            </div>
        </div>
    );
}