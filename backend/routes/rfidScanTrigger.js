require('dotenv').config();
const express = require('express');
const net = require('net');
const sql = require('mssql');
const router = express.Router();

// ⚠️ ตั้งค่า IP จริงของเครื่องอ่านแต่ละตัวผ่าน .env
// READER1_IP..READER9_IP, READER1_PORT..READER9_PORT, READER1_NAME..READER9_NAME
// เฉพาะ reader ที่มี _IP กำหนดไว้จริงใน .env เท่านั้นที่จะถูกเพิ่มเข้ามา
// (ไม่เดา IP fallback ให้ reader ที่ไม่ได้ตั้งค่า เพื่อไม่ให้ไปเช็คสถานะ IP มั่วๆ)
const READERS_CONFIG = {};
for (let i = 1; i <= 9; i++) {
  const ip = process.env[`READER${i}_IP`];
  if (!ip) continue; // ข้าม reader ที่ไม่ได้ตั้งค่าไว้จริง

  READERS_CONFIG[i] = {
    ip,
    port: Number(process.env[`READER${i}_PORT`]) || 49152,
    name: process.env[`READER${i}_NAME`] || `RFID_READER_${i}`,
  };
}

const SCAN_TIMEOUT_MS = 5000;
const STATUS_CHECK_TIMEOUT_MS = 1500; // เช็คสถานะให้เร็ว ไม่ต้องรอนาน (ใช้เฉพาะ scanOnce on-demand แล้ว)

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(dbConfig);
  }
  return poolPromise;
}

function buildCommand7C(hexString) {
  const buf = Buffer.from(hexString, 'hex');
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    sum += buf[i];
  }
  const checksum = ((~sum) + 1) & 0xFF;
  return Buffer.concat([buf, Buffer.from([checksum])]);
}

function scanOnce(readerConfig) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let settled = false;

    const finish = (err, epc) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.destroy();
      if (err) reject(err);
      else resolve(epc);
    };

    const timer = setTimeout(() => {
      finish(new Error('TIMEOUT: ไม่พบการ์ด RFID ภายในเวลาที่กำหนด'));
    }, SCAN_TIMEOUT_MS);

    client.connect(readerConfig.port, readerConfig.ip, () => {
      const initCmd = buildCommand7C('7CFFFF823200D2');
      client.write(initCmd);
      const startCmd = Buffer.from('7CFFFF20000501000200C896', 'hex');
      client.write(startCmd);
    });

    client.on('data', (data) => {
      const hexReply = data.toString('hex').toUpperCase();
      if (hexReply.startsWith('CCFFFF20') && hexReply.length >= 42) {
        const epc = hexReply.substring(18, 42);
        finish(null, epc);
      }
    });

    client.on('error', (err) => {
      finish(new Error(`เชื่อมต่อเครื่องอ่านไม่ได้ (${readerConfig.ip}:${readerConfig.port}): ${err.message}`));
    });

    client.on('close', () => {
      finish(new Error('การเชื่อมต่อเครื่องอ่านถูกปิดก่อนจะได้ค่า EPC'));
    });
  });
}

/**
 * เช็คว่าเครื่องอ่าน RFID ยัง "online" อยู่ไหม โดยดูจาก ReaderScanLog แทนการเปิด TCP connection ใหม่
 *
 * เหตุผล: ตัวเครื่องอ่านรับ TCP client ได้ทีละ 1 ราย และ RFIDc1.js (rfidc1-service) ถือ
 * connection หลักไว้ตลอดเวลาเพื่อรับ EPC แบบ real-time อยู่แล้ว — ถ้า endpoint นี้เปิด
 * connection ที่ 2 ซ้อนเข้าไปอีก เครื่องอ่านจะปฏิเสธ/reset การเชื่อมต่อหลัก ทำให้เห็นเป็น
 * Offline ทั้งที่ยัง scan ได้จริงอยู่ (สาเหตุที่พบจริงในเคสนี้ - ตรงกับ ECONNRESET ใน error log)
 *
 * ⚠️ ปรับชื่อ column ให้ตรงกับตาราง ReaderScanLog จริงของระบบ (สมมติว่ามี reader_id และ
 * scan_time) ถ้าตารางเก็บ IP แทน reader_id ให้เปลี่ยนเงื่อนไข GROUP BY/WHERE ตามนั้น
 */
async function getLastScanTimes() {
  const pool = await getPool();
  const result = await pool
    .request()
    .query(`
      SELECT reader_id, MAX(scan_time) AS last_scan_time
      FROM ReaderScanLog
      GROUP BY reader_id
    `);

  const map = {};
  result.recordset.forEach((row) => {
    map[row.reader_id] = row.last_scan_time;
  });
  return map;
}

/**
 * ดึง config ของ reader ตัวเดียว โดยให้ DB (RFIDReaderConfig) เป็นแหล่งข้อมูลจริงเสมอ
 * ถ้ายังไม่มีแถวใน DB สำหรับ reader_no นี้ จะ fallback ไปใช้ READERS_CONFIG (.env) แทน
 * ⚠️ ก่อนหน้านี้ /status/:readerId และ /scan/:readerId ใช้ READERS_CONFIG (.env) ตรงๆ
 * โดยไม่เช็ค DB เลย ต่างจาก /status (list) ที่ merge DB ไว้แล้ว — ทำให้แก้ IP ผ่าน Control Panel
 * แล้ว endpoint เดี่ยวพวกนี้ยังใช้ IP เก่าจาก .env ค้างอยู่ ฟังก์ชันนี้แก้ให้ใช้ path เดียวกันหมด
 */
async function getReaderConfigForId(readerId) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('reader_no', sql.Int, readerId)
      .query(`SELECT TOP (1) ip, port, name, is_active FROM RFIDReaderConfig WHERE reader_no = @reader_no`);

    if (result.recordset.length > 0) {
      const row = result.recordset[0];
      return { ip: row.ip, port: row.port, name: row.name, is_active: row.is_active };
    }
  } catch (err) {
    console.warn(`⚠️ อ่าน RFIDReaderConfig ไม่สำเร็จ (reader_no=${readerId}), ใช้ .env แทน:`, err.message);
  }

  const envConfig = READERS_CONFIG[readerId];
  return envConfig ? { ...envConfig, is_active: undefined } : null;
}

// อ่านป้าย "เปิดใช้งาน" ของ reader แต่ละตัวจากตาราง RFIDReaderConfig
// (ตัวไหนยังไม่มี record ใน DB ถือว่าเปิดได้ — fallback ไม่บล็อก)
async function getReaderActiveStates() {
  const activeMap = {};
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT reader_no, is_active FROM RFIDReaderConfig
    `);
    result.recordset.forEach((row) => {
      activeMap[row.reader_no] = !!row.is_active;
    });
  } catch (err) {
    // ไม่มีตาราง → ถือว่าเปิดได้ทั้งหมด
  }
  return activeMap;
}

/**
 * GET /api/coldstorage/rfid/status/:readerId
 * ใช้ poll สถานะปุ่ม 1-9 ในหน้าเว็บว่าเครื่องอ่านออนไลน์อยู่ไหม
 */
router.get('/api/coldstorage/rfid/status/:readerId', async (req, res) => {
  const readerId = Number(req.params.readerId);
  const readerConfig = await getReaderConfigForId(readerId);

  if (!readerConfig) {
    return res.status(400).json({ success: false, message: `ไม่พบการตั้งค่าเครื่องอ่านหมายเลข ${readerId}` });
  }

  try {
    const activeMap = await getReaderActiveStates();
    const lastScans = await getLastScanTimes();
    const lastScanTime = lastScans[readerId] || null;
    // online = ตามปุ่ม "เปิดเครื่องอ่าน" เท่านั้น (กดเปิด → ค้างออนไลน์ตลอด, กดปิด → ออฟไลน์)
    const isEnabled = activeMap[readerId] === undefined ? true : activeMap[readerId];
    return res.json({
      success: true,
      readerId,
      readerName: readerConfig.name,
      online: isEnabled,
      lastScanTime,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/coldstorage/rfid/status
 * เช็คสถานะทุกเครื่องพร้อมกันในครั้งเดียว (ลดจำนวน request ตอน poll)
 * อ่าน config จากตาราง RFIDReaderConfig ใน DB (สำหรับ Reader ที่เพิ่มผ่าน Control Panel)
 * สำรองด้วย .env สำหรับ reader ที่ยังไม่ได้สร้าง record ใน DB
 */
router.get('/api/coldstorage/rfid/status', async (req, res) => {
  try {
    const lastScans = await getLastScanTimes();

    // อ่าน config จาก DB (RFIDReaderConfig)
    let dbConfigs = {};
    try {
      const pool = await getPool();
      const dbResult = await pool.request().query(`
        SELECT reader_no, name, ip, port, location_name, is_active
        FROM RFIDReaderConfig
      `);
      dbResult.recordset.forEach((row) => {
        dbConfigs[row.reader_no] = {
          ip: row.ip,
          port: row.port,
          name: row.name,
          location_name: row.location_name,
          is_active: row.is_active,
        };
      });
    } catch (dbErr) {
      // ถ้ายังไม่มีตาราง RFIDReaderConfig จะ fallback ไปใช้ .env
      console.warn("⚠️ ไม่พบตาราง RFIDReaderConfig, ใช้ config จาก .env แทน:", dbErr.message);
    }

    // รวม config จาก DB และ .env (DB ให้ความสำคัญมากกว่า)
    const mergedConfigs = { ...READERS_CONFIG };
    for (const [id, cfg] of Object.entries(dbConfigs)) {
      mergedConfigs[id] = cfg;
    }

    const readers = Object.entries(mergedConfigs).map(([id, cfg]) => {
      const readerId = Number(id);
      const lastScanTime = lastScans[readerId] || null;
      // online = ตามปุ่มเท่านั้น: กด "เปิดเครื่องอ่าน" → ออนไลน์ค้างไว้ตลอด (ไม่ตัดโฟนที่ scan หายนาน)
      // ยังไม่กดเปิด (is_active=0) → ออฟไลน์ (reader ที่ยังไม่มี record ใน DB ถือว่าเปิดได้ตามเดิม)
      const isEnabled = cfg.is_active === undefined ? true : !!cfg.is_active;
      return {
        readerId,
        readerName: cfg.name,
        online: isEnabled,
        lastScanTime,
        location_name: cfg.location_name || null,
      };
    });
    return res.json({ success: true, readers });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/coldstorage/rfid/scan/:readerId
 * สแกนแบบ on-demand (สำรองไว้เผื่อใช้) — ปกติ flow หลักตอนนี้คือ RFIDc1.js
 * ยิง socket "rfidStatusUpdate" เข้ามาแทน ไม่ผ่าน endpoint นี้
 * ⚠️ endpoint นี้ยังคงเปิด TCP connection ตรงไปเครื่องอ่านเหมือนเดิม (ผ่าน scanOnce)
 * ถ้าเรียกตอนที่ rfidc1-service กำลังถือ connection หลักอยู่ จะชนกันแบบเดียวกับปัญหา
 * status endpoint เดิม - ควรใช้เฉพาะตอน rfidc1-service ปิดอยู่ หรือ debug เท่านั้น
 */
router.get('/api/coldstorage/rfid/scan/:readerId', async (req, res) => {
  const readerId = Number(req.params.readerId);
  const readerConfig = await getReaderConfigForId(readerId);

  if (!readerConfig) {
    return res.status(400).json({ success: false, message: `ไม่พบการตั้งค่าเครื่องอ่านหมายเลข ${readerId}` });
  }

  try {
    const epc = await scanOnce(readerConfig);
    const pool = await getPool();
    const result = await pool
      .request()
      .input('epc', sql.VarChar, epc)
      .query('SELECT tro_id FROM RFID_to_Trolley WHERE epc = @epc');

    if (result.recordset.length === 0) {
      return res.json({ success: false, message: `ไม่พบ EPC (${epc}) ในระบบ` });
    }

    return res.json({
      success: true,
      tro_id: result.recordset[0].tro_id,
      epc,
      readerId,
      readerName: readerConfig.name,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/coldstorage/rfid/history/:readerId
 * ประวัติการสแกนที่ผ่านมาของเครื่องอ่านจุดนั้น
 *
 * โหมด Summary (default): แสดงรถเข็นคันเดียว/แถว +จำนวนครั้งที่สแกน
 *   → GET /history/1?limit=50
 *
 * โหมด Detail (ส่ง tro_id): แสดง mapping_id ทั้งหมดของรถเข็นคันนั้นที่สแกนผ่านจุดนี้
 *   → GET /history/1?tro_id=0868&limit=50
 */
router.get('/api/coldstorage/rfid/history/:readerId', async (req, res) => {
  const readerId = Number(req.params.readerId);
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const troId = req.query.tro_id || null;

  if (!Number.isFinite(readerId)) {
    return res.status(400).json({ success: false, message: 'readerId ไม่ถูกต้อง' });
  }

  try {
    const pool = await getPool();
    const request = pool.request()
      .input('readerId', sql.Int, readerId)
      .input('limit', sql.Int, limit);

    let query;
    let mode;

    if (troId) {
      // Detail mode: แสดง mapping_id ทั้งหมดของรถเข็นคันนี้ที่สแกนผ่านจุดนี้
      mode = 'detail';
      request.input('tro_id', sql.VarChar(4), troId);
      query = `
        SELECT TOP (@limit)
               r.scan_time,
               r.reader_id,
               h.tro_id,
               h.mapping_id,
               h.stay_place,
               h.dest
        FROM ReaderScanLog r
        LEFT JOIN History h ON h.hist_id = r.hist_id
        WHERE r.reader_id = @readerId AND h.tro_id = @tro_id
        ORDER BY r.scan_time DESC
      `;
    } else {
      // Summary mode: แสดงรถเข็นคันเดียว/แถว (latest scan + count)
      mode = 'summary';
      query = `
        SELECT TOP (@limit)
               h.tro_id,
               MAX(r.scan_time) AS latest_scan,
               COUNT(*) AS scan_count
        FROM ReaderScanLog r
        INNER JOIN History h ON h.hist_id = r.hist_id
        WHERE r.reader_id = @readerId AND h.tro_id IS NOT NULL
        GROUP BY h.tro_id
        ORDER BY MAX(r.scan_time) DESC
      `;
    }

    const result = await request.query(query);

    return res.json({
      success: true,
      readerId,
      mode,
      tro_id: troId || null,
      scans: result.recordset,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;