// Which new mapping_ids a mapping became, and where a mapping came from — the "ค้นหา mapping_id" page (GET /api/sheet/lineage).
//   kept in table MappingLineage (made here on first use, and by migrations/auto/004_mapping_lineage.sql) for the moves that keep no link of their own:
//     "กลับมาเตรียม" (POST /api/prep/matimport/add/saveTrolley — it deletes the old mapping) · "ย้ายไปรถเข็นอื่น" (ห้องเย็น addRawMatToTrolley / moveRawmatintolley)
//   already in the data: TrolleyRMMapping.from_mapping_id (ใส่รถเข็นที่บรรจุ, แบ่งน้ำหนักไปรถเข็นอื่น …), RM_Mix_loaf, RM_MixPeck, RM_MixInclude (+ MixToPack)
const sql = require("mssql");

const KIND_LABEL = {
  reprep: "กลับมาเตรียม",
  move: "ย้ายไปรถเข็นอื่น",
  split: "สร้างต่อจากรายการนี้",
  loaf: "ทำเป็น Loaf",
  mixpeck: "ผสมเข้าแผนใหม่",
  mixinclude: "รวมเข้าแผนใหม่ (Include)",
  sameplan: "แผนผลิตเดียวกัน สร้างทีหลัง",
};
const KINDS = Object.keys(KIND_LABEL);

const TABLE_SQL = `
IF OBJECT_ID(N'dbo.MappingLineage', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MappingLineage (
        lineage_id      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MappingLineage PRIMARY KEY,
        from_mapping_id INT           NOT NULL,
        to_mapping_id   INT           NOT NULL,
        kind            NVARCHAR(20)  NOT NULL,
        created_by      NVARCHAR(100) NULL,
        created_at      DATETIME      NOT NULL CONSTRAINT DF_MappingLineage_created_at DEFAULT (GETDATE())
    );
    CREATE NONCLUSTERED INDEX IX_MappingLineage_from ON dbo.MappingLineage (from_mapping_id);
    CREATE NONCLUSTERED INDEX IX_MappingLineage_to ON dbo.MappingLineage (to_mapping_id);
END`;

let ensured = null;
/** makes table MappingLineage when it is missing (once per process; made by another worker at the same time = fine) */
const ensureLineageTable = (pool) => {
  if (!ensured) {
    ensured = pool.request().query(TABLE_SQL).catch((err) => {
      if (err && (err.number === 2714 || err.number === 1913)) return null; // "already an object named …": made by another worker meanwhile
      ensured = null;
      throw err;
    });
  }
  return ensured;
};

const INT_MAX = 2147483647;
const toId = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n <= INT_MAX ? n : null; };

/**
 * Writes "from -> to" links: [{ from, to, kind }] (or one link). Called AFTER the work is committed, best effort:
 * a failure is logged and never thrown — the new mapping is already saved, the link is only for looking it up.
 */
const recordLineage = async (pool, links, by) => {
  const list = (Array.isArray(links) ? links : [links])
    .map((l) => l && { from: toId(l.from), to: toId(l.to), kind: KIND_LABEL[l.kind] ? l.kind : null })
    .filter((l) => l && l.from && l.to && l.kind && l.from !== l.to);
  if (!list.length || !pool) return false;
  try {
    await ensureLineageTable(pool);
    const req = pool.request().input("by", sql.NVarChar(100), by ? String(by).slice(0, 100) : null);
    const values = list.map((l, i) => {
      req.input(`f${i}`, sql.Int, l.from).input(`t${i}`, sql.Int, l.to).input(`k${i}`, sql.NVarChar(20), l.kind);
      return `(@f${i}, @t${i}, @k${i}, @by)`;
    }).join(", ");
    await req.query(`INSERT INTO dbo.MappingLineage (from_mapping_id, to_mapping_id, kind, created_by) VALUES ${values}`);
    return true;
  } catch (err) {
    console.error("❌ [mappingLineage] record error:", err.message);
    return false;
  }
};

// what the page shows of a linked mapping (the mapping may be gone: the link of a recorded move is kept, cm.* is NULL then)
const LINK_COLS = `
    cm.mapping_id AS found_id, CAST(cm.tro_id AS NVARCHAR(20)) AS tro_id, cm.weight_RM, cm.tray_count, cm.rm_status, cm.stay_place, cm.dest, cm.rmm_line_name,
    pr.mat, rm.mat_name, p.doc_no,
    COALESCE(NULLIF(bt.batch_after, N''), NULLIF(CAST(cm.production_batch AS NVARCHAR(200)), N''), NULLIF(CAST(rf.batch AS NVARCHAR(200)), N'')) AS batch,
    CONVERT(VARCHAR(19), cm.created_at, 120) AS created_at`;
const LINK_JOINS = `
    LEFT JOIN RMForProd rf WITH (NOLOCK) ON rf.rmfp_id = cm.rmfp_id
    LEFT JOIN ProdRawMat pr WITH (NOLOCK) ON pr.prod_rm_id = cm.tro_production_id
    LEFT JOIN RawMat rm WITH (NOLOCK) ON rm.mat = pr.mat
    LEFT JOIN Production p WITH (NOLOCK) ON p.prod_id = pr.prod_id
    OUTER APPLY (SELECT TOP (1) b.batch_after FROM Batch b WITH (NOLOCK) WHERE b.mapping_id = cm.mapping_id ORDER BY b.batch_id DESC) bt`;

// children: the mappings made from @id (one query per way the system makes them; a table / column missing in this database only skips that way)
const CHILD_SOURCES = [
  ["recorded", `
    SELECT TOP (200) ml.kind, ml.to_mapping_id AS link_id, CONVERT(VARCHAR(19), ml.created_at, 120) AS linked_at, ml.created_by AS linked_by, ${LINK_COLS}
    FROM dbo.MappingLineage ml WITH (NOLOCK)
    LEFT JOIN TrolleyRMMapping cm WITH (NOLOCK) ON cm.mapping_id = ml.to_mapping_id
    ${LINK_JOINS}
    WHERE ml.from_mapping_id = @id
    ORDER BY ml.lineage_id`],
  ["split", `
    SELECT TOP (200) N'split' AS kind, cm.mapping_id AS link_id, NULL AS linked_at, NULL AS linked_by, ${LINK_COLS}
    FROM TrolleyRMMapping cm WITH (NOLOCK)
    ${LINK_JOINS}
    WHERE cm.from_mapping_id = @id
    ORDER BY cm.mapping_id`],
  ["loaf", `
    SELECT TOP (200) N'loaf' AS kind, x.mapping_id AS link_id, NULL AS linked_at, NULL AS linked_by, ${LINK_COLS}
    FROM (SELECT DISTINCT l.mapping_id FROM RM_Mix_loaf l WITH (NOLOCK) WHERE l.mapping_id_source = @id) x
    LEFT JOIN TrolleyRMMapping cm WITH (NOLOCK) ON cm.mapping_id = x.mapping_id
    ${LINK_JOINS}
    ORDER BY x.mapping_id`],
  // mixed into a new production plan: every mapping of that plan
  ["mixpeck", `
    SELECT TOP (200) N'mixpeck' AS kind, cm.mapping_id AS link_id, NULL AS linked_at, NULL AS linked_by, ${LINK_COLS}
    FROM (SELECT DISTINCT k.rmfp_id FROM RM_MixPeck k WITH (NOLOCK) WHERE k.mapping_id = @id) x
    JOIN TrolleyRMMapping cm WITH (NOLOCK) ON cm.rmfp_id = x.rmfp_id
    ${LINK_JOINS}
    WHERE cm.mapping_id <> @id
    ORDER BY cm.mapping_id`],
  // QC sent it to MixToPack (from_mapping_id), then it was included into a new plan: RM_MixInclude keeps mixtp_id (old rows) or MixToPack.mapping_id (newer rows)
  ["mixinclude_tp", `
    SELECT TOP (200) N'mixinclude' AS kind, cm.mapping_id AS link_id, NULL AS linked_at, NULL AS linked_by, ${LINK_COLS}
    FROM (SELECT DISTINCT i.rmfp_id FROM MixToPack mtp WITH (NOLOCK) JOIN RM_MixInclude i WITH (NOLOCK) ON i.mixtp_id = mtp.mixtp_id WHERE mtp.from_mapping_id = @id) x
    JOIN TrolleyRMMapping cm WITH (NOLOCK) ON cm.rmfp_id = x.rmfp_id
    ${LINK_JOINS}
    WHERE cm.mapping_id <> @id
    ORDER BY cm.mapping_id`],
  ["mixinclude_map", `
    SELECT TOP (200) N'mixinclude' AS kind, cm.mapping_id AS link_id, NULL AS linked_at, NULL AS linked_by, ${LINK_COLS}
    FROM (SELECT DISTINCT i.rmfp_id FROM MixToPack mtp WITH (NOLOCK) JOIN RM_MixInclude i WITH (NOLOCK) ON i.mapping_id = mtp.mapping_id WHERE mtp.from_mapping_id = @id) x
    JOIN TrolleyRMMapping cm WITH (NOLOCK) ON cm.rmfp_id = x.rmfp_id
    ${LINK_JOINS}
    WHERE cm.mapping_id <> @id
    ORDER BY cm.mapping_id`],
];

// parents: what @id was made from (to walk back from a new mapping)
const PARENT_SOURCES = [
  ["recorded", `
    SELECT TOP (50) ml.kind, ml.from_mapping_id AS link_id, CONVERT(VARCHAR(19), ml.created_at, 120) AS linked_at, ml.created_by AS linked_by, ${LINK_COLS}
    FROM dbo.MappingLineage ml WITH (NOLOCK)
    LEFT JOIN TrolleyRMMapping cm WITH (NOLOCK) ON cm.mapping_id = ml.from_mapping_id
    ${LINK_JOINS}
    WHERE ml.to_mapping_id = @id
    ORDER BY ml.lineage_id`],
  ["split", `
    SELECT TOP (1) N'split' AS kind, me.from_mapping_id AS link_id, NULL AS linked_at, NULL AS linked_by, ${LINK_COLS}
    FROM TrolleyRMMapping me WITH (NOLOCK)
    LEFT JOIN TrolleyRMMapping cm WITH (NOLOCK) ON cm.mapping_id = me.from_mapping_id
    ${LINK_JOINS}
    WHERE me.mapping_id = @id AND me.from_mapping_id IS NOT NULL`],
  ["loaf", `
    SELECT TOP (50) N'loaf' AS kind, x.mapping_id_source AS link_id, NULL AS linked_at, NULL AS linked_by, ${LINK_COLS}
    FROM (SELECT DISTINCT l.mapping_id_source FROM RM_Mix_loaf l WITH (NOLOCK) WHERE l.mapping_id = @id) x
    LEFT JOIN TrolleyRMMapping cm WITH (NOLOCK) ON cm.mapping_id = x.mapping_id_source
    ${LINK_JOINS}
    ORDER BY x.mapping_id_source`],
];

// mappings of the same production plan made after @id: not linked to it, but where its material may have gone when somebody put a new trolley
// from the plan instead of "กลับมาเตรียม" (the page shows them apart, as "may be related")
const SAME_PLAN_SQL = `
    SELECT TOP (30) N'sameplan' AS kind, cm.mapping_id AS link_id, NULL AS linked_at, NULL AS linked_by, ${LINK_COLS}
    FROM TrolleyRMMapping cm WITH (NOLOCK)
    ${LINK_JOINS}
    WHERE cm.rmfp_id = @rmfp AND cm.mapping_id > @id
    ORDER BY cm.mapping_id`;

const shape = (r) => ({
  kind: r.kind,
  kind_label: KIND_LABEL[r.kind] || r.kind,
  mapping_id: r.link_id,
  exists: r.found_id !== null && r.found_id !== undefined,
  tro_id: r.tro_id, weight_RM: r.weight_RM, tray_count: r.tray_count, rm_status: r.rm_status, stay_place: r.stay_place, dest: r.dest,
  rmm_line_name: r.rmm_line_name, mat: r.mat, mat_name: r.mat_name, doc_no: r.doc_no, batch: r.batch, created_at: r.created_at,
  linked_at: r.linked_at, linked_by: r.linked_by,
});

const isMissing = (err) => err && (err.number === 208 || err.number === 207); // invalid object / column name: this database has no such table / column

/** { mapping_id, exists, rmfp_id, children: [...], parents: [...], same_plan: [...], errors } — a mapping is listed once (first way found) */
const lineageOf = async (pool, id) => {
  const errors = {};
  const run = async (key, text, inputs = {}) => {
    try {
      const req = pool.request().input("id", sql.Int, id);
      Object.entries(inputs).forEach(([k, v]) => req.input(k, sql.Int, v));
      return (await req.query(text)).recordset.map(shape);
    } catch (err) {
      if (!isMissing(err)) console.error(`❌ [mappingLineage] ${key} error:`, err.message);
      errors[key] = err.message;
      return [];
    }
  };
  const head = (await pool.request().input("id", sql.Int, id)
    .query("SELECT TOP (1) rmm.mapping_id, rmm.rmfp_id FROM TrolleyRMMapping rmm WITH (NOLOCK) WHERE rmm.mapping_id = @id")).recordset[0] || null;

  // one after the other: a page lookup must not take many connections of the pool at once
  const childLists = [];
  for (const [key, text] of CHILD_SOURCES) childLists.push(await run(`child_${key}`, text)); // eslint-disable-line no-await-in-loop
  const parentLists = [];
  for (const [key, text] of PARENT_SOURCES) parentLists.push(await run(`parent_${key}`, text)); // eslint-disable-line no-await-in-loop
  const seen = new Set([id]);
  const once = (list) => list.filter((x) => (seen.has(x.mapping_id) ? false : (seen.add(x.mapping_id), true)));
  const byKind = (a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind);
  const children = once(childLists.flat().sort(byKind));
  const parents = once(parentLists.flat().sort(byKind));
  const samePlan = head && head.rmfp_id ? once(await run("same_plan", SAME_PLAN_SQL, { rmfp: head.rmfp_id })) : [];
  return { mapping_id: id, exists: !!head, rmfp_id: head?.rmfp_id ?? null, children, parents, same_plan: samePlan, errors };
};

module.exports = { ensureLineageTable, recordLineage, lineageOf, KIND_LABEL };
