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

// ชื่อรายการในบิล เช่น 'ค่าน้ำ (12 หน่วย × 18 บาท ÷ 2 คน)'
export const formatItemLabel = (item) => {
  if (item.type !== 'WATER' && item.type !== 'ELECTRIC') return item.label;
  const share = item.share > 1 ? ` ÷ ${item.share} คน` : '';
  return `${item.label} (${item.units} หน่วย × ${item.rate} บาท${share})`;
};

// เดือนปัจจุบันในรูปแบบ 'YYYY-MM'
export const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
