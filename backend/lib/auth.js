// Token ยืนยันตัวตน (JWT HS256) สร้างและตรวจด้วย crypto ของ Node — ไม่ต้องติดตั้ง package เพิ่มบน production
//   typ "user"    : ออกตอน login  (user_id, name, wp_id, roles[])
//   typ "service" : ใช้โดย worker ภายใน (เช่น delayAlertWorker) เรียก API
//   typ "setting" : ใบอนุญาตสั้นๆ หลังใส่รหัสรายวันของหน้า Setting (ผูกกับ user_id)
// ความลับ: AUTH_JWT_SECRET ใน .env (ควรตั้งเอง) — ถ้าไม่ได้ตั้งจะอนุมานจากค่า DB ใน .env เดียวกัน เพื่อให้ทุก worker / ทุกเครื่องที่ใช้ .env เดียวกันได้ค่าเดียวกัน
const crypto = require("crypto");

const b64u = (input) => Buffer.from(input).toString("base64url");
const fromB64u = (s) => Buffer.from(s, "base64url");

let warned = false;
const secret = () => {
  if (process.env.AUTH_JWT_SECRET) return process.env.AUTH_JWT_SECRET;
  if (!warned) {
    warned = true;
    console.error("⚠️ [auth] ยังไม่ได้ตั้ง AUTH_JWT_SECRET ใน .env — ใช้ค่าอนุมานจากค่า DB ชั่วคราว (แนะนำให้ตั้งค่าสุ่มยาว ≥ 32 ตัวอักษร)");
  }
  return crypto.createHash("sha256").update(`pfcm-auth|${process.env.DB_USER || ""}|${process.env.DB_PASSWORD || ""}|${process.env.DB_DATABASE || ""}`).digest("hex");
};

const sign = (data) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");

/** payload + ttlSeconds -> token */
const signToken = (payload, ttlSeconds) => {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const data = `${head}.${b64u(JSON.stringify(body))}`;
  return `${data}.${sign(data)}`;
};

/** token -> { ok:true, payload } | { ok:false, reason: "malformed" | "bad_signature" | "expired" } */
const verifyToken = (token) => {
  if (typeof token !== "string" || token.length > 4096) return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  let header;
  try { header = JSON.parse(fromB64u(parts[0]).toString("utf8")); } catch { return { ok: false, reason: "malformed" }; }
  if (!header || header.alg !== "HS256") return { ok: false, reason: "malformed" };

  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return { ok: false, reason: "bad_signature" };

  let payload;
  try { payload = JSON.parse(fromB64u(parts[1]).toString("utf8")); } catch { return { ok: false, reason: "malformed" }; }
  if (!payload || typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, payload };
};

const bearerOf = (req) => {
  const h = req.headers && req.headers.authorization;
  if (typeof h === "string" && /^Bearer\s+/i.test(h)) return h.replace(/^Bearer\s+/i, "").trim();
  return null;
};

const USER_TTL_SECONDS = (parseInt(process.env.AUTH_TOKEN_HOURS, 10) || 12) * 3600; // กะการทำงาน 12 ชั่วโมง
const SERVICE_TTL_SECONDS = 3600;

const issueUserToken = (user) =>
  signToken({
    typ: "user",
    sub: String(user.user_id),
    user_id: user.user_id,
    name: [user.first_name, user.last_name].filter(Boolean).join(" ") || null,
    wp_id: user.wp_id ?? null,
    roles: Array.isArray(user.roles) ? user.roles.map((r) => (typeof r === "object" ? r.wp_id : r)).filter((v) => v !== null && v !== undefined) : [],
  }, USER_TTL_SECONDS);

const issueServiceToken = (name) => signToken({ typ: "service", sub: name }, SERVICE_TTL_SECONDS);

module.exports = { signToken, verifyToken, bearerOf, issueUserToken, issueServiceToken, USER_TTL_SECONDS };
