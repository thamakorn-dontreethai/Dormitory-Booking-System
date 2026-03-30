import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './BookingPage.css';
import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.0.120:3001';

// --- Profile Modal ---
function ProfileModal({ user, reservation, isOpen, onClose, onSimulatePayment, onLogout }) {
  if (!isOpen) return null;
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentClick = async () => {
    setIsProcessing(true);
    await onSimulatePayment();
    setIsProcessing(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>ข้อมูลส่วนตัวและการจอง</h2>
          <button onClick={onClose} className="modal-close-btn">&times;</button>
        </div>
        <div className="modal-body">
          <h3>ข้อมูลนิสิต</h3>
          <ul className="modal-details">
            <li><strong>ชื่อ-สกุล:</strong> <span>{user.full_name}</span></li>
            <li><strong>รหัสนิสิต:</strong> <span>{user.student_code}</span></li>
          </ul>
          <h3>ข้อมูลการจอง</h3>
          {reservation ? (
            <div className="reservation-info">
              <ul className="modal-details">
                <li><strong>ห้อง:</strong> <span>{reservation.room_number} ({reservation.type_name})</span></li>
                <li><strong>สถานะ:</strong>
                  <span className={`status-pill ${reservation.status === 'PENDING' ? 'status-pending' : 'status-ok'}`}>
                    {reservation.status === 'PENDING' ? 'รอชำระเงิน' : 'ชำระเงินแล้ว'}
                  </span>
                </li>
              </ul>
              {reservation.status === 'PENDING' && (
                <button className="cf-button confirm-button" onClick={handlePaymentClick} disabled={isProcessing}>
                  {isProcessing ? 'กำลังดำเนินการ...' : 'จำลองการชำระเงิน'}
                </button>
              )}
            </div>
          ) : (
            <p className="no-booking">คุณยังไม่มีการจองห้องพัก</p>
          )}
        </div>
        <div className="modal-footer">
          <button className="cf-button logout-button" onClick={onLogout}>ออกจากระบบ</button>
        </div>
      </div>
    </div>
  );
}

// --- Main BookingPage ---
export default function BookingPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [selected, setSelected] = useState('');
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myReservation, setMyReservation] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const roomsPerPage = 9;

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    if (!u) { navigate('/LoginPage', { replace: true }); return; }
    setUser(u);
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    axios.get(`${API_URL}/api/buildings`, { params: { gender: user.gender } })
      .then(res => setBuildings(res.data || [])).catch(() => setBuildings([]));
    axios.get(`${API_URL}/api/my-reservation`)
      .then(res => setMyReservation(res.data.reservation || null))
      .catch(err => console.error(err));
  }, [user]);

  useEffect(() => {
    if (!selected) { setRooms([]); return; }
    setLoading(true);
    axios.get(`${API_URL}/api/rooms/by-building`, { params: { building_id: selected } })
      .then(res => {
        const sorted = (res.data || []).sort((a, b) =>
          parseInt(a.room_number) - parseInt(b.room_number));
        setRooms(sorted);
        setCurrentPage(1);
      })
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, [selected]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/HomePage', { replace: true });
  };

  const handleSimulatePayment = async () => {
    try {
      const res = await axios.patch(`${API_URL}/api/my-reservation/confirm`);
      if (res.data.success) { setMyReservation(res.data.reservation); alert(res.data.message); }
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + (err.response?.data?.message || 'ไม่สามารถชำระเงินได้'));
    }
  };

  if (!user) return null;

  const hasActiveBooking = !!myReservation;
  const indexOfLast = currentPage * roomsPerPage;
  const currentRooms = rooms.slice(indexOfLast - roomsPerPage, indexOfLast);
  const totalPages = Math.ceil(rooms.length / roomsPerPage);

  return (
    <div className="bk-wrapper">
      <header className="bk-header">
        <div className="title">
          <h1>จองหอพักนิสิต</h1>
          <div className="subtitle">เลือกอาคารเพื่อจอง</div>
        </div>
        <div className="userbox" onClick={() => setIsProfileModalOpen(true)}>
          <div className="name">{user.full_name}</div>
          <span className="badge mono">{user.gender ?? 'N/A'}</span>
        </div>
      </header>

      <div className="card">
        <div className="card-body">
          {/* Toolbar */}
          <div className="bk-toolbar">
            <label htmlFor="building-select">ขั้นตอนที่ 1: เลือกอาคารที่ต้องการ</label>
            <select id="building-select" className="bk-select" value={selected}
              onChange={(e) => setSelected(e.target.value)}>
              <option value="">-- กรุณาเลือกอาคาร --</option>
              {buildings.map(b => (
                <option key={b.building_id} value={b.building_id}>{b.building_name}</option>
              ))}
            </select>
          </div>

          {/* Room Grid */}
          {!selected ? (
            <div className="bk-prompt">
              <h3>ยังไม่เลือกอาคาร</h3>
              <p>กรุณาเลือกอาคารจากเมนูด้านบนเพื่อดูรายการห้องพัก</p>
            </div>
          ) : loading ? (
            <div className="bk-prompt"><p>กำลังโหลดข้อมูลห้อง...</p></div>
          ) : (
            <>
              <div className="room-grid">
                {currentRooms.length === 0 && (
                  <div className="room-grid-empty">
                    <span style={{ fontSize: 32 }}>🏠</span>
                    <p>ไม่พบข้อมูลห้องพักในอาคารนี้</p>
                  </div>
                )}

                {currentRooms.map((r) => {
                  const isFull = r.booked_count >= r.capacity;
                  const isDisabled = r.is_disabled === 1;
                  const isMyRoom = hasActiveBooking && myReservation.room_id === r.room_id;
                  const isAC = r.cooling_type === 'AC';
                  const fillPct = Math.round((r.booked_count / r.capacity) * 100);
                  const cantBook = isFull || isDisabled || (hasActiveBooking && !isMyRoom);

                  return (
                    <div key={r.room_id}
                      className={`room-card${isMyRoom ? ' my-room' : ''}${isFull && !isMyRoom ? ' is-full' : ''}`}>

                      {/* Top row */}
                      <div className="room-card-top">
                        <span className="room-number">{r.room_number}</span>
                        {isDisabled ? (
                          <span className="room-status access">♿ พิการ</span>
                        ) : isMyRoom ? (
                          <span className="room-status mine">✓ ของฉัน</span>
                        ) : isFull ? (
                          <span className="room-status full">เต็ม</span>
                        ) : (
                          <span className="room-status available">● ว่าง</span>
                        )}
                      </div>

                      {/* Type */}
                      <div className="room-type">{r.type_name} ({r.capacity} คน)</div>

                      {/* Meta */}
                      <div className="room-meta">
                        <span className={`cooling-pill ${isAC ? 'ac' : 'fan'}`}>
                          {isAC ? '❄️ แอร์' : '💨 พัดลม'}
                        </span>
                        <div className="room-occupancy">
                          <div className="occupancy-label">
                            <span>จำนวนคน</span>
                            <span>{r.booked_count} / {r.capacity}</span>
                          </div>
                          <div className="occupancy-bar">
                            <div className={`occupancy-fill${isFull ? ' full' : ''}`}
                              style={{ width: `${fillPct}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Button */}
                      <div className="room-card-footer">
                        <button
                          className={`room-book-btn${isMyRoom ? ' manage' : ''}`}
                          disabled={cantBook && !isMyRoom}
                          onClick={() => navigate('/ConfirmationPage', { state: { bookedRoom: r } })}
                        >
                          {isMyRoom ? 'ดูการจอง' : isFull ? 'ห้องเต็ม' : 'จอง'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button className="page-btn" disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}>← ก่อนหน้า</button>
                  <span className="page-info">หน้า {currentPage} / {totalPages}</span>
                  <button className="page-btn" disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}>ถัดไป →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {user && (
        <ProfileModal
          user={user} reservation={myReservation}
          isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)}
          onSimulatePayment={handleSimulatePayment} onLogout={handleLogout}
        />
      )}
    </div>
  );
}