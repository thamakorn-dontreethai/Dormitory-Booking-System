// src/pages/ConfirmationPage.jsx (ฉบับแก้ไขสมบูรณ์)

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ConfirmationPage.css';
import axios from 'axios';
const API_URL = 'http://localhost:3001';

// --- [แก้ไข] ย้ายคอมโพเนนต์ Modal ออกมาไว้ข้างนอก ---
function PaymentModal({ isOpen, onClose, onConfirm, bookingState, bookedRoom, user }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>ขั้นตอนการชำระเงิน</h2>
          <button onClick={onClose} className="modal-close-btn">&times;</button>
        </div>
        <div className="modal-body">
          <p>โปรดตรวจสอบข้อมูลการจองของคุณ:</p>
          <ul className="modal-details">
            {/* เพิ่มการตรวจสอบ user && bookedRoom ก่อนใช้งาน */}
            <li><strong>ผู้จอง:</strong> {user?.full_name}</li>
            <li><strong>ห้อง:</strong> {bookedRoom?.room_number} ({bookedRoom?.type_name})</li>
            <li><strong>ราคา:</strong> {bookedRoom?.monthly_price} บาท (ต่อเดือน)</li>
          </ul>
          <p className="payment-note">
            นี่คือการยืนยันการจอง ระบบจะบันทึกข้อมูลของคุณ
          </p>
        </div>
        <div className="modal-footer">
          <button className="cf-button back-button" onClick={onClose} disabled={bookingState === 'processing'}>
            ยกเลิก
          </button>
          <button 
            className="cf-button confirm-button" 
            onClick={onConfirm}
            disabled={bookingState === 'processing'}
          >
            {bookingState === 'processing' ? 'กำลังบันทึก...' : 'ยืนยันและจองทันที'}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function ConfirmationPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // --- State ---
  const [user, setUser] = useState(null);
  const [bookedRoom, setBookedRoom] = useState(null); // ข้อมูลห้องที่กำลังดู (จาก state หรือ API)
  const [roommates, setRoommates] = useState([]); // [ใหม่] รายชื่อผู้จองคนอื่นๆ
  const [bookingState, setBookingState] = useState('loading'); // loading, initial, processing, confirmed
  const [error, setError] = useState(null);
  // --- [เพิ่มใหม่] State สำหรับควบคุม Modal ---
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- Effect (Logic ใหม่ทั้งหมด) ---
  useEffect(() => {
    const loggedInUser = JSON.parse(localStorage.getItem('user') || 'null');
    if (!loggedInUser) {
      // [แก้ไข] Path ต้องตรงกับ main.jsx
      navigate('/LoginPage', { replace: true });
      return;
    }
    setUser(loggedInUser);

    const roomDataFromState = location.state?.bookedRoom;

    const fetchData = async () => {
      try {
        // 1. ตรวจสอบว่า "ฉัน" มีการจองอยู่แล้วหรือไม่
        const myRes = await axios.get(`${API_URL}/api/my-reservation`);
        const myBooking = myRes.data.reservation;

        let roomToFetch;
        let newBookingState = 'loading';

        // [แก้ไข] ตรวจสอบ "ห้องที่เพิ่งคลิก" (roomDataFromState) ก่อน
        if (roomDataFromState) {
          // --- กรณีที่ 1: ผู้ใช้เพิ่งคลิกห้องใหม่เข้ามา ---
          roomToFetch = roomDataFromState;
          setBookedRoom(roomDataFromState);

          if (myBooking && myBooking.room_id === roomDataFromState.room_id) {
            // คลิกห้องที่ตัวเองจองไว้อยู่แล้ว
            newBookingState = 'confirmed';
          } else {
            // คลิกห้องอื่น (ที่ยังไม่ได้จอง หรือจองห้องอื่นอยู่)
            newBookingState = 'initial';
          }

        } else if (myBooking) {
          // --- กรณีที่ 2: ผู้ใช้ไม่ได้คลิกห้องใหม่ (เช่น รีเฟรช) และมีข้อมูลการจองในระบบ ---
          roomToFetch = myBooking;
          setBookedRoom(myBooking);
          newBookingState = 'confirmed';
        
        } else {
          // --- กรณีที่ 3: ไม่มีจอง และไม่ได้กดจองมา ---
          alert('คุณยังไม่มีการจอง กรุณาเลือกห้องพักก่อน');
          // [แก้ไข] Path ต้องตรงกับ main.jsx
          navigate('/BookingPage', { replace: true });
          return;
        }
        
        setBookingState(newBookingState);

        // 2. [ใหม่] เมื่อรู้ ID ห้องแล้ว ให้ดึงข้อมูล "ผู้จองทั้งหมด" ในห้องนั้น
        if (roomToFetch) {
          const occupantsRes = await axios.get(`${API_URL}/api/reservations/by-room?room_id=${roomToFetch.room_id}`);
          setRoommates(occupantsRes.data.reservations || []);
        }

      } catch (err) {
        console.error("Failed to check reservation:", err);
        setError("ไม่สามารถโหลดข้อมูลได้");
        setBookingState('initial'); // หรือ 'error'
      }
    };

    fetchData();

  }, [navigate, location.state]);

  // --- ฟังก์ชันยืนยันการจอง (จะถูกเรียกจากใน Modal) ---
  const handleConfirmBooking = async () => {
    setBookingState('processing');
    try {
      const response = await axios.post(`${API_URL}/api/reservations`, {
        roomId: bookedRoom.room_id
      });

      if (response.data && response.data.reservation) {
        // [ใหม่] เพิ่มข้อมูลของฉันเข้าไปในรายชื่อ roommates
        setRoommates([...roommates, response.data.reservation]);
        alert(response.data.message);
        setBookingState('confirmed');
        setIsModalOpen(false); // <-- ปิด Modal เมื่อจองสำเร็จ
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      console.error("Booking failed:", err.response);
      alert('เกิดข้อผิดพลาด: ' + (err.response?.data?.message || 'ไม่สามารถจองห้องได้'));
      setBookingState('initial');
      // ไม่ต้องปิด Modal ถ้า Error
    }
  };

  // --- [เพิ่มใหม่] ฟังก์ชันยกเลิกการจอง ---
  const handleCancelBooking = async () => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองนี้? การดำเนินการนี้จะลบข้อมูลการจองของคุณทันที")) {
      return;
    }

    setBookingState('processing'); // แสดงสถานะกำลังโหลด
    try {
      const response = await axios.delete(`${API_URL}/api/my-reservation`);
      alert(response.data.message); // "ยกเลิกการจองสำเร็จ"
      
      // ส่งผู้ใช้กลับไปหน้าจองห้อง
      navigate('/BookingPage', { replace: true });

    } catch (err) {
      console.error("Cancellation failed:", err.response);
      alert('เกิดข้อผิดพลาด: ' + (err.response?.data?.message || 'ไม่สามารถยกเลิกการจองได้'));
      setBookingState('confirmed'); // หากล้มเหลว ให้กลับไปสถานะเดิม
    }
  };

  // --- หน้า Loading (สำคัญมาก) ---
  if (bookingState === 'loading' || !user || !bookedRoom) {
    return <div>กำลังโหลดข้อมูลการจอง...</div>;
  }

  // --- เตรียมข้อมูลสำหรับแสดงผล ---
  const roomDescription = `${bookedRoom.room_number} ${bookedRoom.type_name} (${bookedRoom.cooling_type})`;
  const monthlyPrice = bookedRoom.monthly_price;

  return (
    <div className="cf-wrapper">
      <div className="cf-container">
        
        <div className="cf-header">
          {bookingState === 'confirmed' ? 'ข้อมูลการจองของคุณ' : 'ดำเนินการจองห้องพัก'}
        </div>

        {/* --- ส่วนข้อมูลนิสิตและห้องพัก (ใช้ Input Fields) --- */}
        <div className="cf-student-info">
          <div className="info-field">
            <input type="text" value={`รหัสนิสิต: ${user.student_code}`} readOnly />
          </div>
          <div className="info-field">
            <input type="text" value={`ชื่อ-สกุล: ${user.full_name}`} readOnly />
          </div>
        </div>
        <div className="cf-room-details">
          <div className="info-field">
            <input type="text" value={`ห้อง: ${roomDescription}`} readOnly />
          </div>
          <div className="info-field">
            <input type="text" value={`ราคาต่อเดือน: ${monthlyPrice} บาท`} readOnly />
          </div>
        </div>
        
        {/* --- [แก้ไข] ส่วนตารางผู้เข้าพัก --- */}
        <div className="cf-roommate-section">
          <div className="roommate-header">
            ข้อมูลผู้เข้าพักห้อง {bookedRoom.room_number}
          </div>
          <div className="roommate-table-container">
            <table className="cf-table">
              <thead>
                <tr>
                  <th>เลขห้อง</th>
                  <th>รหัสนิสิต</th>
                  <th>ชื่อ-สกุล</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {roommates.length > 0 ? (
                  // 1. แสดงรายชื่อทุกคนที่จองแล้ว (รวมถึงตัวเรา ถ้าจองสำเร็จ)
                  roommates.map(mate => (
                    <tr key={mate.student_code}>
                      <td>{mate.room_number}</td>
                      <td>{mate.student_code}</td>
                      <td>{mate.full_name}</td>
                      <td><span className="note-confirmed">{mate.status === 'CONFIRMED' ? 'จองสำเร็จ' : 'รอชำระเงิน'}</span></td>
                    </tr>
                  ))
                ) : (
                  // 2. ถ้าไม่มีใครจองเลย และเรากำลังจะจอง
                  <tr>
                    <td colSpan="4" className="cf-table-empty-prompt">
                      ยังไม่มีผู้เข้าพัก (รอการยืนยัน)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- ส่วนปุ่มดำเนินการ --- */}
        <div className="cf-actions">
          {bookingState === 'initial' && (
            <button 
              className="cf-button confirm-button" 
              onClick={() => setIsModalOpen(true)}
            >
              ยืนยันการจองและชำระเงิน
            </button>
          )}
          {bookingState === 'processing' && (
            <button className="cf-button confirm-button" disabled>
              กำลังดำเนินการ...
            </button>
          )}
          {bookingState === 'confirmed' && (
            <>
            <div className="success-message">
              ✅ การจองของคุณเสร็จสมบูรณ์แล้ว
            </div>
              {/* [เพิ่มใหม่] ปุ่มยกเลิกการจอง */}
              <button className="cf-button cancel-button" onClick={handleCancelBooking}>
                ยกเลิกการจองนี้
              </button>
            </>
          )}
          <button className="cf-button back-button" onClick={() => navigate('/BookingPage')}>
            กลับไปหน้าเลือกห้อง
          </button>
        </div>
      </div>

      {/* --- Render Modal --- */}
      {isModalOpen && (
        <PaymentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmBooking}
          bookingState={bookingState}
          bookedRoom={bookedRoom}
          user={user}
        />
      )}
    </div>
  );
}

