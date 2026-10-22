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
 * remark of each key: { mapping: { [mapping_id]: text }, hu: { [hu]: text }, matBatch: { ["MAT|BATCH"]: text } } — keys without a remark are left out.
 * mapping -> its HU (History.hu, else RMForProd.hu) · mat + batch -> the SAP_Receive row of that mat and batch
 */
const remarkCsOf = async (pool, { mappingIds = "", hus = "", keys = "" }) => {
  await ensureRemarkCsColumn(pool);
  const out = { mapping: {}, hu: {}, matBatch: {} };
  const ids = toIds(mappingIds);
  if (ids.length) {
    const req = pool.request();
    const ph = ids.map((id, i) => { req.input(`m${i}`, sql.Int, id); return `@m${i}`; }).join(",");
    const r = await req.query(`
      SELECT rmm.mapping_id, s.remark_cs
      FROM TrolleyRMMapping rmm WITH (NOLOCK)
      LEFT JOIN RMForProd rmf WITH (NOLOCK) ON rmf.rmfp_id = rmm.rmfp_id
      OUTER APPLY (SELECT TOP (1) hh.hu FROM History hh WITH (NOLOCK) WHERE hh.mapping_id = rmm.mapping_id ORDER BY hh.hist_id DESC) h
      CROSS APPLY (
        SELECT TOP (1) sr.remark_cs FROM SAP_Receive sr WITH (NOLOCK)
        WHERE sr.hu = TRY_CONVERT(INT, COALESCE(NULLIF(CAST(h.hu AS NVARCHAR(50)), N''), NULLIF(CAST(rmf.hu AS NVARCHAR(50)), N'')))
          AND sr.remark_cs IS NOT NULL
        ORDER BY sr.status DESC
      ) s
      WHERE rmm.mapping_id IN (${ph})`);
    r.recordset.forEach((x) => { if (x.remark_cs) out.mapping[x.mapping_id] = x.remark_cs; });
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

module.exports = { ensureRemarkCsColumn, remarkCsOf, cleanRemarkCs: clean };
