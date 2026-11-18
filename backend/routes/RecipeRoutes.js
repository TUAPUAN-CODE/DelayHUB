// ─────────────────────────────────────────────────────────────────────────────
// RecipeRoutes.js — ข้อมูลสูตรการผลิตจากฐานข้อมูล IV.TUNA (WC) แบบอ่านอย่างเดียว
//   GET /api/recipe/fetchProducts?q=&limit=       → รายการรหัสสินค้า + ลูกค้า + ตลาด (ค้นหาได้)
//   GET /api/recipe/fetchProductDetail?codeId=    → น้ำหนัก/ขีดควบคุม สูตร ลำดับการผสม สารละลาย topping และเอกสารที่พิมพ์ได้
//
// ใช้ connectToDatabaseWC (DB_*_WC ใน .env) — ทุก query เป็น SELECT
// "เอกสารที่พิมพ์ได้" = แถวใน TunaIngredientWIPReports ที่ MixType นั้นมีข้อมูลของสินค้านี้;
//  MixType 0 คือใบเบิกสารละลาย/ส่วนผสม (ใช้ข้อมูล solution + topping)
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const sql = require("mssql");
const { connectToDatabaseWC } = require("../database/db");
const { pickBest } = require("../lib/planMatch");

const router = express.Router();

const SOLUTION_SHEET_MIXTYPE = 0;
const MAX_LIMIT = 5000; // เพดานของ ?limit= ที่ผู้เรียกขอเอง — ถ้าไม่ส่ง limit จะได้ครบทุกแถว (รหัสสินค้าหลักร้อย แถวเล็ก ส่งครั้งเดียวได้)

const PRODUCT_SELECT = `
  c.Id AS codeId, c.ProductCode AS productCode, c.AlternateCode AS alternateCode, c.GroupCode AS groupCode,
  cu.Id AS customerId, cu.Customer AS customer, cu.Destination AS market,
  p.Product AS product, p.Description AS productDesc, sp.SpeciesName AS species,
  pk.Package AS package, pk.PackageName AS packageName,
  c.IngredientFormulaRevision AS revision`;

const PRODUCT_FROM = `
  FROM TunaCodes c
  LEFT JOIN TunaCustomers cu ON cu.Id = c.CustomerId
  LEFT JOIN TunaProducts p   ON p.Id  = c.ProductId
  LEFT JOIN TunaSpecies sp   ON sp.Id = c.SpeciesId
  LEFT JOIN TunaPackages pk  ON pk.Id = c.PackageId`;

router.get("/fetchProducts", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 100);
    const limitAsked = parseInt(req.query.limit, 10);
    const limit = limitAsked > 0 ? Math.min(limitAsked, MAX_LIMIT) : null;

    const pool = await connectToDatabaseWC();
    if (!pool) return res.status(503).json({ success: false, error: "ไม่สามารถเชื่อมต่อฐานข้อมูลสูตรได้" });

    const request = pool.request();
    if (limit) request.input("limit", sql.Int, limit);
    let where = "";
    if (q) {
      request.input("q", sql.NVarChar(200), `%${q}%`);
      where = "WHERE c.ProductCode LIKE @q OR c.AlternateCode LIKE @q OR cu.Customer LIKE @q OR cu.Destination LIKE @q";
    }
    const result = await request.query(`
      SELECT ${limit ? "TOP (@limit)" : ""} ${PRODUCT_SELECT}
      ${PRODUCT_FROM}
      ${where}
      ORDER BY cu.Customer, c.ProductCode`);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("[Route /recipe/fetchProducts] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/fetchProductDetail", async (req, res) => {
  try {
    const codeId = parseInt(req.query.codeId, 10);
    if (!Number.isInteger(codeId)) {
      return res.status(400).json({ success: false, error: "กรุณาระบุ codeId เป็นตัวเลข" });
    }

    const pool = await connectToDatabaseWC();
    if (!pool) return res.status(503).json({ success: false, error: "ไม่สามารถเชื่อมต่อฐานข้อมูลสูตรได้" });

    const run = async (query) => (await pool.request().input("codeId", sql.Int, codeId).query(query)).recordset;

    const [header, ingredients, mixSequences, solutions, toppings, reports] = await Promise.all([
      run(`
        SELECT ${PRODUCT_SELECT},
               c.TargetFW AS targetFW, c.TargetNW AS targetNW, c.TargetDW AS targetDW,
               c.MaxFW AS maxFW, c.MaxNW AS maxNW, c.MaxDW AS maxDW,
               c.LabelNW AS labelNW, c.LabelT1 AS labelT1, c.LabelT2 AS labelT2,
               c.uclFW, c.uwlFW, c.lwlFW, c.lclFW, c.uclNW, c.uwlNW, c.lwlNW, c.lclNW,
               i.MinuteOfInspection AS minuteOfInspection
        ${PRODUCT_FROM}
        LEFT JOIN TunaCodeInspections i ON i.Id = c.InspId
        WHERE c.Id = @codeId`),
      run(`
        SELECT MixType AS mixType, [Index] AS seq, [Group] AS ingGroup, IngdntCode AS ingdntCode,
               IngdntName AS ingdntName, StdWt AS stdWt, MinWt AS minWt, MaxWt AS maxWt,
               Percentage AS percentage, ProcessType AS processType, Description AS description
        FROM TunaCodeIngredients
        WHERE CodeId = @codeId AND InActive = 0
        ORDER BY MixType, [Index]`),
      run(`
        SELECT s.MixType AS mixType, s.ProcessType AS processType, s.[Index] AS seq,
               s.Sequence AS sequence, s.SubSequence AS subSequence,
               s.SequenceDescription AS description, ing.IngdntCode AS ingdntCode,
               ing.IngdntName AS ingdntName, s.AlternateMaterialName AS alternateMaterialName
        FROM TunaCodeIngredientMixSequences s
        LEFT JOIN TunaCodeIngredients ing
               ON ing.CodeId = s.CodeId AND ing.MixType = s.MixType
              AND ing.IngdntId = s.IngdntId AND ing.InActive = 0
        WHERE s.CodeId = @codeId
        ORDER BY s.MixType, s.ProcessType, s.[Index], s.Sequence, s.SubSequence`),
      run(`
        SELECT s.SolutionCode AS code, s.SolutionName AS name, cs.Quantity AS quantity,
               cs.MinVal AS minVal, cs.MaxVal AS maxVal, cs.SingleRound AS singleRound, cs.IsNotUse AS isNotUse
        FROM TunaCodeSolutions cs
        LEFT JOIN TunaSolutions s ON s.Id = cs.SlnId
        WHERE cs.CodeId = @codeId
        ORDER BY s.SolutionName`),
      run(`
        SELECT t.ToppingCode AS code, t.ToppingName AS name, ct.Quantity AS quantity,
               ct.MinVal AS minVal, ct.MaxVal AS maxVal, ct.SingleRound AS singleRound, ct.IsNotUse AS isNotUse
        FROM TunaCodeToppings ct
        LEFT JOIN TunaToppings t ON t.Id = ct.TopId
        WHERE ct.CodeId = @codeId
        ORDER BY t.ToppingName`),
      // MixType มีได้หลายแถวเอกสาร (เช่น 10/20/80/90 ใช้เลข ISO เดียวกัน) — เอาแถวแรกของแต่ละ MixType
      run(`
        SELECT MixType AS mixType, ReportText AS reportText, ISO AS iso, Description AS description
        FROM TunaIngredientWIPReports WHERE InActive = 0 ORDER BY MixType, Id`),
    ]);

    if (!header.length) {
      return res.status(404).json({ success: false, error: "ไม่พบรหัสสินค้านี้" });
    }

    const hasRows = new Set([...ingredients.map((r) => r.mixType), ...mixSequences.map((r) => r.mixType)]);
    if (solutions.length || toppings.length) hasRows.add(SOLUTION_SHEET_MIXTYPE);
    const documents = reports.filter((r) => hasRows.has(r.mixType));

    res.json({ success: true, data: { header: header[0], ingredients, mixSequences, solutions, toppings, documents } });
  } catch (err) {
    console.error("[Route /recipe/fetchProductDetail] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ข้อมูลสินค้า (ลูกค้า / ตลาด / น้ำหนัก) ของแผนการผลิตของ PFCM: จับคู่ code + doc_no ของแผนกับรหัสสินค้าใน WC (ดู lib/planMatch.js)
// data = null เมื่อไม่พบ (แผนเก่าหรือรหัสที่ WC ไม่มีแล้ว) — ไม่ใช่ error
router.get("/fetchPlanInfo", async (req, res) => {
  try {
    const code = String(req.query.code || "").trim().slice(0, 100);
    const docNo = String(req.query.docNo || "").trim().slice(0, 50);
    if (!code || !docNo) {
      return res.status(400).json({ success: false, error: "กรุณาระบุ code และ docNo" });
    }

    const pool = await connectToDatabaseWC();
    if (!pool) return res.status(503).json({ success: false, error: "ไม่สามารถเชื่อมต่อฐานข้อมูลสูตรได้" });

    const result = await pool.request().input("docNo", sql.NVarChar(50), docNo).query(`
      SELECT c.Id AS codeId, c.ProductCode AS productCode, c.GroupCode AS groupCode,
             cu.Customer AS customer, cu.Destination AS market, pk.Package AS package,
             c.TargetNW AS targetNW, c.TargetFW AS targetFW, c.LabelNW AS labelNW, c.MaxNW AS maxNW, c.MaxFW AS maxFW
      FROM TunaCodes c
      LEFT JOIN TunaCustomers cu ON cu.Id = c.CustomerId
      LEFT JOIN TunaPackages pk  ON pk.Id = c.PackageId
      WHERE c.GroupCode = @docNo`);

    const best = pickBest(code, result.recordset);
    res.json({ success: true, data: best ? { ...best.row, match: best.match } : null });
  } catch (err) {
    console.error("[Route /recipe/fetchPlanInfo] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
