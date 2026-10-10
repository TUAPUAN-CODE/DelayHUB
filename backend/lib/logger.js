// Log แบบ 1 บรรทัด = 1 JSON (grep/jq/ส่งเข้าระบบรวม log ได้ง่าย) ใช้กับเหตุการณ์ที่ต้องตามดูบน production: request ช้า/พัง, query ช้า, การปฏิเสธสิทธิ์, alert
// log ข้อความทั่วไปเดิมของระบบยังเป็น console.log ตามเดิม ไม่ต้องเปลี่ยน
const errFields = (err) => (err ? { error: err.message || String(err), code: err.code, number: err.number } : {});

const write = (level, event, fields) => {
  let line;
  try {
    line = JSON.stringify({ ts: new Date().toISOString(), level, event, pid: process.pid, ...fields });
  } catch {
    line = JSON.stringify({ ts: new Date().toISOString(), level, event, pid: process.pid, note: "unserializable fields" });
  }
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
};

module.exports = {
  errFields,
  info: (event, fields = {}) => write("info", event, fields),
  warn: (event, fields = {}) => write("warn", event, fields),
  error: (event, fields = {}) => write("error", event, fields),
};
