import { applyStatusZones } from "./statusZones";
import { applyLineGroups } from "./lineGroups";

/** DataGrid prepareRows of the Sheet: the account's own status areas and line groups (both come from the grid prefs `ext`) */
export const prepareSheetRows = (rows, ext) => applyLineGroups(applyStatusZones(rows, ext), ext);
