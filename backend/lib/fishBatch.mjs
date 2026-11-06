// COPY of frontend/src/component/Sheet/Asset/fishBatch.js + shiftTime.js (ES module) so the alert worker finds the same Code / different Batch rows as the Done table's check button. Keep them identical.
// Shift / factory day of a finished row by the time packing was done (pure functions, no React: also used by the tests)
//   DS = 06:00 – 17:30 · NS = 17:30 – 06:00 (the night runs into the next day: 00:00 – 05:59 is still the NS of the day before)
const DS_FROM = 6 * 60;        // 06:00
const DS_TO = 17 * 60 + 30;    // 17:30

export const toDate = (v) => {
  if (v === null || v === undefined || v === "" || v === "-") return null;
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "DS" | "NS" | null (not packed yet) */
export const shiftOf = (v) => {
  const d = toDate(v);
  if (!d) return null;
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= DS_FROM && m < DS_TO ? "DS" : "NS";
};

const p2 = (n) => String(n).padStart(2, "0");
/** factory day (yyyy-MM-dd) of a time: the night shift after midnight (00:00 – 05:59) still belongs to the day before; "" when there is no time */
export const workDayOf = (v) => {
  const d = toDate(v);
  if (!d) return "";
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getHours() * 60 + d.getMinutes() < DS_FROM ? 1 : 0));
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`;
};



export const FISH_TYPE_IDS = new Set([3, 38, 39, 45, 67, 68, 69, 70, 71, 72, 80, 100, 112]);

export const isFishRow = (row) => FISH_TYPE_IDS.has(Number(row?.rm_type_id));

const clean = (v) => String(v ?? "").trim();

/**
 * Remark of the Delay report (PDF F3PFPF67 / Excel F3PFPV04): a fish row gets its starting batch ("Batch ตั้งต้น: …") in front of the typed remark.
 * Rows without batch_before (other pages) and non-fish rows keep the remark as it was.
 */
export const reportRemark = (row) => {
  const remark = clean(row?.remark_dalay);
  const origin = clean(row?.batch_before);
  if (!origin || !isFishRow(row)) return remark;
  const tag = `Batch ตั้งต้น: ${origin}`;
  return remark ? `${tag} · ${remark}` : tag;
};

/**
 * Fish rows that ran the same Code (plan + line, e.g. "A217 (Can B)") with the SAME material (mat) but different starting batches (batch_before),
 * inside the same factory day and shift (by the time packing was done, sc_pack_date: the night shift after midnight belongs to the day before).
 * -> [{ day, shift, groups: [{ code, mat, mat_name, batches: [{ batch, rows: [row] }] }] }] (only groups with 2 or more different batches), newest day first, DS before NS.
 */
export const findSameCodeDifferentBatch = (rows) => {
  const groups = new Map();
  (rows || []).forEach((r) => {
    if (!isFishRow(r)) return;
    const code = clean(r.code) || [clean(r.doc_no ?? r.production), clean(r.rmm_line_name) && `(${clean(r.rmm_line_name)})`].filter(Boolean).join(" ");
    const mat = clean(r.mat).toUpperCase();
    const batch = clean(r.batch_before).toUpperCase();
    const day = workDayOf(r.sc_pack_date);
    const shift = shiftOf(r.sc_pack_date) || "";
    if (!code || !mat || !batch) return;
    const key = `${day}\u0000${shift}\u0000${code}\u0000${mat}`;
    if (!groups.has(key)) groups.set(key, { day, shift, code, mat, mat_name: clean(r.mat_name), byBatch: new Map() });
    const g = groups.get(key);
    if (!g.byBatch.has(batch)) g.byBatch.set(batch, []);
    g.byBatch.get(batch).push(r);
  });
  const found = [...groups.values()].filter((g) => g.byBatch.size >= 2).map((g) => ({
    day: g.day, shift: g.shift, code: g.code, mat: g.mat, mat_name: g.mat_name,
    batches: [...g.byBatch.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([batch, rs]) => ({ batch, rows: rs })),
  }));
  const sections = new Map();
  found.forEach((g) => {
    const k = `${g.day}\u0000${g.shift}`;
    if (!sections.has(k)) sections.set(k, { day: g.day, shift: g.shift, groups: [] });
    sections.get(k).groups.push({ code: g.code, mat: g.mat, mat_name: g.mat_name, batches: g.batches });
  });
  const shiftRank = (x) => (x === "DS" ? 0 : x === "NS" ? 1 : 2);
  return [...sections.values()]
    .map((sec) => ({ ...sec, groups: sec.groups.sort((x, y) => x.code.localeCompare(y.code, "th", { numeric: true }) || x.mat.localeCompare(y.mat)) }))
    .sort((x, y) => y.day.localeCompare(x.day) || shiftRank(x.shift) - shiftRank(y.shift));
};
