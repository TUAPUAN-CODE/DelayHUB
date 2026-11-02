// Delay of the multi-stage flows (Tuna scrap, CK bone): extra standards per raw material group + the time the pressure cooking ended.
// Columns are only ever ADDED (nothing existing is changed): RawMatGroup.cs_to_freeze / cook_to_freeze / freeze_to_prep (hours, NULL = not used)
// and History.cook_end_date. Added here on first use (and by migrations/auto/006_flow_delay.sql), so nothing else has to be run on the database.
//   cs_to_freeze   : leaves the cold room (CS) -> goes into the big cold room to freeze
//   cook_to_freeze : end of cooking -> goes into the big cold room to freeze
//   freeze_to_prep : leaves the big cold room -> preparation (waiting to be put on a trolley)
// A group is a "flow group" when cook_to_freeze is filled.
let ensured = null;

const ENSURE_SQL = `
IF COL_LENGTH(N'dbo.RawMatGroup', N'cs_to_freeze') IS NULL ALTER TABLE dbo.RawMatGroup ADD cs_to_freeze DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.RawMatGroup', N'cook_to_freeze') IS NULL ALTER TABLE dbo.RawMatGroup ADD cook_to_freeze DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.RawMatGroup', N'freeze_to_prep') IS NULL ALTER TABLE dbo.RawMatGroup ADD freeze_to_prep DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.History', N'cook_end_date') IS NULL ALTER TABLE dbo.History ADD cook_end_date DATETIME NULL;`;

/** adds the columns when they are missing (once per process; two workers at the same time: "already exists" is fine) */
const ensureFlowColumns = (pool) => {
  if (!ensured) {
    ensured = pool.request().query(ENSURE_SQL).catch((err) => {
      if (err && (err.number === 2705 || /already|unique/i.test(err.message || ""))) return null;
      ensured = null;
      throw err;
    });
  }
  return ensured;
};

/** hours from a form field: "" / null -> null (not used), otherwise a number >= 0, anything else -> undefined (invalid) */
const hoursOrNull = (v) => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

module.exports = { ensureFlowColumns, hoursOrNull };
