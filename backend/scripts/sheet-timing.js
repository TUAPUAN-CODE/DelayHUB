// วัดเวลาของแต่ละ query ในหน้า Sheet บนฐานข้อมูลจริง + ตรวจว่าตารางสำคัญมีดัชนีหรือยัง
//   cd backend && node scripts/sheet-timing.js            (ช่วงวันที่ = วันนี้, ใช้ .env เดียวกับ server)
//   node scripts/sheet-timing.js 2026-10-01 2026-10-20     (ระบุช่วงวันที่)
// อ่านอย่างเดียว ไม่แก้ข้อมูล
const sql = require("mssql");
const { connectToDatabase } = require("../database/db");
const { buildMappingQuery, buildHuQuery, buildPlanQuery, buildMixedQuery } = require("../routes/SheetRoutes").__queries;

const ymd = (d) => d.toISOString().slice(0, 10);
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const from = args[0] || ymd(new Date());
const to = args[1] || from;

const bind = (r) => r
  .input("days", sql.Int, 7).input("limit", sql.Int, 3000).input("mlimit", sql.Int, 20000)
  .input("open_from", sql.Date, from).input("open_to", sql.Date, to);

(async () => {
  const pool = await connectToDatabase();
  if (!pool) { console.error("เชื่อมต่อ DB ไม่ได้ (เช็ก .env)"); process.exit(1); }

  console.log(`== จำนวนแถวในตารางหลัก ==`);
  for (const t of ["TrolleyRMMapping", "History", "Batch", "Slot", "RM_EmuMixed", "SAP_Receive", "PackTrolley", "RMForProd"]) {
    try {
      const r = await pool.request().query(`SELECT SUM(p.rows) AS n FROM sys.partitions p WHERE p.object_id = OBJECT_ID(N'dbo.${t}') AND p.index_id IN (0,1)`);
      console.log(`${t.padEnd(18)} ${r.recordset[0].n ?? "-"}`);
    } catch (e) { console.log(`${t.padEnd(18)} error: ${e.message}`); }
  }

  console.log(`\n== ดัชนีที่ขึ้นต้นด้วยคอลัมน์ที่หน้า Sheet ค้นหา ==`);
  const need = [["History", "mapping_id"], ["Batch", "mapping_id"], ["Slot", "tro_id"], ["RM_EmuMixed", "rmfp_id"], ["PackTrolley", "tro_id"], ["TrolleyRMMapping", "rmfp_id"], ["TrolleyRMMapping", "mapping_id"]];
  for (const [t, c] of need) {
    const r = await pool.request().query(`
      SELECT COUNT(*) AS n FROM sys.index_columns ic
      JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
      WHERE ic.object_id = OBJECT_ID(N'dbo.${t}') AND ic.key_ordinal = 1 AND col.name = N'${c}'`);
    console.log(`${(t + "." + c).padEnd(28)} ${r.recordset[0].n > 0 ? "มีดัชนี" : "!! ไม่มีดัชนี (ช้าได้) — ดู migrations/sheet_perf_indexes.sql"}`);
  }

  console.log(`\n== เวลาแต่ละ query (ช่วง ${from} ถึง ${to}) ==`);
  const run = async (name, q) => {
    const t0 = Date.now();
    try {
      const r = await bind(pool.request()).query(q);
      console.log(`${name.padEnd(10)} ${String(Date.now() - t0).padStart(7)} ms   ${r.recordset.length} แถว`);
    } catch (e) { console.log(`${name.padEnd(10)} error: ${e.message}`); }
  };
  const full = buildMappingQuery("open");
  // the first step alone (filter + latest History dates + TOP, no emulsion/Batch/Slot joins): tells which step is the slow one
  const cut = full.indexOf("\n  SELECT TOP (@mlimit)\n      rmm.mapping_id,\n      rmm.from_mapping_id");
  if (cut > 0) await run("map-step1", `${full.slice(0, cut)}\n  SELECT COUNT(*) AS n, MAX(mapping_id) AS m FROM hbase`);
  await run("mappings", full);
  if (process.argv.includes("--dump")) {
    // for SSMS: Query → Include Actual Execution Plan, then run the file and send the plan / the Messages tab
    const fs = require("fs");
    const decl = `DECLARE @days int = 7, @limit int = 3000, @mlimit int = 20000, @open_from date = '${from}', @open_to date = '${to}';\nSET STATISTICS IO, TIME ON;\n`;
    fs.writeFileSync("mappings-query.sql", decl + full);
    console.log("เขียน mappings-query.sql แล้ว (เปิดใน SSMS ฐาน PFCMv2)");
  }
  await run("hus", buildHuQuery());
  await run("plans", buildPlanQuery());
  await run("mixed", buildMixedQuery());
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
