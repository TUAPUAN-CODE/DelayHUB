// วัดเวลาของแต่ละ query ในหน้า Sheet บนฐานข้อมูลจริง + ตรวจว่าตารางสำคัญมีดัชนีหรือยัง
//   cd backend && node scripts/sheet-timing.js            (ช่วงวันที่ = วันนี้, ใช้ .env เดียวกับ server)
//   node scripts/sheet-timing.js 2026-10-01 2026-10-20     (ระบุช่วงวันที่)
//   node scripts/sheet-timing.js --probe                   (แยกเวลา CPU / I/O ของแต่ละเงื่อนไขกรองของ mappings)
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
  if (process.argv.includes("--probe")) {
    // แยกเวลา (CPU / elapsed / อ่านกี่ page) ของแต่ละเงื่อนไขในขั้นกรองของ mappings เพื่อหาว่าเงื่อนไขไหนกิน CPU / I/O
    const base = "FROM TrolleyRMMapping rmm WITH (NOLOCK)";
    const variants = [
      ["scan ทั้งตาราง", `SELECT COUNT(*) AS n ${base}`],
      ["dest NOT LIKE %ลบ%", `SELECT COUNT(*) AS n ${base} WHERE ISNULL(rmm.dest, N'') NOT LIKE N'%ลบ%'`],
      ["+ stay_place NOT LIKE %ลบ%", `SELECT COUNT(*) AS n ${base} WHERE ISNULL(rmm.dest, N'') NOT LIKE N'%ลบ%' AND ISNULL(rmm.stay_place, N'') NOT LIKE N'%ลบ%'`],
      ["BIN2: dest + stay_place NOT LIKE %ลบ% (n ต้องเท่ากับแถวบน)", `SELECT COUNT(*) AS n ${base} WHERE ISNULL(rmm.dest, N'') COLLATE Thai_100_BIN2 NOT LIKE N'%ลบ%' AND ISNULL(rmm.stay_place, N'') COLLATE Thai_100_BIN2 NOT LIKE N'%ลบ%'`],
      ["rm_status LIKE %รอQC% / %รอ MD% (collation ปกติ)", `SELECT COUNT(*) AS n ${base} WHERE (ISNULL(rmm.rm_status, N'') LIKE N'%รอQC%' OR ISNULL(rmm.rm_status, N'') LIKE N'%รอ MD%')`],
      ["BIN2: rm_status %รอQC% / %รอ MD% (n ต้องเท่าแถวบน)", `SELECT COUNT(*) AS n ${base} WHERE (ISNULL(rmm.rm_status, N'') COLLATE Thai_100_BIN2 LIKE N'%รอQC%' OR ISNULL(rmm.rm_status, N'') COLLATE Thai_100_BIN2 LIKE N'%รอ MD%')`],
      ["DONE (dest LIKE บรรจุเสร็จ% / สำเร็จ)", `SELECT COUNT(*) AS n ${base} WHERE (ISNULL(rmm.dest, N'') LIKE N'บรรจุเสร็จ%' OR ISNULL(rmm.rm_status, N'') = N'สำเร็จ')`],
      ["weight_RM <> 0", `SELECT COUNT(*) AS n ${base} WHERE ISNULL(rmm.weight_RM, 1) <> 0`],
      ["LTRIM/RTRIM rm_status", `SELECT COUNT(*) AS n ${base} WHERE LTRIM(RTRIM(ISNULL(rmm.rm_status, N''))) = N'QcCheck'`],
    ];
    const collation = await pool.request().query("SELECT CAST(DATABASEPROPERTYEX(DB_NAME(), 'Collation') AS NVARCHAR(100)) AS c, @@VERSION AS v");
    console.log(`collation: ${collation.recordset[0].c}\n${String(collation.recordset[0].v).split("\n")[0]}`);
    for (const [name, q] of variants) {
      const msgs = [];
      const r = pool.request();
      r.on("info", (i) => msgs.push(i.message));
      const t0 = Date.now();
      try {
        const res = await r.batch(`SET STATISTICS IO, TIME ON; ${q}; SET STATISTICS IO, TIME OFF;`);
        const io = msgs.find((m) => m.includes("TrolleyRMMapping")) || "";
        const cpu = msgs.filter((m) => m.includes("CPU time")).pop() || "";
        console.log(`${name.padEnd(40)} ${String(Date.now() - t0).padStart(7)} ms  n=${res.recordset[0].n}\n    ${io.replace(/\s+/g, " ").trim()}\n    ${cpu.replace(/\s+/g, " ").trim()}`);
      } catch (e) { console.log(`${name.padEnd(40)} error: ${e.message}`); }
    }
    process.exit(0);
  }
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
