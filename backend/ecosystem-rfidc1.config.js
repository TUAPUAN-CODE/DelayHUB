// สร้างโดยหน้า Control Panel (routes/rfidReaderConfig.js) — ไม่มีรหัสผ่านในไฟล์นี้: ค่า DB_* และ WEB_SERVER_URL อ่านจาก backend/.env ตอนเริ่ม
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

module.exports = {
  apps: [{
    name: "rfidc1-service",
    script: './RFIDc1.js',
    cwd: './',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    restart_delay: 3000,
    max_memory_restart: '256M',
    out_file: "./logs/rfidc1-service-out.log",
    error_file: "./logs/rfidc1-service-error.log",
    env: {
      NODE_ENV: 'production',
      READER_NO: "1",
      READER_IP: "10.246.145.181",
      READER_PORT: 49152,
      READER_NAME: "ฝั่งอุโมงค์",
      PRINT_AGENT_URL: "http://172.48.0.115:9100",
      WEB_SERVER_URL: process.env.WEB_SERVER_URL || "http://172.48.0.115:3000",
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      DB_SERVER: process.env.DB_SERVER,
      DB_DATABASE: process.env.DB_DATABASE,
    }
  }]
};
