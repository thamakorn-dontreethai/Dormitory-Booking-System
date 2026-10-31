import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatBaht, formatMonth, formatDate, currentMonthKey, formatItemLabel } from '../utils/format';
import './Admin.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const TABS = ['Dashboard', 'การจอง', 'ค่าห้องรายเดือน', 'ห้องพัก', 'นิสิต'];

const STATUS_LABEL = {
    PENDING: 'รอชำระเงิน',
    PAID: 'รอตรวจสอบ',
    CONFIRMED: 'ยืนยันแล้ว',
    REJECTED: 'ถูกปฏิเสธ',
    CANCELLED: 'ยกเลิก',
    COMPLETED: 'เสร็จสิ้น',
};

const REJECT_REASONS = ['ยอดเงินไม่ถูกต้อง', 'ไม่พบรายการชำระเงิน', 'ข้อมูลผู้จองไม่ตรงกับนิสิต'];

const INVOICE_STATUS_LABEL = {
    UNPAID: 'ค้างชำระ',
    PAID: 'รอตรวจสอบ',
    CONFIRMED: 'ชำระแล้ว',
};

// --- Modal ตรวจสอบการชำระเงิน (ค่าจอง หรือ บิลรายเดือน) ---
// target = { kind: 'BOOKING' | 'INVOICE', doc }
function ReviewModal({ target, onClose, onSubmit }) {
    const { kind, doc } = target;
    const [mode, setMode] = useState('view'); // view | reject
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState('');
    const p = doc.payment || {};
    const isInvoice = kind === 'INVOICE';
    const amount = isInvoice ? doc.amount : p.amount;
    const items = isInvoice
        ? (doc.items?.length ? doc.items : [{ label: 'ค่าห้องพัก', amount: doc.amount }])
        : [{ label: 'ค่าห้องพัก (เดือนแรก)', amount: p.room_price }, { label: 'เงินประกัน', amount: p.deposit }];

    const submit = async (action) => {
        if (action === 'REJECTED' && !reason.trim()) {
            setErr('กรุณาระบุเหตุผลที่ปฏิเสธ');
            return;
        }
        setErr('');
        setSubmitting(true);
        try {
            await onSubmit(action, reason.trim());
        } catch (e) {
            setErr(e.response?.data?.message || 'เกิดข้อผิดพลาด');
            setSubmitting(false);
        }
    };

    return (
        <div className="ad-modal-overlay" onClick={() => !submitting && onClose()}>
            <div className="ad-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="ad-modal-header">
                    <h3>{isInvoice ? 'ตรวจสอบการชำระค่าห้อง' : 'ตรวจสอบการชำระค่าจอง'}</h3>
                    <button className="ad-modal-close" onClick={onClose} disabled={submitting} aria-label="ปิด">×</button>
                </div>

                <dl className="ad-review-rows">
                    <div><dt>ผู้จอง</dt><dd>{doc.full_name} ({doc.student_code})</dd></div>
                    <div><dt>ห้อง</dt><dd>{doc.room_number}</dd></div>
                    {isInvoice && <div><dt>ประจำเดือน</dt><dd>{formatMonth(doc.month)}</dd></div>}
                    {items.map(item => (
                        <div key={item.type || item.label}><dt>{formatItemLabel(item)}</dt><dd>{formatBaht(item.amount)} บาท</dd></div>
                    ))}
                    <div className="total"><dt>ยอดชำระ</dt><dd>{formatBaht(amount)} บาท</dd></div>
                    <div><dt>ช่องทาง</dt><dd>{p.method === 'CARD' ? `บัตร •••• ${p.card_last4}` : 'PromptPay'}</dd></div>
                    <div><dt>เลขอ้างอิง</dt><dd className="mono">{p.ref}</dd></div>
                    <div><dt>เวลาชำระ</dt><dd>{p.paid_at ? new Date(p.paid_at).toLocaleString('th-TH') : '-'}</dd></div>
                </dl>

                {mode === 'reject' && (
                    <div className="ad-reject-box">
                        <label className="ad-form-label" htmlFor="reject-reason">เหตุผลที่ปฏิเสธ (นิสิตจะเห็นข้อความนี้)</label>
                        <div className="ad-reason-chips">
                            {REJECT_REASONS.map(r => (
                                <button key={r} type="button" className="ad-chip" onClick={() => setReason(r)} disabled={submitting}>
                                    {r}
                                </button>
                            ))}
                        </div>
                        <textarea
                            id="reject-reason"
                            className="ad-form-input"
                            rows={3}
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="ระบุเหตุผล..."
                            disabled={submitting}
                        />
                        <p className="ad-reject-note">
                            ระบบจะคืนเงิน {formatBaht(amount)} บาท {isInvoice ? 'และบิลจะกลับเป็นค้างชำระ ให้นิสิตชำระใหม่' : 'และห้องจะว่างให้คนอื่นจองได้'}
                        </p>
                    </div>
                )}

                {err && <div className="ad-form-error">{err}</div>}

                <div className="ad-modal-actions">
                    {mode === 'view' ? (
                        <>
                            <button className="ad-btn cancel lg" onClick={() => setMode('reject')} disabled={submitting}>ปฏิเสธ</button>
                            <button className="ad-btn approve lg" onClick={() => submit('APPROVED')} disabled={submitting}>
                                {submitting ? 'กำลังบันทึก...' : 'อนุมัติการชำระเงิน'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="ad-btn lg" onClick={() => { setMode('view'); setErr(''); }} disabled={submitting}>ย้อนกลับ</button>
                            <button className="ad-btn cancel-solid lg" onClick={() => submit('REJECTED')} disabled={submitting}>
                                {submitting ? 'กำลังบันทึก...' : 'ยืนยันปฏิเสธและคืนเงิน'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

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
    const [searchReservation, setSearchReservation] = useState('');
    const [searchRoom, setSearchRoom] = useState('');
    const [searchStudent, setSearchStudent] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [reviewing, setReviewing] = useState(null); // { kind, doc } รายการที่กำลังตรวจสอบ
    const [invoices, setInvoices] = useState([]);
    const [invoiceMonth, setInvoiceMonth] = useState('ALL'); // กรองตามเดือน
    const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('ALL');
    const [generateMonth, setGenerateMonth] = useState(currentMonthKey());
    const [generating, setGenerating] = useState(false);
    const [meterData, setMeterData] = useState(null); // { month, rates, rooms }
    const [meterForm, setMeterForm] = useState({}); // room_id -> { water_prev, water_curr, elec_prev, elec_curr }
    const [savingMeter, setSavingMeter] = useState(null); // room_id ที่กำลังบันทึก

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
            const [r, ro, s, d, inv] = await Promise.all([
                axios.get(`${API_URL}/api/admin/reservations`, config),
                axios.get(`${API_URL}/api/admin/rooms`, config),
                axios.get(`${API_URL}/api/admin/students`, config),
                axios.get(`${API_URL}/api/admin/dashboard`, config),
                axios.get(`${API_URL}/api/admin/invoices`, config)
            ]);
            // ถ้า API ตอบกลับเป็น HTML (proxy ไม่ทำงาน) จะไม่ใช่ array/object -> แจ้ง error แทนหน้าขาว
            if (!Array.isArray(r.data) || !Array.isArray(ro.data) || !Array.isArray(s.data) || typeof d.data !== 'object') {
                throw new Error('API ตอบกลับไม่ถูกต้อง (ตรวจสอบว่า backend และ Vite proxy ทำงานอยู่)');
            }
            setReservations(r.data);
            setRooms(ro.data);
            setStudents(s.data);
            setDashboard({ ...d.data, recentRes: d.data.recentRes || [] });
            setInvoices(Array.isArray(inv.data) ? inv.data : []);
        } catch (err) {
            console.error(err);
            alert('โหลดข้อมูลไม่สำเร็จ: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const updateReservation = async (id, status) => {
        if (!confirm(`ยืนยันการเปลี่ยนสถานะเป็น "${STATUS_LABEL[status] || status}"?`)) return;
        try {
            const { data } = await axios.patch(`${API_URL}/api/admin/reservations/${id}`, { status });
            setReservations(prev => prev.map(r => r._id === id ? data.reservation : r));
        } catch (err) {
            alert(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        }
    };

    // ส่งผลตรวจสอบการชำระเงิน (error จะถูกโยนกลับไปแสดงใน modal)
    const submitReview = async (action, reason) => {
        if (reviewing.kind === 'INVOICE') {
            const { data } = await axios.post(`${API_URL}/api/admin/invoices/${reviewing.doc._id}/review`, { action, reason });
            setInvoices(prev => prev.map(i => i._id === data.invoice._id ? data.invoice : i));
            setReviewing(null);
            alert(data.message);
            return;
        }
        const { data } = await axios.post(`${API_URL}/api/admin/reservations/${reviewing.doc._id}/review`, { action, reason });
        setReservations(prev => prev.map(r => r._id === data.reservation._id ? data.reservation : r));
        setReviewing(null);
        alert(data.message);
    };

    // ออกบิลค่าห้องประจำเดือนให้ทุกการจองที่ยืนยันแล้ว
    const generateInvoices = async () => {
        if (!generateMonth) return;
        if (!confirm(`ออกบิลค่าห้องประจำเดือน ${formatMonth(generateMonth)} ให้นิสิตทุกคนที่การจองยืนยันแล้ว?`)) return;
        setGenerating(true);
        try {
            const { data } = await axios.post(`${API_URL}/api/admin/invoices/generate`, { month: generateMonth });
            alert(data.message);
            const inv = await axios.get(`${API_URL}/api/admin/invoices`);
            setInvoices(inv.data);
            setInvoiceMonth(generateMonth);
            setInvoiceStatusFilter('ALL');
        } catch (err) {
            alert(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setGenerating(false);
        }
    };

    // โหลดห้องที่ต้องบันทึกมิเตอร์ของเดือนที่เลือก
    const loadMeters = async (month) => {
        try {
            const { data } = await axios.get(`${API_URL}/api/admin/meters`, { params: { month } });
            setMeterData(data);
            const form = {};
            for (const room of data.rooms) {
                const r = room.reading;
                form[room.room_id] = {
                    water_prev: r?.water_prev ?? room.suggested_prev?.water ?? '',
                    water_curr: r?.water_curr ?? '',
                    elec_prev: r?.elec_prev ?? room.suggested_prev?.elec ?? '',
                    elec_curr: r?.elec_curr ?? '',
                };
            }
            setMeterForm(form);
        } catch (err) {
            setMeterData(null);
        }
    };

    useEffect(() => {
        if (tab === 'ค่าห้องรายเดือน' && generateMonth) loadMeters(generateMonth);
    }, [tab, generateMonth]);

    const setMeterValue = (roomId, key, value) =>
        setMeterForm(prev => ({ ...prev, [roomId]: { ...prev[roomId], [key]: value } }));

    const saveMeter = async (room) => {
        setSavingMeter(room.room_id);
        try {
            const { data } = await axios.put(`${API_URL}/api/admin/meters`, {
                room_id: room.room_id, month: generateMonth, ...meterForm[room.room_id]
            });
            const updated = new Map(data.invoices.map(i => [i._id, i]));
            setInvoices(prev => prev.map(i => updated.get(i._id) || i));
            await loadMeters(generateMonth);
            alert(data.message);
        } catch (err) {
            alert(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
        } finally {
            setSavingMeter(null);
        }
    };

    const openPaidInvoices = () => {
        setTab('ค่าห้องรายเดือน');
        setInvoiceMonth('ALL');
        setInvoiceStatusFilter('PAID');
        fetchAll();
    };

    const openPaidReservations = () => {
        setTab('การจอง');
        setStatusFilter('PAID');
        fetchAll();
    };

    const paidCount = reservations.filter(r => r.status === 'PAID').length;
    const paidInvoiceCount = invoices.filter(i => i.status === 'PAID').length;

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
        PAID: '#f59e0b',
        CONFIRMED: 'var(--green-500)',
        REJECTED: '#b91c1c',
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
                        onClick={() => { setTab(t); fetchAll(); }}
                        className={`ad-tab ${tab === t ? 'active' : ''}`}
                    >
                        {t}
                        {t === 'การจอง' && paidCount > 0 && (
                            <span className="ad-tab-badge" title="รอตรวจสอบการชำระเงิน">{paidCount}</span>
                        )}
                        {t === 'ค่าห้องรายเดือน' && paidInvoiceCount > 0 && (
                            <span className="ad-tab-badge" title="รอตรวจสอบการชำระค่าห้อง">{paidInvoiceCount}</span>
                        )}
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

                            {dashboard.paidRes > 0 && (
                                <div className="ad-alert">
                                    <span>มี <strong>{dashboard.paidRes}</strong> รายการชำระค่าจองที่รอตรวจสอบ</span>
                                    <button className="ad-btn approve lg" onClick={openPaidReservations}>ไปตรวจสอบ</button>
                                </div>
                            )}
                            {dashboard.paidInvoices > 0 && (
                                <div className="ad-alert">
                                    <span>มี <strong>{dashboard.paidInvoices}</strong> รายการชำระค่าห้องรายเดือนที่รอตรวจสอบ</span>
                                    <button className="ad-btn approve lg" onClick={openPaidInvoices}>ไปตรวจสอบ</button>
                                </div>
                            )}

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
                                        {(() => {
                                            const counts = {
                                                PENDING: dashboard.pendingRes || 0,
                                                PAID: dashboard.paidRes || 0,
                                                CONFIRMED: dashboard.confirmedRes || 0,
                                                REJECTED: dashboard.rejectedRes || 0,
                                                CANCELLED: dashboard.cancelledRes || 0,
                                            };
                                            const total = Object.values(counts).reduce((a, b) => a + b, 0);
                                            return Object.entries(counts).map(([status, value]) => ({
                                                label: STATUS_LABEL[status], status, value, total,
                                            }));
                                        })().map(item => {
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
                                                            {STATUS_LABEL[r.status] || r.status}
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
                {tab === 'การจอง' && (() => {
                    const filtered = reservations.filter(r => {
                        if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
                        const q = searchReservation.toLowerCase();
                        return !q || r.student_code?.includes(q) || r.full_name?.toLowerCase().includes(q) || r.room_number?.includes(q);
                    });
                    return (
                        <div>
                            <div className="ad-section-header">
                                <h2 className="ad-section-title">
                                    รายการจองทั้งหมด <span className="ad-count-badge">{filtered.length}</span>
                                </h2>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <select
                                        className="ad-select"
                                        value={statusFilter}
                                        onChange={e => setStatusFilter(e.target.value)}
                                        aria-label="กรองตามสถานะ"
                                    >
                                        <option value="ALL">ทุกสถานะ</option>
                                        {Object.entries(STATUS_LABEL).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                    <input
                                        className="ad-search-input"
                                        placeholder="ค้นหา รหัสนิสิต / ชื่อ / ห้อง..."
                                        value={searchReservation}
                                        onChange={e => setSearchReservation(e.target.value)}
                                    />
                                </div>
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
                                            <th>การชำระเงิน</th>
                                            <th>จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(r => (
                                            <tr key={r._id}>
                                                <td>{r.student_code}</td>
                                                <td><strong>{r.full_name}</strong></td>
                                                <td>{r.room_number}</td>
                                                <td>{new Date(r.created_at).toLocaleDateString('th-TH')}</td>
                                                <td>
                                                    <span className={`ad-pill ${getStatusClass(r.status)}`}>
                                                        {STATUS_LABEL[r.status] || r.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {r.payment?.ref ? (
                                                        <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
                                                            <strong>{Number(r.payment.amount).toLocaleString('th-TH')} บาท</strong>
                                                            <div>{r.payment.method === 'CARD' ? `บัตร •••• ${r.payment.card_last4}` : 'PromptPay'}</div>
                                                            <div style={{ color: 'var(--gray-400)', fontFamily: 'monospace' }}>{r.payment.ref}</div>
                                                            {r.payment.refund_ref && (
                                                                <div style={{ color: '#b91c1c' }}>คืนเงินแล้ว: <span style={{ fontFamily: 'monospace' }}>{r.payment.refund_ref}</span></div>
                                                            )}
                                                            {r.status === 'REJECTED' && r.review?.reason && (
                                                                <div style={{ color: '#b91c1c' }}>เหตุผล: {r.review.reason}</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--gray-400)' }}>-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        {r.status === 'PAID' && (
                                                            <button onClick={() => setReviewing({ kind: 'BOOKING', doc: r })} className="ad-btn review">
                                                                ตรวจสอบ
                                                            </button>
                                                        )}
                                                        {['PENDING', 'PAID', 'CONFIRMED'].includes(r.status) && (
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
                    );
                })()}

                {/* === TAB: ค่าห้องรายเดือน === */}
                {tab === 'ค่าห้องรายเดือน' && (() => {
                    const months = [...new Set(invoices.map(i => i.month))].sort().reverse();
                    const inMonth = invoices.filter(i => invoiceMonth === 'ALL' || i.month === invoiceMonth);
                    const filtered = inMonth.filter(i => invoiceStatusFilter === 'ALL' || i.status === invoiceStatusFilter);
                    const sumOf = (list) => list.reduce((s, i) => s + i.amount, 0);
                    const unpaid = inMonth.filter(i => i.status === 'UNPAID');
                    const pending = inMonth.filter(i => i.status === 'PAID');
                    const paid = inMonth.filter(i => i.status === 'CONFIRMED');
                    // สี pill: ใช้ class เดิมของสถานะการจอง
                    const pillClass = (i) => i.status === 'UNPAID' ? (i.overdue ? 'cancelled' : 'pending')
                        : i.status === 'PAID' ? 'paid' : 'confirmed';
                    return (
                        <div>
                            <div className="ad-section-header">
                                <h2 className="ad-section-title">
                                    ค่าห้องรายเดือน <span className="ad-count-badge">{filtered.length}</span>
                                </h2>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <select className="ad-select" value={invoiceMonth} onChange={e => setInvoiceMonth(e.target.value)} aria-label="กรองตามเดือน">
                                        <option value="ALL">ทุกเดือน</option>
                                        {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
                                    </select>
                                    <select className="ad-select" value={invoiceStatusFilter} onChange={e => setInvoiceStatusFilter(e.target.value)} aria-label="กรองตามสถานะ">
                                        <option value="ALL">ทุกสถานะ</option>
                                        {Object.entries(INVOICE_STATUS_LABEL).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="ad-generate-card">
                                <div>
                                    <strong>ออกบิลประจำเดือน</strong>
                                    <p>ออกบิลให้ทุกการจองที่ยืนยันแล้ว (ไม่รวมเดือนแรกที่ชำระตอนจอง และไม่ออกซ้ำถ้ามีบิลเดือนนั้นแล้ว) กำหนดชำระวันที่ 10</p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="month"
                                        className="ad-select"
                                        value={generateMonth}
                                        onChange={e => setGenerateMonth(e.target.value)}
                                        aria-label="เดือนที่จะออกบิล"
                                    />
                                    <button className="ad-btn approve lg" onClick={generateInvoices} disabled={generating || !generateMonth}>
                                        {generating ? 'กำลังออกบิล...' : 'ออกบิล'}
                                    </button>
                                </div>
                            </div>

                            <div className="ad-meter-card">
                                <div className="ad-meter-head">
                                    <strong>บันทึกมิเตอร์น้ำ-ไฟ เดือน {formatMonth(generateMonth)}</strong>
                                    {meterData && (
                                        <span>ค่าน้ำ {meterData.rates.water} บาท/หน่วย · ค่าไฟ {meterData.rates.electric} บาท/หน่วย · หารเท่ากันตามจำนวนผู้พัก</span>
                                    )}
                                </div>
                                {!meterData || meterData.rooms.length === 0 ? (
                                    <p className="ad-meter-empty">ยังไม่มีบิลเดือนนี้ กดออกบิลก่อน แล้วจึงบันทึกมิเตอร์ของแต่ละห้อง</p>
                                ) : (
                                    <div className="ad-table-wrap">
                                        <table className="ad-table ad-meter-table">
                                            <thead>
                                                <tr>
                                                    <th>ห้อง</th>
                                                    <th>ผู้พัก</th>
                                                    <th>💧 น้ำ (เดิม → ใหม่)</th>
                                                    <th>⚡ ไฟ (เดิม → ใหม่)</th>
                                                    <th>ยอดน้ำ+ไฟ ทั้งห้อง</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {meterData.rooms.map(room => {
                                                    const v = meterForm[room.room_id] || {};
                                                    const wUnits = Number(v.water_curr) - Number(v.water_prev);
                                                    const eUnits = Number(v.elec_curr) - Number(v.elec_prev);
                                                    const filled = ['water_prev', 'water_curr', 'elec_prev', 'elec_curr'].every(k => v[k] !== '' && v[k] !== undefined);
                                                    const preview = filled && wUnits >= 0 && eUnits >= 0
                                                        ? wUnits * meterData.rates.water + eUnits * meterData.rates.electric
                                                        : null;
                                                    const input = (key) => (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            className="ad-meter-input"
                                                            value={v[key] ?? ''}
                                                            onChange={e => setMeterValue(room.room_id, key, e.target.value)}
                                                            disabled={room.locked || savingMeter === room.room_id}
                                                            aria-label={key}
                                                        />
                                                    );
                                                    return (
                                                        <tr key={room.room_id}>
                                                            <td><strong>{room.room_number}</strong></td>
                                                            <td style={{ fontSize: '12px' }}>{room.occupants.length} คน</td>
                                                            <td><div className="ad-meter-pair">{input('water_prev')}<span>→</span>{input('water_curr')}</div></td>
                                                            <td><div className="ad-meter-pair">{input('elec_prev')}<span>→</span>{input('elec_curr')}</div></td>
                                                            <td>
                                                                {preview !== null ? (
                                                                    <span>
                                                                        {formatBaht(preview)} บาท
                                                                        <small style={{ display: 'block', color: 'var(--gray-400)' }}>
                                                                            คนละ {formatBaht(preview / room.occupants.length)}
                                                                        </small>
                                                                    </span>
                                                                ) : '-'}
                                                            </td>
                                                            <td>
                                                                {room.locked ? (
                                                                    <span className="ad-pill confirmed">มีคนชำระแล้ว</span>
                                                                ) : (
                                                                    <button
                                                                        className="ad-btn approve"
                                                                        onClick={() => saveMeter(room)}
                                                                        disabled={!filled || savingMeter === room.room_id}
                                                                    >
                                                                        {savingMeter === room.room_id ? 'กำลังบันทึก...' : room.reading ? 'แก้ไข' : 'บันทึก'}
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="ad-invoice-stats">
                                <div><span>ค้างชำระ</span><strong>{unpaid.length} รายการ</strong><small>{formatBaht(sumOf(unpaid))} บาท</small></div>
                                <div><span>รอตรวจสอบ</span><strong>{pending.length} รายการ</strong><small>{formatBaht(sumOf(pending))} บาท</small></div>
                                <div><span>ชำระแล้ว</span><strong>{paid.length} รายการ</strong><small>{formatBaht(sumOf(paid))} บาท</small></div>
                            </div>

                            <div className="ad-table-wrap">
                                <table className="ad-table">
                                    <thead>
                                        <tr>
                                            <th>เดือน</th>
                                            <th>รหัสนิสิต</th>
                                            <th>ชื่อ-สกุล</th>
                                            <th>ห้อง</th>
                                            <th>ยอด</th>
                                            <th>กำหนดชำระ</th>
                                            <th>สถานะ</th>
                                            <th>การชำระเงิน</th>
                                            <th>จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.length === 0 && (
                                            <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--gray-400)' }}>ไม่มีบิล</td></tr>
                                        )}
                                        {filtered.map(i => (
                                            <tr key={i._id}>
                                                <td>{formatMonth(i.month)}</td>
                                                <td>{i.student_code}</td>
                                                <td><strong>{i.full_name}</strong></td>
                                                <td>{i.room_number}</td>
                                                <td>
                                                    <strong>{formatBaht(i.amount)}</strong>
                                                    <div style={{ fontSize: '11px', color: 'var(--gray-500)', lineHeight: 1.5 }}>
                                                        {(i.items || []).map(it => (
                                                            <div key={it.type}>{it.label} {formatBaht(it.amount)}</div>
                                                        ))}
                                                        {!i.utilities_recorded && <div style={{ color: '#b45309' }}>รอบันทึกมิเตอร์</div>}
                                                    </div>
                                                </td>
                                                <td>{formatDate(i.due_date)}</td>
                                                <td>
                                                    <span className={`ad-pill ${pillClass(i)}`}>
                                                        {i.status === 'UNPAID' && i.overdue ? 'เกินกำหนด' : INVOICE_STATUS_LABEL[i.status]}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
                                                        {i.payment?.ref ? (
                                                            <>
                                                                <div>{i.payment.method === 'CARD' ? `บัตร •••• ${i.payment.card_last4}` : 'PromptPay'}</div>
                                                                <div style={{ color: 'var(--gray-400)', fontFamily: 'monospace' }}>{i.payment.ref}</div>
                                                            </>
                                                        ) : (
                                                            <span style={{ color: 'var(--gray-400)' }}>-</span>
                                                        )}
                                                        {i.rejections?.length > 0 && (
                                                            <div style={{ color: '#b91c1c' }}>
                                                                ถูกปฏิเสธ {i.rejections.length} ครั้ง: {i.rejections[i.rejections.length - 1].reason}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    {i.status === 'PAID' && (
                                                        <button onClick={() => setReviewing({ kind: 'INVOICE', doc: i })} className="ad-btn review">
                                                            ตรวจสอบ
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })()}

                {/* === TAB: ห้องพัก === */}
                {tab === 'ห้องพัก' && (() => {
                    const filtered = rooms.filter(r => {
                        const q = searchRoom.toLowerCase();
                        return !q || r.room_number?.includes(q) || r.building_id?.building_name?.toLowerCase().includes(q) || r.type_id?.type_name?.toLowerCase().includes(q);
                    });
                    return (
                        <div>
                            <div className="ad-section-header">
                                <h2 className="ad-section-title">
                                    ห้องพักทั้งหมด <span className="ad-count-badge">{filtered.length}</span>
                                </h2>
                                <input
                                    className="ad-search-input"
                                    placeholder="ค้นหา ห้อง / อาคาร / ประเภท..."
                                    value={searchRoom}
                                    onChange={e => setSearchRoom(e.target.value)}
                                />
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
                                        {filtered.map(r => (
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
                    );
                })()}

                {/* === TAB: นิสิต === */}
                {tab === 'นิสิต' && (() => {
                    const filtered = students.filter(s => {
                        const q = searchStudent.toLowerCase();
                        return !q || s.student_code?.includes(q) || s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.faculty?.toLowerCase().includes(q);
                    });
                    return (
                    <div>
                        <div className="ad-section-header">
                            <h2 className="ad-section-title">
                                นิสิตทั้งหมด <span className="ad-count-badge">{filtered.length}</span>
                            </h2>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <input
                                    className="ad-search-input"
                                    placeholder="ค้นหา รหัสนิสิต / ชื่อ / อีเมล / คณะ..."
                                    value={searchStudent}
                                    onChange={e => setSearchStudent(e.target.value)}
                                />
                                <button
                                    onClick={() => setShowAddForm(!showAddForm)}
                                    className={`ad-add-btn ${showAddForm ? 'close' : ''}`}
                                >
                                    {showAddForm ? '✕ ปิด' : '+ เพิ่มนิสิต'}
                                </button>
                            </div>
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
                                    {filtered.map(s => (
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
                    );
                })()}
            </main>

            {reviewing && (
                <ReviewModal
                    target={reviewing}
                    onClose={() => setReviewing(null)}
                    onSubmit={submitReview}
                />
            )}
        </div>
    );
}