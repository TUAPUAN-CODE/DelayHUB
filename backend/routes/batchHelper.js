// Batch rows of a TrolleyRMMapping. The Master Sheet / many pages read the batch from the Batch table (by mapping_id), so every route that creates a
// mapping must also write it. Shared by the routes that used to create a mapping without a Batch row.
// All helpers are best effort: a failure is logged and never aborts the caller's transaction (the batch is display data, not the saved operation).
const sql = require("mssql");

const clean = (v) => String(v ?? "").trim();
const splitList = (v) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map(clean).filter(Boolean);

/** Batch rows sent by the front: batchAfterArray [{batch_before, batch_after}] · or batch_after / batch (one value, a comma list or an array) with an optional batch_before */
const rowsFromBody = (body = {}) => {
  const out = [];
  if (Array.isArray(body.batchAfterArray)) {
    body.batchAfterArray.forEach((it) => {
      const after = clean(it?.batch_after);
      if (after) out.push({ before: clean(it?.batch_before) || after, after });
    });
  }
  if (!out.length) {
    const afters = splitList(body.batch_after ?? body.batch);
    const befores = splitList(body.batch_before);
    afters.forEach((after, i) => out.push({ before: befores[i] || befores[0] || after, after }));
  }
  return out;
};

const addRows = async (transaction, mappingId, rows) => {
  for (const r of rows) {
    await new sql.Request(transaction)
      .input("mapping_id", sql.Int, mappingId)
      .input("batch_before", sql.NVarChar(100), r.before.slice(0, 100))
      .input("batch_after", sql.NVarChar(100), r.after.slice(0, 100))
      .query("INSERT INTO Batch (mapping_id, batch_before, batch_after) VALUES (@mapping_id, @batch_before, @batch_after)");
  }
  return rows.length;
};

/** the batch of the production plan row (RMForProd.batch, may be a comma list) */
const rowsFromPlan = async (transaction, rmfpId) => {
  if (!rmfpId) return [];
  const r = await new sql.Request(transaction)
    .input("rmfp_id", sql.Int, rmfpId)
    .query("SELECT batch FROM RMForProd WHERE rmfp_id = @rmfp_id");
  return splitList(r.recordset[0]?.batch).map((b) => ({ before: b, after: b }));
};

/** new mapping created from the plan: batch from the front if it sent one, else the plan's own batch */
const saveBatchRows = async (transaction, mappingId, body, rmfpId) => {
  try {
    let rows = rowsFromBody(body);
    if (!rows.length) rows = await rowsFromPlan(transaction, rmfpId);
    return await addRows(transaction, mappingId, rows);
  } catch (err) {
    console.error(`[batchHelper] saveBatchRows mapping ${mappingId}:`, err.message);
    return 0;
  }
};

/** new mapping split / moved from another one: same batch rows as the source; the front's batch (if any) or the plan's batch when the source has none */
const copyBatchRows = async (transaction, fromMappingId, toMappingId, body, rmfpId) => {
  try {
    const fromId = Number(fromMappingId);
    if (Number.isInteger(fromId) && fromId > 0) {
      const r = await new sql.Request(transaction)
        .input("from_id", sql.Int, fromId)
        .input("to_id", sql.Int, toMappingId)
        .query("INSERT INTO Batch (mapping_id, batch_before, batch_after) SELECT @to_id, batch_before, batch_after FROM Batch WHERE mapping_id = @from_id");
      if (r.rowsAffected[0] > 0) return r.rowsAffected[0];
    }
    return await saveBatchRows(transaction, toMappingId, body, rmfpId);
  } catch (err) {
    console.error(`[batchHelper] copyBatchRows ${fromMappingId} -> ${toMappingId}:`, err.message);
    return 0;
  }
};

module.exports = { rowsFromBody, saveBatchRows, copyBatchRows };
