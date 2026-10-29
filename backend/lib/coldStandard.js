// Delay cold of some raw material groups is shorter in one cold room: while the trolley is in a slot of that room the standard is
// COLD_OVERRIDE_HOURS instead of RawMatGroup.cold (room "Ante" cs_id 7: groups 70 ผัก/ผลไม้, 71 ข้าว/ปลายข้าว, 72 ธัญพืช -> 7 hr).
// Used by the SQL of the cold room pages and the Sheet, so every page colours Delay cold by the same number. Needs the aliases rmm (TrolleyRMMapping) and rmg (RawMatGroup).
const COLD_OVERRIDE_GROUPS = [70, 71, 72];
const COLD_OVERRIDE_CS_IDS = [7];
const COLD_OVERRIDE_HOURS = 7;

const COLD_OVERRIDE_COND = `(rmg.rm_group_id IN (${COLD_OVERRIDE_GROUPS.join(",")}) AND EXISTS (SELECT 1 FROM Slot sxo WITH (NOLOCK) WHERE sxo.tro_id = rmm.tro_id AND sxo.cs_id IN (${COLD_OVERRIDE_CS_IDS.join(",")})))`;

/** the standard hours of Delay cold: the group's value, or the override while the trolley is in the room */
const COLD_STD_SQL = `(CASE WHEN ${COLD_OVERRIDE_COND} THEN ${COLD_OVERRIDE_HOURS} ELSE rmg.cold END)`;
/** the cold time of a mapping (its own saved value, else the group's) with the same override */
const COLD_TIME_SQL = `(CASE WHEN ${COLD_OVERRIDE_COND} THEN ${COLD_OVERRIDE_HOURS} ELSE COALESCE(rmm.cold_time, rmg.cold) END)`;

module.exports = { COLD_OVERRIDE_GROUPS, COLD_OVERRIDE_CS_IDS, COLD_OVERRIDE_HOURS, COLD_STD_SQL, COLD_TIME_SQL };
