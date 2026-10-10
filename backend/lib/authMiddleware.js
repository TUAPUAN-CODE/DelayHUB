// ตรวจตัวตนที่ middleware กลาง + สิทธิ์ตาม Role ที่ฝั่ง server
//
// AUTH_MODE (ใน .env):
//   off     = ไม่บังคับอะไร (ถ้ามี token ที่ถูกต้องจะตั้ง req.user ให้)
//   warn    = (ค่าเริ่มต้น) ตั้ง req.user ถ้ามี token และ "log เตือน" request ที่ไม่มี token / ไม่มีสิทธิ์ แต่ยังปล่อยผ่าน → ใช้ช่วง roll out เพื่อดูว่ามีใครเรียก API โดยไม่มี token
//   enforce = ไม่มี token / token หมดอายุ → 401, ไม่มีสิทธิ์ → 403
const { verifyToken, bearerOf } = require("./auth");
const metrics = require("./metrics");
const logger = require("./logger");

const MODE = ["off", "warn", "enforce"].includes((process.env.AUTH_MODE || "").toLowerCase()) ? process.env.AUTH_MODE.toLowerCase() : "warn";

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

// log "ไม่มี token" แบบไม่ท่วม: ครั้งเดียวต่อ (ip + path) ต่อ 60 วินาที
const lastWarn = new Map();
const warnSampled = (event, req, extra) => {
  const key = `${event}|${req.ip}|${req.method} ${req.path}`;
  const now = Date.now();
  if (now - (lastWarn.get(key) || 0) < 60000) return;
  lastWarn.set(key, now);
  if (lastWarn.size > 2000) for (const [k, t] of lastWarn) if (now - t > 60000) lastWarn.delete(k);
  logger.warn(event, { mode: MODE, id: req.id, method: req.method, path: req.path, ip: req.ip, ...extra });
};

const isPrivateIp = (ip) => /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:(127|10|192\.168|172\.(1[6-9]|2\d|3[01]))\.|fc|fd)/i.test(String(ip || ""));

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
  if (MODE === "off") return next();

  const result = reason || "missing";
  metrics.inc("auth_total", { result, mode: MODE });
  if (MODE === "enforce") {
    // เอกสาร API เปิดได้เฉพาะจากเครือข่ายภายใน (เบราว์เซอร์ส่ง header ไม่ได้)
    if (req.path.startsWith("/api-docs") && isPrivateIp(req.ip)) return next();
    const expired = result === "expired";
    return res.status(401).json({ success: false, error: expired ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" : "กรุณาเข้าสู่ระบบ", code: expired ? "TOKEN_EXPIRED" : "AUTH_REQUIRED" });
  }
  warnSampled("auth_missing", req, { reason: result });
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

const RULES = [
  // จัดการพนักงาน (หน้า Supervisor > ผู้ใช้)
  { m: "POST", p: /^\/api\/add-user$/, check: adminOnly },
  { m: "POST", p: /^\/api\/add-workplace-user$/, check: adminOnly },
  { m: "PUT", p: /^\/api\/update-user$/, check: adminOnly },
  { m: "PUT", p: /^\/api\/update-workplace-user$/, check: adminOnly },
  { m: "DELETE", p: /^\/api\/delete-user\//, check: adminOnly },
  { m: "GET", p: /^\/api\/users$/, check: adminOnly },
  { m: "PUT", p: /^\/api\/user\/roles$/, check: adminOnly },
  // Role ของตัวเอง ดูได้ แต่ดูของคนอื่นต้องเป็น admin
  { m: "GET", p: /^\/api\/user\/roles$/, check: selfOrAdmin((req) => req.query.user_id) },
  // การตั้งค่าตารางเป็นของแต่ละบัญชี
  { m: "GET", p: /^\/api\/sheet\/prefs$/, check: selfOrAdmin((req) => req.query.user_id) },
  { m: "PUT", p: /^\/api\/sheet\/prefs$/, check: selfOrAdmin((req) => req.body && req.body.user_id) },
];

const authorize = (req, res, next) => {
  if (!req.user || MODE === "off") return next(); // ยังไม่รู้ว่าเป็นใคร: เป็นหน้าที่ของ authenticate (โหมด enforce ตัดไปแล้วก่อนถึงนี่)
  for (const rule of RULES) {
    if (rule.m !== req.method || !rule.p.test(req.path)) continue;
    const violation = rule.check(req);
    if (!violation) continue;
    metrics.inc("authz_denied_total", { reason: violation, mode: MODE });
    if (MODE === "enforce") {
      logger.warn("forbidden", { id: req.id, method: req.method, path: req.path, user_id: req.user.user_id, reason: violation });
      return res.status(403).json({ success: false, error: "ไม่มีสิทธิ์ทำรายการนี้", code: "FORBIDDEN" });
    }
    warnSampled("authz_would_deny", req, { user_id: req.user.user_id, reason: violation });
  }
  return next();
};

module.exports = { authenticate, authorize, isPublic, isPrivateIp, AUTH_MODE: MODE, ADMIN_ROLES, isAdmin };
