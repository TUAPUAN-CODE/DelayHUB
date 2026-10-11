// cache สั้นๆ ของ /api/sheet/rows: คำขอที่เหมือนกันและเข้ามาพร้อมกัน (หลังมี sheetChanged ทุกหน้าที่เปิดอยู่โหลดพร้อมกัน) ใช้ query เดียวกัน
// TTL สั้นกว่าเวลาที่หน้าเว็บรอหลังมี event (debounce 400 ms + 800 ms) เพื่อให้ข้อมูลหลังบันทึกไม่ค้างเก่า และล้างทันทีเมื่อ worker นี้เป็นคนรับคำสั่งเขียน
const TTL_MS = 1000;
const MAX_KEYS = 50;

const entries = new Map(); // key -> { at, promise }

const cached = (key, loader) => {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;

  const promise = loader();
  const entry = { at: Date.now(), promise };
  entries.set(key, entry);
  // loader ล้มเหลว = ไม่เก็บ error ไว้ให้คนอื่น
  promise.catch(() => { if (entries.get(key) === entry) entries.delete(key); });

  if (entries.size > MAX_KEYS) {
    const now = Date.now();
    for (const [k, v] of entries) if (now - v.at >= TTL_MS) entries.delete(k);
  }
  return promise;
};

const invalidateSheetCache = () => entries.clear();

module.exports = { cached, invalidateSheetCache };
