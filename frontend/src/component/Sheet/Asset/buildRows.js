import { analyzeRow } from "../../ColdStorages/SapSheet/Asset/sapTimeline";
import { getDbs } from "./dbs";
import { reworkKind } from "./prep/kinds";
import { withZone } from "./statusZones";

// ONE flat list: every raw material (mapping) is a row. A HU (SAP_Receive) that has no mapping yet is its own row,
// so its time stamps (start thaw / done / dispatch) can still be recorded. The HU of a mapping is History.hu.

const SAP_KEYS = [
  "withdraw_date", "start_defrost_date", "end_defrost_date", "input_pd_date", "output_pd_date", "input_cd_date",
  "withdraw_date_two", "start_defrost_date_two", "end_defrost_date_two", "input_pd_date_two", "output_pd_date_two", "input_cd_date_two",
  "withdraw_date_three", "start_defrost_date_three", "end_defrost_date_three", "input_pd_date_three", "output_pd_date_three", "input_cd_date_three",
  "withdraw_date_four", "start_defrost_date_four", "end_defrost_date_four",
];
const TIME_KEYS = [
  ...SAP_KEYS, "cooked_date", "rmit_date", "qc_date", "sc_pack_date", "come_cold_date", "out_cold_date", "cs_come_cold_date", "cs_out_cold_date",
];

export const lastActivity = (row) => {
  let best = 0;
  TIME_KEYS.forEach((k) => {
    const v = row[k];
    if (v) {
      const ms = new Date(String(v).replace(" ", "T")).getTime();
      if (!Number.isNaN(ms) && ms > best) best = ms;
    }
  });
  return best;
};

const safeDbs = (row, now) => { try { return getDbs(row, now); } catch (err) { console.error("[Sheet] DBS error:", err); return []; } };

/** Pack stage of a mapping (same rules as the old Pack page): qc = waiting for QC · ready = can be put in a trolley · trolley = in a trolley, can be sent on */
export const packStage = (r) => {
  if (r.__kind !== "map") return null;
  const st = String(r.rm_status || "");
  if (["จุดเตรียม", "หม้ออบ"].includes(r.stay_place) && ["รอCheckin", "ห้องเย็นใหญ่"].includes(r.dest) && ["รอQCตรวจสอบ", "รอ MD"].includes(st)) return "qc";
  if (r.tro_id && ["บรรจุ", "รถเข็นรอจัดส่ง"].includes(r.dest)) return "trolley";
  if (
    !r.tro_id && ["จุดเตรียม", "ออกห้องเย็น", "create_manual"].includes(r.stay_place) && ["ไปบรรจุ", "บรรจุ", "create_manual", "รอCheckin"].includes(r.dest)
    && ["QcCheck", "เหลือจากไลน์ผลิต", "QcCheck รอ MD", "รอแก้ไข"].includes(st) && Number(r.weight_RM) !== 0
  ) return "ready";
  return null;
};

/** status chip of a row (names agreed with the users); the colour of a status in a zone is the colour of its zone */
export const statusOf = (r) => withZone(baseStatusOf(r));

const baseStatusOf = (r) => {
  if (r.__kind === "mix") return { label: "รอเตรียมผสมวัตถุดิบ", color: "#6A1B9A", bg: "#F3E5F5" };
  if (r.__rework === "A" || r.__rework === "B") return { label: "รอเตรียมวัตถุดิบใหม่", color: "#B91C1C", bg: "#FEE2E2" };
  if (r.__kind === "hu") {
    const a = analyzeRow(r);
    return { label: a.status.label, color: a.status.color, bg: a.status.bg };
  }
  const fixed = FIXED_STATUS(r);
  if (fixed) return fixed;
  const st = String(r.rm_status || "");
  // packed = Done, whatever rm_status says (e.g. "รอแก้ไข | บรรจุเสร็จ | บรรจุเสร็จ" is Done, not "รอแก้ไข")
  if (String(r.dest || "").startsWith("บรรจุเสร็จ")) return { label: "Done", color: "#047857", bg: "#D1FAE5" };
  if (r.__stage === "ready") return { label: "รอบรรจุเสร็จ", color: "#1552F0", bg: "#EAF0FF" };
  if (st.includes("รอQC") || st.includes("รอ MD")) return { label: "รอ QC Check", color: "#B45309", bg: "#FEF3C7" };
  if (st === "รอแก้ไข") return { label: "รอแก้ไข", color: "#B91C1C", bg: "#FEE2E2" };
  if (r.cs_id) return { label: "อยู่ในห้องเย็น", color: "#6A1B9A", bg: "#F3E5F5" };
  if (r.tro_id && (r.dest === "บรรจุ" || r.dest === "รถเข็นรอจัดส่ง")) return { label: "รอบรรจุจัดส่ง", color: "#047857", bg: "#D1FAE5" };
  // heading to a cold room ("เข้าห้องเย็น", "ห้องเย็น", "ห้องเย็นใหญ่", "รอCheckin", "เข้าห้องเย็น-รอรถเข็น" ...) and not in a slot yet
  if (/^(เข้า)?ห้องเย็น/.test(r.dest || "") || /^รอCheckin/i.test(r.dest || "")) {
    return { label: "รอห้องเย็นรับเข้า", color: "#B45309", bg: "#FEF3C7" };
  }
  return { label: "-", color: "#6B7489", bg: "#F1F3F8" }; // no rule matches: no made-up name
};

/** the HU is the source of truth for the SAP time stamps; History only holds a copy */
const mergeHu = (m, h) => {
  const out = { ...m };
  SAP_KEYS.forEach((k) => { if (h[k]) out[k] = h[k]; });
  ["cs_re", "cs_re_2", "cs_re_3", "before_hu"].forEach((k) => { if (h[k] !== undefined && h[k] !== null) out[k] = h[k]; });
  if (!out.hu) out.hu = h.hu;
  return out;
};

const norm = (v) => String(v ?? "").trim().toUpperCase();
const planBatches = (r) => (Array.isArray(r.batchArray) && r.batchArray.length ? r.batchArray : String(r.batch ?? "").split(",")).map(norm).filter(Boolean);

// (rm_status | stay_place | dest) combinations that are not real work: the row is not shown at all (agreed with the users; the API hides them too)
const HIDDEN_COMBOS = new Set([
  "QcCheck|create_manual|create_manual",
  "QcCheck|เข้าห้องเย็น|บรรจุ",
  "QcCheck|บรรจุ|รถเข็นรอจัดส่ง",
  "QcCheck รอแก้ไข|จุดเตรียม|จุดเตรียม",
]);
const comboOf = (r) => `${r.rm_status ?? ""}|${r.stay_place ?? ""}|${r.dest ?? ""}`;

// combinations with a fixed status name (checked before every other rule)
const isBigColdCombo = (r) => (r.rm_status === "QcCheck" || r.rm_status === "รอกลับมาเตรียม") && r.stay_place === "เข้าห้องเย็นใหญ่" && r.dest === "ในห้องเย็นใหญ่";

const FIXED_STATUS = (r) => {
  const st = r.rm_status;
  if ((st === "QcCheck" || st === "รอกลับมาเตรียม") && (r.stay_place === "จุดเตรียม" || r.stay_place === "ออกห้องเย็น") && r.dest === "บรรจุ") {
    return { label: "รอบรรจุเสร็จ", color: "#1552F0", bg: "#EAF0FF" };
  }
  if (isBigColdCombo(r)) {
    return { label: "อยู่ในห้องเย็นใหญ่", color: "#6A1B9A", bg: "#F3E5F5" };
  }
  return null;
};

const cleanText = (v) => v.normalize("NFC").replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ").replace(/\s+/g, " ").trim();

export const buildRows = (hus, mappings, mix = {}, plans = [], now = Date.now()) => {
  // production-plan rows (RMForProd) of "จัดการวัตถุดิบ", joined to a HU by MAT|BATCH
  const planByKey = new Map();
  (plans || []).forEach((p) => planBatches(p).forEach((b) => {
    const k = `${norm(p.mat)}|${b}`;
    if (!planByKey.has(k)) planByKey.set(k, []);
    planByKey.get(k).push(p);
  }));
  const plansOf = (h) => (h ? [...new Map((planByKey.get(`${norm(h.mat)}|${norm(h.batch)}`) || []).map((p) => [p.rmfp_id, p])).values()] : []);
  const huByKey = new Map((hus || []).map((h) => [String(h.hu), h]));
  const used = new Set();
  const isShown = (m) => {
    const c = { rm_status: cleanText(String(m.rm_status ?? "")), stay_place: cleanText(String(m.stay_place ?? "")), dest: cleanText(String(m.dest ?? "")) };
    if (HIDDEN_COMBOS.has(comboOf(c))) return false;
    return !(isBigColdCombo(c) && !m.tro_id); // "in the big cold room" needs a trolley
  };
  const rows = (mappings || []).filter(isShown).map((m) => {
    const h = m.hu !== null && m.hu !== undefined && m.hu !== "" ? huByKey.get(String(m.hu)) : null;
    if (h) used.add(String(m.hu));
    const merged = h ? mergeHu(m, h) : { ...m };
    // text written by many screens over the years: hidden spaces / a different Unicode form made "เข้าห้องเย็น" not equal to "เข้าห้องเย็น", so the status rules missed the row
    ["dest", "stay_place", "rm_status"].forEach((k) => { if (typeof merged[k] === "string") merged[k] = cleanText(merged[k]); });
    merged.__key = `map:${m.mapping_id}`;
    merged.__kind = "map";
    merged.__hu = h || null; // the loaded HU row, used by the HU time-stamp tools
    merged.__dbs = safeDbs(merged, now);
    merged.__stage = packStage(merged);
    merged.__plans = plansOf(h);
    merged.__rework = reworkKind(merged);
    // field names the forms of the old pages expect
    merged.production = merged.code;
    merged.line_name = merged.rmm_line_name;
    if (merged.cooked_date) merged.CookedDateTime = String(merged.cooked_date).slice(0, 16);
    return merged;
  });
  (hus || []).forEach((h) => {
    if (used.has(String(h.hu))) return;
    rows.push({ ...h, __key: `hu:${h.hu}`, __kind: "hu", __hu: h, __dbs: [], __plans: plansOf(h) });
  });
  // Prep mixing lists (materials waiting to be mixed). A "loaf" item is a real mapping: the tool is attached to that row instead of a new row.
  const byMapping = new Map(rows.filter((r) => r.__kind === "map").map((r) => [r.mapping_id, r]));
  Object.entries(mix).forEach(([kind, list]) => {
    (list || []).forEach((m, i) => {
      const target = kind === "loaf" && m.mapping_id !== undefined ? byMapping.get(m.mapping_id) : null;
      if (target) { target.__loaf = m; return; }
      const id = m.rmfemu_id ?? m.rmfbatch_id ?? m.mixtp_id ?? m.mapping_id ?? i;
      rows.push({
        ...m, weight_RM: m.weight_RM ?? m.weight, code: m.production || m.code, __key: `mix:${kind}:${id}`, __kind: "mix", __mix: kind, __dbs: [], __hu: null,
      });
    });
  });
  // items waiting to be mixed have no times: they are kept on top so they are not lost below thousands of rows
  rows.forEach((r) => { r.__status = statusOf(r); r.__last = r.__kind === "mix" ? now : lastActivity(r); });
  rows.sort((a, b) => b.__last - a.__last);
  return rows;
};
