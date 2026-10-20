import { STATUS_LIST } from "./statusZones";

/** statuses a Role sees first (the table loads / renders faster with fewer rows); each account can change it with "สถานะที่ดู". null = every status */
export const ROLE_STATUSES = {
  prep: ["จ่ายลงไลน์แล้ว", "อยู่ที่ไลน์", "รอใส่รถเข็น", "รอเตรียมวัตถุดิบใหม่", "ยังไม่มีความเคลื่อนไหว", "-"],
  cs1: ["รอห้องเย็นรับเข้า", "รอรับเข้าห้องเย็น", "อยู่ในห้องเย็น"],
  cs2: ["กำลังละลาย", "ละลายเสร็จแล้ว", "จ่ายลงไลน์แล้ว", "รอห้องเย็นรับเข้า", "รอรับเข้าห้องเย็น", "อยู่ในห้องเย็นใหญ่"],
  qc: ["รอ QC Check"],
  pack: ["รอ QC Check", "รอบรรจุเสร็จ", "รอบรรจุจัดส่ง", "รอห้องเย็นรับเข้า"],
};
/** every status the Sheet knows (the other labels a row can get are always shown, so no row is hidden by surprise) */
export const KNOWN_STATUSES = STATUS_LIST.map(([label]) => label).filter((l) => l !== "Done");
export const defaultStatuses = (role) => ROLE_STATUSES[role] || KNOWN_STATUSES;
