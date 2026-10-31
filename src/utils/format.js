// ตัวช่วยจัดรูปแบบที่ใช้หลายหน้า

export const formatBaht = (n) =>
  Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// '2026-11' -> 'พฤศจิกายน 2569'
export const formatMonth = (month) => {
  const [y, m] = String(month || '').split('-').map(Number);
  if (!y || !m) return month || '';
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
};

export const formatDate = (d) => (d ? new Date(d).toLocaleDateString('th-TH') : '-');

// ชื่อรายการในบิล เช่น 'ค่าน้ำ (เหมาจ่ายห้อง 300 ÷ 2 คน)'
export const formatItemLabel = (item) => {
  if ((item.type !== 'WATER' && item.type !== 'ELECTRIC') || !item.room_fee) return item.label;
  const name = item.type === 'WATER' ? 'ค่าน้ำ' : 'ค่าไฟ';
  const share = item.share > 1 ? ` ÷ ${item.share} คน` : '';
  return `${name} (เหมาจ่ายห้อง ${Number(item.room_fee).toLocaleString('th-TH')}${share})`;
};

// ชื่อบิลรายเดือน เช่น 'ค่าห้อง 16 พ.ย. – 15 ธ.ค. 2569' หรือ 'ค่าน้ำ-ไฟ พฤศจิกายน 2569'
export const formatBillTitle = (bill) => {
  if ((bill.invoice_kind || bill.kind) === 'UTILITY') return `ค่าน้ำ-ไฟ ${formatMonth(bill.month)}`;
  if (bill.period_start && bill.period_end) {
    const opt = { day: 'numeric', month: 'short' };
    const start = new Date(bill.period_start).toLocaleDateString('th-TH', opt);
    const end = new Date(bill.period_end).toLocaleDateString('th-TH', { ...opt, year: 'numeric' });
    return `ค่าห้อง ${start} – ${end}`;
  }
  return `ค่าห้อง ${formatMonth(bill.month)}`;
};

// เดือนปัจจุบันในรูปแบบ 'YYYY-MM'
export const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
