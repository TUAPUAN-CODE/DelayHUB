const mssql = require('mssql');
const dotenv = require('dotenv');
require('../lib/sqlTelemetry').instrument(mssql); // นับ/วัดเวลา/log query ช้า ที่เดียว ไม่ต้องแก้ route

dotenv.config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  // เดิมใช้ค่าเริ่มต้นของ mssql (requestTimeout 15 วินาที) — query หนักของ Sheet ช่วงโหลดสูงอาจถูกตัด; ปรับได้ที่ .env
  connectionTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10) || 15000,
  requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT_MS, 10) || 30000,
  options: {
    encrypt: true, // สำหรับ Azure
    trustServerCertificate: true, // สำหรับ local dev
    // ใช้ SQL Server Always On: ให้ DB_SERVER ชี้ AG listener แล้วตั้ง DB_MULTI_SUBNET_FAILOVER=true เพื่อให้ต่อกับ replica ที่เป็น primary ใหม่ได้เร็วหลัง failover
    ...(process.env.DB_MULTI_SUBNET_FAILOVER === 'true' ? { multiSubnetFailover: true } : {}),
  },
  // NEW: ลดจาก max:2000 ลงมา — server.js รัน cluster mode (fork 1 process ต่อ 1 CPU core)
  // แต่ละ worker process มี pool แยกของตัวเอง ค่าเดิม max:2000 หมายความว่าถ้าเครื่องมี
  // 8 core ระบบเปิด connection ไปหา SQL Server ได้สูงสุดถึง 16,000 connections พร้อมกัน
  // (คูณด้วยจำนวน core) ซึ่งเสี่ยง exhaust connection ฝั่ง DB ได้มาก ค่า max:30 นี้คูณ
  // จำนวน core แล้วยังอยู่ในระดับที่ SQL Server รับไหวตามปกติ ปรับเพิ่มได้ถ้า monitor
  // แล้วเจอ pool เต็มบ่อยจริงๆ (ดูจาก error "ETIMEOUT"/"pool is full" ใน log)
  pool: {
    max: 30,
    min: 5,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;
let connecting = null;
let lastFailAt = 0;   // ต่อไม่ได้ครบทุกครั้งล่าสุดเมื่อไหร่ — ช่วงที่ DB ล่ม คำขอถัดไปได้ null ทันที ไม่ต้องรอ retry ซ้ำทุกคำขอ
const FAIL_FAST_MS = 2000; // คำขอที่เข้ามาพร้อมกันตอน pool ยังไม่พร้อมจะรอ promise เดียวกัน (กัน connect ซ้อน → pool กำพร้า / error "already connecting")

const attachPoolErrorHandler = (p, label) => {
  // mssql emit 'error' เมื่อ connection ในพูลมีปัญหา (ไม่ใช่ ESOCKET) — ถ้าไม่มี listener จะกลายเป็น uncaughtException แล้ว worker ล้ม
  p.on("error", (err) => {
    console.error(`❌ [${label}] pool error:`, err && err.message);
  });
};

const openPool = async (retryCount, delayMs) => {
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    let candidate = null;
    try {
      console.log(`🔌 Connecting to MSSQL... (Attempt ${attempt}/${retryCount})`);
      candidate = new mssql.ConnectionPool(dbConfig);
      attachPoolErrorHandler(candidate, "MSSQL");
      await candidate.connect();

      // ตรวจสอบว่า pool ทำงานจริง
      if (!candidate.connected) throw new Error("Pool connected is false");

      // ปิด pool เก่าที่หลุดไปแล้ว (ถ้ามี) เพื่อไม่ให้ค้างเป็น connection กำพร้า
      const old = pool;
      pool = candidate;
      if (old && old !== candidate) old.close().catch(() => {});

      console.log('✅ Database connection successful!');
      return pool;
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      if (candidate) candidate.close().catch(() => {});

      if (attempt < retryCount) {
        console.log(`⏳ Retrying in ${delayMs / 1000} seconds...`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        console.error("❌ All retry attempts failed. Backend will start without DB.");
        lastFailAt = Date.now();
        // ไม่ process.exit เพื่อให้ backend ยังรันได้ (เช่น /health, Swagger)
        return null;
      }
    }
  }
  return null;
};

const connectToDatabase = async (retryCount = 3, delayMs = 1500) => {
  // connectToDatabase() ถูกเรียกแทบทุก route handler — pool ที่ต่ออยู่แล้วคืนทันที ไม่ log
  if (pool && pool.connected) {
    return pool;
  }
  if (connecting) return connecting;
  if (Date.now() - lastFailAt < FAIL_FAST_MS) return null;

  connecting = openPool(retryCount, delayMs).finally(() => { connecting = null; });
  return connecting;
};

const dbConfigWC = {
  user: process.env.DB_USER_WC,
  password: process.env.DB_PASSWORD_WC,
  server: process.env.DB_SERVER_WC,
  database: process.env.DB_DATABASE_WC,
  port: parseInt(process.env.PORT_WC) || 3000,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: {
    max: 100,
    min: 5,
    idleTimeoutMillis: 30000,
  },
};

let poolWC = null;

const connectToDatabaseWC = async () => {
  if (poolWC && poolWC.connected) return poolWC;
  try {
    console.log(`🔌 Connecting to WC MSSQL... (server=${process.env.DB_SERVER_WC}, user=${process.env.DB_USER_WC})`);
    poolWC = new mssql.ConnectionPool(dbConfigWC);
    attachPoolErrorHandler(poolWC, "MSSQL-WC");
    await poolWC.connect();
    console.log('✅ WC Database connection successful!');
    return poolWC;
  } catch (error) {
    console.error('❌ WC Database connection failed:', error.message);
    poolWC = null;
    return null;
  }
};

// สถานะ pool สำหรับ /metrics และ alert (size = connection ทั้งหมด, available = ว่าง, borrowed = ถูกใช้อยู่, pending = คำขอที่รอคิว)
const getPoolStats = () => {
  if (!pool) return { connected: 0, size: 0, available: 0, borrowed: 0, pending: 0 };
  return { connected: pool.connected ? 1 : 0, size: pool.size || 0, available: pool.available || 0, borrowed: pool.borrowed || 0, pending: pool.pending || 0 };
};

module.exports = {
  connectToDatabase,
  getPoolStats,
  connectToDatabaseWC,
  sql: mssql,
};

