require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const { exec } = require('child_process');
const router = express.Router();

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

// ============================================
// GET /api/coldstorage/rfid/config
// ดึงข้อมูล config ของเครื่องอ่าน RFID ทั้งหมด
// ============================================
router.get('/api/coldstorage/rfid/config', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT id, reader_no, name, ip, port, location_name, printer_agent_url,
             printer_host, printer_share, printer_dot_width, is_active, created_at, updated_at
      FROM RFIDReaderConfig
      ORDER BY reader_no
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('Error fetching RFID config:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// GET /api/coldstorage/rfid/config/:id
// ดึงข้อมูล config ของเครื่องอ่าน RFID ตัวเดียว
// ============================================
router.get('/api/coldstorage/rfid/config/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT id, reader_no, name, ip, port, location_name, printer_agent_url,
               printer_host, printer_share, printer_dot_width, is_active, created_at, updated_at
        FROM RFIDReaderConfig
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลเครื่องอ่านนี้' });
    }

    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Error fetching RFID config:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// POST /api/coldstorage/rfid/config
// เพิ่มเครื่องอ่าน RFID ใหม่
// ============================================
router.post('/api/coldstorage/rfid/config', async (req, res) => {
  try {
    const { reader_no, name, ip, port, location_name, printer_agent_url, printer_host, printer_share, printer_dot_width, is_active } = req.body;

    if (!reader_no || !name || !ip || !location_name) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน (reader_no, name, ip, location_name)' });
    }

    const pool = await getPool();
    await pool.request()
      .input('reader_no', sql.Int, reader_no)
      .input('name', sql.NVarChar, name)
      .input('ip', sql.NVarChar, ip)
      .input('port', sql.Int, port || 49152)
      .input('location_name', sql.NVarChar, location_name)
      .input('printer_agent_url', sql.NVarChar, printer_agent_url || 'http://localhost:9100')
      .input('printer_host', sql.NVarChar, printer_host || null)
      .input('printer_share', sql.NVarChar, printer_share || null)
      .input('printer_dot_width', sql.Int, printer_dot_width || null)
      .input('is_active', sql.Bit, is_active !== undefined ? is_active : 0)
      .query(`
        INSERT INTO RFIDReaderConfig (reader_no, name, ip, port, location_name, printer_agent_url, printer_host, printer_share, printer_dot_width, is_active)
        VALUES (@reader_no, @name, @ip, @port, @location_name, @printer_agent_url, @printer_host, @printer_share, @printer_dot_width, @is_active)
      `);

    return res.json({ success: true, message: 'เพิ่มเครื่องอ่านสำเร็จ' });
  } catch (err) {
    console.error('Error creating RFID config:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// PUT /api/coldstorage/rfid/config/:id
// แก้ไขข้อมูลเครื่องอ่าน RFID
// ============================================
router.put('/api/coldstorage/rfid/config/:id', async (req, res) => {
  try {
    const { name, ip, port, location_name, printer_agent_url, printer_host, printer_share, printer_dot_width, is_active } = req.body;
    const id = req.params.id;

    // ดึงค่าเดิมก่อน เพื่อใช้ fill field ที่ frontend ไม่ได้ส่งมา
    const pool = await getPool();
    const existing = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM RFIDReaderConfig WHERE id = @id');

    if (existing.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลเครื่องอ่านนี้' });
    }

    const current = existing.recordset[0];

    await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name || current.name)
      .input('ip', sql.NVarChar, ip || current.ip)
      .input('port', sql.Int, port || current.port)
      .input('location_name', sql.NVarChar, location_name || current.location_name)
      .input('printer_agent_url', sql.NVarChar, printer_agent_url || current.printer_agent_url)
      .input('printer_host', sql.NVarChar, printer_host || current.printer_host)
      .input('printer_share', sql.NVarChar, printer_share || current.printer_share)
      .input('printer_dot_width', sql.Int, printer_dot_width || current.printer_dot_width)
      .input('is_active', sql.Bit, is_active !== undefined ? is_active : current.is_active)
      .query(`
        UPDATE RFIDReaderConfig
        SET name = @name,
            ip = @ip,
            port = @port,
            location_name = @location_name,
            printer_agent_url = @printer_agent_url,
            printer_host = @printer_host,
            printer_share = @printer_share,
            printer_dot_width = @printer_dot_width,
            is_active = @is_active,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    return res.json({ success: true, message: 'แก้ไขข้อมูลสำเร็จ' });
  } catch (err) {
    console.error('Error updating RFID config:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// DELETE /api/coldstorage/rfid/config/:id
// ลบเครื่องอ่าน RFID
// ============================================
router.delete('/api/coldstorage/rfid/config/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;

    // ดึงข้อมูลก่อนลบ เพื่อใช้ stop PM2 process
    const configResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT reader_no FROM RFIDReaderConfig WHERE id = @id');

    if (configResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลเครื่องอ่านนี้' });
    }

    const readerNo = configResult.recordset[0].reader_no;

    // Stop PM2 process ถ้ากำลังทำงานอยู่
    const serviceName = `rfidc${readerNo}-service`;
    exec(`pm2 stop ${serviceName} 2>nul & pm2 delete ${serviceName} 2>nul`, (err) => {
      if (err) console.log(`Info: PM2 service ${serviceName} ไม่ได้ทำงานอยู่`);
    });

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM RFIDReaderConfig WHERE id = @id');

    return res.json({ success: true, message: 'ลบเครื่องอ่านสำเร็จ' });
  } catch (err) {
    console.error('Error deleting RFID config:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// รันคำสั่ง PM2 แบบ serialize + retry
// กันปัญหา spawn EPERM บน Windows (คำสั่ง spawn cmd ชนกัน)
// ============================================
let pm2Chain = Promise.resolve();
function runPm2(command, cwd) {
  const attempt = () => new Promise((resolve) => {
    exec(command, { cwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ err, stdout, stderr });
    });
  });
  const task = async () => {
    let result = await attempt();
    if (result.err && result.err.code === 'EPERM') {
      await new Promise((r) => setTimeout(r, 400));
      result = await attempt();
    }
    return result;
  };
  const run = pm2Chain.then(task);
  pm2Chain = run.catch(() => {});
  return run;
}

// ============================================
// POST /api/coldstorage/rfid/config/:id/toggle
// เปิด/ปิด เครื่องอ่าน RFID (Start/Stop PM2 Process)
// ============================================
router.post('/api/coldstorage/rfid/config/:id/toggle', async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;

    // ดึงข้อมูล config จาก DB
    const configResult = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT id, reader_no, name, ip, port, location_name, printer_agent_url, is_active
        FROM RFIDReaderConfig
        WHERE id = @id
      `);

    if (configResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลเครื่องอ่านนี้' });
    }

    const config = configResult.recordset[0];
    const readerNo = config.reader_no;
    const serviceName = `rfidc${readerNo}-service`;
    const killedName = `ecosystem-rfidc${readerNo}`; // process ที่ชื่อตามไฟล์ (ถ้าโดน start แบบไม่มี --only)
    const newActiveState = !config.is_active;
    const path = require('path');
    const backendDir = path.join(__dirname, '..');

    if (newActiveState) {
      // ====== เปิดเครื่องอ่าน ======
      // สร้าง ecosystem config ถาวรสำหรับ reader ตัวนี้ (ไม่ลบไฟล์)
      // เพราะ PM2 เก็บ reference ไว้ใช้ตอน autorestart — ถ้าลบ จะเจอ MODULE_NOT_FOUND
      // ⚠️ ชื่อไฟล์ต้องลงท้าย .config.js เท่านั้น PM2 ถึงจะอ่านเป็น ecosystem config
      // (ถ้าใช้ชื่ออื่น PM2 จะตีเป็น script ธรรมดา → process ได้ชื่อตามไฟล์ และ log ไม่ไปที่ backend/logs)
      const fs = require('fs');
      const ecosystemPath = path.join(backendDir, `ecosystem-rfidc${readerNo}.config.js`);

      const ecosystem = `module.exports = {
  apps: [{
    name: '${serviceName}',
    script: './RFIDc1.js',
    cwd: './',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    restart_delay: 3000,
    max_memory_restart: '256M',
    out_file: './logs/${serviceName}-out.log',
    error_file: './logs/${serviceName}-error.log',
    env: {
      NODE_ENV: 'production',
      READER_NO: '${readerNo}',
      READER_IP: '${config.ip}',
      READER_PORT: ${config.port},
      READER_NAME: '${config.name}',
      PRINT_AGENT_URL: '${config.printer_agent_url}',
      WEB_SERVER_URL: '${process.env.WEB_SERVER_URL || ''}',
      DB_USER: '${process.env.DB_USER}',
      DB_PASSWORD: '${process.env.DB_PASSWORD}',
      DB_SERVER: '${process.env.DB_SERVER}',
      DB_DATABASE: '${process.env.DB_DATABASE}',
    }
  }]
};`;

      fs.writeFileSync(ecosystemPath, ecosystem);

      // 1) ล้าง process ที่ค้างโผล่ชื่อเดิมทั้งหมด (กัน "Script already launched")
      await runPm2(`pm2 delete ${serviceName} 2>nul & pm2 delete ${killedName} 2>nul`, backendDir);

      // 2) Start ใหม่ (บังคับ -f เผื่อมี process ซ่อนยึด script อยู่)
      const { err, stdout } = await runPm2(`pm2 start "${ecosystemPath}" --only ${serviceName} -f`, backendDir);
      if (err) {
        console.error(`Error starting ${serviceName}:`, err.message);
        return res.status(500).json({ success: false, message: `ไม่สามารถเริ่ม ${serviceName} ได้: ${err.message}` });
      }

      // อัปเดต is_active ใน DB
      await pool.request()
        .input('id', sql.Int, id)
        .query('UPDATE RFIDReaderConfig SET is_active = 1, updated_at = GETDATE() WHERE id = @id');
      return res.json({ success: true, message: `เปิด ${serviceName} สำเร็จ`, is_active: true, stdout });
    } else {
      // ====== ปิดเครื่องอ่าน ======
      await runPm2(`pm2 stop ${serviceName} 2>nul & pm2 delete ${serviceName} 2>nul & pm2 delete ${killedName} 2>nul`, backendDir);

      // อัปเดต is_active ใน DB
      await pool.request()
        .input('id', sql.Int, id)
        .query('UPDATE RFIDReaderConfig SET is_active = 0, updated_at = GETDATE() WHERE id = @id');
      return res.json({ success: true, message: `ปิด ${serviceName} สำเร็จ`, is_active: false });
    }
  } catch (err) {
    console.error('Error toggling RFID config:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// GET /api/coldstorage/rfid/pm2-status
// ดึงสถานะ PM2 process ของ RFID reader ทั้งหมด
// ============================================
router.get('/api/coldstorage/rfid/pm2-status', async (req, res) => {
  try {
    exec('pm2 list --no-color', (err, stdout) => {
      if (err) {
        return res.json({ success: true, data: [] });
      }

      // Parse PM2 output to find rfid services
      const lines = stdout.split('\n');
      const services = [];
      lines.forEach(line => {
        const match = line.match(/rfidc(\d+)-service/) || line.match(/ecosystem-rfidc(\d+)/);
        if (match) {
          const readerNo = parseInt(match[1]);
          const isRunning = line.includes('online');
          services.push({ reader_no: readerNo, pm2_status: isRunning ? 'online' : 'stopped' });
        }
      });

      return res.json({ success: true, data: services });
    });
  } catch (err) {
    console.error('Error getting PM2 status:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// POST /api/coldstorage/rfid/print-claim   body: { scanId, claimedBy }
// หลายเบราว์เซอร์อาจเปิดสวิตช์ "พิมพ์สลิปอัตโนมัติ" พร้อมกัน → ทุกตัวได้รับ readerScanUpdate เดียวกัน
// ตัวแรกที่จอง scanId สำเร็จ (claimed:true) เป็นตัวเดียวที่พิมพ์ ตัวอื่นข้าม — สลิปออกใบเดียวต่อการสแกน
// ต้องรัน migrations/create_RFID_Print_Claim.sql ก่อน
// ============================================
router.post('/api/coldstorage/rfid/print-claim', async (req, res) => {
  const scanId = String(req.body?.scanId ?? '').slice(0, 100);
  const claimedBy = String(req.body?.claimedBy ?? '').slice(0, 100);
  if (!scanId) return res.status(400).json({ success: false, message: 'ไม่มี scanId' });
  try {
    const pool = await getPool();
    try {
      await pool.request()
        .input('scan_id', sql.VarChar(100), scanId)
        .input('claimed_by', sql.VarChar(100), claimedBy)
        .query(`INSERT INTO dbo.RFID_Print_Claim (scan_id, claimed_by) VALUES (@scan_id, @claimed_by)`);
    } catch (err) {
      if (err.number === 2627 || err.number === 2601) {
        return res.json({ success: true, claimed: false }); // มีเบราว์เซอร์อื่นจองไปแล้ว
      }
      throw err;
    }
    // เก็บกวาดข้อมูลเก่า (เป็นครั้งคราว ไม่ต้องทุกครั้ง)
    if (Math.random() < 0.02) {
      pool.request().query(`DELETE FROM dbo.RFID_Print_Claim WHERE claimed_at < DATEADD(DAY, -1, GETDATE())`).catch(() => {});
    }
    return res.json({ success: true, claimed: true });
  } catch (err) {
    console.error('[print-claim] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
