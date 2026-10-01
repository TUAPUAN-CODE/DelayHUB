const mssql = require('mssql');
const dotenv = require('dotenv');

dotenv.config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: 1433,
  options: {
    encrypt: true, // สำหรับ Azure
    trustServerCertificate: true, // สำหรับ local dev
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

const connectToDatabase = async (retryCount = 1, delayMs = 3000) => {
  // NEW: connectToDatabase() ถูกเรียกแทบทุก route handler (หลายร้อยจุดทั่วโปรเจกต์) แปลว่า
  // เดิม log บรรทัดนี้ยิงแทบทุก API request ที่เข้ามา ท่วม pm2 logs โดยไม่มีประโยชน์
  // (pool ที่ยังต่ออยู่แล้วไม่ใช่เหตุการณ์ที่ต้อง log ทุกครั้ง) ตัดออกไปเลย เหลือ log
  // เฉพาะตอนต่อ DB ใหม่จริงๆ หรือต่อไม่สำเร็จ (ซึ่งเป็นเหตุการณ์ที่ควรเห็น)
  if (pool && pool.connected) {
    return pool;
  }

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`🔌 Connecting to MSSQL... (Attempt ${attempt}/${retryCount})`);
      pool = await mssql.connect(dbConfig);

      // ตรวจสอบว่า pool ทำงานจริง
      if (!pool.connected) throw new Error("Pool connected is false");

      console.log('✅ Database connection successful!');
      return pool;
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);

      if (attempt < retryCount) {
        console.log(`⏳ Retrying in ${delayMs / 1000} seconds...`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        console.error("❌ All retry attempts failed. Backend will start without DB.");
        // ไม่ process.exit เพื่อให้ backend ยังรันได้ (เช่น /health, Swagger)
        return null;
      }
    }
  }
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
    await poolWC.connect();
    console.log('✅ WC Database connection successful!');
    return poolWC;
  } catch (error) {
    console.error('❌ WC Database connection failed:', error.message);
    poolWC = null;
    return null;
  }
};

module.exports = {
  connectToDatabase,
  connectToDatabaseWC,
  sql: mssql,
};

