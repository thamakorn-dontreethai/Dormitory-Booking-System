import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { formatBaht, formatMonth, formatDate, formatItemLabel } from '../utils/format';
import './PaymentPage.css';

const API_URL = import.meta.env.VITE_API_URL || '';

// ระยะเวลาจำลองการติดต่อธนาคาร
const PROCESSING_DELAY_MS = 1800;

const formatCardNumber = (value) =>
  value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');

const formatExpiry = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

const METHOD_LABEL = { PROMPTPAY: 'PromptPay (QR)', CARD: 'บัตรเครดิต/เดบิต' };

// QR สำหรับสาธิตเท่านั้น: สร้างลายจาก seed (สแกนจ่ายจริงไม่ได้)
function PaymentQr({ seed }) {
  const size = 25;
  const cells = useMemo(() => {
    let h = 2166136261;
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const out = [];
    const inFinder = (x, y) =>
      (x < 8 && y < 8) || (x >= size - 8 && y < 8) || (x < 8 && y >= size - 8);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (inFinder(x, y)) continue;
        h = Math.imul(h ^ (h >>> 15), 2246822507) ^ (x * 31 + y);
        if ((h >>> 0) % 2 === 0) out.push([x, y]);
      }
    }
    return out;
  }, [seed]);

  const finder = (x, y) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="currentColor" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="currentColor" />
    </g>
  );

  return (
    <svg className="pay-qr" viewBox={`-2 -2 ${size + 4} ${size + 4}`} role="img" aria-label="QR ชำระเงิน">
      <rect x="-2" y="-2" width={size + 4} height={size + 4} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
      {finder(0, 0)}
      {finder(size - 7, 0)}
      {finder(0, size - 7)}
    </svg>
  );
}

function Receipt({ summary, user, onBack, backLabel }) {
  const p = summary.payment;
  const isReviewing = summary.status === 'PAID';
  const isInvoice = summary.kind === 'INVOICE';
  return (
    <div className="pay-card pay-receipt">
      <div className={`pay-success-icon ${isReviewing ? 'reviewing' : ''}`} aria-hidden="true">
        {isReviewing ? '⏳' : '✓'}
      </div>
      <h2 className="pay-title center">ชำระเงินสำเร็จ</h2>
      <p className="pay-desc center">
        {isReviewing
          ? `กำลังรอเจ้าหน้าที่ตรวจสอบการชำระเงิน เมื่ออนุมัติแล้ว${isInvoice ? 'บิลจะเปลี่ยนเป็นชำระแล้ว' : 'การจองจะได้รับการยืนยัน'}`
          : `เจ้าหน้าที่ตรวจสอบแล้ว ${isInvoice ? 'บิลนี้ชำระเรียบร้อย' : 'การจองห้องพักของคุณได้รับการยืนยัน'}`}
      </p>

      <dl className="pay-rows">
        <div><dt>รายการ</dt><dd>{isInvoice ? `ค่าห้องประจำเดือน ${formatMonth(summary.month)}` : 'ค่าจองห้องพัก'}</dd></div>
        <div>
          <dt>สถานะ</dt>
          <dd><span className={`pay-status ${isReviewing ? 'reviewing' : 'approved'}`}>
            {isReviewing ? 'รอตรวจสอบ' : 'ยืนยันแล้ว'}
          </span></dd>
        </div>
        <div><dt>เลขอ้างอิง</dt><dd className="mono">{p.ref}</dd></div>
        <div><dt>วันที่ชำระ</dt><dd>{new Date(p.paid_at).toLocaleString('th-TH')}</dd></div>
        <div><dt>ผู้ชำระ</dt><dd>{user.full_name} ({user.student_code})</dd></div>
        <div><dt>ห้อง</dt><dd>{summary.building_name} ห้อง {summary.room_number}</dd></div>
        <div>
          <dt>ช่องทาง</dt>
          <dd>{METHOD_LABEL[p.method]}{p.card_last4 ? ` •••• ${p.card_last4}` : ''}</dd>
        </div>
        {summary.items.map(item => (
          <div key={item.type || item.label}><dt>{formatItemLabel(item)}</dt><dd>{formatBaht(item.amount)} บาท</dd></div>
        ))}
        <div className="pay-total"><dt>ยอดชำระ</dt><dd>{formatBaht(summary.amount)} บาท</dd></div>
      </dl>

      <div className="pay-actions no-print">
        <button className="pay-btn secondary" onClick={() => window.print()}>พิมพ์ใบเสร็จ</button>
        <button className="pay-btn" onClick={onBack}>{backLabel}</button>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  const navigate = useNavigate();
  // ?invoice=<id> = ชำระบิลรายเดือน, ไม่มี = ชำระค่าจองห้อง
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('invoice');
  const summaryUrl = invoiceId ? `${API_URL}/api/my-invoices/${invoiceId}` : `${API_URL}/api/my-reservation/payment`;
  const payUrl = invoiceId ? `${API_URL}/api/my-invoices/${invoiceId}/pay` : `${API_URL}/api/my-reservation/pay`;
  const backPath = invoiceId ? '/BillsPage' : '/BookingPage';
  const backLabel = invoiceId ? 'กลับหน้าค่าห้องรายเดือน' : 'กลับหน้าจองห้อง';

  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [method, setMethod] = useState('PROMPTPAY');
  const [card, setCard] = useState({ card_number: '', card_name: '', card_expiry: '', card_cvc: '' });
  const [err, setErr] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    if (!u) { navigate('/LoginPage', { replace: true }); return; }
    setUser(u);
    axios.get(summaryUrl)
      .then(res => setSummary(res.data))
      .catch(e => setLoadErr(e?.response?.data?.message || 'ไม่สามารถโหลดข้อมูลการชำระเงินได้'));
  }, [navigate, summaryUrl]);

  const onCardChange = (key) => (e) => {
    let value = e.target.value;
    if (key === 'card_number') value = formatCardNumber(value);
    if (key === 'card_expiry') value = formatExpiry(value);
    if (key === 'card_cvc') value = value.replace(/\D/g, '').slice(0, 3);
    if (key === 'card_name') value = value.toUpperCase();
    setCard(prev => ({ ...prev, [key]: value }));
  };

  const onPay = async (e) => {
    e?.preventDefault();
    setErr('');
    setProcessing(true);
    try {
      const body = method === 'CARD' ? { method, ...card } : { method };
      const [res] = await Promise.all([
        axios.post(payUrl, body),
        new Promise(r => setTimeout(r, PROCESSING_DELAY_MS)),
      ]);
      setSummary(res.data.receipt);
    } catch (e2) {
      setErr(e2?.response?.data?.message || 'ชำระเงินไม่สำเร็จ');
    } finally {
      setProcessing(false);
    }
  };

  const goBack = () => navigate(backPath);

  if (!user) return null;

  if (loadErr) {
    return (
      <div className="pay-wrapper">
        <div className="pay-card">
          <h2 className="pay-title">ชำระเงิน</h2>
          <div className="pay-error">{loadErr}</div>
          <div className="pay-actions">
            <button className="pay-btn" onClick={goBack}>{backLabel}</button>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return <div className="pay-wrapper"><div className="pay-loading">กำลังโหลดข้อมูล...</div></div>;
  }

  if (summary.payment) {
    return (
      <div className="pay-wrapper">
        <Receipt summary={summary} user={user} onBack={goBack} backLabel={backLabel} />
      </div>
    );
  }

  // ยืนยันแล้วแต่ไม่มีข้อมูลชำระเงิน (เช่น ผู้ดูแลอนุมัติการจองให้)
  if (summary.kind === 'BOOKING' && summary.status === 'CONFIRMED') {
    return (
      <div className="pay-wrapper">
        <div className="pay-card">
          <h2 className="pay-title">การจองได้รับการยืนยันแล้ว</h2>
          <p className="pay-desc">ผู้ดูแลระบบอนุมัติการจองห้อง {summary.room_number} แล้ว ไม่ต้องชำระเงินเพิ่ม</p>
          <div className="pay-actions">
            <button className="pay-btn" onClick={goBack}>กลับหน้าจองห้อง</button>
          </div>
        </div>
      </div>
    );
  }

  // บิลรายเดือนที่ยังไม่บันทึกค่าน้ำ/ไฟ ยังจ่ายไม่ได้
  if (summary.kind === 'INVOICE' && !summary.utilities_recorded) {
    return (
      <div className="pay-wrapper">
        <div className="pay-card">
          <h2 className="pay-title">บิลเดือน {formatMonth(summary.month)} ยังไม่พร้อมชำระ</h2>
          <p className="pay-desc">รอเจ้าหน้าที่บันทึกมิเตอร์ค่าน้ำ-ค่าไฟของห้อง {summary.room_number} เมื่อบันทึกแล้วจะชำระได้ทันที</p>
          <div className="pay-actions">
            <button className="pay-btn" onClick={goBack}>{backLabel}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pay-wrapper">
      <button type="button" className="pay-back-btn no-print" onClick={goBack} disabled={processing}>
        ← ย้อนกลับ
      </button>

      <div className="pay-layout">
        {/* สรุปยอด */}
        <aside className="pay-card pay-summary">
          <h3 className="pay-section-title">สรุปรายการ</h3>
          <dl className="pay-rows">
            {summary.kind === 'INVOICE' && (
              <div><dt>ประจำเดือน</dt><dd>{formatMonth(summary.month)}</dd></div>
            )}
            <div><dt>ผู้จอง</dt><dd>{user.full_name}</dd></div>
            <div><dt>อาคาร</dt><dd>{summary.building_name}</dd></div>
            <div><dt>ห้อง</dt><dd>{summary.room_number} ({summary.type_name})</dd></div>
            {summary.kind === 'INVOICE' && (
              <div>
                <dt>กำหนดชำระ</dt>
                <dd className={summary.overdue ? 'pay-overdue' : ''}>
                  {formatDate(summary.due_date)}{summary.overdue ? ' (เกินกำหนด)' : ''}
                </dd>
              </div>
            )}
            {summary.items.map(item => (
              <div key={item.type || item.label}><dt>{formatItemLabel(item)}</dt><dd>{formatBaht(item.amount)} บาท</dd></div>
            ))}
            <div className="pay-total"><dt>ยอดที่ต้องชำระ</dt><dd>{formatBaht(summary.amount)} บาท</dd></div>
          </dl>
        </aside>

        {/* ช่องทางชำระ */}
        <section className="pay-card">
          {summary.last_rejection && (
            <div className="pay-error pay-rejected">
              การชำระครั้งก่อนถูกปฏิเสธ: {summary.last_rejection.reason}
              <br />ระบบคืนเงินแล้ว เลขอ้างอิง <span className="mono">{summary.last_rejection.refund_ref}</span> กรุณาชำระใหม่
            </div>
          )}
          <h2 className="pay-title">เลือกช่องทางการชำระเงิน</h2>

          <div className="pay-methods" role="tablist">
            {Object.entries(METHOD_LABEL).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={method === key}
                className={`pay-method ${method === key ? 'active' : ''}`}
                onClick={() => { setMethod(key); setErr(''); }}
                disabled={processing}
              >
                {label}
              </button>
            ))}
          </div>

          {method === 'PROMPTPAY' ? (
            <div className="pay-promptpay">
              <PaymentQr seed={summary.invoice_id || summary.reserve_id} />
              <div className="pay-qr-amount">{formatBaht(summary.amount)} บาท</div>
              <p className="pay-hint">สแกน QR ด้วยแอปธนาคาร เมื่อโอนเรียบร้อยแล้วกดปุ่มด้านล่าง</p>
              {err && <div className="pay-error">{err}</div>}
              <button className="pay-btn full" onClick={onPay} disabled={processing}>
                {processing ? 'กำลังตรวจสอบการชำระเงิน...' : 'ชำระเงินเรียบร้อยแล้ว'}
              </button>
            </div>
          ) : (
            <form className="pay-form" onSubmit={onPay}>
              <label className="pay-field">
                <span>หมายเลขบัตร</span>
                <input
                  className="pay-input mono"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="4242 4242 4242 4242"
                  value={card.card_number}
                  onChange={onCardChange('card_number')}
                  disabled={processing}
                  required
                />
              </label>
              <label className="pay-field">
                <span>ชื่อบนบัตร</span>
                <input
                  className="pay-input"
                  autoComplete="off"
                  placeholder="SOMCHAI JAIDEE"
                  value={card.card_name}
                  onChange={onCardChange('card_name')}
                  disabled={processing}
                  required
                />
              </label>
              <div className="pay-field-row">
                <label className="pay-field">
                  <span>วันหมดอายุ</span>
                  <input
                    className="pay-input mono"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="MM/YY"
                    value={card.card_expiry}
                    onChange={onCardChange('card_expiry')}
                    disabled={processing}
                    required
                  />
                </label>
                <label className="pay-field">
                  <span>CVC</span>
                  <input
                    className="pay-input mono"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="123"
                    value={card.card_cvc}
                    onChange={onCardChange('card_cvc')}
                    disabled={processing}
                    required
                  />
                </label>
              </div>

              {err && <div className="pay-error">{err}</div>}
              <button className="pay-btn full" type="submit" disabled={processing}>
                {processing ? 'กำลังติดต่อธนาคาร...' : `ชำระเงิน ${formatBaht(summary.amount)} บาท`}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
