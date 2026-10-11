// สร้าง Redis client แบบเดียวกันทุกที่ (server.js, leader lock, rate limit) — ตั้งค่าจาก .env และ "ไม่ทำให้ process ตาย" เมื่อ Redis สะดุด
//   REDIS_HOST (127.0.0.1) · REDIS_PORT (6379) · REDIS_PASSWORD · REDIS_USERNAME · REDIS_TLS=true (ใช้ TLS)
// เดิมไม่มี .on('error') → Redis หลุดครั้งเดียว ทุก worker ตายพร้อมกัน, และถ้า Redis ยังไม่ขึ้นตอนเปิดระบบ backend ออก (process.exit)
// ตอนนี้: เชื่อมต่อใหม่เองไม่จำกัดครั้ง (หน่วง 0.1–5 วินาที) และ log ไม่เกิน 1 ครั้งต่อ 30 วินาที
const { createClient } = require("redis");
const logger = require("./logger");

const options = () => ({
  socket: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    ...(process.env.REDIS_TLS === "true" ? { tls: true } : {}),
    connectTimeout: 5000,
    reconnectStrategy: (retries) => Math.min(100 + retries * 200, 5000),
  },
  ...(process.env.REDIS_USERNAME ? { username: process.env.REDIS_USERNAME } : {}),
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  disableClientInfo: true,
});

/** ผูก handler ที่ทำให้ client ไม่ throw เมื่อมี error + log สถานะ */
const attachHandlers = (client, label) => {
  let lastErrorLog = 0;
  client.on("error", (err) => {
    const now = Date.now();
    if (now - lastErrorLog < 30000) return;
    lastErrorLog = now;
    logger.error("redis_error", { client: label, error: err && err.message, code: err && err.code });
  });
  client.on("ready", () => logger.info("redis_ready", { client: label }));
  client.on("end", () => logger.warn("redis_closed", { client: label }));
  return client;
};

const createRedis = (label = "main") => attachHandlers(createClient(options()), label);
/** duplicate() ไม่คัดลอก listener — ต้องผูกใหม่ */
const duplicateRedis = (client, label) => attachHandlers(client.duplicate(), label);

module.exports = { createRedis, duplicateRedis };
