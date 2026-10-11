// รัน: npm test  (node:test ในตัว Node ไม่ต้องติดตั้งอะไรเพิ่ม)
import test from "node:test";
import assert from "node:assert/strict";
import { getDbs, stageDbsIndex } from "../src/component/Sheet/Asset/dbs.js";
import { groupStats, paretoOf, percentile, totals } from "../src/component/Supervisor/Report/reportStats.js";

const base = { rm_group_id: 1, DBS1: "1.00", DBS2: "2.00", DBS3: "1.00", DBS4: "2.00" };

test("DBS1 = A -> first B, DBS3 = out of cold -> packed, DBS4 = DBS1 + DBS3", () => {
  const row = {
    ...base,
    rmit_date: "2026-01-01 08:00:00", come_cold_date: "2026-01-01 09:00:00", out_cold_date: "2026-01-01 12:00:00",
    sc_pack_date: "2026-01-01 13:30:00", dest: "บรรจุเสร็จ",
  };
  const [d1, d2, d3, d4] = getDbs(row);
  assert.equal(d1.minutes, 60);
  assert.equal(d2.minutes, 180);
  assert.equal(d3.minutes, 90);
  assert.equal(d4.minutes, 150);
  assert.equal(d1.over, false); // 60 <= 60
  assert.equal(d3.over, true);  // 90 > 60
});

test("DBS2 sums every cold stay", () => {
  const row = {
    ...base,
    rmit_date: "2026-01-01 08:00:00", come_cold_date: "2026-01-01 09:00:00", out_cold_date: "2026-01-01 10:00:00",
    come_cold_date_two: "2026-01-01 11:00:00", out_cold_date_two: "2026-01-01 12:30:00",
    sc_pack_date: "2026-01-01 14:00:00", dest: "บรรจุเสร็จ",
  };
  assert.equal(getDbs(row)[1].minutes, 150);
});

test("stageDbsIndex follows the stage of the row", () => {
  assert.equal(stageDbsIndex({ rmit_date: "x" }), 0);
  assert.equal(stageDbsIndex({ cs_id: 3 }), 1);
  assert.equal(stageDbsIndex({ come_cold_date: "a", out_cold_date: "b" }), 2);
  assert.equal(stageDbsIndex({ sc_pack_date: "a", dest: "บรรจุเสร็จ" }), 3);
});

const mk = (mat, min, std) => ({ mat_name: mat, __dbs: [{}, {}, {}, { minutes: min, std, over: std != null && min > std }] });

test("percentile interpolates", () => {
  assert.equal(percentile([10, 20, 30, 40], 50), 25);
  assert.equal(percentile([5], 80), 5);
  assert.equal(percentile([], 80), null);
});

test("groupStats / pareto / totals", () => {
  const rows = [mk("A", 100, 60), mk("A", 50, 60), mk("B", 300, 120), mk("B", 130, 120), mk("C", 10, 60), { mat_name: "D", __dbs: [] }];
  const s = groupStats(rows, "mat_name", 3, 80);
  const byKey = Object.fromEntries(s.map((x) => [x.key, x]));
  assert.equal(Object.keys(byKey).length, 3); // D has nothing to measure
  assert.equal(byKey.A.overCount, 1);
  assert.equal(byKey.A.excess, 40);
  assert.equal(byKey.B.excess, 190);
  const p = paretoOf(s, "excess");
  assert.deepEqual(p.rows.map((r) => r.key), ["B", "A"]);
  assert.equal(Math.round(p.rows[1].cum), 100);
  const t = totals(rows, 3);
  assert.equal(t.n, 5);
  assert.equal(t.over, 3);
});
