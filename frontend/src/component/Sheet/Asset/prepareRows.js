import { applyStatusZones } from "./statusZones";
import { applyLineGroups } from "./lineGroups";
import { colorFromDbs } from "./ColorSettings";

/** the colour (green / yellow / red / null) of each DBS of every row, by the account's thresholds: the sort button of a DBS column sorts by it */
const applyDbsColors = (rows, ext) => rows.map((r) => (r.__dbs?.length ? { ...r, __dbsc: r.__dbs.map((d) => colorFromDbs(d, ext)) } : r));

/** DataGrid prepareRows of the Sheet: the account's own status areas and line groups, and the DBS colours (all come from the grid prefs `ext`) */
export const prepareSheetRows = (rows, ext) => applyLineGroups(applyStatusZones(applyDbsColors(rows, ext), ext), ext);
