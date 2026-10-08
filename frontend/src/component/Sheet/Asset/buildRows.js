import { analyzeRow } from "../../ColdStorages/SapSheet/Asset/sapTimeline";
import { getDbs } from "./dbs";

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

const safeDbs = (row) => { try { return getDbs(row); } catch (err) { console.error("[Sheet] DBS error:", err); return []; } };

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

/** status chip of a row */
export const statusOf = (r) => {
  if (r.__kind === "hu") {
    const a = analyzeRow(r);
    return { label: a.status.label, color: a.status.color, bg: a.status.bg };
  }
  const st = String(r.rm_status || "");
  if (r.__stage === "ready") return { label: "พร้อมใส่รถเข็น", color: "#1552F0", bg: "#EAF0FF" };
  if (st.includes("รอQC") || st.includes("รอ MD")) return { label: "รอ QC", color: "#B45309", bg: "#FEF3C7" };
  if (st === "รอแก้ไข") return { label: "รอแก้ไข", color: "#B91C1C", bg: "#FEE2E2" };
  if (r.dest === "บรรจุเสร็จ") return { label: "บรรจุเสร็จ", color: "#047857", bg: "#D1FAE5" };
  if (r.cs_id) return { label: `อยู่ใน ${r.cs_name || "ห้องเย็น"}`, color: "#6A1B9A", bg: "#F3E5F5" };
  if (r.tro_id && (r.dest === "บรรจุ" || r.dest === "รถเข็นรอจัดส่ง")) return { label: "อยู่ในรถเข็น", color: "#047857", bg: "#D1FAE5" };
  if (["รอCheckin", "ห้องเย็นใหญ่", "เข้าห้องเย็น", "ห้องเย็น", "เข้าห้องเย็นใหญ่"].includes(r.dest)) {
    return { label: "รอรับเข้าห้องเย็น", color: "#B45309", bg: "#FEF3C7" };
  }
  return { label: r.dest || r.stay_place || st || "-", color: "#6B7489", bg: "#F1F3F8" };
};

/** the HU is the source of truth for the SAP time stamps; History only holds a copy */
const mergeHu = (m, h) => {
  const out = { ...m };
  SAP_KEYS.forEach((k) => { if (h[k]) out[k] = h[k]; });
  ["cs_re", "cs_re_2", "cs_re_3", "before_hu"].forEach((k) => { if (h[k] !== undefined && h[k] !== null) out[k] = h[k]; });
  if (!out.hu) out.hu = h.hu;
  return out;
};

export const buildRows = (hus, mappings) => {
  const huByKey = new Map((hus || []).map((h) => [String(h.hu), h]));
  const used = new Set();
  const rows = (mappings || []).map((m) => {
    const h = m.hu !== null && m.hu !== undefined && m.hu !== "" ? huByKey.get(String(m.hu)) : null;
    if (h) used.add(String(m.hu));
    const merged = h ? mergeHu(m, h) : { ...m };
    merged.__key = `map:${m.mapping_id}`;
    merged.__kind = "map";
    merged.__hu = h || null; // the loaded HU row, used by the HU time-stamp tools
    merged.__dbs = safeDbs(merged);
    merged.__stage = packStage(merged);
    // field names the forms of the old pages expect
    merged.production = merged.code;
    merged.line_name = merged.rmm_line_name;
    if (merged.cooked_date) merged.CookedDateTime = String(merged.cooked_date).slice(0, 16);
    return merged;
  });
  (hus || []).forEach((h) => {
    if (used.has(String(h.hu))) return;
    rows.push({ ...h, __key: `hu:${h.hu}`, __kind: "hu", __hu: h, __dbs: [] });
  });
  rows.forEach((r) => { r.__status = statusOf(r); r.__last = lastActivity(r); });
  rows.sort((a, b) => b.__last - a.__last);
  return rows;
};
