// กันกดซ้ำทั้งระบบ: ถ้ามี request แก้ข้อมูล (POST/PUT/PATCH/DELETE) ที่ URL + body เดียวกันกำลังรออยู่ แล้วมีตัวที่สองถูกยิงซ้ำ
// (กดปุ่มสองครั้ง, มือถือค้างแล้วกดใหม่) จะไม่ยิงซ้ำไปที่ server แต่รอผลของตัวแรกแล้วใช้ผลเดียวกัน — ผลที่หน้าเว็บเห็นเหมือนเดิม
// ไม่แตะ GET, FormData/ไฟล์ และ request ที่ตั้ง config.dedupe = false
import axios from "axios";

const inflight = new Map();
const baseAdapter = axios.getAdapter(axios.defaults.adapter);

const keyOf = (config) => {
  const method = (config.method || "get").toLowerCase();
  if (method === "get" || method === "head" || method === "options") return null;
  if (config.dedupe === false) return null;
  const data = config.data;
  if (data != null && typeof data !== "string") return null; // axios ยังไม่ได้แปลง body = ไม่เสี่ยงเดา (ปกติ transformRequest ทำก่อน adapter แล้วเป็น string)
  return `${method} ${config.baseURL || ""}${config.url}?${JSON.stringify(config.params || {})}|${data || ""}`;
};

axios.defaults.adapter = (config) => {
  const key = keyOf(config);
  if (!key) return baseAdapter(config);
  const running = inflight.get(key);
  if (running) return running;
  const request = baseAdapter(config).finally(() => {
    if (inflight.get(key) === request) inflight.delete(key);
  });
  inflight.set(key, request);
  return request;
};
