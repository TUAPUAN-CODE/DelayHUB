// Every status belongs to one or more AREAS (zones). The dropdown / sort of the status column follows the order of the areas, and every area has its own colour.
// Built-in areas + the default area of each status are below. Each account can (column settings, saved in the grid prefs):
//   - add its own areas:            ext.statusAreas = [{ id, title, color, bg, dot }]
//   - put a status in other areas:  ext.statusZones = { [status]: areaId | [areaId, ...] }  (a status can be listed in several areas; the first one gives its colour)

export const ZONES = [
  { id: "bigcold", title: "พื้นที่ห้องเย็นใหญ่", color: "#FFFFFF", bg: "#1D4ED8", dot: "#1D4ED8" },
  { id: "cold", title: "พื้นที่ห้องเย็น", color: "#075985", bg: "#BAE6FD", dot: "#38BDF8" },
  { id: "prep", title: "พื้นที่จุดเตรียม (อื่นๆ)", color: "#6B21A8", bg: "#E9D5FF", dot: "#A855F7" },
  { id: "qc", title: "พื้นที่ QC", color: "#92400E", bg: "#FDE68A", dot: "#F59E0B" },
  { id: "pack", title: "พื้นที่บรรจุ", color: "#166534", bg: "#BBF7D0", dot: "#22C55E" },
  { id: "done", title: "บันทึกเอกสารสมบูรณ์", color: "#1E3A8A", bg: "#BFDBFE", dot: "#3B82F6" },
];
export const DEFAULT_ZONE = "prep"; // a status that is not listed below

/** colours offered to the areas an account adds */
export const AREA_PALETTE = [
  { color: "#FFFFFF", bg: "#BE185D", dot: "#BE185D" },
  { color: "#FFFFFF", bg: "#0F766E", dot: "#0F766E" },
  { color: "#FFFFFF", bg: "#7C3AED", dot: "#7C3AED" },
  { color: "#FFFFFF", bg: "#B45309", dot: "#B45309" },
  { color: "#FFFFFF", bg: "#4D7C0F", dot: "#4D7C0F" },
  { color: "#FFFFFF", bg: "#0369A1", dot: "#0369A1" },
  { color: "#1F2937", bg: "#FDE047", dot: "#EAB308" },
  { color: "#1F2937", bg: "#FDA4AF", dot: "#F43F5E" },
];

// all status names the Sheet can show (in the order they are listed inside an area) and the default area of each
export const STATUS_LIST = [
  ["กำลังละลาย", "bigcold"], ["ละลายเสร็จแล้ว", "bigcold"], ["จ่ายลงไลน์แล้ว", "bigcold"],
  ["อยู่ในห้องเย็น", "cold"], ["อยู่ในห้องเย็นใหญ่", "cold"], ["รอห้องเย็นรับเข้า", "cold"], ["รอรับเข้าห้องเย็น", "cold"],
  ["รอใส่รถเข็น", "prep"], ["รอเตรียมวัตถุดิบใหม่", "prep"], ["รอเตรียมผสมวัตถุดิบ", "prep"], ["อยู่ที่ไลน์", "prep"], ["รอแก้ไข", "prep"], ["ยังไม่มีความเคลื่อนไหว", "prep"], ["-", "prep"],
  ["รอ QC Check", "qc"],
  ["รอบรรจุเสร็จ", "pack"], ["รอบรรจุจัดส่ง", "pack"],
  ["Done", "done"],
];
const DEFAULT_OF = new Map(STATUS_LIST);
const LABEL_ORDER = new Map(STATUS_LIST.map(([l], i) => [l, i]));

const BUILTIN = new Map(ZONES.map((z, i) => [z.id, { ...z, order: i }]));
const indexCache = new WeakMap(); // ext.statusAreas array -> Map(id -> area)

/** Map(id -> area with .order) of the built-in areas + the areas of the account */
export const areaIndex = (ext) => {
  const custom = ext?.statusAreas;
  if (!custom?.length) return BUILTIN;
  let map = indexCache.get(custom);
  if (!map) {
    map = new Map(BUILTIN);
    custom.forEach((a, i) => map.set(a.id, { color: "#FFFFFF", bg: "#6B7489", dot: "#6B7489", ...a, order: ZONES.length + i, custom: true }));
    indexCache.set(custom, map);
  }
  return map;
};
export const allAreas = (ext) => [...areaIndex(ext).values()];

/** area objects (with .order) a status is listed in: the account's own choice first, then the default area */
export const zonesOf = (label, ext) => {
  const idx = areaIndex(ext);
  const own = ext?.statusZones?.[label];
  const ids = (Array.isArray(own) ? own : own ? [own] : []).filter((id) => idx.has(id));
  if (ids.length) return ids.map((id) => idx.get(id));
  return [idx.get(DEFAULT_OF.get(label)) || idx.get(DEFAULT_ZONE)];
};
export const zoneOf = (label, ext) => zonesOf(label, ext)[0];
export const rankOf = (label, zone) => zone.order * 100 + (LABEL_ORDER.get(label) ?? 99);

/** status chip { label, color, bg } -> the same chip in the colour of its (first) area, plus { zone, zones, rank } used by the status sort / dropdown */
export const withZone = (st, ext) => {
  const zones = zonesOf(st.label, ext);
  const zone = zones[0];
  return { label: st.label, color: zone.color, bg: zone.bg, zone, zones, rank: rankOf(st.label, zone) };
};

/** DataGrid prepareRows: re-colour the status of every row with the account's own areas; same array when there is no change */
export const applyStatusZones = (rows, ext) => {
  if (!Object.keys(ext?.statusZones || {}).length && !ext?.statusAreas?.length) return rows;
  return rows.map((r) => (r.__status ? { ...r, __status: withZone(r.__status, ext) } : r));
};
