// Every status belongs to an AREA (zone). The dropdown / sort of the status column follows the order of the zones, and every zone has its own colour.
// The default area of a status is below; each account can change it in the column settings (saved in the grid prefs as ext.statusZones = { [status]: zoneId }).

export const ZONES = [
  { id: "bigcold", title: "พื้นที่ห้องเย็นใหญ่", color: "#FFFFFF", bg: "#1D4ED8", dot: "#1D4ED8" },
  { id: "cold", title: "พื้นที่ห้องเย็น", color: "#075985", bg: "#BAE6FD", dot: "#38BDF8" },
  { id: "prep", title: "พื้นที่จุดเตรียม (อื่นๆ)", color: "#6B21A8", bg: "#E9D5FF", dot: "#A855F7" },
  { id: "qc", title: "พื้นที่ QC", color: "#92400E", bg: "#FDE68A", dot: "#F59E0B" },
  { id: "pack", title: "พื้นที่บรรจุ", color: "#166534", bg: "#BBF7D0", dot: "#22C55E" },
  { id: "done", title: "บันทึกเอกสารสมบูรณ์", color: "#0F766E", bg: "#99F6E4", dot: "#14B8A6" },
];
const ZONE_BY_ID = new Map(ZONES.map((z, i) => [z.id, { ...z, order: i }]));
export const DEFAULT_ZONE = "prep"; // a status that is not listed below

// all status names the Sheet can show (in the order they are listed inside a zone) and the default zone of each
export const STATUS_LIST = [
  ["กำลังละลาย", "bigcold"], ["ละลายเสร็จแล้ว", "bigcold"], ["จ่ายลงไลน์แล้ว", "bigcold"],
  ["อยู่ในห้องเย็น", "cold"], ["อยู่ในห้องเย็นใหญ่", "cold"], ["รอห้องเย็นรับเข้า", "cold"], ["รอรับเข้าห้องเย็น", "cold"],
  ["รอเตรียมวัตถุดิบใหม่", "prep"], ["รอเตรียมผสมวัตถุดิบ", "prep"], ["อยู่ที่ไลน์", "prep"], ["รอแก้ไข", "prep"], ["ยังไม่มีความเคลื่อนไหว", "prep"], ["-", "prep"],
  ["รอ QC Check", "qc"],
  ["รอบรรจุเสร็จ", "pack"], ["รอบรรจุจัดส่ง", "pack"],
  ["Done", "done"],
];
const DEFAULT_OF = new Map(STATUS_LIST);
const LABEL_ORDER = new Map(STATUS_LIST.map(([l], i) => [l, i]));

/** zone object (with .order) of a status: the account's own choice first, then the default */
export const zoneOf = (label, overrides) => ZONE_BY_ID.get(overrides?.[label]) || ZONE_BY_ID.get(DEFAULT_OF.get(label)) || ZONE_BY_ID.get(DEFAULT_ZONE);
export const rankOf = (label, zone) => zone.order * 100 + (LABEL_ORDER.get(label) ?? 99);

/** { zone, rank, color, bg } of a status for the given overrides */
export const statusZone = (label, overrides) => {
  const zone = zoneOf(label, overrides);
  return { zone, rank: rankOf(label, zone) };
};

/** status chip { label, color, bg } -> the same chip in the colour of its zone, plus { zone, rank } used by the status sort / dropdown */
export const withZone = (st, overrides) => {
  const { zone, rank } = statusZone(st.label, overrides);
  return { label: st.label, color: zone.color, bg: zone.bg, zone, rank };
};

/** DataGrid prepareRows: re-colour the status of every row with the account's own areas (ext.statusZones); same array when there is no change */
export const applyStatusZones = (rows, ext) => {
  const o = ext?.statusZones;
  if (!o || !Object.keys(o).length) return rows;
  return rows.map((r) => (r.__status ? { ...r, __status: withZone(r.__status, o) } : r));
};
