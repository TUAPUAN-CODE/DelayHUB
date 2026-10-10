require("./lib/processGuards").installProcessGuards("reset-rsrv-worker");
const { connectToDatabase, sql } = require("./database/db");
const cron = require("node-cron");

// รถเข็นที่จองไว้ (rsrv) จะถูกปล่อยเมื่อเกินกี่นาที — เดิม 1 นาที (จริงๆ 1–2 นาที) สั้นเกินไปสำหรับคนที่กรอกน้ำหนัก/สแกนช้า
// ตั้งให้สอดคล้องกับ RESERVATION_TIMEOUT_MINUTES ของ Slot (5 นาที) ปรับได้ด้วย RSRV_TIMEOUT_MIN ใน .env
const RSRV_TIMEOUT_MIN = Math.max(1, parseInt(process.env.RSRV_TIMEOUT_MIN, 10) || 5);

async function resetRSRV() {
  try {
    const pool = await connectToDatabase();
    if (!pool) {
      console.error("❌ [resetRSRV] Database unavailable — ข้ามรอบนี้");
      return;
    }

    const result = await pool
      .request()
      .input("timeout_min", sql.Int, RSRV_TIMEOUT_MIN)
      .query(`
        UPDATE [dbo].[Trolley]
        SET tro_status = '1',status = '1.1', rsrv_timestamp = NULL
        WHERE tro_status = 'rsrv'
          AND DATEDIFF(MINUTE, rsrv_timestamp, GETDATE()) >= @timeout_min;
      `);

    const rowsAffected = result.rowsAffected[0];
    const time = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

    if (rowsAffected > 0) {
      console.log(`[${time}] ✅ เคลียร์ RSRV แล้ว ${rowsAffected} รายการ`);
    } else {
      console.log(`[${time}] ✅ ไม่มีรายการค้าง`);
    }
  } catch (err) {
    const time = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
    console.error(`[${time}] ❌ เกิดข้อผิดพลาด: ${err.message}`);
  }
}

// รันทันทีตอนเปิด
resetRSRV();

// รันทุก 1 นาที
cron.schedule("* * * * *", resetRSRV);

