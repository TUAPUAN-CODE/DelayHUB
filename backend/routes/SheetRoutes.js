// Master Delay Sheet — read-only data for the combined table + per-user column settings.
const express = require("express");
const sql = require("mssql");
const { connectToDatabase } = require("../database/db");

const router = express.Router();

const MAX_ROWS = 5000;
const PREFS_MAX_CHARS = 20000;

// History columns shown by the sheet (all datetime columns are returned as 'yyyy-MM-dd HH:mm:ss' text)
const HIST_DATES = [
  "cooked_date", "rmit_date", "withdraw_date", "qc_date", "sc_pack_date", "gm_date", "start_mixed_date", "start_gravy_date",
  "rmit_date_mix", "mixed_date",
  "come_cold_date", "out_cold_date", "come_cold_date_two", "out_cold_date_two", "come_cold_date_three", "out_cold_date_three",
  "cs_come_cold_date", "cs_out_cold_date", "cs_come_cold_date_two", "cs_out_cold_date_two", "cs_come_cold_date_three",
  "cs_out_cold_date_three", "cs_come_cold_date_four", "cs_out_cold_date_four", "rework_date",
  "start_defrost_date", "end_defrost_date", "start_defrost_date_two", "end_defrost_date_two", "start_defrost_date_three",
  "end_defrost_date_three", "start_defrost_date_four", "end_defrost_date_four",
  "withdraw_date_two", "withdraw_date_three", "withdraw_date_four",
  "input_pd_date", "input_pd_date_two", "input_pd_date_three", "output_pd_date", "output_pd_date_two", "output_pd_date_three",
  "input_cd_date", "input_cd_date_two", "input_cd_date_three",
];
const HIST_TEXT = [
  "hu", "weight", "remark", "remark_dalay", "storage_purpose", "storage_purpose_2", "storage_purpose_3",
  "at_pd_storage_purpose", "at_pd_storage_purpose_2", "at_pd_storage_purpose_3", "cs_re", "cs_re_2", "cs_re_3",
  // fields the Pack / QC forms read from History
  "first_prod", "two_prod", "three_prod", "name_edit_prod_two", "name_edit_prod_three", "remark_rework", "edit_rework",
  "remark_rework_cold", "receiver_qc_cold", "qccheck_cold", "prepare_mor_night", "receiver", "receiver_qc",
];
const SAP_DATES = [
  "withdraw_date", "start_defrost_date", "end_defrost_date", "input_pd_date", "output_pd_date", "input_cd_date",
  "withdraw_date_two", "start_defrost_date_two", "end_defrost_date_two", "input_pd_date_two", "output_pd_date_two", "input_cd_date_two",
  "withdraw_date_three", "start_defrost_date_three", "end_defrost_date_three", "input_pd_date_three", "output_pd_date_three", "input_cd_date_three",
  "withdraw_date_four", "start_defrost_date_four", "end_defrost_date_four",
];

const fmt = (alias, col) => `CONVERT(VARCHAR(19), ${alias}.${col}, 120) AS ${col}`;

const DONE_SQL = "(ISNULL(rmm.dest, N'') LIKE N'บรรจุเสร็จ%' OR ISNULL(rmm.rm_status, N'') = N'สำเร็จ')";
// the date a mapping counts for in the Done table (last thing that happened to it)
const DONE_DATE_SQL = "COALESCE(h.sc_pack_date, h.out_cold_date, h.come_cold_date, h.rmit_date, h.cooked_date)";

/** scope "open" = the work table (everything not finished, however old) · scope "done" = finished rows, searched on demand (date range + text) */
const buildMappingQuery = (scope = "open") => `
  SELECT TOP (@mlimit)
      rmm.mapping_id,
      rmm.from_mapping_id,
      rmm.rmfp_id,
      rmm.group_no,
      rmm.dest,
      rmm.stay_place,
      rmm.rm_status,
      rmm.tray_count,
      rmm.weight_RM,
      rmm.level_eu,
      rmm.tro_id,
      rmm.mix_code,
      rmm.prod_mix,
      rmm.rmm_line_name,
      rmm.qc_id,
      l.line_id,
      ptl.line_tro AS pack_line_id,
      FORMAT(rmm.prep_to_pack_time, 'N2') AS remaining_ptp_time,
      FORMAT(rmg.prep_to_pack, 'N2') AS standard_ptp_time,
      FORMAT(rmm.cold_to_pack_time, 'N2') AS remaining_ctp_time,
      FORMAT(rmg.cold_to_pack, 'N2') AS standard_ctp_time,
      FORMAT(rmm.rework_time, 'N2') AS remaining_rework_time,
      FORMAT(rmg.rework, 'N2') AS standard_rework_time,
      rm.mat,
      rm.mat_name,
      p.doc_no,
      CONCAT(p.doc_no, ' (', rmm.rmm_line_name, ')') AS code,
      rmg.rm_group_id,
      rmg.rm_group_name,
      rmg.rm_type_id,
      FORMAT(rmg.prep_to_cold, 'N2') AS DBS1,
      FORMAT(rmg.cold, 'N2') AS DBS2,
      FORMAT(rmg.cold_to_pack, 'N2') AS DBS3,
      FORMAT(CASE WHEN rmg.rm_group_id IN (55, 85, 49, 46, 82) THEN rmg.prep_to_pack
                  ELSE rmg.prep_to_cold + rmg.cold_to_pack END, 'N2') AS DBS4,
      -- some routes add a mapping without a Batch row (saveTrolley, getout/Trolley, Add/rm/...TrolleyMapping): fall back to the plan's batch
      COALESCE(NULLIF(b.batch_after, N''), NULLIF(CAST(rmm.production_batch AS NVARCHAR(200)), N''), NULLIF(CAST(rmf.batch AS NVARCHAR(200)), N'')) AS batch_after,
      sl.slot_id,
      cs.cs_id,
      cs.cs_name,
      h.hist_id,
      ${HIST_DATES.map((c) => fmt("h", c)).join(",\n      ")},
      ${HIST_TEXT.map((c) => `h.${c}`).join(",\n      ")}
  FROM TrolleyRMMapping rmm WITH (NOLOCK)
  JOIN RMForProd rmf WITH (NOLOCK) ON rmf.rmfp_id = rmm.rmfp_id
  LEFT JOIN ProdRawMat pr WITH (NOLOCK) ON rmm.tro_production_id = pr.prod_rm_id
  LEFT JOIN RawMat rm WITH (NOLOCK) ON pr.mat = rm.mat
  LEFT JOIN Production p WITH (NOLOCK) ON pr.prod_id = p.prod_id
  LEFT JOIN RawMatGroup rmg WITH (NOLOCK) ON rmf.rm_group_id = rmg.rm_group_id
  LEFT JOIN Line l WITH (NOLOCK) ON rmm.rmm_line_name = l.line_name
  OUTER APPLY (
      SELECT TOP 1 pt.line_tro
      FROM PackTrolley pt WITH (NOLOCK)
      WHERE pt.tro_id = rmm.tro_id AND pt.pack_tro_status = '0'
  ) ptl
  LEFT JOIN Slot sl WITH (NOLOCK) ON sl.tro_id = rmm.tro_id AND rmm.tro_id IS NOT NULL
  LEFT JOIN ColdStorage cs WITH (NOLOCK) ON cs.cs_id = sl.cs_id
  OUTER APPLY (
      SELECT STRING_AGG(bb.batch_after, ', ') AS batch_after
      FROM Batch bb WITH (NOLOCK) WHERE bb.mapping_id = rmm.mapping_id
  ) b
  OUTER APPLY (
      SELECT TOP 1 hh.*
      FROM History hh WITH (NOLOCK)
      WHERE hh.mapping_id = rmm.mapping_id
      ORDER BY hh.hist_id DESC
  ) h
  WHERE
      -- rows deleted by the clear / QC-delete / room-delete buttons keep a marker in stay_place / dest ("...ลบจาก...", "ห้องเย็นลบ", "ลบวัตถุดิบโดยSupQC") — not shown
      ISNULL(rmm.dest, N'') NOT LIKE N'%ลบ%' AND ISNULL(rmm.stay_place, N'') NOT LIKE N'%ลบ%'
      -- combinations of (rm_status, stay_place, dest) that are not real work (agreed with the users): never shown, never alerted. Keep in sync with HIDDEN_COMBOS of frontend Sheet/Asset/buildRows.js
      AND NOT EXISTS (
          SELECT 1 FROM (VALUES
              (N'QcCheck', N'create_manual', N'create_manual'),
              (N'QcCheck', N'เข้าห้องเย็น', N'บรรจุ'),
              (N'QcCheck', N'บรรจุ', N'รถเข็นรอจัดส่ง'),
              (N'QcCheck รอแก้ไข', N'จุดเตรียม', N'จุดเตรียม')
          ) hid(rm_status, stay_place, dest)
          WHERE LTRIM(RTRIM(ISNULL(rmm.rm_status, N''))) = hid.rm_status
            AND LTRIM(RTRIM(ISNULL(rmm.stay_place, N''))) = hid.stay_place
            AND LTRIM(RTRIM(ISNULL(rmm.dest, N''))) = hid.dest
      )
      -- "in the big cold room" is only real when the material is on a trolley: no tro_id = not shown. Keep in sync with buildRows.js
      AND NOT (
          LTRIM(RTRIM(ISNULL(rmm.rm_status, N''))) IN (N'รอกลับมาเตรียม', N'QcCheck')
          AND LTRIM(RTRIM(ISNULL(rmm.stay_place, N''))) = N'เข้าห้องเย็นใหญ่'
          AND LTRIM(RTRIM(ISNULL(rmm.dest, N''))) = N'ในห้องเย็นใหญ่'
          AND (rmm.tro_id IS NULL OR LTRIM(RTRIM(CAST(rmm.tro_id AS NVARCHAR(50)))) = N'' OR LTRIM(RTRIM(CAST(rmm.tro_id AS NVARCHAR(50)))) = N'0')
      )
      AND ${scope === "done" ? `
          ${DONE_SQL}
          AND ${DONE_DATE_SQL} >= @date_from AND ${DONE_DATE_SQL} < DATEADD(DAY, 1, @date_to)
          AND (@q = N'' OR (
              rm.mat_name LIKE @q_like OR rm.mat LIKE @q_like OR CAST(rmm.tro_id AS NVARCHAR(50)) LIKE @q_like OR rmm.rmm_line_name LIKE @q_like
              OR CAST(rmf.batch AS NVARCHAR(200)) LIKE @q_like OR p.doc_no LIKE @q_like OR h.hu LIKE @q_like OR rmm.mix_code LIKE @q_like OR CAST(rmm.production_batch AS NVARCHAR(200)) LIKE @q_like
              OR EXISTS (SELECT 1 FROM Batch bq WITH (NOLOCK) WHERE bq.mapping_id = rmm.mapping_id AND bq.batch_after LIKE @q_like)
          ))` : `
          -- the work table: everything that is not finished, however old — these are the rows that get forgotten. Finished rows are in the Done table
          NOT ${DONE_SQL}`}
  ORDER BY rmm.mapping_id DESC
`;

const buildHuQuery = () => `
  SELECT TOP (@limit)
      s.sap_re_id, s.batch, s.mat, rm.mat_name, s.hu, s.before_hu, s.weight, s.remark, s.cs_re, s.cs_re_2, s.cs_re_3,
      ${SAP_DATES.map((c) => fmt("s", c)).join(",\n      ")}
  FROM SAP_Receive s WITH (NOLOCK)
  LEFT JOIN RawMat rm WITH (NOLOCK) ON rm.mat = s.mat
  CROSS APPLY (
      SELECT MAX(v.d) AS last_at
      FROM (VALUES ${SAP_DATES.map((c) => `(s.${c})`).join(",")}) AS v(d)
  ) la
  WHERE s.status = 1 AND la.last_at >= DATEADD(DAY, -@days, GETDATE())
  ORDER BY la.last_at DESC, s.sap_re_id DESC
`;

// Production-plan rows that were scanned ("สแกนป้าย SAP") but are not in a trolley yet: the same rows the old "จัดการวัตถุดิบ" page listed (all raw material types).
// Same field names as /prep/manage/fetchRMForProd, so the "จัดการ" menu of the sheet works on them.
const buildPlanQuery = () => `
  SELECT TOP (@limit)
      rmf.rmfp_id,
      CASE WHEN rmf.batch LIKE 'mix_batch_' THEN
          (SELECT STRING_AGG(rmmb.batch, ',') FROM Mix_Batch_Prod mbp2 JOIN RMMixBatch rmmb ON mbp2.rmfbatch_id = rmmb.rmfbatch_id WHERE mbp2.rmfp_id = rmf.rmfp_id)
          ELSE rmf.batch END AS batch,
      rm.mat,
      rm.mat_name,
      rmf.dest,
      rmf.weight,
      CONCAT(p.doc_no, ' (', rmf.rmfp_line_name, ')') AS production,
      rmf.rmfp_line_name,
      rmg.rm_type_id,
      rmg.rm_group_name,
      rmg.cold,
      rmf.level_eu,
      rmf.remark,
      rmf.hu,
      FORMAT(htr.cooked_date, 'dd/MM/yyyy HH:mm') AS CookedDateTime,
      CONVERT(VARCHAR(19), htr.cooked_date, 120) AS cooked_date,
      FORMAT(htr.withdraw_date, 'dd/MM/yyyy HH:mm') AS withdraw_date
  FROM RMForProd rmf WITH (NOLOCK)
  JOIN ProdRawMat pr WITH (NOLOCK) ON rmf.prod_rm_id = pr.prod_rm_id
  JOIN RawMat rm WITH (NOLOCK) ON pr.mat = rm.mat
  JOIN Production p WITH (NOLOCK) ON pr.prod_id = p.prod_id
  JOIN RawMatGroup rmg WITH (NOLOCK) ON rmf.rm_group_id = rmg.rm_group_id
  JOIN History htr WITH (NOLOCK) ON rmf.hist_id_rmfp = htr.hist_id
  WHERE rmf.stay_place IN (N'จุดเตรียมรับเข้า', N'หม้ออบ')
    AND rmf.dest IN (N'ไปจุดเตรียม', N'จุดเตรียม')
  ORDER BY htr.cooked_date DESC
`;

router.get("/sheet/rows", async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 365);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 3000, 100), MAX_ROWS); // HU rows + plan rows
    const mlimit = Math.min(Math.max(parseInt(req.query.mlimit, 10) || 20000, 100), 50000); // open mappings: never cut at a few thousand rows

    const pool = await connectToDatabase();
    if (!pool) {
      return res.status(503).json({ success: false, error: "Database unavailable" });
    }

    const bind = (request) => request
      .input("days", sql.Int, days)
      .input("limit", sql.Int, limit)
      .input("mlimit", sql.Int, mlimit);

    const [mappings, hus, plans] = await Promise.all([
      bind(pool.request()).query(buildMappingQuery("open")),
      bind(pool.request()).query(buildHuQuery()),
      bind(pool.request()).query(buildPlanQuery()).catch((err) => { console.error("[Route /sheet/rows] plans error:", err.message); return { recordset: [] }; }),
    ]);

    res.json({ success: true, mappings: mappings.recordset, hus: hus.recordset, plans: plans.recordset, days, limit });
  } catch (err) {
    console.error("[Route /sheet/rows] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Done table: finished rows are NOT loaded with the work table. The user picks the date range (+ optional text) first, then the rows are read from the database.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
router.get("/sheet/done", async (req, res) => {
  try {
    const ymd = (d) => d.toISOString().slice(0, 10);
    const dateTo = DATE_RE.test(req.query.date_to || "") ? req.query.date_to : ymd(new Date());
    const dateFrom = DATE_RE.test(req.query.date_from || "") ? req.query.date_from : ymd(new Date(Date.now() - 7 * 86400000));
    if (dateFrom > dateTo) {
      return res.status(400).json({ success: false, error: "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด" });
    }
    const q = String(req.query.q || "").trim().slice(0, 100);
    const mlimit = Math.min(Math.max(parseInt(req.query.limit, 10) || 2000, 100), 20000);

    const pool = await connectToDatabase();
    if (!pool) {
      return res.status(503).json({ success: false, error: "Database unavailable" });
    }
    const result = await pool.request()
      .input("mlimit", sql.Int, mlimit)
      .input("date_from", sql.Date, dateFrom)
      .input("date_to", sql.Date, dateTo)
      .input("q", sql.NVarChar(100), q)
      .input("q_like", sql.NVarChar(110), `%${q.replace(/[\[%_]/g, (c) => `[${c}]`)}%`)
      .query(buildMappingQuery("done"));

    res.json({ success: true, mappings: result.recordset, limit: mlimit, capped: result.recordset.length >= mlimit, date_from: dateFrom, date_to: dateTo });
  } catch (err) {
    console.error("[Route /sheet/done] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── per-user column settings ─────────────────────────────────────────────
const parsePrefsKey = (src) => {
  const userId = parseInt(src.user_id, 10);
  const sheetKey = String(src.sheet_key || "").trim();
  if (Number.isNaN(userId) || !/^[A-Za-z0-9_-]{1,50}$/.test(sheetKey)) return null;
  return { userId, sheetKey };
};
const isMissingTable = (err) => err && (err.number === 208 || /Invalid object name/i.test(err.message || ""));

// The settings table is created here the first time it is needed (same DDL as migrations/create_SheetUserPrefs.sql, only when it does not exist yet),
// so a settings save does not depend on somebody running the SQL by hand. If the database login may not create tables, the old behaviour stays (503 PREFS_TABLE_MISSING).
let prefsTableChecked = false;
const ensurePrefsTable = async (pool) => {
  if (prefsTableChecked) return;
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.SheetUserPrefs', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.SheetUserPrefs (
            user_id     INT            NOT NULL,
            sheet_key   NVARCHAR(50)   NOT NULL,
            config      NVARCHAR(MAX)  NOT NULL,
            updated_at  DATETIME       NOT NULL CONSTRAINT DF_SheetUserPrefs_updated DEFAULT (GETDATE()),
            CONSTRAINT PK_SheetUserPrefs PRIMARY KEY (user_id, sheet_key)
        );
    END
  `);
  prefsTableChecked = true;
  console.log("✅ [Sheet] ตรวจ/สร้างตาราง SheetUserPrefs เรียบร้อย");
};
/** run a query on SheetUserPrefs; when the table is missing try to create it once and run it again */
const withPrefsTable = async (pool, run) => {
  try {
    return await run();
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    try { await ensurePrefsTable(pool); } catch (createErr) {
      console.error("❌ [Sheet] สร้างตาราง SheetUserPrefs ไม่สำเร็จ (สิทธิ์ไม่พอ? ให้ DBA รัน migrations/create_SheetUserPrefs.sql):", createErr.message);
      throw err;
    }
    return run();
  }
};

router.get("/sheet/prefs", async (req, res) => {
  const key = parsePrefsKey(req.query);
  if (!key) return res.status(400).json({ success: false, error: "ต้องระบุ user_id และ sheet_key ให้ถูกต้อง" });
  try {
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    const result = await withPrefsTable(pool, () => pool.request()
      .input("user_id", sql.Int, key.userId)
      .input("sheet_key", sql.NVarChar(50), key.sheetKey)
      .query("SELECT config FROM SheetUserPrefs WHERE user_id = @user_id AND sheet_key = @sheet_key"));
    res.json({ success: true, config: result.recordset[0]?.config ?? null });
  } catch (err) {
    if (isMissingTable(err)) {
      return res.status(503).json({ success: false, code: "PREFS_TABLE_MISSING", error: "ยังไม่ได้สร้างตาราง SheetUserPrefs" });
    }
    console.error("[Route GET /sheet/prefs] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/sheet/prefs", async (req, res) => {
  const key = parsePrefsKey(req.body || {});
  const config = typeof req.body?.config === "string" ? req.body.config : null;
  if (!key || !config || config.length > PREFS_MAX_CHARS) {
    return res.status(400).json({ success: false, error: "ข้อมูลการตั้งค่าไม่ถูกต้อง" });
  }
  try {
    JSON.parse(config);
  } catch {
    return res.status(400).json({ success: false, error: "config ต้องเป็น JSON" });
  }
  try {
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await withPrefsTable(pool, () => pool.request()
      .input("user_id", sql.Int, key.userId)
      .input("sheet_key", sql.NVarChar(50), key.sheetKey)
      .input("config", sql.NVarChar(sql.MAX), config)
      .query(`
        UPDATE SheetUserPrefs SET config = @config, updated_at = GETDATE()
        WHERE user_id = @user_id AND sheet_key = @sheet_key;
        IF @@ROWCOUNT = 0
          INSERT INTO SheetUserPrefs (user_id, sheet_key, config) VALUES (@user_id, @sheet_key, @config);
      `));
    res.json({ success: true, message: "บันทึกการตั้งค่าสำเร็จ" });
  } catch (err) {
    if (isMissingTable(err)) {
      return res.status(503).json({ success: false, code: "PREFS_TABLE_MISSING", error: "ยังไม่ได้สร้างตาราง SheetUserPrefs" });
    }
    console.error("[Route PUT /sheet/prefs] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
