import { analyzeRow } from "../../ColdStorages/SapSheet/Asset/sapTimeline";

// One lot can split: HU --(History.hu)--> mappings --(from_mapping_id)--> child mappings.
// The sheet shows it as ONE table with parent/child rows. Rows without a HU (e.g. made in prep) are top-level mappings.

const TIME_KEYS = [
  "withdraw_date", "start_defrost_date", "end_defrost_date", "input_pd_date", "output_pd_date", "input_cd_date",
  "cooked_date", "rmit_date", "qc_date", "sc_pack_date", "come_cold_date", "out_cold_date", "cs_come_cold_date", "cs_out_cold_date",
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

/** status text/colour shown in the first column */
export const rowStatus = (node) => {
  const r = node.row;
  if (node.kind === "hu") {
    const a = analyzeRow(r);
    return { label: a.status.label, color: a.status.color, bg: a.status.bg };
  }
  const st = String(r.rm_status || "");
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

export const buildTree = (hus, mappings) => {
  const huNodes = new Map();
  const roots = [];

  (hus || []).forEach((h) => {
    const node = { id: `hu:${h.hu}`, kind: "hu", row: h, children: [] };
    huNodes.set(String(h.hu), node);
  });

  const mapNodes = new Map();
  (mappings || []).forEach((m) => {
    mapNodes.set(m.mapping_id, { id: `map:${m.mapping_id}`, kind: "map", row: m, children: [] });
  });

  mapNodes.forEach((node) => {
    const m = node.row;
    const parentMap = m.from_mapping_id ? mapNodes.get(m.from_mapping_id) : null;
    if (parentMap && parentMap !== node) {
      parentMap.children.push(node);
      return;
    }
    if (m.hu !== null && m.hu !== undefined && m.hu !== "") {
      const key = String(m.hu);
      let huNode = huNodes.get(key);
      if (!huNode) {
        // HU older than the loaded window: build its header from the mapping so the grouping is still visible
        huNode = { id: `hu:${key}`, kind: "hu", synthetic: true, row: { hu: key, batch: m.batch_after, mat: m.mat, mat_name: m.mat_name, weight: m.weight }, children: [] };
        huNodes.set(key, huNode);
      }
      huNode.children.push(node);
      return;
    }
    roots.push(node);
  });

  huNodes.forEach((n) => roots.push(n));

  const stamp = (node) => {
    node.children.forEach(stamp);
    node.latest = Math.max(lastActivity(node.row), ...node.children.map((c) => c.latest || 0));
  };
  roots.forEach(stamp);
  const sortKids = (node) => { node.children.sort((a, b) => (a.row.mapping_id || 0) - (b.row.mapping_id || 0)); node.children.forEach(sortKids); };
  roots.forEach(sortKids);
  roots.sort((a, b) => b.latest - a.latest);
  return roots;
};

export const flattenText = (node) => {
  const r = node.row;
  return [r.hu, r.mapping_id, r.tro_id, r.batch, r.batch_after, r.mat, r.mat_name, r.code, r.rmm_line_name, r.rm_status, r.dest, r.cs_name, r.slot_id, r.remark]
    .filter((v) => v !== null && v !== undefined)
    .join(" ")
    .toLowerCase();
};

/** keeps a node when it or any descendant matches */
export const filterTree = (roots, predicate) => {
  const walk = (node) => {
    const kids = node.children.map(walk).filter(Boolean);
    if (predicate(node) || kids.length) return { ...node, children: kids };
    return null;
  };
  return roots.map(walk).filter(Boolean);
};
