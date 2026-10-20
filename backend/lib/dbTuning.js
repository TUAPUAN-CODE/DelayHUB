// ปรับฐานข้อมูลอัตโนมัติหลัง backend เปิด (และทุก DB_TUNING_INTERVAL_HOURS) — ทำงานเบื้องหลัง ไม่หน่วงการเปิดระบบ ไม่ทำให้ API ล่มถ้าล้มเหลว
//   1) รันสคริปต์ใน migrations/auto/*.sql ตามลำดับชื่อ (ทุกคำสั่งต้องรันซ้ำได้ — เช่น ดัชนีที่ query หลายหน้าใช้ร่วมกัน)
//   2) สร้างดัชนีที่ SQL Server แจ้งว่าขาด (missing-index DMV จากการใช้งานจริงของทุกหน้า) — จำกัดจำนวน ข้ามที่ซ้ำ/กว้างเกิน, ชื่อขึ้นต้น IX_pfcm_auto_
//   3) อัปเดตสถิติของตารางที่แก้ไปมากแล้ว (ค่าประมาณจำนวนแถวผิด = แผนช้า + ขอ memory grant เกินจริง)
//   4) MAXDOP ระดับฐานข้อมูล: 0 (ใช้ทุก core ต่อ query) → ค่าที่เหมาะกับงาน OLTP เพื่อไม่ให้ query ใหญ่ไม่กี่ตัวแย่ง CPU ทั้ง server
// ทำเฉพาะ PM2 instance 0 และใช้ sp_getapplock กันทำซ้อนเมื่อมีหลายเครื่อง · ปิดทั้งหมด: DB_TUNING=off (ดูตัวเลือกอื่นท้ายไฟล์)
// สั่งเองได้: node scripts/db-tune.js (--dry-run = แสดงคำสั่ง SQL โดยไม่ทำจริง)
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mssql = require("mssql");
const logger = require("./logger");

const AUTO_DIR = path.join(__dirname, "..", "migrations", "auto");
const AUTO_PREFIX = "IX_pfcm_auto_";

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const options = () => ({
  enabled: process.env.DB_TUNING !== "off",
  sqlFiles: process.env.DB_TUNING_SQL_FILES !== "off",
  missingIndexes: process.env.DB_TUNING_MISSING_INDEXES !== "off",
  stats: process.env.DB_TUNING_STATS !== "off",
  maxdop: process.env.DB_TUNING_MAXDOP || "auto",                 // auto | off | ตัวเลข
  perRun: num(process.env.DB_TUNING_INDEXES_PER_RUN, 5),          // ดัชนีอัตโนมัติต่อรอบ
  total: num(process.env.DB_TUNING_INDEXES_TOTAL, 25),            // ดัชนีอัตโนมัติรวมทั้งฐาน
  minImprovement: num(process.env.DB_TUNING_MIN_IMPROVEMENT, 1000),
  offlineMaxRows: num(process.env.DB_TUNING_OFFLINE_MAX_ROWS, 3000000), // Standard edition สร้างแบบ offline (ล็อกการเขียนตารางระหว่างสร้าง): ข้ามตารางที่ใหญ่กว่านี้
  lockTimeoutMs: num(process.env.DB_TUNING_LOCK_TIMEOUT_MS, 10000),
  delayMs: num(process.env.DB_TUNING_DELAY_MS, 60000),
  intervalMs: num(process.env.DB_TUNING_INTERVAL_HOURS, 12) * 3600000,
});

const q = (name) => `[${String(name).replace(/]/g, "]]")}]`;
const cols = (text) => (String(text || "").match(/\[([^\]]+)\]/g) || []).map((c) => c.slice(1, -1));

/** แยกสคริปต์เป็นช่วงตาม GO */
const splitBatches = (text) => text.split(/^\s*GO\s*;?\s*$/im).map((b) => b.trim()).filter((b) => b.replace(/--.*$/gm, "").trim());

const openPool = async () => {
  const { dbConfig } = require("../database/db");
  // connection เดียว (sp_getapplock แบบ Session อยู่กับ connection นี้) + timeout ยาวพอสำหรับสร้างดัชนีบนตารางใหญ่
  const pool = new mssql.ConnectionPool({ ...dbConfig, requestTimeout: 30 * 60 * 1000, pool: { max: 1, min: 0, idleTimeoutMillis: 10 * 60 * 1000 } });
  pool.on("error", (err) => logger.warn("db_tuning_pool_error", { error: err.message }));
  await pool.connect();
  return pool;
};

const runTuning = async ({ dryRun = false, print = null } = {}) => {
  const o = options();
  const report = { dryRun, sqlFiles: [], indexes: [], stats: [], maxdop: null, skipped: [], errors: [] };
  const say = (line) => { if (print) print(line); };
  let pool = null;
  try {
    pool = await openPool();
    // ทุกคำสั่งที่เปลี่ยนฐาน: รอล็อกของงานผลิตไม่เกิน lockTimeoutMs (เกิน = ข้าม ไปทำรอบหน้า) และถ้าชนกันให้งานผลิตชนะ (deadlock victim = เรา)
    const exec = (text) => pool.request().batch(`SET LOCK_TIMEOUT ${Math.round(o.lockTimeoutMs)}; SET DEADLOCK_PRIORITY LOW;\n${text}`);
    const query = (text) => pool.request().query(text);

    const lock = await query("DECLARE @r int; EXEC @r = sp_getapplock @Resource = N'pfcm_db_tuning', @LockMode = N'Exclusive', @LockOwner = N'Session', @LockTimeout = 0; SELECT @r AS r");
    if (lock.recordset[0].r < 0) { say("มีอีก process กำลังปรับฐานข้อมูลอยู่ — ข้ามรอบนี้"); report.skipped.push("locked"); return report; }

    const env = (await query(`SELECT CAST(SERVERPROPERTY('EngineEdition') AS int) AS edition, DB_NAME() AS db,
      CAST(SERVERPROPERTY('Edition') AS nvarchar(128)) AS edition_name`)).recordset[0];
    const online = [3, 5, 8].includes(env.edition); // Enterprise / Developer / Azure: สร้างดัชนีแบบ online ได้ (ไม่ล็อกการเขียน)
    const indexOptions = `ONLINE = ${online ? "ON" : "OFF"}, SORT_IN_TEMPDB = ON, MAXDOP = 2`;
    say(`ฐานข้อมูล ${env.db} · ${env.edition_name} · สร้างดัชนีแบบ ${online ? "online" : "offline"}`);

    // ---- 1) migrations/auto/*.sql ----
    if (o.sqlFiles && fs.existsSync(AUTO_DIR)) {
      for (const file of fs.readdirSync(AUTO_DIR).filter((f) => f.toLowerCase().endsWith(".sql")).sort()) {
        const batches = splitBatches(fs.readFileSync(path.join(AUTO_DIR, file), "utf8").replace(/\{\{INDEX_OPTIONS\}\}/g, indexOptions));
        let ok = 0;
        for (const [i, b] of batches.entries()) {
          if (dryRun) { say(`-- ${file} #${i + 1}\n${b}\nGO`); ok += 1; continue; }
          const t0 = Date.now();
          try {
            await exec(b);
            ok += 1;
            const ms = Date.now() - t0;
            if (ms > 1000) say(`${file} #${i + 1} ${ms} ms`);
          } catch (err) {
            report.errors.push({ step: "sql_file", file, batch: i + 1, error: err.message });
            say(`!! ${file} #${i + 1}: ${err.message}`);
          }
        }
        report.sqlFiles.push({ file, batches: batches.length, ok });
      }
    }

    // ---- 2) ดัชนีที่ขาดจากการใช้งานจริง ---- (แต่ละขั้นล้มเหลวได้เอง เช่น login ไม่มีสิทธิ์ VIEW SERVER STATE — ขั้นอื่นยังทำต่อ)
    if (o.missingIndexes) try {
      const autoCount = (await query(`SELECT COUNT(*) AS n FROM sys.indexes WHERE name LIKE N'${AUTO_PREFIX}%'`)).recordset[0].n;
      let room = Math.max(0, Math.min(o.perRun, o.total - autoCount));
      const sugg = room === 0 ? [] : (await query(`
        SELECT TOP (60)
            OBJECT_SCHEMA_NAME(mid.object_id) AS sch, OBJECT_NAME(mid.object_id) AS tbl, mid.object_id,
            mid.equality_columns, mid.inequality_columns, mid.included_columns,
            migs.user_seeks + migs.user_scans AS uses, migs.avg_user_impact AS impact,
            migs.avg_total_user_cost * (migs.avg_user_impact / 100.0) * (migs.user_seeks + migs.user_scans) AS improvement,
            (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = mid.object_id AND p.index_id IN (0, 1)) AS row_count,
            (SELECT COUNT(*) FROM sys.indexes i WHERE i.object_id = mid.object_id AND i.type = 2) AS nc_count
        FROM sys.dm_db_missing_index_details mid
        JOIN sys.dm_db_missing_index_groups mig ON mig.index_handle = mid.index_handle
        JOIN sys.dm_db_missing_index_group_stats migs ON migs.group_handle = mig.index_group_handle
        WHERE mid.database_id = DB_ID() AND OBJECTPROPERTY(mid.object_id, 'IsUserTable') = 1
        ORDER BY improvement DESC`)).recordset;

      const planned = new Set();
      for (const s of sugg) {
        if (room <= 0) break;
        const keys = [...cols(s.equality_columns), ...cols(s.inequality_columns)];
        let incl = cols(s.included_columns).filter((c) => !keys.includes(c));
        const label = `${s.tbl}(${keys.join(", ")})`;
        const skip = (why) => report.skipped.push({ index: label, why });
        if (s.improvement < o.minImprovement || s.impact < 50 || s.uses < 50) { skip("ผลดีน้อย"); continue; }
        if (keys.length === 0 || keys.length > 4) { skip("คีย์ไม่เหมาะ"); continue; }
        if (s.nc_count >= 15) { skip("ตารางมีดัชนีมากแล้ว"); continue; }
        if (!online && s.row_count > o.offlineMaxRows) { skip("ตารางใหญ่ (offline)"); continue; }

        const meta = (await pool.request().input("oid", mssql.Int, s.object_id).query(`
          SELECT c.name, c.max_length, t.name AS type_name, c.is_computed
          FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
          WHERE c.object_id = @oid`)).recordset;
        const byName = new Map(meta.map((m) => [m.name, m]));
        const lob = (m) => !m || m.max_length === -1 || ["text", "ntext", "image", "xml", "geography", "geometry", "hierarchyid", "sql_variant"].includes(m.type_name);
        if (keys.some((k) => lob(byName.get(k)))) { skip("คีย์เป็นคอลัมน์ข้อความยาว"); continue; }
        if (keys.reduce((n, k) => n + byName.get(k).max_length, 0) > 1700) { skip("คีย์กว้างเกิน 1700 ไบต์"); continue; }
        incl = incl.filter((c) => !lob(byName.get(c)));
        if (incl.length > 10) incl = []; // ข้อเสนอให้ใส่เกือบทั้งแถว: เก็บแค่คีย์ (ยัง seek ได้ ไม่สร้างสำเนาทั้งตาราง)

        // มีดัชนีที่ขึ้นต้นด้วยคีย์ชุดเดียวกันอยู่แล้ว (ลำดับไม่สำคัญ) = ข้าม
        const existing = (await pool.request().input("oid", mssql.Int, s.object_id).query(`
          SELECT ic.index_id, c.name, ic.key_ordinal
          FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
          WHERE ic.object_id = @oid AND ic.key_ordinal > 0 ORDER BY ic.index_id, ic.key_ordinal`)).recordset;
        const byIndex = new Map();
        for (const r of existing) { if (!byIndex.has(r.index_id)) byIndex.set(r.index_id, []); byIndex.get(r.index_id).push(r.name); }
        const want = [...keys].sort().join("|");
        const dup = [...byIndex.values()].some((k) => k.slice(0, keys.length).sort().join("|") === want);
        const tag = `${s.object_id}:${want}`;
        if (dup || planned.has(tag)) { skip("มีดัชนีคล้ายกันแล้ว"); continue; }
        planned.add(tag);

        const name = `${AUTO_PREFIX}${s.tbl}_${crypto.createHash("md5").update(`${keys}|${incl}`).digest("hex").slice(0, 8)}`.slice(0, 128);
        const ddl = `CREATE NONCLUSTERED INDEX ${q(name)} ON ${q(s.sch)}.${q(s.tbl)} (${keys.map(q).join(", ")})`
          + (incl.length ? ` INCLUDE (${incl.map(q).join(", ")})` : "") + ` WITH (${indexOptions})`;
        room -= 1;
        if (dryRun) { say(`${ddl};  -- ผลดีประมาณ ${Math.round(s.improvement)}`); report.indexes.push({ name, ddl, planned: true }); continue; }
        const t0 = Date.now();
        try {
          await exec(ddl);
          report.indexes.push({ name, table: s.tbl, keys, include: incl, ms: Date.now() - t0 });
          say(`สร้าง ${name} บน ${label} (${Date.now() - t0} ms)`);
        } catch (err) {
          report.errors.push({ step: "missing_index", index: label, error: err.message });
          say(`!! ${label}: ${err.message}`);
        }
      }
    } catch (err) {
      report.errors.push({ step: "missing_index", error: err.message });
      say(`!! ดัชนีที่ขาด: ${err.message}`);
    }

    // ---- 3) สถิติที่เก่า ----
    if (o.stats) try {
      const stale = (await query(`
        SELECT TOP (40) OBJECT_SCHEMA_NAME(s.object_id) AS sch, OBJECT_NAME(s.object_id) AS tbl, s.name AS stat,
               sp.rows, sp.modification_counter AS mods
        FROM sys.stats s
        CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
        WHERE OBJECTPROPERTY(s.object_id, 'IsUserTable') = 1 AND sp.rows >= 10000
          AND sp.modification_counter >= CASE WHEN sp.rows * 0.02 > 500 THEN sp.rows * 0.02 ELSE 500 END
        ORDER BY sp.modification_counter DESC`)).recordset;
      const until = Date.now() + 5 * 60 * 1000;
      for (const s of stale) {
        if (Date.now() > until) { report.skipped.push({ stats: "เกินเวลา 5 นาที — ทำต่อรอบหน้า" }); break; }
        const cmd = `UPDATE STATISTICS ${q(s.sch)}.${q(s.tbl)} ${q(s.stat)}`;
        if (dryRun) { say(`${cmd};  -- แก้ไปแล้ว ${s.mods} จาก ${s.rows} แถว`); continue; }
        try {
          await exec(cmd);
          report.stats.push(`${s.tbl}.${s.stat}`);
        } catch (err) {
          report.errors.push({ step: "stats", stat: `${s.tbl}.${s.stat}`, error: err.message });
        }
      }
      if (report.stats.length) say(`อัปเดตสถิติ ${report.stats.length} ชุด`);
    } catch (err) {
      report.errors.push({ step: "stats", error: err.message });
      say(`!! สถิติ: ${err.message}`);
    }

    // ---- 4) MAXDOP ระดับฐานข้อมูล ----
    if (o.maxdop !== "off") {
      try {
        const cur = (await query("SELECT CAST(value AS int) AS v FROM sys.database_scoped_configurations WHERE name = N'MAXDOP'")).recordset[0]?.v ?? 0;
        const server = (await query("SELECT CAST(value_in_use AS int) AS v FROM sys.configurations WHERE name = N'max degree of parallelism'")).recordset[0]?.v ?? 0;
        let target = null;
        if (/^\d+$/.test(o.maxdop)) target = Number(o.maxdop);
        else if (cur === 0 && server === 0) {
          const cpu = (await query("SELECT cpu_count FROM sys.dm_os_sys_info")).recordset[0]?.cpu_count || 0;
          if (cpu > 0) target = Math.min(4, Math.max(1, Math.floor(cpu / 2)));
        }
        if (target !== null && target !== cur) {
          const cmd = `ALTER DATABASE SCOPED CONFIGURATION SET MAXDOP = ${target}`;
          if (dryRun) say(`${cmd};  -- เดิม ${cur} (คืนค่าเดิม: ALTER DATABASE SCOPED CONFIGURATION SET MAXDOP = ${cur})`);
          else { await exec(cmd); say(`MAXDOP ของฐานข้อมูล ${cur} → ${target}`); }
          report.maxdop = { from: cur, to: target };
        }
      } catch (err) {
        report.errors.push({ step: "maxdop", error: err.message });
        say(`!! MAXDOP: ${err.message}`);
      }
    }

    try { await query("EXEC sp_releaseapplock @Resource = N'pfcm_db_tuning', @LockOwner = N'Session'"); } catch { /* ปิด connection แล้วล็อกหลุดเอง */ }
    return report;
  } catch (err) {
    report.errors.push({ step: "run", error: err.message });
    say(`!! ${err.message}`);
    return report;
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};

let running = false;
const runInBackground = async () => {
  if (running) return;
  running = true;
  const t0 = Date.now();
  try {
    const r = await runTuning();
    if (r.skipped.includes("locked")) return;
    logger.info("db_tuning_done", {
      ms: Date.now() - t0,
      sql_files: r.sqlFiles,
      indexes_created: r.indexes.map((i) => i.name),
      stats_updated: r.stats.length,
      maxdop: r.maxdop,
      errors: r.errors.slice(0, 20),
    });
  } catch (err) {
    logger.error("db_tuning_failed", { error: err.message });
  } finally {
    running = false;
  }
};

/** เรียกครั้งเดียวตอน worker เปิด: เริ่มหลัง DB_TUNING_DELAY_MS แล้วทำซ้ำทุก DB_TUNING_INTERVAL_HOURS (เฉพาะ PM2 instance 0 / ไม่ได้รันใต้ PM2) */
const scheduleDbTuning = () => {
  const o = options();
  if (!o.enabled) return;
  const instance = process.env.NODE_APP_INSTANCE;
  if (instance !== undefined && instance !== "0") return;
  setTimeout(runInBackground, o.delayMs).unref();
  if (o.intervalMs > 0) setInterval(runInBackground, o.intervalMs).unref();
};

module.exports = { runTuning, scheduleDbTuning, splitBatches };

// ตัวเลือก (.env — ไม่ตั้ง = ค่าเริ่มต้นในวงเล็บ):
//   DB_TUNING=off (เปิด) · DB_TUNING_SQL_FILES=off · DB_TUNING_MISSING_INDEXES=off · DB_TUNING_STATS=off
//   DB_TUNING_MAXDOP=auto|off|<เลข> (auto: ตั้งเฉพาะเมื่อยังเป็น 0 ทั้งฐานและ server = min(4, CPU/2))
//   DB_TUNING_INDEXES_PER_RUN (5) · DB_TUNING_INDEXES_TOTAL (25) · DB_TUNING_MIN_IMPROVEMENT (1000)
//   DB_TUNING_OFFLINE_MAX_ROWS (3000000) · DB_TUNING_LOCK_TIMEOUT_MS (10000) · DB_TUNING_DELAY_MS (60000) · DB_TUNING_INTERVAL_HOURS (12)
