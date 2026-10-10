require('dotenv').config();
require('./lib/processGuards').installProcessGuards('rfid-reader');
const { issueServiceToken } = require('./lib/auth');

const net = require('net');
const sql = require('mssql');
const https = require('https');
const fs = require('fs');
const { createFrameParser, isValidEpc } = require('./rfidFrameParser');
const { io: ioClient } = require('socket.io-client');
// NEW: เรียก print-agent (http://<เครื่องที่ต่อปริ้นเตอร์>:9100) เพื่อสั่งพิมพ์สลิปตอน "ออก" ห้องเย็น
// ต้องรัน `npm install axios` ในโปรเจกต์นี้ก่อน ถ้ายังไม่มี axios อยู่แล้ว
const axios = require('axios');

// NEW: READER_IP/PORT/NAME ด้านล่างนี้เป็นแค่ "ค่าตั้งต้นสำรอง" (bootstrap fallback)
// ใช้เฉพาะตอนที่ยังไม่มีแถวใน DB (ตาราง RFIDReaderConfig) สำหรับ READER_NO นี้เท่านั้น
// แหล่งข้อมูลจริง (single source of truth) คือ DB — โหลดทับค่าพวกนี้ทันทีที่ต่อ DB ได้ (ดู loadReaderConfigFromDb() ด้านล่าง)
// ⚠️ ห้ามแก้ IP ที่นี่แล้วคิดว่าจะมีผล ถ้ามีแถวใน RFIDReaderConfig อยู่แล้วสำหรับ reader_no นี้ ให้ไปแก้ผ่านหน้า Control Panel แทน
const READER_NO = Number(process.env.READER_NO) || 1;
let READER_IP = process.env.READER_IP || "";
let READER_PORT = Number(process.env.READER_PORT) || 49152;
let READER_NAME = process.env.READER_NAME || `RFID_READER_${READER_NO}`;
const READER_DELAY_MINUTES = Number(process.env.READER_DELAY_MINUTES) || 1;
// ถ้าไม่ได้รับข้อมูลจาก reader เลยนานเท่านี้ (ms) ให้ตัดแล้วต่อใหม่ กันกรณีสายหลุดแบบเงียบ (half-open)
// 0 = ปิด; ค่าเริ่มต้น 10 นาที (reader จะเงียบเมื่อไม่มีรถเข็นผ่าน การต่อใหม่ไม่เสียหาย)
const SILENCE_RECONNECT_MS = process.env.RFID_SILENCE_RECONNECT_MS === undefined
    ? 10 * 60 * 1000
    : Number(process.env.RFID_SILENCE_RECONNECT_MS) || 0;
const CONNECT_TIMEOUT_MS = 10 * 1000;

// NEW: log log ปกติ/routine (ทุกครั้งที่สแกน, ทุกขั้นตอนย่อย) จะไม่โผล่ใน `pm2 logs` อีกต่อไป
// เพราะแค่ก่อกวน — เห็นเฉพาะ log ที่เป็นปัญหาจริง (console.warn/console.error) เท่านั้น
// ถ้าต้องการ debug แบบละเอียดชั่วคราว ตั้ง env RFID_DEBUG_LOGS=true แล้ว restart ได้
const DEBUG_LOGS = process.env.RFID_DEBUG_LOGS === 'true';
function debugLog(...args) { if (DEBUG_LOGS) console.log(...args); }

// NEW: URL ของเว็บ server หลัก (ตัวที่รัน Express + Socket.io)
// ต้องเพิ่มบรรทัดนี้ใน .env เช่น WEB_SERVER_URL=https://172.48.0.115:3000
const WEB_SERVER_URL = process.env.WEB_SERVER_URL;

// NEW: URL ของ print-agent (คอมเครื่องที่ต่อเครื่องพิมพ์ EML-400L)
// ถ้าไฟล์นี้รันอยู่คนละเครื่องกับ print-agent ให้เปลี่ยนเป็น IP ของเครื่องนั้นใน .env
// เช่น PRINT_AGENT_URL=http://192.168.1.xxx:9100
const PRINT_AGENT_URL = process.env.PRINT_AGENT_URL || "http://localhost:9100";

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// NEW: โหลด ip/port/name จริงของเครื่องอ่านนี้จากตาราง RFIDReaderConfig (แหล่งข้อมูลจริงจุดเดียว)
// เรียกครั้งเดียวตอนสตาร์ทโปรแกรม ก่อนต่อ TCP ไปเครื่องอ่าน — ถ้าต่อ DB ไม่ได้หรือยังไม่มีแถวสำหรับ
// READER_NO นี้ จะใช้ค่าตั้งต้นสำรอง (จาก .env / ค่า default ในไฟล์) แทน พร้อม warn ให้เห็นชัดๆ
async function loadReaderConfigFromDb() {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('reader_no', sql.Int, READER_NO)
            .query(`SELECT TOP (1) ip, port, name FROM RFIDReaderConfig WHERE reader_no = @reader_no`);

        if (result.recordset.length === 0) {
            console.warn(`⚠️ ไม่พบ RFIDReaderConfig สำหรับ reader_no=${READER_NO} ใน DB — ใช้ค่าตั้งต้นสำรอง: ${READER_IP}:${READER_PORT}`);
            return;
        }

        const row = result.recordset[0];
        READER_IP = row.ip;
        READER_PORT = Number(row.port) || READER_PORT;
        READER_NAME = row.name || READER_NAME;
        console.log(`✅ โหลดค่า Reader #${READER_NO} จาก DB สำเร็จ: ${READER_NAME} (${READER_IP}:${READER_PORT})`);
    } catch (err) {
        console.error(`❌ โหลด RFIDReaderConfig จาก DB ไม่สำเร็จ (ใช้ค่าตั้งต้นสำรองแทน: ${READER_IP}:${READER_PORT}):`, err.message);
    }
}

// NEW: เชื่อมต่อไปหา Socket.io ของเว็บหลัก เป็น "client" อีกตัว
// ไม่ crash โปรแกรมถ้าเว็บ server ปิดอยู่ / ต่อไม่ได้ (แค่ log เตือน)
let webSocket = null;
if (WEB_SERVER_URL) {
    const isHttps = /^https:\/\//i.test(WEB_SERVER_URL);
    const socketOptions = {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 2000,
    };
    if (isHttps) {
        // ตรวจใบรับรองของเว็บ server เสมอ — ถ้าใช้ self-signed ให้ระบุไฟล์ CA ใน .env: WEB_SERVER_CA_FILE=/path/to/cert.pem
        // (ปิดการตรวจชั่วคราวได้ด้วย WEB_SERVER_INSECURE_TLS=true แต่ไม่แนะนำบน production)
        const insecureTls = process.env.WEB_SERVER_INSECURE_TLS === 'true';
        const agentOptions = { rejectUnauthorized: !insecureTls };
        if (process.env.WEB_SERVER_CA_FILE) {
            agentOptions.ca = fs.readFileSync(process.env.WEB_SERVER_CA_FILE);
        }
        if (insecureTls) {
            console.warn('⚠️ WEB_SERVER_INSECURE_TLS=true — ไม่ตรวจใบรับรองของ WEB_SERVER_URL');
        }
        socketOptions.rejectUnauthorized = !insecureTls;
        socketOptions.agent = new https.Agent(agentOptions);
    }
    // ยืนยันตัวตนกับ server ด้วย service token (ออกใหม่ทุกครั้งที่เชื่อม/เชื่อมใหม่; ต้องใช้ AUTH_JWT_SECRET / ค่า DB เดียวกับ backend ใน .env)
    socketOptions.auth = (cb) => cb({ token: issueServiceToken('rfid-reader') });
    webSocket = ioClient(WEB_SERVER_URL, socketOptions);
    webSocket.on('connect', () => {
        console.log(`✅ เชื่อมต่อ WEB_SERVER_URL สำเร็จ: ${WEB_SERVER_URL}`);
        flushPendingWebNotifications(); // NEW: ส่ง event ที่ค้างคิวไว้ตอนหลุดการเชื่อมต่อ ทันทีที่กลับมาต่อได้
    });
    webSocket.on('connect_error', (err) => {
        console.error(`❌ ต่อ WEB_SERVER_URL ไม่ได้ (${WEB_SERVER_URL}): ${err.message}`);
    });
    webSocket.on('disconnect', (reason) => {
        console.warn(`⚠️ WEB_SERVER_URL หลุดการเชื่อมต่อ: ${reason}`);
    });

    // NEW: เซิร์ฟเวอร์ (server.js) มี custom heartbeat ระดับแอป — ยิง event "ping" มาทุก 20 วินาที
    // แล้วคาดหวัง client ตอบกลับด้วย event "pong" ถ้าไม่ตอบครบ 3 รอบติดกัน (~80 วินาที)
    // เซิร์ฟเวอร์จะเตะ connection ทิ้งทันที (เห็นเป็น log "Terminating stale connection" ฝั่งนั้น)
    // ถ้าไม่มี handler นี้ RFIDc1.js จะโดนเตะซ้ำๆ ทุกประมาณ 80 วินาทีตลอดเวลา
    webSocket.on('ping', () => {
        webSocket.emit('pong');
    });
} else {
    console.warn(`⚠️ ไม่ได้ตั้งค่า WEB_SERVER_URL ใน .env — หน้าเว็บจะไม่อัปเดตแบบเรียลไทม์ (รอ auto-refresh เอง)`);
}

// NEW: คิวสำรองไว้เก็บ payload ที่ส่งไม่สำเร็จตอน webSocket หลุดพอดี
// (เดิมถ้าหลุดจังหวะเดียวกับที่สแกน event จะหายไปเลย ไม่มีใครมาส่งซ้ำให้)
const pendingWebNotifications = [];
const MAX_PENDING_NOTIFICATIONS = 100; // กันคิวบวมไม่จำกัดถ้า disconnect ยาวนานผิดปกติ

// NEW: ฟังก์ชันกลางไว้ยิง event บอกเว็บหลัก ปลอดภัยแม้ webSocket ยังไม่พร้อม
// ถ้าส่งไม่ได้ตอนนี้ จะเก็บเข้าคิวไว้ แล้วส่งใหม่อัตโนมัติทันทีที่ webSocket connect กลับมา
function notifyWebClients(payload) {
    if (!webSocket || !webSocket.connected) {
        console.warn(`⚠️ ยังไม่ได้เชื่อมต่อ WEB_SERVER_URL — เก็บเข้าคิวไว้ส่งซ้ำตอน reconnect`);
        if (pendingWebNotifications.length >= MAX_PENDING_NOTIFICATIONS) {
            pendingWebNotifications.shift(); // ตัวเก่าสุดทิ้งไป กันคิวยาวเกินไป
        }
        pendingWebNotifications.push(payload);
        return;
    }
    webSocket.emit('rfidStatusUpdate', payload);
    debugLog(`📡 แจ้งเว็บแล้ว: ${JSON.stringify(payload)}`);
}

// NEW: ส่ง payload ทั้งหมดที่ค้างอยู่ในคิว (เรียกตอน webSocket connect สำเร็จ)
function flushPendingWebNotifications() {
    if (pendingWebNotifications.length === 0) { return; }
    debugLog(`📤 กำลังส่ง ${pendingWebNotifications.length} รายการที่ค้างอยู่ในคิว...`);
    while (pendingWebNotifications.length > 0) {
        const payload = pendingWebNotifications.shift();
        webSocket.emit('rfidStatusUpdate', payload);
        debugLog(`📡 ส่งรายการค้างสำเร็จ: ${JSON.stringify(payload)}`);
    }
}

let client = new net.Socket();

// NEW: guard กันไม่ให้มีการ reconnect ตัวอ่าน RFID ซ้อนกันหลายตัวพร้อมกัน
// (เช่นกรณี event 'error' กับ 'close' ยิงเกือบพร้อมกันจากปัญหาเดียวกัน)
let isReconnecting = false;
let reconnectTimer = null;

// EPC ที่กำลังประมวลผลอยู่ตอนนี้ (กันชนกันระหว่าง DB query ของสแกนซ้อนกัน)
// หมายเหตุ: นี่ไม่ใช่ cooldown — cooldown ย้ายไปเช็คจาก reader_scan_time ใน DB แล้ว
// ตัวนี้แค่กันไม่ให้ EPC เดียวกันถูกประมวลผลซ้อนกัน 2 รอบพร้อมกันในเสี้ยววินาทีเดียวกัน
const processingEpcs = new Set();

function buildCommand7C(hexString) {
    const buf = Buffer.from(hexString, "hex");
    let sum = 0;
    for (let i = 0; i < buf.length; i++) { sum += buf[i]; }
    const checksum = ((~sum) + 1) & 0xFF;
    return Buffer.concat([buf, Buffer.from([checksum])]);
}

function getLocalDatetime() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(now);
    const map = {};
    parts.forEach((p) => { if (p.type !== 'literal') { map[p.type] = p.value; } });
    const hour = map.hour === '24' ? '00' : map.hour;
    return new Date(Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), Number(hour), Number(map.minute), Number(map.second)));
}

function formatThaiDatetime(date) {
    if (!date) { return '-'; }
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} (เวลาไทย)`;
}

// NEW: แปลง rm_status ปัจจุบัน → rm_cold_status ที่ควรเป็น
// (ย้อนกลับจาก statusMap ที่ /cold/checkin/update/Trolley ฝั่ง manual ใช้อยู่)
// เพื่อให้ auto scan (RFID) ก็ set ค่านี้ได้เองโดยไม่ต้องรอ staff เลือกด้วยมือ
// ถ้าเจอ rm_status ที่ reverseMap ไม่รู้จัก จะคืน null (ไม่เดามั่ว) และจะเห็น log เตือนตอนใช้งาน
function getColdStatusFromRmStatus(rm_status) {
    const reverseMap = {
        'รอแก้ไข': 'วัตถุดิบรอแก้ไข',
        'QcCheck รอกลับมาเตรียม': 'วัตถุดิบรับฝาก',
        'QcCheck รอ MD': 'วัตถุดิบรับฝาก',
        'รอ Qc': 'วัตถุดิบรับฝาก',
        'รอกลับมาเตรียม': 'วัตถุดิบรับฝาก',
        'QcCheck': 'วัตถุดิบตรง',
        'เหลือจากไลน์ผลิต': 'เหลือจากไลน์ผลิต',
    };
    return reverseMap[rm_status] || null;
}

async function getHistInfoFromMappingId(pool, mapping_id) {
    const result = await pool.request().input('mapping_id', sql.Int, mapping_id).query(`
        SELECT TOP (1) hist_id, reader_scan_time
        FROM History
        WHERE mapping_id = @mapping_id
        ORDER BY hist_id DESC
    `);
    if (result.recordset.length === 0) { return null; }
    return result.recordset[0]; // { hist_id, reader_scan_time }
}

async function logReaderScanAlways(pool, hist_id, reader_id, now) {
    await pool.request()
        .input('hist_id', sql.Int, hist_id)
        .input('reader_id', sql.Int, reader_id)
        .input('scan_time', sql.DateTime2, now)
        .query(`INSERT INTO ReaderScanLog (hist_id, reader_id, scan_time) VALUES (@hist_id, @reader_id, @scan_time)`);
}

async function hasOpenRegularRound(pool, hist_id) {
    const result = await pool.request().input('hist_id', sql.Int, hist_id).query(`
        SELECT come_cold_date AS come1, out_cold_date AS out1,
               come_cold_date_two AS come2, out_cold_date_two AS out2,
               come_cold_date_three AS come3, out_cold_date_three AS out3
        FROM History WHERE hist_id = @hist_id
    `);
    if (result.recordset.length === 0) { return false; }
    const h = result.recordset[0];
    if (h.come3 !== null && h.out3 === null) { return true; }
    if (h.come2 !== null && h.out2 === null) { return true; }
    if (h.come1 !== null && h.out1 === null) { return true; }
    return false;
}
async function writeColdRoomRoundTimestamp(pool, hist_id, prefix) {
    const comeCol1 = `${prefix}come_cold_date`;
    const outCol1 = `${prefix}out_cold_date`;
    const comeCol2 = `${prefix}come_cold_date_two`;
    const outCol2 = `${prefix}out_cold_date_two`;
    const comeCol3 = `${prefix}come_cold_date_three`;
    const outCol3 = `${prefix}out_cold_date_three`;

    const result = await pool.request().input('hist_id', sql.Int, hist_id).query(`
        SELECT ${comeCol1} AS come1, ${outCol1} AS out1,
               ${comeCol2} AS come2, ${outCol2} AS out2,
               ${comeCol3} AS come3, ${outCol3} AS out3
        FROM History WHERE hist_id = @hist_id
    `);

    if (result.recordset.length === 0) { return null; }
    const h = result.recordset[0];

    let targetColumn = null;
    if (h.come1 === null) {
        targetColumn = comeCol1;
    } else if (h.out1 !== null && h.come2 === null) {
        targetColumn = comeCol2;
    } else if (h.out2 !== null && h.come3 === null) {
        targetColumn = comeCol3;
    }

    if (targetColumn === null) { return null; }

    await pool.request().input('hist_id', sql.Int, hist_id).query(`
        UPDATE History SET ${targetColumn} = GETDATE()
        WHERE hist_id = @hist_id AND ${targetColumn} IS NULL
    `);

    return targetColumn;
}

async function writeColdRoomRoundTimestampOut(pool, hist_id, prefix) {
    const comeCol1 = `${prefix}come_cold_date`;
    const outCol1 = `${prefix}out_cold_date`;
    const comeCol2 = `${prefix}come_cold_date_two`;
    const outCol2 = `${prefix}out_cold_date_two`;
    const comeCol3 = `${prefix}come_cold_date_three`;
    const outCol3 = `${prefix}out_cold_date_three`;

    const result = await pool.request().input('hist_id', sql.Int, hist_id).query(`
        SELECT ${comeCol1} AS come1, ${outCol1} AS out1,
               ${comeCol2} AS come2, ${outCol2} AS out2,
               ${comeCol3} AS come3, ${outCol3} AS out3
        FROM History WHERE hist_id = @hist_id
    `);

    if (result.recordset.length === 0) { return null; }
    const h = result.recordset[0];

    let targetColumn = null;
    if (h.come3 !== null && h.out3 === null) {
        targetColumn = outCol3;
    } else if (h.come2 !== null && h.out2 === null) {
        targetColumn = outCol2;
    } else if (h.come1 !== null && h.out1 === null) {
        targetColumn = outCol1;
    }

    if (targetColumn === null) { return null; }

    await pool.request().input('hist_id', sql.Int, hist_id).query(`
        UPDATE History SET ${targetColumn} = GETDATE()
        WHERE hist_id = @hist_id AND ${targetColumn} IS NULL
    `);

    return targetColumn;
}

// ห้องเย็น (Slot.cs_id) ที่อนุญาตให้ระบบรับเข้าอัตโนมัติ (RFID) เลือกช่องให้
const AUTO_SLOT_CS_IDS = [1, 2, 3, 4, 5, 6, 7];

async function assignColdRoomSlotForTrolley(pool, tro_id, items) {
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

        const updated = []; // [{ mapping_id, hist_id, round: 'first' | 'two' | 'three' }]
        const skipped = [];

        for (const item of items) {
            const mappingResult = await new sql.Request(transaction).input('mapping_id', sql.Int, item.mapping_id).query(`
                SELECT TOP (1) mapping_id, rm_status, rm_cold_status, stay_place, dest
                FROM TrolleyRMMapping WITH (UPDLOCK, HOLDLOCK) WHERE mapping_id = @mapping_id
            `);
            if (mappingResult.recordset.length === 0) {
                skipped.push({ mapping_id: item.mapping_id, reason: 'MAPPING_NOT_FOUND' });
                continue;
            }
            const mapping = mappingResult.recordset[0];

            const normalConditionMatched =
                (mapping.rm_cold_status === null || mapping.rm_cold_status === undefined)
                && mapping.stay_place === 'จุดเตรียม'
                && mapping.dest === 'รอCheckin';

            if (normalConditionMatched) {
                const rm_cold_status = getColdStatusFromRmStatus(mapping.rm_status);
                if (rm_cold_status === null) {
                    console.warn(`⚠️ ไม่รู้จัก rm_status="${mapping.rm_status}" สำหรับ mapping_id=${item.mapping_id} — rm_cold_status จะยังเป็น NULL (ตรวจสอบ statusMap)`);
                }
                await new sql.Request(transaction)
                    .input('mapping_id', sql.Int, item.mapping_id)
                    .input('tro_id', sql.VarChar(5), tro_id)
                    .input('rm_cold_status', sql.VarChar, rm_cold_status)
                    .query(`
                        UPDATE TrolleyRMMapping 
                        SET stay_place = N'เข้าห้องเย็น', dest = N'ห้องเย็น', tro_id = @tro_id,
                            rm_cold_status = @rm_cold_status
                        WHERE mapping_id = @mapping_id
                    `);
                updated.push({ mapping_id: item.mapping_id, hist_id: item.hist_id, round: 'first' });
                continue;
            }

            const eligibleForReentry = mapping.dest === 'รอCheckin';
            if (eligibleForReentry) {
                const historyResult = await new sql.Request(transaction).input('hist_id', sql.Int, item.hist_id).query(`
                    SELECT TOP (1) out_cold_date, come_cold_date_two, out_cold_date_two, come_cold_date_three, out_cold_date_three
                    FROM History WITH (UPDLOCK, HOLDLOCK) WHERE hist_id = @hist_id
                `);
                if (historyResult.recordset.length > 0) {
                    const history = historyResult.recordset[0];
                    let targetRound = null;
                    if (history.out_cold_date !== null && history.come_cold_date_two === null) { targetRound = 'two'; }
                    else if (history.out_cold_date_two !== null && history.come_cold_date_three === null) { targetRound = 'three'; }

                    if (targetRound !== null) {
                        const rm_cold_status = getColdStatusFromRmStatus(mapping.rm_status);
                        if (rm_cold_status === null) {
                            console.warn(`⚠️ ไม่รู้จัก rm_status="${mapping.rm_status}" สำหรับ mapping_id=${item.mapping_id} (reentry) — rm_cold_status จะยังเป็น NULL (ตรวจสอบ statusMap)`);
                        }
                        await new sql.Request(transaction)
                            .input('mapping_id', sql.Int, item.mapping_id)
                            .input('tro_id', sql.VarChar(5), tro_id)
                            .input('rm_cold_status', sql.VarChar, rm_cold_status)
                            .query(`
                                UPDATE TrolleyRMMapping 
                                SET stay_place = N'เข้าห้องเย็น', dest = N'ห้องเย็น', tro_id = @tro_id,
                                    rm_cold_status = @rm_cold_status
                                WHERE mapping_id = @mapping_id
                            `);
                        updated.push({ mapping_id: item.mapping_id, hist_id: item.hist_id, round: targetRound });
                        continue;
                    }
                }
            }

            skipped.push({ mapping_id: item.mapping_id, reason: 'CONDITION_NOT_MATCHED', actual: mapping });
        }

        if (updated.length === 0) {
            await transaction.rollback();
            return { action: 'NO_MAPPING_UPDATED', skipped };
        }

        // เลือกช่องว่างเฉพาะห้องเย็นที่กำหนดใน AUTO_SLOT_CS_IDS (ช่องที่จองไว้มี tro_id = 'rsrv' จึงไม่ถูกเลือก)
        const slotRequest = new sql.Request(transaction);
        const csParams = AUTO_SLOT_CS_IDS.map((id, i) => {
            slotRequest.input(`cs${i}`, sql.Int, id);
            return `@cs${i}`;
        });
        const slotResult = await slotRequest.query(`
            SELECT TOP (1) slot_id FROM Slot WITH (UPDLOCK, HOLDLOCK)
            WHERE tro_id IS NULL AND cs_id IN (${csParams.join(', ')})
            ORDER BY cs_id ASC, slot_id ASC
        `);
        if (slotResult.recordset.length === 0) {
            await transaction.commit();
            return { action: 'MOVED_NO_SLOT_AVAILABLE', updated, skipped };
        }
        const slot_id = slotResult.recordset[0].slot_id;
        await new sql.Request(transaction).input('slot_id', sql.VarChar(20), slot_id).input('tro_id', sql.VarChar(5), tro_id).query(`
            UPDATE Slot SET tro_id = @tro_id WHERE slot_id = @slot_id
        `);
        await transaction.commit();
        return { action: 'MOVED_AND_SLOT_ASSIGNED', slot_id, updated, skipped };

    } catch (error) {
        try { await transaction.rollback(); } catch (rollbackError) { console.error("❌ ROLLBACK ERROR (SLOT-MULTI):", rollbackError.message); }
        throw error;
    }
}

async function logRealtimeStatus(pool, mapping_id, hist_id) {
    const mapResult = await pool.request().input('mapping_id', sql.Int, mapping_id).query(`
        SELECT dest, stay_place FROM TrolleyRMMapping WHERE mapping_id = @mapping_id
    `);
    const histResult = await pool.request().input('hist_id', sql.Int, hist_id).query(`
        SELECT come_cold_date, out_cold_date,
               come_cold_date_two, out_cold_date_two,
               come_cold_date_three, out_cold_date_three
        FROM History WHERE hist_id = @hist_id
    `);
    if (mapResult.recordset.length === 0 || histResult.recordset.length === 0) { return; }
    const m = mapResult.recordset[0];
    const h = histResult.recordset[0];

    let roundLabel = '-';
    let comeTime = null;
    let outTime = null;
    if (h.come_cold_date_three !== null) { roundLabel = 'รอบ 3'; comeTime = h.come_cold_date_three; outTime = h.out_cold_date_three; }
    else if (h.come_cold_date_two !== null) { roundLabel = 'รอบ 2'; comeTime = h.come_cold_date_two; outTime = h.out_cold_date_two; }
    else if (h.come_cold_date !== null) { roundLabel = 'รอบ 1'; comeTime = h.come_cold_date; outTime = h.out_cold_date; }

    debugLog(`📊 สถานะเรียลไทม์: dest="${m.dest}", stay_place="${m.stay_place}"`);
    debugLog(`📊 ${roundLabel} — เข้า: ${formatThaiDatetime(comeTime)} | ออก: ${formatThaiDatetime(outTime)}`);
}

async function processColdRoomExitForTrolley(pool, tro_id, items) {
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

        const closed = []; // [{ mapping_id, hist_id, writtenColumn }]

        for (const item of items) {
            const histResult = await new sql.Request(transaction).input('hist_id', sql.Int, item.hist_id).query(`
                SELECT come_cold_date, out_cold_date,
                       come_cold_date_two, out_cold_date_two,
                       come_cold_date_three, out_cold_date_three
                FROM History WITH (UPDLOCK, HOLDLOCK) WHERE hist_id = @hist_id
            `);
            let writtenColumn = null;
            if (histResult.recordset.length > 0) {
                const h = histResult.recordset[0];
                let targetColumn = null;
                if (h.come_cold_date_three !== null && h.out_cold_date_three === null) { targetColumn = 'out_cold_date_three'; }
                else if (h.come_cold_date_two !== null && h.out_cold_date_two === null) { targetColumn = 'out_cold_date_two'; }
                else if (h.come_cold_date !== null && h.out_cold_date === null) { targetColumn = 'out_cold_date'; }

                if (targetColumn !== null) {
                    await new sql.Request(transaction).input('hist_id', sql.Int, item.hist_id).query(`
                        UPDATE History SET ${targetColumn} = GETDATE()
                        WHERE hist_id = @hist_id AND ${targetColumn} IS NULL
                    `);
                    writtenColumn = targetColumn;
                }
            }

            await new sql.Request(transaction).input('mapping_id', sql.Int, item.mapping_id).query(`
                UPDATE TrolleyRMMapping
                SET stay_place = N'ออกห้องเย็น', dest = N'รอCheckin', rm_cold_status = NULL
                WHERE mapping_id = @mapping_id
            `);

            closed.push({ mapping_id: item.mapping_id, hist_id: item.hist_id, writtenColumn });
        }

        await new sql.Request(transaction).input('tro_id', sql.VarChar(5), tro_id).query(`
            UPDATE Slot SET tro_id = NULL WHERE tro_id = @tro_id
        `);

        await transaction.commit();

        return { action: 'EXIT_PROCESSED', closed };

    } catch (error) {
        try { await transaction.rollback(); } catch (rollbackError) { console.error("❌ ROLLBACK ERROR (EXIT-MULTI):", rollbackError.message); }
        throw error;
    }
}

// NEW: "แดชบอร์ด" นี้เดิมพิมพ์ทุกครั้งที่สแกน (~10-20 บรรทัดต่อครั้ง) ทำให้ pm2 logs ท่วม
// ข้อมูลปกติที่ไม่มีปัญหา — ตอนนี้ปิดเงียบโดย default ผ่าน debugLog ทั้งหมด (เปิดดูได้ผ่าน
// RFID_DEBUG_LOGS=true ตอน debug) เนื้อหายังคงเหมือนเดิมทุกประการ แค่เปลี่ยน console.log → debugLog
async function printTrolleyScanDashboard(pool, tro_id, epc, items, now, wasCooldownSkipped, cooldownRemainingSec) {
    const line = '─'.repeat(78);
    debugLog('');
    debugLog(line);
    debugLog(`🚚  รถเข็น: ${tro_id}   |   EPC: ${epc}   |   Reader: ${READER_NO} (${READER_NAME})`);
    debugLog(`⏱️  เวลาสแกนล่าสุด: ${formatThaiDatetime(now)}`);

    if (wasCooldownSkipped) {
        debugLog(`⏳ ดีเลย์: ยังไม่ครบกำหนด (ตั้งไว้ ${READER_DELAY_MINUTES} นาที) — เหลืออีกประมาณ ${cooldownRemainingSec} วินาที ก่อนสแกนรอบถัดไปจะถูกนับ`);
    } else {
        debugLog(`✅ ดีเลย์: ผ่านเงื่อนไข (ตั้งไว้ ${READER_DELAY_MINUTES} นาที) — สแกนรอบนี้ถูกบันทึกแล้ว`);
    }
    debugLog(line);

    for (const item of items) {
        const histResult = await pool.request().input('hist_id', sql.Int, item.hist_id).query(`
            SELECT come_cold_date, out_cold_date,
                   come_cold_date_two, out_cold_date_two,
                   come_cold_date_three, out_cold_date_three,
                   reader_scan_time
            FROM History WHERE hist_id = @hist_id
        `);
        const mapResult = await pool.request().input('mapping_id', sql.Int, item.mapping_id).query(`
            SELECT dest, stay_place FROM TrolleyRMMapping WHERE mapping_id = @mapping_id
        `);

        if (histResult.recordset.length === 0 || mapResult.recordset.length === 0) { continue; }
        const h = histResult.recordset[0];
        const m = mapResult.recordset[0];

        debugLog(`  📦 mapping_id=${item.mapping_id}  (hist_id=${item.hist_id})`);
        debugLog(`     สถานะปัจจุบัน: dest="${m.dest}" | stay_place="${m.stay_place}"`);

        const rounds = [
            { label: 'รอบ 1', come: h.come_cold_date, out: h.out_cold_date },
            { label: 'รอบ 2', come: h.come_cold_date_two, out: h.out_cold_date_two },
            { label: 'รอบ 3', come: h.come_cold_date_three, out: h.out_cold_date_three },
        ];

        for (const r of rounds) {
            if (r.come === null && r.out === null) { continue; }
            const status = (r.come !== null && r.out === null) ? '🟢 อยู่ในห้องเย็น (ยังไม่ออก)' : '⚪ ออกแล้ว';
            debugLog(`     ${r.label}: เช็คอิน=${formatThaiDatetime(r.come)}  |  เช็คเอาท์=${formatThaiDatetime(r.out)}  ${status}`);
        }

        if (READER_DELAY_MINUTES > 0 && h.reader_scan_time) {
            const nextAllowed = new Date(new Date(h.reader_scan_time).getTime() + READER_DELAY_MINUTES * 60 * 1000);
            debugLog(`     ⏭️  สแกนครั้งถัดไปจะนับผลได้ตั้งแต่: ${formatThaiDatetime(nextAllowed)}`);
        }
    }
    debugLog(line);
    debugLog('');
}

function bindReaderClientEvents(sock) {
    sock.on('data', onReaderData);

    sock.on('error', (err) => {
        console.error("❌ ERROR:", err.message);
    });

    // ต่อไม่ติดภายในเวลาที่กำหนด (เช่น ปลายทางไม่ตอบ) → ตัดแล้วให้ 'close' เรียก reconnect
    sock.on('timeout', () => {
        console.warn(`⏱️ ต่อ Reader ไม่ติดภายใน ${CONNECT_TIMEOUT_MS / 1000} วินาที — ตัดการเชื่อมต่อ`);
        sock.destroy();
    });

    sock.on('close', () => {
        console.warn("🔌 การเชื่อมต่อ Reader ถูกปิด — จะลองเชื่อมต่อใหม่อัตโนมัติ");
        scheduleReconnect();
    });
}

function scheduleReconnect() {
    if (isReconnecting) { return; }
    isReconnecting = true;

    if (reconnectTimer) { clearTimeout(reconnectTimer); }
    reconnectTimer = setTimeout(() => {
        console.warn(`🔄 กำลังลองเชื่อมต่อ Reader ใหม่: ${READER_IP}:${READER_PORT} ...`);
        // ปล่อย guard ก่อนต่อใหม่ ไม่งั้นถ้ารอบนี้ต่อไม่ติด 'close' ครั้งถัดไปจะโดน guard ทิ้ง แล้วไม่มีการลองใหม่อีกเลย
        isReconnecting = false;
        connectReader();
    }, 5000);
}

function connectReader() {
    if (client) {
        client.removeAllListeners();
        client.on('error', () => {});
        client.destroy();
    }
    client = new net.Socket();
    frameParser.reset();
    bindReaderClientEvents(client);
    client.setTimeout(CONNECT_TIMEOUT_MS);

    client.connect(READER_PORT, READER_IP, async () => {
        isReconnecting = false;
        client.setTimeout(0);
        lastDataAt = Date.now();
        console.log(`✅ CONNECTED TO READER: ${READER_IP}:${READER_PORT}`);
        console.log(`📡 Reader เครื่องที่: ${READER_NO} (โหมด: สลับเข้า-ออกอัตโนมัติ, ดีเลย์กันสแกนซ้ำ: ${READER_DELAY_MINUTES} นาที)`);

        client.setKeepAlive(true, 10000);

        const initCmd = buildCommand7C("7CFFFF823200D2");
        client.write(initCmd);
        const startCmd = Buffer.from("7CFFFF20000501000200C896", "hex");
        client.write(startCmd);
        debugLog("💥 START SCAN อัตโนมัติแล้ว...");
    });
}

// กัน reader อ่าน EPC เดิมซ้ำถี่ๆ แล้วยิง UPDATE ลง DB ทุกครั้ง — เขียนได้อย่างมากทุก 60 วินาทีต่อ EPC
const UNKNOWN_EPC_THROTTLE_MS = 60 * 1000;
const unknownEpcLastWrite = new Map();

// EPC ที่ไม่รู้จักต้องถูกอ่านซ้ำอย่างน้อยกี่ครั้งภายในกี่ ms ถึงจะบันทึก (กันค่าอ่านเพี้ยนครั้งเดียว)
const UNKNOWN_EPC_MIN_READS = 2;
const UNKNOWN_EPC_WINDOW_MS = 30 * 1000;
const unknownEpcSeen = new Map();

function shouldRecordUnknownEpc(epc) {
    const now = Date.now();
    if (unknownEpcSeen.size > 1000) {
        for (const [k, v] of unknownEpcSeen) { if (now - v.first > UNKNOWN_EPC_WINDOW_MS) { unknownEpcSeen.delete(k); } }
    }
    const seen = unknownEpcSeen.get(epc);
    if (!seen || now - seen.first > UNKNOWN_EPC_WINDOW_MS) {
        unknownEpcSeen.set(epc, { first: now, count: 1 });
        return UNKNOWN_EPC_MIN_READS <= 1;
    }
    seen.count += 1;
    return seen.count >= UNKNOWN_EPC_MIN_READS;
}

async function recordUnknownEpc(pool, epc) {
    if (!shouldRecordUnknownEpc(epc)) return;
    const last = unknownEpcLastWrite.get(epc);
    if (last && Date.now() - last < UNKNOWN_EPC_THROTTLE_MS) return;
    unknownEpcLastWrite.set(epc, Date.now());
    try {
        await pool.request()
            .input('epc', sql.VarChar(50), epc)
            .input('reader_no', sql.Int, READER_NO)
            .query(`
                UPDATE dbo.RFID_Unknown_EPC SET scan_count = scan_count + 1, last_seen = GETDATE(), reader_no = @reader_no WHERE epc = @epc;
                IF @@ROWCOUNT = 0
                    INSERT INTO dbo.RFID_Unknown_EPC (epc, reader_no) VALUES (@epc, @reader_no);
            `);
    } catch (err) {
        console.error('❌ [recordUnknownEpc] บันทึก EPC ที่ไม่รู้จักไม่สำเร็จ:', err.message);
    }
}

const frameParser = createFrameParser();
let lastDataAt = Date.now();

function onReaderData(data) {
    lastDataAt = Date.now();
    for (const epc of frameParser.push(data)) {
        handleEpc(epc).catch((err) => console.error("❌ handleEpc error:", err.message));
    }
}

async function handleEpc(epc) {
    {
        if (!isValidEpc(epc)) {
            debugLog(`⏭️ ข้าม EPC ที่รูปแบบผิดปกติ: ${epc}`);
            return;
        }

        if (processingEpcs.has(epc)) {
            debugLog(`⏭️ EPC กำลังประมวลผลอยู่: ${epc}`);
            return;
        }

        processingEpcs.add(epc);
        debugLog("");
        debugLog("🎯 EPC:", epc);
        debugLog(`📡 รับจาก Reader ${READER_NO}`);
        debugLog(`📍 Reader IP: ${READER_IP}`);

        let tro_id_forDashboard = null;
        let items_forDashboard = [];

        try {
            const pool = await sql.connect(dbConfig);
            const troResult = await pool.request().input('epc', sql.VarChar, epc).query(`SELECT tro_id FROM RFID_to_Trolley WHERE epc = @epc`);
            if (troResult.recordset.length === 0) {
                console.warn(`❌ ไม่พบ EPC ในระบบ: ${epc}`);
                await recordUnknownEpc(pool, epc);
                return;
            }
            const tro_id = troResult.recordset[0].tro_id;
            tro_id_forDashboard = tro_id;
            debugLog("🚚 tro_id:", tro_id);

            const mappingListResult = await pool.request().input('tro_id', sql.Int, tro_id).query(`SELECT mapping_id, dest FROM TrolleyRMMapping WHERE tro_id = @tro_id`);
            if (mappingListResult.recordset.length === 0) { console.warn(`❌ ไม่พบ mapping_id สำหรับ tro_id: ${tro_id}`); return; }
            debugLog(`📦 พบ ${mappingListResult.recordset.length} mapping_id บนรถเข็นคันนี้: ${mappingListResult.recordset.map(m => m.mapping_id).join(', ')}`);

            const now = getLocalDatetime();

            const items = []; // [{ mapping_id, hist_id, prevScanTime }]
            for (const m of mappingListResult.recordset) {
                if (m.dest === 'ในห้องเย็นใหญ่') {
                    debugLog(`ℹ️ mapping_id=${m.mapping_id} อยู่ในห้องเย็นใหญ่ — ไฟล์นี้ยังไม่จัดการห้องเย็นใหญ่ ข้าม`);
                    continue;
                }

                const histInfo = await getHistInfoFromMappingId(pool, m.mapping_id);
                if (histInfo === null) {
                    console.warn(`❌ ไม่พบ hist_id ใน History สำหรับ mapping_id=${m.mapping_id} — ข้าม`);
                    continue;
                }

                items.push({ mapping_id: m.mapping_id, hist_id: histInfo.hist_id, prevScanTime: histInfo.reader_scan_time });
            }
            items_forDashboard = items;

            if (items.length === 0) {
                debugLog(`ℹ️ ไม่มี mapping_id ไหนบนรถเข็นคันนี้ที่ต้องประมวลผลเพิ่มเติม (tro_id=${tro_id})`);
                return;
            }

            let latestPrevScan = null;
            for (const item of items) {
                if (item.prevScanTime && (latestPrevScan === null || item.prevScanTime > latestPrevScan)) {
                    latestPrevScan = item.prevScanTime;
                }
            }

            if (READER_DELAY_MINUTES > 0 && latestPrevScan !== null) {
                const elapsedMs = now.getTime() - new Date(latestPrevScan).getTime();
                const cooldownMs = READER_DELAY_MINUTES * 60 * 1000;
                if (elapsedMs < cooldownMs) {
                    const remainingSec = Math.ceil((cooldownMs - elapsedMs) / 1000);
                    debugLog(`⏳ ข้าม EPC ${epc} — ยังอยู่ในช่วงดีเลย์ (เช็คจาก reader_scan_time ใน DB, เหลืออีก ${remainingSec} วินาที, ตั้งไว้ ${READER_DELAY_MINUTES} นาที)`);
                    await printTrolleyScanDashboard(pool, tro_id, epc, items, now, true, remainingSec);
                    return;
                }
            }

            for (const item of items) {
                await logReaderScanAlways(pool, item.hist_id, READER_NO, now);
                // NEW: ใช้ READER_IP/READER_NAME ที่โหลดจาก RFIDReaderConfig ตรงๆ (ไม่ JOIN ตาราง Reader เก่าแล้ว
                // เพราะตาราง Reader มีแถว seed แค่ reader_id=1 ตัวเดียว ทำให้ reader 2,3 ไม่เคยได้อัปเดตค่านี้เลยมาก่อน)
                await pool.request()
                    .input('hist_id', sql.Int, item.hist_id)
                    .input('reader_ip', sql.VarChar, READER_IP)
                    .input('reader_name', sql.NVarChar, READER_NAME)
                    .input('reader_scan_time', sql.DateTime2, now)
                    .query(`
                        UPDATE dbo.History SET reader_ip = @reader_ip, reader_name = @reader_name, reader_scan_time = @reader_scan_time
                        WHERE hist_id = @hist_id;
                    `);
                debugLog(`✅ อัปเดต History สำเร็จ (mapping_id=${item.mapping_id}, hist_id=${item.hist_id}, เวลา=${formatThaiDatetime(now)})`);
            }

            let openRound = false;
            for (const item of items) {
                if (await hasOpenRegularRound(pool, item.hist_id)) { openRound = true; break; }
            }

            if (openRound) {
                // ── ออก (ทั้งรถเข็น) ─────────────────────────────────
                try {
                    const exitResult = await processColdRoomExitForTrolley(pool, tro_id, items);
                    if (exitResult.action === 'EXIT_PROCESSED') {
                        debugLog(`📤 Reader: รถออก (tro_id=${tro_id})`);
                        for (const c of exitResult.closed) {
                            if (c.writtenColumn) {
                                debugLog(`🕒 บันทึกเวลาออกลง ${c.writtenColumn} แล้ว (mapping_id=${c.mapping_id}, hist_id=${c.hist_id})`);
                            } else {
                                debugLog(`ℹ️ mapping_id=${c.mapping_id} ไม่มีรอบเปิดค้าง แต่ซ่อมสถานะให้ตรงกับรถเข็นแล้ว`);
                            }
                        }
                        debugLog(`🗄️ เคลียร์ Slot แล้ว (tro_id=${tro_id})`);
                        notifyWebClients({
                            readerId: READER_NO,
                            scanId: `${READER_NO}-${tro_id}-${now.getTime()}`, // รหัสประจำการสแกนครั้งนี้ — หน้าเว็บใช้กันพิมพ์สลิปซ้ำ
                            tro_id,
                            mapping_ids: exitResult.closed.map(c => c.mapping_id),
                            event: 'coldRoomExit',
                            stay_place: 'ออกห้องเย็น',
                            dest: 'รอCheckin'
                        });
                        }
                } catch (exitErr) {
                    console.error("❌ EXIT PROCESS ERROR:", exitErr.message);
                }
                for (const item of items) {
                    await logRealtimeStatus(pool, item.mapping_id, item.hist_id);
                }
            } else {
                // ── เข้า (ทั้งรถเข็น) ────────────────────────────────
                debugLog(`✅ Reader: รถเข้า (กำลังตรวจสอบเงื่อนไขของทุก mapping_id บนรถเข็นนี้...)`);

                try {
                    const slotResult = await assignColdRoomSlotForTrolley(pool, tro_id, items);

                    if (slotResult.action === 'NO_MAPPING_UPDATED') {
                        console.warn(`⚠️ ไม่มี mapping_id ไหนบนรถเข็นนี้ผ่านเงื่อนไขเข้าห้องเย็นเลย (tro_id=${tro_id})`);
                        for (const s of slotResult.skipped) {
                            if (s.reason === 'CONDITION_NOT_MATCHED') {
                                console.warn(`   mapping_id=${s.mapping_id}: ค่าจริง rm_status="${s.actual.rm_status}", rm_cold_status="${s.actual.rm_cold_status}", stay_place="${s.actual.stay_place}", dest="${s.actual.dest}"`);
                            } else {
                                console.warn(`   mapping_id=${s.mapping_id}: ${s.reason}`);
                            }
                        }
                    } else {
                        if (slotResult.action === 'MOVED_AND_SLOT_ASSIGNED') {
                            debugLog(`🗄️ จองช่อง Slot สำเร็จ: slot_id=${slotResult.slot_id}, tro_id=${tro_id}`);
                        } else {
                            console.warn(`⚠️ ย้ายเข้าห้องเย็นแล้ว แต่ไม่มีช่อง Slot ว่าง! (tro_id=${tro_id})`);
                        }

                        for (const u of slotResult.updated) {
                            const roundLabel = u.round === 'first' ? '1' : (u.round === 'two' ? '2' : '3');
                            debugLog(`❄️ ย้ายเข้าห้องเย็นรอบที่ ${roundLabel} แล้ว (mapping_id=${u.mapping_id})`);
                            try {
                                const writtenColumn = await writeColdRoomRoundTimestamp(pool, u.hist_id, '');
                                if (writtenColumn) {
                                    debugLog(`🕒 บันทึกเวลาเข้าห้องเย็นลง ${writtenColumn} แล้ว (mapping_id=${u.mapping_id}, hist_id=${u.hist_id})`);
                                } else {
                                    debugLog(`ℹ️ ยังไม่ถึงรอบใหม่ที่ต้องเขียนเวลา (mapping_id=${u.mapping_id}, hist_id=${u.hist_id})`);
                                }
                            } catch (normalRoomErr) {
                                console.error(`❌ NORMAL ROOM ROUND UPDATE ERROR (mapping_id=${u.mapping_id}):`, normalRoomErr.message);
                            }
                        }
                        for (const s of slotResult.skipped) {
                            debugLog(`⚠️ mapping_id=${s.mapping_id} ไม่ผ่านเงื่อนไข เลยไม่ได้อัปเดตไปพร้อมรถเข็น (${s.reason})`);
                        }

                        notifyWebClients({
                            readerId: READER_NO,
                            scanId: `${READER_NO}-${tro_id}-${now.getTime()}`, // รหัสประจำการสแกนครั้งนี้ — หน้าเว็บใช้กันพิมพ์สลิปซ้ำ
                            tro_id,
                            mapping_ids: slotResult.updated.map(u => u.mapping_id),
                            event: 'coldRoomEntry',
                            stay_place: 'เข้าห้องเย็น',
                            dest: 'ห้องเย็น'
                        });
                    }
                } catch (slotErr) { console.error("❌ SLOT ASSIGN ERROR:", slotErr.message); }

                for (const item of items) {
                    await logRealtimeStatus(pool, item.mapping_id, item.hist_id);
                }
            }

            await printTrolleyScanDashboard(pool, tro_id, epc, items, now, false, 0);

        } catch (err) {
            console.error("❌ DB ERROR:", err.message);
        } finally {
            processingEpcs.delete(epc);
        }
    }
}

// watchdog: ต่อค้างแต่เงียบนานผิดปกติ → ตัดแล้วต่อใหม่
setInterval(() => {
    if (SILENCE_RECONNECT_MS > 0 && client && client.readyState === 'open' && Date.now() - lastDataAt > SILENCE_RECONNECT_MS) {
        console.warn(`⚠️ ไม่ได้รับข้อมูลจาก Reader นาน ${Math.round((Date.now() - lastDataAt) / 1000)} วินาที — ตัดการเชื่อมต่อเพื่อต่อใหม่`);
        client.destroy();
    }
}, 30 * 1000);

(async () => {
    await loadReaderConfigFromDb();
    // ไม่มี IP สำรองฮาร์ดโค้ดแล้ว — ต้องมีแถวใน RFIDReaderConfig หรือ READER_IP ใน .env
    while (!READER_IP) {
        console.error(`❌ ไม่พบ IP ของ Reader #${READER_NO} (ไม่มีแถวใน RFIDReaderConfig และไม่ได้ตั้ง READER_IP ใน .env) — จะลองใหม่ใน 30 วินาที`);
        await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
        await loadReaderConfigFromDb();
    }
    connectReader();
})();

process.on('SIGINT', () => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); }
    client.destroy();
    setTimeout(() => process.exit(0), 500);
});