import test from "node:test";
import assert from "node:assert/strict";
import { reportRemark, findSameCodeDifferentBatch, isFishRow } from "../src/component/Sheet/Asset/fishBatch.js";

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
test("same code, different starting batches (fish only)", () => {
  const rows = [
    { mapping_id: 1, rm_type_id: 3, mat: "M1", code: "A217 (Can B)", batch_before: "b1" },
    { mapping_id: 2, rm_type_id: 3, mat: "M1", code: "A217 (Can B)", batch_before: "B2" },
    { mapping_id: 3, rm_type_id: 3, mat: "M1", code: "A217 (Can B)", batch_before: "B2" },
    { mapping_id: 4, rm_type_id: 3, mat: "M1", code: "A300 (Can A)", batch_before: "B9" },
    { mapping_id: 5, rm_type_id: 2, mat: "M1", code: "A400 (Can A)", batch_before: "C1" },
    { mapping_id: 6, rm_type_id: 2, mat: "M1", code: "A400 (Can A)", batch_before: "C2" },
  ];
  rows.push({ mapping_id: 7, rm_type_id: 3, mat: "M2", code: "A217 (Can B)", batch_before: "Z9" }); // another mat of the same code: not the same group
  const g = findSameCodeDifferentBatch(rows);
  assert.equal(g.length, 1);
  assert.equal(g[0].code, "A217 (Can B)");
  assert.deepEqual(g[0].batches.map((b) => [b.batch, b.rows.length]), [["B1", 1], ["B2", 2]]);
});
