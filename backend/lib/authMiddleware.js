// ตรวจตัวตนที่ middleware กลาง + สิทธิ์ตาม Role ที่ฝั่ง server
//
// AUTH_MODE (ใน .env):
//   off     = ไม่บังคับอะไร (ถ้ามี token ที่ถูกต้องจะตั้ง req.user ให้)
//   warn    = ตั้ง req.user ถ้ามี token และ "log เตือน" request ที่ไม่มี token / ไม่มีสิทธิ์ แต่ยังปล่อยผ่าน
//   enforce = ไม่มี token / token หมดอายุ → 401, ไม่มีสิทธิ์ → 403
//   (ไม่ตั้ง) = auto: warn ในช่วงเปลี่ยนผ่าน AUTH_GRACE_HOURS (ค่าเริ่มต้น 24 ชั่วโมง นับจากที่ระบบนี้เริ่มทำงานครั้งแรก — เก็บใน Redis ให้ทุก worker ตรงกัน)
//             แล้วเปลี่ยนเป็น enforce เอง; ช่วง warn ระบบเก็บรายการ "ผู้เรียกที่ไม่มี token" ให้ดูที่ GET /api/auth/missing
const fs = require("fs");
const path = require("path");
const { verifyToken, bearerOf } = require("./auth");
const metrics = require("./metrics");
const logger = require("./logger");

const EXPLICIT_MODE = ["off", "warn", "enforce"].includes((process.env.AUTH_MODE || "").toLowerCase()) ? process.env.AUTH_MODE.toLowerCase() : null;
const GRACE_HOURS = parseFloat(process.env.AUTH_GRACE_HOURS) > 0 ? parseFloat(process.env.AUTH_GRACE_HOURS) : 24;
const FIRST_START_KEY = "pfcm:auth:first_start";
const MISSING_COUNT_KEY = "pfcm:auth:missing:count";
const MISSING_LAST_KEY = "pfcm:auth:missing:last";
const USAGE_KEY = "pfcm:authz:usage";

let enforceAt = null; // เวลา (ms) ที่โหมด auto จะเปลี่ยนเป็น enforce
let redisRef = null;
let lastLoggedMode = null;

const getAuthMode = () => {
  let mode = EXPLICIT_MODE;
  if (!mode) mode = enforceAt !== null && Date.now() >= enforceAt ? "enforce" : "warn";
  if (mode !== lastLoggedMode) {
    if (lastLoggedMode !== null) logger.info("auth_mode_changed", { from: lastLoggedMode, to: mode });
    lastLoggedMode = mode;
  }
  return mode;
};
const getEnforceAt = () => enforceAt;
const isAutoMode = () => !EXPLICIT_MODE;

// Role (Users.wp_id / UserRoles.wp_id) ที่จัดการผู้ใช้ได้: 6 = Supervisor, 8 = Master
const ADMIN_ROLES = [6, 8];

const PUBLIC_ROUTES = [
  ["POST", /^\/api\/login$/],
  ["PUT", /^\/api\/signup$/],
  ["PUT", /^\/api\/forgot-password$/],
  ["GET", /^\/health(\/|$)/],
  ["GET", /^\/metrics$/], // ตรวจกุญแจ METRICS_KEY / IP ภายในเองใน route
  ["GET", /^\/api-docs/],
];
const isPublic = (req) => PUBLIC_ROUTES.some(([m, re]) => m === req.method && re.test(req.path));

const toUser = (payload) => {
  if (payload.typ === "service") return { user_id: 0, username: `service:${payload.sub}`, name: payload.sub, roles: ["service"], service: true, typ: "service" };
  return { user_id: payload.user_id, username: String(payload.user_id), name: payload.name, wp_id: payload.wp_id, roles: Array.isArray(payload.roles) ? payload.roles : [], typ: "user", orig: payload.orig || payload.iat };
};

// log เตือนแบบไม่ท่วม: ครั้งเดียวต่อ (ip + path) ต่อ 60 วินาที
const lastWarn = new Map();
const warnSampled = (event, req, extra) => {
  const key = `${event}|${req.ip}|${req.method} ${req.path}`;
  const now = Date.now();
  if (now - (lastWarn.get(key) || 0) < 60000) return;
  lastWarn.set(key, now);
  if (lastWarn.size > 2000) for (const [k, t] of lastWarn) if (now - t > 60000) lastWarn.delete(k);
  logger.warn(event, { mode: getAuthMode(), id: req.id, method: req.method, path: req.path, ip: req.ip, ...extra });
};

const isPrivateIp = (ip) => /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:(127|10|192\.168|172\.(1[6-9]|2\d|3[01]))\.|fc|fd)/i.test(String(ip || ""));

// ── รายการผู้เรียกที่ไม่มี token (ช่วง warn) และการใช้งานจริงต่อ Role — สะสมในหน่วยความจำแล้วส่งเข้า Redis ทุก 30 วินาที ──
const missingBuf = new Map(); // "ip|user-agent" -> { n, last }
const usageBuf = new Map();   // "METHOD route|role" -> n

const noteMissing = (req) => {
  const ua = String(req.headers["user-agent"] || "").slice(0, 80);
  const key = `${req.ip}|${ua}`;
  const cur = missingBuf.get(key) || { n: 0, last: "" };
  cur.n += 1; cur.last = `${new Date().toISOString()}|${req.method} ${req.path}`;
  if (missingBuf.size < 500 || missingBuf.has(key)) missingBuf.set(key, cur);
};

const activeRoleOf = (req) => {
  const claimed = parseInt(req.headers["x-active-role"], 10);
  const roles = (req.user && req.user.roles) || [];
  if (!Number.isNaN(claimed) && roles.includes(claimed)) return claimed;
  return req.user && req.user.wp_id !== undefined ? req.user.wp_id : null;
};
/** เรียกจาก requestObserver ตอนจบ request (สำเร็จ) เพื่อเรียนรู้ว่า route ไหนถูกใช้โดย Role ใด */
const recordUsage = (routeLabel, req) => {
  if (!req.user || req.user.service || routeLabel === "unmatched") return;
  const role = activeRoleOf(req);
  if (role === null || role === undefined) return;
  const key = `${req.method} ${routeLabel}|${role}`;
  if (usageBuf.size < 5000 || usageBuf.has(key)) usageBuf.set(key, (usageBuf.get(key) || 0) + 1);
};

const flushBuffers = async () => {
  if (!redisRef || !redisRef.isReady) return;
  try {
    for (const [key, v] of missingBuf) {
      await redisRef.hIncrBy(MISSING_COUNT_KEY, key, v.n);
      await redisRef.hSet(MISSING_LAST_KEY, key, v.last);
    }
    if (missingBuf.size) { await redisRef.expire(MISSING_COUNT_KEY, 7 * 86400); await redisRef.expire(MISSING_LAST_KEY, 7 * 86400); }
    missingBuf.clear();
    for (const [key, n] of usageBuf) await redisRef.hIncrBy(USAGE_KEY, key, n);
    if (usageBuf.size) await redisRef.expire(USAGE_KEY, 30 * 86400);
    usageBuf.clear();
  } catch (err) {
    logger.warn("auth_flush_failed", { error: err.message });
  }
};

/** เรียกครั้งเดียวหลัง Redis พร้อม: ตั้งเวลาเริ่มช่วงเปลี่ยนผ่าน (ทุก worker ได้ค่าเดียวกัน) และเริ่มส่งสถิติเข้า Redis */
const initAuth = async (redis) => {
  redisRef = redis;
  const timer = setInterval(flushBuffers, 30000);
  timer.unref();
  if (EXPLICIT_MODE) { logger.info("auth_mode", { mode: EXPLICIT_MODE, source: "env" }); return; }
  try {
    await redis.set(FIRST_START_KEY, String(Date.now()), { NX: true });
    const first = parseInt(await redis.get(FIRST_START_KEY), 10);
    enforceAt = first + GRACE_HOURS * 3600 * 1000;
    logger.info("auth_mode", { mode: getAuthMode(), source: "auto", grace_hours: GRACE_HOURS, enforce_at: new Date(enforceAt).toISOString() });
  } catch (err) {
    logger.warn("auth_grace_failed", { error: err.message, note: "ยังอยู่ในโหมด warn จนกว่าจะตั้ง AUTH_MODE=enforce เอง" });
  }
};

const readMissing = async (limit = 100) => {
  if (!redisRef || !redisRef.isReady) return [];
  const [counts, last] = await Promise.all([redisRef.hGetAll(MISSING_COUNT_KEY), redisRef.hGetAll(MISSING_LAST_KEY)]);
  return Object.entries(counts).map(([key, n]) => {
    const [ip, ...ua] = key.split("|");
    const [at, what] = String(last[key] || "").split("|");
    return { ip, user_agent: ua.join("|"), requests: parseInt(n, 10), last_seen: at || null, last_request: what || null };
  }).sort((a, b) => b.requests - a.requests).slice(0, limit);
};
const readUsage = async () => {
  if (!redisRef || !redisRef.isReady) return {};
  return redisRef.hGetAll(USAGE_KEY);
};

// ── ตัวตรวจตัวตน ──────────────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  if (req.method === "OPTIONS") return next();

  const token = bearerOf(req);
  let reason = null;
  if (token) {
    const v = verifyToken(token);
    if (v.ok && (v.payload.typ === "user" || v.payload.typ === "service")) {
      req.user = toUser(v.payload);
      metrics.inc("auth_total", { result: "ok" });
      return next();
    }
    reason = v.ok ? "wrong_type" : v.reason;
  }

  if (isPublic(req)) return next();
  const mode = getAuthMode();
  if (mode === "off") return next();

  const result = reason || "missing";
  metrics.inc("auth_total", { result, mode });
  noteMissing(req);
  if (mode === "enforce") {
    // เอกสาร API เปิดได้เฉพาะจากเครือข่ายภายใน (เบราว์เซอร์ส่ง header ไม่ได้)
    if (req.path.startsWith("/api-docs") && isPrivateIp(req.ip)) return next();
    const expired = result === "expired";
    return res.status(401).json({ success: false, error: expired ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" : "กรุณาเข้าสู่ระบบ", code: expired ? "TOKEN_EXPIRED" : "AUTH_REQUIRED" });
  }
  warnSampled("auth_missing", req, { reason: result, user_agent: String(req.headers["user-agent"] || "").slice(0, 80) });
  return next();
};

// ── สิทธิ์ตาม Role ──────────────────────────────────────────────────────────────
const hasRole = (user, allowed) => !!user && (user.service === true || (user.roles || []).some((r) => allowed.includes(r)));
const isAdmin = (user) => hasRole(user, ADMIN_ROLES);

const adminOnly = (req) => (isAdmin(req.user) ? null : "admin_only");
// เจ้าของข้อมูลเองหรือ admin (user_id มาจาก query / body)
const selfOrAdmin = (pick) => (req) => {
  if (isAdmin(req.user)) return null;
  const target = parseInt(pick(req), 10);
  return !Number.isNaN(target) && target === req.user.user_id ? null : "not_owner";
};

// กฎที่กำหนดในโค้ด (เรื่องที่ชัดเจนและเสี่ยงสูง)
const RULES = [
  // จัดการพนักงาน (หน้า Supervisor > ผู้ใช้)
  { m: "POST", p: /^\/api\/add-user$/, check: adminOnly },
  { m: "POST", p: /^\/api\/add-workplace-user$/, check: adminOnly },
  { m: "PUT", p: /^\/api\/update-user$/, check: adminOnly },
  { m: "PUT", p: /^\/api\/update-workplace-user$/, check: adminOnly },
  { m: "DELETE", p: /^\/api\/delete-user\//, check: adminOnly },
  { m: "GET", p: /^\/api\/users$/, check: adminOnly },
  { m: "PUT", p: /^\/api\/user\/roles$/, check: adminOnly },
  { m: "GET", p: /^\/api\/auth\/(missing|policy-draft)$/, check: adminOnly },
  // Role ของตัวเอง ดูได้ แต่ดูของคนอื่นต้องเป็น admin
  { m: "GET", p: /^\/api\/user\/roles$/, check: selfOrAdmin((req) => req.query.user_id) },
  // การตั้งค่าตารางเป็นของแต่ละบัญชี
  { m: "GET", p: /^\/api\/sheet\/prefs$/, check: selfOrAdmin((req) => req.query.user_id) },
  { m: "PUT", p: /^\/api\/sheet\/prefs$/, check: selfOrAdmin((req) => req.body && req.body.user_id) },
];

// กฎจากไฟล์ config/rolePolicy.json (แก้ได้โดยไม่ต้อง deploy; เปลี่ยนไฟล์แล้วมีผลภายใน 30 วินาที)
//   { "version": 1, "rules": [ { "method": "POST", "path": "^/api/coldstorage/input/coldstorage$", "roles": [5, 7], "mode": "warn" } ] }
//   - ผู้ใช้ที่มี Role ใดๆ ในรายการ (หรือเป็น admin 6/8) ผ่าน; ไม่มี = ไม่มีสิทธิ์
//   - route ที่ไม่ได้อยู่ในไฟล์ = เปิดให้ทุกคนที่ login แล้ว
//   - "mode": "warn" ต่อกฎ = แค่ log "authz_would_deny" ไม่ปฏิเสธ (ใช้ทดลองก่อนบังคับจริง); ไม่ใส่/"enforce" = บังคับตามโหมดของระบบ
const POLICY_FILE = process.env.ROLE_POLICY_FILE || path.join(__dirname, "..", "config", "rolePolicy.json");
let fileRules = [];
let fileMtime = 0;
const loadPolicyFile = () => {
  try {
    const stat = fs.statSync(POLICY_FILE);
    if (stat.mtimeMs === fileMtime) return;
    const parsed = JSON.parse(fs.readFileSync(POLICY_FILE, "utf8"));
    const rules = (Array.isArray(parsed.rules) ? parsed.rules : []).map((r) => ({
      m: String(r.method || "*").toUpperCase(),
      p: new RegExp(r.path),
      roles: (r.roles || []).map((x) => Number(x)).filter((x) => !Number.isNaN(x)),
      soft: r.mode === "warn",
    }));
    fileRules = rules; fileMtime = stat.mtimeMs;
    logger.info("role_policy_loaded", { file: path.basename(POLICY_FILE), rules: rules.length });
  } catch (err) {
    if (err.code !== "ENOENT") logger.error("role_policy_invalid", { error: err.message, note: "ใช้ชุดกฎเดิมต่อ" });
  }
};
loadPolicyFile();
setInterval(loadPolicyFile, 30000).unref();

const authorize = (req, res, next) => {
  const mode = getAuthMode();
  if (!req.user || mode === "off") return next(); // ยังไม่รู้ว่าเป็นใคร: เป็นหน้าที่ของ authenticate

  let violation = null;
  let soft = false;
  for (const rule of RULES) {
    if (rule.m !== req.method || !rule.p.test(req.path)) continue;
    violation = rule.check(req);
    if (violation) break;
  }
  if (!violation) {
    for (const rule of fileRules) {
      if ((rule.m !== "*" && rule.m !== req.method) || !rule.p.test(req.path)) continue;
      if (!hasRole(req.user, [...rule.roles, ...ADMIN_ROLES])) { violation = "role_not_allowed"; soft = rule.soft; break; }
    }
  }
  if (!violation) return next();

  metrics.inc("authz_denied_total", { reason: violation, mode, soft: soft ? "1" : "0" });
  if (mode === "enforce" && !soft) {
    logger.warn("forbidden", { id: req.id, method: req.method, path: req.path, user_id: req.user.user_id, reason: violation });
    return res.status(403).json({ success: false, error: "ไม่มีสิทธิ์ทำรายการนี้", code: "FORBIDDEN" });
  }
  warnSampled("authz_would_deny", req, { user_id: req.user.user_id, reason: violation });
  return next();
};

module.exports = {
  authenticate, authorize, isPublic, isPrivateIp, ADMIN_ROLES, isAdmin,
  getAuthMode, getEnforceAt, isAutoMode, initAuth, readMissing, readUsage, recordUsage, flushBuffers,
};
