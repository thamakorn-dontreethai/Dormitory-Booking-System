import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatBaht, formatMonth, formatDate, formatItemLabel } from '../utils/format';
import './PaymentPage.css';
import './BillsPage.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const FILTERS = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'UNPAID', label: 'ค้างชำระ' },
  { key: 'DONE', label: 'ชำระแล้ว' },
];

// สถานะบิล -> ข้อความ/สี
const billStatus = (bill) => {
  if (bill.status === 'UNPAID') {
    if (!bill.utilities_recorded) return { label: 'รอบันทึกค่าน้ำ-ไฟ', className: 'waiting' };
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
  const payable = unpaid.filter(b => b.utilities_recorded);
  const unpaidTotal = payable.reduce((sum, b) => sum + b.amount, 0);
  // เดือนล่าสุดที่บันทึกค่าน้ำ/ไฟแล้ว
  const latestMetered = [...all].reverse().find(b => b.utilities_recorded);
  const water = latestMetered && itemOf(latestMetered, 'WATER');
  const elec = latestMetered && itemOf(latestMetered, 'ELECTRIC');

  const shown = all
    .filter(b => filter === 'ALL' || (filter === 'UNPAID' ? b.status === 'UNPAID' : b.status !== 'UNPAID'))
    .slice()
    .reverse(); // เดือนล่าสุดอยู่บน

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
              <div className={`bills-stat ${payable.length ? 'due' : ''}`}>
                <span className="bills-stat-label">ยอดค้างชำระ</span>
                <strong className="bills-stat-value">{formatBaht(unpaidTotal)} บาท</strong>
                <span className="bills-stat-sub">
                  {payable.length ? `${payable.length} บิล` : 'ไม่มีบิลค้างชำระ'}
                  {unpaid.length > payable.length && ` · รอบันทึกค่าน้ำ-ไฟ ${unpaid.length - payable.length} บิล`}
                </span>
              </div>
              <div className="bills-stat">
                <span className="bills-stat-label">💧 ค่าน้ำล่าสุด</span>
                <strong className="bills-stat-value">{water ? `${formatBaht(water.amount)} บาท` : '-'}</strong>
                <span className="bills-stat-sub">
                  {water ? `${formatMonth(latestMetered.month)} · ห้องใช้ ${water.units} หน่วย` : 'ยังไม่มีข้อมูล'}
                </span>
              </div>
              <div className="bills-stat">
                <span className="bills-stat-label">⚡ ค่าไฟล่าสุด</span>
                <strong className="bills-stat-value">{elec ? `${formatBaht(elec.amount)} บาท` : '-'}</strong>
                <span className="bills-stat-sub">
                  {elec ? `${formatMonth(latestMetered.month)} · ห้องใช้ ${elec.units} หน่วย` : 'ยังไม่มีข้อมูล'}
                </span>
              </div>
            </section>

            <div className="bills-toolbar">
              <h2>บิลรายเดือน</h2>
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
                {all.length === 0 ? 'ยังไม่มีบิล บิลจะออกทุกเดือนหลังจากเดือนแรกที่ชำระพร้อมการจอง' : 'ไม่มีบิลในหมวดนี้'}
              </p>
            ) : (
              <ul className="bills-list">
                {shown.map(bill => {
                  const st = billStatus(bill);
                  const canPay = bill.status === 'UNPAID' && bill.utilities_recorded;
                  return (
                    <li key={bill.invoice_id} className={`bills-card ${st.className}`}>
                      <div className="bills-card-head">
                        <div>
                          <div className="bills-month">{formatMonth(bill.month)}</div>
                          <div className="bills-meta">ห้อง {bill.room_number} · กำหนดชำระ {formatDate(bill.due_date)}</div>
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
                        {!bill.utilities_recorded && (
                          <div className="bills-pending-row">
                            <dt>ค่าน้ำ / ค่าไฟ</dt>
                            <dd>รอบันทึกมิเตอร์</dd>
                          </div>
                        )}
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
                        {canPay && (
                          <button className="pay-btn" onClick={() => navigate(`/PaymentPage?invoice=${bill.invoice_id}`)}>
                            ชำระ {formatBaht(bill.amount)} บาท
                          </button>
                        )}
                        {bill.status !== 'UNPAID' && (
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
              ค่าน้ำ-ค่าไฟคิดจากมิเตอร์ของห้อง หารเท่ากันตามจำนวนผู้พัก · กำหนดชำระภายในวันที่ 10 ของทุกเดือน
            </p>
          </>
        )}
      </main>
    </div>
  );
}
