import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatBaht, formatMonth, formatDate, formatItemLabel, formatBillTitle } from '../utils/format';
import './PaymentPage.css';
import './BillsPage.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const FILTERS = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'UNPAID', label: 'ค้างชำระ' },
  { key: 'RENT', label: 'ค่าห้อง' },
  { key: 'UTILITY', label: 'ค่าน้ำ-ไฟ' },
  { key: 'DONE', label: 'ชำระแล้ว' },
];

const matchFilter = (bill, filter) => {
  if (filter === 'UNPAID') return bill.status === 'UNPAID';
  if (filter === 'DONE') return bill.status !== 'UNPAID';
  if (filter === 'RENT' || filter === 'UTILITY') return bill.invoice_kind === filter;
  return true;
};

// สถานะบิล -> ข้อความ/สี
const billStatus = (bill) => {
  if (bill.status === 'UNPAID') {
    return bill.overdue
      ? { label: 'เกินกำหนดชำระ', className: 'overdue' }
      : { label: 'ค้างชำระ', className: 'unpaid' };
  }
  if (bill.status === 'PAID') return { label: 'รอตรวจสอบ', className: 'reviewing' };
  return { label: 'ชำระแล้ว', className: 'approved' };
};

const itemOf = (bill, type) => bill.items?.find(it => it.type === type);

export default function BillsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [bills, setBills] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    if (!u) { navigate('/LoginPage', { replace: true, state: { from: '/BillsPage' } }); return; }
    setUser(u);
    axios.get(`${API_URL}/api/my-invoices`)
      .then(res => setBills(Array.isArray(res.data) ? res.data : []))
      .catch(e => setErr(e?.response?.data?.message || 'ไม่สามารถโหลดข้อมูลบิลได้'));
  }, [navigate]);

  if (!user) return null;

  const all = bills || [];
  const unpaid = all.filter(b => b.status === 'UNPAID');
  const unpaidTotal = unpaid.reduce((sum, b) => sum + b.amount, 0);
  // บิลค่าห้องที่ครบกำหนดถัดไป
  const nextRent = all.find(b => b.invoice_kind === 'RENT' && b.status === 'UNPAID');
  // บิลค่าน้ำ-ไฟล่าสุด
  const latestUtility = [...all].reverse().find(b => b.invoice_kind === 'UTILITY');
  const water = latestUtility && itemOf(latestUtility, 'WATER');
  const elec = latestUtility && itemOf(latestUtility, 'ELECTRIC');

  const shown = all.filter(b => matchFilter(b, filter)).slice().reverse(); // ล่าสุดอยู่บน

  return (
    <div className="bills-page">
      <header className="bills-header">
        <button type="button" className="bills-back" onClick={() => navigate('/BookingPage')}>← กลับหน้าจองห้อง</button>
        <h1>ชำระค่าห้อง ค่าน้ำ ค่าไฟ</h1>
        <p>{user.full_name} · {user.student_code}</p>
      </header>

      <main className="bills-main">
        {err && <div className="pay-error">{err}</div>}
        {!err && bills === null && <div className="pay-loading">กำลังโหลดข้อมูล...</div>}

        {bills && (
          <>
            <section className="bills-stats">
              <div className={`bills-stat ${unpaid.length ? 'due' : ''}`}>
                <span className="bills-stat-label">ยอดค้างชำระ</span>
                <strong className="bills-stat-value">{formatBaht(unpaidTotal)} บาท</strong>
                <span className="bills-stat-sub">{unpaid.length ? `${unpaid.length} บิล` : 'ไม่มีบิลค้างชำระ'}</span>
              </div>
              <div className="bills-stat">
                <span className="bills-stat-label">🏠 ค่าห้องครบกำหนดถัดไป</span>
                <strong className="bills-stat-value">{nextRent ? formatDate(nextRent.due_date) : '-'}</strong>
                <span className="bills-stat-sub">
                  {nextRent ? `${formatBaht(nextRent.amount)} บาท · ตามวันที่จอง` : 'ยังไม่มีบิลค่าห้องที่ต้องจ่าย'}
                </span>
              </div>
              <div className="bills-stat">
                <span className="bills-stat-label">💧⚡ ค่าน้ำ-ไฟล่าสุด</span>
                <strong className="bills-stat-value">{latestUtility ? `${formatBaht(latestUtility.amount)} บาท` : '-'}</strong>
                <span className="bills-stat-sub">
                  {latestUtility
                    ? `${formatMonth(latestUtility.month)} · น้ำ ${formatBaht(water?.amount)} · ไฟ ${formatBaht(elec?.amount)}`
                    : 'ยังไม่มีข้อมูล'}
                </span>
              </div>
            </section>

            <div className="bills-toolbar">
              <h2>บิลของฉัน</h2>
              <div className="bills-filters" role="tablist">
                {FILTERS.map(f => (
                  <button
                    key={f.key}
                    role="tab"
                    aria-selected={filter === f.key}
                    className={`bills-filter ${filter === f.key ? 'active' : ''}`}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {shown.length === 0 ? (
              <p className="bills-empty">
                {all.length === 0
                  ? 'ยังไม่มีบิล บิลค่าห้องจะออกล่วงหน้า 7 วันก่อนครบกำหนดตามวันที่จอง'
                  : 'ไม่มีบิลในหมวดนี้'}
              </p>
            ) : (
              <ul className="bills-list">
                {shown.map(bill => {
                  const st = billStatus(bill);
                  return (
                    <li key={bill.invoice_id} className={`bills-card ${st.className}`}>
                      <div className="bills-card-head">
                        <div>
                          <span className={`bills-kind ${bill.invoice_kind === 'UTILITY' ? 'utility' : 'rent'}`}>
                            <i className={`fa-solid ${bill.invoice_kind === 'UTILITY' ? 'fa-bolt' : 'fa-house'}`}></i>
                            {bill.invoice_kind === 'UTILITY' ? 'ค่าน้ำ-ไฟ' : 'ค่าห้อง'}
                          </span>
                          <div className="bills-month">{formatBillTitle(bill)}</div>
                          <div className="bills-meta">ห้อง {bill.room_number} · ครบกำหนด {formatDate(bill.due_date)}</div>
                        </div>
                        <span className={`pay-status ${st.className}`}>{st.label}</span>
                      </div>

                      <dl className="bills-items">
                        {bill.items.map(item => (
                          <div key={item.type || item.label}>
                            <dt>{formatItemLabel(item)}</dt>
                            <dd>{formatBaht(item.amount)}</dd>
                          </div>
                        ))}
                        <div className="bills-total">
                          <dt>รวม</dt>
                          <dd>{formatBaht(bill.amount)} บาท</dd>
                        </div>
                      </dl>

                      {bill.last_rejection && (
                        <div className="bills-rejected">
                          การชำระครั้งก่อนถูกปฏิเสธ: {bill.last_rejection.reason} (คืนเงินแล้ว)
                        </div>
                      )}

                      <div className="bills-card-foot">
                        {bill.status === 'UNPAID' ? (
                          <button className="pay-btn" onClick={() => navigate(`/PaymentPage?invoice=${bill.invoice_id}`)}>
                            ชำระ {formatBaht(bill.amount)} บาท
                          </button>
                        ) : (
                          <button className="pay-btn secondary" onClick={() => navigate(`/PaymentPage?invoice=${bill.invoice_id}`)}>
                            ดูใบเสร็จ
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="bills-note">
              ค่าห้องครบกำหนดทุกเดือนตามวันที่จอง · ค่าน้ำ-ไฟเหมาจ่ายต่อห้อง หารเท่ากันตามจำนวนผู้พัก ครบกำหนดสิ้นเดือน
            </p>
          </>
        )}
      </main>
    </div>
  );
}
