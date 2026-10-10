// Numbers of the unified Report. The minutes of every row come from Sheet/Asset/dbs.js (row.__dbs = [DBS1..DBS4]) — the same formulas as the Sheet tables.

export const GROUP_BY = [
  { key: "mat_name", label: "ชื่อวัตถุดิบ" },
  { key: "rm_group_name", label: "กลุ่มวัตถุดิบ" },
  { key: "rmm_line_name", label: "ไลน์" },
  { key: "doc_no", label: "แผนผลิต (Doc)" },
  { key: "day", label: "วัน (ตามเวลาบรรจุเสร็จ)" },
];

export const PARETO_MEASURES = [
  { key: "excess", label: "เวลาที่เกินมาตรฐานรวม (นาที)" },
  { key: "overCount", label: "จำนวนรายการที่เกินมาตรฐาน" },
  { key: "totalMin", label: "เวลารวมทั้งหมด (นาที)" },
  { key: "count", label: "จำนวนรายการ" },
];

const EMPTY = "(ไม่ระบุ)";

/** day of the last stamp of a row (yyyy-MM-dd): sc_pack_date, or the last thing that happened */
const dayOf = (r) => {
  const d = r.sc_pack_date || r.out_cold_date || r.come_cold_date || r.rmit_date || r.cooked_date;
  return d ? String(d).slice(0, 10) : EMPTY;
};

export const groupValue = (row, groupBy) => {
  if (groupBy === "day") return dayOf(row);
  const v = row[groupBy];
  return v === null || v === undefined || String(v).trim() === "" ? EMPTY : String(v).trim();
};

/** value at percentile p (0-100) of a sorted array, linear interpolation */
export const percentile = (sorted, p) => {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (Math.min(Math.max(p, 0), 100) / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
};

export const fmtMin = (m) => {
  if (m === null || m === undefined || Number.isNaN(m)) return "-";
  const v = Math.round(m);
  const h = Math.floor(v / 60);
  const mm = v % 60;
  return h ? `${h}:${String(mm).padStart(2, "0")} ชม.` : `${mm} นาที`;
};

/**
 * One line per group for DBS number `dbsIdx` (0..3).
 * Rows without a value for that DBS are left out (they have nothing to measure). `over` = longer than the standard of the row's own raw material group.
 */
export const groupStats = (rows, groupBy, dbsIdx, pct = 80) => {
  const map = new Map();
  for (const r of rows) {
    const d = r.__dbs?.[dbsIdx];
    if (!d || d.minutes === null || d.minutes === undefined || Number.isNaN(d.minutes)) continue;
    const key = groupValue(r, groupBy);
    let g = map.get(key);
    if (!g) { g = { key, values: [], over: 0, excess: 0, total: 0, stdSum: 0, stdN: 0 }; map.set(key, g); }
    g.values.push(d.minutes);
    g.total += d.minutes;
    if (d.std !== null && d.std !== undefined) { g.stdSum += d.std; g.stdN += 1; }
    if (d.over) { g.over += 1; g.excess += d.minutes - d.std; }
  }
  return [...map.values()].map((g) => {
    const sorted = [...g.values].sort((a, b) => a - b);
    return {
      key: g.key,
      count: sorted.length,
      avg: g.total / sorted.length,
      pct: percentile(sorted, pct),
      max: sorted[sorted.length - 1],
      min: sorted[0],
      std: g.stdN ? g.stdSum / g.stdN : null,
      overCount: g.over,
      overPct: (g.over / sorted.length) * 100,
      excess: g.excess,
      totalMin: g.total,
    };
  });
};

/** Pareto: groups sorted by the measure (largest first), with the share and the cumulative share. Groups with 0 are left out. */
export const paretoOf = (stats, measure, top = 30) => {
  const list = stats.filter((s) => s[measure] > 0).sort((a, b) => b[measure] - a[measure]);
  const sum = list.reduce((a, s) => a + s[measure], 0);
  let acc = 0;
  const rows = list.map((s, i) => {
    acc += s[measure];
    return { rank: i + 1, key: s.key, value: s[measure], share: sum ? (s[measure] / sum) * 100 : 0, cum: sum ? (acc / sum) * 100 : 0, count: s.count, overCount: s.overCount };
  });
  return { rows: rows.slice(0, top), total: sum, groups: rows.length, shown: Math.min(rows.length, top) };
};

/** summary of all rows for the cards on top */
export const totals = (rows, dbsIdx) => {
  let n = 0; let over = 0; let sum = 0;
  for (const r of rows) {
    const d = r.__dbs?.[dbsIdx];
    if (!d || d.minutes === null || d.minutes === undefined) continue;
    n += 1; sum += d.minutes;
    if (d.over) over += 1;
  }
  return { n, over, overPct: n ? (over / n) * 100 : 0, avg: n ? sum / n : null };
};
