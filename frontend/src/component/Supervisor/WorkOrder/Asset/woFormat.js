// Display helpers of the work-order page. The API sends SQL datetimes as ISO strings with a "Z" although they are plain local
// (factory) times, so they are read with the UTC getters: the wall-clock time stored in the database is shown unchanged.

const pad = (n) => String(n).padStart(2, "0");

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const fmtDate = (v) => {
  const d = toDate(v);
  return d ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` : "-";
};

export const fmtTime = (v) => {
  const d = toDate(v);
  return d ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : "-";
};

export const fmtDateTime = (v) => {
  const d = toDate(v);
  return d ? `${fmtDate(v)} ${fmtTime(v)}` : "-";
};

export const fmtNum = (v, digits = 2) => {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  return Number.isFinite(n) ? String(Number(n.toFixed(digits))) : String(v);
};

// What each MixType is, from the document it prints (TunaIngredientWIPReports): gravy / meat mix / chemical coating.
const MIX_TYPE_NAMES = {
  10: "เกรวี่", 20: "เกรวี่", 80: "เกรวี่", 90: "เกรวี่",
  30: "เนื้อผสม", 50: "เนื้อผสม", 60: "เนื้อผสม", 70: "เนื้อผสม",
  40: "เคมีคลุก", 100: "เคมีคลุก",
};

export const mixTypeLabel = (mixType) => (MIX_TYPE_NAMES[mixType] ? `${MIX_TYPE_NAMES[mixType]} (${mixType})` : `MixType ${mixType}`);

export const groupBy = (rows, key) => {
  const map = new Map();
  rows.forEach((r) => {
    if (!map.has(r[key])) map.set(r[key], []);
    map.get(r[key]).push(r);
  });
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
};

/** The overview rows come as [{section, rows}]; the page wants { section: rows }. */
export const countsOf = (overview) => Object.fromEntries((overview || []).map((o) => [o.section, o.rows]));
