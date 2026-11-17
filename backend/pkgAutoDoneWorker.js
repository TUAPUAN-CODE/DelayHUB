require("./lib/processGuards").installProcessGuards("pkg-auto-done-worker");
const { connectToDatabase, sql } = require("./database/db");
const cron = require("node-cron");

// ─── UsePKG: ตัดเอกสารที่ลืมกด Done เข้า "ประวัติ" อัตโนมัติ ─────────────────────
// เดิมทำที่ frontend (ใช้นาฬิกาแท็บเล็ต) → แท็บเล็ตที่นาฬิกาเพี้ยนตัดเอกสารกะ NS ทิ้งกลางกะ
// ย้ายมาทำที่นี่ ใช้นาฬิกา server ตัวเดียว
//   DS: ตัดเวลา PKG_DS_CUTOFF ของ report_date        (ค่าเริ่มต้น 18:00)
//   NS: ตัดเวลา PKG_NS_CUTOFF ของวันถัดจาก report_date (ค่าเริ่มต้น 06:00)
// ปรับเวลาได้ใน .env เช่น PKG_DS_CUTOFF=20:00 / PKG_NS_CUTOFF=08:00
const toMinutes = (hhmm, def) => {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : def;
};
const DS_CUTOFF_MIN = toMinutes(process.env.PKG_DS_CUTOFF, 18 * 60);
const NS_CUTOFF_MIN = 24 * 60 + toMinutes(process.env.PKG_NS_CUTOFF, 6 * 60); // วันถัดไป

// "ตอนนี้" เวลาไทย ฝังตัวเลขเป็น UTC (แบบเดียวกับ nowThaiDbDate ใน PackageRoutes) → ลง DATETIME ตรงตัวเลขไทย
function nowThaiDbDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t) => Number(parts.find((p) => p.type === t)?.value);
  return new Date(Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")));
}

let hasDoneAt = false;

async function autoDone() {
  const time = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  try {
    const pool = await connectToDatabase();
    if (!pool) {
      console.error(`[${time}] ❌ [pkgAutoDone] Database unavailable — ข้ามรอบนี้`);
      return;
    }
    if (!hasDoneAt) {
      const c = await pool.request().query(`SELECT COL_LENGTH('PackagingUsageReport', 'done_at') AS len`);
      hasDoneAt = c.recordset[0]?.len != null;
    }

    const result = await pool.request()
      .input("now", sql.DateTime, nowThaiDbDate())
      .input("ds_min", sql.Int, DS_CUTOFF_MIN)
      .input("ns_min", sql.Int, NS_CUTOFF_MIN)
      .query(`
        UPDATE PackagingUsageReport
        SET status = 'done'${hasDoneAt ? ", done_at = @now" : ""}
        OUTPUT INSERTED.report_id, INSERTED.report_date, INSERTED.shift, INSERTED.line_name
        WHERE status <> 'done'
          AND (
            (shift = 'DS' AND DATEADD(MINUTE, @ds_min, CAST(report_date AS DATETIME)) <= @now)
            OR
            (shift = 'NS' AND DATEADD(MINUTE, @ns_min, CAST(report_date AS DATETIME)) <= @now)
          );
      `);

    const rows = result.recordset || [];
    if (rows.length > 0) {
      const list = rows.map((r) => `#${r.report_id} ${r.shift} ${r.line_name || ""}`).join(", ");
      console.log(`[${time}] ✅ [pkgAutoDone] ตัดเข้าประวัติ ${rows.length} ใบ: ${list}`);
    }
  } catch (err) {
    console.error(`[${time}] ❌ [pkgAutoDone] ${err.message}`);
  }
}

autoDone();
cron.schedule("* * * * *", autoDone);
