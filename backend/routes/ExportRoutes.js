// ส่งข้อมูลให้ระบบอื่นภายในบริษัท (อ่านอย่างเดียว) — ตอนนี้: DocHUB ดึงรายงาน Delay F3PFPF67 วันละครั้ง (05:00)
//   GET /api/export/f3pfpf67?days=3                 แถวที่บรรจุเสร็จใน 3 วันล่าสุด (นับวันที่บรรจุเสร็จ รวมวันนี้)
//   GET /api/export/f3pfpf67?date_from=&date_to=    ช่วงวันที่ (yyyy-mm-dd, ไม่เกิน 62 วัน)
//   GET /api/export/f3pfpf67/template.xlsx           ไฟล์ต้นฉบับแบบฟอร์ม Excel F3PFPV04 (ให้ DocHUB ออก Excel แบบเดียวกับ DelayHUB)
//   GET /api/export/mapping/:mapping_id              ข้อมูลของรายการ (mapping) หนึ่งรายการ ตาม mapping_id ใน QR สลีป: code / mat / mat_2x / batch / batch_2x
//                                                    (DocHUB ใบตรวจ Metal Detector F3QCPF06 สแกน QR แล้วเติมช่อง Code · วัตถุดิบ · วัตถุดิบ 2X · Batch · Batch 2X) — อ่านอย่างเดียว
// ไม่ใช้ token ของผู้ใช้: ต้องส่ง header x-export-key = EXPORT_API_KEY ใน .env (ไม่ตั้ง = ปิด API นี้) — อยู่ใน PUBLIC_ROUTES ของ lib/authMiddleware.js
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const sql = require("mssql");
const { connectToDatabase } = require("../database/db");
const { ensureFlowColumns } = require("../lib/flowDelay");
const { buildMappingQuery } = require("./SheetRoutes");
const { toFormLines } = require("../lib/delayExport");

const router = express.Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TEMPLATE = path.resolve(__dirname, "../../frontend/src/assets/templates/F3PFPV04.xlsx");

const keyOk = (req) => {
  const want = process.env.EXPORT_API_KEY || "";
  const got = String(req.headers["x-export-key"] || "");
  if (want.length < 16 || got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
};
const guard = (req, res, next) => {
  if (!process.env.EXPORT_API_KEY) return res.status(503).json({ success: false, error: "export API is off (EXPORT_API_KEY is not set)" });
  if (!keyOk(req)) return res.status(403).json({ success: false, error: "forbidden" });
  next();
};

// เครื่องท้องถิ่นของ server (เวลาไทย) → yyyy-mm-dd
const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// คำขอเดียวกันภายใน 5 นาที (เช่น กดดึงซ้ำ) ใช้ผลเดิม ไม่ query ซ้ำ
const memo = new Map();
const MEMO_MS = 5 * 60 * 1000;

router.get("/export/f3pfpf67", guard, async (req, res) => {
  try {
    let dateFrom; let dateTo;
    if (DATE_RE.test(req.query.date_from || "") && DATE_RE.test(req.query.date_to || "")) {
      dateFrom = req.query.date_from; dateTo = req.query.date_to;
    } else {
      const days = Math.min(Math.max(parseInt(req.query.days, 10) || 3, 1), 62);
      const now = new Date();
      dateTo = ymdLocal(now);
      dateFrom = ymdLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));
    }
    if (dateFrom > dateTo) return res.status(400).json({ success: false, error: "date_from must not be after date_to" });
    if ((new Date(dateTo) - new Date(dateFrom)) / 86400000 > 62) return res.status(400).json({ success: false, error: "range is limited to 62 days" });

    const key = `${dateFrom}|${dateTo}`;
    const hit = memo.get(key);
    if (hit && Date.now() - hit.at < MEMO_MS) return res.type("application/json").send(hit.json);

    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureFlowColumns(pool);
    const result = await pool.request()
      .input("mlimit", sql.Int, 2147483647)
      .input("date_from", sql.Date, dateFrom)
      .input("date_to", sql.Date, dateTo)
      .input("q", sql.NVarChar(100), "")
      .input("q_like", sql.NVarChar(110), "%%")
      .query(buildMappingQuery("done", { dated: true }));
    const rows = await toFormLines(result.recordset);
    const json = JSON.stringify({ success: true, form: "F3PFPF67", generated_at: new Date().toISOString(), date_from: dateFrom, date_to: dateTo, count: rows.length, rows });
    memo.clear();
    memo.set(key, { at: Date.now(), json });
    res.type("application/json").send(json);
  } catch (err) {
    console.error("❌ [Route /export/f3pfpf67] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/export/mapping/:mapping_id", guard, async (req, res) => {
  try {
    const id = parseInt(req.params.mapping_id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, error: "mapping_id must be a positive integer" });
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    const r = await pool.request().input("id", sql.Int, id).query(`
      SELECT TOP (1)
        rmm.mapping_id,
        p.code AS code,
        rm.mat AS mat,
        rm.mat_name AS mat_name,
        (SELECT TOP (1) m.mat_2x FROM Mat m WITH (NOLOCK) WHERE m.mapping_id = rmm.mapping_id ORDER BY m.mat_2x DESC) AS mat_2x,
        COALESCE(bt.batch_before, rmf.batch) AS batch,
        bt.batch_after AS batch_2x
      FROM TrolleyRMMapping rmm WITH (NOLOCK)
      LEFT JOIN RMForProd rmf WITH (NOLOCK) ON rmf.rmfp_id = rmm.rmfp_id
      LEFT JOIN ProdRawMat pr WITH (NOLOCK) ON rmm.tro_production_id = pr.prod_rm_id
      LEFT JOIN RawMat rm WITH (NOLOCK) ON pr.mat = rm.mat
      LEFT JOIN Production p WITH (NOLOCK) ON pr.prod_id = p.prod_id
      OUTER APPLY (SELECT TOP (1) b.batch_before, b.batch_after FROM Batch b WITH (NOLOCK) WHERE b.mapping_id = rmm.mapping_id ORDER BY b.batch_id DESC) bt
      WHERE rmm.mapping_id = @id`);
    if (!r.recordset.length) return res.status(404).json({ success: false, error: "mapping_id not found" });
    res.json({ success: true, data: r.recordset[0] });
  } catch (err) {
    console.error("❌ [Route /export/mapping] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/export/f3pfpf67/template.xlsx", guard, (req, res) => {
  if (!fs.existsSync(TEMPLATE)) return res.status(404).json({ success: false, error: "template not found" });
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  fs.createReadStream(TEMPLATE).on("error", (err) => { console.error("❌ [Route /export/f3pfpf67/template.xlsx] Error:", err); res.destroy(err); }).pipe(res);
});

module.exports = router;
