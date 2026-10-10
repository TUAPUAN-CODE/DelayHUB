// นับ request แก้ข้อมูล (POST/PUT/PATCH/DELETE) ที่กำลังรอ server — ใช้แสดงแถบโหลดด้านบนจอ (component/Layout/MutationProgressBar.jsx)
// ปุ่มส่วนใหญ่ของระบบยังไม่มี loading state ของตัวเอง แถบนี้ทำให้ผู้ใช้เห็นว่า "กำลังบันทึก" ทุกหน้า โดยไม่ต้องแก้ทีละปุ่ม
let pending = 0;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export const beginMutation = () => { pending += 1; emit(); };
export const endMutation = () => { pending = Math.max(0, pending - 1); emit(); };
export const subscribeMutations = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getPendingMutations = () => pending;
