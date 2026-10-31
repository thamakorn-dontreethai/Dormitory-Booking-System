// ตัวช่วยเรื่อง session ของนิสิต/admin ที่เก็บใน localStorage

// token ยังไม่หมดอายุหรือไม่ (อ่าน exp จาก payload ของ JWT)
const isTokenValid = (token) => {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !payload.exp || payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

// ข้อมูลนิสิตที่ login อยู่ หรือ null (ล้างทิ้งถ้า token หมดอายุ)
export const getStudentSession = () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (token && user && isTokenValid(token)) return user;
  if (token || user) logoutStudent();
  return null;
};

export const saveStudentSession = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

export const logoutStudent = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const isAdminLoggedIn = () => {
  const token = localStorage.getItem('adminToken');
  if (isTokenValid(token)) return true;
  if (token) localStorage.removeItem('adminToken');
  return false;
};
