// ─────────────────────────────────────────────────────────────────────────────
// SupplierRoutes.js — ผู้ขาย (Supplier) / การรับเข้า / ผลตรวจรับเข้า / ลูกค้า จากฐานข้อมูล WISEUP แบบอ่านอย่างเดียว
//   GET /api/supplier/fetchSuppliers?q=&from=&to=&limit=                 → ผู้ขายที่ส่งของในช่วงวันที่ + จำนวนใบรับ / วัตถุดิบ / PO
//   GET /api/supplier/fetchSupplierDetail?supplierId=&from=&to=          → หัวผู้ขาย + สรุปผลตัดสินคุณภาพ + วัตถุดิบที่ส่ง + หัวข้อตรวจที่ไม่ผ่านบ่อย
//   GET /api/supplier/fetchReceipts?supplierId=&from=&to=&material=      → ใบรับเข้ารายบรรทัด + ผลตัดสิน (Usage Decision)
//   GET /api/supplier/fetchInspectionResults?supplierId=&from=&to=&material= → ผลตรวจรับเข้ารายหัวข้อ
//   GET /api/supplier/fetchInspectionLot?lot=                            → หัว lot + จำนวนปล่อย/กัก + ผลตรวจทุกหัวข้อ
//   GET /api/supplier/fetchCustomers?q=&from=&to=                        → ลูกค้า: จำนวนสินค้า + ใบสั่งผลิตในช่วงวันที่
//
// สายความสัมพันธ์ใน WISEUP:
//   RMM_GuideLine (ใบรับสินค้า, MovementType 101)  ── SupplierID → SUP_Supplier
//        └─ InspectionBatch = MIP_QM01_InspectionLot.InspectionLot
//             ├─ MIP_QM01_InspectionPoint   (จำนวนปล่อย / กัก)
//             └─ MIP_QM01_InspectionFeature (ผลตรวจรายหัวข้อ) ── FeatureCode → MIP_QM25_InspectionField
//   ความหมายผลตัดสิน (UsageDecisionCode) อยู่ใน SAP_Catalog_Feature ชุด SetCode 'ZE%' (AR = A ยอมรับ / R ปฏิเสธ)
//   SUP_Supplier มีแค่รหัส + ชื่อ (ที่อยู่ / โทร / เลขภาษี ว่างทุกแถว) · RMM_ReceivedMaterialLine เป็นการโอนภายใน ไม่ใช้ที่นี่
// ใช้ connectToWiseup (DB_*_WISEUP ใน .env) จาก Tracebackwiseup.js — ทุก query เป็น SELECT + NOLOCK (ไม่ล็อกตารางของ MES)
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const sql = require("mssql");
const { connectToWiseup } = require("./Tracebackwiseup");

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SUPPLIER_RE = /^[A-Za-z0-9_-]{1,20}$/;
const MATERIAL_RE = /^[A-Za-z0-9_.-]{1,40}$/;
const LOT_RE = /^\d{1,20}$/;
const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 90;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const RECEIPT_ROWS = 1000;
const RESULT_ROWS = 2000;
const DB_DOWN = "ไม่สามารถเชื่อมต่อฐานข้อมูล WISEUP ได้";

const pad = (n) => String(n).padStart(2, "0");
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** ?from=&to= → { from, to } (yyyy-MM-dd) หรือ { error } — ไม่ส่ง = 90 วันล่าสุด, ช่วงยาวสุด 366 วัน */
function readRange(query) {
  const today = new Date();
  const to = String(query.to || "") || isoDay(today);
  const from = String(query.from || "") || isoDay(new Date(today.getTime() - DEFAULT_RANGE_DAYS * 86400000));
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return { error: "รูปแบบวันที่ต้องเป็น yyyy-MM-dd" };
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (!(days >= 0)) return { error: "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด" };
  if (days > MAX_RANGE_DAYS) return { error: `ช่วงวันที่ยาวได้ไม่เกิน ${MAX_RANGE_DAYS} วัน` };
  return { from, to };
}

/** คำค้นของ LIKE — กันอักขระพิเศษ % _ [ ไม่ให้เป็น wildcard */
const likeText = (q) => `%${q.replace(/[[%_]/g, (c) => `[${c}]`)}%`;

const getPool = async (res) => {
  try {
    return await connectToWiseup();
  } catch (err) {
    console.error("❌ [SupplierRoutes] WISEUP connect error:", err.message);
    res.status(503).json({ success: false, error: DB_DOWN });
    return null;
  }
};

// ผลตัดสินคุณภาพของ lot: รหัส + คำอธิบาย + A/R จากแคตตาล็อก (รหัสเดียวกันมีหลายชุด ZE00000x — เอาชุดแรก)
const UD_APPLY = `
  OUTER APPLY (SELECT TOP 1 c.DescriptionEN, c.AR FROM SAP_Catalog_Feature c WITH (NOLOCK)
               WHERE c.Code = l.UsageDecisionCode AND c.SetCode LIKE 'ZE%' ORDER BY c.SetCode) ud`;

// ผลตรวจรายหัวข้อ: ข้อความของค่าที่เลือกจากแคตตาล็อก (SAP ก่อน แล้ว MIP) + A/R
const FEATURE_JOINS = `
  LEFT JOIN MIP_QM25_InspectionField qf WITH (NOLOCK) ON qf.Code = f.FeatureCode
  LEFT JOIN SAP_Catalog_Feature sc WITH (NOLOCK) ON sc.SetCode = f.FeatureCatalogSet AND sc.Code = f.FeatureCatalogValue
  LEFT JOIN MIP_Catalog_Feature mc WITH (NOLOCK) ON mc.SetCode = f.FeatureCatalogSet AND mc.Code = f.FeatureCatalogValue`;

// ใบรับของผู้ขาย 1 ราย ในช่วงวันที่ (ใช้ร่วมกันหลาย endpoint)
const GR_WHERE = `
  g.SupplierID = @supplierId AND g.MovementType = '101'
  AND g.CreatedDate >= @from AND g.CreatedDate < DATEADD(DAY, 1, @to)`;

// ───────────────────────────────────────────── รายชื่อผู้ขาย
router.get("/fetchSuppliers", async (req, res) => {
  try {
    const range = readRange(req.query);
    if (range.error) return res.status(400).json({ success: false, error: range.error });
    const q = String(req.query.q || "").trim().slice(0, 100);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

    const pool = await getPool(res);
    if (!pool) return;

    const request = pool.request()
      .input("from", sql.Date, range.from)
      .input("to", sql.Date, range.to)
      .input("limit", sql.Int, limit);
    let qWhere = "";
    if (q) {
      request.input("q", sql.NVarChar(210), likeText(q));
      qWhere = "AND (g.SupplierID LIKE @q OR g.SupplierName LIKE @q OR s.Name LIKE @q)";
    }

    const result = await request.query(`
      SELECT TOP (@limit)
        g.SupplierID                              AS supplierId,
        COALESCE(MAX(s.Name), MAX(g.SupplierName)) AS name,
        COUNT(*)                                  AS grLines,
        COUNT(DISTINCT g.GuideNumber)             AS grDocs,
        COUNT(DISTINCT g.ExternalCode)            AS materials,
        COUNT(DISTINCT NULLIF(g.PONumber, ''))    AS purchaseOrders,
        MIN(g.CreatedDate)                        AS firstReceipt,
        MAX(g.CreatedDate)                        AS lastReceipt
      FROM RMM_GuideLine g WITH (NOLOCK)
      LEFT JOIN SUP_Supplier s WITH (NOLOCK) ON s.SupplierID = g.SupplierID
      WHERE g.MovementType = '101' AND NULLIF(g.SupplierID, '') IS NOT NULL
        AND g.CreatedDate >= @from AND g.CreatedDate < DATEADD(DAY, 1, @to)
        ${qWhere}
      GROUP BY g.SupplierID
      ORDER BY COUNT(*) DESC`);

    res.json({ success: true, data: result.recordset, range });
  } catch (err) {
    console.error("[Route /supplier/fetchSuppliers] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ───────────────────────────────────────────── หัวผู้ขาย + สรุป + วัตถุดิบ + หัวข้อที่ไม่ผ่านบ่อย
router.get("/fetchSupplierDetail", async (req, res) => {
  try {
    const supplierId = String(req.query.supplierId || "").trim();
    if (!SUPPLIER_RE.test(supplierId)) return res.status(400).json({ success: false, error: "รหัสผู้ขายไม่ถูกต้อง" });
    const range = readRange(req.query);
    if (range.error) return res.status(400).json({ success: false, error: range.error });

    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request()
      .input("supplierId", sql.VarChar(20), supplierId)
      .input("from", sql.Date, range.from)
      .input("to", sql.Date, range.to)
      .query(`
        SELECT s.SupplierID AS supplierId, s.Name AS name, s.ComercialName AS commercialName,
               s.Address AS address, s.Local AS city, s.PostalCode AS postalCode,
               s.Phone1 AS phone1, s.Phone2 AS phone2, s.FiscalNumber AS fiscalNumber, s.VatRegNumber AS vatRegNumber,
               s.Type AS type, s.CreatedDate AS createdDate, s.ModifiedDate AS modifiedDate,
               (SELECT TOP 1 g.SupplierName FROM RMM_GuideLine g WITH (NOLOCK)
                WHERE g.SupplierID = @supplierId AND g.SupplierName <> '' ORDER BY g.CreatedDate DESC) AS receiptName
        FROM (SELECT @supplierId AS id) x
        LEFT JOIN SUP_Supplier s WITH (NOLOCK) ON s.SupplierID = x.id;

        SELECT COUNT(*) AS grLines, COUNT(DISTINCT g.GuideNumber) AS grDocs, COUNT(DISTINCT g.ExternalCode) AS materials,
               COUNT(DISTINCT NULLIF(g.PONumber, '')) AS purchaseOrders, COUNT(DISTINCT g.Batch) AS batches,
               MIN(g.CreatedDate) AS firstReceipt, MAX(g.CreatedDate) AS lastReceipt
        FROM RMM_GuideLine g WITH (NOLOCK)
        WHERE ${GR_WHERE};

        WITH lots AS (
          SELECT DISTINCT l.InspectionLotID, l.UsageDecisionCode
          FROM RMM_GuideLine g WITH (NOLOCK)
          JOIN MIP_QM01_InspectionLot l WITH (NOLOCK) ON l.InspectionLot = g.InspectionBatch
          WHERE ${GR_WHERE}
        )
        SELECT l.UsageDecisionCode AS code, MAX(ud.DescriptionEN) AS description, MAX(ud.AR) AS ar, COUNT(*) AS lots
        FROM lots l ${UD_APPLY}
        GROUP BY l.UsageDecisionCode
        ORDER BY COUNT(*) DESC;

        SELECT g.ExternalCode AS materialCode, MAX(r.DescriptionEN) AS descriptionEN, MAX(r.DescriptionTH) AS descriptionTH,
               MAX(m.MaterialType) AS materialType, MAX(mg.Description) AS materialGroup, g.Unit AS unit,
               COUNT(*) AS receipts, SUM(g.Quantity) AS totalQty, COUNT(DISTINCT g.Batch) AS batches,
               MIN(g.CreatedDate) AS firstReceipt, MAX(g.CreatedDate) AS lastReceipt
        FROM RMM_GuideLine g WITH (NOLOCK)
        LEFT JOIN PRD_RawMaterial r    WITH (NOLOCK) ON r.ExternalCode = g.ExternalCode
        LEFT JOIN SAP_MaterialMaster m WITH (NOLOCK) ON m.MaterialCode = g.ExternalCode
        LEFT JOIN SAP_MaterialGroup mg WITH (NOLOCK) ON mg.ID = m.MaterialGroup
        WHERE ${GR_WHERE}
        GROUP BY g.ExternalCode, g.Unit
        ORDER BY COUNT(*) DESC;

        SELECT TOP 30 f.FeatureCode AS featureCode, MAX(qf.DescriptionEN) AS characteristic, MAX(qf.DescriptionTH) AS characteristicTH,
               COUNT(*) AS results, SUM(CASE WHEN COALESCE(sc.AR, mc.AR) = 'R' THEN 1 ELSE 0 END) AS rejects
        FROM RMM_GuideLine g WITH (NOLOCK)
        JOIN MIP_QM01_InspectionLot l     WITH (NOLOCK) ON l.InspectionLot = g.InspectionBatch
        JOIN MIP_QM01_InspectionFeature f WITH (NOLOCK) ON f.InspectionLotID = l.InspectionLotID
        ${FEATURE_JOINS}
        WHERE ${GR_WHERE}
        GROUP BY f.FeatureCode
        ORDER BY SUM(CASE WHEN COALESCE(sc.AR, mc.AR) = 'R' THEN 1 ELSE 0 END) DESC, COUNT(*) DESC;`);

    const [header, stats, decisions, materials, features] = result.recordsets;
    res.json({
      success: true,
      data: { header: header[0] || null, stats: stats[0] || null, decisions, materials, features },
      range,
    });
  } catch (err) {
    console.error("[Route /supplier/fetchSupplierDetail] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** supplierId + ช่วงวันที่ + วัตถุดิบ (ไม่บังคับ) ของ endpoint รายบรรทัด */
function readSupplierScope(query) {
  const supplierId = String(query.supplierId || "").trim();
  if (!SUPPLIER_RE.test(supplierId)) return { error: "รหัสผู้ขายไม่ถูกต้อง" };
  const material = String(query.material || "").trim();
  if (material && !MATERIAL_RE.test(material)) return { error: "รหัสวัตถุดิบไม่ถูกต้อง" };
  const range = readRange(query);
  if (range.error) return { error: range.error };
  return { supplierId, material, ...range };
}

const scopeRequest = (pool, s) => pool.request()
  .input("supplierId", sql.VarChar(20), s.supplierId)
  .input("from", sql.Date, s.from)
  .input("to", sql.Date, s.to)
  .input("material", sql.VarChar(40), s.material);

// ───────────────────────────────────────────── ใบรับเข้ารายบรรทัด + ผลตัดสิน
router.get("/fetchReceipts", async (req, res) => {
  try {
    const scope = readSupplierScope(req.query);
    if (scope.error) return res.status(400).json({ success: false, error: scope.error });
    const pool = await getPool(res);
    if (!pool) return;

    const result = await scopeRequest(pool, scope).input("rows", sql.Int, RECEIPT_ROWS).query(`
      SELECT TOP (@rows)
        g.CreatedDate AS receivedAt, g.GuideYear AS guideYear, g.GuideNumber AS grDocument, g.GuideLine AS grLine,
        g.PONumber AS poNumber, g.POLine AS poLine, g.ExternalCode AS materialCode, r.DescriptionEN AS materialName,
        g.Batch AS batch, g.VendorBatch AS vendorBatch, g.Quantity AS quantity, g.Unit AS unit,
        g.ExpirationDate AS expirationDate, g.Warehouse AS warehouse, g.TruckNumber AS truckNumber,
        g.InspectionBatch AS inspectionLot, l.UsageDecisionCode AS udCode, ud.DescriptionEN AS udDescription, ud.AR AS udAR,
        l.Closed AS udDate
      FROM RMM_GuideLine g WITH (NOLOCK)
      LEFT JOIN PRD_RawMaterial r WITH (NOLOCK)        ON r.ExternalCode = g.ExternalCode
      LEFT JOIN MIP_QM01_InspectionLot l WITH (NOLOCK) ON l.InspectionLot = g.InspectionBatch
      ${UD_APPLY}
      WHERE ${GR_WHERE} AND (@material = '' OR g.ExternalCode = @material)
      ORDER BY g.CreatedDate DESC, g.GuideNumber DESC, g.GuideLine`);

    res.json({ success: true, data: result.recordset, limit: RECEIPT_ROWS });
  } catch (err) {
    console.error("[Route /supplier/fetchReceipts] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ───────────────────────────────────────────── ผลตรวจรับเข้ารายหัวข้อ
router.get("/fetchInspectionResults", async (req, res) => {
  try {
    const scope = readSupplierScope(req.query);
    if (scope.error) return res.status(400).json({ success: false, error: scope.error });
    const pool = await getPool(res);
    if (!pool) return;

    const result = await scopeRequest(pool, scope).input("rows", sql.Int, RESULT_ROWS).query(`
      SELECT TOP (@rows)
        l.InspectionLot AS inspectionLot, g.CreatedDate AS receivedAt, l.MaterialNumber AS materialCode,
        r.DescriptionEN AS materialName, l.Batch AS batch, f.WorkCenterCode AS workCenter,
        f.FeatureCode AS featureCode, qf.DescriptionEN AS characteristic, qf.DescriptionTH AS characteristicTH, qf.Unit AS unit,
        qf.LowerLimitValue AS lowerLimit, qf.TargetValue AS target, qf.UpperLimitValue AS upperLimit,
        f.FeatureSampleSize AS sampleSize, f.FeatureMeanValue AS measuredValue,
        COALESCE(sc.DescriptionEN, mc.DescriptionEN) AS resultText, COALESCE(sc.AR, mc.AR) AS resultAR,
        f.Obs AS remark, l.UsageDecisionCode AS udCode
      FROM RMM_GuideLine g WITH (NOLOCK)
      JOIN MIP_QM01_InspectionLot l     WITH (NOLOCK) ON l.InspectionLot = g.InspectionBatch
      JOIN MIP_QM01_InspectionFeature f WITH (NOLOCK) ON f.InspectionLotID = l.InspectionLotID
      ${FEATURE_JOINS}
      LEFT JOIN PRD_RawMaterial r WITH (NOLOCK) ON r.ExternalCode = l.MaterialNumber
      WHERE ${GR_WHERE} AND (@material = '' OR g.ExternalCode = @material)
      ORDER BY g.CreatedDate DESC, l.InspectionLot, f.WorkCenterOrder, f.FeatureOrder`);

    res.json({ success: true, data: result.recordset, limit: RESULT_ROWS });
  } catch (err) {
    console.error("[Route /supplier/fetchInspectionResults] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ───────────────────────────────────────────── 1 Inspection Lot
router.get("/fetchInspectionLot", async (req, res) => {
  try {
    const lot = String(req.query.lot || "").trim();
    if (!LOT_RE.test(lot)) return res.status(400).json({ success: false, error: "เลข Inspection Lot ไม่ถูกต้อง" });
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request().input("lot", sql.VarChar(20), lot).query(`
      DECLARE @id int = (SELECT TOP 1 InspectionLotID FROM MIP_QM01_InspectionLot WITH (NOLOCK) WHERE InspectionLot = @lot);

      SELECT l.InspectionLot AS inspectionLot, l.MaterialNumber AS materialCode, r.DescriptionEN AS materialName,
             l.Batch AS batch, l.SupplierID AS supplierId, s.Name AS supplierName, l.PONumber AS poNumber, l.POLine AS poLine,
             l.GuideReceivedDate AS receivedDate, l.MIQuantity AS quantity, l.MIQuantityUnit AS unit,
             l.UsageDecisionCode AS udCode, ud.DescriptionEN AS udDescription, ud.AR AS udAR, l.Closed AS udDate,
             l.CreatedDate AS createdDate, l.Obs AS remark
      FROM MIP_QM01_InspectionLot l WITH (NOLOCK)
      LEFT JOIN SUP_Supplier s    WITH (NOLOCK) ON s.SupplierID = l.SupplierID
      LEFT JOIN PRD_RawMaterial r WITH (NOLOCK) ON r.ExternalCode = l.MaterialNumber
      ${UD_APPLY}
      WHERE l.InspectionLotID = @id;

      SELECT p.InspectionLotItem AS item, p.Reference AS reference, p.UnrestrictedQuantity AS releasedQty,
             p.BlockedQuantity AS blockedQty, p.Unit AS unit, p.InspectionPlanCode AS inspectionPlan, p.Closed AS closed, p.Obs AS remark
      FROM MIP_QM01_InspectionPoint p WITH (NOLOCK)
      WHERE p.InspectionLotID = @id
      ORDER BY p.InspectionLotItem;

      SELECT f.WorkCenterCode AS workCenter, f.FeatureCode AS featureCode, qf.DescriptionEN AS characteristic,
             qf.DescriptionTH AS characteristicTH, qf.Unit AS unit, qf.LowerLimitValue AS lowerLimit, qf.TargetValue AS target,
             qf.UpperLimitValue AS upperLimit, f.FeatureSampleSize AS sampleSize, f.FeatureMeanValue AS measuredValue,
             COALESCE(sc.DescriptionEN, mc.DescriptionEN) AS resultText, COALESCE(sc.AR, mc.AR) AS resultAR, f.Obs AS remark
      FROM MIP_QM01_InspectionFeature f WITH (NOLOCK)
      ${FEATURE_JOINS}
      WHERE f.InspectionLotID = @id
      ORDER BY f.WorkCenterOrder, f.FeatureOrder;`);

    const [header, points, features] = result.recordsets;
    if (!header.length) return res.status(404).json({ success: false, error: "ไม่พบ Inspection Lot นี้" });
    res.json({ success: true, data: { header: header[0], points, features } });
  } catch (err) {
    console.error("[Route /supplier/fetchInspectionLot] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ───────────────────────────────────────────── ลูกค้า: สินค้า + ใบสั่งผลิตในช่วงวันที่
router.get("/fetchCustomers", async (req, res) => {
  try {
    const range = readRange(req.query);
    if (range.error) return res.status(400).json({ success: false, error: range.error });
    const q = String(req.query.q || "").trim().slice(0, 100);

    const pool = await getPool(res);
    if (!pool) return;

    const request = pool.request().input("from", sql.Date, range.from).input("to", sql.Date, range.to);
    let qWhere = "";
    if (q) {
      request.input("q", sql.NVarChar(210), likeText(q));
      qWhere = "WHERE (c.ClientID LIKE @q OR c.Description LIKE @q OR c.Abbreviation LIKE @q)";
    }

    const result = await request.query(`
      WITH po AS (
        SELECT pl.ProductExternalCode, pl.SapOrderNumber, h.ProductionDate
        FROM PRD_ProductionLine pl WITH (NOLOCK)
        JOIN PRD_ProductionHeader h WITH (NOLOCK) ON h.ProductionHeaderID = pl.ProductionHeaderID
        WHERE h.ProductionDate >= @from AND h.ProductionDate < DATEADD(DAY, 1, @to) AND ISNULL(pl.SapDeleted, 0) = 0
      )
      SELECT c.ClientID AS clientId, c.Description AS name, c.Abbreviation AS abbreviation, c.CountryCode AS countryCode,
             COUNT(DISTINCT ph.ExternalCode) AS products,
             COUNT(DISTINCT po.SapOrderNumber) AS productionOrders,
             COUNT(DISTINCT po.ProductExternalCode) AS productsProduced,
             MAX(po.ProductionDate) AS lastProductionDate
      FROM CRM_Client c WITH (NOLOCK)
      LEFT JOIN PRD_ProductHeader ph WITH (NOLOCK) ON ph.ClientID = c.ClientID
      LEFT JOIN po ON po.ProductExternalCode = ph.ExternalCode
      ${qWhere}
      GROUP BY c.ClientID, c.Description, c.Abbreviation, c.CountryCode
      ORDER BY COUNT(DISTINCT po.SapOrderNumber) DESC, c.ClientID`);

    res.json({ success: true, data: result.recordset, range });
  } catch (err) {
    console.error("[Route /supplier/fetchCustomers] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
