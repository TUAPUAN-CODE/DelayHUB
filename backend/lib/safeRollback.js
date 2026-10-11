// rollback ที่ไม่ throw: ถ้า transaction ถูก abort/rollback ไปแล้ว (deadlock, timeout, rollback ซ้ำ) mssql จะ throw ใน catch
// ซึ่งทำให้ route ไม่ส่ง response และหน้าเว็บค้าง — ใช้ตัวนี้แทน `await transaction.rollback()`
const safeRollback = async (tx) => {
  if (!tx) return;
  try {
    await tx.rollback();
  } catch (err) {
    // ENOTBEGUN / EABORT = rollback ไปแล้ว ไม่ใช่ปัญหา
    if (err && (err.code === "ENOTBEGUN" || err.code === "EABORT")) return;
    console.error("❌ [safeRollback] rollback ล้มเหลว:", err && err.message);
  }
};

module.exports = { safeRollback };
