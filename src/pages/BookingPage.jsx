import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './BookingPage.css';
import axios from 'axios';
const API_URL = 'http://localhost:3001';

// --- Profile & Reservation Modal Component ---
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
            <li><strong>ชื่อ-สกุล:</strong> {user.full_name}</li>
            <li><strong>รหัสนิสิต:</strong> {user.student_code}</li>
          </ul>

          <h3>ข้อมูลการจอง</h3>
          {reservation ? (
            <div className="reservation-info">
              <ul className="modal-details">
                <li><strong>ห้อง:</strong> {reservation.room_number} ({reservation.type_name})</li>
                <li><strong>สถานะ:</strong> 
                  <span className={`status-pill ${reservation.status === 'PENDING' ? 'status-pending' : 'status-ok'}`}>
                    {reservation.status === 'PENDING' ? 'รอชำระเงิน' : 'ชำระเงินแล้ว'}
                  </span>
                </li>
              </ul>
              {reservation.status === 'PENDING' && (
                <button 
                  className="cf-button confirm-button"
                  onClick={handlePaymentClick}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'กำลังดำเนินการ...' : 'จำลองการชำระเงิน'}
                </button>
              )}
            </div>
          ) : (
            <p className="no-booking">คุณยังไม่มีการจองห้องพัก</p>
          )}
        </div>

        <div className="modal-footer">
          <button className="cf-button logout-button" onClick={onLogout}>
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main BookingPage Component ---
export default function BookingPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [selected, setSelected] = useState('');
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myReservation, setMyReservation] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const roomsPerPage = 9;

  // --- Logic Hooks ---
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    if (!u) {
      navigate('/LoginPage', { replace: true });
      return;
    }
    setUser(u);
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    
    axios.get(`${API_URL}/api/buildings`, { params: { gender: user.gender } })
      .then(res => setBuildings(res.data || []))
      .catch(() => setBuildings([]));
    
    axios.get(`${API_URL}/api/my-reservation`)
      .then(res => setMyReservation(res.data.reservation || null))
      .catch(err => console.error("Failed to fetch my reservation:", err));
  }, [user]);

  useEffect(() => {
    const fetchRooms = () => {
      if (!selected) { setRooms([]); return; }
      setLoading(true);
      axios.get(`${API_URL}/api/rooms/by-building`, { params: { building_id: selected } })
        .then(res => {
          const sortedRooms = (res.data || []).sort((a, b) => {
            const numA = parseInt(a.room_number, 10);
            const numB = parseInt(b.room_number, 10);
            return numA - numB;
          });
          setRooms(sortedRooms);
          setCurrentPage(1); // reset when select new building
        })
        .catch(err => {
          console.error('Failed to fetch rooms:', err);
          setRooms([]);
        })
        .finally(() => setLoading(false));
    };
    fetchRooms();
  }, [selected]);

  const handleLogout = () => {
    navigate('/HomePage', { replace: true });
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };
  
  const title = useMemo(() => `จองหอพักนิสิต – 🎃`, []);

  const handleSimulatePayment = async () => {
    try {
      const res = await axios.patch(`${API_URL}/api/my-reservation/confirm`);
      if (res.data.success) {
        setMyReservation(res.data.reservation);
        alert(res.data.message);
      }
    } catch (err) {
      console.error("Payment failed:", err.response);
      alert('เกิดข้อผิดพลาด: ' + (err.response?.data?.message || 'ไม่สามารถชำระเงินได้'));
    }
  };

  if (!user) return null;

  const hasActiveBooking = !!myReservation;

  // --- Pagination logic ---
  const indexOfLastRoom = currentPage * roomsPerPage;
  const indexOfFirstRoom = indexOfLastRoom - roomsPerPage;
  const currentRooms = rooms.slice(indexOfFirstRoom, indexOfLastRoom);
  const totalPages = Math.ceil(rooms.length / roomsPerPage);

  return (
    <div className="bk-wrapper">
      <header className="bk-header">
        <div className="title">
          <h1>{title}</h1>
          <div className="subtitle">ระบบ KU@SRC · เลือกอาคารเพื่อจองหรือยกเลิก</div>
        </div>
        <div className="userbox" onClick={() => setIsProfileModalOpen(true)} style={{cursor: 'pointer'}}>
          {user && (
            <>
              <div className="name">{user.full_name}</div>
              <span className="badge mono">{user.gender ?? 'N/A'}</span>
            </>
          )}
        </div>
      </header>

      <div className="card">
        <div className="card-body">
          <div className="bk-toolbar">
            <label htmlFor="building-select">ขั้นตอนที่ 1: เลือกอาคารที่ต้องการ</label>
            <select
              id="building-select"
              className="bk-select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">-- กรุณาเลือกอาคาร --</option>
              {buildings.map(b => (
                <option key={b.building_id} value={b.building_id}>
                  {b.building_name}
                </option>
              ))}
            </select>
          </div>

          {selected ? (
            <div className="overflow-x-auto">
              <table className="bk-table">
                <thead>
                  <tr>
                    <th>เลขห้อง</th>
                    <th>ประเภท</th>
                    <th>เครื่องทำความเย็น</th>
                    <th>จำนวนจอง</th>
                    <th>สถานะ</th>
                    <th>ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={6} className="bk-prompt">กำลังโหลดข้อมูลห้อง...</td></tr>
                  )}
                  {!loading && currentRooms.length === 0 && (
                    <tr><td colSpan={6} className="bk-prompt">ไม่พบข้อมูลห้องพักในอาคารนี้</td></tr>
                  )}
                  {!loading && currentRooms.map((r) => {
                    const isFull = r.booked_count >= r.capacity;
                    const disabledRoom = r.is_disabled === 1;
                    const isMyRoom = hasActiveBooking && myReservation.room_id === r.room_id;
                    return (
                      <tr key={r.room_id} className={isMyRoom ? 'my-room-row' : ''}>
                        <td><strong>{r.room_number}</strong></td>
                        <td>{r.type_name} ({r.capacity} คน)</td>
                        <td>
                          <span className={`cooling-pill ${r.cooling_type?.toLowerCase()}`}>
                            {r.cooling_type === 'AC' ? '❄️ แอร์' : '💨 พัดลม'}
                          </span>
                        </td>
                        <td>{r.booked_count} / {r.capacity}</td>
                        <td>
                          {disabledRoom ? (
                            <span className="status-pill status-access">ห้องพักคนพิการ</span>
                          ) : isMyRoom ? (
                            <span className="status-pill status-my-room">ห้องของคุณ</span>
                          ) : isFull ? (
                            <span className="status-pill status-full">เต็ม</span>
                          ) : (
                            <span className="status-pill status-ok">ว่าง</span>
                          )}
                        </td>
                        <td>
                          <div className="actions">
                            <button
                              disabled={isFull || disabledRoom || (hasActiveBooking && !isMyRoom)}
                              className={`btn ${isFull || disabledRoom || (hasActiveBooking && !isMyRoom) ? '' : 'btn-primary'}`}
                              onClick={() => {
                                navigate('/ConfirmationPage', { state: { bookedRoom: r } });
                              }}
                            >
                              {isMyRoom ? 'ดูการจอง' : 'จอง'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="page-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                  >
                    ◀ ก่อนหน้า
                  </button>

                  <span className="page-info">
                    หน้า {currentPage} / {totalPages}
                  </span>

                  <button
                    className="page-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    ถัดไป ▶
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bk-prompt">
              <h3>ยังไม่เลือกอาคาร</h3>
              <p>กรุณาเลือกอาคารจากเมนูด้านบนเพื่อดูรายการห้องพัก</p>
            </div>
          )}
        </div>
      </div>
  
      {user && (
        <ProfileModal
          user={user}
          reservation={myReservation}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onSimulatePayment={handleSimulatePayment}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
