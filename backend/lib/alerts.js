// แจ้งเตือนเหตุผิดปกติของระบบเอง (คนละเรื่องกับ delayAlertWorker ที่แจ้งวัตถุดิบ delay)
// ตรวจทุก 30 วินาทีต่อ worker; กันแจ้งซ้ำด้วย Redis (SET NX EX) เพื่อให้ทั้งระบบแจ้งเรื่องเดียวกันไม่เกิน 1 ครั้งต่อ 15 นาที
// ส่ง LINE ได้เมื่อตั้ง OPS_ALERT_LINE_GROUP_ID + LINE_CHANNEL_ACCESS_TOKEN; ไม่ตั้ง = เขียน log (event "alert") อย่างเดียว
const metrics = require("./metrics");
const logger = require("./logger");
const { getAuthMode, getEnforceAt, isAutoMode, readMissing } = require("./authMiddleware");

const CHECK_MS = 30000;
const COOLDOWN_SECONDS = 15 * 60;
const POOL_PENDING_LIMIT = parseInt(process.env.ALERT_POOL_PENDING, 10) || 10;
const LAG_LIMIT_MS = parseInt(process.env.ALERT_EVENTLOOP_LAG_MS, 10) || 1500;
const ERROR_RATE = parseFloat(process.env.ALERT_5XX_RATE) || 0.05;
const MIN_REQUESTS = 20;

const notify = async (redis, key, text) => {
  try {
    if (redis && redis.isOpen) {
      const first = await redis.set(`pfcm:alert:${key}`, "1", { NX: true, EX: COOLDOWN_SECONDS });
      if (!first) return; // มี worker อื่นแจ้งไปแล้ว
    }
  } catch { /* Redis ใช้ไม่ได้: แจ้งต่อ (อาจซ้ำจากหลาย worker) ดีกว่าเงียบ */ }
  logger.error("alert", { key, text });
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const group = process.env.OPS_ALERT_LINE_GROUP_ID;
  if (!token || !group) return;
  try {
    const axios = require("axios"); // โหลดตอนจะส่งจริงเท่านั้น: ไม่มี axios = ไม่ส่ง LINE แต่ server ยังเปิดได้
    await axios.post(process.env.LINE_PUSH_URL || "https://api.line.me/v2/bot/message/push",
      { to: group, messages: [{ type: "text", text: `🚨 PFCM: ${text}` }] },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, timeout: 15000 });
  } catch (err) {
    logger.warn("alert_send_failed", { key, error: err.message });
  }
};

/** deps: { redis, getPoolStats, ping } — ping() เป็น async ที่ throw เมื่อ DB ใช้ไม่ได้ */
const startAlerts = ({ redis, getPoolStats, ping }) => {
  let poolHits = 0;
  let dbFails = 0;
  let prev = { total: 0, err: 0 };

  const tick = async () => {
    try {
      const pool = getPoolStats();
      poolHits = pool.pending > POOL_PENDING_LIMIT ? poolHits + 1 : 0;
      if (poolHits >= 2) await notify(redis, "pool_saturated", `คิว connection ฐานข้อมูลค้าง ${pool.pending} คำขอ (ใช้ ${pool.borrowed}/${pool.size}) ต่อเนื่อง — มี query ช้าหรือ connection leak`);

      try { await ping(); dbFails = 0; } catch (err) {
        dbFails += 1;
        if (dbFails >= 2) await notify(redis, "db_down", `เชื่อมต่อฐานข้อมูลไม่ได้ (${err.message})`);
      }

      const total = metrics.counterSumByPrefix("http_requests_total");
      const err5 = metrics.counterValue("http_requests_total", { class: "5xx" });
      const dTotal = total - prev.total; const dErr = err5 - prev.err;
      prev = { total, err: err5 };
      if (dTotal >= MIN_REQUESTS && dErr / dTotal > ERROR_RATE) await notify(redis, "http_5xx_spike", `ระบบตอบ error 5xx ${dErr}/${dTotal} คำขอ ใน ${CHECK_MS / 1000} วินาทีล่าสุด`);

      // ก่อนโหมด auto เปลี่ยนเป็น enforce (ภายใน 2 ชั่วโมง): ถ้ายังมีผู้เรียกที่ไม่มี token ให้รู้ล่วงหน้า (ดูรายการที่ GET /api/auth/missing)
      const at = getEnforceAt();
      if (isAutoMode() && at && getAuthMode() === "warn" && at - Date.now() < 2 * 3600 * 1000) {
        const clients = await readMissing(5);
        if (clients.length) await notify(redis, "auth_enforce_soon", `อีกไม่เกิน 2 ชั่วโมงระบบจะเริ่มบังคับ login แต่ยังมีผู้เรียก API ที่ไม่มี token ${clients.length}+ ราย (เช่น ${clients[0].ip}, ${clients[0].requests} ครั้ง) — ดูที่ GET /api/auth/missing หรือตั้ง AUTH_MODE=warn เพื่อเลื่อน`);
      }

      const lag = metrics.snapshot().gauges.eventloop_lag_ms_max || 0;
      if (lag > LAG_LIMIT_MS) await notify(redis, "event_loop_lag", `Node ตอบสนองช้า (ค้าง ${Math.round(lag)} ms) — อาจมีงานหนักบน process เดียว`);
    } catch (err) {
      logger.warn("alert_check_failed", { error: err.message });
    }
  };

  const timer = setInterval(tick, CHECK_MS);
  timer.unref();
  return () => clearInterval(timer);
};

module.exports = { startAlerts, notify };
