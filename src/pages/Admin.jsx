import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import './Admin.css';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

const TABS = ['Dashboard', 'การจอง', 'ห้องพัก', 'นิสิต', 'รายงาน'];

export default function Admin() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('Dashboard');
    const [reservations, setReservations] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [dashboard, setDashboard] = useState(null);
    const [newStudent, setNewStudent] = useState({
        student_code: '', full_name: '', email: '', phone: '',
        gender: 'MALE', faculty: '', study_year: '',
        username: '', password: ''
    });
    const [addErr, setAddErr] = useState('');
    const [addLoading, setAddLoading] = useState(false);

    const token = localStorage.getItem('adminToken');

    useEffect(() => {
        if (!token) { navigate('/AdminLogin'); return; }
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        const config = { headers: { Authorization: `Bearer ${token}` } };
        try {
            const [r, ro, s, d] = await Promise.all([
                axios.get(`${API_URL}/api/admin/reservations`, config),
                axios.get(`${API_URL}/api/admin/rooms`, config),
                axios.get(`${API_URL}/api/admin/students`, config),
                axios.get(`${API_URL}/api/admin/dashboard`, config)
            ]);
            setReservations(r.data);
            setRooms(ro.data);
            setStudents(s.data);
            setDashboard(d.data);
        } catch (err) {
            console.error(err);
            alert('โหลดข้อมูลไม่สำเร็จ: ' + err.response?.data?.message);
        } finally {
            setLoading(false);
        }
    };

    const updateReservation = async (id, status) => {
        if (!confirm(`ยืนยันการเปลี่ยนสถานะเป็น "${status}"?`)) return;
        try {
            await axios.patch(`${API_URL}/api/admin/reservations/${id}`, { status });
            setReservations(prev => prev.map(r => r._id === id ? { ...r, status } : r));
        } catch (err) {
            alert(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        }
    };

    const updateRoomStatus = async (id, status) => {
        try {
            await axios.patch(`${API_URL}/api/admin/rooms/${id}`, { status });
            setRooms(prev => prev.map(r => r._id === id ? { ...r, status } : r));
        } catch (err) {
            alert('อัปเดตไม่สำเร็จ');
        }
    };

    const deleteRoom = async (id) => {
        if (!confirm('ยืนยันการลบห้องนี้?')) return;
        try {
            await axios.delete(`${API_URL}/api/admin/rooms/${id}`);
            setRooms(prev => prev.filter(r => r._id !== id));
        } catch (err) {
            alert('ลบไม่สำเร็จ');
        }
    };

    const deleteStudent = async (id) => {
        if (!confirm('ยืนยันการลบนิสิตคนนี้?')) return;
        try {
            await axios.delete(`${API_URL}/api/admin/students/${id}`);
            setStudents(prev => prev.filter(s => s._id !== id));
        } catch (err) {
            alert('ลบไม่สำเร็จ');
        }
    };

    const addStudent = async (e) => {
        e.preventDefault();
        setAddErr('');
        setAddLoading(true);
        try {
            const { data } = await axios.post(`${API_URL}/api/admin/students`, newStudent);
            setStudents(prev => [...prev, data.student]);
            setShowAddForm(false);
            setNewStudent({
                student_code: '', full_name: '', email: '', phone: '',
                gender: 'MALE', faculty: '', study_year: '',
                username: '', password: ''
            });
            alert('เพิ่มนิสิตสำเร็จ');
        } catch (err) {
            setAddErr(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setAddLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        navigate('/HomePage');
    };

    // Helper: แปลง Status ให้ตรงกับชื่อ Class ใน CSS (เช่น PENDING -> pending)
    const getStatusClass = (status) => status?.toLowerCase() || '';

    // Helper: สีของ Progress bar ใน Dashboard
    const getBarColor = (status) => ({
        PENDING: 'var(--gray-400)',
        CONFIRMED: 'var(--green-500)',
        CANCELLED: '#ef4444',
    }[status] || 'var(--gray-300)');

    return (
        <div>
            {/* Header */}
            <header className="ad-header">
                <div className="ad-logo">
                    <div className="ad-logo-icon">🏠</div>
                    <span className="ad-logo-text">Admin Dashboard</span>
                </div>
                <button onClick={handleLogout} className="ad-logout-btn">
                    ออกจากระบบ
                </button>
            </header>

            {/* Tabs */}
            <div className="ad-tabs">
                {TABS.map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`ad-tab ${tab === t ? 'active' : ''}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <main className="ad-content">
                {loading && <div className="ad-loading">กำลังโหลดข้อมูล...</div>}

                {/* === TAB: Dashboard === */}
                {tab === 'Dashboard' && (
                    dashboard ? (
                        <div>
                            <div className="ad-section-header">
                                <h2 className="ad-section-title">ภาพรวมระบบ</h2>
                            </div>

                            {/* Stats Cards */}
                            <div className="ad-stats-grid">
                                {[
                                    { label: 'นิสิตทั้งหมด', value: dashboard.totalStudents, icon: '👤', color: 'var(--green-100)' },
                                    { label: 'ห้องทั้งหมด', value: dashboard.totalRooms, icon: '🏠', color: '#e0e7ff' },
                                    { label: 'ห้องว่าง', value: dashboard.activeRooms, icon: '✅', color: 'var(--green-100)' },
                                    { label: 'ห้องที่ถูกจอง', value: dashboard.occupiedRooms, icon: '🔒', color: '#ffedd5' },
                                ].map(card => (
                                    <div key={card.label} className="ad-stat-card">
                                        <div className="ad-stat-icon" style={{ background: card.color }}>{card.icon}</div>
                                        <div className="ad-stat-value">{card.value}</div>
                                        <div className="ad-stat-label">{card.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Charts & Status */}
                            <div className="ad-charts-grid">
                                {/* สถานะการจอง */}
                                <div className="ad-chart-card">
                                    <h3 className="ad-chart-title">สถานะการจอง</h3>
                                    <div className="ad-bar-row">
                                        {[
                                            { label: 'รอชำระเงิน', status: 'PENDING', value: dashboard.pendingRes, total: dashboard.pendingRes + dashboard.confirmedRes + dashboard.cancelledRes },
                                            { label: 'ยืนยันแล้ว', status: 'CONFIRMED', value: dashboard.confirmedRes, total: dashboard.pendingRes + dashboard.confirmedRes + dashboard.cancelledRes },
                                            { label: 'ยกเลิก', status: 'CANCELLED', value: dashboard.cancelledRes, total: dashboard.pendingRes + dashboard.confirmedRes + dashboard.cancelledRes },
                                        ].map(item => {
                                            const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
                                            return (
                                                <div key={item.label} className="ad-bar-item">
                                                    <div className="ad-bar-label">
                                                        <span>{item.label}</span>
                                                        <strong>{item.value} ({pct}%)</strong>
                                                    </div>
                                                    <div className="ad-bar-track">
                                                        <div
                                                            className="ad-bar-fill"
                                                            style={{ width: `${pct}%`, backgroundColor: getBarColor(item.status) }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* อัตราการใช้ห้อง */}
                                <div className="ad-chart-card">
                                    <h3 className="ad-chart-title">อัตราการใช้ห้อง</h3>
                                    <div className="ad-occupancy">
                                        {(() => {
                                            const pct = dashboard.totalRooms > 0 ? Math.round((dashboard.occupiedRooms / dashboard.totalRooms) * 100) : 0;
                                            const color = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : 'var(--green-500)';
                                            return (
                                                <>
                                                    <div className="ad-occupancy-pct" style={{ color }}>{pct}%</div>
                                                    <div className="ad-occupancy-sub">
                                                        {dashboard.occupiedRooms} / {dashboard.totalRooms} ห้อง
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Recent Reservations */}
                            <div className="ad-recent-card">
                                <h3 className="ad-recent-title">การจองล่าสุด 5 รายการ</h3>
                                <div className="ad-table-wrap">
                                    <table className="ad-table">
                                        <thead>
                                            <tr>
                                                <th>รหัสนิสิต</th>
                                                <th>ชื่อ-สกุล</th>
                                                <th>ห้อง</th>
                                                <th>วันที่</th>
                                                <th>สถานะ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dashboard.recentRes.map(r => (
                                                <tr key={r._id}>
                                                    <td>{r.student_code}</td>
                                                    <td><strong>{r.full_name}</strong></td>
                                                    <td>{r.room_number}</td>
                                                    <td>{new Date(r.created_at).toLocaleDateString('th-TH')}</td>
                                                    <td>
                                                        <span className={`ad-pill ${getStatusClass(r.status)}`}>
                                                            {r.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        !loading && <div className="ad-loading">ไม่พบข้อมูล Dashboard</div>
                    )
                )}

                {/* === TAB: การจอง === */}
                {tab === 'การจอง' && (
                    <div>
                        <div className="ad-section-header">
                            <h2 className="ad-section-title">
                                รายการจองทั้งหมด <span className="ad-count-badge">{reservations.length}</span>
                            </h2>
                        </div>
                        <div className="ad-table-wrap">
                            <table className="ad-table">
                                <thead>
                                    <tr>
                                        <th>รหัสนิสิต</th>
                                        <th>ชื่อ-สกุล</th>
                                        <th>ห้อง</th>
                                        <th>วันที่จอง</th>
                                        <th>สถานะ</th>
                                        <th>จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reservations.map(r => (
                                        <tr key={r._id}>
                                            <td>{r.student_code}</td>
                                            <td><strong>{r.full_name}</strong></td>
                                            <td>{r.room_number}</td>
                                            <td>{new Date(r.created_at).toLocaleDateString('th-TH')}</td>
                                            <td>
                                                <span className={`ad-pill ${getStatusClass(r.status)}`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    {r.status === 'PENDING' && (
                                                        <button onClick={() => updateReservation(r._id, 'CONFIRMED')} className="ad-btn approve">
                                                            อนุมัติ
                                                        </button>
                                                    )}
                                                    {r.status !== 'CANCELLED' && r.status !== 'COMPLETED' && (
                                                        <button onClick={() => updateReservation(r._id, 'CANCELLED')} className="ad-btn cancel">
                                                            ยกเลิก
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* === TAB: ห้องพัก === */}
                {tab === 'ห้องพัก' && (
                    <div>
                        <div className="ad-section-header">
                            <h2 className="ad-section-title">
                                ห้องพักทั้งหมด <span className="ad-count-badge">{rooms.length}</span>
                            </h2>
                        </div>
                        <div className="ad-table-wrap">
                            <table className="ad-table">
                                <thead>
                                    <tr>
                                        <th>ห้อง</th>
                                        <th>อาคาร</th>
                                        <th>ประเภท</th>
                                        <th>เครื่องทำความเย็น</th>
                                        <th>สถานะ</th>
                                        <th>จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rooms.map(r => (
                                        <tr key={r._id}>
                                            <td><strong>{r.room_number}</strong></td>
                                            <td>{r.building_id?.building_name || '-'}</td>
                                            <td>{r.type_id?.type_name || '-'}</td>
                                            <td>{r.type_id?.cooling_type || '-'}</td>
                                            <td>
                                                <select
                                                    value={r.status}
                                                    onChange={e => updateRoomStatus(r._id, e.target.value)}
                                                    className="ad-select"
                                                >
                                                    <option value="ACTIVE">ACTIVE</option>
                                                    <option value="INACTIVE">INACTIVE</option>
                                                    <option value="MAINTENANCE">MAINTENANCE</option>
                                                </select>
                                            </td>
                                            <td>
                                                <button onClick={() => deleteRoom(r._id)} className="ad-btn delete">ลบ</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* === TAB: นิสิต === */}
                {tab === 'นิสิต' && (
                    <div>
                        <div className="ad-section-header">
                            <h2 className="ad-section-title">
                                นิสิตทั้งหมด <span className="ad-count-badge">{students.length}</span>
                            </h2>
                            <button
                                onClick={() => setShowAddForm(!showAddForm)}
                                className={`ad-add-btn ${showAddForm ? 'close' : ''}`}
                            >
                                {showAddForm ? '✕ ปิด' : '+ เพิ่มนิสิต'}
                            </button>
                        </div>

                        {/* Form เพิ่มนิสิต */}
                        {showAddForm && (
                            <div className="ad-form-card">
                                <h3 className="ad-form-title">ข้อมูลนิสิตใหม่</h3>
                                <form onSubmit={addStudent}>
                                    <div className="ad-form-grid">
                                        {[
                                            { label: 'รหัสนิสิต', key: 'student_code', placeholder: '66302767' },
                                            { label: 'ชื่อ-สกุล', key: 'full_name', placeholder: 'สมชาย ใจดี' },
                                            { label: 'อีเมล', key: 'email', placeholder: 'somchai@ku.th' },
                                            { label: 'เบอร์โทร', key: 'phone', placeholder: '0812341234' },
                                            { label: 'คณะ', key: 'faculty', placeholder: 'DST' },
                                            { label: 'ชั้นปี', key: 'study_year', placeholder: '3' },
                                            { label: 'Username', key: 'username', placeholder: '6630302767' },
                                            { label: 'Password', key: 'password', placeholder: '••••••••', type: 'password' },
                                        ].map(f => (
                                            <div key={f.key} className="ad-form-field">
                                                <label className="ad-form-label">{f.label}</label>
                                                <input
                                                    type={f.type || 'text'}
                                                    placeholder={f.placeholder}
                                                    value={newStudent[f.key]}
                                                    onChange={e => setNewStudent(prev => ({ ...prev, [f.key]: e.target.value }))}
                                                    className="ad-form-input"
                                                    required
                                                />
                                            </div>
                                        ))}

                                        {/* Gender select */}
                                        <div className="ad-form-field">
                                            <label className="ad-form-label">เพศ</label>
                                            <select
                                                value={newStudent.gender}
                                                onChange={e => setNewStudent(prev => ({ ...prev, gender: e.target.value }))}
                                                className="ad-form-select"
                                            >
                                                <option value="MALE">MALE</option>
                                                <option value="FEMALE">FEMALE</option>
                                            </select>
                                        </div>
                                    </div>

                                    {addErr && <div className="ad-form-error">{addErr}</div>}

                                    <div className="ad-form-actions">
                                        <button type="submit" disabled={addLoading} className="ad-save-btn">
                                            {addLoading ? 'กำลังบันทึก...' : 'บันทึก'}
                                        </button>
                                        <button type="button" onClick={() => setShowAddForm(false)} className="ad-cancel-btn">
                                            ยกเลิก
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* ตารางนิสิต */}
                        <div className="ad-table-wrap">
                            <table className="ad-table">
                                <thead>
                                    <tr>
                                        <th>รหัสนิสิต</th>
                                        <th>ชื่อ-สกุล</th>
                                        <th>อีเมล</th>
                                        <th>เพศ</th>
                                        <th>คณะ</th>
                                        <th>จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map(s => (
                                        <tr key={s._id}>
                                            <td>{s.student_code}</td>
                                            <td><strong>{s.full_name}</strong></td>
                                            <td>{s.email}</td>
                                            <td>{s.gender}</td>
                                            <td>{s.faculty}</td>
                                            <td>
                                                <button onClick={() => deleteStudent(s._id)} className="ad-btn delete">ลบ</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}