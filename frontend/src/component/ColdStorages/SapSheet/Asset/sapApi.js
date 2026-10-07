import axios from "axios";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

const STAMP_URL = {
  start: "/api/coldstorages/scan/sap/start/defrost",
  end: "/api/coldstorages/scan/sap/end/defrost",
  dispatch: "/api/coldstorages/scan/sap",
};

export const STAMP_LABEL = {
  start: "เริ่มละลาย",
  end: "ละลายเสร็จ",
  dispatch: "จ่ายลงไลน์",
  checkin: "รับเข้าห้องเย็น",
};

export const fetchSapRows = async (days = 14) => {
  const res = await axios.get(`${API_URL}/api/coldstorages/sap/unified`, { params: { days } });
  if (!res.data?.success) throw new Error(res.data?.error || "โหลดรายการไม่สำเร็จ");
  return res.data.data || [];
};

/** @returns {{ok:true, round?:number, message:string} | {ok:false, message:string}} (never throws) */
export const postStamp = async (kind, { mat, batch, hu, weight }) => {
  try {
    const res = await axios.post(`${API_URL}${STAMP_URL[kind]}`, { mat, batch, hu, weight });
    return { ok: !!res.data?.success, round: res.data?.round, message: res.data?.message || "" };
  } catch (err) {
    console.error(`[sapApi] ${kind} error:`, err);
    const data = err.response?.data;
    return { ok: false, message: data?.message || data?.error || (err.response ? "เซิร์ฟเวอร์ตอบกลับผิดพลาด" : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้") };
  }
};

export const postCheckin = async ({ hu, supervisor }) => {
  try {
    const res = await axios.post(`${API_URL}/api/cs/checkin/rm`, { hu, supervisor });
    return { ok: !!res.data?.success, message: res.data?.message || "" };
  } catch (err) {
    console.error("[sapApi] checkin error:", err);
    const data = err.response?.data;
    return { ok: false, message: data?.error || data?.message || (err.response ? "เซิร์ฟเวอร์ตอบกลับผิดพลาด" : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้") };
  }
};
