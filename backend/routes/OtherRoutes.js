const { safeRollback } = require("../lib/safeRollback");
// Role "Other" — Delay control of lots that are NOT tracked by the trolley system:
//   outside the cold room the limit is 2 hours (prepared -> into the cold room), inside the cold room 24 hours.
// A lot is prepared once (e.g. 100 kg) and goes into the cold room in one or several steps (IN), and leaves it in several steps (OUT, e.g. 10 kg at a time).
// Every time stamp can be taken "now" or typed by hand. The tables are created on first use (no SQL has to be run by hand).
const express = require("express");
const sql = require("mssql");
const { connectToDatabase } = require("../database/db");

const router = express.Router();
let tablesChecked = false;

async function ensureTables(pool) {
  if (tablesChecked) return;
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.OtherLot', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.OtherLot (
        lot_id       INT IDENTITY(1,1) PRIMARY KEY,
        lot_name     NVARCHAR(200) NOT NULL,
        ref_code     NVARCHAR(100) NULL,
        weight_kg    DECIMAL(12,2) NOT NULL,
        prep_done_at DATETIME      NOT NULL,
        note         NVARCHAR(300) NULL,
        closed       BIT           NOT NULL CONSTRAINT DF_OtherLot_closed DEFAULT (0),
        created_by   NVARCHAR(100) NULL,
        created_at   DATETIME      NOT NULL CONSTRAINT DF_OtherLot_created DEFAULT (GETDATE())
      );
    END
    IF OBJECT_ID(N'dbo.OtherLotMove', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.OtherLotMove (
        move_id    INT IDENTITY(1,1) PRIMARY KEY,
        lot_id     INT           NOT NULL,
        kind       VARCHAR(3)    NOT NULL,          -- IN = into the cold room · OUT = out of the cold room
        qty_kg     DECIMAL(12,2) NOT NULL,
        moved_at   DATETIME      NOT NULL,
        created_by NVARCHAR(100) NULL,
        created_at DATETIME      NOT NULL CONSTRAINT DF_OtherLotMove_created DEFAULT (GETDATE())
      );
      CREATE INDEX IX_OtherLotMove_lot ON dbo.OtherLotMove (lot_id);
    END
  `);
  tablesChecked = true;
  console.log("✅ [Other] ตรวจ/สร้างตาราง OtherLot, OtherLotMove เรียบร้อย");
}

const parseDate = (v) => {
  if (v === undefined || v === null || v === "") return new Date();
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};
const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const trim = (v, max) => (v === undefined || v === null ? null : String(v).trim().slice(0, max) || null);
const FUTURE_MS = 5 * 60 * 1000; // a stamp may not be in the future (5 minutes of clock difference are accepted)

// lots with their moves; ?closed=1 shows closed lots too
router.get("/other/lots", async (req, res) => {
  try {
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    const withClosed = req.query.closed === "1";
    const lots = await pool.request().query(`
      SELECT TOP (500) lot_id, lot_name, ref_code, weight_kg, CONVERT(VARCHAR(19), prep_done_at, 120) AS prep_done_at, note, closed, created_by
      FROM OtherLot WITH (NOLOCK)
      ${withClosed ? "" : "WHERE closed = 0"}
      ORDER BY lot_id DESC
    `);
    const ids = lots.recordset.map((l) => l.lot_id);
    let moves = [];
    if (ids.length) {
      const r = pool.request();
      const names = ids.map((id, i) => { r.input(`id${i}`, sql.Int, id); return `@id${i}`; }).join(",");
      moves = (await r.query(`
        SELECT move_id, lot_id, kind, qty_kg, CONVERT(VARCHAR(19), moved_at, 120) AS moved_at, created_by
        FROM OtherLotMove WITH (NOLOCK) WHERE lot_id IN (${names}) ORDER BY moved_at, move_id
      `)).recordset;
    }
    const byLot = new Map();
    moves.forEach((m) => { if (!byLot.has(m.lot_id)) byLot.set(m.lot_id, []); byLot.get(m.lot_id).push(m); });
    res.json({ success: true, data: lots.recordset.map((l) => ({ ...l, moves: byLot.get(l.lot_id) || [] })) });
  } catch (err) {
    console.error("[Route /other/lots GET] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// new lot: { lot_name, ref_code?, weight_kg, prep_done_at? (empty = now), note?, user? }
router.post("/other/lots", async (req, res) => {
  try {
    const name = trim(req.body.lot_name, 200);
    const weight = toNum(req.body.weight_kg);
    const at = parseDate(req.body.prep_done_at);
    if (!name) return res.status(400).json({ success: false, error: "กรุณาใส่ชื่อ" });
    if (!(weight > 0)) return res.status(400).json({ success: false, error: "น้ำหนักต้องมากกว่า 0" });
    if (!at) return res.status(400).json({ success: false, error: "เวลาไม่ถูกต้อง" });
    if (at.getTime() > Date.now() + FUTURE_MS) return res.status(400).json({ success: false, error: "เวลาต้องไม่เป็นอนาคต" });
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    const r = await pool.request()
      .input("name", sql.NVarChar(200), name)
      .input("ref", sql.NVarChar(100), trim(req.body.ref_code, 100))
      .input("w", sql.Decimal(12, 2), weight)
      .input("at", sql.DateTime, at)
      .input("note", sql.NVarChar(300), trim(req.body.note, 300))
      .input("by", sql.NVarChar(100), trim(req.body.user, 100))
      .query("INSERT INTO OtherLot (lot_name, ref_code, weight_kg, prep_done_at, note, created_by) OUTPUT INSERTED.lot_id VALUES (@name, @ref, @w, @at, @note, @by)");
    res.status(201).json({ success: true, lot_id: r.recordset[0].lot_id, message: "บันทึกสำเร็จ" });
  } catch (err) {
    console.error("[Route /other/lots POST] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// stamp a move: { kind: "IN" | "OUT", qty_kg, moved_at? (empty = now), user? }
//   IN  can not be more than what is prepared and not yet in the cold room · OUT can not be more than what is in the cold room now
router.post("/other/lots/:id/move", async (req, res) => {
  const lotId = parseInt(req.params.id, 10);
  const kind = String(req.body.kind || "").toUpperCase();
  const qty = toNum(req.body.qty_kg);
  const at = parseDate(req.body.moved_at);
  if (Number.isNaN(lotId) || !["IN", "OUT"].includes(kind)) return res.status(400).json({ success: false, error: "ข้อมูลไม่ถูกต้อง" });
  if (!(qty > 0)) return res.status(400).json({ success: false, error: "น้ำหนักต้องมากกว่า 0" });
  if (!at) return res.status(400).json({ success: false, error: "เวลาไม่ถูกต้อง" });
  if (at.getTime() > Date.now() + FUTURE_MS) return res.status(400).json({ success: false, error: "เวลาต้องไม่เป็นอนาคต" });
  let transaction;
  try {
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE); // two people stamping the same lot at once must not both pass the weight check
    const lot = await new sql.Request(transaction).input("id", sql.Int, lotId).query("SELECT weight_kg, CONVERT(VARCHAR(19), prep_done_at, 120) AS prep_done_at, closed FROM OtherLot WHERE lot_id = @id");
    if (!lot.recordset.length) { await safeRollback(transaction); return res.status(404).json({ success: false, error: "ไม่พบรายการ" }); }
    if (lot.recordset[0].closed) { await safeRollback(transaction); return res.status(400).json({ success: false, error: "รายการนี้ปิดแล้ว" }); }
    if (at < new Date(lot.recordset[0].prep_done_at.replace(" ", "T"))) { await safeRollback(transaction); return res.status(400).json({ success: false, error: "เวลาต้องไม่ก่อนเวลาเตรียมเสร็จ" }); }
    const sums = await new sql.Request(transaction).input("id", sql.Int, lotId).query("SELECT kind, SUM(qty_kg) AS kg FROM OtherLotMove WHERE lot_id = @id GROUP BY kind");
    const kg = { IN: 0, OUT: 0 };
    sums.recordset.forEach((s) => { kg[s.kind] = Number(s.kg) || 0; });
    const prepared = Number(lot.recordset[0].weight_kg);
    if (kind === "IN" && qty > prepared - kg.IN + 1e-6) { await safeRollback(transaction); return res.status(400).json({ success: false, error: `เข้าห้องเย็นได้อีกไม่เกิน ${(prepared - kg.IN).toFixed(2)} kg` }); }
    if (kind === "OUT" && qty > kg.IN - kg.OUT + 1e-6) { await safeRollback(transaction); return res.status(400).json({ success: false, error: `ในห้องเย็นเหลือ ${(kg.IN - kg.OUT).toFixed(2)} kg` }); }
    await new sql.Request(transaction)
      .input("id", sql.Int, lotId).input("kind", sql.VarChar(3), kind).input("qty", sql.Decimal(12, 2), qty).input("at", sql.DateTime, at).input("by", sql.NVarChar(100), trim(req.body.user, 100))
      .query("INSERT INTO OtherLotMove (lot_id, kind, qty_kg, moved_at, created_by) VALUES (@id, @kind, @qty, @at, @by)");
    await transaction.commit();
    res.status(201).json({ success: true, message: "บันทึกสำเร็จ" });
  } catch (err) {
    if (transaction) { try { await safeRollback(transaction); } catch (e) { /* already closed */ } }
    console.error("[Route /other/lots/:id/move] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// close a lot (finished / not tracked any more): it leaves the list
router.put("/other/lots/:id/close", async (req, res) => {
  try {
    const lotId = parseInt(req.params.id, 10);
    if (Number.isNaN(lotId)) return res.status(400).json({ success: false, error: "ข้อมูลไม่ถูกต้อง" });
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    const r = await pool.request().input("id", sql.Int, lotId).query("UPDATE OtherLot SET closed = 1 WHERE lot_id = @id");
    if (!r.rowsAffected[0]) return res.status(404).json({ success: false, error: "ไม่พบรายการ" });
    res.json({ success: true, message: "ปิดรายการแล้ว" });
  } catch (err) {
    console.error("[Route /other/lots/:id/close] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
