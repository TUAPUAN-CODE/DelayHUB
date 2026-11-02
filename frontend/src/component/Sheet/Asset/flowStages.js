// Steps of the flow of Tuna scrap / CK bone (a RawMatGroup whose cook_to_freeze is filled; cs_to_freeze filled too = Tuna scrap, with the petfood cold room).
// The steps are stamped on the production-plan row (table FlowStage, POST /api/sheet/flow-stage); the trolley is only put on after freeze2_out ("รอใส่รถเข็น").
//   Tuna scrap: cooked(start) > petfood_in > petfood_out > freeze1_in > freeze1_out > grind_done > freeze2_in > freeze2_out > trolley > packed
//   CK bone   : cooked(start) >                           freeze1_in > freeze1_out > grind_done > freeze2_in > freeze2_out > trolley > packed
// Keep the order in step with backend/lib/flowDelay.js.

const has = (v) => v !== null && v !== undefined && v !== "";

export const isFlowGroup = (row) => has(row?.FLOW_COOK_FREEZE);
export const hasPetfood = (row) => has(row?.FLOW_CS_FREEZE);

export const STAGES_TUNA = ["petfood_in", "petfood_out", "freeze1_in", "freeze1_out", "grind_done", "freeze2_in", "freeze2_out"];
export const STAGES_CK = ["freeze1_in", "freeze1_out", "grind_done", "freeze2_in", "freeze2_out"];
export const stageOrder = (row) => (hasPetfood(row) ? STAGES_TUNA : STAGES_CK);

/** the button of each step (what the person has just done) */
export const STAGE_BUTTON = {
  petfood_in: "เข้าห้องเย็น petfood",
  petfood_out: "ออกห้องเย็น petfood",
  freeze1_in: "เข้า Freeze ครั้งที่ 1",
  freeze1_out: "ออก Freeze ครั้งที่ 1",
  grind_done: "Grinding เสร็จ",
  freeze2_in: "เข้า Freeze ครั้งที่ 2",
  freeze2_out: "ออก Freeze ครั้งที่ 2",
};

// status chip shown once a step is stamped (the last stamped step) — "(paste)" names the steps before the final preparation
// styled: the chip keeps its own colour (these labels are not in STATUS_LIST, so a saved "สถานะที่ดู" never hides them: unknown labels are always shown)
const S = (label, color, bg) => ({ label, color, bg, styled: true });
const STATUS_AFTER = {
  start_tuna: S("รอเข้าห้องเย็น petfood (paste)", "#B45309", "#FEF3C7"),
  start_ck: S("รอเข้า Freeze ครั้งที่ 1 (paste)", "#B45309", "#FEF3C7"),
  petfood_in: S("อยู่ห้องเย็น petfood (paste)", "#6A1B9A", "#F3E5F5"),
  petfood_out: S("รอเข้า Freeze ครั้งที่ 1 (paste)", "#B45309", "#FEF3C7"),
  freeze1_in: S("อยู่ใน Freeze ครั้งที่ 1 (paste)", "#FFFFFF", "#1D4ED8"),
  freeze1_out: S("รอ Grinding (paste)", "#6B21A8", "#E9D5FF"),
  grind_done: S("รอเข้า Freeze ครั้งที่ 2 (paste)", "#B45309", "#FEF3C7"),
  freeze2_in: S("อยู่ใน Freeze ครั้งที่ 2 (paste)", "#FFFFFF", "#1D4ED8"),
  freeze2_out: S("รอใส่รถเข็น", "#6B21A8", "#E9D5FF"),
};
/** every label a flow row can get (listed in statusZones.js) */
export const FLOW_STATUS_LABELS = [...new Set(Object.values(STATUS_AFTER).map((s) => s.label))];

/** "stage|yyyy-MM-dd HH:mm:ss,stage|..." (the server) -> { stage: "yyyy-MM-dd HH:mm:ss" } */
export const parseStages = (text) => {
  const out = {};
  String(text || "").split(",").forEach((x) => {
    const [k, at] = x.split("|");
    if (k && at) out[k.trim()] = at.trim();
  });
  return out;
};

/** { order, stamps, last, next, status } of a flow plan row / mapping row */
export const flowState = (row) => {
  const order = stageOrder(row);
  const stamps = parseStages(row.flow_stages);
  const done = order.filter((k) => stamps[k]);
  const last = done.length ? done[done.length - 1] : null;
  const next = order.find((k) => !stamps[k]) || null;
  const status = last ? STATUS_AFTER[last] : STATUS_AFTER[hasPetfood(row) ? "start_tuna" : "start_ck"];
  return { order, stamps, last, next, status };
};

/** the trolley can be put on only after the last freeze */
export const flowReadyForCart = (row) => Boolean(flowState(row).stamps.freeze2_out);

const ms = (v) => { const t = v ? new Date(String(v).replace(" ", "T")).getTime() : NaN; return Number.isNaN(t) ? null : t; };
const fmtMin = (m) => { const h = Math.floor(m / 60); const r = Math.floor(m % 60); return `${h ? `${h} h` : ""}${h && r ? " " : ""}${r ? `${r} m` : ""}` || "0 m"; };
const stdMin = (v) => { const n = parseFloat(v); return Number.isNaN(n) ? null : n * 60; };

/**
 * DBS list of a flow row (same shape as getDbs: [{text, minutes, std, over}], index 0..6):
 *  0 DBS1  start (cooked_date) -> first cold room (petfood_in / freeze1_in)      2 DBS3  rmit_date -> sc_pack_date (after the trolley)
 *  4 leave petfood cold room -> Freeze 1 (Tuna)   5 Grinding done -> Freeze 2   6 leave Freeze 2 -> preparation (the trolley / rmit_date)
 * 1 and 3 have no meaning for a flow row. `now` makes the running step count up to the present time (a finished row never runs).
 */
export const flowDbs = (row, now = null) => {
  const { stamps } = flowState(row);
  const finished = Boolean(row.sc_pack_date) || String(row.rm_status || "") === "สำเร็จ" || String(row.dest || "").startsWith("บรรจุเสร็จ");
  const live = now && !finished ? new Date(now).getTime() : null;
  const NONE = { text: "-", minutes: null, std: null, over: false };
  const mk = (fromVal, toVal, std, running) => {
    const from = ms(fromVal);
    if (std === null || from === null) return std === null ? NONE : { text: "-", minutes: null, std, over: false };
    const to = ms(toVal) ?? (running ? live : null);
    if (to === null || to < from) return { text: "-", minutes: null, std, over: false };
    const minutes = (to - from) / 60000;
    return { text: fmtMin(minutes), minutes, std, over: minutes > std };
  };
  const firstCold = hasPetfood(row) ? stamps.petfood_in : stamps.freeze1_in;
  const prepAt = row.__kind === "map" ? row.rmit_date : null; // the preparation after the last freeze = the trolley
  const dbs3 = row.__kind === "map" && row.rmit_date ? mk(row.rmit_date, row.sc_pack_date, stdMin(row.DBS3), true) : NONE;
  return [
    mk(row.cooked_date, firstCold, stdMin(row.DBS1), true),
    NONE,
    dbs3,
    NONE,
    hasPetfood(row) ? mk(stamps.petfood_out, stamps.freeze1_in, stdMin(row.FLOW_CS_FREEZE), true) : NONE,
    mk(stamps.grind_done, stamps.freeze2_in, stdMin(row.FLOW_COOK_FREEZE), true),
    mk(stamps.freeze2_out, prepAt, stdMin(row.FLOW_FREEZE_PREP), true),
  ];
};
