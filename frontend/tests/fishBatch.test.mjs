import test from "node:test";
import assert from "node:assert/strict";
import { reportRemark, findSameCodeDifferentBatch, isFishRow } from "../src/component/Sheet/Asset/fishBatch.js";
import { workDayOf } from "../src/component/Sheet/Asset/shiftTime.js";

test("fish row: starting batch goes in front of the remark", () => {
  assert.equal(reportRemark({ rm_type_id: 112, batch_before: "TNS2611001", remark_dalay: "รอคิว" }), "Batch ตั้งต้น: TNS2611001 · รอคิว");
  assert.equal(reportRemark({ rm_type_id: 3, batch_before: "AAA1111111", remark_dalay: "" }), "Batch ตั้งต้น: AAA1111111");
});
test("not fish / no starting batch: remark unchanged", () => {
  assert.equal(reportRemark({ rm_type_id: 2, batch_before: "X", remark_dalay: "r" }), "r");
  assert.equal(reportRemark({ rm_type_id: 3, remark_dalay: "r" }), "r");
  assert.equal(reportRemark({}), "");
  assert.ok(isFishRow({ rm_type_id: "67" }));
});
test("same code + mat, different starting batches, split by factory day and shift", () => {
  const r = (id, mat, code, before, at, type = 3) => ({ mapping_id: id, rm_type_id: type, mat, code, batch_before: before, sc_pack_date: at });
  const rows = [
    r(1, "M1", "A217 (Can B)", "b1", "2026-10-30 10:00:00"), // DS of 30/10
    r(2, "M1", "A217 (Can B)", "B2", "2026-10-30 11:00:00"), // DS of 30/10: the same group
    r(3, "M1", "A217 (Can B)", "B3", "2026-10-30 20:00:00"), // NS of 30/10: another section (B3 alone: no warning there)
    r(4, "M1", "A217 (Can B)", "B4", "2026-10-31 02:00:00"), // 02:00 is still the NS of 30/10 -> with row 3: warning
    r(5, "M2", "A217 (Can B)", "Z9", "2026-10-30 10:30:00"), // another mat: not the same group
    r(6, "M1", "A300 (Can A)", "C1", "2026-10-30 10:00:00"),
    r(7, "M1", "A400 (Can A)", "D1", "2026-10-30 10:00:00", 2), // not fish
    r(8, "M1", "A400 (Can A)", "D2", "2026-10-30 10:00:00", 2),
  ];
  const s = findSameCodeDifferentBatch(rows);
  assert.deepEqual(s.map((x) => [x.day, x.shift, x.groups.length]), [["2026-10-30", "DS", 1], ["2026-10-30", "NS", 1]]);
  assert.deepEqual(s[0].groups[0].batches.map((b) => [b.batch, b.rows.length]), [["B1", 1], ["B2", 1]]);
  assert.deepEqual(s[1].groups[0].batches.map((b) => b.batch), ["B3", "B4"]);
});
test("workDayOf: before 06:00 belongs to the day before", () => {
  assert.equal(workDayOf("2026-11-01 05:59:00"), "2026-10-31");
  assert.equal(workDayOf("2026-11-01 06:00:00"), "2026-11-01");
  assert.equal(workDayOf(""), "");
});
