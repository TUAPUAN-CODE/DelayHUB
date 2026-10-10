// Rate limiting ทั้งหมดของ API (แยกเป็นโมดูลเพื่อทดสอบได้)
const rateLimit = require("express-rate-limit");
const { verifyToken, bearerOf } = require("./auth");
const { isPrivateIp } = require("./authMiddleware");
const metrics = require("./metrics");

// อยู่หลัง nginx/load balancer: เชื่อ X-Forwarded-For จาก proxy ในเครือข่ายภายในเท่านั้น (ตั้ง TRUST_PROXY ใน .env เพื่อกำหนดเอง เช่น 1)
const resolveTrustProxy = () =>
  process.env.TRUST_PROXY === undefined ? "loopback, linklocal, uniquelocal" : (Number.isNaN(Number(process.env.TRUST_PROXY)) ? process.env.TRUST_PROXY : Number(process.env.TRUST_PROXY));

// นับต่อ "ผู้ใช้" (จาก token) ไม่ใช่ต่อ IP: ทั้งโรงงานอยู่หลัง IP เดียวกันได้ และไม่ข้าม IP ภายในอีกต่อไป
//  - ผู้ใช้ที่มี token : จำกัดต่อ user_id (RATE_LIMIT_MAX ต่อ 15 นาที, ค่าเริ่มต้น 3000)
//  - ไม่มี token จาก IP ภายนอก : จำกัดต่อ IP
//  - ไม่มี token จาก IP ภายใน : ไม่นับที่นี่ (โหมด enforce ถูกตอบ 401 ถูกๆ อยู่แล้ว; login/signup มีตัวจำกัดของตัวเอง)
const tokenKey = (req) => {
  const t = bearerOf(req);
  if (!t) return null;
  const v = verifyToken(t);
  if (!v.ok) return null;
  if (v.payload.typ === "user") return `u:${v.payload.user_id}`;
  if (v.payload.typ === "service") return "svc";
  return null;
};

const rateLimited = (_req, res) => {
  metrics.inc("rate_limited_total");
  res.status(429).json({ success: false, error: "คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่", code: "RATE_LIMITED" });
};

const createLimiters = () => ({
  limiter: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 3000,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => tokenKey(req) || `ip:${req.ip}`,
    skip: (req) => {
      if (req.path === "/health" || req.path.startsWith("/health/") || req.path === "/metrics") return true;
      const key = tokenKey(req);
      if (key === "svc") return true;
      return !key && isPrivateIp(req.ip);
    },
    handler: rateLimited,
  }),
  // กันเดารหัสผ่าน: นับเฉพาะครั้งที่ไม่สำเร็จ ต่อ (IP + user_id)
  loginLimiter: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.LOGIN_RATE_LIMIT, 10) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `login:${req.ip}:${String((req.body && req.body.user_id) || "")}`,
    handler: rateLimited,
  }),
  // signup / forgot-password เป็น endpoint สาธารณะ: จำกัดต่อ IP
  publicAuthLimiter: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.PUBLIC_AUTH_RATE_LIMIT, 10) || 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `public:${req.ip}`,
    handler: rateLimited,
  }),
});

module.exports = { createLimiters, resolveTrustProxy, tokenKey };
