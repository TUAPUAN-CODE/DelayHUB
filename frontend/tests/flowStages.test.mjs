import test from "node:test";
import assert from "node:assert/strict";
import { flowState, flowDbs, flowReadyForCart, parseStages } from "../src/component/Sheet/Asset/flowStages.js";
import { getDbs } from "../src/component/Sheet/Asset/dbs.js";

const base = { FLOW_COOK_FREEZE: "1.00", FLOW_FREEZE_PREP: "1.00", DBS1: "1.00", DBS3: "4.00", cooked_date: "2026-11-02 08:00:00", __kind: "plan" };
const ck = { ...base, flow_stages: "freeze1_in|2026-11-02 08:30:00,freeze1_out|2026-11-02 12:00:00,grind_done|2026-11-02 13:00:00" };
const tuna = { ...base, FLOW_CS_FREEZE: "1.00", DBS1: "4.00", flow_stages: "petfood_in|2026-11-02 10:00:00,petfood_out|2026-11-02 14:00:00" };

test("flow: parseStages", () => {
  assert.deepEqual(parseStages("a|2026-01-01 10:00:00,b|2026-01-01 11:00:00"), { a: "2026-01-01 10:00:00", b: "2026-01-01 11:00:00" });
  assert.deepEqual(parseStages(null), {});
});

test("flow: CK bone steps and statuses", () => {
  const s = flowState(ck);
  assert.equal(s.order.length, 5);
  assert.equal(s.last, "grind_done");
  assert.equal(s.next, "freeze2_in");
  assert.equal(s.status.label, "รอเข้า Freeze ครั้งที่ 2 (paste)");
  assert.equal(flowState({ ...base }).status.label, "รอเข้า Freeze ครั้งที่ 1 (paste)");
});

test("flow: Tuna scrap has the petfood cold room first", () => {
  const s = flowState(tuna);
  assert.equal(s.order.length, 7);
  assert.equal(s.next, "freeze1_in");
  assert.equal(flowState({ ...base, FLOW_CS_FREEZE: "1.00" }).status.label, "รอเข้าห้องเย็น petfood (paste)");
});

test("flow: the trolley only after the last freeze", () => {
  assert.equal(flowReadyForCart(ck), false);
  assert.equal(flowReadyForCart({ ...ck, flow_stages: `${ck.flow_stages},freeze2_in|2026-11-02 13:20:00,freeze2_out|2026-11-02 18:00:00` }), true);
  assert.equal(flowState({ ...ck, flow_stages: `${ck.flow_stages},freeze2_in|2026-11-02 13:20:00,freeze2_out|2026-11-02 18:00:00` }).status.label, "รอใส่รถเข็น");
});

test("flow: DBS of the steps (CK bone)", () => {
  const d = flowDbs(ck, "2026-11-02 14:00:00");
  assert.equal(d[0].text, "-");            // no DBS1 / DBS2 / DBS4 for these materials
  assert.equal(d[7].minutes, 30);          // 08:00 -> 08:30 first cold room (step 7, std 1 h = prep_to_cold)
  assert.equal(d[7].over, false);
  assert.equal(d[5].minutes, 60);          // grind_done 13:00 -> now 14:00 (running, std 1 h)
  assert.equal(d[5].over, false);
  const late = flowDbs(ck, "2026-11-02 14:30:00");
  assert.equal(late[5].over, true);
  assert.equal(d[4].text, "-");            // CK bone has no petfood step
});

test("flow: DBS of the steps (Tuna scrap) + getDbs uses them", () => {
  const d = getDbs(tuna, "2026-11-02 15:30:00");
  assert.equal(d.length, 8);
  assert.equal(d[7].minutes, 120);         // 08:00 -> 10:00 petfood_in (std 4 h)
  assert.equal(d[4].minutes, 90);          // petfood_out 14:00 -> now 15:30 (running, std 1 h)
  assert.equal(d[4].over, true);
});

test("flow: DBS3 of the mapping row = preparation -> packed", () => {
  const m = { ...ck, __kind: "map", flow_stages: `${ck.flow_stages},freeze2_in|2026-11-02 13:20:00,freeze2_out|2026-11-02 18:00:00`, rmit_date: "2026-11-02 18:30:00", sc_pack_date: "2026-11-02 23:00:00" };
  const d = flowDbs(m);
  assert.equal(d[2].minutes, 270);         // 4 h 30 m, std 4 h
  assert.equal(d[2].over, true);
  assert.equal(d[6].minutes, 30);          // freeze2_out 18:00 -> rmit 18:30 (std 1 h)
  assert.equal(d[6].over, false);
});

test("flow: unique number F<rmfp_id> and one time column per step", async () => {
  const { flowFields, flowIdOf, stageRoleOk } = await import("../src/component/Sheet/Asset/flowStages.js");
  const row = { ...ck, rmfp_id: 248555, cooked_date: "2026-11-02 08:00:00" };
  assert.equal(flowIdOf(row), "F248555");
  const f = flowFields(row);
  assert.equal(f.flow_id, "F248555");
  assert.equal(f.flow_start, "2026-11-02 08:00:00");
  assert.equal(f.fl_freeze1_in, "2026-11-02 08:30:00");
  assert.equal(f.fl_freeze2_in, null);
  assert.equal(f.fl_petfood_in, null);
});

test("flow: each step is done on its own page", async () => {
  const { stageRoleOk } = await import("../src/component/Sheet/Asset/flowStages.js");
  assert.equal(stageRoleOk("cs2", "freeze1_in"), true);
  assert.equal(stageRoleOk("prep", "freeze1_in"), false);
  assert.equal(stageRoleOk("cs1", "petfood_in"), true);
  assert.equal(stageRoleOk("prep", "grind_done"), true);
  assert.equal(stageRoleOk("sup", "freeze2_out"), true);
});

test("flow: deadlines printed on the slips", async () => {
  const { deadlineValue, flowDeadlineNotes, flowPackNotes } = await import("../src/component/Sheet/Asset/flowStages.js");
  assert.equal(deadlineValue("ออก Freeze ครั้งที่ 2", "2026-11-02 10:00:00", "เตรียมเสร็จ", "1.00"), "ออก Freeze ครั้งที่ 2 10:00 น. → ต้องเตรียมเสร็จ ภายใน 11:00 น.");
  assert.equal(deadlineValue("เตรียมเสร็จ", "2026-11-02 10:30:00", "บรรจุเสร็จ", "4.00"), "เตรียมเสร็จ 10:30 น. → ต้องบรรจุเสร็จ ภายใน 14:30 น.");
  assert.equal(deadlineValue("เตรียมเสร็จ", "2026-11-02 22:00:00", "บรรจุเสร็จ", "4.00"), "เตรียมเสร็จ 22:00 น. → ต้องบรรจุเสร็จ ภายใน 02:00 น. (03/11)");
  assert.equal(deadlineValue("x", null, "y", "1"), null);
  // a plan row: grind done, not in freeze 2 yet -> one open deadline; after freeze 2 in and out -> the preparation deadline
  const plan = { ...base, __kind: "plan", flow_stages: "freeze1_in|2026-11-02 08:30:00,freeze1_out|2026-11-02 11:00:00,grind_done|2026-11-02 13:00:00" };
  assert.deepEqual(flowDeadlineNotes(plan).map((n) => n.value), ["Grinding เสร็จ 13:00 น. → ต้องเข้า Freeze ครั้งที่ 2 ภายใน 14:00 น."]);
  const out = { ...plan, flow_stages: `${plan.flow_stages},freeze2_in|2026-11-02 13:20:00,freeze2_out|2026-11-02 18:00:00` };
  assert.deepEqual(flowDeadlineNotes(out).map((n) => n.value), ["ออก Freeze ครั้งที่ 2 18:00 น. → ต้องเตรียมเสร็จ ภายใน 19:00 น."]);
  // a mapping slip: prepared, not packed -> the packing deadline; packed -> nothing
  assert.equal(flowPackNotes({ rmit_date: "2026-11-02 10:30:00", sc_pack_date: null, cold_to_pack: "4.00" })[0].value, "เตรียมเสร็จ 10:30 น. → ต้องบรรจุเสร็จ ภายใน 14:30 น.");
  assert.equal(flowPackNotes({ rmit_date: "2026-11-02 10:30:00", sc_pack_date: "2026-11-02 12:00:00", cold_to_pack: "4.00" }).length, 0);
});
