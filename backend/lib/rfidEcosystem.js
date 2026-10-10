// สร้างไฟล์ ecosystem ของ PM2 สำหรับ RFID reader แต่ละตัว (ใช้โดย routes/rfidReaderConfig.js และสคริปต์แปลงไฟล์เดิม)
// เดิมต่อค่าจากฐานข้อมูลเข้า JavaScript โดยตรง ('${config.name}') → ชื่อที่มีเครื่องหมาย ' หรือโค้ดแฝงจะถูกรันโดย PM2 (RCE) และเขียนรหัสผ่าน DB ลงไฟล์ที่ถูก commit
// ตอนนี้: ทุกค่าผ่าน JSON.stringify (escape ให้ปลอดภัย), ตรวจรูปแบบก่อน, และ DB_* อ่านจาก .env ตอนเริ่ม (ไม่มีรหัสผ่านในไฟล์)
const IP_RE = /^[A-Za-z0-9.\-]{1,255}$/;
const URL_RE = /^https?:\/\/[^\s'"`\\<>]{1,300}$/;

/** คืนข้อความ error ภาษาไทย หรือ null ถ้าค่าถูกต้อง */
const validateReaderConfig = (config) => {
  if (!Number.isInteger(Number(config.reader_no)) || Number(config.reader_no) < 1 || Number(config.reader_no) > 99) return "reader_no ไม่ถูกต้อง";
  if (!IP_RE.test(String(config.ip || ""))) return "IP/ชื่อโฮสต์ของเครื่องอ่านไม่ถูกต้อง";
  const port = Number(config.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return "พอร์ตของเครื่องอ่านไม่ถูกต้อง";
  const printer = config.printer_agent_url;
  if (printer && !URL_RE.test(String(printer))) return "URL ของ print agent ไม่ถูกต้อง (ต้องขึ้นต้น http:// หรือ https://)";
  if (String(config.name || "").length > 200) return "ชื่อเครื่องอ่านยาวเกินไป";
  return null;
};

const buildEcosystem = (config, serviceName, { webServerUrlFallback = "" } = {}) => {
  const q = (v) => JSON.stringify(String(v ?? ""));
  return `// สร้างโดยหน้า Control Panel (routes/rfidReaderConfig.js) — ไม่มีรหัสผ่านในไฟล์นี้: ค่า DB_* และ WEB_SERVER_URL อ่านจาก backend/.env ตอนเริ่ม
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

module.exports = {
  apps: [{
    name: ${q(serviceName)},
    script: './RFIDc1.js',
    cwd: './',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    restart_delay: 3000,
    max_memory_restart: '256M',
    out_file: ${q(`./logs/${serviceName}-out.log`)},
    error_file: ${q(`./logs/${serviceName}-error.log`)},
    env: {
      NODE_ENV: 'production',
      READER_NO: ${q(config.reader_no)},
      READER_IP: ${q(config.ip)},
      READER_PORT: ${Number(config.port)},
      READER_NAME: ${q(config.name)},
      PRINT_AGENT_URL: ${q(config.printer_agent_url)},
      WEB_SERVER_URL: process.env.WEB_SERVER_URL || ${q(webServerUrlFallback)},
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      DB_SERVER: process.env.DB_SERVER,
      DB_DATABASE: process.env.DB_DATABASE,
    }
  }]
};
`;
};

module.exports = { buildEcosystem, validateReaderConfig };
