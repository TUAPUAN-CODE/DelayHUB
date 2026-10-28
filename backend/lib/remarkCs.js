// Remark CS: one note per HU (SAP_Receive.remark_cs), typed when the preparation receives the HU from the big cold room
// (POST /api/prep/checkin/sap, page /prep/Sheet) and printed on every slip of the system (GET /api/prep/remark-cs).
// The column is added here on first use (and by migrations/auto/003_sap_remark_cs.sql): nothing else has to be run on the database.
const sql = require("mssql");

let ensured = null;
/** adds SAP_Receive.remark_cs when it is missing (once per process; two workers at the same time: "already exists" is fine) */
const ensureRemarkCsColumn = (pool) => {
  if (!ensured) {
    ensured = pool.request()
      .query("IF COL_LENGTH(N'dbo.SAP_Receive', N'remark_cs') IS NULL ALTER TABLE dbo.SAP_Receive ADD remark_cs NVARCHAR(500) NULL;")
      .catch((err) => {
        if (err && (err.number === 2705 || /already|unique/i.test(err.message || ""))) return null; // added by another worker meanwhile
        ensured = null;
        throw err;
      });
  }
  return ensured;
};

const clean = (v) => {
  if (v === undefined || v === null) return null;
  const t = String(v).trim().slice(0, 500);
  return t === "" ? null : t;
};

const MAX_KEYS = 100;
const INT_MAX = 2147483647; // mapping_id and SAP_Receive.hu are INT: a bigger number (e.g. the HU of a packaging slip) cannot be one of them
const toIds = (raw) => [...new Set(String(raw || "").split(",").map((x) => Number(String(x).trim())).filter((n) => Number.isInteger(n) && n > 0 && n <= INT_MAX))].slice(0, MAX_KEYS);
const toPairs = (raw) => [...new Set(String(raw || "").split(",").map((x) => x.trim()).filter((x) => x.includes("|")))].slice(0, MAX_KEYS)
  .map((k) => { const [mat, batch] = k.split("|"); return { key: k, mat: mat.trim(), batch: batch.trim() }; })
  .filter((p) => p.mat && p.batch);

/**
 * remark of each key: { mapping: { [mapping_id]: text }, mappingHu: { [mapping_id]: the HU that note belongs to }, hu: { [hu]: text }, matBatch: { ["MAT|BATCH"]: text } } — keys without a remark are left out.
 * mapping -> its HU (History.hu, else RMForProd.hu) · mat + batch -> the SAP_Receive row of that mat and batch
 */
const remarkCsOf = async (pool, { mappingIds = "", hus = "", keys = "" }) => {
  await ensureRemarkCsColumn(pool);
  const out = { mapping: {}, mappingHu: {}, hu: {}, matBatch: {} };
  const ids = toIds(mappingIds);
  if (ids.length) {
    const req = pool.request();
    const ph = ids.map((id, i) => { req.input(`m${i}`, sql.Int, id); return `@m${i}`; }).join(",");
    const r = await req.query(`
      SELECT rmm.mapping_id, s.remark_cs, s.hu
      FROM TrolleyRMMapping rmm WITH (NOLOCK)
      LEFT JOIN RMForProd rmf WITH (NOLOCK) ON rmf.rmfp_id = rmm.rmfp_id
      OUTER APPLY (SELECT TOP (1) hh.hu FROM History hh WITH (NOLOCK) WHERE hh.mapping_id = rmm.mapping_id ORDER BY hh.hist_id DESC) h
      CROSS APPLY (
        SELECT TOP (1) sr.remark_cs, sr.hu FROM SAP_Receive sr WITH (NOLOCK)
        WHERE sr.hu = TRY_CONVERT(INT, COALESCE(NULLIF(CAST(h.hu AS NVARCHAR(50)), N''), NULLIF(CAST(rmf.hu AS NVARCHAR(50)), N'')))
          AND sr.remark_cs IS NOT NULL
        ORDER BY sr.status DESC
      ) s
      WHERE rmm.mapping_id IN (${ph})`);
    r.recordset.forEach((x) => { if (x.remark_cs) { out.mapping[x.mapping_id] = x.remark_cs; out.mappingHu[x.mapping_id] = x.hu; } });
  }
  const huList = toIds(hus);
  if (huList.length) {
    const req = pool.request();
    const ph = huList.map((h, i) => { req.input(`h${i}`, sql.Int, h); return `@h${i}`; }).join(",");
    const r = await req.query(`
      SELECT sr.hu, MAX(sr.remark_cs) AS remark_cs
      FROM SAP_Receive sr WITH (NOLOCK)
      WHERE sr.hu IN (${ph}) AND sr.remark_cs IS NOT NULL
      GROUP BY sr.hu`);
    r.recordset.forEach((x) => { if (x.remark_cs) out.hu[x.hu] = x.remark_cs; });
  }
  const pairs = toPairs(keys);
  if (pairs.length) {
    const req = pool.request();
    const where = pairs.map((p, i) => {
      req.input(`pm${i}`, sql.NVarChar(50), p.mat).input(`pb${i}`, sql.NVarChar(50), p.batch);
      return `(sr.mat = @pm${i} AND sr.batch = @pb${i})`;
    }).join(" OR ");
    const r = await req.query(`
      SELECT CONCAT(sr.mat, N'|', sr.batch) AS k, MAX(sr.remark_cs) AS remark_cs
      FROM SAP_Receive sr WITH (NOLOCK)
      WHERE (${where}) AND sr.remark_cs IS NOT NULL
      GROUP BY sr.mat, sr.batch`);
    // the key the page sent (its case / spaces) gets the remark
    const byNorm = new Map(r.recordset.map((x) => [String(x.k).trim().toUpperCase(), x.remark_cs]));
    pairs.forEach((p) => { const t = byNorm.get(`${p.mat}|${p.batch}`.toUpperCase()); if (t) out.matBatch[p.key] = t; });
  }
  return out;
};

// ── history of the notes: who typed / changed the Remark CS of which HU, when and from which page (table RemarkCsLog, made on first use) ──
let logEnsured = null;
const ensureRemarkCsLogTable = (pool) => {
  if (!logEnsured) {
    logEnsured = pool.request().query(`
      IF OBJECT_ID(N'dbo.RemarkCsLog', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.RemarkCsLog (
          log_id     BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RemarkCsLog PRIMARY KEY,
          hu         INT           NOT NULL,
          mat        NVARCHAR(50)  NULL,
          batch      NVARCHAR(50)  NULL,
          mapping_id INT           NULL,
          old_value  NVARCHAR(500) NULL,
          new_value  NVARCHAR(500) NULL,
          source     NVARCHAR(40)  NULL,
          user_id    INT           NULL,
          username   NVARCHAR(100) NULL,
          created_at DATETIME      NOT NULL CONSTRAINT DF_RemarkCsLog_at DEFAULT (GETDATE())
        );
        CREATE INDEX IX_RemarkCsLog_hu ON dbo.RemarkCsLog (hu, log_id DESC);
      END`)
      .catch((err) => {
        if (err && (err.number === 2714 || err.number === 1913 || /already/i.test(err.message || ""))) return null; // made by another worker meanwhile
        logEnsured = null;
        throw err;
      });
  }
  return logEnsured;
};

/** the note a HU has now (the active receive row first) with its mat / batch — read before it is changed */
const currentRemarkCs = async (pool, hu) => {
  await ensureRemarkCsColumn(pool);
  const r = await pool.request().input("hu", sql.Int, hu)
    .query("SELECT TOP (1) sr.remark_cs, sr.mat, sr.batch FROM SAP_Receive sr WITH (NOLOCK) WHERE sr.hu = @hu ORDER BY sr.status DESC, sr.sap_re_id DESC");
  return r.recordset[0] || null;
};

/** writes one line to RemarkCsLog when the note really changed. Never throws: the history must not stop the work of the production floor. */
const logRemarkCsChange = async (pool, { hu, before, after, source, user, mappingId }) => {
  try {
    const oldText = clean(before?.remark_cs);
    const newText = clean(after);
    if (oldText === newText) return;
    await ensureRemarkCsLogTable(pool);
    const mid = Number(mappingId);
    await pool.request()
      .input("hu", sql.Int, hu).input("mat", sql.NVarChar(50), before?.mat ? String(before.mat).slice(0, 50) : null)
      .input("batch", sql.NVarChar(50), before?.batch ? String(before.batch).slice(0, 50) : null)
      .input("mid", sql.Int, Number.isInteger(mid) && mid > 0 ? mid : null)
      .input("ov", sql.NVarChar(500), oldText).input("nv", sql.NVarChar(500), newText)
      .input("src", sql.NVarChar(40), source ? String(source).slice(0, 40) : null)
      .input("uid", sql.Int, Number.isInteger(user?.user_id) ? user.user_id : null)
      .input("un", sql.NVarChar(100), user?.username ? String(user.username).slice(0, 100) : null)
      .query(`INSERT INTO RemarkCsLog (hu, mat, batch, mapping_id, old_value, new_value, source, user_id, username)
              VALUES (@hu, @mat, @batch, @mid, @ov, @nv, @src, @uid, @un)`);
  } catch (err) {
    console.error("❌ [RemarkCs] บันทึกประวัติ Remark CS ไม่สำเร็จ:", err.message);
  }
};

/**
 * every HU of these batches with its note now, the mappings that use the HU and the history of the note:
 * [{ batch, hu, mat, status, remark_cs, mapping_ids: [], history: [{ log_id, old_value, new_value, source, username, mapping_id, created_at }] }]
 */
const remarkCsByBatch = async (pool, batchesRaw) => {
  await ensureRemarkCsColumn(pool);
  const batches = [...new Set(String(batchesRaw || "").split(",").map((b) => b.trim()).filter(Boolean))].slice(0, MAX_KEYS);
  if (!batches.length) return [];
  const req = pool.request();
  const ph = batches.map((b, i) => { req.input(`b${i}`, sql.NVarChar(50), b); return `@b${i}`; }).join(",");
  const hus = (await req.query(`
    SELECT sr.batch, sr.hu, MAX(sr.mat) AS mat, MAX(sr.status) AS status, MAX(sr.remark_cs) AS remark_cs
    FROM SAP_Receive sr WITH (NOLOCK)
    WHERE sr.batch IN (${ph}) AND sr.hu IS NOT NULL
    GROUP BY sr.batch, sr.hu ORDER BY sr.batch, sr.hu`)).recordset;
  if (!hus.length) return [];
  const huIds = [...new Set(hus.map((h) => h.hu))].slice(0, 300);

  const mapReq = pool.request();
  const hph = huIds.map((h, i) => { mapReq.input(`h${i}`, sql.NVarChar(50), String(h)); return `@h${i}`; }).join(",");
  const mapRows = (await mapReq.query(`
    SELECT x.hu, x.mapping_id FROM (
      SELECT CAST(rmf.hu AS NVARCHAR(50)) AS hu, rmm.mapping_id
      FROM RMForProd rmf WITH (NOLOCK) JOIN TrolleyRMMapping rmm WITH (NOLOCK) ON rmm.rmfp_id = rmf.rmfp_id
      WHERE CAST(rmf.hu AS NVARCHAR(50)) IN (${hph})
      UNION
      SELECT CAST(hh.hu AS NVARCHAR(50)), hh.mapping_id
      FROM History hh WITH (NOLOCK) WHERE CAST(hh.hu AS NVARCHAR(50)) IN (${hph})
    ) x`)).recordset;
  const mapsOf = new Map();
  mapRows.forEach((m) => { const k = String(m.hu).trim(); if (!mapsOf.has(k)) mapsOf.set(k, []); mapsOf.get(k).push(m.mapping_id); });

  let logs = [];
  try {
    await ensureRemarkCsLogTable(pool);
    const lr = pool.request();
    const lph = huIds.map((h, i) => { lr.input(`l${i}`, sql.Int, h); return `@l${i}`; }).join(",");
    logs = (await lr.query(`
      SELECT TOP (500) l.log_id, l.hu, l.mapping_id, l.old_value, l.new_value, l.source, l.username,
             CONVERT(VARCHAR(19), l.created_at, 120) AS created_at
      FROM RemarkCsLog l WITH (NOLOCK) WHERE l.hu IN (${lph}) ORDER BY l.log_id DESC`)).recordset;
  } catch (err) {
    console.error("❌ [RemarkCs] อ่านประวัติ Remark CS ไม่สำเร็จ:", err.message);
  }
  const logsOf = new Map();
  logs.forEach((l) => { if (!logsOf.has(l.hu)) logsOf.set(l.hu, []); logsOf.get(l.hu).push(l); });

  return hus.map((h) => ({
    batch: h.batch, hu: h.hu, mat: h.mat, status: h.status, remark_cs: h.remark_cs || "",
    mapping_ids: (mapsOf.get(String(h.hu)) || []).sort((a, b) => a - b).slice(0, 100),
    history: logsOf.get(h.hu) || [],
  }));
};

module.exports = { ensureRemarkCsColumn, remarkCsOf, cleanRemarkCs: clean, currentRemarkCs, logRemarkCsChange, remarkCsByBatch };
