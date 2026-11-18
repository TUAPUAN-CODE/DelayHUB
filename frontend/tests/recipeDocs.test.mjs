// รัน: npm test  — กติกาของ "เอกสาร" ในหน้า /sup/ProductRecipe (ใช้ร่วมกันทั้งหน้าจอและ PDF)
import test from "node:test";
import assert from "node:assert/strict";
import { buildSections, fmt, groupByMixType, SOLUTION_SHEET_MIXTYPE } from "../src/component/Supervisor/ProductRecipe/Asset/recipeDocs.js";

const detail = {
  ingredients: [
    { mixType: 30, seq: 2, ingdntCode: "B", ingdntName: "Beta", stdWt: "2.5000000000", minWt: 0, maxWt: 0, percentage: 0 },
    { mixType: 10, seq: 1, ingdntCode: "A", ingdntName: "Alpha", stdWt: "1", minWt: 0, maxWt: 0, percentage: 0 },
  ],
  mixSequences: [{ mixType: 30, description: "เวลาเริ่มบดเนื้อ" }],
  solutions: [{ name: "Solution 1", quantity: 80, minVal: 79, maxVal: 81 }],
  toppings: [],
};

test("fmt drops the SQL decimal padding and shows '-' for a missing value", () => {
  assert.equal(fmt("2.5000000000"), "2.5");
  assert.equal(fmt(null), "-");
  assert.equal(fmt(""), "-");
  assert.equal(fmt("abc"), "abc");
});

test("groupByMixType keeps each MixType's rows together, in MixType order", () => {
  const groups = groupByMixType(detail.ingredients);
  assert.deepEqual(groups.map(([mixType]) => mixType), [10, 30]);
  assert.equal(groups[1][1][0].ingdntCode, "B");
});

test("a formula document holds only its own MixType rows; empty sections are left out", () => {
  const sections = buildSections(detail, { mixType: 30 });
  assert.deepEqual(sections.map((s) => s.key), ["ingredients", "steps"]);
  assert.equal(sections[0].rows.length, 1);
  assert.equal(sections[0].rows[0].ingdntCode, "B");
  // MixType 10 has a formula but no steps
  assert.deepEqual(buildSections(detail, { mixType: 10 }).map((s) => s.key), ["ingredients"]);
});

test("the solution sheet (MixType 0) is made of solutions + toppings, and skips an empty topping list", () => {
  const sections = buildSections(detail, { mixType: SOLUTION_SHEET_MIXTYPE });
  assert.deepEqual(sections.map((s) => s.key), ["solutions"]);
  assert.equal(sections[0].rows[0].quantity, "80");
});
