// cache ของ /api/sheet/rows: คำขอที่เหมือนกันใช้ query ชุดเดียว — ภายใน worker (Map) และข้าม PM2 worker / เครื่อง (Redis)
// เดิมทุกหน้า Sheet ที่เปิดอยู่โหลดแบบ fresh (ข้าม cache) ทุกครั้งที่มีการบันทึกที่ไหนก็ได้ → N หน้าจอ = N ชุด query หนักพร้อมกัน จน DB ทั้ง server รอคิว
// ตอนนี้: คำขอบอก "ต้องเป็นข้อมูลที่เริ่มอ่านหลังเวลา minStart" (เวลาของ event sheetChanged หรือเวลาที่คำขอ fresh มาถึง)
//   - ชุดที่กำลังอ่านอยู่และเริ่มหลัง minStart: รอผลชุดเดียวกัน
//   - ชุดที่อ่านเสร็จแล้ว: ใช้ซ้ำได้ TTL_MS หลังอ่านเสร็จ (และต้องเริ่มหลัง minStart)
//   - ข้าม worker: worker แรกที่ได้ล็อกใน Redis เป็นคนอ่าน worker อื่นรอผลจาก Redis (Redis ใช้ไม่ได้ = อ่านเองแบบเดิม)
const crypto = require("crypto");
const logger = require("./logger");

const TTL_MS = parseInt(process.env.SHEET_CACHE_TTL_MS, 10) || 2000;
const MAX_KEYS = 50;
const LOCK_MS = 45000;          // ล็อกของคนอ่าน (ยาวกว่า requestTimeout ของ query) — ตายกลางทางล็อกหมดอายุเอง
const WAIT_MS = 40000;          // worker อื่นรอผลได้นานเท่านี้ แล้วอ่านเอง
const POLL_MS = 150;
const STORE_MS = 60000;         // ผลใน Redis เก็บไว้นานเท่านี้ (ใช้ได้จริงแค่ TTL_MS — ที่เหลือไว้กันพลาดตอนรอ)

const entries = new Map(); // key -> { startedAt, finishedAt, pending, promise }

// ---- Redis (สร้างเมื่อใช้ครั้งแรก — สคริปต์ที่ require SheetRoutes จะไม่เปิด connection) ----
let redis = null;
const getRedis = () => {
  if (process.env.SHEET_CACHE_SHARED === "off") return null;
  if (!redis) {
    try {
      const { createRedis } = require("./redisClient");
      redis = createRedis("sheetCache");
      redis.connect().catch((err) => logger.warn("sheet_cache_redis_connect_failed", { error: err.message }));
    } catch (err) {
      logger.warn("sheet_cache_redis_unavailable", { error: err.message });
      redis = false;
    }
  }
  return redis && redis.isReady ? redis : null;
};
const lockId = `${process.pid}:${crypto.randomBytes(4).toString("hex")}`;
const rkey = (key) => `pfcm:sheetcache:${crypto.createHash("md5").update(key).digest("hex")}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// เก็บเป็น "<meta JSON>\n<ค่า JSON>" (JSON.stringify ไม่มีขึ้นบรรทัดใหม่จริง จึงแยกด้วย \n ได้)
const readShared = async (r, k) => {
  const raw = await r.get(`${k}:data`);
  if (!raw) return null;
  const nl = raw.indexOf("\n");
  if (nl < 0) return null;
  const meta = JSON.parse(raw.slice(0, nl));
  return { ...meta, value: JSON.parse(raw.slice(nl + 1)) };
};
const usable = (meta, minStart) => meta && meta.startedAt >= minStart && Date.now() - meta.finishedAt < TTL_MS;

// คืน { value, startedAt } — startedAt = เวลาที่ชุดข้อมูลนี้เริ่มอ่านจริง (อาจเป็นของ worker อื่น)
// Redis มีปัญหา = อ่านเอง; query ของเราล้มเหลว = ส่ง error ต่อ (ไม่อ่านซ้ำ — ตอน DB ช้าอยู่แล้วการลองซ้ำยิ่งเพิ่มภาระ)
const loadShared = async (key, loader, minStart) => {
  const startedAt = Date.now();
  const r = getRedis();
  if (!r) return { value: await loader(), startedAt };
  const k = rkey(key);
  let mine = false;
  try {
    const hit = await readShared(r, k);
    if (usable(hit, minStart)) return { value: hit.value, startedAt: hit.startedAt };
    const seen = hit ? hit.finishedAt : 0;
    mine = (await r.set(`${k}:lock`, lockId, { NX: true, PX: LOCK_MS })) === "OK";
    if (!mine) {
      // อีก worker กำลังอ่าน: รอผลชุดใหม่ของมัน (ต้องเริ่มหลัง minStart) — ล็อกหายแต่ไม่มีผลที่ใช้ได้ = อ่านเอง
      const until = Date.now() + WAIT_MS;
      while (Date.now() < until) {
        await sleep(POLL_MS);
        const next = await readShared(r, k);
        if (next && next.finishedAt > seen && next.startedAt >= minStart) return { value: next.value, startedAt: next.startedAt };
        if (!(await r.exists(`${k}:lock`))) break;
      }
    }
  } catch (err) {
    logger.warn("sheet_cache_shared_failed", { error: err.message });
  }
  if (!mine) return { value: await loader(), startedAt: Date.now() };

  try {
    const value = await loader();
    const meta = { startedAt, finishedAt: Date.now() };
    r.set(`${k}:data`, `${JSON.stringify(meta)}\n${JSON.stringify(value)}`, { PX: STORE_MS })
      .catch((err) => logger.warn("sheet_cache_store_failed", { error: err.message }));
    return { value, startedAt };
  } finally {
    r.eval('if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end', { keys: [`${k}:lock`], arguments: [lockId] }).catch(() => {});
  }
};

/**
 * @param key      คำขอที่ key เดียวกัน = ข้อมูลชุดเดียวกัน
 * @param loader   อ่านจาก DB (คืนค่าที่ JSON.stringify ได้)
 * @param minStart (ms) ต้องเป็นข้อมูลที่เริ่มอ่านตั้งแต่เวลานี้ — 0 = ชุดไหนก็ได้ที่ยังไม่เกิน TTL
 */
const cached = (key, loader, { minStart = 0 } = {}) => {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit) {
    // กำลังอ่าน: ผลที่จะได้เริ่มอ่านหลัง hit.minStart แน่นอน · อ่านเสร็จแล้ว: รู้เวลาเริ่มจริง
    if (hit.pending && minStart <= hit.minStart) return hit.promise;
    if (!hit.pending && hit.startedAt >= minStart && now - hit.finishedAt < TTL_MS) return hit.promise;
  }

  const entry = { minStart, startedAt: 0, finishedAt: 0, pending: true, promise: null };
  const run = loadShared(key, loader, minStart);
  entry.promise = run.then((r) => r.value);
  entries.set(key, entry);
  // loader ล้มเหลว = ไม่เก็บ error ไว้ให้คนอื่น
  run.then(
    (r) => { entry.pending = false; entry.startedAt = r.startedAt; entry.finishedAt = Date.now(); },
    () => { if (entries.get(key) === entry) entries.delete(key); },
  );

  if (entries.size > MAX_KEYS) {
    for (const [k, v] of entries) if (!v.pending && now - v.finishedAt >= TTL_MS) entries.delete(k);
  }
  return entry.promise;
};

// มีการบันทึกใน worker นี้: ชุดที่อ่านเสร็จแล้วใช้ไม่ได้ (ชุดที่กำลังอ่านยังให้คนที่รออยู่ใช้ — คำขอใหม่ส่ง minStart หลังการบันทึกเอง)
const invalidateSheetCache = () => {
  for (const [k, v] of entries) if (!v.pending) entries.delete(k);
};

module.exports = { cached, invalidateSheetCache, TTL_MS };
