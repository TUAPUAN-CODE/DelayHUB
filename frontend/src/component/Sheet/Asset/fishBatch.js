// Fish raw materials (RawMatType.rm_type_id): ปลา 3 · ไข่ปลา 38/39 · เศษทูน่า 2X 45 · ปลาทูน่า 67/100 · ปลาแกะ 68 · ปลาสดสับ/เครื่องในปลา 69
// · เลือดทูน่า/เศษทูน่า 70 · MDM/CCM/เครื่องในปลา 71/72 · ปลาข้าวสาร/ปลากะตัก 80 · Tuna scrap 112
import { shiftOf, workDayOf } from "./shiftTime.js";

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
