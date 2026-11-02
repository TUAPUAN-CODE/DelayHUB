// Delay of the multi-stage flows (Tuna scrap, CK bone): extra standards per raw material group + the time the pressure cooking ended.
// Columns are only ever ADDED (nothing existing is changed): RawMatGroup.cs_to_freeze / cook_to_freeze / freeze_to_prep (hours, NULL = not used)
// and History.cook_end_date. Added here on first use (and by migrations/auto/006_flow_delay.sql), so nothing else has to be run on the database.
//   cs_to_freeze   : leaves the cold room (CS) -> goes into the big cold room to freeze
//   cook_to_freeze : end of cooking -> goes into the big cold room to freeze
//   freeze_to_prep : leaves the big cold room -> preparation (waiting to be put on a trolley)
// A group is a "flow group" when cook_to_freeze is filled. cs_to_freeze filled too = Tuna scrap (has the petfood cold room), empty = CK bone.
// The steps of a flow group are stamped on the production-plan row (RMForProd) in table FlowStage (one time per rmfp_id + stage), in this order:
//   Tuna scrap: petfood_in, petfood_out, freeze1_in, freeze1_out, grind_done, freeze2_in, freeze2_out
//   CK bone   : freeze1_in, freeze1_out, grind_done, freeze2_in, freeze2_out
// (the start time is History.cooked_date of the plan; the trolley is only put on after freeze2_out, at "รอใส่รถเข็น")
let ensured = null;

const ENSURE_SQL = `
IF COL_LENGTH(N'dbo.RawMatGroup', N'cs_to_freeze') IS NULL ALTER TABLE dbo.RawMatGroup ADD cs_to_freeze DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.RawMatGroup', N'cook_to_freeze') IS NULL ALTER TABLE dbo.RawMatGroup ADD cook_to_freeze DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.RawMatGroup', N'freeze_to_prep') IS NULL ALTER TABLE dbo.RawMatGroup ADD freeze_to_prep DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.History', N'cook_end_date') IS NULL ALTER TABLE dbo.History ADD cook_end_date DATETIME NULL;
IF OBJECT_ID(N'dbo.FlowStage', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FlowStage (
        flow_stage_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FlowStage PRIMARY KEY,
        rmfp_id       INT           NOT NULL,
        stage         NVARCHAR(30)  NOT NULL,
        stamped_at    DATETIME      NOT NULL,
        created_by    NVARCHAR(100) NULL,
        created_at    DATETIME      NOT NULL CONSTRAINT DF_FlowStage_created_at DEFAULT (GETDATE())
    );
    CREATE UNIQUE INDEX UX_FlowStage_rmfp_stage ON dbo.FlowStage (rmfp_id, stage);
END`;

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

const FLOW_STAGES_TUNA = ["petfood_in", "petfood_out", "freeze1_in", "freeze1_out", "grind_done", "freeze2_in", "freeze2_out"];
const FLOW_STAGES_CK = ["freeze1_in", "freeze1_out", "grind_done", "freeze2_in", "freeze2_out"];
const flowStageOrder = (hasPetfood) => (hasPetfood ? FLOW_STAGES_TUNA : FLOW_STAGES_CK);

module.exports = { ensureFlowColumns, hoursOrNull, flowStageOrder, FLOW_STAGES_TUNA, FLOW_STAGES_CK };
