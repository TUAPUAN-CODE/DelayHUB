// Fish raw materials (RawMatType.rm_type_id): ปลา 3 · ไข่ปลา 38/39 · เศษทูน่า 2X 45 · ปลาทูน่า 67/100 · ปลาแกะ 68 · ปลาสดสับ/เครื่องในปลา 69
// · เลือดทูน่า/เศษทูน่า 70 · MDM/CCM/เครื่องในปลา 71/72 · ปลาข้าวสาร/ปลากะตัก 80 · Tuna scrap 112
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
 * Fish rows that ran the same Code (plan + line, e.g. "A217 (Can B)") with different starting batches (batch_before).
 * -> [{ code, batches: [{ batch, rows: [row] }] }] (only codes with 2 or more different batches), codes and batches sorted.
 */
export const findSameCodeDifferentBatch = (rows) => {
  const byCode = new Map();
  (rows || []).forEach((r) => {
    if (!isFishRow(r)) return;
    const code = clean(r.code) || [clean(r.doc_no ?? r.production), clean(r.rmm_line_name) && `(${clean(r.rmm_line_name)})`].filter(Boolean).join(" ");
    const batch = clean(r.batch_before).toUpperCase();
    if (!code || !batch) return;
    if (!byCode.has(code)) byCode.set(code, new Map());
    const m = byCode.get(code);
    if (!m.has(batch)) m.set(batch, []);
    m.get(batch).push(r);
  });
  return [...byCode.entries()]
    .filter(([, m]) => m.size >= 2)
    .map(([code, m]) => ({ code, batches: [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([batch, rs]) => ({ batch, rows: rs })) }))
    .sort((a, b) => a.code.localeCompare(b.code, "th", { numeric: true }));
};
