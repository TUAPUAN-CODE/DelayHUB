// cache สั้นๆ ของ /api/sheet/rows: คำขอที่เหมือนกันและเข้ามาพร้อมกัน (หลังมี sheetChanged ทุกหน้าที่เปิดอยู่โหลดพร้อมกัน) ใช้ query เดียวกัน
// TTL สั้นกว่าเวลาที่หน้าเว็บรอหลังมี event (debounce 400 ms + 800 ms) เพื่อให้ข้อมูลหลังบันทึกไม่ค้างเก่า และล้างทันทีเมื่อ worker นี้เป็นคนรับคำสั่งเขียน
const TTL_MS = 1000;
const MAX_KEYS = 50;

const entries = new Map(); // key -> { at, promise }

// อายุ cache นับจากตอนที่ query "เสร็จ" และระหว่างที่ยังรันอยู่ทุกคำขอที่เหมือนกันรอผลชุดเดียวกัน
// (เดิมนับจากตอนเริ่ม: query ที่ช้ากว่า 1 วินาทีทำให้ทุกคำขอถัดมาเริ่ม query ชุดใหม่ซ้อนกันจน DB รอคิว memory ทั้ง server)
const cached = (key, loader) => {
  const hit = entries.get(key);
  if (hit && (hit.pending || Date.now() - hit.at < TTL_MS)) return hit.promise;

  const entry = { at: Date.now(), pending: true, promise: null };
  entry.promise = loader();
  entries.set(key, entry);
  const settle = () => { entry.pending = false; entry.at = Date.now(); };
  // loader ล้มเหลว = ไม่เก็บ error ไว้ให้คนอื่น
  entry.promise.then(settle, () => { if (entries.get(key) === entry) entries.delete(key); });

  if (entries.size > MAX_KEYS) {
    const now = Date.now();
    for (const [k, v] of entries) if (!v.pending && now - v.at >= TTL_MS) entries.delete(k);
  }
  return entry.promise;
};

const invalidateSheetCache = () => entries.clear();

module.exports = { cached, invalidateSheetCache };
