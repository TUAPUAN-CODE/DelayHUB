// รัน: npm test  (node:test ในตัว Node ไม่ต้องติดตั้งอะไรเพิ่ม)
import test from "node:test";
import assert from "node:assert/strict";
import { arrangeColumns } from "../src/component/Layout/DataGrid/columnOrder.js";

const groups = [{ key: "tool" }, { key: "info" }, { key: "prep" }, { key: "cs1" }, { key: "dbs" }];
// the order of the column settings list: group by group, inside a group the order of the registry
const columns = [
  { key: "status", group: "tool" }, { key: "w_total", group: "tool" }, { key: "mapping_id", group: "tool" },
  { key: "hu", group: "info" }, { key: "tro_id", group: "info" }, { key: "mat", group: "info" },
  { key: "cooked_date", group: "prep" }, { key: "qc_date", group: "prep" },
  { key: "come_cold_date", group: "cs1" }, { key: "out_cold_date", group: "cs1" },
  { key: "DBS1", group: "dbs" },
];
const mk = (keys, pinned = []) => keys.map((k) => ({ ...columns.find((c) => c.key === k), frozen: pinned.includes(k) }));
const keys = (list) => list.map((c) => c.key);

test("registry: columns turned on later / dragged anywhere come out in the order of the settings list", () => {
  const saved = mk(["DBS1", "qc_date", "mat", "out_cold_date", "hu", "cooked_date", "come_cold_date", "tro_id"]);
  assert.deepEqual(keys(arrangeColumns(saved, "registry", columns, groups)),
    ["hu", "tro_id", "mat", "cooked_date", "qc_date", "come_cold_date", "out_cold_date", "DBS1"]);
});

test("registry: frozen columns stay on the left in the order the account had them, the rest follow the list", () => {
  const saved = mk(["mat", "mapping_id", "status", "qc_date", "hu"], ["mapping_id", "status"]);
  assert.deepEqual(keys(arrangeColumns(saved, "registry", columns, groups)), ["mapping_id", "status", "hu", "mat", "qc_date"]);
});

test("saved (default): the order of the account is kept, frozen first", () => {
  const saved = mk(["mat", "mapping_id", "status", "qc_date", "hu"], ["status"]);
  assert.deepEqual(keys(arrangeColumns(saved, "saved", columns, groups)), ["status", "mat", "mapping_id", "qc_date", "hu"]);
  assert.deepEqual(keys(arrangeColumns(saved, undefined, columns, groups)), ["status", "mat", "mapping_id", "qc_date", "hu"]);
});

test("registry: a column of a group that is not in `groups` goes last; the input list is not changed", () => {
  const cols = [...columns, { key: "extra", group: "other" }];
  const saved = [{ key: "extra", group: "other", frozen: false }, ...mk(["mat", "hu"])];
  const before = keys(saved);
  assert.deepEqual(keys(arrangeColumns(saved, "registry", cols, groups)), ["hu", "mat", "extra"]);
  assert.deepEqual(keys(saved), before);
});
