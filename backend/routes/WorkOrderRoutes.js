// ─────────────────────────────────────────────────────────────────────────────
// WorkOrderRoutes.js — รายละเอียดใบสั่งผลิต (WOId) จากฐานข้อมูล IV.TUNA (WC) แบบอ่านอย่างเดียว
//   GET /api/wo/fetchWorkOrders?q=&from=&to=&limit=        → ค้นหาใบสั่งผลิต (WONo / สินค้า / ลูกค้า / วันที่)
//   GET /api/wo/fetchWorkOrderDetail?woId=                  → ทุกอย่างของ WO: หัว, สูตร, ตะกร้า x batch, สารละลาย, น้ำหนัก, ตรวจ, log
//   GET /api/wo/fetchWorkOrderBaskets?woId=&from=&count=&mixType=  → รายตะกร้า x วัตถุดิบ x batch (แบ่งหน้า)
//
// สายความสัมพันธ์จริง (ตาม foreign key ของ DB) — "WOId" ในแต่ละตารางไม่ใช่ตัวเดียวกัน อย่าสลับ:
//   ProductionWorkOrders.Id  (= woId ที่หน้าจอใช้)
//     └─ TunaWOes.WOId            → TunaWOes.Id = TunaWOId
//          └─ TunaPackingWOes.WOId = TunaWOes.Id   → TunaPackingWOes.Id = PackId
//   ลูกของ TunaWOes (ใช้ TunaWOId): Hours, TunaISPs, InspectionSpecials, Solutions.WOId, Toppings.WOId
//   ลูกของ TunaPackingWOes (ใช้ PackId): Baskets, Ingredients, BatchSizes, MixSequences, FWs, NWs, ISP*, WO_Log, Pallets, Targets
// สองชุดไอดีทับกัน (เลขช่วงเดียวกัน) — ใช้ไอดีผิดชุดจะได้ข้อมูลของใบสั่งอื่นโดยไม่มี error
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const sql = require("mssql");
const { connectToDatabaseWC } = require("../database/db");

const router = express.Router();

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const DEFAULT_BASKET_COUNT = 100;
const MAX_BASKET_COUNT = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ต้นของทุก batch ที่อ่านข้อมูลลูก: หา TunaWOId / PackId ของ WO จากไอดีตัวหลัก
const KEYS_SQL = `
  DECLARE @Tuna TABLE (TunaWOId int PRIMARY KEY);
  INSERT @Tuna SELECT Id FROM TunaWOes WHERE WOId = @woId;
  DECLARE @Pack TABLE (PackId int PRIMARY KEY, TunaWOId int);
  INSERT @Pack SELECT p.Id, p.WOId FROM TunaPackingWOes p WHERE p.WOId IN (SELECT TunaWOId FROM @Tuna);`;

// ลำดับผลลัพธ์ต้องตรงกับ DETAIL_KEYS ด้านล่าง
const DETAIL_SQL = `${KEYS_SQL}

  SELECT x.Section AS section, x.[Rows] AS [rows] FROM (
    SELECT 'baskets' Section, COUNT(*) [Rows] FROM TunaPackingIngredientBaskets WHERE WOId IN (SELECT PackId FROM @Pack) UNION ALL
    SELECT 'ingredients', COUNT(*) FROM TunaPackingIngredients WHERE WOId IN (SELECT PackId FROM @Pack) UNION ALL
    SELECT 'mixSequences', COUNT(*) FROM TunaPackingIngredientMixSequences WHERE WOId IN (SELECT PackId FROM @Pack) UNION ALL
    SELECT 'solutions', COUNT(*) FROM TunaPackingSolutions WHERE WOId IN (SELECT TunaWOId FROM @Tuna) UNION ALL
    SELECT 'toppings', COUNT(*) FROM TunaPackingToppings WHERE WOId IN (SELECT TunaWOId FROM @Tuna) UNION ALL
    SELECT 'hours', COUNT(*) FROM TunaPackingHours WHERE WOId IN (SELECT TunaWOId FROM @Tuna) UNION ALL
    SELECT 'fwChecks', COUNT(*) FROM TunaPackingFWs WHERE WOId IN (SELECT PackId FROM @Pack) UNION ALL
    SELECT 'nwChecks', COUNT(*) FROM TunaPackingNWs WHERE WOId IN (SELECT PackId FROM @Pack) UNION ALL
    SELECT 'inspections', COUNT(*) FROM TunaPackingISPSpecials WHERE WOId IN (SELECT PackId FROM @Pack) UNION ALL
    SELECT 'log', COUNT(*) FROM TunaPackingWO_Log WHERE WOId IN (SELECT PackId FROM @Pack) UNION ALL
    SELECT 'pallets', COUNT(*) FROM TunaPackingPallets WHERE WOId IN (SELECT PackId FROM @Pack) UNION ALL
    SELECT 'rejects', COUNT(*) FROM TunaPackingRejects WHERE WOId IN (SELECT PackId FROM @Pack)
  ) x;

  SELECT pw.Id AS woId, pw.WONo AS woNo, pw.[Date] AS prodDate, pw.Shift AS shift, pw.ProductCode AS productCode,
         w.Id AS tunaWoId, w.PONo AS poNo, w.Number AS woNumber, w.Quantity AS planQty, bu.BU AS bu,
         cu.Customer AS customer, cu.Destination AS market, pk.Package AS package, pk.PackageName AS packageName,
         c.IngredientFormulaRevision AS revision, c.Id AS codeId,
         p.Id AS packId, p.WONo AS packWoNo, p.LineId AS lineId, ln.[LineNo] AS [lineNo], ln.Description AS lineDesc,
         p.Status AS status, p.MaterialCode AS materialCode, p.SubCode AS subCode,
         p.TargetNW AS targetNW, p.TargetFW AS targetFW, p.LabelNW AS labelNW,
         p.CreateDate AS createDate, p.FinishLastTime AS finishLastTime
  FROM ProductionWorkOrders pw
  LEFT JOIN TunaWOes w            ON w.WOId = pw.Id
  LEFT JOIN TunaBUs bu            ON bu.Id = w.BUId
  LEFT JOIN TunaCodes c           ON c.Id = w.CodeId
  LEFT JOIN TunaCustomers cu      ON cu.Id = c.CustomerId
  LEFT JOIN TunaPackages pk       ON pk.Id = c.PackageId
  LEFT JOIN TunaPackingWOes p     ON p.WOId = w.Id
  LEFT JOIN TunaBUPackingLines ln ON ln.Id = p.LineId
  WHERE pw.Id = @woId;

  SELECT bs.MixType AS mixType, bs.BatchSize AS batchSize, bs.BatchCount AS batchCount, bs.IsBaseWater AS isBaseWater, bs.Description AS description
  FROM TunaPackingIngredientBatchSizes bs
  WHERE bs.WOId IN (SELECT PackId FROM @Pack) ORDER BY bs.MixType;

  SELECT i.MixType AS mixType, i.[Index] AS seq, i.IngdntCode AS ingdntCode, i.IngdntName AS ingdntName,
         i.StdWt AS stdWt, i.MinWt AS minWt, i.MaxWt AS maxWt, i.Percentage AS percentage, bs.BatchSize AS batchSize
  FROM TunaPackingIngredients i
  LEFT JOIN TunaPackingIngredientBatchSizes bs ON bs.Id = i.BatchSizeId
  WHERE i.WOId IN (SELECT PackId FROM @Pack) ORDER BY i.MixType, i.[Index];

  SELECT m.MixType AS mixType, m.ProcessType AS processType, m.[Index] AS seq, m.Sequence AS sequence, m.SubSequence AS subSequence,
         m.SequenceDescription AS description, m.AlternateMaterialName AS alternateMaterialName
  FROM TunaPackingIngredientMixSequences m
  WHERE m.WOId IN (SELECT PackId FROM @Pack)
  ORDER BY m.MixType, m.ProcessType, m.[Index], m.Sequence, m.SubSequence;

  SELECT b.MixType AS mixType, b.BasketState AS basketState, COUNT(*) AS baskets, MIN(b.BasketNumber) AS firstNo, MAX(b.BasketNumber) AS lastNo,
         MIN(b.MixingTime) AS firstMixStart, MAX(b.MixingEndTime) AS lastMixEnd,
         MIN(b.PackingTime) AS firstPackStart, MAX(b.PackingEndTime) AS lastPackEnd
  FROM TunaPackingIngredientBaskets b
  WHERE b.WOId IN (SELECT PackId FROM @Pack)
  GROUP BY b.MixType, b.BasketState ORDER BY b.MixType, b.BasketState;

  SELECT i.MixType AS mixType, i.IngdntCode AS ingdntCode, i.IngdntName AS ingdntName, bt.BatchNo AS batchNo,
         rm.MaterialCode AS rawMatCode, rm.BatchNo AS rawMatBatchNo,
         COUNT(DISTINCT b.Id) AS baskets, SUM(a.NetWt) AS totalNetWt, MIN(a.MixingTime) AS firstMix, MAX(a.MixingTime) AS lastMix
  FROM TunaPackingIngredientBaskets b
  JOIN TunaPackingIngredientActuals a            ON a.BasketId = b.Id
  JOIN TunaPackingIngredients i                  ON i.Id = a.IngdntId
  LEFT JOIN TunaPackingIngredientBatches bt      ON bt.Id = a.BatchId
  LEFT JOIN TunaPackingIngredientRawMaterials rm ON rm.Id = a.RawMatId
  WHERE b.WOId IN (SELECT PackId FROM @Pack)
  GROUP BY i.MixType, i.IngdntCode, i.IngdntName, bt.BatchNo, rm.MaterialCode, rm.BatchNo
  ORDER BY i.MixType, i.IngdntCode, bt.BatchNo;

  SELECT 'solution' AS kind, s.SolutionName AS name, ps.Quantity AS quantity, ps.MinVal AS minVal, ps.MaxVal AS maxVal, ps.IsNotUse AS isNotUse, st.Target AS target
  FROM TunaPackingSolutions ps
  LEFT JOIN TunaSolutions s ON s.Id = ps.SlnId
  LEFT JOIN TunaPackingSolutionTargets st ON st.SlnId = ps.SlnId AND st.WOId IN (SELECT PackId FROM @Pack)
  WHERE ps.WOId IN (SELECT TunaWOId FROM @Tuna)
  UNION ALL
  SELECT 'topping', t.ToppingName, pt.Quantity, pt.MinVal, pt.MaxVal, pt.IsNotUse, tt.Target
  FROM TunaPackingToppings pt
  LEFT JOIN TunaToppings t ON t.Id = pt.TopId
  LEFT JOIN TunaPackingToppingTargets tt ON tt.TopId = pt.TopId AND tt.WOId IN (SELECT PackId FROM @Pack)
  WHERE pt.WOId IN (SELECT TunaWOId FROM @Tuna);

  SELECT h.HourNo AS hourNo, h.HourStart AS hourStart, h.HourFinish AS hourFinish
  FROM TunaPackingHours h WHERE h.WOId IN (SELECT TunaWOId FROM @Tuna) ORDER BY h.HourNo;

  SELECT 'FW' AS kind, f.[Round] AS [round], COUNT(*) AS n, MIN(f.ActualQty) AS minW, MAX(f.ActualQty) AS maxW,
         AVG(f.ActualQty) AS avgW, MIN(f.CreateDate) AS firstAt, MAX(f.CreateDate) AS lastAt
  FROM TunaPackingFWs f WHERE f.WOId IN (SELECT PackId FROM @Pack) AND f.IsDeleted = 0 GROUP BY f.[Round]
  UNION ALL
  SELECT 'NW', n.[Round], COUNT(*), MIN(n.ActualQty), MAX(n.ActualQty), AVG(n.ActualQty), MIN(n.CreateDate), MAX(n.CreateDate)
  FROM TunaPackingNWs n WHERE n.WOId IN (SELECT PackId FROM @Pack) AND n.IsDeleted = 0 GROUP BY n.[Round]
  ORDER BY kind, [round];

  SELECT 'inspector' AS kind, CAST(NULL AS int) AS [round], i.Inspector AS item,
         CAST(NULL AS nvarchar(200)) AS input, CAST(NULL AS nvarchar(200)) AS result
  FROM TunaISPs i WHERE i.WOId IN (SELECT TunaWOId FROM @Tuna)
  UNION ALL
  SELECT 'special', s.[Round], CONCAT(sp.Product, ' ', sp.Inspection, ' ', sp.Description), s.InputText, s.ResultText
  FROM TunaPackingISPSpecials s
  LEFT JOIN TunaPackingInspectionSpecials sp ON sp.Id = s.SpecialId
  WHERE s.WOId IN (SELECT PackId FROM @Pack);

  SELECT l.LogTime AS logTime, u.Name AS [user], l.Description AS description
  FROM TunaPackingWO_Log l LEFT JOIN __Auth_User u ON u.Id = l.UserId
  WHERE l.WOId IN (SELECT PackId FROM @Pack) ORDER BY l.LogTime;`;

const DETAIL_KEYS = [
  "overview", "header", "batchSizes", "formula", "mixSequences", "basketSummary",
  "ingredientBatches", "solutionsToppings", "hours", "weights", "inspections", "log",
];

router.get("/fetchWorkOrders", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 100);
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      return res.status(400).json({ success: false, error: "รูปแบบวันที่ต้องเป็น yyyy-MM-dd" });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

    const pool = await connectToDatabaseWC();
    if (!pool) return res.status(503).json({ success: false, error: "ไม่สามารถเชื่อมต่อฐานข้อมูลสูตรได้" });

    const request = pool.request().input("limit", sql.Int, limit);
    const where = [];
    if (q) {
      request.input("q", sql.NVarChar(200), `%${q}%`);
      where.push("(pw.WONo LIKE @q OR p.WONo LIKE @q OR pw.ProductCode LIKE @q OR cu.Customer LIKE @q OR cu.Destination LIKE @q)");
    }
    if (from) { request.input("from", sql.Date, from); where.push("pw.[Date] >= @from"); }
    if (to) { request.input("to", sql.Date, to); where.push("pw.[Date] < DATEADD(DAY, 1, @to)"); }

    const result = await request.query(`
      SELECT TOP (@limit) pw.Id AS woId, pw.WONo AS woNo, pw.[Date] AS prodDate, pw.Shift AS shift, pw.ProductCode AS productCode,
             cu.Customer AS customer, cu.Destination AS market, ln.[LineNo] AS [lineNo], p.WONo AS packWoNo
      FROM ProductionWorkOrders pw
      JOIN TunaWOes w                 ON w.WOId = pw.Id
      LEFT JOIN TunaCodes c           ON c.Id = w.CodeId
      LEFT JOIN TunaCustomers cu      ON cu.Id = c.CustomerId
      LEFT JOIN TunaPackingWOes p     ON p.WOId = w.Id
      LEFT JOIN TunaBUPackingLines ln ON ln.Id = p.LineId
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY pw.[Date] DESC, pw.Id DESC`);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("[Route /wo/fetchWorkOrders] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/fetchWorkOrderDetail", async (req, res) => {
  try {
    const woId = parseInt(req.query.woId, 10);
    if (!Number.isInteger(woId)) {
      return res.status(400).json({ success: false, error: "กรุณาระบุ woId เป็นตัวเลข" });
    }

    const pool = await connectToDatabaseWC();
    if (!pool) return res.status(503).json({ success: false, error: "ไม่สามารถเชื่อมต่อฐานข้อมูลสูตรได้" });

    const result = await pool.request().input("woId", sql.Int, woId).query(DETAIL_SQL);
    const data = Object.fromEntries(DETAIL_KEYS.map((key, i) => [key, result.recordsets[i] || []]));

    if (!data.header.length) {
      return res.status(404).json({ success: false, error: "ไม่พบใบสั่งผลิตนี้" });
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Route /wo/fetchWorkOrderDetail] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/fetchWorkOrderBaskets", async (req, res) => {
  try {
    const woId = parseInt(req.query.woId, 10);
    if (!Number.isInteger(woId)) {
      return res.status(400).json({ success: false, error: "กรุณาระบุ woId เป็นตัวเลข" });
    }
    const from = Math.max(parseInt(req.query.from, 10) || 1, 1);
    const count = Math.min(Math.max(parseInt(req.query.count, 10) || DEFAULT_BASKET_COUNT, 1), MAX_BASKET_COUNT);
    const mixTypeRaw = parseInt(req.query.mixType, 10);

    const pool = await connectToDatabaseWC();
    if (!pool) return res.status(503).json({ success: false, error: "ไม่สามารถเชื่อมต่อฐานข้อมูลสูตรได้" });

    const request = pool.request()
      .input("woId", sql.Int, woId)
      .input("from", sql.Int, from)
      .input("count", sql.Int, count);
    let mixFilter = "";
    if (Number.isInteger(mixTypeRaw)) {
      request.input("mixType", sql.Int, mixTypeRaw);
      mixFilter = "AND b.MixType = @mixType";
    }

    const result = await request.query(`${KEYS_SQL}
      SELECT b.BasketNumber AS basketNumber, b.MixType AS mixType, b.BasketState AS basketState,
             b.MixingTime AS basketMixStart, b.MixingEndTime AS basketMixEnd, b.PackingTime AS packingTime, b.PackingEndTime AS packingEndTime,
             i.IngdntCode AS ingdntCode, i.IngdntName AS ingdntName, bt.BatchNo AS batchNo,
             rm.MaterialCode AS rawMatCode, rm.BatchNo AS rawMatBatchNo,
             a.StdWt AS stdWt, a.MinWt AS minWt, a.MaxWt AS maxWt, a.NetWt AS netWt, a.MixingTime AS mixingTime
      FROM TunaPackingIngredientBaskets b
      JOIN TunaPackingIngredientActuals a            ON a.BasketId = b.Id
      JOIN TunaPackingIngredients i                  ON i.Id = a.IngdntId
      LEFT JOIN TunaPackingIngredientBatches bt      ON bt.Id = a.BatchId
      LEFT JOIN TunaPackingIngredientRawMaterials rm ON rm.Id = a.RawMatId
      WHERE b.WOId IN (SELECT PackId FROM @Pack)
        AND b.BasketNumber >= @from AND b.BasketNumber < @from + @count ${mixFilter}
      ORDER BY b.MixType, b.BasketNumber, i.[Index]`);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("[Route /wo/fetchWorkOrderBaskets] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
