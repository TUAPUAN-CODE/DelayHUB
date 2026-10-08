// ค่าที่ผูกกับ "เครื่อง/เบราว์เซอร์นี้" ไม่ใช่กับผู้ใช้ — ต้องไม่หายตอน login/logout
// (เดิม Login.jsx และ Logout.jsx เรียก localStorage.clear() ทำให้สวิตช์ "พิมพ์สลิปอัตโนมัติ" ถูกปิดเองทุกครั้งที่มีคนออกจากระบบ/เปิดหน้า login)
export const SLIP_PRINTER_ENABLE_KEY = "pfcm_rfid_slip_printer_enabled";
const DEVICE_KEYS = [SLIP_PRINTER_ENABLE_KEY];
// settings of the tables ("gridPrefs:<user_id>:<table>") are per user and are kept on purpose: they are the copy the table uses when the server has none
// (before: logging out wiped them, so the columns an account had chosen came back to the default after the next login)
const KEEP_PREFIXES = ["gridPrefs:"];

export const clearUserLocalStorage = () => {
  const keep = [];
  try {
    for (const k of DEVICE_KEYS) {
      const v = localStorage.getItem(k);
      if (v !== null) keep.push([k, v]);
    }
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && KEEP_PREFIXES.some((p) => k.startsWith(p))) keep.push([k, localStorage.getItem(k)]);
    }
    localStorage.clear();
    for (const [k, v] of keep) localStorage.setItem(k, v);
  } catch (err) {
    console.error("clearUserLocalStorage error:", err);
  }
};
