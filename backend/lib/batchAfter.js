// Batch แปลง (Batch.batch_after) typed in the forms of "รอเตรียมวัตถุดิบใหม่" (ใส่รถเข็น (รอแก้ไข) / กลับมาเตรียม / แก้ไข)
// body field: batchAfterArray = [{ batch_before, batch_after }]  (the same shape the "ใส่รถเข็น" form of a plan sends)
const sql = require("mssql");

const BATCH_AFTER_LENGTH = 10;

/** body.batchAfterArray -> [{ before, after }] ; null = not sent (nothing to change) ; throws an Error with a Thai message when an item is wrong */
const cleanBatchAfterArray = (value) => {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new Error("รูปแบบ batchAfterArray ไม่ถูกต้อง");
  const list = value
    .map((it) => ({ before: String(it?.batch_before ?? "").trim(), after: String(it?.batch_after ?? "").trim().toUpperCase() }))
    .filter((it) => it.before || it.after);
  list.forEach((it) => {
    if (!it.before) throw new Error("ไม่พบ Batch ตั้งต้นของ Batch แปลง " + it.after);
    // the form enforces exactly 10 characters for material types 3, 6, 7, 8 (like the "ใส่รถเข็น" form of a plan); other types may keep a shorter / older value
    if (!it.after || it.after.length > BATCH_AFTER_LENGTH) throw new Error(`Batch แปลงต้องไม่เกิน ${BATCH_AFTER_LENGTH} ตัวอักษร (${it.after || "ว่าง"})`);
  });
  return list.length ? list : null;
};

/**
 * Replace the Batch แปลง of ONE mapping, per Batch ตั้งต้น (batch_before). A mapping that has no Batch row for that Batch ตั้งต้น gets one
 * (some routes add a mapping without a Batch row). newRequest = () => a request on the transaction (or on the pool).
 */
const applyBatchAfter = async (newRequest, mappingId, list) => {
  for (const it of list) {
    const upd = await newRequest()
      .input("mapping_id", sql.Int, mappingId)
      .input("batch_before", it.before)
      .input("batch_after", it.after)
      .query(`UPDATE Batch SET batch_after = @batch_after WHERE mapping_id = @mapping_id AND batch_before = @batch_before`);
    if (upd.rowsAffected[0] === 0) {
      await newRequest()
        .input("mapping_id", sql.Int, mappingId)
        .input("batch_before", it.before)
        .input("batch_after", it.after)
        .query(`INSERT INTO Batch (mapping_id, batch_before, batch_after) VALUES (@mapping_id, @batch_before, @batch_after)`);
    }
  }
};

module.exports = { cleanBatchAfterArray, applyBatchAfter, BATCH_AFTER_LENGTH };
