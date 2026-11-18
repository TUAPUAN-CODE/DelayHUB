// รัน: npm test  — ตัวช่วยแสดงผลของหน้า /sup/WorkOrder
import test from "node:test";
import assert from "node:assert/strict";
import { countsOf, fmtDate, fmtDateTime, fmtNum, fmtTime, groupBy, mixTypeLabel } from "../src/component/Supervisor/WorkOrder/Asset/woFormat.js";

test("a SQL datetime sent as ISO 'Z' is shown as the same wall-clock time (no timezone shift)", () => {
  assert.equal(fmtDateTime("2026-11-18T06:40:33.000Z"), "2026-11-18 06:40");
  assert.equal(fmtDate("2026-11-18T00:00:00.000Z"), "2026-11-18");
  assert.equal(fmtTime("2000-01-01T07:30:00.000Z"), "07:30");
});

test("missing or invalid dates and numbers show '-'", () => {
  assert.equal(fmtDateTime(null), "-");
  assert.equal(fmtDate("not a date"), "-");
  assert.equal(fmtNum(undefined), "-");
  assert.equal(fmtNum("39.7620000000", 2), "39.76");
});

test("mixTypeLabel names the known MixTypes and falls back for unknown ones", () => {
  assert.equal(mixTypeLabel(30), "เนื้อผสม (30)");
  assert.equal(mixTypeLabel(999), "MixType 999");
});

test("groupBy keeps rows of one MixType together in numeric order; countsOf turns the overview into a lookup", () => {
  const groups = groupBy([{ mixType: 40, v: "a" }, { mixType: 10, v: "b" }, { mixType: 40, v: "c" }], "mixType");
  assert.deepEqual(groups.map(([k, rows]) => [k, rows.length]), [[10, 1], [40, 2]]);
  assert.deepEqual(countsOf([{ section: "baskets", rows: 353 }, { section: "log", rows: 4 }]), { baskets: 353, log: 4 });
  assert.deepEqual(countsOf(undefined), {});
});
