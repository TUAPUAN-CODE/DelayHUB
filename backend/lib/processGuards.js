// กัน process ล้มเงียบ: log ทุก promise ที่หลุด/exception ที่ไม่มีใครจับ พร้อมชื่อ process
//  - unhandledRejection : log อย่างเดียว (process ทำงานต่อ — ปกติเป็นแค่ query/emit ที่พลาดครั้งเดียว)
//  - uncaughtException  : log แล้วออกด้วย code 1 หลังหน่วงสั้นๆ ให้ log ถูกเขียนก่อน (PM2 / cluster primary จะ start ตัวใหม่เอง)
let installed = false;

const installProcessGuards = (name) => {
  if (installed) return;
  installed = true;

  process.on("unhandledRejection", (reason) => {
    const msg = reason instanceof Error ? (reason.stack || reason.message) : String(reason);
    console.error(`❌ [${name}] unhandledRejection:`, msg);
  });

  process.on("uncaughtException", (err) => {
    console.error(`❌ [${name}] uncaughtException:`, err && err.stack ? err.stack : err);
    setTimeout(() => process.exit(1), 500).unref();
  });
};

module.exports = { installProcessGuards };
