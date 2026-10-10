// วัดทุก query ที่ผ่าน mssql (นับ, เวลา, error) และเขียน log เมื่อช้า — ติดตั้งครั้งเดียวที่ database/db.js ไม่ต้องแก้ route
// ไม่เก็บค่าพารามิเตอร์ (อาจมีข้อมูลส่วนบุคคล) เก็บแค่ต้นข้อความ SQL
const metrics = require("./metrics");
const logger = require("./logger");

const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS, 10) || 1500;
let installed = false;

const shorten = (command) => String(command || "").replace(/\s+/g, " ").trim().slice(0, 180);

const instrument = (mssql) => {
  if (installed || !mssql || !mssql.Request || typeof mssql.Request.prototype._query !== "function") return;
  installed = true;
  const original = mssql.Request.prototype._query;

  mssql.Request.prototype._query = function patchedQuery(command, callback) {
    const started = process.hrtime.bigint();
    const wrapped = (err, ...rest) => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      metrics.inc("sql_queries_total");
      metrics.observe("sql_duration_ms", ms);
      if (err) {
        metrics.inc("sql_errors_total");
        logger.warn("sql_error", { ms: Math.round(ms), error: err.message, number: err.number, line: err.lineNumber, sql: shorten(command) });
      } else if (ms >= SLOW_QUERY_MS) {
        metrics.inc("sql_slow_total");
        logger.warn("slow_query", { ms: Math.round(ms), sql: shorten(command) });
      }
      return callback(err, ...rest);
    };
    return original.call(this, command, wrapped);
  };
};

module.exports = { instrument };
