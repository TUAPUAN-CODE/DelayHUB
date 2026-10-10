// Auth domain: ข้อมูลผู้ใช้จาก token, ต่ออายุ token, และปลดล็อกหน้า Setting (รหัสรายวัน) ฝั่ง server
const express = require("express");
const { signToken, verifyToken, bearerOf, issueUserToken, USER_TTL_SECONDS } = require("../lib/auth");
const { getAuthMode, getEnforceAt, isAutoMode, readMissing, readUsage } = require("../lib/authMiddleware");
const logger = require("../lib/logger");

const router = express.Router();

const MAX_SESSION_SECONDS = 7 * 24 * 3600; // ต่ออายุได้ต่อเนื่องไม่เกิน 7 วันนับจาก login ครั้งแรก
const UNLOCK_TTL_SECONDS = 8 * 3600;

router.get("/auth/me", (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, error: "กรุณาเข้าสู่ระบบ", code: "AUTH_REQUIRED" });
  res.json({ success: true, mode: getAuthMode(), enforce_at: isAutoMode() && getEnforceAt() ? new Date(getEnforceAt()).toISOString() : null, user: req.user });
});

// ── สำหรับ admin: ผู้เรียก API ที่ยังไม่มี token (ดูก่อนโหมดจะเปลี่ยนเป็น enforce), และร่างตารางสิทธิ์จากการใช้งานจริง ──
router.get("/auth/missing", async (req, res) => {
  try {
    res.json({ success: true, mode: getAuthMode(), enforce_at: isAutoMode() && getEnforceAt() ? new Date(getEnforceAt()).toISOString() : null, clients: await readMissing(200) });
  } catch (err) {
    console.error("❌ [Route /auth/missing] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
router.get("/auth/policy-draft", async (req, res) => {
  try {
    const min = Math.max(1, parseInt(req.query.min, 10) || 20); // route ที่เห็นการใช้งานน้อยกว่านี้ยังไม่พอจะสรุป
    const usage = await readUsage();
    const byRoute = new Map(); // "METHOD /route" -> { role: count }
    Object.entries(usage).forEach(([key, n]) => {
      const cut = key.lastIndexOf("|");
      const route = key.slice(0, cut);
      const role = key.slice(cut + 1);
      if (!byRoute.has(route)) byRoute.set(route, {});
      byRoute.get(route)[role] = (byRoute.get(route)[role] || 0) + parseInt(n, 10);
    });
    const rules = [];
    let skipped = 0;
    for (const [route, roles] of [...byRoute.entries()].sort()) {
      const total = Object.values(roles).reduce((a, b) => a + b, 0);
      if (total < min) { skipped += 1; continue; }
      const sp = route.indexOf(" ");
      const method = route.slice(0, sp);
      const pattern = route.slice(sp + 1).split("/").map((seg) => (seg.startsWith(":") ? "[^/]+" : escapeRe(seg))).join("/");
      rules.push({ method, path: `^${pattern}$`, roles: Object.keys(roles).map(Number).sort((a, b) => a - b), mode: "warn", observed: roles });
    }
    res.json({
      success: true,
      note: "ร่างจากการใช้งานจริง: ทุกกฎตั้ง mode=warn (log อย่างเดียว) ตรวจรายการ แล้วบันทึกเป็น backend/config/rolePolicy.json; ลบ field observed ได้; เอา mode ออกเมื่อมั่นใจ",
      skipped_routes_with_few_calls: skipped,
      policy: { version: 1, generated_at: new Date().toISOString(), rules },
    });
  } catch (err) {
    console.error("❌ [Route /auth/policy-draft] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ต่ออายุ token (หน้าเว็บเรียกเมื่อใกล้หมดอายุ) — roles เป็นชุดเดิมจากตอน login; แก้ Role แล้วมีผลเมื่อ login ใหม่
router.post("/auth/refresh", (req, res) => {
  try {
    const token = bearerOf(req);
    const v = token ? verifyToken(token) : { ok: false, reason: "missing" };
    if (!v.ok || v.payload.typ !== "user") {
      return res.status(401).json({ success: false, error: "กรุณาเข้าสู่ระบบ", code: v.reason === "expired" ? "TOKEN_EXPIRED" : "AUTH_REQUIRED" });
    }
    const p = v.payload;
    const orig = p.orig || p.iat;
    if (Math.floor(Date.now() / 1000) - orig > MAX_SESSION_SECONDS) {
      return res.status(401).json({ success: false, error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", code: "TOKEN_EXPIRED" });
    }
    const fresh = signToken({ typ: "user", sub: p.sub, user_id: p.user_id, name: p.name, wp_id: p.wp_id, roles: p.roles, orig }, USER_TTL_SECONDS);
    res.json({ success: true, token: fresh, expires_in: USER_TTL_SECONDS });
  } catch (err) {
    console.error("❌ [Route /auth/refresh] Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
});

// ── ปลดล็อกหน้า Setting ─────────────────────────────────────────────────────────
// รหัสของวัน = วัน + เดือน + ปี ค.ศ. (ไม่มีเลข 0 นำหน้า) ตามเวลาไทย เช่น 9 ต.ค. 2026 -> 9102026
const todayKey = () => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "numeric", year: "numeric" }).formatToParts(new Date());
  const get = (t) => parts.find((x) => x.type === t).value;
  return `${get("day")}${get("month")}${get("year")}`;
};

const attempts = new Map(); // user_id -> { n, first }
const MAX_BAD = 10;
const WINDOW_MS = 15 * 60 * 1000;

router.post("/sheet/setting-unlock", (req, res) => {
  try {
    const userId = req.user ? req.user.user_id : parseInt(req.body && req.body.user_id, 10); // โหมด warn: เครื่องที่ยังไม่มี token ใช้ user_id จาก body
    if (userId === undefined || Number.isNaN(userId)) return res.status(400).json({ success: false, error: "ไม่พบผู้ใช้" });

    const now = Date.now();
    const rec = attempts.get(userId);
    if (rec && now - rec.first < WINDOW_MS && rec.n >= MAX_BAD) {
      return res.status(429).json({ success: false, error: "ใส่รหัสผิดหลายครั้ง กรุณารอ 15 นาที", code: "TOO_MANY_ATTEMPTS" });
    }

    const given = String((req.body && req.body.password) || "").trim();
    if (given !== todayKey()) {
      const fresh = rec && now - rec.first < WINDOW_MS ? rec : { n: 0, first: now };
      fresh.n += 1;
      attempts.set(userId, fresh);
      logger.warn("setting_unlock_failed", { id: req.id, user_id: userId, attempts: fresh.n, ip: req.ip });
      return res.status(401).json({ success: false, error: "รหัสไม่ถูกต้อง" });
    }

    attempts.delete(userId);
    const unlock = signToken({ typ: "setting", sub: String(userId), user_id: userId }, UNLOCK_TTL_SECONDS);
    res.json({ success: true, unlock, expires_in: UNLOCK_TTL_SECONDS });
  } catch (err) {
    console.error("❌ [Route /sheet/setting-unlock] Error:", err);
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
});

module.exports = router;
