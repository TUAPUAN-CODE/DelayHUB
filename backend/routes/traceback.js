// ─────────────────────────────────────────────────────────────────────────────
// traceback.routes.js
//   GET  /api/traceback/filters          → ค่าที่เลือกได้ (เติม dropdown)
//   GET  /api/traceback/search           → รายการผลิต (1 การ์ด = 1 doc_no + code)
//   GET  /api/traceback/detail           → ใบสอบกลับเต็ม
//   GET  /api/traceback/ingredients      → ส่วนผสมดิบรายตะกร้า (เรียกแยกตอนกดดู)
//   GET  /api/traceback/debug/columns    → ดูว่าคอลัมน์ไหนอยู่ตารางไหน
//   GET  /api/traceback/debug/supplier   → สแกนทั้ง DB หาคอลัมน์ผู้ขาย
//   GET  /api/traceback/debug/trace/:id  → วินิจฉัยรายล็อต
//   GET  /api/traceback/debug/decode     → ทดสอบถอดรหัส
//   POST /api/traceback/refs/reload      → ล้าง cache
//
// สรุปสิ่งที่แก้จากเวอร์ชันก่อน
//   [1] batch หาย   : INFORMATION_SCHEMA คืนชื่อจริง 'Batch' (B ใหญ่) แต่โค้ด
//                     lookup ด้วย 'batch' → has('batch') เป็น false → ไม่ join เลย
//                     แก้เป็น lookup แบบ case-insensitive
//   [2] ส่วนผสมซ้ำ  : HistoryIngredientWO มีแถวซ้ำ (wo/ตะกร้าเดียวกัน) ทำให้ดึง
//                     ส่วนผสมซ้ำตามจำนวนแถว น้ำหนักพองเป็นเท่าตัว → dedupe
//   [3] packaging   : join History ทุกแถวของ mapping (ไม่ใช่แถวล่าสุด) + ขอบเวลา
//                     ซ้อนกัน + แถวที่ช่วงยาวผิดปกติ → ใช้ ROW_NUMBER + ครึ่งเปิด
//                     + จำกัดความยาวช่วงไม่เกิน MAX_PKG_WINDOW_MIN
//   [4] withdraw_date เก็บเป็น varchar ("Aug  7 2026  6:10AM") → TRY_CONVERT
//   [5] ดีเลย์      : /search กับ /detail คำนวณคนละสูตร → ใช้ rmit→sc_pack เท่ากัน
//   [6] ลบ route /traceback/detail ที่ซ้ำซ้อนออก (เดิมกลายเป็น path ซ้อน)
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const sql = require('mssql');
const router = express.Router();

// ปรับ path ให้ตรงกับโปรเจกต์จริง
const { connectToDatabase, connectToDatabaseWC } = require('../database/db');
const { getRefs, clearCache: clearDecoderCache, decodePair, refsStats } = require('./tracebackcode');
const tracebackBatchRouter = require('./Tracebackbatch');
const { decodeBatches } = require('./Tracebackbatch');
const { fetchIntakeByBatch } = require('./Tracebackwiseup');

const WARN_MIN = 120;            // 2 ชม.
const SEVERE_MIN = 480;          // 8 ชม.
const MAX_PKG_WINDOW_MIN = 720;  // ช่วงใช้บรรจุภัณฑ์ที่ยาวเกิน 12 ชม. ถือว่าคีย์ผิด

// ═══ introspection ═════════════════════════════════════════════════════════
const TABLES = [
  'TrolleyRMMapping', 'RMForProd', 'ProdRawMat', 'RawMat',
  'Production', 'History', 'Batch', 'Mat', 'QC',
];
const DATE_TYPES = new Set(['datetime', 'datetime2', 'smalldatetime', 'date', 'datetimeoffset', 'time']);
const TEXT_TYPES = new Set(['varchar', 'nvarchar', 'char', 'nchar']);
const DATEISH_NAME = /(date|time)(_two|_three|_four)?$/i;

let SCHEMA = null;      // { ActualTableName: [{name,type}] }
let SCHEMA_LC = null;   // { lowercasename: ActualTableName }
let SCHEMA_AT = 0;
const SCHEMA_TTL = 10 * 60 * 1000;

async function getSchema(pool) {
  if (SCHEMA && Date.now() - SCHEMA_AT < SCHEMA_TTL) return SCHEMA;
  const r = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME IN (${TABLES.map(t => `'${t}'`).join(',')})
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  const map = {};
  const lc = {};
  for (const row of r.recordset) {
    (map[row.TABLE_NAME] ||= []).push({ name: row.COLUMN_NAME, type: String(row.DATA_TYPE).toLowerCase() });
    lc[String(row.TABLE_NAME).toLowerCase()] = row.TABLE_NAME;
  }
  SCHEMA = map;
  SCHEMA_LC = lc;
  SCHEMA_AT = Date.now();
  return SCHEMA;
}

/** [1] ชื่อตารางจริงแบบไม่สนตัวพิมพ์ — 'batch' → 'Batch' */
const realTable = name => (SCHEMA_LC ? SCHEMA_LC[String(name).toLowerCase()] : null) || null;
const getCols = name => { const t = realTable(name); return t ? SCHEMA[t] : null; };
const hasTable = name => !!(getCols(name) || []).length;

/** นิพจน์ select ของ 1 คอลัมน์ */
function colExpr(alias, c, prefix) {
  const out = `[${prefix}__${c.name}]`;
  if (DATE_TYPES.has(c.type)) {
    return `CONVERT(VARCHAR, ${alias}.[${c.name}], 120) AS ${out}`;
  }
  // [4] คอลัมน์ชื่อลงท้าย date/time แต่เก็บเป็นข้อความ — แปลงถ้าแปลงได้
  if (TEXT_TYPES.has(c.type) && DATEISH_NAME.test(c.name)) {
    return `COALESCE(CONVERT(VARCHAR, TRY_CONVERT(DATETIME, ${alias}.[${c.name}]), 120), `
      + `CONVERT(VARCHAR(255), ${alias}.[${c.name}])) AS ${out}`;
  }
  return `${alias}.[${c.name}] AS ${out}`;
}

/** select list ของตารางหนึ่ง ตั้ง alias เป็น prefix__column */
function selectAll(table, alias, prefix) {
  return (getCols(table) || []).map(c => colExpr(alias, c, prefix)).join(',\n        ');
}

/** แยกแถวแบน ๆ กลับเป็นออบเจ็กต์ตามตาราง */
function splitRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const i = k.indexOf('__');
    if (i < 0) continue;
    const p = k.slice(0, i), n = k.slice(i + 2);
    (out[p] ||= {})[n] = v;
  }
  return out;
}

// ═══ helpers ════════════════════════════════════════════════════════════════
const S = v => (v == null ? '' : String(v).trim());
const toDate = v => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d; };
const diffMin = (a, b) => { const x = toDate(a), y = toDate(b); return x && y ? Math.round((y - x) / 60000) : null; };
const minOf = l => { const v = l.map(toDate).filter(Boolean).sort((a, b) => a - b); return v.length ? v[0].toISOString() : null; };
const maxOf = l => { const v = l.map(toDate).filter(Boolean).sort((a, b) => a - b); return v.length ? v[v.length - 1].toISOString() : null; };
const uniqList = s => [...new Set(S(s).split(',').map(x => x.trim()).filter(Boolean))];
const toNum = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const rnd = (v, d = 6) => (v == null ? null : Number(Number(v).toFixed(d)));

/** ค่าแรกในออบเจ็กต์ที่ key ตรง pattern */
function findVal(obj, patterns) {
  if (!obj) return null;
  for (const re of patterns) {
    for (const [k, v] of Object.entries(obj)) {
      if (re.test(k) && v !== null && v !== undefined && v !== '') return v;
    }
  }
  return null;
}

/** ค่าแรกจากหลายตาราง เรียงตามลำดับความน่าเชื่อถือ */
function pick(parts, order, patterns) {
  for (const p of order) {
    const v = findVal(parts[p], patterns);
    if (v !== null) return v;
  }
  return null;
}

// คอลัมน์เวลาใน History ที่ใช้เรียง timeline (ต้องตรงกับ frontend/tracebackStages.js)
const STAGE_COLS = [
  'rmit_date', 'rmit_date_mix',
  'start_defrost_date', 'end_defrost_date',
  'start_defrost_date_two', 'end_defrost_date_two',
  'start_defrost_date_three', 'end_defrost_date_three',
  'start_defrost_date_four', 'end_defrost_date_four',
  'cs_come_after_df_date',
  'start_mixed_date', 'mixed_date', 'mix_date', 'start_gravy_date', 'gm_date',
  'cooked_date',
  'come_cold_date', 'out_cold_date',
  'come_cold_date_two', 'out_cold_date_two',
  'come_cold_date_three', 'out_cold_date_three',
  'qc_date',
  'withdraw_date', 'withdraw_date_two', 'withdraw_date_three', 'withdraw_date_four',
  'summary_withdraw_date',
  'pack_checkin_date', 'sc_pack_date', 'rework_date',
];

/**
 * [5] ดีเลย์ — ให้ total_delay_minutes = rmit → sc_pack เท่ากับที่ /search ใช้
 *     ตัวเลขอื่นแยกชื่อชัดเจนเพื่อไม่ให้สับสน
 */
function computeDelays(history) {
  const points = STAGE_COLS
    .map(k => ({ key: k, value: history[k], date: toDate(history[k]) }))
    .filter(p => p.date)
    .sort((a, b) => a.date - b.date);

  const gaps = [];
  for (let i = 1; i < points.length; i++) {
    gaps.push({
      from: points[i - 1].key,
      to: points[i].key,
      minutes: diffMin(points[i - 1].value, points[i].value),
    });
  }
  const over = gaps.filter(g => g.minutes > WARN_MIN);
  const rmitToPack = diffMin(history.rmit_date, history.sc_pack_date);

  return {
    total_delay_minutes: rmitToPack,                                  // ใช้แสดง "ดีเลย์รวม"
    rmit_to_pack_minutes: rmitToPack,                                 // ชื่อชัดเจน ค่าเดียวกัน
    lead_minutes: points.length > 1 ? diffMin(points[0].value, points[points.length - 1].value) : null,
    over_threshold_minutes: over.reduce((a, g) => a + (g.minutes || 0), 0),
    over_threshold_count: over.length,
    max_gap_minutes: gaps.length ? Math.max(...gaps.map(g => g.minutes || 0)) : null,
    max_gap: gaps.length ? gaps.reduce((a, g) => ((g.minutes || 0) > (a.minutes || 0) ? g : a)) : null,
    stage_count: points.length,
  };
}

// ── ผู้ขาย: เก็บทุกคอลัมน์ที่ชื่อเกี่ยวกับ supplier/vendor เท่าที่มีอยู่จริง ──
const SUPP_RE = /supp|vendor|ผู้ขาย|ผู้ผลิต/i;

function collectSupplier(parts) {
  const fields = {};
  for (const [prefix, obj] of Object.entries(parts)) {
    for (const [k, v] of Object.entries(obj || {})) {
      if (SUPP_RE.test(k) && v !== null && v !== undefined && v !== '') fields[`${prefix}.${k}`] = v;
    }
  }
  const by = re => {
    for (const [k, v] of Object.entries(fields)) if (re.test(k)) return v;
    return null;
  };
  return {
    supplier_code: by(/supp[a-z_]*(code|no|id)$/i) || by(/\.supp$/i) || by(/\.supplier$/i),
    supplier_name: by(/supp[a-z_]*name/i),
    vendor_name: by(/vendor[a-z_]*name/i) || by(/\.vendor$/i),
    supplier_address: by(/(supp|vendor)[a-z_]*(addr|address)/i),
    fields,
  };
}

/** หาคอลัมน์ผู้ขายตัวแรกที่มีจริง ใช้ทำ dropdown/ตัวกรอง */
function findSupplierColumn() {
  const order = [['rm', 'RawMat'], ['pr', 'ProdRawMat'], ['rmf', 'RMForProd'], ['rmm', 'TrolleyRMMapping']];
  for (const [alias, table] of order) {
    const cols = getCols(table) || [];
    const col = cols.find(c => SUPP_RE.test(c.name));
    if (col) return { alias, table: realTable(table), col: col.name };
  }
  return null;
}

// ── FROM/WHERE ฐาน ใช้ร่วมกันทุก endpoint ──
const BASE_FROM = `
      FROM TrolleyRMMapping rmm
      JOIN RMForProd  rmf ON rmm.rmfp_id = rmf.rmfp_id
      JOIN ProdRawMat pr  ON rmm.tro_production_id = pr.prod_rm_id
      JOIN RawMat     rm  ON pr.mat = rm.mat
      JOIN Production p   ON pr.prod_id = p.prod_id
      OUTER APPLY (
        SELECT TOP 1 * FROM History h
        WHERE h.mapping_id = rmm.mapping_id
        ORDER BY h.hist_id DESC
      ) htr`;

const BASE_WHERE = `
        rmm.dest = N'บรรจุเสร็จ'
        AND rmm.stay_place = N'บรรจุเสร็จ'
        AND rmm.tro_id IS NULL
        AND htr.sc_pack_date IS NOT NULL`;

// ═══ 1) GET /filters ═══════════════════════════════════════════════════════
router.get('/filters', async (req, res) => {
  try {
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: 'เชื่อมต่อฐานข้อมูลไม่ได้' });

    await getSchema(pool);
    const suppCol = findSupplierColumn();

    const q = async (label, text) => {
      try {
        const r = await pool.request().query(text);
        return r.recordset
          .map(row => ({ value: S(row.value), label: S(row.label || row.value), meta: S(row.meta || '') }))
          .filter(o => o.value);
      } catch (e) {
        console.warn(`⚠️ [traceback/filters] ${label}: ${e.message}`);
        return [];
      }
    };

    const [doc_no, code, mat, mat_name, rmm_line_name, supplier] = await Promise.all([
      q('doc_no', `SELECT DISTINCT TOP 2000 p.doc_no AS value ${BASE_FROM} WHERE ${BASE_WHERE} AND p.doc_no IS NOT NULL ORDER BY p.doc_no DESC`),
      q('code', `SELECT DISTINCT TOP 2000 p.code AS value ${BASE_FROM} WHERE ${BASE_WHERE} AND p.code IS NOT NULL ORDER BY p.code`),
      q('mat', `SELECT TOP 3000 rm.mat AS value, MAX(rm.mat_name) AS meta ${BASE_FROM} WHERE ${BASE_WHERE} AND rm.mat IS NOT NULL GROUP BY rm.mat ORDER BY rm.mat`),
      q('mat_name', `SELECT DISTINCT TOP 3000 rm.mat_name AS value ${BASE_FROM} WHERE ${BASE_WHERE} AND rm.mat_name IS NOT NULL ORDER BY rm.mat_name`),
      q('line', `SELECT DISTINCT TOP 300 htr.rmm_line_name AS value ${BASE_FROM} WHERE ${BASE_WHERE} AND htr.rmm_line_name IS NOT NULL ORDER BY htr.rmm_line_name`),
      suppCol
        ? q('supplier', `SELECT DISTINCT TOP 2000 ${suppCol.alias}.[${suppCol.col}] AS value ${BASE_FROM} WHERE ${BASE_WHERE} AND ${suppCol.alias}.[${suppCol.col}] IS NOT NULL ORDER BY ${suppCol.alias}.[${suppCol.col}]`)
        : Promise.resolve([]),
    ]);

    res.json({
      success: true,
      data: { doc_no, code, mat, mat_name, rmm_line_name, supplier },
      supplier_column: suppCol ? `${suppCol.table}.${suppCol.col}` : null,
    });
  } catch (err) {
    console.error('❌ [traceback/filters]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══ 2) GET /search ════════════════════════════════════════════════════════
router.get('/search', async (req, res) => {
  try {
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: 'เชื่อมต่อฐานข้อมูลไม่ได้' });

    const { code, doc_no, mat, mat_name, rmm_line_name, supplier, sc_pack_date_from, sc_pack_date_to } = req.query;
    await getSchema(pool);

    const request = pool.request();
    const filters = [];

    if (S(code)) { filters.push("p.code LIKE '%' + @code + '%'"); request.input('code', sql.NVarChar, S(code)); }
    if (S(doc_no)) { filters.push("p.doc_no LIKE '%' + @doc_no + '%'"); request.input('doc_no', sql.NVarChar, S(doc_no)); }
    if (S(mat)) { filters.push("rm.mat LIKE '%' + @mat + '%'"); request.input('mat', sql.NVarChar, S(mat)); }
    if (S(mat_name)) { filters.push("rm.mat_name LIKE '%' + @mat_name + '%'"); request.input('mat_name', sql.NVarChar, S(mat_name)); }
    if (S(rmm_line_name)) { filters.push("htr.rmm_line_name LIKE '%' + @rmm_line_name + '%'"); request.input('rmm_line_name', sql.NVarChar, S(rmm_line_name)); }
    if (S(sc_pack_date_from)) { filters.push('htr.sc_pack_date >= @sc_pack_date_from'); request.input('sc_pack_date_from', sql.DateTime, new Date(S(sc_pack_date_from))); }
    if (S(sc_pack_date_to)) { filters.push('htr.sc_pack_date < DATEADD(day, 1, @sc_pack_date_to)'); request.input('sc_pack_date_to', sql.DateTime, new Date(S(sc_pack_date_to))); }

    if (S(supplier)) {
      const sc = findSupplierColumn();
      if (sc) {
        filters.push(`${sc.alias}.[${sc.col}] LIKE '%' + @supplier + '%'`);
        request.input('supplier', sql.NVarChar, S(supplier));
      }
    }

    const extraWhere = filters.length ? filters.map(f => `        AND ${f}`).join('\n') : '';

    const result = await request.query(`
      SELECT
        p.doc_no,
        p.code,
        CONVERT(VARCHAR, MIN(htr.sc_pack_date), 120) AS pack_date_first,
        CONVERT(VARCHAR, MAX(htr.sc_pack_date), 120) AS pack_date_last,
        COUNT(DISTINCT rmm.mapping_id) AS material_count,
        COUNT(DISTINCT rm.mat)         AS distinct_mat_count,
        SUM(rmm.weight_RM)             AS total_weight_rm,
        STRING_AGG(CONVERT(NVARCHAR(MAX), htr.rmm_line_name), ', ') AS lines_raw,
        STRING_AGG(CONVERT(NVARCHAR(MAX), rm.mat_name), ', ')       AS mat_names_raw,
        SUM(CASE WHEN DATEDIFF(MINUTE, htr.rmit_date, htr.sc_pack_date) > ${SEVERE_MIN} THEN 1 ELSE 0 END) AS severe_delay_count,
        SUM(CASE WHEN DATEDIFF(MINUTE, htr.rmit_date, htr.sc_pack_date) BETWEEN ${WARN_MIN + 1} AND ${SEVERE_MIN} THEN 1 ELSE 0 END) AS warn_delay_count,
        AVG(CAST(DATEDIFF(MINUTE, htr.rmit_date, htr.sc_pack_date) AS FLOAT)) AS avg_delay_minutes,
        MAX(DATEDIFF(MINUTE, htr.rmit_date, htr.sc_pack_date)) AS max_delay_minutes
      ${BASE_FROM}
      WHERE ${BASE_WHERE}
${extraWhere}
      GROUP BY p.doc_no, p.code
      ORDER BY MAX(htr.sc_pack_date) DESC
    `);

    const data = result.recordset.map(r => ({
      doc_no: r.doc_no,
      code: r.code,
      material_count: r.material_count,
      distinct_mat_count: r.distinct_mat_count,
      total_weight_rm: r.total_weight_rm,
      mat_names: uniqList(r.mat_names_raw).join(', '),
      lines: uniqList(r.lines_raw).join(', '),
      pack_date_first: r.pack_date_first,
      pack_date_last: r.pack_date_last,
      severe_delay_count: r.severe_delay_count,
      warn_delay_count: r.warn_delay_count,
      avg_delay_minutes: r.avg_delay_minutes != null ? Math.round(r.avg_delay_minutes) : null,
      max_delay_minutes: r.max_delay_minutes,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ [traceback/search]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══ 3) GET /detail ════════════════════════════════════════════════════════
router.get('/detail', async (req, res) => {
  const meta = {
    batch_joined: false,
    wo_rows_raw: 0,
    wo_rows_unique: 0,
    ingredients_ok: false,
    ingredient_row_count: 0,
    packaging_row_count: 0,
    supplier_column: null,
  };

  try {
    const doc_no = S(req.query.doc_no);
    const code = S(req.query.code);
    const wantRawIngredients = S(req.query.raw_ingredients) === '1';

    // ── ตัวกรองรหัสรุ่น ──────────────────────────────────────────────────
    //   batch      รหัสรุ่นวัตถุดิบ (ตรงกับ batch_before หรือ batch_after)
    //   pkg_batch  รหัสรุ่น/Lot ของบรรจุภัณฑ์
    //   ing_batch  รหัสรุ่นของส่วนผสม
    const batch     = S(req.query.batch);
    const pkgBatch  = S(req.query.pkg_batch);
    const ingBatch  = S(req.query.ing_batch);
    meta.filters = { doc_no, code, batch, pkg_batch: pkgBatch, ing_batch: ingBatch };

    if (!doc_no && !code && !batch && !pkgBatch && !ingBatch) {
      return res.status(400).json({
        success: false,
        error: 'ต้องระบุอย่างน้อย 1 อย่าง: doc_no, code, batch, pkg_batch หรือ ing_batch',
      });
    }

    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: 'เชื่อมต่อฐานข้อมูลไม่ได้' });

    await getSchema(pool);
    const refs = await getRefs(pool);

    const suppCol = findSupplierColumn();
    meta.supplier_column = suppCol ? `${suppCol.table}.${suppCol.col}` : null;

    // ── 3.1 ทุกล็อตวัตถุดิบของการผลิตนี้ (ดึงทุกคอลัมน์ของทุกตาราง) ──────
    // [1] ใช้ชื่อตารางจริงจาก schema — เดิม has('batch') เป็น false เพราะชื่อจริงคือ 'Batch'
    const tBatch = realTable('Batch');
    const tMat = realTable('Mat');
    const tQC = realTable('QC');
    meta.batch_joined = !!tBatch;

    const extraSelects = [
      tBatch ? selectAll('Batch', 'b', 'b') : null,
      tMat ? selectAll('Mat', 'mt', 'mt') : null,
      tQC ? selectAll('QC', 'qc', 'qc') : null,
    ].filter(Boolean);

    const extraJoins = [
      tBatch ? `OUTER APPLY (SELECT TOP 1 * FROM [${tBatch}] x WHERE x.mapping_id = rmm.mapping_id ORDER BY x.batch_id DESC) b` : '',
      tMat ? `OUTER APPLY (SELECT TOP 1 * FROM [${tMat}] x WHERE x.mapping_id = rmm.mapping_id) mt` : '',
      tQC ? `LEFT JOIN [${tQC}] qc ON qc.qc_id = rmm.qc_id` : '',
    ].filter(Boolean).join('\n      ');

    const rowsRes = await pool.request()
      .input('doc_no', sql.NVarChar(100), doc_no)
      .input('batch', sql.NVarChar(100), batch)
      .input('code', sql.NVarChar(100), code)
      .query(`
      SELECT
        ${selectAll('TrolleyRMMapping', 'rmm', 'rmm')},
        ${selectAll('RMForProd', 'rmf', 'rmf')},
        ${selectAll('ProdRawMat', 'pr', 'pr')},
        ${selectAll('RawMat', 'rm', 'rm')},
        ${selectAll('Production', 'p', 'p')},
        ${selectAll('History', 'htr', 'h')}${extraSelects.length ? ',' : ''}
        ${extraSelects.join(',\n        ')}
      ${BASE_FROM}
      ${extraJoins}
      WHERE ${BASE_WHERE}
        AND (@doc_no = '' OR p.doc_no = @doc_no)
        AND (@code   = '' OR p.code   = @code)
        AND (@batch  = '' OR b.batch_before = @batch OR b.batch_after = @batch)
      ORDER BY htr.sc_pack_date, rm.mat
    `);

    const rows = rowsRes.recordset;
    if (!rows.length) return res.status(404).json({ success: false, error: 'ไม่พบการผลิตตามเงื่อนไขนี้' });

    const parsed = rows.map(splitRow);
    const mappingIds = [...new Set(parsed.map(x => x.rmm?.mapping_id).filter(v => v != null))];
    const idList = mappingIds.join(',') || '0';

    // ── 3.2 บรรจุภัณฑ์ ────────────────────────────────────────────────────
    // [3] ROW_NUMBER เอา History แถวล่าสุดต่อ mapping (เดิม join ทุกแถว → ซ้ำ)
    //     ช่วงเวลาเป็นครึ่งเปิด [start, stop) กันแถวที่จบพอดีกับแถวที่เริ่มพอดี
    //     ตัดช่วงที่ยาวเกิน MAX_PKG_WINDOW_MIN (ข้อมูลคีย์ผิด เช่น 24 ชม.เป๊ะ)
    let packaging = [];
    try {
      packaging = (await pool.request().query(`
        WITH H AS (
          SELECT h.mapping_id, h.rmm_line_name, h.sc_pack_date,
                 ROW_NUMBER() OVER (PARTITION BY h.mapping_id ORDER BY h.hist_id DESC) AS rn
          FROM [PFCMv2].[dbo].[History] h
          WHERE h.mapping_id IN (${idList})
            AND h.sc_pack_date IS NOT NULL
        )
        SELECT
          H.mapping_id, H.rmm_line_name,
          d.detail_id, d.report_id,
          d.code, d.material_no, d.lot_no, d.batch_no, d.hu_no, d.line_name,
          CONVERT(VARCHAR, d.produce_date, 120) AS produce_date,
          CONVERT(VARCHAR, d.receive_date, 120) AS receive_date,
          CONVERT(VARCHAR, d.start_time, 120)   AS start_time,
          CONVERT(VARCHAR, d.stop_time, 120)    AS stop_time,
          DATEDIFF(MINUTE, d.start_time, d.stop_time) AS use_minutes,
          d.remark, d.slip_id, d.box_no, d.ink, d.roll_no, d.side,
          d.qty_received, d.qty_used, d.qty_damaged, d.qty_remaining,
          CONVERT(VARCHAR, r.report_date, 120) AS report_date,
          r.shift, r.plant, r.package_type, r.reported_by, r.qc_supervisor,
          r.status, r.code AS report_code, r.line_name AS report_line_name,
          s.type_choice   AS slip_type_choice,
          s.line_name     AS slip_line_name,
          s.code_mat      AS slip_code_mat,
          s.batch_no      AS slip_batch_no,
          s.lot           AS slip_lot,
          s.hu            AS slip_hu,
          s.box_no        AS slip_box_no,
          s.roll_no       AS slip_roll_no,
          s.size          AS slip_size,
          s.te            AS slip_te,
          s.qty           AS slip_qty,
          s.seq_use       AS slip_seq_use,
          s.remark        AS slip_remark,
          s.code          AS slip_code,
          CONVERT(VARCHAR, s.send_date, 120)    AS slip_send_date,
          CONVERT(VARCHAR, s.produce_date, 120) AS slip_produce_date,
          CONVERT(VARCHAR, s.receive_date, 120) AS slip_receive_date,
          CONVERT(VARCHAR, s.created_at, 120)   AS slip_created_at
        FROM H
        JOIN [PFCMv2].[dbo].[PackagingUsageDetail] d
          ON d.start_time <= H.sc_pack_date
         AND d.stop_time  >  H.sc_pack_date
        LEFT JOIN [PFCMv2].[dbo].[PackagingUsageReport] r
          ON r.report_id = d.report_id
        LEFT JOIN [PFCMv2].[dbo].[PrintMasterSlip] s
          ON s.slip_id = d.slip_id
        WHERE H.rn = 1
          AND d.start_time IS NOT NULL
          AND d.stop_time  IS NOT NULL
          AND DATEDIFF(MINUTE, d.start_time, d.stop_time) BETWEEN 0 AND ${MAX_PKG_WINDOW_MIN}
          AND COALESCE(d.line_name, r.line_name) = H.rmm_line_name
        ORDER BY H.mapping_id, d.start_time, d.code
      `)).recordset;
      meta.packaging_row_count = packaging.length;
    } catch (e) {
      console.error('❌ [traceback/detail] packaging:', e.message);
      meta.packaging_error = e.message;
    }

    // ── 3.3 WO ของแต่ละล็อต ───────────────────────────────────────────────
    // [2] HistoryIngredientWO มีแถวซ้ำได้ (wo/ตะกร้าเดียวกัน คีย์ซ้ำ)
    //     ถ้าไม่ dedupe ส่วนผสมจะถูกดึงซ้ำตามจำนวนแถว น้ำหนักพองเป็นเท่าตัว
    let woRows = [];
    try {
      woRows = (await pool.request().query(`
        SELECT MIN(ingredient_wo_id) AS ingredient_wo_id,
               mapping_id, wo_no, basket_no_start, basket_no_end,
               CONVERT(VARCHAR, MIN(created_at), 120) AS created_at,
               COUNT(*) AS dup_count
        FROM [PFCMv2].[dbo].[HistoryIngredientWO]
        WHERE mapping_id IN (${idList})
        GROUP BY mapping_id, wo_no, basket_no_start, basket_no_end
        ORDER BY mapping_id, ingredient_wo_id
      `)).recordset;
      meta.wo_rows_unique = woRows.length;
      meta.wo_rows_raw = woRows.reduce((a, w) => a + (w.dup_count || 1), 0);
      meta.wo_rows_deduped = meta.wo_rows_raw - meta.wo_rows_unique;
    } catch (e) {
      console.error('❌ [traceback/detail] wo:', e.message);
      meta.wo_error = e.message;
    }

    const woByMapping = new Map();
    for (const w of woRows) {
      if (!woByMapping.has(w.mapping_id)) woByMapping.set(w.mapping_id, []);
      woByMapping.get(w.mapping_id).push(w);
    }

    /** ป้ายกำกับ WO เช่น "WO123/B1-5" หรือ "WO123/B3" หรือ "WO123" */
    const woLabel = w => {
      const s = w.basket_no_start, e = w.basket_no_end;
      if (s == null && e == null) return String(w.wo_no);
      if (s != null && e != null) return `${w.wo_no}/B${s}${Number(s) === Number(e) ? '' : `-${e}`}`;
      return `${w.wo_no}/B${s ?? e}`;
    };

    // ── 3.4 ส่วนผสมจากฐาน WC ──────────────────────────────────────────────
    const poolWC = await connectToDatabaseWC().catch(e => {
      console.error('❌ [traceback/detail] WC pool:', e.message);
      return null;
    });
    const ingByMapping = new Map();
    const ingErrByMapping = new Map();

    if (poolWC) {
      const seen = new Map(); // cache ตาม wo|start|end กันยิงซ้ำข้าม mapping
      for (const [mappingId, list] of woByMapping.entries()) {
        const bag = [];
        for (const w of list) {
          if (!w.wo_no) continue;
          const bStart = w.basket_no_start != null && S(w.basket_no_start) !== '' ? parseInt(w.basket_no_start, 10) : null;
          const bEnd = w.basket_no_end != null && S(w.basket_no_end) !== '' ? parseInt(w.basket_no_end, 10) : null;
          const key = `${S(w.wo_no)}|${bStart ?? ''}|${bEnd ?? ''}`;
          try {
            if (!seen.has(key)) {
              const rq = poolWC.request()
                .input('wo_no', sql.NVarChar(40), S(w.wo_no))
                .input('b_start', sql.Int, bStart)
                .input('b_end', sql.Int, bEnd);
              const r2 = await rq.query(`
                SELECT
                  ng.[Id]        AS IngredientRowId,
                  ng.[WOId], ng.[WONo], ng.[BasketId], ng.[BasketNumber],
                  ng.[ngdntCode] AS MaterialCode,
                  ng.[ngdntName] AS MaterialName,
                  ng.[ShortName] AS MaterialShortName,
                  ng.[BatchNo]   AS IngredientBatchNo,
                  ng.[MixType],
                  ng.[StdWt], ng.[MinWt], ng.[MaxWt], ng.[NetWt], ng.[Percentage],
                  ng.[StdFormat], ng.[MinFormat], ng.[MaxFormat], ng.[ActualFormat],
                  CONVERT(VARCHAR, ng.[MixingTime], 120)    AS MixingTime,
                  CONVERT(VARCHAR, ng.[MixingEndTime], 120) AS MixingEndTime
                FROM [dbo].[vw_ngdnt_listNgdnt] ng
                WHERE ng.WONo = @wo_no
                  AND (@b_start IS NULL OR ng.BasketNumber >= @b_start)
                  AND (@b_end   IS NULL OR ng.BasketNumber <= @b_end)
                ORDER BY ng.BasketNumber, ng.ngdntCode
              `);
              seen.set(key, r2.recordset);
            }
            seen.get(key).forEach(it => bag.push({
              ...it,
              wo_no: w.wo_no,
              basket_no_start: w.basket_no_start,
              basket_no_end: w.basket_no_end,
              wo_label: woLabel(w),
            }));
          } catch (e) {
            console.error(`❌ [traceback/detail] WC wo_no=${w.wo_no}:`, e.message);
            ingErrByMapping.set(mappingId, e.message);
          }
        }
        // กันซ้ำอีกชั้น เผื่อ WO คนละแถวมีช่วงตะกร้าทับกัน
        const rowSeen = new Set();
        const deduped = bag.filter(it => {
          const k = `${it.IngredientRowId ?? ''}|${it.MaterialCode}|${it.BasketNumber}|${it.IngredientBatchNo ?? ''}`;
          if (rowSeen.has(k)) return false;
          rowSeen.add(k);
          return true;
        });
        ingByMapping.set(mappingId, deduped);
      }
      meta.ingredients_ok = true;
      meta.ingredient_row_count = [...ingByMapping.values()].reduce((a, l) => a + l.length, 0);
    } else {
      mappingIds.forEach(id => ingErrByMapping.set(id, 'เชื่อมต่อฐานข้อมูล WC ไม่ได้'));
      meta.ingredients_error = 'เชื่อมต่อฐานข้อมูล WC ไม่ได้';
    }

    const pkgByMapping = new Map();
    for (const p of packaging) {
      if (!pkgByMapping.has(p.mapping_id)) pkgByMapping.set(p.mapping_id, []);
      const arr = pkgByMapping.get(p.mapping_id);
      if (!arr.some(x => x.detail_id === p.detail_id)) arr.push(p);
    }

    /** สรุปส่วนผสมรายรหัส + ตรวจน้ำหนักหลุดพิกัด */
    const summariseIngredients = (list) => {
      const byCode = new Map();
      for (const r of list) {
        const key = `${r.MaterialCode}|${r.IngredientBatchNo || ''}`;
        let g = byCode.get(key);
        if (!g) {
          g = {
            material_code: r.MaterialCode,
            material_name: r.MaterialName || r.MaterialShortName,
            short_name: r.MaterialShortName,
            batch_no: r.IngredientBatchNo || null,
            mix_type: r.MixType ?? null,
            std_weight: toNum(r.StdWt),
            min_weight: toNum(r.MinWt),
            max_weight: toNum(r.MaxWt),
            percentage: toNum(r.Percentage),
            basket_count: 0,
            baskets: [],
            net_weight: 0,
            min_net_weight: null,
            max_net_weight: null,
            out_of_spec_count: 0,
            out_of_spec_baskets: [],
            used_from: null,
            used_to: null,
          };
          byCode.set(key, g);
        }
        g.basket_count++;
        if (r.BasketNumber != null && !g.baskets.includes(r.BasketNumber)) g.baskets.push(r.BasketNumber);

        const net = toNum(r.NetWt);
        if (net != null) {
          g.net_weight += net;
          g.min_net_weight = g.min_net_weight == null ? net : Math.min(g.min_net_weight, net);
          g.max_net_weight = g.max_net_weight == null ? net : Math.max(g.max_net_weight, net);
          const lo = toNum(r.MinWt), hi = toNum(r.MaxWt);
          if ((lo != null && net < lo) || (hi != null && net > hi)) {
            g.out_of_spec_count++;
            if (r.BasketNumber != null) g.out_of_spec_baskets.push(r.BasketNumber);
          }
        }
        if (r.MixingTime && (!g.used_from || r.MixingTime < g.used_from)) g.used_from = r.MixingTime;
        const end = r.MixingEndTime || r.MixingTime;
        if (end && (!g.used_to || end > g.used_to)) g.used_to = end;
      }
      return [...byCode.values()]
        .map(g => ({
          ...g,
          baskets: g.baskets.sort((a, b) => a - b),
          out_of_spec_baskets: g.out_of_spec_baskets.sort((a, b) => a - b),
          net_weight: rnd(g.net_weight),
          avg_net_weight: g.basket_count ? rnd(g.net_weight / g.basket_count) : null,
          min_net_weight: rnd(g.min_net_weight),
          max_net_weight: rnd(g.max_net_weight),
        }))
        .sort((a, b) => (b.net_weight || 0) - (a.net_weight || 0));
    };

    // ── 3.5 ประกอบรายล็อต ─────────────────────────────────────────────────
    const materials = parsed.map(x => {
      const history = { ...(x.h || {}) };
      const mappingId = x.rmm?.mapping_id;

      // QC มีเวลาตรวจแยกอีกตาราง ใช้เติมเมื่อ History ไม่ได้บันทึก
      if (!history.qc_date && x.qc?.qc_datetime) history.qc_date = x.qc.qc_datetime;

      const d = computeDelays(history);
      const supp = collectSupplier({ rm: x.rm, pr: x.pr, rmf: x.rmf, rmm: x.rmm, mt: x.mt, qc: x.qc, b: x.b });

      const mat = x.rm?.mat ?? pick(x, ['pr', 'rmf'], [/^mat$/i]);
      const mat2x = x.mt?.mat_2x ?? pick(x, ['mt', 'rmf', 'rmm'], [/^mat_?2x$/i, /mat.*2x/i]);

      // [1] batch: จากตาราง Batch ก่อน ถ้าไม่มีใช้ RMForProd.batch เป็น fallback
      const batchBefore = x.b?.batch_before ?? x.rmf?.batch ?? null;
      const batchAfter = x.b?.batch_after ?? x.rmf?.batch ?? null;
      const batchSource = x.b?.batch_before != null ? 'Batch'
        : (x.rmf?.batch != null ? 'RMForProd.batch' : null);

      const ingredients = ingByMapping.get(mappingId) || [];
      const ingredientSummary = summariseIngredients(ingredients);
      const pkg = pkgByMapping.get(mappingId) || [];

      return {
        mapping_id: mappingId,
        mat,
        mat_2x: mat2x,
        mat_name: x.rm?.mat_name ?? null,
        batch_before: batchBefore,
        batch_after: batchAfter,
        batch_id: x.b?.batch_id ?? null,
        batch_source: batchSource,
        supplier_code: supp.supplier_code,
        supplier_name: supp.supplier_name,
        vendor_name: supp.vendor_name,
        supplier_address: supp.supplier_address,
        supplier_fields: supp.fields,
        lot_no: pick(x, ['rmf', 'rmm', 'pr', 'mt'], [/lot_?no/i]),
        qty: pick(x, ['rmm', 'rmf'], [/^qty$/i, /^qty_/i]),
        weight_RM: x.rmm?.weight_RM ?? history.weight_RM ?? null,
        tray_count: x.rmm?.tray_count ?? history.tray_count ?? null,
        level_eu: x.rmm?.level_eu ?? null,
        mat_pkg: history.mat_pkg ?? null,
        batch_pkg: history.batch_pkg ?? null,
        qc_datetime: x.qc?.qc_datetime ?? null,
        qccheck: x.qc?.qccheck ?? null,
        mdcheck: x.qc?.mdcheck ?? null,
        defectcheck: x.qc?.defectcheck ?? null,
        rmit_date: history.rmit_date ?? null,
        sc_pack_date: history.sc_pack_date ?? null,
        rmm_line_name: history.rmm_line_name ?? null,
        rmfp_id: x.rmm?.rmfp_id ?? null,
        tro_production_id: x.rmm?.tro_production_id ?? null,

        // [5] ดีเลย์
        total_delay_minutes: d.total_delay_minutes,
        rmit_to_pack_minutes: d.rmit_to_pack_minutes,
        lead_minutes: d.lead_minutes,
        over_threshold_minutes: d.over_threshold_minutes,
        over_threshold_count: d.over_threshold_count,
        max_gap_minutes: d.max_gap_minutes,
        max_gap: d.max_gap,
        stage_count: d.stage_count,

        decoded: decodePair(mat, batchBefore || batchAfter, refs),
        wo_list: (woByMapping.get(mappingId) || []).map(woLabel),
        wo_rows: woByMapping.get(mappingId) || [],

        // ส่วนผสม: สรุปเสมอ ส่งดิบเมื่อขอ ?raw_ingredients=1
        ingredient_summary: ingredientSummary,
        ingredient_row_count: ingredients.length,
        ingredient_basket_count: new Set(ingredients.map(r => r.BasketNumber).filter(v => v != null)).size,
        ingredient_out_of_spec: ingredientSummary.reduce((a, g) => a + g.out_of_spec_count, 0),
        ingredients: wantRawIngredients ? ingredients : [],
        ingredients_error: ingErrByMapping.get(mappingId) || null,

        packaging: pkg,
        packaging_count: pkg.length,

        history,
        raw: {
          TrolleyRMMapping: x.rmm,
          RMForProd: x.rmf,
          ProdRawMat: x.pr,
          RawMat: x.rm,
          Production: x.p,
          Mat: x.mt,
          Batch: x.b || null,
          QC: x.qc,
        },
      };
    });

    // ── 3.5 ข้อมูลรับเข้าจาก WISEUP (แทนการถอดรหัสจากหลักของ batch) ─────
    //   แหล่งข้อมูลจริง แม่นกว่าการตีความรหัส
    try {
      const codes = materials.map(m => m.batch_before).filter(Boolean);
      const intakeMap = await fetchIntakeByBatch(codes);

      materials.forEach(m => {
        const k = m.batch_before ? String(m.batch_before).trim() : null;
        const it = k ? intakeMap.get(k) : null;
        m.intake = it || null;

        if (it) {
          // ── ผู้ขาย ──
          m.supplier_code    = it.supplier_code || m.supplier_code || null;
          m.supplier_name    = it.supplier_name || m.supplier_name || null;
          // ── วันที่จริงจากระบบรับเข้า ──
          m.batch_date       = it.batch_date || null;
          m.expiration_date  = it.expiration_date || null;
          m.shelf_life_days  = it.shelf_life_days ?? null;
          m.produce_date     = it.qc?.produce_date || null;
          // ── ชนิด/ขนาดวัตถุดิบ ──
          m.fish_specie      = it.fish_specie || null;
          m.fish_size        = it.fish_size || null;
          // ── การรับเข้า ──
          m.receive_qty      = it.receive_qty ?? null;
          m.receive_unit     = it.receive_unit || null;
          m.receive_first    = it.receive_first || null;
          m.receive_last     = it.receive_last || null;
          m.receive_lines    = it.receive_lines ?? 0;
          m.guide_numbers    = it.guide_numbers || null;
          // ── ผลตรวจ QC ตอนรับเข้า ──
          m.intake_inspection_lot = it.inspection_lot || null;
          m.intake_decision  = it.decision_code || null;
          m.intake_temp_avg  = it.qc?.temp_avg ?? null;
          m.intake_defect    = it.qc?.defect || null;
          m.intake_inspector = it.qc?.inspector || null;
          m.intake_reviewer  = it.qc?.reviewer || null;
          m.intake_truck     = it.qc?.truck_plate || null;
          // ── ระยะเวลาถือครองก่อนเบิกใช้ ──
          if (it.batch_date && m.rmit_date) {
            const diff = Math.round(
              (new Date(m.rmit_date) - new Date(String(it.batch_date).replace(' ', 'T'))) / 86400000);
            m.hold_days_before_use = Number.isFinite(diff) ? diff : null;
          }
        }
      });

      meta.intake_found = materials.filter(m => m.intake).length;
      meta.intake_missing = materials.filter(m => m.batch_before && !m.intake).length;
      meta.intake_ok = true;
    } catch (e) {
      console.error('[traceback/detail] wiseup intake:', e.message);
      meta.intake_error = e.message;
      materials.forEach(m => { m.intake = null; });
    }

    // ── 3.5.3 กรองด้วยรหัสรุ่นบรรจุภัณฑ์ / ส่วนผสม ────────────────────────
    //   ทำหลังประกอบข้อมูลครบ เพราะสองอย่างนี้มาจากคนละแหล่ง
    //   เมื่อกรองแล้ว จะตัดรายการที่ไม่ตรงออกจากล็อตด้วย ไม่ใช่แค่กรองล็อต
    let materialsOut = materials;

    if (pkgBatch) {
      const hit = v => S(v).toUpperCase() === pkgBatch.toUpperCase();
      materialsOut = materialsOut
        .map(m => {
          const keep = (m.packaging || []).filter(p =>
            hit(p.batch_no) || hit(p.lot_no) || hit(p.slip_batch_no) || hit(p.slip_lot));
          return keep.length ? { ...m, packaging: keep, packaging_count: keep.length } : null;
        })
        .filter(Boolean);
      meta.filtered_by_pkg_batch = materialsOut.length;
    }

    if (ingBatch) {
      const hit = v => S(v).toUpperCase() === ingBatch.toUpperCase();
      materialsOut = materialsOut
        .map(m => {
          const keep = (m.ingredient_summary || []).filter(g => hit(g.batch_no));
          if (!keep.length) return null;
          const rawKeep = (m.ingredients || []).filter(r => hit(r.IngredientBatchNo || r.BatchNo));
          return {
            ...m,
            ingredient_summary: keep,
            ingredients: rawKeep,
            ingredient_row_count: rawKeep.length || m.ingredient_row_count,
            ingredient_out_of_spec: keep.reduce((a, g) => a + (g.out_of_spec_count || 0), 0),
          };
        })
        .filter(Boolean);
      meta.filtered_by_ing_batch = materialsOut.length;
    }

    if (!materialsOut.length) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบล็อตที่ตรงกับรหัสรุ่นที่ระบุ',
        meta,
      });
    }

    // ── 3.6 ชั้นสรุป: ยุบแถวซ้ำ ───────────────────────────────────────────
    const groupBy = (list, keyFn, reduceFn) => {
      const map = new Map();
      list.forEach(item => {
        const k = keyFn(item);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(item);
      });
      return [...map.entries()].map(([k, items]) => reduceFn(k, items));
    };

    const rm_rows = groupBy(
      materialsOut,
      m => [m.mat, m.mat_2x, m.batch_before, m.batch_after, m.supplier_code, m.vendor_name].map(S).join('|'),
      (key, items) => {
        const f = items[0];
        return {
          key,
          mat: f.mat, mat_2x: f.mat_2x, mat_name: f.mat_name,
          batch_before: f.batch_before, batch_after: f.batch_after,
          batch_source: f.batch_source,
          supplier_code: f.supplier_code, supplier_name: f.supplier_name,
          vendor_name: f.vendor_name, supplier_address: f.supplier_address,
          lot_no: f.lot_no,
          qty: items.reduce((a, x) => a + (Number(x.qty) || 0), 0) || null,
          weight: rnd(items.reduce((a, x) => a + (Number(x.weight_RM) || 0), 0), 3),
          used_from: minOf(items.map(x => x.rmit_date || x.sc_pack_date)),
          used_to: maxOf(items.map(x => x.sc_pack_date)),
          count: items.length,
          mapping_ids: items.map(x => x.mapping_id),
          decoded: f.decoded,
          extra: f.supplier_fields,
        };
      }
    );

    // [2] รวมจาก ingredient_summary รายล็อต (ผ่าน dedupe มาแล้ว)
    const allIngSummaries = materialsOut.flatMap(m =>
      m.ingredient_summary.map(g => ({ ...g, _mapping: m.mapping_id, _wo: m.wo_list })));

    const ingredient_rows = groupBy(
      allIngSummaries,
      g => [g.material_code, g.batch_no].map(S).join('|'),
      (key, items) => {
        const f = items[0];
        return {
          key,
          material_code: f.material_code,
          material_name: f.material_name,
          short_name: f.short_name,
          batch_no: f.batch_no,
          mix_type: f.mix_type,
          net_weight: rnd(items.reduce((a, x) => a + (x.net_weight || 0), 0)),
          percentage: f.percentage,
          std_weight: f.std_weight,
          min_weight: f.min_weight,
          max_weight: f.max_weight,
          basket_count: items.reduce((a, x) => a + x.basket_count, 0),
          out_of_spec_count: items.reduce((a, x) => a + x.out_of_spec_count, 0),
          baskets: [...new Set(items.flatMap(x => x.baskets))].sort((a, b) => a - b),
          used_from: minOf(items.map(x => x.used_from)),
          used_to: maxOf(items.map(x => x.used_to)),
          wo_list: [...new Set(items.flatMap(x => x._wo || []))],
          mapping_ids: [...new Set(items.map(x => x._mapping))],
          count: items.length,
        };
      }
    );

    const packaging_rows = groupBy(
      packaging,
      p => [p.code, p.material_no, p.batch_no, p.lot_no].map(S).join('|'),
      (key, items) => {
        const f = items[0];
        // นับ 1 detail_id ครั้งเดียว แม้จะแมตช์หลาย mapping
        const uniq = [];
        const seenId = new Set();
        for (const it of items) {
          if (seenId.has(it.detail_id)) continue;
          seenId.add(it.detail_id);
          uniq.push(it);
        }
        const num = k => uniq.reduce((a, x) => a + (Number(x[k]) || 0), 0);
        return {
          key,
          code: f.code, material_no: f.material_no, batch_no: f.batch_no,
          lot_no: f.lot_no, hu_no: f.hu_no, line_name: f.line_name || f.report_line_name,
          qty_received: num('qty_received'),
          qty_used: num('qty_used'),
          qty_damaged: num('qty_damaged'),
          qty_remaining: num('qty_remaining'),
          used_from: minOf(uniq.map(x => x.start_time)),
          used_to: maxOf(uniq.map(x => x.stop_time)),
          produce_date: minOf(uniq.map(x => x.produce_date)),
          receive_date: minOf(uniq.map(x => x.receive_date)),
          report_date: minOf(uniq.map(x => x.report_date)),
          detail_ids: uniq.map(x => x.detail_id),
          slip_ids: [...new Set(uniq.map(x => x.slip_id).filter(v => v != null))],
          box_nos: [...new Set(uniq.map(x => x.box_no).filter(v => v != null))],
          mapping_ids: [...new Set(items.map(x => x.mapping_id))],
          slip_id: f.slip_id, box_no: f.box_no, ink: f.ink, roll_no: f.roll_no, side: f.side,
          remark: f.remark, plant: f.plant, package_type: f.package_type, report_code: f.report_code,
          shift: f.shift, reported_by: f.reported_by, qc_supervisor: f.qc_supervisor, status: f.status,
          slip: {
            type_choice: f.slip_type_choice, line_name: f.slip_line_name,
            code_mat: f.slip_code_mat, batch_no: f.slip_batch_no,
            lot: f.slip_lot, hu: f.slip_hu, size: f.slip_size, te: f.slip_te,
            qty: f.slip_qty, seq_use: f.slip_seq_use, remark: f.slip_remark,
            code: f.slip_code, send_date: f.slip_send_date,
            produce_date: f.slip_produce_date, receive_date: f.slip_receive_date,
            created_at: f.slip_created_at,
          },
          count: uniq.length,
        };
      }
    );

    // ── 3.7 สรุประดับเอกสาร ───────────────────────────────────────────────
    // [5] ใช้ total_delay_minutes (rmit → sc_pack) ให้ตรงกับ /search
    const delays = materialsOut.map(m => m.total_delay_minutes).filter(v => v != null);
    const production = parsed[0].p || {};

    const summary = {
      doc_no: production.doc_no ?? doc_no,
      code: production.code ?? code,
      lines: [...new Set(materialsOut.map(m => m.rmm_line_name).filter(Boolean))],
      material_count: materials.length,
      total_weight_rm: rnd(materialsOut.reduce((a, m) => a + (Number(m.weight_RM) || 0), 0), 3),
      pack_date_first: minOf(materialsOut.map(m => m.sc_pack_date)),
      pack_date_last: maxOf(materialsOut.map(m => m.sc_pack_date)),

      severe_delay_count: delays.filter(v => v > SEVERE_MIN).length,
      warn_delay_count: delays.filter(v => v > WARN_MIN && v <= SEVERE_MIN).length,
      avg_delay_minutes: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null,
      max_delay_minutes: delays.length ? Math.max(...delays) : null,
      min_delay_minutes: delays.length ? Math.min(...delays) : null,

      qc_fail_count: materialsOut.filter(m =>
        [m.qccheck, m.mdcheck, m.defectcheck].some(v => v && String(v).trim() !== 'ผ่าน')).length,

      batch_missing_count: materialsOut.filter(m => !m.batch_before).length,
      intake_found_count: materialsOut.filter(m => m.intake).length,
      intake_missing_count: materialsOut.filter(m => m.batch_before && !m.intake).length,
      supplier_list: [...new Set(materialsOut.map(m => m.supplier_name).filter(Boolean))],
      batch_date_first: materialsOut.map(m => m.batch_date).filter(Boolean).sort()[0] ?? null,
      qc_decision_codes: [...new Set(materialsOut.map(m => m.intake_decision).filter(Boolean))],
      intake_defect_count: materialsOut.filter(m => m.intake_defect).length,
      supplier_missing_count: materialsOut.filter(m => !m.supplier_code && !m.supplier_name && !m.vendor_name).length,

      ingredient_kind_count: ingredient_rows.length,
      ingredient_out_of_spec: ingredient_rows.reduce((a, g) => a + g.out_of_spec_count, 0),
      materials_without_ingredient: materialsOut.filter(m => !m.ingredient_row_count).map(m => m.mapping_id),

      packaging_kind_count: packaging_rows.length,
      materials_without_packaging: materialsOut.filter(m => !m.packaging_count).map(m => m.mapping_id),

      printed_at: new Date().toISOString(),
      production,
    };

    res.json({ success: true, data: { summary, rm_rows, ingredient_rows, packaging_rows, materials: materialsOut, meta } });
  } catch (err) {
    console.error('❌ [traceback/detail]', err);
    res.status(500).json({ success: false, error: err.message, meta });
  }
});

// ═══ 4) GET /ingredients — ส่วนผสมดิบรายตะกร้า ═════════════════════════════
router.get('/ingredients', async (req, res) => {
  try {
    const woList = S(req.query.wo_no).split(',').map(s => s.trim()).filter(Boolean);
    if (!woList.length) return res.status(400).json({ success: false, error: 'ต้องระบุ wo_no' });

    const poolWC = await connectToDatabaseWC();
    if (!poolWC) return res.status(503).json({ success: false, error: 'เชื่อมต่อฐานข้อมูล WC ไม่ได้' });

    const r = poolWC.request();
    const params = woList.map((w, i) => { r.input(`wo${i}`, sql.NVarChar(40), w); return `@wo${i}`; });

    let basketFilter = '';
    if (S(req.query.basket_from) && S(req.query.basket_to)) {
      r.input('bf', sql.Int, Number(req.query.basket_from));
      r.input('bt', sql.Int, Number(req.query.basket_to));
      basketFilter = 'AND BasketNumber BETWEEN @bf AND @bt';
    }

    const result = await r.query(`
      SELECT
        Id, WOId, WONo, BasketId, BasketNumber,
        ShortName, MixType, ngdntCode, ngdntName, BatchNo,
        StdWt, MinWt, MaxWt, NetWt, Percentage,
        StdFormat, MinFormat, MaxFormat, ActualFormat,
        CONVERT(VARCHAR, MixingTime, 120)    AS MixingTime,
        CONVERT(VARCHAR, MixingEndTime, 120) AS MixingEndTime
      FROM [dbo].[vw_ngdnt_listNgdnt]
      WHERE WONo IN (${params.join(', ')}) ${basketFilter}
      ORDER BY WONo, BasketNumber, Id
    `);

    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('❌ [traceback/ingredients]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══ 5) ล้าง cache ═════════════════════════════════════════════════════════
router.post('/refs/reload', (req, res) => {
  clearDecoderCache();
  SCHEMA = null;
  SCHEMA_LC = null;
  SCHEMA_AT = 0;
  res.json({ success: true, message: 'ล้าง cache ตารางอ้างอิงและโครงสร้างคอลัมน์แล้ว' });
});

// ═══ 6) วินิจฉัยว่าทำไมส่วนผสม/บรรจุภัณฑ์ไม่ขึ้น ═══════════════════════════
router.get('/debug/trace/:mapping_id', async (req, res) => {
  const out = { mapping_id: Number(req.params.mapping_id) };
  try {
    const pool = await connectToDatabase();
    await getSchema(pool);
    const id = out.mapping_id;

    const hist = await pool.request().query(`
      SELECT TOP 1 hist_id, mapping_id, rmm_line_name,
             CONVERT(VARCHAR, sc_pack_date, 120) AS sc_pack_date
      FROM [PFCMv2].[dbo].[History] WHERE mapping_id = ${id} ORDER BY hist_id DESC
    `);
    out.history = hist.recordset[0] || null;

    const tBatch = realTable('Batch');
    out.batch_table_real_name = tBatch;
    if (tBatch) {
      const b = await pool.request().query(`SELECT * FROM [${tBatch}] WHERE mapping_id = ${id}`);
      out.batch_rows = b.recordset;
    }

    const wo = await pool.request().query(`
      SELECT * FROM [PFCMv2].[dbo].[HistoryIngredientWO] WHERE mapping_id = ${id}
    `);
    out.historyIngredientWO = wo.recordset;
    const uniqWo = new Set(wo.recordset.map(w => `${w.wo_no}|${w.basket_no_start}|${w.basket_no_end}`));
    out.wo_source = wo.recordset.length
      ? `พบ ${wo.recordset.length} แถว (ไม่ซ้ำ ${uniqWo.size} รายการ)`
      : 'ไม่มีแถวใน HistoryIngredientWO → ส่วนผสมจะว่าง (ล็อตนี้ยังไม่ได้ผูก WO)';
    out.wo_duplicate_rows = wo.recordset.length - uniqWo.size;

    if (out.history?.sc_pack_date) {
      const t = out.history.sc_pack_date;
      const line = S(out.history.rmm_line_name);

      const pk = await pool.request().input('t', sql.VarChar(30), t).query(`
        SELECT COUNT(*) AS n FROM [PFCMv2].[dbo].[PackagingUsageDetail] d
        WHERE d.start_time <= @t AND d.stop_time > @t
      `);
      out.packaging_in_time_window = pk.recordset[0].n;

      const pk2 = await pool.request().input('t', sql.VarChar(30), t).input('line', sql.NVarChar(100), line).query(`
        SELECT COUNT(*) AS n
        FROM [PFCMv2].[dbo].[PackagingUsageDetail] d
        LEFT JOIN [PFCMv2].[dbo].[PackagingUsageReport] r ON r.report_id = d.report_id
        WHERE d.start_time <= @t AND d.stop_time > @t
          AND DATEDIFF(MINUTE, d.start_time, d.stop_time) BETWEEN 0 AND ${Number(MAX_PKG_WINDOW_MIN)}
          AND COALESCE(d.line_name, r.line_name) = @line
      `);
      out.packaging_matched_line = pk2.recordset[0].n;
      out.line_used = line;

      const lines = await pool.request().input('t', sql.VarChar(30), t).query(`
        SELECT DISTINCT TOP 20 COALESCE(d.line_name, r.line_name) AS line_name
        FROM [PFCMv2].[dbo].[PackagingUsageDetail] d
        LEFT JOIN [PFCMv2].[dbo].[PackagingUsageReport] r ON r.report_id = d.report_id
        WHERE d.start_time <= @t AND d.stop_time > @t
      `);
      out.lines_available_in_window = lines.recordset.map(x => x.line_name);
    }

    res.json({ success: true, data: out });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, partial: out });
  }
});

// ทดสอบถอดรหัสทีละรหัส: /api/traceback/debug/decode?mat=4100415&batch=NNN9G8NN11
router.get('/debug/decode', async (req, res) => {
  try {
    const pool = await connectToDatabase();
    const refs = await getRefs(pool);
    const mat = S(req.query.mat), batch = S(req.query.batch);
    res.json({
      success: true,
      refs_row_counts: refsStats(refs),
      material_type_codes: (refs.matType || []).map(t => `${t.material_type_code} = ${t.material_type_name}`),
      batch_type_codes: [...new Set((refs.batchDigit || []).map(d => d.batch_type_code))],
      input: { mat, batch },
      result: decodePair(mat, batch, refs),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══ 7) ดูว่าคอลัมน์ไหนอยู่ตารางไหน ════════════════════════════════════════
router.get('/debug/columns', async (req, res) => {
  try {
    const pool = await connectToDatabase();
    const schema = await getSchema(pool);
    const out = {};
    for (const [table, cols] of Object.entries(schema)) {
      out[table] = {
        supplier_like: cols.filter(c => SUPP_RE.test(c.name)).map(c => c.name),
        mat_batch_like: cols.filter(c => /mat|batch/i.test(c.name)).map(c => c.name),
        all: cols.map(c => c.name),
      };
    }
    res.json({
      success: true,
      tables_requested: TABLES,
      tables_found: Object.keys(schema),
      tables_missing: TABLES.filter(t => !realTable(t)),
      supplier_column: findSupplierColumn(),
      data: out,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══ 8) สแกนทั้ง DB หาว่าข้อมูลผู้ขายอยู่ตารางไหน ══════════════════════════
//     ใช้หาแหล่งข้อมูล supplier แล้วค่อยเพิ่ม join เข้า /detail
router.get('/debug/supplier', async (req, res) => {
  try {
    const pool = await connectToDatabase();
    const r = await pool.request().query(`
      SELECT c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE,
             (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS k
              WHERE k.TABLE_NAME = c.TABLE_NAME
                AND k.COLUMN_NAME IN ('mapping_id','mat','batch','batch_before','rmfp_id','prod_rm_id')
             ) AS join_key_count
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_SCHEMA = 'dbo'
        AND (c.COLUMN_NAME LIKE '%supp%' OR c.COLUMN_NAME LIKE '%vendor%'
             OR c.COLUMN_NAME LIKE '%ผู้ขาย%' OR c.COLUMN_NAME LIKE '%ผู้ผลิต%')
      ORDER BY join_key_count DESC, c.TABLE_NAME, c.COLUMN_NAME
    `);
    res.json({
      success: true,
      hint: 'join_key_count > 0 คือตารางที่มีคีย์พอจะ join กลับมาที่ล็อตวัตถุดิบได้',
      count: r.recordset.length,
      data: r.recordset,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══ 9) ต่อ router ถอดรหัส batch ═══════════════════════════════════════
//     /api/traceback/batch/:batch_code
//     /api/traceback/batch/:batch_code/trace
//     /api/traceback/batch/coverage
router.use('/', tracebackBatchRouter);

module.exports = router;