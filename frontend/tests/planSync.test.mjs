// รัน: npm test  — กติกาสร้างแผนการผลิตใน PFCM จากสินค้าที่มีเฉพาะใน WC (ดู backend/lib/planSync.js)
import test from "node:test";
import assert from "node:assert/strict";
import planSync from "../../backend/lib/planSync.js";

const { lineTypeFromPackage, planFromWc, wcOnlyPlans, decidePlan } = planSync;

const wc = (productCode, groupCode, packageName = "Pouch", codeId = 1) => ({ codeId, productCode, groupCode, packageName });
const plan = (prod_id, code, doc_no, line_type_id = 3) => ({ prod_id, code, doc_no, line_type_id });

test("line type follows the package: cups 1, can 2, pouch family 3, anything else 13", () => {
  assert.equal(lineTypeFromPackage("Round cup"), 1);
  assert.equal(lineTypeFromPackage("Clear round(Soupcup)"), 1);
  assert.equal(lineTypeFromPackage("CUP B- tub"), 1);
  assert.equal(lineTypeFromPackage("Can"), 2);
  assert.equal(lineTypeFromPackage("Pouch"), 3);
  assert.equal(lineTypeFromPackage("Sachet"), 3);
  assert.equal(lineTypeFromPackage("Aluminium Printed Pouch"), 3);
  assert.equal(lineTypeFromPackage(null), 13);
  assert.equal(lineTypeFromPackage("Bottle"), 13);
});

test("a WC product becomes code (before the last dash) + doc no (GroupCode) + line type", () => {
  const p = planFromWc(wc("I8HPTD RCC822L2L - T087", "T087", "Can"));
  assert.deepEqual([p.code, p.doc_no, p.line_type_id, p.selectable], ["I8HPTD RCC822L2L", "T087", 2, true]);
});

test("a doc no longer than the column (varchar(5)), an empty one, or an over-long code cannot be created", () => {
  assert.equal(planFromWc(wc("AAA BBB-WXYZ123", "WXYZ123")).selectable, false);
  assert.match(planFromWc(wc("AAA BBB-WXYZ123", "WXYZ123")).reason, /ยาวเกิน/);
  assert.equal(planFromWc(wc("AAA BBB", "")).selectable, false);
  assert.equal(planFromWc(wc(`${"X".repeat(51)}-T001`, "T001")).selectable, false);
});

test("a WC product that already has a plan (even spelled with fewer words) is not offered as new", () => {
  const plans = [plan(10, "BDMB3A32F", "T086")];
  const rows = [wc("QPOPTD BDMB3A32F-T086", "T086", "Pouch", 1), wc("I8HPTD RCC822L2L - T087", "T087", "Can", 2)];
  const onlyWc = wcOnlyPlans(rows, plans);
  assert.deepEqual(onlyWc.map((p) => p.wc_code_id), [2]);
});

test("picking: reuse the existing plan (no insert), create a new one, or refuse with the reason", () => {
  const plans = [plan(10, "BDMB3A32F", "T086", 3)];
  assert.deepEqual(decidePlan(wc("QPOPTD BDMB3A32F-T086", "T086"), plans), { action: "reuse", prod_id: 10, code: "BDMB3A32F", doc_no: "T086", line_type_id: 3 });
  const created = decidePlan(wc("I8HPTD RCC822L2L - T087", "T087", "Can"), plans);
  assert.equal(created.action, "create");
  assert.equal(created.plan.line_type_id, 2);
  assert.equal(decidePlan(wc("AAA BBB-TOOLONG1", "TOOLONG1"), plans).action, "reject");
});

test("widening the doc_no column makes the long doc nos creatable (the limit is the database's, not a constant)", () => {
  const long = wc("AAA BBB-WXYZ1234567", "WXYZ1234567");
  assert.equal(planFromWc(long).selectable, false);                                   // varchar(5)
  assert.equal(planFromWc(long, { docNoMax: 20, codeMax: 50 }).selectable, true);       // after ALTER COLUMN doc_no varchar(20)
  assert.equal(planFromWc(long, { docNoMax: 10, codeMax: 50 }).selectable, false);      // still too long for varchar(10)
  assert.equal(decidePlan(long, [], { limits: { docNoMax: 20, codeMax: 50 } }).action, "create");
  assert.equal(wcOnlyPlans([long], [], { docNoMax: 20, codeMax: 50 }).filter((p) => p.selectable).length, 1);
});

test("the line type the user picked wins over the suggestion; an existing plan keeps its own", () => {
  const can = wc("I8HPTD RCC822L2L - T087", "T087", "Can"); // suggestion would be 2
  assert.equal(decidePlan(can, []).plan.line_type_id, 2);
  assert.equal(decidePlan(can, [], { lineTypeId: 12 }).plan.line_type_id, 12);
  const existing = [plan(7, "I8HPTD RCC822L2L", "T087", 3)];
  assert.equal(decidePlan(can, existing, { lineTypeId: 12 }).line_type_id, 3);
});

test("the same code with another doc no is a different plan", () => {
  const plans = [plan(10, "I8HPTD RCC822L2L", "C175", 2)];
  assert.equal(decidePlan(wc("I8HPTD RCC822L2L - T087", "T087", "Can"), plans).action, "create");
});
