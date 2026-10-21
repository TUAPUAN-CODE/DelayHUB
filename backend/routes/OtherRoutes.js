const { safeRollback } = require("../lib/safeRollback");
// Role "Other" — Delay control of lots that are NOT tracked by the trolley system:
//   outside the cold room the limit is 2 hours (prepared -> into the cold room), inside the cold room 24 hours.
// A lot is prepared once (e.g. 100 kg) and goes into the cold room in one or several steps (IN), and leaves it in several steps (OUT, e.g. 10 kg at a time).
// After the lid is opened the kg in the cold room are split into sets (OtherLotSet, "จัดชุด") and every set leaves the cold room on its own.
// A closed lot goes to the History page and can be recalled. Every time stamp can be taken "now" or typed by hand.
// The tables are created on first use (no SQL has to be run by hand).
const crypto = require("crypto");
const express = require("express");
const sql = require("mssql");
const { connectToDatabase } = require("../database/db");
const logger = require("../lib/logger");

const router = express.Router();
let tablesChecked = false;

async function ensureTables(pool) {
  if (tablesChecked) return;
  // every PM2 worker checks once: the app lock makes them take turns (two workers adding the same column at once = error)
  // (the parameter makes the driver run it through sp_executesql, so SET XACT_ABORT ends with it and does not stay on the pooled connection)
  await pool.request().input("check", sql.Int, 1).query(`
    SET XACT_ABORT ON; -- an error rolls the whole check back (no transaction left open on a pooled connection)
    BEGIN TRAN;
    EXEC sp_getapplock @Resource = N'pfcm_other_tables', @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 15000;
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
    -- เวลาเปิดฝา (เปิดแล้วต้องออกห้องเย็นภายใน 12 ชม.)
    IF COL_LENGTH(N'dbo.OtherLot', N'lid_open_at') IS NULL
      ALTER TABLE dbo.OtherLot ADD lid_open_at DATETIME NULL;
    -- ปิดเมื่อ / ปิดโดย (หน้า History)
    IF COL_LENGTH(N'dbo.OtherLot', N'closed_at') IS NULL
      ALTER TABLE dbo.OtherLot ADD closed_at DATETIME NULL;
    IF COL_LENGTH(N'dbo.OtherLot', N'closed_by') IS NULL
      ALTER TABLE dbo.OtherLot ADD closed_by NVARCHAR(100) NULL;
    -- OUT ของชุดย่อย: ชุดไหน
    IF COL_LENGTH(N'dbo.OtherLotMove', N'set_id') IS NULL
      ALTER TABLE dbo.OtherLotMove ADD set_id INT NULL;
    -- ชุดย่อยที่จัดหลังเปิดฝา (ID ที่แสดง = <lot_id>-<set_no>) · ยกเลิก = cancelled_at (ไม่ลบแถว)
    IF OBJECT_ID(N'dbo.OtherLotSet', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.OtherLotSet (
        set_id       INT IDENTITY(1,1) PRIMARY KEY,
        lot_id       INT           NOT NULL,
        set_no       INT           NOT NULL,
        qty_kg       DECIMAL(12,2) NOT NULL,
        made_at      DATETIME      NOT NULL,          -- เวลาจัดชุด
        created_by   NVARCHAR(100) NULL,
        created_at   DATETIME      NOT NULL CONSTRAINT DF_OtherLotSet_created DEFAULT (GETDATE()),
        out_move_id  INT           NULL,              -- OtherLotMove ของการออกห้องเย็นของชุดนี้
        cancelled_at DATETIME      NULL,
        cancelled_by NVARCHAR(100) NULL
      );
      CREATE INDEX IX_OtherLotSet_lot ON dbo.OtherLotSet (lot_id);
    END
    -- ประวัติการแก้ไข (แก้น้ำหนัก, ปิด, recall, ยกเลิกชุด)
    IF OBJECT_ID(N'dbo.OtherLotLog', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.OtherLotLog (
        log_id     INT IDENTITY(1,1) PRIMARY KEY,
        lot_id     INT           NOT NULL,
        action     VARCHAR(20)   NOT NULL,
        detail     NVARCHAR(500) NULL,
        created_by NVARCHAR(100) NULL,
        created_at DATETIME      NOT NULL CONSTRAINT DF_OtherLotLog_created DEFAULT (GETDATE())
      );
      CREATE INDEX IX_OtherLotLog_lot ON dbo.OtherLotLog (lot_id);
    END
    COMMIT;
  `);
  tablesChecked = true;
  console.log("✅ [Other] ตรวจ/สร้างตาราง OtherLot, OtherLotMove, OtherLotSet, OtherLotLog เรียบร้อย");
}

// Times are kept as Thai wall-clock time (like GETDATE() everywhere else in the system).
// Writing a JS Date through the driver stored it as UTC (7 hours early), so the page showed "7 h" for a stamp made a minute ago:
// now every time goes in as a "yyyy-MM-dd HH:mm:ss" Thai-time text and every text read back is Thai time.
const TZ = "+07:00";
const parseDate = (v) => {
  if (v === undefined || v === null || v === "") return new Date();
  const d = new Date(`${String(v).trim().replace(" ", "T")}${/[zZ]|[+-]\d\d:?\d\d$/.test(String(v).trim()) ? "" : TZ}`);
  return Number.isNaN(d.getTime()) ? null : d;
};
/** Date -> "yyyy-MM-dd HH:mm:ss" in Thai time, for CONVERT(DATETIME, @at, 120) */
const thaiText = (d) => {
  const t = new Date(d.getTime() + 7 * 3600 * 1000).toISOString();
  return `${t.slice(0, 10)} ${t.slice(11, 19)}`;
};
// "now" is the clock of the database (GETDATE(), Thai time, like every other stamp in the system),
// not the clock of the API machine: a wrong clock / time zone there must not move the stamps
const dbNow = async (runner) => {
  const r = await runner.query("SELECT CONVERT(VARCHAR(19), GETDATE(), 120) AS now");
  return parseDate(r.recordset[0].now);
};
const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const r2 = (n) => Math.round(n * 100) / 100;
const trim = (v, max) => (v === undefined || v === null ? null : String(v).trim().slice(0, max) || null);
const FUTURE_MS = 5 * 60 * 1000; // a stamp may not be in the future (5 minutes of clock difference are accepted)
const MAX_SETS = 100;
const who = (req) => trim(req.body?.user, 100) || trim(req.user?.name || req.user?.username, 100);

// รหัสแก้ไข (แก้น้ำหนัก / ยกเลิกชุด): OTHER_EDIT_PASSWORD ใน .env ของ backend ถ้าตั้งไว้ — ไม่ตั้ง = รหัสที่หน้างานกำหนด (เก็บเป็น SHA-256 ไม่ใช่ตัวอักษร)
const DEFAULT_EDIT_PASSWORD_SHA256 = "99e25781ec3a4b939cba724a401c2c398e6e2ec54bb3b0e8ad8e2387307adf01";
const sha256 = (s) => crypto.createHash("sha256").update(String(s), "utf8").digest();
const editPasswordOk = (password) => {
  if (typeof password !== "string" || !password) return false;
  const expected = process.env.OTHER_EDIT_PASSWORD ? sha256(process.env.OTHER_EDIT_PASSWORD) : Buffer.from(DEFAULT_EDIT_PASSWORD_SHA256, "hex");
  return crypto.timingSafeEqual(sha256(password), expected);
};

const addLog = (runner, lotId, action, detail, by) => runner
  .input("log_lot", sql.Int, lotId).input("log_action", sql.VarChar(20), action)
  .input("log_detail", sql.NVarChar(500), trim(detail, 500)).input("log_by", sql.NVarChar(100), by)
  .query("INSERT INTO OtherLotLog (lot_id, action, detail, created_by) VALUES (@log_lot, @log_action, @log_detail, @log_by)");

/** kg into / out of the cold room of a lot, and the kg of the sets that are still in the cold room */
const lotKg = async (runner, lotId) => {
  const r = await runner.input("kg_lot", sql.Int, lotId).query(`
    SELECT
      ISNULL((SELECT SUM(qty_kg) FROM OtherLotMove WHERE lot_id = @kg_lot AND kind = 'IN'), 0) AS kg_in,
      ISNULL((SELECT SUM(qty_kg) FROM OtherLotMove WHERE lot_id = @kg_lot AND kind = 'OUT'), 0) AS kg_out,
      ISNULL((SELECT SUM(qty_kg) FROM OtherLotSet WHERE lot_id = @kg_lot AND cancelled_at IS NULL AND out_move_id IS NULL), 0) AS kg_sets`);
  const k = r.recordset[0];
  const kgIn = Number(k.kg_in) || 0;
  const kgOut = Number(k.kg_out) || 0;
  const kgSets = Number(k.kg_sets) || 0;
  return { kgIn, kgOut, inCold: r2(kgIn - kgOut), kgSets, unassigned: r2(kgIn - kgOut - kgSets) };
};

// lots with their moves and sets
//   ?scope=open (default) = the work page · ?scope=history = closed lots (History page) · ?closed=1 (old) = both · ?q= = ID / name / batch
router.get("/other/lots", async (req, res) => {
  try {
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    const scope = req.query.scope === "history" ? "history" : req.query.closed === "1" ? "all" : "open";
    const q = trim(req.query.q, 100);
    const where = [scope === "open" ? "closed = 0" : scope === "history" ? "closed = 1" : "1 = 1"];
    const request = pool.request();
    if (q) {
      request.input("q", sql.NVarChar(100), q).input("q_like", sql.NVarChar(110), `%${q.replace(/[[\]%_]/g, "[$&]")}%`);
      where.push("(CAST(lot_id AS NVARCHAR(20)) = @q OR lot_name LIKE @q_like OR ref_code LIKE @q_like)");
    }
    const lots = await request.query(`
      SELECT TOP (500) lot_id, lot_name, ref_code, weight_kg, CONVERT(VARCHAR(19), prep_done_at, 120) AS prep_done_at,
             CONVERT(VARCHAR(19), lid_open_at, 120) AS lid_open_at, note, closed, created_by,
             CONVERT(VARCHAR(19), closed_at, 120) AS closed_at, closed_by
      FROM OtherLot WITH (NOLOCK)
      WHERE ${where.join(" AND ")}
      ORDER BY ${scope === "history" ? "ISNULL(closed_at, created_at) DESC, " : ""}lot_id DESC
    `);
    const ids = lots.recordset.map((l) => l.lot_id);
    let moves = [];
    let sets = [];
    if (ids.length) {
      const bindIds = (r) => ids.map((id, i) => { r.input(`id${i}`, sql.Int, id); return `@id${i}`; }).join(",");
      const r1 = pool.request();
      moves = (await r1.query(`
        SELECT move_id, lot_id, kind, qty_kg, CONVERT(VARCHAR(19), moved_at, 120) AS moved_at, created_by, set_id
        FROM OtherLotMove WITH (NOLOCK) WHERE lot_id IN (${bindIds(r1)}) ORDER BY moved_at, move_id
      `)).recordset;
      const r2q = pool.request();
      sets = (await r2q.query(`
        SELECT s.set_id, s.lot_id, s.set_no, s.qty_kg, CONVERT(VARCHAR(19), s.made_at, 120) AS made_at, s.created_by,
               s.out_move_id, CONVERT(VARCHAR(19), m.moved_at, 120) AS out_at, m.created_by AS out_by
        FROM OtherLotSet s WITH (NOLOCK)
        LEFT JOIN OtherLotMove m WITH (NOLOCK) ON m.move_id = s.out_move_id
        WHERE s.lot_id IN (${bindIds(r2q)}) AND s.cancelled_at IS NULL
        ORDER BY s.lot_id, s.set_no
      `)).recordset;
    }
    const group = (list) => { const m = new Map(); list.forEach((x) => { if (!m.has(x.lot_id)) m.set(x.lot_id, []); m.get(x.lot_id).push(x); }); return m; };
    const movesBy = group(moves);
    const setsBy = group(sets);
    res.json({ success: true, data: lots.recordset.map((l) => ({ ...l, moves: movesBy.get(l.lot_id) || [], sets: setsBy.get(l.lot_id) || [] })) });
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
    const typed = req.body.prep_done_at;
    if (!name) return res.status(400).json({ success: false, error: "กรุณาใส่ชื่อ" });
    if (!(weight > 0)) return res.status(400).json({ success: false, error: "น้ำหนักต้องมากกว่า 0" });
    if (typed && !parseDate(typed)) return res.status(400).json({ success: false, error: "เวลาไม่ถูกต้อง" });
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    const now = await dbNow(pool.request());
    const at = typed ? parseDate(typed) : now;
    if (at.getTime() > now.getTime() + FUTURE_MS) return res.status(400).json({ success: false, error: "เวลาต้องไม่เป็นอนาคต" });
    const r = await pool.request()
      .input("name", sql.NVarChar(200), name)
      .input("ref", sql.NVarChar(100), trim(req.body.ref_code, 100))
      .input("w", sql.Decimal(12, 2), weight)
      .input("at", sql.VarChar(19), thaiText(at))
      .input("note", sql.NVarChar(300), trim(req.body.note, 300))
      .input("by", sql.NVarChar(100), who(req))
      .query("INSERT INTO OtherLot (lot_name, ref_code, weight_kg, prep_done_at, note, created_by) OUTPUT INSERTED.lot_id VALUES (@name, @ref, @w, CONVERT(DATETIME, @at, 120), @note, @by)");
    res.status(201).json({ success: true, lot_id: r.recordset[0].lot_id, message: "บันทึกสำเร็จ" });
  } catch (err) {
    console.error("[Route /other/lots POST] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// stamp a move: { kind: "IN" | "OUT", qty_kg, moved_at? (empty = now), user? }
//   IN  can not be more than what is prepared and not yet in the cold room · OUT can not be more than what is in the cold room now
//   after the lid is opened the kg leave by set (POST /other/lots/:id/sets/:setId/out), not with this OUT
router.post("/other/lots/:id/move", async (req, res) => {
  const lotId = parseInt(req.params.id, 10);
  const kind = String(req.body.kind || "").toUpperCase();
  const qty = toNum(req.body.qty_kg);
  const typed = req.body.moved_at;
  if (Number.isNaN(lotId) || !["IN", "OUT"].includes(kind)) return res.status(400).json({ success: false, error: "ข้อมูลไม่ถูกต้อง" });
  if (!(qty > 0)) return res.status(400).json({ success: false, error: "น้ำหนักต้องมากกว่า 0" });
  if (typed && !parseDate(typed)) return res.status(400).json({ success: false, error: "เวลาไม่ถูกต้อง" });
  let transaction;
  try {
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    const now = await dbNow(pool.request());
    const at = typed ? parseDate(typed) : now;
    if (at.getTime() > now.getTime() + FUTURE_MS) return res.status(400).json({ success: false, error: "เวลาต้องไม่เป็นอนาคต" });
    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE); // two people stamping the same lot at once must not both pass the weight check
    const lot = await new sql.Request(transaction).input("id", sql.Int, lotId).query("SELECT weight_kg, CONVERT(VARCHAR(19), prep_done_at, 120) AS prep_done_at, closed, lid_open_at FROM OtherLot WHERE lot_id = @id");
    if (!lot.recordset.length) { await safeRollback(transaction); return res.status(404).json({ success: false, error: "ไม่พบรายการ" }); }
    if (lot.recordset[0].closed) { await safeRollback(transaction); return res.status(400).json({ success: false, error: "รายการนี้ปิดแล้ว" }); }
    if (kind === "OUT" && lot.recordset[0].lid_open_at) { await safeRollback(transaction); return res.status(400).json({ success: false, error: "เปิดฝาแล้ว: กด \"จัดชุด\" แล้วออกห้องเย็นทีละชุด" }); }
    if (at < parseDate(lot.recordset[0].prep_done_at)) { await safeRollback(transaction); return res.status(400).json({ success: false, error: "เวลาต้องไม่ก่อนเวลาเตรียมเสร็จ" }); }
    const kg = await lotKg(new sql.Request(transaction), lotId);
    const prepared = Number(lot.recordset[0].weight_kg);
    if (kind === "IN" && qty > prepared - kg.kgIn + 1e-6) { await safeRollback(transaction); return res.status(400).json({ success: false, error: `เข้าห้องเย็นได้อีกไม่เกิน ${(prepared - kg.kgIn).toFixed(2)} kg` }); }
    if (kind === "OUT" && qty > kg.unassigned + 1e-6) { await safeRollback(transaction); return res.status(400).json({ success: false, error: `ในห้องเย็นเหลือ ${kg.unassigned.toFixed(2)} kg` }); }
    const ins = await new sql.Request(transaction)
      .input("id", sql.Int, lotId).input("kind", sql.VarChar(3), kind).input("qty", sql.Decimal(12, 2), qty).input("at", sql.VarChar(19), thaiText(at)).input("by", sql.NVarChar(100), who(req))
      .query("INSERT INTO OtherLotMove (lot_id, kind, qty_kg, moved_at, created_by) OUTPUT INSERTED.move_id VALUES (@id, @kind, @qty, CONVERT(DATETIME, @at, 120), @by)");
    await transaction.commit();
    res.status(201).json({ success: true, message: "บันทึกสำเร็จ", moved_at: thaiText(at), move_id: ins.recordset[0].move_id });
  } catch (err) {
    if (transaction) { try { await safeRollback(transaction); } catch (e) { /* already closed */ } }
    console.error("[Route /other/lots/:id/move] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// stamp "lid opened" (once per lot): { opened_at? (empty = now), user? }
//   only while kg are in the cold room, not before they went in, not in the future
router.post("/other/lots/:id/lid", async (req, res) => {
  try {
    const lotId = parseInt(req.params.id, 10);
    const typed = req.body.opened_at;
    if (Number.isNaN(lotId)) return res.status(400).json({ success: false, error: "ข้อมูลไม่ถูกต้อง" });
    if (typed && !parseDate(typed)) return res.status(400).json({ success: false, error: "เวลาไม่ถูกต้อง" });
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    const now = await dbNow(pool.request());
    const at = typed ? parseDate(typed) : now;
    if (at.getTime() > now.getTime() + FUTURE_MS) return res.status(400).json({ success: false, error: "เวลาต้องไม่เป็นอนาคต" });
    const lot = await pool.request().input("id", sql.Int, lotId).query(`
      SELECT l.closed, l.lid_open_at,
             (SELECT CONVERT(VARCHAR(19), MIN(moved_at), 120) FROM OtherLotMove m WHERE m.lot_id = l.lot_id AND m.kind = 'IN') AS first_in,
             (SELECT ISNULL(SUM(CASE WHEN kind = 'IN' THEN qty_kg ELSE -qty_kg END), 0) FROM OtherLotMove m WHERE m.lot_id = l.lot_id) AS in_cold
      FROM OtherLot l WHERE l.lot_id = @id`);
    const l = lot.recordset[0];
    if (!l) return res.status(404).json({ success: false, error: "ไม่พบรายการ" });
    if (l.closed) return res.status(400).json({ success: false, error: "รายการนี้ปิดแล้ว" });
    if (l.lid_open_at) return res.status(400).json({ success: false, error: "บันทึกเปิดฝาไปแล้ว" });
    if (!(Number(l.in_cold) > 0) || !l.first_in) return res.status(400).json({ success: false, error: "ยังไม่มีวัตถุดิบในห้องเย็น" });
    if (at < parseDate(l.first_in)) return res.status(400).json({ success: false, error: "เวลาเปิดฝาต้องไม่ก่อนเวลาเข้าห้องเย็น" });
    await pool.request().input("id", sql.Int, lotId).input("at", sql.VarChar(19), thaiText(at))
      .query("UPDATE OtherLot SET lid_open_at = CONVERT(DATETIME, @at, 120) WHERE lot_id = @id AND lid_open_at IS NULL");
    res.json({ success: true, message: "บันทึกเปิดฝาสำเร็จ", lid_open_at: thaiText(at) });
  } catch (err) {
    console.error("[Route /other/lots/:id/lid] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// "จัดชุด": split the kg in the cold room (not in a set yet) into sets — only after the lid was opened
//   { sets: [kg, kg, ...], made_at? (empty = now), user? } -> the new sets (their slips are printed right after)
router.post("/other/lots/:id/sets", async (req, res) => {
  const lotId = parseInt(req.params.id, 10);
  const list = Array.isArray(req.body.sets) ? req.body.sets.map(toNum) : [];
  const typed = req.body.made_at;
  if (Number.isNaN(lotId)) return res.status(400).json({ success: false, error: "ข้อมูลไม่ถูกต้อง" });
  if (!list.length || list.length > MAX_SETS) return res.status(400).json({ success: false, error: `จำนวนชุดต้อง 1–${MAX_SETS} ชุด` });
  if (list.some((kg) => !(kg > 0))) return res.status(400).json({ success: false, error: "น้ำหนักของทุกชุดต้องมากกว่า 0" });
  if (typed && !parseDate(typed)) return res.status(400).json({ success: false, error: "เวลาไม่ถูกต้อง" });
  let transaction;
  try {
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    const now = await dbNow(pool.request());
    const at = typed ? parseDate(typed) : now;
    if (at.getTime() > now.getTime() + FUTURE_MS) return res.status(400).json({ success: false, error: "เวลาต้องไม่เป็นอนาคต" });
    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const lot = await new sql.Request(transaction).input("id", sql.Int, lotId).query("SELECT closed, CONVERT(VARCHAR(19), lid_open_at, 120) AS lid_open_at FROM OtherLot WHERE lot_id = @id");
    const l = lot.recordset[0];
    if (!l) { await safeRollback(transaction); return res.status(404).json({ success: false, error: "ไม่พบรายการ" }); }
    if (l.closed) { await safeRollback(transaction); return res.status(400).json({ success: false, error: "รายการนี้ปิดแล้ว" }); }
    if (!l.lid_open_at) { await safeRollback(transaction); return res.status(400).json({ success: false, error: "ต้องบันทึกเปิดฝาก่อนจัดชุด" }); }
    if (at < parseDate(l.lid_open_at)) { await safeRollback(transaction); return res.status(400).json({ success: false, error: "เวลาจัดชุดต้องไม่ก่อนเวลาเปิดฝา" }); }
    const kg = await lotKg(new sql.Request(transaction), lotId);
    const total = r2(list.reduce((s, x) => s + x, 0));
    if (total > kg.unassigned + 1e-6) { await safeRollback(transaction); return res.status(400).json({ success: false, error: `จัดชุดได้ไม่เกิน ${kg.unassigned.toFixed(2)} kg (รวมที่ใส่ ${total.toFixed(2)} kg)` }); }
    const last = await new sql.Request(transaction).input("id", sql.Int, lotId).query("SELECT ISNULL(MAX(set_no), 0) AS n FROM OtherLotSet WHERE lot_id = @id");
    let no = last.recordset[0].n;
    const created = [];
    for (const qty of list) {
      no += 1;
      const r = await new sql.Request(transaction)
        .input("id", sql.Int, lotId).input("no", sql.Int, no).input("qty", sql.Decimal(12, 2), qty).input("at", sql.VarChar(19), thaiText(at)).input("by", sql.NVarChar(100), who(req))
        .query("INSERT INTO OtherLotSet (lot_id, set_no, qty_kg, made_at, created_by) OUTPUT INSERTED.set_id VALUES (@id, @no, @qty, CONVERT(DATETIME, @at, 120), @by)");
      created.push({ set_id: r.recordset[0].set_id, set_no: no, qty_kg: qty });
    }
    await transaction.commit();
    res.status(201).json({ success: true, message: `จัดชุดแล้ว ${created.length} ชุด`, made_at: thaiText(at), sets: created });
  } catch (err) {
    if (transaction) { try { await safeRollback(transaction); } catch (e) { /* already closed */ } }
    console.error("[Route /other/lots/:id/sets] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// a set leaves the cold room (all of its kg): { moved_at? (empty = now), user? }
router.post("/other/lots/:id/sets/:setId/out", async (req, res) => {
  const lotId = parseInt(req.params.id, 10);
  const setId = parseInt(req.params.setId, 10);
  const typed = req.body.moved_at;
  if (Number.isNaN(lotId) || Number.isNaN(setId)) return res.status(400).json({ success: false, error: "ข้อมูลไม่ถูกต้อง" });
  if (typed && !parseDate(typed)) return res.status(400).json({ success: false, error: "เวลาไม่ถูกต้อง" });
  let transaction;
  try {
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    const now = await dbNow(pool.request());
    const at = typed ? parseDate(typed) : now;
    if (at.getTime() > now.getTime() + FUTURE_MS) return res.status(400).json({ success: false, error: "เวลาต้องไม่เป็นอนาคต" });
    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const r = await new sql.Request(transaction).input("id", sql.Int, lotId).input("sid", sql.Int, setId).query(`
      SELECT s.qty_kg, s.out_move_id, s.cancelled_at, CONVERT(VARCHAR(19), s.made_at, 120) AS made_at, l.closed
      FROM OtherLotSet s JOIN OtherLot l ON l.lot_id = s.lot_id
      WHERE s.set_id = @sid AND s.lot_id = @id`);
    const s = r.recordset[0];
    if (!s || s.cancelled_at) { await safeRollback(transaction); return res.status(404).json({ success: false, error: "ไม่พบชุดนี้" }); }
    if (s.closed) { await safeRollback(transaction); return res.status(400).json({ success: false, error: "รายการนี้ปิดแล้ว" }); }
    if (s.out_move_id) { await safeRollback(transaction); return res.status(400).json({ success: false, error: "ชุดนี้ออกห้องเย็นไปแล้ว" }); }
    if (at < parseDate(s.made_at)) { await safeRollback(transaction); return res.status(400).json({ success: false, error: "เวลาออกห้องเย็นต้องไม่ก่อนเวลาจัดชุด" }); }
    const qty = Number(s.qty_kg);
    const kg = await lotKg(new sql.Request(transaction), lotId);
    if (qty > kg.inCold + 1e-6) { await safeRollback(transaction); return res.status(400).json({ success: false, error: `ในห้องเย็นเหลือ ${kg.inCold.toFixed(2)} kg` }); }
    const ins = await new sql.Request(transaction)
      .input("id", sql.Int, lotId).input("qty", sql.Decimal(12, 2), qty).input("at", sql.VarChar(19), thaiText(at)).input("by", sql.NVarChar(100), who(req)).input("sid", sql.Int, setId)
      .query("INSERT INTO OtherLotMove (lot_id, kind, qty_kg, moved_at, created_by, set_id) OUTPUT INSERTED.move_id VALUES (@id, 'OUT', @qty, CONVERT(DATETIME, @at, 120), @by, @sid)");
    const moveId = ins.recordset[0].move_id;
    await new sql.Request(transaction).input("sid", sql.Int, setId).input("mid", sql.Int, moveId)
      .query("UPDATE OtherLotSet SET out_move_id = @mid WHERE set_id = @sid AND out_move_id IS NULL");
    await transaction.commit();
    res.status(201).json({ success: true, message: "บันทึกออกห้องเย็นสำเร็จ", moved_at: thaiText(at), move_id: moveId });
  } catch (err) {
    if (transaction) { try { await safeRollback(transaction); } catch (e) { /* already closed */ } }
    console.error("[Route /other/lots/:id/sets/:setId/out] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// cancel a set that has not left the cold room (its kg can be split again): { password, user? }
router.put("/other/lots/:id/sets/:setId/cancel", async (req, res) => {
  try {
    const lotId = parseInt(req.params.id, 10);
    const setId = parseInt(req.params.setId, 10);
    if (Number.isNaN(lotId) || Number.isNaN(setId)) return res.status(400).json({ success: false, error: "ข้อมูลไม่ถูกต้อง" });
    if (!editPasswordOk(req.body.password)) {
      logger.warn("other_bad_password", { id: req.id, action: "set_cancel", lot: lotId });
      return res.status(401).json({ success: false, error: "รหัสไม่ถูกต้อง" });
    }
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    const by = who(req);
    const r = await pool.request().input("id", sql.Int, lotId).input("sid", sql.Int, setId).input("by", sql.NVarChar(100), by).query(`
      UPDATE OtherLotSet SET cancelled_at = GETDATE(), cancelled_by = @by
      OUTPUT INSERTED.set_no, INSERTED.qty_kg
      WHERE set_id = @sid AND lot_id = @id AND cancelled_at IS NULL AND out_move_id IS NULL`);
    if (!r.recordset.length) return res.status(400).json({ success: false, error: "ยกเลิกไม่ได้: ไม่พบชุด หรือชุดนี้ออกห้องเย็นแล้ว" });
    const s = r.recordset[0];
    await addLog(pool.request(), lotId, "SET_CANCEL", `ยกเลิกชุด ${lotId}-${s.set_no} (${Number(s.qty_kg)} kg)`, by);
    res.json({ success: true, message: "ยกเลิกชุดแล้ว" });
  } catch (err) {
    console.error("[Route /other/lots/:id/sets/:setId/cancel] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// edit the prepared weight of a lot (needs the edit password): { weight_kg, password, user? }
//   not less than what already went into the cold room
router.put("/other/lots/:id/weight", async (req, res) => {
  const lotId = parseInt(req.params.id, 10);
  const weight = toNum(req.body.weight_kg);
  if (Number.isNaN(lotId)) return res.status(400).json({ success: false, error: "ข้อมูลไม่ถูกต้อง" });
  if (!(weight > 0)) return res.status(400).json({ success: false, error: "น้ำหนักต้องมากกว่า 0" });
  if (!editPasswordOk(req.body.password)) {
    logger.warn("other_bad_password", { id: req.id, action: "weight", lot: lotId });
    return res.status(401).json({ success: false, error: "รหัสไม่ถูกต้อง" });
  }
  let transaction;
  try {
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const lot = await new sql.Request(transaction).input("id", sql.Int, lotId).query("SELECT weight_kg, closed FROM OtherLot WHERE lot_id = @id");
    const l = lot.recordset[0];
    if (!l) { await safeRollback(transaction); return res.status(404).json({ success: false, error: "ไม่พบรายการ" }); }
    if (l.closed) { await safeRollback(transaction); return res.status(400).json({ success: false, error: "รายการนี้ปิดแล้ว (recall ก่อนแก้ไข)" }); }
    const kg = await lotKg(new sql.Request(transaction), lotId);
    if (weight + 1e-6 < kg.kgIn) { await safeRollback(transaction); return res.status(400).json({ success: false, error: `น้ำหนักต้องไม่น้อยกว่าที่เข้าห้องเย็นแล้ว ${kg.kgIn.toFixed(2)} kg` }); }
    const old = Number(l.weight_kg);
    const by = who(req);
    await new sql.Request(transaction).input("id", sql.Int, lotId).input("w", sql.Decimal(12, 2), weight).query("UPDATE OtherLot SET weight_kg = @w WHERE lot_id = @id");
    await addLog(new sql.Request(transaction), lotId, "EDIT_WEIGHT", `น้ำหนัก ${old} → ${weight} kg`, by);
    await transaction.commit();
    res.json({ success: true, message: "แก้ไขน้ำหนักแล้ว" });
  } catch (err) {
    if (transaction) { try { await safeRollback(transaction); } catch (e) { /* already closed */ } }
    console.error("[Route /other/lots/:id/weight] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// close a lot (finished / not tracked any more): it leaves the work page and goes to the History page
router.put("/other/lots/:id/close", async (req, res) => {
  try {
    const lotId = parseInt(req.params.id, 10);
    if (Number.isNaN(lotId)) return res.status(400).json({ success: false, error: "ข้อมูลไม่ถูกต้อง" });
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    const by = who(req);
    const r = await pool.request().input("id", sql.Int, lotId).input("by", sql.NVarChar(100), by)
      .query("UPDATE OtherLot SET closed = 1, closed_at = GETDATE(), closed_by = @by WHERE lot_id = @id AND closed = 0");
    if (!r.rowsAffected[0]) return res.status(404).json({ success: false, error: "ไม่พบรายการ หรือปิดไปแล้ว" });
    await addLog(pool.request(), lotId, "CLOSE", "ปิดรายการ (ย้ายไปหน้า History)", by);
    res.json({ success: true, message: "ปิดรายการแล้ว" });
  } catch (err) {
    console.error("[Route /other/lots/:id/close] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// recall a closed lot from the History page back to the work page
router.put("/other/lots/:id/recall", async (req, res) => {
  try {
    const lotId = parseInt(req.params.id, 10);
    if (Number.isNaN(lotId)) return res.status(400).json({ success: false, error: "ข้อมูลไม่ถูกต้อง" });
    const pool = await connectToDatabase();
    if (!pool) return res.status(503).json({ success: false, error: "Database unavailable" });
    await ensureTables(pool);
    const by = who(req);
    const r = await pool.request().input("id", sql.Int, lotId)
      .query("UPDATE OtherLot SET closed = 0, closed_at = NULL, closed_by = NULL WHERE lot_id = @id AND closed = 1");
    if (!r.rowsAffected[0]) return res.status(404).json({ success: false, error: "ไม่พบรายการ หรือไม่ได้ปิดอยู่" });
    await addLog(pool.request(), lotId, "RECALL", "recall กลับหน้าหลัก", by);
    res.json({ success: true, message: "recall แล้ว" });
  } catch (err) {
    console.error("[Route /other/lots/:id/recall] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
