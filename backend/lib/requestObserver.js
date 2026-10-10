// ติดตามทุก request: รหัสอ้างอิง (x-request-id), จำนวน/เวลา/สถานะ เข้าตัวชี้วัด, log เฉพาะที่ต้องดู (5xx, ช้า, ถูกปฏิเสธสิทธิ์)
const crypto = require("crypto");
const metrics = require("./metrics");
const logger = require("./logger");
const { recordUsage } = require("./authMiddleware");

const SLOW_REQUEST_MS = parseInt(process.env.SLOW_REQUEST_MS, 10) || 3000;
const LOG_ALL_4XX = process.env.LOG_ALL_4XX === "true";

const routeLabel = (req) => {
  if (req.route && req.route.path) return `${req.baseUrl || ""}${typeof req.route.path === "string" ? req.route.path : "(regex)"}`;
  return "unmatched";
};

const requestObserver = (req, res, next) => {
  const incoming = req.headers["x-request-id"];
  req.id = typeof incoming === "string" && /^[A-Za-z0-9._-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  const started = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const status = res.statusCode;
    const cls = `${Math.floor(status / 100)}xx`;
    metrics.inc("http_requests_total", { class: cls });
    metrics.observe("http_duration_ms", ms);

    if (status < 400) recordUsage(routeLabel(req), req);

    const base = { id: req.id, method: req.method, route: routeLabel(req), status, ms: Math.round(ms), user_id: req.user ? req.user.user_id : null, ip: req.ip };
    if (status >= 500) {
      metrics.inc("http_errors_total", { route: base.route });
      logger.error("http_5xx", base);
    } else if (ms >= SLOW_REQUEST_MS) {
      metrics.inc("http_slow_total", { route: base.route });
      logger.warn("http_slow", base);
    } else if ((status === 401 || status === 403) || (LOG_ALL_4XX && status >= 400)) {
      logger.warn("http_denied", base);
    }
  });
  next();
};

module.exports = requestObserver;
