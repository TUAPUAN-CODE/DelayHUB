// รัน: npm test  — จับคู่แผนการผลิตของ PFCM (code + doc_no) กับรหัสสินค้าของ WC (ดู backend/lib/planMatch.js)
import test from "node:test";
import assert from "node:assert/strict";
import planMatch from "../../backend/lib/planMatch.js";

const { pickBest, splitProductCode } = planMatch;

test("splitProductCode cuts at the LAST dash: product code + doc no", () => {
  assert.deepEqual(splitProductCode("I8HPTD RCC822L2L - T087"), { head: "I8HPTD RCC822L2L", tail: "T087" });
  assert.deepEqual(splitProductCode("QPOPTD BDMB3A32F-T086"), { head: "QPOPTD BDMB3A32F", tail: "T086" });
  assert.deepEqual(splitProductCode("CSX82252J"), { head: "CSX82252J", tail: "" });
});

test("same code spelled the same way (spaces and case ignored) is an exact match", () => {
  const rows = [{ productCode: "I8HPTD RCC822L2L - T087" }];
  assert.equal(pickBest("i8hptd  rcc822l2l", rows).match, "exact");
});

test("PFCM often drops the leading family word: matched on the last word and reported as partial", () => {
  const rows = [{ productCode: "QPOPTD BDMB3A32F-T086" }];
  const hit = pickBest("BDMB3A32F", rows);
  assert.equal(hit.match, "partial");
  assert.equal(hit.row.productCode, "QPOPTD BDMB3A32F-T086");
});

test("an exact match wins over a partial one", () => {
  const rows = [{ productCode: "AAA TG1-P684" }, { productCode: "TG1-P684" }];
  assert.equal(pickBest("TG1", rows).row.productCode, "TG1-P684");
  assert.equal(pickBest("TG1", rows).match, "exact");
});

test("a short code is never matched loosely (wrong customer is worse than none)", () => {
  assert.equal(pickBest("EX", [{ productCode: "ZZZ AB-EX" }]), null);
  assert.equal(pickBest("TG1", [{ productCode: "ZZZ TG1-P684" }]), null);
});

test("no candidate or no code: nothing is matched", () => {
  assert.equal(pickBest("BDMB3A32F", []), null);
  assert.equal(pickBest("", [{ productCode: "X-Y" }]), null);
});
