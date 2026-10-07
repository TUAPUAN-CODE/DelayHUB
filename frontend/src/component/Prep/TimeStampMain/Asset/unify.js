/**
 * One table for what used to be 4 pages: the SAP rows of the day (receive / boil-bake / return time stamps) and the production-plan rows
 * of "จัดการวัตถุดิบ" (RMForProd) that belong to the same material + batch.
 *
 * A SAP row gets every RMForProd row whose `mat` is the same and whose batch (or one of its mixed batches) is the SAP batch.
 * RMForProd rows that match no SAP row of the day (e.g. received on another day) stay visible as rows of their own, so nothing waiting to be
 * managed disappears from the screen.
 */
const norm = (v) => String(v ?? '').trim().toUpperCase();
const batchesOf = (r) => (Array.isArray(r.batchArray) && r.batchArray.length ? r.batchArray : String(r.batch ?? '').split(',')).map(norm).filter(Boolean);

export function buildUnifiedRows(sapRows = [], rmfpRows = []) {
  const byKey = new Map();   // "MAT|BATCH" → rmfp rows
  for (const r of rmfpRows) for (const b of batchesOf(r)) { const k = `${norm(r.mat)}|${b}`; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(r); }
  const used = new Set();
  const rows = sapRows.map((sap) => {
    const hit = byKey.get(`${norm(sap.mat)}|${norm(sap.batch)}`) ?? [];
    const rmfps = [...new Map(hit.map((r) => [r.rmfp_id, r])).values()];
    rmfps.forEach((r) => used.add(r.rmfp_id));
    return { key: `sap-${sap.sap_re_id}`, sap, rmfps, batch: sap.batch, mat: sap.mat, mat_name: rmfps[0]?.mat_name ?? '' };
  });
  // production rows without a SAP row today: one row per material + batch
  const loose = new Map();
  for (const r of rmfpRows) {
    if (used.has(r.rmfp_id)) continue;
    const k = `${norm(r.mat)}|${norm(r.batch)}`;
    if (!loose.has(k)) loose.set(k, { key: `rmfp-${r.rmfp_id}`, sap: null, rmfps: [], batch: r.batch, mat: r.mat, mat_name: r.mat_name });
    loose.get(k).rmfps.push(r);
  }
  return [...rows, ...loose.values()];
}

/** Text the search box looks at */
export const searchText = (row) => [row.batch, row.mat, row.mat_name, row.sap?.hu, row.sap?.remark, ...row.rmfps.flatMap((r) => [r.production, r.rm_group_name, r.level_eu, r.remark])].filter(Boolean).join(' ').toLowerCase();
