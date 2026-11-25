// ───────────────────────────────────────────────────────────────────────────
// IngredientRoutes.js — เมนู ส่วนผสม (Ingredient) ของ Supervisor
//   GET /api/ingredient/fetchIngredients?q=&limit=                    → รายการส่วนผสมทั้งหมด (+ จำนวนสินค้าที่ใช้ + ชื่อเรียก/หมายเหตุ)
//   GET /api/ingredient/fetchIngredientDetail?code=&from=&to=         → ใช้ในสินค้าไหนบ้าง (สูตร) + การใช้งานจริงรายตะกร้า (ค่าที่ชั่งเทียบ min/max)
//   GET /api/ingredient/fetchIngredientBatches?code=&from=&to=        → Batch ของส่วนผสมที่ใช้ในช่วงวันที่ (WC) + ผู้ขาย / วันรับ / วันหมดอายุของ Batch นั้น (WISEUP)
//   GET /api/ingredient/fetchIngredientLots?code=&from=&to=           → lot ใน PFCM ที่ใช้ส่วนผสมนี้ — ผ่าน WONo + ช่วงตะกร้าที่กรอกตอนยืนยันบรรจุ (PFCMv2.HistoryIngredientWO) จับกับตะกร้าของ WC
//   PUT /api/ingredient/update-ingredient-note {ingdnt_code, alias_name, remark} → บันทึกชื่อเรียก / หมายเหตุ (Supervisor / Master เท่านั้น)
//
// ข้อมูลส่วนผสมมาจากฐาน WC (IV.TUNA) แบบอ่านอย่างเดียว — ตาราง TunaCodeIngredients (สูตร) และ view vw_ngdnt_listNgdnt (ค่าที่ชั่งจริง)
// ข้อมูลที่แก้ได้เก็บใน PFCMv2.dbo.IngredientNote (backend/migrations/create_IngredientNote.sql — DBA รันเอง); ยังไม่มีตาราง = อ่านได้ปกติ แต่บันทึกไม่ได้
// ───────────────────────────────────────────────────────────────────────────
const express = require("express");
const sql = require("mssql");
const { connectToDatabase, connectToDatabaseWC } = require("../database/db");
const { fetchIntakeByBatch } = require("./Tracebackwiseup");

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 300;
const MAX_LIMIT = 2000;
const PRODUCT_ROWS = 2000;
const USAGE_ROWS = 500;
const BATCH_ROWS = 300;
const LOT_ROWS = 2000; // WO links read per request (newest first); the WC lookup is limited by them
const DEFAULT_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 31;
const LIST_CACHE_MS = 60 * 1000; // รายการส่วนผสมเปลี่ยนไม่บ่อย — พิมพ์ค้นหาทุกตัวอักษรไม่ต้องยิง WC ซ้ำ
const NOTE_TABLE_MISSING = "ยังไม่มีตาราง IngredientNote ในฐาน PFCMv2 — ให้ DBA รัน backend/migrations/create_IngredientNote.sql ก่อน";

const WC_DOWN = "ไม่สามารถเชื่อมต่อฐานข้อมูลสูตรได้";
const WISEUP_DOWN = "ไม่สามารถเชื่อมต่อฐานข้อมูล WISEUP ได้";
const isMissingTable = (err) => err && (err.number === 208 || /Invalid object name/i.test(err.message || ""));

const pad = (n) => String(n).padStart(2, "0");
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const trim = (v, max) => String(v ?? "").trim().slice(0, max);

/** ?from=&to= → { from, to } (yyyy-MM-dd) หรือ { error } — ไม่ส่ง = 7 วันล่าสุด, ช่วงยาวสุด 31 วัน */
function parseRange(query) {
  let { from, to } = query;
  if (from && !DATE_RE.test(from)) return { error: "รูปแบบวันที่ต้องเป็น yyyy-MM-dd" };
  if (to && !DATE_RE.test(to)) return { error: "รูปแบบวันที่ต้องเป็น yyyy-MM-dd" };
  const today = new Date();
  to = to || isoDay(today);
  from = from || isoDay(new Date(new Date(`${to}T00:00:00`).getTime() - (DEFAULT_RANGE_DAYS - 1) * 86400000));
  const days = (new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000 + 1;
  if (!(days >= 1)) return { error: "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด" };
  if (days > MAX_RANGE_DAYS) return { error: `เลือกช่วงวันที่ได้ไม่เกิน ${MAX_RANGE_DAYS} วัน` };
  return { from, to };
}

/** ชื่อเรียก/หมายเหตุทั้งหมด (ตารางเล็ก) — ยังไม่มีตาราง = คืน ready:false ไม่ใช่ error */
async function readNotes(code) {
  const pool = await connectToDatabase();
  if (!pool) return { ready: false, notes: new Map() };
  try {
    const request = pool.request();
    let where = "";
    if (code) {
      request.input("code", sql.NVarChar(50), code);
      where = "WHERE n.ingdnt_code = @code";
    }
    const r = await request.query(`
      SELECT n.ingdnt_code, n.alias_name, n.remark, n.updated_by, FORMAT(n.updated_at, 'yyyy-MM-dd HH:mm:ss') AS updated_at
      FROM dbo.IngredientNote n WITH (NOLOCK) ${where}`);
    return { ready: true, notes: new Map(r.recordset.map((n) => [n.ingdnt_code, n])) };
  } catch (err) {
    if (isMissingTable(err)) return { ready: false, notes: new Map() };
    throw err;
  }
}

const noteFields = (n) => ({ alias_name: n?.alias_name ?? "", remark: n?.remark ?? "", updated_by: n?.updated_by ?? null, updated_at: n?.updated_at ?? null });

let listCache = { at: 0, rows: null };

async function readIngredientList(pool) {
  if (listCache.rows && Date.now() - listCache.at < LIST_CACHE_MS) return listCache.rows;
  const r = await pool.request().query(`
    SELECT ci.IngdntCode AS ingdntCode, MAX(ci.IngdntName) AS ingdntName, COUNT(DISTINCT ci.CodeId) AS productCount
    FROM TunaCodeIngredients ci
    WHERE ci.InActive = 0 AND ci.IngdntCode IS NOT NULL
    GROUP BY ci.IngdntCode
    ORDER BY ci.IngdntCode`);
  listCache = { at: Date.now(), rows: r.recordset };
  return r.recordset;
}

router.get("/fetchIngredients", async (req, res) => {
  try {
    const q = trim(req.query.q, 100).toLowerCase();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

    const pool = await connectToDatabaseWC();
    if (!pool) return res.status(503).json({ success: false, error: WC_DOWN });

    const [list, { ready, notes }] = await Promise.all([readIngredientList(pool), readNotes()]);
    const rows = list
      .map((i) => ({ ...i, ...noteFields(notes.get(String(i.ingdntCode).trim())) }))
      .filter((i) => !q || [i.ingdntCode, i.ingdntName, i.alias_name].some((v) => String(v ?? "").toLowerCase().includes(q)));

    res.json({ success: true, data: rows.slice(0, limit), total: rows.length, noteReady: ready });
  } catch (err) {
    console.error("[Route /ingredient/fetchIngredients] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/fetchIngredientDetail", async (req, res) => {
  try {
    const code = trim(req.query.code, 50);
    if (!code) return res.status(400).json({ success: false, error: "กรุณาระบุรหัสส่วนผสม" });
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, error: range.error });

    const pool = await connectToDatabaseWC();
    if (!pool) return res.status(503).json({ success: false, error: WC_DOWN });

    const wc = () => pool.request().input("code", sql.NVarChar(50), code);
    const [products, summary, usage, noteResult] = await Promise.all([
      wc().query(`
        SELECT TOP (${PRODUCT_ROWS}) c.Id AS codeId, c.ProductCode AS productCode, cu.Customer AS customer, cu.Destination AS market,
               ci.IngdntName AS ingdntName, ci.MixType AS mixType, ci.[Group] AS ingGroup, ci.ProcessType AS processType,
               ci.StdWt AS stdWt, ci.MinWt AS minWt, ci.MaxWt AS maxWt, ci.Percentage AS percentage
        FROM TunaCodeIngredients ci
        JOIN TunaCodes c ON c.Id = ci.CodeId
        LEFT JOIN TunaCustomers cu ON cu.Id = c.CustomerId
        WHERE ci.IngdntCode = @code AND ci.InActive = 0
        ORDER BY c.ProductCode, ci.MixType`),
      wc()
        .input("from", sql.Date, range.from)
        .input("to", sql.Date, range.to)
        .query(`
          SELECT COUNT(*) AS weighings, COUNT(DISTINCT v.WONo) AS workOrders, COUNT(DISTINCT v.BatchNo) AS batches,
                 SUM(TRY_CAST(v.NetWt AS FLOAT)) AS totalNetWt,
                 SUM(CASE WHEN TRY_CAST(v.NetWt AS FLOAT) < TRY_CAST(v.MinWt AS FLOAT) OR TRY_CAST(v.NetWt AS FLOAT) > TRY_CAST(v.MaxWt AS FLOAT) THEN 1 ELSE 0 END) AS outOfRange
          FROM dbo.vw_ngdnt_listNgdnt v
          WHERE v.ngdntCode = @code AND v.MixingTime >= @from AND v.MixingTime < DATEADD(day, 1, @to)`),
      wc()
        .input("from", sql.Date, range.from)
        .input("to", sql.Date, range.to)
        .query(`
          SELECT TOP (${USAGE_ROWS}) v.WONo AS woNo, v.BasketNumber AS basketNumber, v.BatchNo AS batchNo,
                 v.StdWt AS stdWt, v.MinWt AS minWt, v.MaxWt AS maxWt, v.NetWt AS netWt,
                 CONVERT(VARCHAR, v.MixingTime, 120) AS mixingTime
          FROM dbo.vw_ngdnt_listNgdnt v
          WHERE v.ngdntCode = @code AND v.MixingTime >= @from AND v.MixingTime < DATEADD(day, 1, @to)
          ORDER BY v.MixingTime DESC`),
      readNotes(code),
    ]);

    if (!products.recordset.length && !usage.recordset.length) {
      return res.status(404).json({ success: false, error: "ไม่พบส่วนผสมนี้" });
    }

    const s = summary.recordset[0] || {};
    res.json({
      success: true,
      data: {
        header: {
          ingdntCode: code,
          ingdntName: products.recordset[0]?.ingdntName ?? null,
          ...noteFields(noteResult.notes.get(code)),
          noteReady: noteResult.ready,
        },
        range,
        products: products.recordset,
        usage: {
          summary: { weighings: s.weighings ?? 0, workOrders: s.workOrders ?? 0, batches: s.batches ?? 0, totalNetWt: s.totalNetWt ?? 0, outOfRange: s.outOfRange ?? 0 },
          rows: usage.recordset,
          capped: usage.recordset.length >= USAGE_ROWS,
        },
      },
    });
  } catch (err) {
    console.error("[Route /ingredient/fetchIngredientDetail] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Batch ที่ใช้ผสมส่วนผสมนี้ในช่วงวันที่ (WC: vw_ngdnt_listNgdnt.BatchNo) → ผู้ขาย / วันรับ / วันหมดอายุ (WISEUP: PRD_Batch ← RMM_GuideLine ← SUP_Supplier)
// สองฐานอยู่คนละเซิร์ฟเวอร์ จึงดึง WC ก่อนแล้วเอา Batch ไปถาม WISEUP; WISEUP ใช้ไม่ได้ = ยังเห็น Batch จาก WC (found = false, wiseupError ตั้งค่า)
router.get("/fetchIngredientBatches", async (req, res) => {
  try {
    const code = trim(req.query.code, 50);
    if (!code) return res.status(400).json({ success: false, error: "กรุณาระบุรหัสส่วนผสม" });
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, error: range.error });

    const pool = await connectToDatabaseWC();
    if (!pool) return res.status(503).json({ success: false, error: WC_DOWN });

    const wc = await pool.request()
      .input("code", sql.NVarChar(50), code)
      .input("from", sql.Date, range.from)
      .input("to", sql.Date, range.to)
      .query(`
        SELECT TOP (${BATCH_ROWS}) v.BatchNo AS batchNo, COUNT(*) AS weighings, COUNT(DISTINCT v.WONo) AS workOrders,
               SUM(TRY_CAST(v.NetWt AS FLOAT)) AS totalNetWt,
               CONVERT(VARCHAR, MIN(v.MixingTime), 120) AS firstMix, CONVERT(VARCHAR, MAX(v.MixingTime), 120) AS lastMix
        FROM dbo.vw_ngdnt_listNgdnt v
        WHERE v.ngdntCode = @code AND v.BatchNo IS NOT NULL AND LTRIM(RTRIM(v.BatchNo)) <> ''
          AND v.MixingTime >= @from AND v.MixingTime < DATEADD(day, 1, @to)
        GROUP BY v.BatchNo
        ORDER BY MAX(v.MixingTime) DESC`);

    const batches = wc.recordset.map((b) => String(b.batchNo).trim());
    let intake = new Map();
    let wiseupError = null;
    if (batches.length) {
      try {
        intake = await fetchIntakeByBatch(batches, { withFeatures: false, withReceipts: false });
      } catch (err) {
        console.error("[Route /ingredient/fetchIngredientBatches] WISEUP error:", err);
        wiseupError = WISEUP_DOWN;
      }
    }
    // the same Batch can be spelled in another letter case in the two systems
    const byBatch = new Map([...intake.entries()].map(([k, v]) => [String(k).trim().toUpperCase(), v]));

    const rows = wc.recordset.map((b) => {
      const i = byBatch.get(String(b.batchNo).trim().toUpperCase());
      return {
        ...b,
        found: !!i,
        supplierCode: i?.supplier_code ?? null,
        supplierName: i?.supplier_name ?? null,
        receiveFirst: i?.receive_first ?? null,
        receiveQty: i?.receive_qty ?? null,
        receiveUnit: i?.receive_unit ?? null,
        batchDate: i?.batch_date ?? null,
        expirationDate: i?.expiration_date ?? null,
        matExternal: i?.mat_external ?? null,
      };
    });

    res.json({
      success: true,
      data: { range, rows, capped: rows.length >= BATCH_ROWS, summary: { batches: rows.length, found: rows.filter((r) => r.found).length }, wiseupError },
    });
  } catch (err) {
    console.error("[Route /ingredient/fetchIngredientBatches] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// lot ใน PFCM ที่ใช้ส่วนผสมนี้: HistoryIngredientWO (mapping_id + wo_no + basket_from..basket_to, กรอกตอนยืนยันบรรจุ — ยังไม่บังคับ จึงอาจมีน้อย)
// จับกับ WC: ตะกร้าของ WO นั้นที่มีส่วนผสมนี้ (vw_ngdnt_listNgdnt) ต้องอยู่ในช่วงตะกร้าที่กรอก
// Basket (ถึง) ว่าง = มีตะกร้าเดียว (ตามที่หน้าจอบอกพนักงาน); ไม่มีทั้งสองค่า = ทุกตะกร้าของ WO นั้น
router.get("/fetchIngredientLots", async (req, res) => {
  try {
    const code = trim(req.query.code, 50);
    if (!code) return res.status(400).json({ success: false, error: "กรุณาระบุรหัสส่วนผสม" });
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, error: range.error });

    const poolWC = await connectToDatabaseWC();
    if (!poolWC) return res.status(503).json({ success: false, error: WC_DOWN });
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });

    const [links, coverage] = await Promise.all([
      pool.request()
        .input("from", sql.Date, range.from)
        .input("to", sql.Date, range.to)
        .query(`
          SELECT TOP (${LOT_ROWS}) w.mapping_id AS mappingId, w.wo_no AS woNo, w.basket_from AS basketFrom, w.basket_to AS basketTo,
                 CONVERT(VARCHAR, w.created_at, 120) AS linkedAt,
                 p.doc_no AS docNo, p.code AS productCode, pr.mat AS mat, rm.mat_name AS matName,
                 rmm.tro_id AS troId, rmm.weight_RM AS weightRm,
                 htr.rmm_line_name AS lineName, CONVERT(VARCHAR, htr.sc_pack_date, 120) AS packDate
          FROM dbo.HistoryIngredientWO w WITH (NOLOCK)
          LEFT JOIN TrolleyRMMapping rmm WITH (NOLOCK) ON rmm.mapping_id = w.mapping_id
          LEFT JOIN ProdRawMat pr WITH (NOLOCK) ON rmm.tro_production_id = pr.prod_rm_id
          LEFT JOIN RawMat rm WITH (NOLOCK) ON pr.mat = rm.mat
          LEFT JOIN Production p WITH (NOLOCK) ON pr.prod_id = p.prod_id
          OUTER APPLY (SELECT TOP 1 h.rmm_line_name, h.sc_pack_date FROM History h WITH (NOLOCK) WHERE h.mapping_id = rmm.mapping_id ORDER BY h.hist_id DESC) htr
          WHERE w.created_at >= @from AND w.created_at < DATEADD(day, 1, @to)
          ORDER BY w.ingredient_wo_id DESC`),
      pool.request().query(`
        SELECT COUNT(*) AS totalLinks, COUNT(DISTINCT mapping_id) AS linkedLots, CONVERT(VARCHAR, MAX(created_at), 120) AS latest
        FROM dbo.HistoryIngredientWO WITH (NOLOCK)`),
    ]);

    // the same WO + basket range can be saved more than once for a lot
    const seen = new Set();
    const uniq = links.recordset.filter((l) => {
      const k = [l.mappingId, String(l.woNo).trim(), l.basketFrom, l.basketTo].join("|");
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const woList = [...new Set(uniq.map((l) => String(l.woNo ?? "").trim()).filter(Boolean))];
    const byWo = new Map(); // WO -> baskets of WC that hold this ingredient
    if (woList.length) {
      const wc = await poolWC.request()
        .input("code", sql.NVarChar(50), code)
        .input("wos", sql.NVarChar(sql.MAX), woList.join(","))
        .query(`
          SELECT v.WONo AS woNo, v.BasketNumber AS basketNumber, v.BatchNo AS batchNo, TRY_CAST(v.NetWt AS FLOAT) AS netWt
          FROM dbo.vw_ngdnt_listNgdnt v
          WHERE v.ngdntCode = @code AND v.WONo IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@wos, ','))`);
      for (const r of wc.recordset) {
        const k = String(r.woNo).trim();
        if (!byWo.has(k)) byWo.set(k, []);
        byWo.get(k).push(r);
      }
    }

    const rows = [];
    for (const l of uniq) {
      const baskets = byWo.get(String(l.woNo ?? "").trim());
      if (!baskets) continue; // this WO does not use the ingredient
      const from = l.basketFrom ?? null;
      const to = l.basketTo ?? from;
      const hit = baskets.filter((b) => (from === null && to === null) || (from !== null && Number(b.basketNumber) >= from && Number(b.basketNumber) <= to));
      if (!hit.length) continue; // the ingredient is in other baskets of the WO, not in this lot's
      rows.push({
        ...l,
        baskets: new Set(hit.map((b) => b.basketNumber)).size,
        netWt: hit.reduce((a, b) => a + (Number.isFinite(b.netWt) ? b.netWt : 0), 0),
        batches: [...new Set(hit.map((b) => String(b.batchNo ?? "").trim()).filter(Boolean))],
      });
    }

    const c = coverage.recordset[0] || {};
    res.json({
      success: true,
      data: {
        range,
        rows,
        capped: links.recordset.length >= LOT_ROWS,
        coverage: { totalLinks: c.totalLinks ?? 0, linkedLots: c.linkedLots ?? 0, latest: c.latest ?? null, scanned: uniq.length },
      },
    });
  } catch (err) {
    console.error("[Route /ingredient/fetchIngredientLots] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/update-ingredient-note", async (req, res) => {
  try {
    const code = trim(req.body?.ingdnt_code, 50);
    const alias = trim(req.body?.alias_name, 200);
    const remark = trim(req.body?.remark, 1000);
    if (!code) return res.status(400).json({ success: false, error: "กรุณาระบุรหัสส่วนผสม" });

    // รหัสต้องมีอยู่จริงใน WC — กันบันทึกลงรหัสที่พิมพ์ผิด
    const poolWC = await connectToDatabaseWC();
    if (!poolWC) return res.status(503).json({ success: false, error: WC_DOWN });
    const exists = await poolWC.request().input("code", sql.NVarChar(50), code)
      .query("SELECT TOP 1 1 AS ok FROM TunaCodeIngredients WHERE IngdntCode = @code");
    if (!exists.recordset.length) return res.status(404).json({ success: false, error: "ไม่พบส่วนผสมนี้" });

    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    const by = trim(req.user?.name || req.user?.username, 100) || null;

    await pool.request()
      .input("code", sql.NVarChar(50), code)
      .input("alias", sql.NVarChar(200), alias || null)
      .input("remark", sql.NVarChar(1000), remark || null)
      .input("by", sql.NVarChar(100), by)
      .query(`
        MERGE dbo.IngredientNote WITH (HOLDLOCK) AS t
        USING (SELECT @code AS ingdnt_code) AS s ON t.ingdnt_code = s.ingdnt_code
        WHEN MATCHED THEN UPDATE SET alias_name = @alias, remark = @remark, updated_by = @by, updated_at = GETDATE()
        WHEN NOT MATCHED THEN INSERT (ingdnt_code, alias_name, remark, updated_by) VALUES (@code, @alias, @remark, @by);`);

    const { notes } = await readNotes(code);
    res.json({ success: true, message: "บันทึกข้อมูลสำเร็จ", data: { ingdnt_code: code, ...noteFields(notes.get(code)) } });
  } catch (err) {
    if (isMissingTable(err)) return res.status(503).json({ success: false, error: NOTE_TABLE_MISSING });
    console.error("[Route /ingredient/update-ingredient-note] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
