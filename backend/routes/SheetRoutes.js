// Master Delay Sheet — read-only data for the combined table + per-user column settings.
const express = require("express");
const crypto = require("crypto");
const sql = require("mssql");
const { connectToDatabase } = require("../database/db");
const { cached, invalidateSheetCache } = require("../lib/sheetCache");
const { safeRollback } = require("../lib/safeRollback");
const { verifyToken } = require("../lib/auth");
const { getAuthMode } = require("../lib/authMiddleware");
const metrics = require("../lib/metrics");
const logger = require("../lib/logger");
const { lineageOf } = require("../lib/mappingLineage");

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

// รายงานเวลาของแต่ละ query ของหน้า Sheet: ช้ากว่า SLOW_MS แสดงใน log (pm2 logs → หา "[sheet-slow]") เพื่อรู้ว่า query ไหนช้าจริง
const SLOW_MS = 1500;
const timed = async (name, fn, sink) => {
  const t0 = Date.now();
  const r = await fn();
  const ms = Date.now() - t0;
  if (sink) sink.push(`${name};dur=${ms};desc="${r?.recordset?.length ?? 0} rows"`);
  if (ms >= SLOW_MS) console.warn(`[sheet-slow] ${name} ${ms} ms, ${r?.recordset?.length ?? "-"} rows`);
  return r;
};

const fmt = (alias, col) => `CONVERT(VARCHAR(19), ${alias}.${col}, 120) AS ${col}`;

const DONE_SQL = "(ISNULL(rmm.dest, N'') LIKE N'บรรจุเสร็จ%' OR ISNULL(rmm.rm_status, N'') = N'สำเร็จ')";
// the date a mapping counts for in the Done table (last thing that happened to it)
const DONE_DATE_SQL = "COALESCE(h.sc_pack_date, h.out_cold_date, h.come_cold_date, h.rmit_date, h.cooked_date)";

/** scope "open" = the work table (everything not finished, however old) · scope "done" = finished rows, searched on demand (date range + text) */
// Done table by dates: the mappings that have a History time inside the range, found first by the date columns themselves.
// Without it SQL Server worked out the latest History row of EVERY finished mapping ever (they only grow) before it could compare the dates.
// It never drops a row the full condition keeps: a row whose DONE_DATE_SQL is in the range has that same History column in the range.
const DONE_DATE_COLS = ["sc_pack_date", "out_cold_date", "come_cold_date", "rmit_date", "cooked_date"];
const DONE_RANGE_SQL = `rmm.mapping_id IN (
              SELECT hd.mapping_id FROM History hd WITH (NOLOCK)
              WHERE ${DONE_DATE_COLS.map((c) => `(hd.${c} >= @date_from AND hd.${c} < DATEADD(DAY, 1, @date_to))`).join("\n                 OR ")}
          )`;

/** opts.dated (scope "done"): the request has a date range (no text) */
const buildMappingQuery = (scope = "open", opts = {}) => {
  const whereSql = scope === "one" ? "WHERE rmm.mapping_id = @one_id" : `WHERE
        -- rows deleted by the clear / QC-delete / room-delete buttons keep a marker in stay_place / dest ("...ลบจาก...", "ห้องเย็นลบ", "ลบวัตถุดิบโดยSupQC") — not shown
        -- COLLATE Thai_100_BIN2: a LIKE '%..%' under the database collation (Thai_100_CI_AI) calls the OS string compare for every row (~10 s per column on 5e5 rows, and it is not counted as CPU); the marker is a fixed text written by the app, so a binary compare is exact and ~100x faster
        ISNULL(rmm.dest, N'') COLLATE Thai_100_BIN2 NOT LIKE N'%ลบ%' AND ISNULL(rmm.stay_place, N'') COLLATE Thai_100_BIN2 NOT LIKE N'%ลบ%'
        -- combinations of (rm_status, stay_place, dest) that are not real work (agreed with the users): never shown, never alerted. Keep in sync with HIDDEN_COMBOS of frontend Sheet/Asset/buildRows.js
        AND NOT EXISTS (
            SELECT 1 FROM (VALUES
                (N'QcCheck', N'create_manual', N'create_manual'),
                (N'QcCheck', N'เข้าห้องเย็น', N'บรรจุ'),
                (N'QcCheck', N'บรรจุ', N'รถเข็นรอจัดส่ง'),
                (N'QcCheck รอแก้ไข', N'จุดเตรียม', N'จุดเตรียม')
            ) hid(rm_status, stay_place, dest)
            WHERE LTRIM(RTRIM(ISNULL(rmm.rm_status, N''))) COLLATE Thai_100_BIN2 = hid.rm_status
              AND LTRIM(RTRIM(ISNULL(rmm.stay_place, N''))) COLLATE Thai_100_BIN2 = hid.stay_place
              AND LTRIM(RTRIM(ISNULL(rmm.dest, N''))) COLLATE Thai_100_BIN2 = hid.dest
        )
        -- weight 0 = nothing left of the material: not shown on any list (agreed with the users)
        AND ISNULL(rmm.weight_RM, 1) <> 0${scope === "done" ? `
        -- (Done table: no "waiting for QC without a trolley" rule. A packed row is Done whatever rm_status still says — e.g. "QcCheck รอ MD" when the
        --  metal detector is run at the line — and the row made by "บรรจุเสร็จ" has no trolley, so that rule hid those rows. buildRows.js gives Done first too)` : `
        -- waiting for QC without a trolley: not shown. (QcCheck รอ MD going to บรรจุ / รอCheckin is "รอบรรจุเสร็จ" and stays.) Keep in sync with buildRows.js
        AND NOT (
            (ISNULL(rmm.rm_status, N'') COLLATE Thai_100_BIN2 LIKE N'%รอQC%' OR ISNULL(rmm.rm_status, N'') COLLATE Thai_100_BIN2 LIKE N'%รอ MD%')
            AND (rmm.tro_id IS NULL OR LTRIM(RTRIM(CAST(rmm.tro_id AS NVARCHAR(50)))) COLLATE Thai_100_BIN2 IN (N'', N'0'))
            AND NOT (LTRIM(RTRIM(ISNULL(rmm.rm_status, N''))) COLLATE Thai_100_BIN2 = N'QcCheck รอ MD' AND LTRIM(RTRIM(ISNULL(rmm.dest, N''))) COLLATE Thai_100_BIN2 IN (N'บรรจุ', N'รอCheckin'))
        )`}
        -- "in the big cold room" is only real when the material is on a trolley: no tro_id = not shown. Keep in sync with buildRows.js
        AND NOT (
            LTRIM(RTRIM(ISNULL(rmm.rm_status, N''))) COLLATE Thai_100_BIN2 IN (N'รอกลับมาเตรียม', N'QcCheck')
            AND LTRIM(RTRIM(ISNULL(rmm.stay_place, N''))) COLLATE Thai_100_BIN2 = N'เข้าห้องเย็นใหญ่'
            AND LTRIM(RTRIM(ISNULL(rmm.dest, N''))) COLLATE Thai_100_BIN2 = N'ในห้องเย็นใหญ่'
            AND (rmm.tro_id IS NULL OR LTRIM(RTRIM(CAST(rmm.tro_id AS NVARCHAR(50)))) COLLATE Thai_100_BIN2 = N'' OR LTRIM(RTRIM(CAST(rmm.tro_id AS NVARCHAR(50)))) COLLATE Thai_100_BIN2 = N'0')
        )
        AND ${scope === "done" ? `
            ${DONE_SQL}
            -- dates: optional (NULL = no date filter). A text search ignores the dates (the server sends NULL dates with a text)
            AND (@date_from IS NULL OR (${DONE_DATE_SQL} >= @date_from AND ${DONE_DATE_SQL} < DATEADD(DAY, 1, @date_to)))${opts.dated ? `
            AND ${DONE_RANGE_SQL}` : ""}
            -- text search: any of the data columns of the table (same columns as the Sheet's settings)
            AND (@q = N'' OR (
                rm.mat_name LIKE @q_like OR rm.mat LIKE @q_like OR rmg.rm_group_name LIKE @q_like
                OR CAST(rmm.tro_id AS NVARCHAR(50)) LIKE @q_like OR rmm.rmm_line_name LIKE @q_like
                OR rmm.dest LIKE @q_like OR rmm.stay_place LIKE @q_like OR rmm.rm_status LIKE @q_like
                OR rmm.level_eu LIKE @q_like OR rmm.prod_mix LIKE @q_like OR rmm.mix_code LIKE @q_like
                OR CAST(rmm.tray_count AS NVARCHAR(30)) LIKE @q_like OR CAST(rmm.weight_RM AS NVARCHAR(30)) LIKE @q_like
                OR CAST(rmf.batch AS NVARCHAR(200)) LIKE @q_like OR CAST(rmm.production_batch AS NVARCHAR(200)) LIKE @q_like
                OR p.doc_no LIKE @q_like OR h.hu LIKE @q_like
                OR EXISTS (SELECT 1 FROM Batch bq WITH (NOLOCK) WHERE bq.mapping_id = rmm.mapping_id AND bq.batch_after LIKE @q_like)
            ))` : `
            -- the work table: everything that is not finished, however old — these are the rows that get forgotten. Finished rows are in the Done table
            NOT ${DONE_SQL}`}
  `;

  // date range of the work table (open_from / open_to; NULL = everything): by the last thing that happened to the row, or its creation when nothing happened yet.
  // Needs the latest History row, so it runs only on the rows that passed every cheap filter above
  const openDateSql = `
        (@open_from IS NULL OR (
            COALESCE(${DONE_DATE_SQL}, rmm.created_at) >= @open_from
            AND COALESCE(${DONE_DATE_SQL}, rmm.created_at) < DATEADD(DAY, 1, @open_to)
        ) OR (
            -- a row that is on a trolley is always shown, whatever its date
            rmm.tro_id IS NOT NULL AND LTRIM(RTRIM(CAST(rmm.tro_id AS NVARCHAR(50)))) NOT IN (N'', N'0')
        ))`;

  // scope "open": the filter (cheap columns + the latest History row, for the date) and the TOP run first on their own; the heavy lookups
  // (emulsion text, Batch, Slot, PackTrolley, RawMat/Production joins) then run only for the rows that are left, not for every mapping ever made
  const openBase = `
  -- step 1: the cheap filters on TrolleyRMMapping alone (no join: RMForProd is joined in the final select, a join here was a seek per mapping ever made), into a small temp table (the optimizer used to run the History lookup for every mapping ever made)
  SELECT rmm.mapping_id, rmm.created_at, rmm.tro_id
  INTO #sheet_cand
  FROM TrolleyRMMapping rmm WITH (NOLOCK)
  ${whereSql}
  OPTION (MAX_GRANT_PERCENT = 3);
  -- step 2: the date filter (needs the latest History row) + TOP, only on the survivors
  WITH hbase AS (
    SELECT TOP (@mlimit) rmm.mapping_id, h.hist_id
    FROM #sheet_cand rmm
    OUTER APPLY (
        -- only the 5 dates DONE_DATE_SQL needs, so the History index can answer alone (no read of the wide History row)
        SELECT TOP 1 hh.hist_id, hh.sc_pack_date, hh.out_cold_date, hh.come_cold_date, hh.rmit_date, hh.cooked_date
        FROM History hh WITH (NOLOCK)
        WHERE hh.mapping_id = rmm.mapping_id
        ORDER BY hh.hist_id DESC
    ) h
    WHERE ${openDateSql}
    ORDER BY rmm.mapping_id DESC
  )`;

  return `${scope === "open" ? openBase : ""}
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
      rmm.detail AS qc_detail,
      qcs.color AS qc_color,
      qcs.odor AS qc_odor,
      qcs.texture AS qc_texture,
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
      p.prod_id,
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
      emx.emulsion_text,
      sl.slot_id,
      -- the room comes from Slot: table ColdStorage only lists the large rooms (cs_id 10-46), so the small rooms of /coldStorage (cs_id 1-8)
      -- got a NULL cs_id here and their rows never showed "อยู่ในห้องเย็น" (names of 1-8 = ROOM_NAMES of ColdStorage/.../flow/coldApi.js)
      sl.cs_id,
      COALESCE(cs.cs_name, CASE sl.cs_id WHEN 1 THEN N'CSR 3' WHEN 2 THEN N'Chill 2' WHEN 3 THEN N'Chill 4' WHEN 4 THEN N'Chill 5'
          WHEN 5 THEN N'Chill 6' WHEN 6 THEN N'4C' WHEN 7 THEN N'Ante' WHEN 8 THEN N'LargeRoom' END) AS cs_name,
      h.hist_id,
      ${HIST_DATES.map((c) => fmt("h", c)).join(",\n      ")},
      ${HIST_TEXT.map((c) => `h.${c}`).join(",\n      ")}
  ${scope === "open" ? `FROM hbase hb
  JOIN TrolleyRMMapping rmm WITH (NOLOCK) ON rmm.mapping_id = hb.mapping_id` : "FROM TrolleyRMMapping rmm WITH (NOLOCK)"}
  JOIN RMForProd rmf WITH (NOLOCK) ON rmf.rmfp_id = rmm.rmfp_id
  LEFT JOIN ProdRawMat pr WITH (NOLOCK) ON rmm.tro_production_id = pr.prod_rm_id
  LEFT JOIN RawMat rm WITH (NOLOCK) ON pr.mat = rm.mat
  LEFT JOIN Production p WITH (NOLOCK) ON pr.prod_id = p.prod_id
  LEFT JOIN RawMatGroup rmg WITH (NOLOCK) ON rmf.rm_group_id = rmg.rm_group_id
  LEFT JOIN Line l WITH (NOLOCK) ON rmm.rmm_line_name = l.line_name
  LEFT JOIN QC qcs WITH (NOLOCK) ON qcs.qc_id = rmm.qc_id
  OUTER APPLY (
      SELECT TOP 1 pt.line_tro
      FROM PackTrolley pt WITH (NOLOCK)
      WHERE pt.tro_id = rmm.tro_id AND pt.pack_tro_status = '0'
  ) ptl
  -- one slot per trolley: a trolley written in two Slot rows (e.g. after a move) used to make the same mapping appear twice
  OUTER APPLY (
      SELECT TOP 1 s2.slot_id, s2.cs_id
      FROM Slot s2 WITH (NOLOCK)
      WHERE s2.tro_id = rmm.tro_id AND rmm.tro_id IS NOT NULL
      ORDER BY s2.cs_id, s2.slot_id
  ) sl
  LEFT JOIN ColdStorage cs WITH (NOLOCK) ON cs.cs_id = sl.cs_id
  -- only the emulsions of THIS row's plan (a correlated lookup): the old derived table aggregated the whole RM_EmuMixed history on every request
  OUTER APPLY (
      SELECT STRING_AGG(CAST(CONCAT(rme.mat_name, N' (', rmfe.batch, N') ', CAST(rmfe.weight AS NVARCHAR(30)), N' kg') AS NVARCHAR(MAX)), N'; ') AS emulsion_text
      FROM RM_EmuMixed rmem WITH (NOLOCK)
      JOIN RMForEmu rmfe WITH (NOLOCK) ON rmem.rmfemu_id = rmfe.rmfemu_id
      JOIN RawMat rme WITH (NOLOCK) ON rmfe.mat = rme.mat
      WHERE rmem.rmfp_id = rmm.rmfp_id
  ) emx
  OUTER APPLY (
      SELECT STRING_AGG(bb.batch_after, ', ') AS batch_after
      FROM Batch bb WITH (NOLOCK) WHERE bb.mapping_id = rmm.mapping_id
  ) b
  ${scope === "open" ? `-- the wide History columns only for the rows that are left
  LEFT JOIN History h WITH (NOLOCK) ON h.hist_id = hb.hist_id` : `OUTER APPLY (
      -- only the columns the sheet shows (History is a very wide table: hh.* read every column of every row)
      SELECT TOP 1 hh.hist_id, ${[...HIST_DATES, ...HIST_TEXT].map((c) => `hh.${c}`).join(", ")}
      FROM History hh WITH (NOLOCK)
      WHERE hh.mapping_id = rmm.mapping_id
      ORDER BY hh.hist_id DESC
  ) h`}
  ${scope === "open" ? "" : whereSql}
  ORDER BY rmm.mapping_id DESC
  OPTION (USE HINT('DISABLE_OPTIMIZER_ROWGOAL'), MAX_GRANT_PERCENT = 3)
`;
};

// MAX_GRANT_PERCENT: ผลลัพธ์แต่ละ query มีไม่กี่ร้อยแถว แต่ SQL Server ประมาณแถวกว้าง (NVARCHAR(MAX) / History) แล้วขอ memory grant หลักร้อย MB ถึง 1.6 GB ต่อ query;
// หลายคนเปิดหน้า Sheet พร้อมกัน = คิว RESOURCE_SEMAPHORE ทั้ง server จึงจำกัดเพดาน (ถ้าไม่พอจะ spill ลง tempdb แค่ช้าลงเล็กน้อย)
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
  WHERE s.status = 1
    AND la.last_at >= COALESCE(@open_from, DATEADD(DAY, -@days, GETDATE()))
    AND (@open_to IS NULL OR la.last_at < DATEADD(DAY, 1, @open_to))
  ORDER BY la.last_at DESC, s.sap_re_id DESC
  OPTION (USE HINT('DISABLE_OPTIMIZER_ROWGOAL'), MAX_GRANT_PERCENT = 2)
`;

// Production-plan rows that were scanned ("สแกนป้าย SAP") but are not in a trolley yet: the same rows the old "จัดการวัตถุดิบ" page listed (all raw material types).
// Same field names as /prep/manage/fetchRMForProd, so the "จัดการ" menu of the sheet works on them.
// ค่ามาตรฐาน DBS1..DBS4 ของกลุ่มวัตถุดิบ (สูตรเดียวกับแถวรถเข็นใน buildMappingQuery) — ใช้ในแถวแผน / แถวผสม ให้ทุกสถานะเห็นค่ามาตรฐาน
const dbsStdSql = (a) => `
      FORMAT(${a}.prep_to_cold, 'N2') AS DBS1,
      FORMAT(${a}.cold, 'N2') AS DBS2,
      FORMAT(${a}.cold_to_pack, 'N2') AS DBS3,
      FORMAT(CASE WHEN ${a}.rm_group_id IN (55, 85, 49, 46, 82) THEN ${a}.prep_to_pack
                  ELSE ${a}.prep_to_cold + ${a}.cold_to_pack END, 'N2') AS DBS4`;

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
      rmg.cold,${dbsStdSql("rmg")},
      rmf.level_eu,
      rmf.remark,
      rmf.hu,
      -- the date columns of History are not always real dates (some databases hold text): TRY_CONVERT first, the raw text when it is not a date
      COALESCE(FORMAT(TRY_CONVERT(DATETIME, htr.cooked_date), 'dd/MM/yyyy HH:mm'), CAST(htr.cooked_date AS NVARCHAR(30))) AS CookedDateTime,
      CONVERT(VARCHAR(19), TRY_CONVERT(DATETIME, htr.cooked_date), 120) AS cooked_date,
      COALESCE(FORMAT(TRY_CONVERT(DATETIME, htr.withdraw_date), 'dd/MM/yyyy HH:mm'), CAST(htr.withdraw_date AS NVARCHAR(30))) AS withdraw_date
  FROM RMForProd rmf WITH (NOLOCK)
  JOIN ProdRawMat pr WITH (NOLOCK) ON rmf.prod_rm_id = pr.prod_rm_id
  JOIN RawMat rm WITH (NOLOCK) ON pr.mat = rm.mat
  JOIN Production p WITH (NOLOCK) ON pr.prod_id = p.prod_id
  JOIN RawMatGroup rmg WITH (NOLOCK) ON rmf.rm_group_id = rmg.rm_group_id
  JOIN History htr WITH (NOLOCK) ON rmf.hist_id_rmfp = htr.hist_id
  -- a scan ("สแกนป้าย SAP") saves stay_place = จุดเตรียมรับเข้า and the destination chosen at the scan (จุดเตรียม / หม้ออบ / เข้าห้องเย็น): all of them wait to be put in a trolley
  WHERE rmf.stay_place IN (N'จุดเตรียมรับเข้า', N'หม้ออบ')
    AND ISNULL(rmf.dest, N'') <> N'' AND rmf.dest COLLATE Thai_100_BIN2 NOT LIKE N'%ลบ%'
    -- same date range as the work table (open_from / open_to; NULL = everything)
    AND (@open_from IS NULL OR (
        COALESCE(TRY_CONVERT(DATETIME, htr.cooked_date), TRY_CONVERT(DATETIME, htr.withdraw_date)) >= @open_from
        AND COALESCE(TRY_CONVERT(DATETIME, htr.cooked_date), TRY_CONVERT(DATETIME, htr.withdraw_date)) < DATEADD(DAY, 1, @open_to)
    ))
  ORDER BY htr.cooked_date DESC
  OPTION (USE HINT('DISABLE_OPTIMIZER_ROWGOAL'), MAX_GRANT_PERCENT = 2)
`;

// Mixed lots (the old page "รายการผสมวัตถุดิบ"): production-plan rows that have emulsions mixed into them. Only the ones that are NOT in a trolley yet get a row of their own
// (once they are in a trolley they are mapping rows, which carry the emulsion text).
const buildMixedQuery = () => `
  -- step 1: the plan rows (TOP) — "has an emulsion" is an EXISTS, so the emulsion text is not built for every emulsion ever mixed
  -- (the old JOIN to the aggregate read + STRING_AGG-ed the whole RM_EmuMixed history on every load)
  WITH base AS (
    SELECT TOP (@limit)
        rmfp.rmfp_id,
        rmfp.batch,
        pdrm.mat,
        rm2.mat_name,
        rmfp.weight,
        CONCAT(pdt.doc_no, ' (', rmfp.rmfp_line_name, ')') AS production,
        rmfp.rmfp_line_name,
        rmfp.level_eu,
        CONVERT(VARCHAR(19), TRY_CONVERT(DATETIME, his.withdraw_date), 120) AS withdraw_date,
        CONVERT(VARCHAR(19), TRY_CONVERT(DATETIME, his.cooked_date), 120) AS cooked_date,${dbsStdSql("rmgx")}
    FROM RMForProd rmfp WITH (NOLOCK)
    JOIN ProdRawMat pdrm WITH (NOLOCK) ON rmfp.prod_rm_id = pdrm.prod_rm_id
    JOIN RawMat rm2 WITH (NOLOCK) ON pdrm.mat = rm2.mat
    JOIN Production pdt WITH (NOLOCK) ON pdrm.prod_id = pdt.prod_id
    LEFT JOIN History his WITH (NOLOCK) ON rmfp.hist_id_rmfp = his.hist_id
    LEFT JOIN RawMatGroup rmgx WITH (NOLOCK) ON rmfp.rm_group_id = rmgx.rm_group_id
    WHERE EXISTS (
            SELECT 1
            FROM RM_EmuMixed rmem WITH (NOLOCK)
            JOIN RMForEmu rmfe WITH (NOLOCK) ON rmem.rmfemu_id = rmfe.rmfemu_id
            JOIN RawMat rme WITH (NOLOCK) ON rmfe.mat = rme.mat
            WHERE rmem.rmfp_id = rmfp.rmfp_id
        )
      AND NOT EXISTS (SELECT 1 FROM TrolleyRMMapping m WITH (NOLOCK) WHERE m.rmfp_id = rmfp.rmfp_id)
      AND (@open_from IS NULL OR (
          COALESCE(TRY_CONVERT(DATETIME, his.cooked_date), TRY_CONVERT(DATETIME, his.withdraw_date)) >= @open_from
          AND COALESCE(TRY_CONVERT(DATETIME, his.cooked_date), TRY_CONVERT(DATETIME, his.withdraw_date)) < DATEADD(DAY, 1, @open_to)
      ))
    ORDER BY rmfp.rmfp_id DESC
  )
  -- step 2: the emulsion text only for the rows that are left
  SELECT b.rmfp_id, b.batch, b.mat, b.mat_name, b.weight, b.production, b.rmfp_line_name, b.level_eu, b.withdraw_date, b.cooked_date,
         b.DBS1, b.DBS2, b.DBS3, b.DBS4, emx.emulsion_text
  FROM base b
  OUTER APPLY (
      SELECT STRING_AGG(CAST(CONCAT(rme.mat_name, N' (', rmfe.batch, N') ', CAST(rmfe.weight AS NVARCHAR(30)), N' kg') AS NVARCHAR(MAX)), N'; ') AS emulsion_text
      FROM RM_EmuMixed rmem WITH (NOLOCK)
      JOIN RMForEmu rmfe WITH (NOLOCK) ON rmem.rmfemu_id = rmfe.rmfemu_id
      JOIN RawMat rme WITH (NOLOCK) ON rmfe.mat = rme.mat
      WHERE rmem.rmfp_id = b.rmfp_id
  ) emx
  ORDER BY b.rmfp_id DESC
  OPTION (USE HINT('DISABLE_OPTIMIZER_ROWGOAL'), MAX_GRANT_PERCENT = 2)
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

    // work-table date range (YYYY-MM-DD): open_from + open_to together, or none = everything that is still open
    const okDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
    const ranged = okDate(req.query.open_from) && okDate(req.query.open_to);
    if (ranged && req.query.open_from > req.query.open_to) {
      return res.status(400).json({ success: false, error: "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด" });
    }

    const bind = (request) => request
      .input("days", sql.Int, days)
      .input("limit", sql.Int, limit)
      .input("mlimit", sql.Int, mlimit)
      .input("open_from", sql.Date, ranged ? req.query.open_from : null)
      .input("open_to", sql.Date, ranged ? req.query.open_to : null);

    // เหมือนกัน + พร้อมกัน = query ชุดเดียว (ดู lib/sheetCache.js); rev = ลายเซ็นของข้อมูล ให้หน้าเว็บเทียบได้โดยไม่ต้องรับ/แปลงข้อมูลทั้งก้อนซ้ำ
    const cacheKey = JSON.stringify([days, limit, mlimit, ranged ? req.query.open_from : null, ranged ? req.query.open_to : null]);
    // ข้อมูลต้อง "เริ่มอ่านหลัง" เวลานี้ (ใช้ชุดเดียวกันได้ทุกคำขอ / ทุก worker — lib/sheetCache.js):
    //   ?fresh=1 (หน้าเว็บเพิ่งบันทึกเอง) = หลังคำขอนี้มาถึง · ?since=<at ของ event sheetChanged (เวลา server)> = หลังการบันทึกที่ทำให้เกิด event
    const now = Date.now();
    const since = Math.min(parseInt(req.query.since, 10) || 0, now);
    const minStart = req.query.fresh ? now : since;
    const payload = await cached(cacheKey, async () => {
      const sink = [];
      const [mappings, hus, plans, mixed] = await Promise.all([
        timed("mappings", () => bind(pool.request()).query(buildMappingQuery("open")), sink),
        timed("hus", () => bind(pool.request()).query(buildHuQuery()), sink),
        timed("plans", () => bind(pool.request()).query(buildPlanQuery()), sink).catch((err) => { console.error(`[Route /sheet/rows] plans error: ${err.message} (line ${err.lineNumber ?? "-"})`); return { recordset: [] }; }),
        timed("mixed", () => bind(pool.request()).query(buildMixedQuery()), sink).catch((err) => { console.error(`[Route /sheet/rows] mixed error: ${err.message} (line ${err.lineNumber ?? "-"})`); return { recordset: [] }; }),
      ]);
      const rev = crypto.createHash("md5").update(JSON.stringify([mappings.recordset, hus.recordset, plans.recordset, mixed.recordset])).digest("hex");
      // แปลงเป็น JSON ครั้งเดียวต่อรอบ cache — ทุกคำขอที่ได้ชุดเดียวกันส่งข้อความเดิมออกไปเลย
      const json = JSON.stringify({ success: true, rev, mappings: mappings.recordset, hus: hus.recordset, plans: plans.recordset, mixed: mixed.recordset, days, limit, open_from: ranged ? req.query.open_from : null, open_to: ranged ? req.query.open_to : null });
      return { rev, json, timing: sink.join(", ") };
    });
    // DevTools → Network → rows?... → Timing → "Server timing": เวลาของแต่ละ query (ms) ของรอบที่โหลดจริง
    if (payload.timing) res.set("Server-Timing", payload.timing);

    // หน้าเว็บส่ง ?rev= ของข้อมูลที่ถืออยู่ ถ้าตรงกัน = ไม่ส่งข้อมูลซ้ำ
    if (req.query.rev && req.query.rev === payload.rev) {
      return res.json({ success: true, unchanged: true, rev: payload.rev });
    }
    res.type("application/json").send(payload.json);
  } catch (err) {
    console.error(`[Route /sheet/rows] Error: ${err.message} (SQL error ${err.number ?? "-"}, line ${err.lineNumber ?? "-"})`, err.precedingErrors?.map((e) => e.message) || "");
    res.status(500).json({ success: false, error: err.message });
  }
});

// Done table: finished rows are NOT loaded with the work table. The user picks the date range (+ optional text) first, then the rows are read from the database.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
router.get("/sheet/done", async (req, res) => {
  try {
    const ymd = (d) => d.toISOString().slice(0, 10);
    const q = String(req.query.q || "").trim().slice(0, 100);
    // no text: the chosen date range (default: the last 7 days). A text search ignores the dates and looks in all finished rows
    const hasDates = DATE_RE.test(req.query.date_from || "") && DATE_RE.test(req.query.date_to || "");
    const dateTo = hasDates ? req.query.date_to : ymd(new Date());
    const dateFrom = hasDates ? req.query.date_from : ymd(new Date(Date.now() - 7 * 86400000));
    if (dateFrom > dateTo) {
      return res.status(400).json({ success: false, error: "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด" });
    }
    const useDates = !q;
    const mlimit = Math.min(Math.max(parseInt(req.query.limit, 10) || 2000, 100), 20000);

    const pool = await connectToDatabase();
    if (!pool) {
      return res.status(503).json({ success: false, error: "Database unavailable" });
    }
    const result = await timed("done", () => pool.request()
      .input("mlimit", sql.Int, mlimit)
      .input("date_from", sql.Date, useDates ? dateFrom : null)
      .input("date_to", sql.Date, useDates ? dateTo : null)
      .input("q", sql.NVarChar(100), q)
      .input("q_like", sql.NVarChar(110), `%${q.replace(/[\[%_]/g, (c) => `[${c}]`)}%`)
      .query(buildMappingQuery("done", { dated: useDates })));

    res.json({ success: true, mappings: result.recordset, limit: mlimit, capped: result.recordset.length >= mlimit, date_from: useDates ? dateFrom : null, date_to: useDates ? dateTo : null, searched_all_dates: !useDates });
  } catch (err) {
    console.error("[Route /sheet/done] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── one mapping by its id (page "ค้นหา mapping_id": detail + fixing a wrong entry) ─────────────────────────────
// Same row as the table (buildMappingQuery) but with NO filter: a row that the tables hide (deleted, weight 0, finished ...) can still be looked up and fixed.
//   GET /sheet/mapping?mapping_id=  → { mapping, hu (SAP row of its HU or null), edit_log }
router.get("/sheet/mapping", async (req, res) => {
  try {
    const id = parseInt(req.query.mapping_id, 10);
    if (Number.isNaN(id) || id <= 0) return res.status(400).json({ success: false, error: "กรุณาระบุ mapping_id เป็นตัวเลข" });
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    const r = await pool.request().input("mlimit", sql.Int, 1).input("one_id", sql.Int, id).query(buildMappingQuery("one"));
    const mapping = r.recordset[0] || null;
    if (!mapping) return res.status(404).json({ success: false, error: `ไม่พบ mapping_id ${id}` });
    let huValue = mapping.hu;
    if (huValue === undefined || huValue === null || huValue === "") {
      const hr = await pool.request().input("rmfp", sql.Int, mapping.rmfp_id ?? 0).query("SELECT TOP 1 hu FROM RMForProd WITH (NOLOCK) WHERE rmfp_id = @rmfp");
      huValue = hr.recordset[0]?.hu ?? null;
      if (huValue !== null) mapping.hu = huValue;
    }
    let hu = null;
    if (huValue !== null && huValue !== undefined && String(huValue).trim() !== "") {
      const sr = await pool.request().input("hu", sql.NVarChar(50), String(huValue).trim()).query(`
        SELECT TOP 1 s.sap_re_id, s.batch, s.mat, rm.mat_name, s.hu, s.before_hu, s.weight, s.remark, s.cs_re, s.cs_re_2, s.cs_re_3,
               ${SAP_DATES.map((c) => fmt("s", c)).join(",\n               ")}
        FROM SAP_Receive s WITH (NOLOCK) LEFT JOIN RawMat rm WITH (NOLOCK) ON rm.mat = s.mat
        WHERE CAST(s.hu AS NVARCHAR(50)) = @hu ORDER BY s.sap_re_id DESC`);
      hu = sr.recordset[0] || null;
    }
    res.json({ success: true, mapping, hu, editable_dates: HIST_DATES }); // the time columns that PATCH /sheet/edit accepts
  } catch (err) {
    console.error("❌ [Route GET /sheet/mapping] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sheet/lineage?mapping_id= : which new mapping_ids this one became / came from (page "ค้นหา mapping_id"); works for a mapping that is gone too
// (กลับมาเตรียม deletes the old mapping: its link to the new one is kept in MappingLineage)
router.get("/sheet/lineage", async (req, res) => {
  try {
    const id = parseInt(req.query.mapping_id, 10);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) return res.status(400).json({ success: false, error: "กรุณาระบุ mapping_id เป็นตัวเลข" });
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    const data = await lineageOf(pool, id);
    const { errors, ...rest } = data;
    res.json({ success: true, data: rest, errors });
  } catch (err) {
    console.error("❌ [Route GET /sheet/lineage] Error:", err);
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

// ── ค่าตั้งที่ต้องปลดล็อกด้วยรหัสรายวันของหน้า Setting (แท็บสีแถว / พื้นที่สถานะ / ผู้ดูแลไลน์) ──
// เดิมล็อกที่หน้าเว็บอย่างเดียว ใครยิง API ตรงก็แก้ได้ ตอนนี้ server เทียบค่าเดิมกับค่าใหม่ และต้องมี header x-setting-unlock (ได้จาก POST /api/sheet/setting-unlock)
const PROTECTED_EXT_DEFAULTS = { colorMode: "stage", greenPct: 50, yellowPct: 0, statusZones: {}, statusAreas: [], lineGroups: [] };
const sortKeys = (_k, val) => (val && typeof val === "object" && !Array.isArray(val)
  ? Object.keys(val).sort().reduce((o, kk) => { o[kk] = val[kk]; return o; }, {})
  : val);
const protectedPart = (cfg) => {
  const ext = (cfg && cfg.ext) || {};
  const out = {};
  Object.keys(PROTECTED_EXT_DEFAULTS).forEach((k) => { out[k] = ext[k] === undefined ? PROTECTED_EXT_DEFAULTS[k] : ext[k]; });
  return JSON.stringify(out, sortKeys);
};
const hasSettingUnlock = (req, userId) => {
  const t = req.headers["x-setting-unlock"];
  if (typeof t !== "string") return false;
  const v = verifyToken(t);
  return v.ok && v.payload.typ === "setting" && v.payload.user_id === userId;
};

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

    const authMode = getAuthMode();
    if (authMode !== "off") {
      const stored = await withPrefsTable(pool, () => pool.request()
        .input("user_id", sql.Int, key.userId)
        .input("sheet_key", sql.NVarChar(50), key.sheetKey)
        .query("SELECT config FROM SheetUserPrefs WHERE user_id = @user_id AND sheet_key = @sheet_key"));
      let oldCfg = null;
      try { oldCfg = stored.recordset[0]?.config ? JSON.parse(stored.recordset[0].config) : null; } catch { oldCfg = null; }
      if (protectedPart(oldCfg) !== protectedPart(JSON.parse(config)) && !hasSettingUnlock(req, key.userId)) {
        metrics.inc("setting_locked_total", { mode: authMode });
        logger.warn("setting_locked", { id: req.id, user_id: key.userId, sheet_key: key.sheetKey, mode: authMode, by: req.user ? req.user.user_id : null });
        if (authMode === "enforce") {
          return res.status(403).json({ success: false, code: "SETTING_LOCKED", error: "ต้องใส่รหัสปลดล็อกของหน้า Setting ก่อนจึงบันทึกการตั้งค่านี้ได้" });
        }
      }
    }

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

// ── ค่าตั้งกลางของหน้า Sheet ที่ทุกบัญชีใช้ร่วมกัน (ตอนนี้: ลำดับสถานะบนแถบเหนือตาราง) ──
// เก็บในตาราง SheetUserPrefs แถว user_id = 0, sheet_key = 'global' (ไม่ต้องสร้างตารางใหม่)
// อ่านได้ทุกคน · บันทึกได้เมื่อใส่รหัสตรงกับ SHEET_GLOBAL_SETTING_PASSWORD ใน .env ของ backend (server ตรวจ ไม่ใช่หน้าเว็บ)
const GLOBAL_USER_ID = 0;
const GLOBAL_SHEET_KEY = "global";
const STATUS_ORDER_MAX = 80;
const STATUS_LABEL_MAX = 100;

const samePassword = (given, expected) => {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const readGlobalSettings = async (pool) => {
  const result = await withPrefsTable(pool, () => pool.request()
    .input("user_id", sql.Int, GLOBAL_USER_ID)
    .input("sheet_key", sql.NVarChar(50), GLOBAL_SHEET_KEY)
    .query("SELECT config FROM SheetUserPrefs WHERE user_id = @user_id AND sheet_key = @sheet_key"));
  const raw = result.recordset[0]?.config;
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch (err) {
    console.error("[Sheet] global settings JSON error:", err.message);
    return {};
  }
};

router.get("/sheet/global-settings", async (req, res) => {
  try {
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    res.json({ success: true, data: await readGlobalSettings(pool) });
  } catch (err) {
    console.error("[Route GET /sheet/global-settings] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/sheet/global-settings", async (req, res) => {
  const { password, statusOrder, statusLabels, statusStyles, rowColors } = req.body || {};
  const expected = process.env.SHEET_GLOBAL_SETTING_PASSWORD;
  if (!expected) {
    return res.status(503).json({ success: false, error: "ยังไม่ได้ตั้งรหัส SHEET_GLOBAL_SETTING_PASSWORD ใน .env ของ backend" });
  }
  if (typeof password !== "string" || !samePassword(password, expected)) {
    logger.warn("global_setting_bad_password", { id: req.id, by: req.user ? req.user.user_id : null });
    return res.status(401).json({ success: false, error: "รหัสผ่านไม่ถูกต้อง" });
  }
  // each part is optional: only what is sent is replaced
  const okText = (v) => typeof v === "string" && v.trim().length > 0 && v.length <= STATUS_LABEL_MAX;
  const okColor = (v) => v === undefined || v === null || v === "" || /^#[0-9a-fA-F]{6}$/.test(v);
  const isMap = (o) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length <= STATUS_ORDER_MAX;
  if (statusOrder === undefined && statusLabels === undefined && statusStyles === undefined && rowColors === undefined) {
    return res.status(400).json({ success: false, error: "ไม่มีค่าที่จะบันทึก" });
  }
  if (statusOrder !== undefined && !(Array.isArray(statusOrder) && statusOrder.length <= STATUS_ORDER_MAX && statusOrder.every(okText))) {
    return res.status(400).json({ success: false, error: "ลำดับสถานะไม่ถูกต้อง" });
  }
  // statusLabels: { ชื่อเดิม: ชื่อที่แสดง }
  if (statusLabels !== undefined && !(isMap(statusLabels) && Object.entries(statusLabels).every(([k, v]) => okText(k) && okText(v)))) {
    return res.status(400).json({ success: false, error: "ชื่อสถานะไม่ถูกต้อง" });
  }
  // statusStyles: { ชื่อเดิม: { bg, fg, onBg, onFg } } สี #RRGGBB (ว่าง = สีเดิม)
  if (statusStyles !== undefined && !(isMap(statusStyles) && Object.entries(statusStyles).every(([k, v]) => okText(k) && v && typeof v === "object"
    && ["bg", "fg", "onBg", "onFg"].every((f) => okColor(v[f])) && Object.keys(v).every((f) => ["bg", "fg", "onBg", "onFg"].includes(f))))) {
    return res.status(400).json({ success: false, error: "สีสถานะไม่ถูกต้อง" });
  }
  // rowColors: { green|yellow|red|blue: { bg, fg } } สีแถวตามระดับ delay (ว่าง = สีเดิม)
  const ROW_LEVELS = ["green", "yellow", "red", "blue"];
  if (rowColors !== undefined && !(isMap(rowColors) && Object.entries(rowColors).every(([k, v]) => ROW_LEVELS.includes(k) && v && typeof v === "object"
    && ["bg", "fg"].every((f) => okColor(v[f])) && Object.keys(v).every((f) => ["bg", "fg"].includes(f))))) {
    return res.status(400).json({ success: false, error: "สีแถวไม่ถูกต้อง" });
  }
  try {
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    const next = { ...(await readGlobalSettings(pool)) };
    if (statusOrder !== undefined) next.statusOrder = [...new Set(statusOrder)];
    if (statusLabels !== undefined) next.statusLabels = Object.fromEntries(Object.entries(statusLabels).map(([k, v]) => [k, v.trim()]));
    if (statusStyles !== undefined) next.statusStyles = statusStyles;
    if (rowColors !== undefined) next.rowColors = rowColors;
    await withPrefsTable(pool, () => pool.request()
      .input("user_id", sql.Int, GLOBAL_USER_ID)
      .input("sheet_key", sql.NVarChar(50), GLOBAL_SHEET_KEY)
      .input("config", sql.NVarChar(sql.MAX), JSON.stringify(next))
      .query(`
        UPDATE SheetUserPrefs SET config = @config, updated_at = GETDATE()
        WHERE user_id = @user_id AND sheet_key = @sheet_key;
        IF @@ROWCOUNT = 0
          INSERT INTO SheetUserPrefs (user_id, sheet_key, config) VALUES (@user_id, @sheet_key, @config);
      `));
    logger.info("global_setting_saved", { id: req.id, by: req.user ? req.user.user_id : null, keys: ["statusOrder", "statusLabels", "statusStyles", "rowColors"].filter((k) => req.body[k] !== undefined) });
    res.json({ success: true, message: "บันทึกการตั้งค่าสำเร็จ", data: next });
  } catch (err) {
    console.error("[Route PUT /sheet/global-settings] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Supervisor edit of a table row (in-process / done) ────────────────────
// Only role 6 / 8 (rule in lib/authMiddleware.js). Every column that may be edited is listed here — the column name never comes from the request,
// only from this list, so it can be put in the statement; the value is always a parameter. One request = one mapping, all changes in one transaction.
// The client sends the value it saw (expected): when somebody changed it meanwhile the whole request is refused (409) so nobody overwrites a newer value.
const EDIT_MAP = {
  dest: { t: "map", sql: () => sql.NVarChar(100) },
  stay_place: { t: "map", sql: () => sql.NVarChar(100) },
  // the status of a row is made of rm_status + stay_place + dest (+ trolley): page "ค้นหา mapping_id" fixes a wrong entry by setting them
  rm_status: { t: "map", sql: () => sql.NVarChar(100) },
  rm_cold_status: { t: "map", sql: () => sql.NVarChar(100) },
  tro_id: { t: "map", sql: () => sql.VarChar(4), max: 4 },
  mix_code: { t: "map", sql: () => sql.NVarChar(100) },
  rmm_line_name: { t: "map", sql: () => sql.NVarChar(100) },
  tray_count: { t: "map", kind: "int" },
  weight_RM: { t: "map", kind: "num" },
  // not columns of TrolleyRMMapping: batch = Batch.batch_after · mat / prod_id = the ProdRawMat row the mapping points at (tro_production_id)
  batch: { t: "virt", kind: "batch" },
  mat: { t: "virt", kind: "mat", max: 50 },
  prod_id: { t: "virt", kind: "prod" },
};
HIST_DATES.forEach((c) => { EDIT_MAP[c] = { t: "hist", kind: "date" }; });
HIST_TEXT.forEach((c) => { EDIT_MAP[c] = { t: "hist", sql: () => sql.NVarChar(500) }; });
// TrolleyRMMapping columns that History also holds (and the history-page slips print from History): an edit is written to both
const HIST_MIRROR = ["weight_RM", "tray_count", "tro_id", "rmm_line_name", "dest"];
const EDIT_TEXT_MAX = 500;
const EDIT_BATCH_MAX = 60;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;

let editLogChecked = false;
const ensureEditLogTable = async (pool) => {
  if (editLogChecked) return;
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.SheetEditLog', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.SheetEditLog (
            edit_id      BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SheetEditLog PRIMARY KEY,
            mapping_id   INT           NOT NULL,
            hist_id      INT           NULL,
            table_name   NVARCHAR(40)  NOT NULL,
            column_name  NVARCHAR(60)  NOT NULL,
            old_value    NVARCHAR(600) NULL,
            new_value    NVARCHAR(600) NULL,
            reason       NVARCHAR(300) NULL,
            user_id      INT           NULL,
            username     NVARCHAR(100) NULL,
            edited_at    DATETIME      NOT NULL CONSTRAINT DF_SheetEditLog_at DEFAULT (GETDATE())
        );
        CREATE INDEX IX_SheetEditLog_mapping ON dbo.SheetEditLog (mapping_id, edit_id DESC);
    END
  `);
  editLogChecked = true;
};

// History date columns are datetime in most databases but text in some (see buildPlanQuery): look at the real type once and write the matching form
const histTypeCache = new Map();
const histColumnType = async (pool, col) => {
  if (histTypeCache.has(col)) return histTypeCache.get(col);
  const r = await pool.request().input("c", sql.NVarChar(128), col)
    .query("SELECT DATA_TYPE AS dt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = N'History' AND COLUMN_NAME = @c");
  const dt = r.recordset[0] ? String(r.recordset[0].dt).toLowerCase() : null;
  histTypeCache.set(col, dt);
  return dt;
};
const isDateType = (dt) => ["datetime", "datetime2", "smalldatetime", "date"].includes(dt);

/** body: { mapping_id, changes: { column: newValue|null }, expected: { column: valueSeenByTheClient|null }, reason }
 *  opts.only = the columns this route may change (default: every column of EDIT_MAP) · opts.coldOnly = only a mapping whose trolley is in a cold room slot
 *  opts.packOnly = only a mapping that is not packed yet (status "รอบรรจุเสร็จ" of the Pack Sheet)
 *  opts.defaultReason = the reason written to SheetEditLog when none is typed */
const sheetEditHandler = (opts = {}) => async (req, res) => {
  try {
    const body = req.body || {};
    const mappingId = parseInt(body.mapping_id, 10);
    const changes = body.changes && typeof body.changes === "object" && !Array.isArray(body.changes) ? body.changes : null;
    const expected = body.expected && typeof body.expected === "object" ? body.expected : {};
    const reason = String(body.reason || "").trim().slice(0, 300);
    if (Number.isNaN(mappingId) || mappingId <= 0 || !changes) {
      return res.status(400).json({ success: false, error: "ข้อมูลไม่ครบ (mapping_id / changes)" });
    }
    const cols = Object.keys(changes);
    if (!cols.length || cols.length > EDIT_BATCH_MAX) {
      return res.status(400).json({ success: false, error: `แก้ไขได้ครั้งละ 1-${EDIT_BATCH_MAX} ช่อง` });
    }
    const bad = cols.find((c) => !Object.prototype.hasOwnProperty.call(EDIT_MAP, c) || (opts.only && !opts.only.includes(c)));
    if (bad) return res.status(400).json({ success: false, error: `ไม่อนุญาตให้แก้ไขคอลัมน์ ${bad}` });

    // validate + normalise every value before touching the database
    const todo = [];
    for (const c of cols) {
      const def = EDIT_MAP[c];
      let v = changes[c];
      if (v === undefined) continue;
      if (v === "" || v === null) v = null;
      else if (def.kind === "date") {
        v = String(v).trim().replace("T", " ");
        if (!DATETIME_RE.test(v)) return res.status(400).json({ success: false, error: `วันที่ของ ${c} ต้องเป็นรูป yyyy-MM-dd HH:mm` });
        if (v.length === 16) v += ":00";
        if (Number.isNaN(new Date(v.replace(" ", "T")).getTime())) return res.status(400).json({ success: false, error: `วันที่ของ ${c} ไม่ถูกต้อง` });
      } else if (def.kind === "prod") {
        const n = Number(v);
        if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ success: false, error: "แผนผลิตไม่ถูกต้อง" });
        v = n;
      } else if (def.kind === "int") {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 100000) return res.status(400).json({ success: false, error: `${c} ต้องเป็นจำนวนเต็ม 0-100000` });
        v = n;
      } else if (def.kind === "num") {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > 10000000) return res.status(400).json({ success: false, error: `${c} ต้องเป็นตัวเลข 0-10,000,000` });
        if (!/^\d+(\.\d{1,2})?$/.test(String(v).trim())) return res.status(400).json({ success: false, error: `${c} ต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง` });
        v = n;
      } else if (def.kind === "batch") {
        // Batch: 10 ตัวอักษร (A-Z / 0-9) ต่อ 1 Batch · หลาย Batch คั่นด้วย ,
        v = v === null ? null : String(v).trim().toUpperCase();
        if (v) {
          const parts = v.split(",").map((x) => x.trim()).filter(Boolean);
          const bad = parts.find((x) => !/^[A-Z0-9]{10}$/.test(x));
          if (bad) return res.status(400).json({ success: false, error: `Batch "${bad}" ต้องเป็นตัวอักษร/ตัวเลข 10 หลัก` });
          v = parts.join(",");
        } else v = null;
      } else {
        v = String(v).trim();
        if (v.length > (def.max || EDIT_TEXT_MAX)) return res.status(400).json({ success: false, error: `${c} ยาวเกิน ${def.max || EDIT_TEXT_MAX} ตัวอักษร` });
        if (v === "") v = null;
      }
      const clearTro = c === "tro_id" && body.allow_clear_tro === true; // only the page "ค้นหา mapping_id" asks for it (take the row off its trolley)
      if (v === null && !clearTro && (def.kind === "mat" || def.kind === "prod" || c === "rmm_line_name" || c === "tro_id")) {
        return res.status(400).json({ success: false, error: `${c} ต้องเลือกค่า (ล้างค่าไม่ได้)` });
      }
      todo.push({ col: c, def, value: v });
    }
    if (!todo.length) return res.status(400).json({ success: false, error: "ไม่มีค่าที่จะแก้ไข" });

    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    try { await ensureEditLogTable(pool); } catch (err) {
      console.error("❌ [Sheet] สร้างตาราง SheetEditLog ไม่สำเร็จ (ให้ DBA รัน migrations/create_SheetEditLog.sql):", err.message);
      return res.status(503).json({ success: false, code: "EDIT_LOG_TABLE_MISSING", error: "ยังไม่มีตาราง SheetEditLog สำหรับบันทึกประวัติการแก้ไข" });
    }

    // the column types of History (before the transaction, they do not change)
    const histTypes = {};
    for (const it of todo.filter((x) => x.def.t === "hist")) histTypes[it.col] = await histColumnType(pool, it.col);
    const missingCol = todo.find((x) => x.def.t === "hist" && !histTypes[x.col]);
    if (missingCol) return res.status(400).json({ success: false, error: `ฐานข้อมูลนี้ไม่มีคอลัมน์ ${missingCol.col} ใน History` });

    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const cur = await new sql.Request(tx).input("id", sql.Int, mappingId).query(`
        SELECT rmm.mapping_id, rmm.dest, rmm.stay_place, rmm.tro_id, rmm.mix_code, rmm.rmm_line_name, rmm.tray_count, rmm.weight_RM,
               pr.prod_id, pr.mat,
               COALESCE(NULLIF(bx.batch_after, N''), NULLIF(CAST(rmm.production_batch AS NVARCHAR(200)), N''), NULLIF(CAST(rmf.batch AS NVARCHAR(200)), N'')) AS batch
        FROM TrolleyRMMapping rmm WITH (UPDLOCK, ROWLOCK)
        LEFT JOIN ProdRawMat pr WITH (NOLOCK) ON pr.prod_rm_id = rmm.tro_production_id
        LEFT JOIN RMForProd rmf WITH (NOLOCK) ON rmf.rmfp_id = rmm.rmfp_id
        OUTER APPLY (SELECT STRING_AGG(bb.batch_after, ', ') AS batch_after FROM Batch bb WITH (NOLOCK) WHERE bb.mapping_id = rmm.mapping_id) bx
        WHERE rmm.mapping_id = @id`);
      if (!cur.recordset.length) { await safeRollback(tx); return res.status(404).json({ success: false, error: "ไม่พบรายการนี้" }); }
      const mapRow = cur.recordset[0];
      if (opts.coldOnly) {
        // only while the material is in a cold room: its trolley is in a slot (status "อยู่ในห้องเย็น" / "อยู่ในห้องเย็นใหญ่" of the Sheet)
        const inSlot = mapRow.tro_id && (await new sql.Request(tx).input("t", sql.VarChar(4), String(mapRow.tro_id))
          .query("SELECT TOP 1 1 AS ok FROM Slot WITH (NOLOCK) WHERE tro_id = @t")).recordset.length > 0;
        if (!inSlot) { await safeRollback(tx); return res.status(400).json({ success: false, error: "แก้ได้เฉพาะรายการที่อยู่ในห้องเย็น (รถเข็นอยู่ในช่องของห้องเย็น)" }); }
      }
      if (opts.packOnly) {
        const packed = (await new sql.Request(tx).input("id", sql.Int, mappingId).query(`
          SELECT TOP 1 1 AS packed
          FROM TrolleyRMMapping rmm WITH (NOLOCK)
          LEFT JOIN History h WITH (NOLOCK) ON h.mapping_id = rmm.mapping_id
          WHERE rmm.mapping_id = @id
            AND (rmm.dest LIKE N'บรรจุเสร็จ%' OR rmm.rm_status = N'สำเร็จ' OR NULLIF(LTRIM(CONVERT(NVARCHAR(50), h.sc_pack_date)), N'') IS NOT NULL)`)).recordset.length > 0;
        if (packed) { await safeRollback(tx); return res.status(400).json({ success: false, error: "รายการนี้บรรจุเสร็จแล้ว แก้น้ำหนักไม่ได้" }); }
      }

      let histId = null;
      let histRow = null;
      if (todo.some((x) => x.def.t === "hist")) {
        const histCols = todo.filter((x) => x.def.t === "hist").map((x) => `CONVERT(NVARCHAR(600), hh.[${x.col}], ${isDateType(histTypes[x.col]) ? 120 : 0}) AS [${x.col}]`);
        const hr = await new sql.Request(tx).input("id", sql.Int, mappingId).query(`
          SELECT TOP 1 hh.hist_id, ${histCols.join(", ")}
          FROM History hh WITH (UPDLOCK, ROWLOCK) WHERE hh.mapping_id = @id ORDER BY hh.hist_id DESC`);
        if (!hr.recordset.length) { await safeRollback(tx); return res.status(404).json({ success: false, error: "รายการนี้ยังไม่มีแถว History (แก้ไขเวลาไม่ได้)" }); }
        histRow = hr.recordset[0];
        histId = histRow.hist_id;
      }

      const same = (a, b) => {
        const x = a === null || a === undefined || a === "" ? null : String(a).replace("T", " ").trim();
        const y = b === null || b === undefined || b === "" ? null : String(b).replace("T", " ").trim();
        if (x === null || y === null) return x === y;
        if (x === y) return true;
        const nx = Number(x); const ny = Number(y);
        return !Number.isNaN(nx) && !Number.isNaN(ny) && nx === ny;
      };

      const conflicts = [];
      const applied = [];
      for (const it of todo) {
        const oldVal = it.def.t === "hist" ? histRow[it.col] : mapRow[it.col];
        if (Object.prototype.hasOwnProperty.call(expected, it.col) && !same(expected[it.col], oldVal)) {
          conflicts.push({ column: it.col, current: oldVal ?? null });
          continue;
        }
        if (same(oldVal, it.value)) continue; // nothing changes
        applied.push({ ...it, oldVal });
      }
      if (conflicts.length) {
        await safeRollback(tx);
        return res.status(409).json({ success: false, code: "EDIT_CONFLICT", error: "มีคนอื่นแก้ไขข้อมูลนี้ไปก่อนแล้ว กรุณารีเฟรชแล้วแก้ใหม่", conflicts });
      }
      if (!applied.length) { await safeRollback(tx); return res.json({ success: true, changed: 0, message: "ไม่มีการเปลี่ยนแปลง" }); }

      const mapSets = applied.filter((x) => x.def.t === "map");
      if (mapSets.length) {
        const r = new sql.Request(tx).input("id", sql.Int, mappingId);
        const sets = mapSets.map((x, i) => {
          const name = `m${i}`;
          if (x.def.kind === "int") r.input(name, sql.Int, x.value);
          else if (x.def.kind === "num") r.input(name, sql.Float, x.value);
          else r.input(name, x.def.sql(), x.value);
          return `[${x.col}] = @${name}`;
        });
        await r.query(`UPDATE TrolleyRMMapping SET ${sets.join(", ")} WHERE mapping_id = @id`);
      }
      const extraLog = [];
      // the slips of the history pages (ประวัติห้องเย็น /coldStorage/HisInput, ประวัติการตรวจ QC /qualitycontrol/HisCheck) read these values from History:
      // write the edited value to the latest History row too, so a slip printed again after the edit shows it (e.g. a vendor lot that had to be corrected).
      // A cleared trolley (row taken off its trolley) is not copied: History keeps the trolley it was on.
      const mirror = mapSets.filter((x) => HIST_MIRROR.includes(x.col) && x.value !== null);
      const mirrorTypes = {};
      for (const x of mirror) mirrorTypes[x.col] = await histColumnType(pool, x.col);
      const mirrorCols = mirror.filter((x) => mirrorTypes[x.col]);
      if (mirrorCols.length) {
        const r = new sql.Request(tx).input("id", sql.Int, mappingId);
        const sets = mirrorCols.map((x, i) => {
          const name = `hm${i}`;
          if (x.def.kind === "int") r.input(name, sql.Int, x.value);
          else if (x.def.kind === "num") r.input(name, sql.Float, x.value);
          else r.input(name, x.def.sql(), x.value);
          return `[${x.col}] = @${name}`;
        });
        const hu = await r.query(`
          UPDATE History SET ${sets.join(", ")}
          WHERE hist_id = (SELECT TOP 1 hh.hist_id FROM History hh WITH (UPDLOCK) WHERE hh.mapping_id = @id ORDER BY hh.hist_id DESC)`);
        if (hu.rowsAffected[0] > 0) mirrorCols.forEach((x) => extraLog.push({ tn: "History", cn: x.col, ov: x.oldVal === null || x.oldVal === undefined ? null : String(x.oldVal), nv: String(x.value) }));
      }
      // the row left its trolley (tro_id cleared) and body.release_trolley: when nothing else is on that trolley, the trolley is free again
      // (same clean-up as moving the last material out of a trolley in the cold room: Slot emptied, Trolley.tro_status = 1)
      const clearedTro = applied.find((x) => x.col === "tro_id" && x.value === null && x.oldVal);
      if (clearedTro && body.release_trolley === true) {
        const oldTro = String(clearedTro.oldVal);
        const left = await new sql.Request(tx).input("t", sql.VarChar(4), oldTro).input("id", sql.Int, mappingId)
          .query("SELECT COUNT(*) AS n FROM TrolleyRMMapping WITH (UPDLOCK) WHERE tro_id = @t AND mapping_id <> @id");
        if (left.recordset[0].n === 0) {
          await new sql.Request(tx).input("t", sql.VarChar(4), oldTro).query("UPDATE Slot SET tro_id = NULL WHERE tro_id = @t");
          await new sql.Request(tx).input("t", sql.VarChar(4), oldTro).query("UPDATE Trolley SET tro_status = '1' WHERE tro_id = @t");
          extraLog.push({ tn: "Trolley", cn: "tro_status", ov: "ใช้งาน", nv: `1 (ว่าง · รถเข็น ${oldTro})` });
        }
      }
      // values that must exist in their master table (the page offers them as a dropdown; the server refuses anything else)
      const exists = async (query, name, type, val) => (await new sql.Request(tx).input(name, type, val).query(query)).recordset.length > 0;
      for (const x of applied) {
        if (x.col === "rmm_line_name" && !(await exists("SELECT TOP 1 1 AS ok FROM Line WITH (NOLOCK) WHERE line_name = @v", "v", sql.NVarChar(100), x.value))) {
          await safeRollback(tx); return res.status(400).json({ success: false, error: `ไม่พบไลน์ "${x.value}" ในระบบ กรุณาเลือกจากรายการ` });
        }
        if (x.col === "tro_id" && x.value !== null && !(await exists("SELECT TOP 1 1 AS ok FROM Trolley WITH (NOLOCK) WHERE tro_id = @v", "v", sql.VarChar(4), x.value))) {
          await safeRollback(tx); return res.status(400).json({ success: false, error: `ไม่พบรถเข็น "${x.value}" ในระบบ กรุณาเลือกจากรายการ` });
        }
      }
      const virtSets = applied.filter((x) => x.def.t === "virt");
      let nextProd = mapRow.prod_id; let nextMat = mapRow.mat;
      for (const x of virtSets) {
        if (x.def.kind === "mat") nextMat = x.value;
        if (x.def.kind === "prod") nextProd = x.value;
        if (x.def.kind === "batch") {
          // one value = one Batch row per item typed ("A, B"): existing rows are rewritten in turn, extra rows are emptied (no DELETE), new items are added
          const tokens = x.value === null ? [] : String(x.value).split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
          const cnt = (await new sql.Request(tx).input("id", sql.Int, mappingId).query("SELECT COUNT(*) AS n FROM Batch WITH (UPDLOCK) WHERE mapping_id = @id")).recordset[0].n;
          for (let i = 0; i < Math.max(cnt, tokens.length); i++) {
            const t = tokens[i] === undefined ? null : tokens[i].slice(0, 200);
            if (i < cnt) {
              await new sql.Request(tx).input("id", sql.Int, mappingId).input("rn", sql.Int, i + 1).input("v", sql.NVarChar(200), t).query(
                `;WITH b AS (SELECT batch_after, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS rn FROM Batch WHERE mapping_id = @id) UPDATE b SET batch_after = @v WHERE rn = @rn`);
            } else {
              await new sql.Request(tx).input("id", sql.Int, mappingId).input("v", sql.NVarChar(200), t).query("INSERT INTO Batch (mapping_id, batch_after) VALUES (@id, @v)");
            }
          }
        }
      }
      if (nextMat !== mapRow.mat || nextProd !== mapRow.prod_id) {
        if (!nextMat || !nextProd) {
          await safeRollback(tx);
          return res.status(400).json({ success: false, error: "รายการนี้ยังไม่มีแผนผลิต/วัตถุดิบ จึงแก้ทีละช่องไม่ได้ กรุณาให้ผู้ดูแลกำหนดแผนผลิตก่อน" });
        }
        if (!(await exists("SELECT TOP 1 1 AS ok FROM RawMat WITH (NOLOCK) WHERE mat = @v", "v", sql.VarChar(50), String(nextMat)))) {
          await safeRollback(tx); return res.status(400).json({ success: false, error: `ไม่พบวัตถุดิบ "${nextMat}" ในระบบ กรุณาเลือกจากรายการ` });
        }
        if (!(await exists("SELECT TOP 1 1 AS ok FROM Production WITH (NOLOCK) WHERE prod_id = @v", "v", sql.Int, Number(nextProd)))) {
          await safeRollback(tx); return res.status(400).json({ success: false, error: "ไม่พบแผนผลิตนี้ในระบบ กรุณาเลือกจากรายการ" });
        }
        // the plan + material pair is a ProdRawMat row: use it, or make it when this material was never linked to that plan
        const found = await new sql.Request(tx).input("p", sql.Int, Number(nextProd)).input("m", sql.VarChar(50), String(nextMat))
          .query("SELECT TOP 1 prod_rm_id FROM ProdRawMat WHERE prod_id = @p AND mat = @m ORDER BY prod_rm_id");
        let prodRmId = found.recordset.length ? found.recordset[0].prod_rm_id : null;
        if (!prodRmId) {
          const made = await new sql.Request(tx).input("p", sql.Int, Number(nextProd)).input("m", sql.VarChar(50), String(nextMat))
            .query("INSERT INTO ProdRawMat (mat, prod_id) OUTPUT INSERTED.prod_rm_id VALUES (@m, @p)");
          prodRmId = made.recordset[0].prod_rm_id;
        }
        await new sql.Request(tx).input("id", sql.Int, mappingId).input("pr", sql.Int, prodRmId)
          .query("UPDATE TrolleyRMMapping SET tro_production_id = @pr WHERE mapping_id = @id");
      }
      const histSets = applied.filter((x) => x.def.t === "hist");
      if (histSets.length) {
        const r = new sql.Request(tx).input("hid", sql.Int, histId);
        const sets = histSets.map((x, i) => {
          const name = `h${i}`;
          if (x.def.kind === "date") {
            r.input(name, sql.VarChar(19), x.value);
            return isDateType(histTypes[x.col])
              ? `[${x.col}] = TRY_CONVERT(DATETIME, @${name}, 120)`
              : `[${x.col}] = CONVERT(VARCHAR(19), TRY_CONVERT(DATETIME, @${name}, 120), 120)`;
          }
          r.input(name, x.def.sql(), x.value);
          return `[${x.col}] = @${name}`;
        });
        await r.query(`UPDATE History SET ${sets.join(", ")} WHERE hist_id = @hid`);
      }

      const user = req.user || {};
      for (const it of applied) {
        await new sql.Request(tx)
          .input("mid", sql.Int, mappingId).input("hid", sql.Int, it.def.t === "hist" ? histId : null)
          .input("tn", sql.NVarChar(40), it.def.t === "map" ? "TrolleyRMMapping" : it.def.t === "virt" ? (it.def.kind === "batch" ? "Batch" : "ProdRawMat") : "History").input("cn", sql.NVarChar(60), it.col)
          .input("ov", sql.NVarChar(600), it.oldVal === null || it.oldVal === undefined ? null : String(it.oldVal).slice(0, 600))
          .input("nv", sql.NVarChar(600), it.value === null ? null : String(it.value).slice(0, 600))
          .input("rs", sql.NVarChar(300), reason || opts.defaultReason || null)
          .input("uid", sql.Int, Number.isInteger(user.user_id) ? user.user_id : null).input("un", sql.NVarChar(100), user.username ? String(user.username).slice(0, 100) : null)
          .query(`INSERT INTO SheetEditLog (mapping_id, hist_id, table_name, column_name, old_value, new_value, reason, user_id, username)
                  VALUES (@mid, @hid, @tn, @cn, @ov, @nv, @rs, @uid, @un)`);
      }
      for (const x of extraLog) {
        await new sql.Request(tx)
          .input("mid", sql.Int, mappingId).input("tn", sql.NVarChar(40), x.tn).input("cn", sql.NVarChar(60), x.cn)
          .input("ov", sql.NVarChar(600), x.ov).input("nv", sql.NVarChar(600), x.nv).input("rs", sql.NVarChar(300), reason || null)
          .input("uid", sql.Int, Number.isInteger(user.user_id) ? user.user_id : null).input("un", sql.NVarChar(100), user.username ? String(user.username).slice(0, 100) : null)
          .query(`INSERT INTO SheetEditLog (mapping_id, hist_id, table_name, column_name, old_value, new_value, reason, user_id, username)
                  VALUES (@mid, NULL, @tn, @cn, @ov, @nv, @rs, @uid, @un)`);
      }
      await tx.commit();
      invalidateSheetCache();
      console.log(`✅ [Sheet edit] mapping ${mappingId} โดย user ${user.user_id ?? "-"}: ${applied.map((x) => x.col).join(", ")}`);
      res.json({ success: true, changed: applied.length, message: `แก้ไขข้อมูล ${applied.length} ช่องสำเร็จ` });
    } catch (err) {
      await safeRollback(tx);
      throw err;
    }
  } catch (err) {
    console.error(`❌ [Route PATCH ${req.path}] Error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
};
// every column, Supervisor / Master or whoever unlocked the edit (rule in lib/authMiddleware.js)
router.patch("/sheet/edit", sheetEditHandler());
// a material in a cold room: Code (production plan), line and weight only — the "แก้ไข Code / Line / น้ำหนัก" button of the Sheet (any Role that sees the row)
router.patch("/sheet/cold-edit", sheetEditHandler({ only: ["prod_id", "rmm_line_name", "weight_RM"], coldOnly: true, defaultReason: "แก้ไขในห้องเย็น" }));
// Pack ("แก้ไขแผนการผลิต / น้ำหนัก" of the rows that wait for packing): only the weight, only before the row is packed
router.patch("/sheet/pack-edit", sheetEditHandler({ only: ["weight_RM"], packOnly: true, defaultReason: "แก้ไขน้ำหนักที่บรรจุ" }));

// master data for the dropdowns of the edit dialog (values that come from the database can only be picked, not typed)
const OPTION_SQL = {
  mat: { q: "SELECT TOP (10000) mat AS value, mat_name FROM RawMat WITH (NOLOCK) ORDER BY mat_name", label: (r) => `${r.mat_name || ""} (${r.value})` },
  prod: { q: "SELECT TOP (5000) p.prod_id AS value, p.doc_no, p.code FROM Production p WITH (NOLOCK) ORDER BY p.prod_id DESC", label: (r) => `${r.doc_no || "-"} · ${r.code || ""}` },
  line: { q: "SELECT line_name AS value FROM Line WITH (NOLOCK) ORDER BY line_name" },
  tro: { q: "SELECT tro_id AS value FROM Trolley WITH (NOLOCK) ORDER BY tro_id" },
  dest: { q: "SELECT DISTINCT TOP (300) dest AS value FROM TrolleyRMMapping WITH (NOLOCK) WHERE dest IS NOT NULL AND dest <> N'' ORDER BY dest" },
  // Code สินค้า (หน้าใช้บรรจุภัณฑ์เลือก Code จากรายการแผนผลิต)
  prodcode: { q: "SELECT DISTINCT TOP (5000) p.code AS value FROM Production p WITH (NOLOCK) WHERE p.code IS NOT NULL AND p.code <> N'' ORDER BY p.code" },
  stay: { q: "SELECT DISTINCT TOP (300) stay_place AS value FROM TrolleyRMMapping WITH (NOLOCK) WHERE stay_place IS NOT NULL AND stay_place <> N'' ORDER BY stay_place" },
};
const optionCache = new Map(); // field -> { at, data } (5 minutes)
router.get("/sheet/edit-options", async (req, res) => {
  try {
    const field = String(req.query.field || "");
    const def = OPTION_SQL[field];
    if (!def) return res.status(400).json({ success: false, error: "field ไม่ถูกต้อง" });
    const hit = optionCache.get(field);
    if (hit && Date.now() - hit.at < 5 * 60 * 1000) return res.json({ success: true, data: hit.data });
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    const r = await pool.request().query(def.q);
    const data = r.recordset.map((row) => ({ value: row.value, label: def.label ? def.label(row) : String(row.value) }));
    optionCache.set(field, { at: Date.now(), data });
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [Route GET /sheet/edit-options] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// edit history of one mapping (newest first)
router.get("/sheet/edit-log", async (req, res) => {
  try {
    const mappingId = parseInt(req.query.mapping_id, 10);
    if (Number.isNaN(mappingId)) return res.status(400).json({ success: false, error: "ต้องระบุ mapping_id" });
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    const r = await pool.request().input("mid", sql.Int, mappingId).query(`
      SELECT TOP 200 el.edit_id, el.mapping_id, el.table_name, el.column_name, el.old_value, el.new_value, el.reason, el.user_id, el.username,
             CONVERT(VARCHAR(19), el.edited_at, 120) AS edited_at
      FROM SheetEditLog el WITH (NOLOCK) WHERE el.mapping_id = @mid ORDER BY el.edit_id DESC`)
      .catch((err) => { if (isMissingTable(err)) return { recordset: [] }; throw err; });
    res.json({ success: true, data: r.recordset });
  } catch (err) {
    console.error("❌ [Route GET /sheet/edit-log] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══ วัตถุดิบนี้ผสมมาจากอะไร (แทนหน้า "รายการผสมวัตถุดิบ" เดิม) ═══════════════
//   GET /sheet/mix-source?mapping_id=  → ส่วนประกอบจากทุกแบบการผสมที่ระบบมี
//   Emulsion (RM_EmuMixed) · BatchMix (Mix_Batch_Prod) · ผสมที่ไลน์บรรจุ (RM_Mixed ผ่าน mix_code)
//   · MixPeck (RM_MixPeck) · MixInclude (RM_MixInclude → MixToPack) · Loaf (RM_Mix_loaf)
//   แต่ละแบบอ่านแยก try/catch: ตารางไหนยังไม่มีในฐานข้อมูลก็ข้ามไป
const COMPONENT_SQL = (idSource) => `
  SELECT cm.mapping_id, pr.mat, rm.mat_name, cm.weight_RM AS weight,
         COALESCE(NULLIF(bt.batch_after, N''), NULLIF(CAST(rf.batch AS NVARCHAR(200)), N'')) AS batch,
         cm.rmm_line_name AS line_name,
         CONVERT(VARCHAR(19), h.rmit_date, 120) AS rmit_date,
         CONVERT(VARCHAR(19), h.out_cold_date, 120) AS out_cold_date,
         CONVERT(VARCHAR(19), h.cooked_date, 120) AS cooked_date
  FROM (${idSource}) src
  JOIN TrolleyRMMapping cm WITH (NOLOCK) ON cm.mapping_id = src.mapping_id
  LEFT JOIN RMForProd rf WITH (NOLOCK) ON rf.rmfp_id = cm.rmfp_id
  LEFT JOIN ProdRawMat pr WITH (NOLOCK) ON pr.prod_rm_id = cm.tro_production_id
  LEFT JOIN RawMat rm WITH (NOLOCK) ON rm.mat = pr.mat
  OUTER APPLY (SELECT TOP 1 b.batch_after FROM Batch b WITH (NOLOCK) WHERE b.mapping_id = cm.mapping_id ORDER BY b.batch_id DESC) bt
  OUTER APPLY (SELECT TOP 1 hx.rmit_date, hx.out_cold_date, hx.cooked_date FROM History hx WITH (NOLOCK) WHERE hx.mapping_id = cm.mapping_id ORDER BY hx.hist_id DESC) h`;

router.get("/sheet/mix-source", async (req, res) => {
  try {
    const id = parseInt(req.query.mapping_id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: "ต้องระบุ mapping_id" });
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });

    const head = (await pool.request().input("id", sql.Int, id).query(`
      SELECT rmm.mapping_id, rmm.rmfp_id, rmm.mix_code, pr.mat, rm.mat_name, rmm.weight_RM
      FROM TrolleyRMMapping rmm WITH (NOLOCK)
      LEFT JOIN ProdRawMat pr WITH (NOLOCK) ON pr.prod_rm_id = rmm.tro_production_id
      LEFT JOIN RawMat rm WITH (NOLOCK) ON rm.mat = pr.mat
      WHERE rmm.mapping_id = @id`)).recordset[0];
    if (!head) return res.status(404).json({ success: false, error: "ไม่พบรายการ" });

    const groups = [];
    const errors = {};
    const run = async (key, label, fn) => {
      try {
        const rows = await fn();
        if (rows.length) groups.push({ key, label, rows });
      } catch (err) {
        errors[key] = err.message;
      }
    };
    const rq = () => pool.request().input("id", sql.Int, id).input("rmfp", sql.Int, head.rmfp_id).input("mix", sql.NVarChar(100), head.mix_code == null ? null : String(head.mix_code));

    await run("emulsion", "Emulsion ที่ผสม", async () => (await rq().query(`
      SELECT rmfe.rmfemu_id AS ref_id, rmfe.mat, r.mat_name, rmfe.batch, rmfe.weight,
             CONVERT(VARCHAR(19), h.withdraw_date, 120) AS withdraw_date
      FROM RM_EmuMixed rme WITH (NOLOCK)
      JOIN RMForEmu rmfe WITH (NOLOCK) ON rmfe.rmfemu_id = rme.rmfemu_id
      LEFT JOIN RawMat r WITH (NOLOCK) ON r.mat = rmfe.mat
      LEFT JOIN History h WITH (NOLOCK) ON h.hist_id = rmfe.hist_id_rmfemu
      WHERE @rmfp IS NOT NULL AND rme.rmfp_id = @rmfp`)).recordset);

    await run("batchmix", "Batch Mix ที่ผสม", async () => (await rq().query(`
      SELECT rmmb.rmfbatch_id AS ref_id, rmmb.mat, r.mat_name, rmmb.batch, rmmb.weight, rmmb.hu
      FROM Mix_Batch_Prod mbp WITH (NOLOCK)
      JOIN RMMixBatch rmmb WITH (NOLOCK) ON rmmb.rmfbatch_id = mbp.rmfbatch_id
      LEFT JOIN RawMat r WITH (NOLOCK) ON r.mat = rmmb.mat
      WHERE @rmfp IS NOT NULL AND mbp.rmfp_id = @rmfp`)).recordset);

    await run("packmix", "ผสมที่ไลน์บรรจุ (mix code)", async () => (await rq().query(
      COMPONENT_SQL("SELECT DISTINCT x.mapping_id FROM RM_Mixed x WITH (NOLOCK) WHERE @mix IS NOT NULL AND CAST(x.mixed_code AS NVARCHAR(100)) = @mix AND x.mapping_id <> @id"))).recordset);

    await run("mixpeck", "วัตถุดิบที่ผสมเข้าแผนนี้", async () => (await rq().query(
      COMPONENT_SQL("SELECT DISTINCT x.mapping_id FROM RM_MixPeck x WITH (NOLOCK) WHERE @rmfp IS NOT NULL AND x.rmfp_id = @rmfp AND x.mapping_id <> @id"))).recordset);

    await run("mixinclude", "วัตถุดิบที่รวมเข้า (Include)", async () => (await rq().query(
      COMPONENT_SQL("SELECT DISTINCT mtp.from_mapping_id AS mapping_id FROM RM_MixInclude x WITH (NOLOCK) JOIN MixToPack mtp WITH (NOLOCK) ON mtp.mixtp_id = x.mixtp_id WHERE @rmfp IS NOT NULL AND x.rmfp_id = @rmfp AND mtp.from_mapping_id IS NOT NULL"))).recordset);

    await run("loaf", "Loaf ทำจาก", async () => (await rq().query(
      COMPONENT_SQL("SELECT DISTINCT x.mapping_id_source AS mapping_id FROM RM_Mix_loaf x WITH (NOLOCK) WHERE x.mapping_id = @id"))).recordset);

    res.json({ success: true, data: { head, groups, mixed: groups.length > 0 }, errors });
  } catch (err) {
    console.error("[Route /sheet/mix-source] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// the query builders, for scripts/sheet-timing.js (measures each query on the real database)
router.__queries = { buildMappingQuery, buildHuQuery, buildPlanQuery, buildMixedQuery };

module.exports = router;
