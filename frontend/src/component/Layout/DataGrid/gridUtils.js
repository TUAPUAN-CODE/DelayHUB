import { compareValues } from "../../../hooks/useTableTools";

export { compareValues };

/** "2026-10-08 13:05:00" -> "08/10 13:05" (year only shown when it is not the current year) */
export const shortTime = (v) => {
  if (!v) return "";
  const d = new Date(String(v).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(v);
  const p = (n) => String(n).padStart(2, "0");
  const year = d.getFullYear() !== new Date().getFullYear() ? `/${String(d.getFullYear()).slice(2)}` : "";
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}${year} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const cellValue = (col, row) => (col.get ? col.get(row) : row[col.key]);

const isEmpty = (v) => v === null || v === undefined || v === "" || v === "-";

/** plain text of a cell: used for search, the value filter of the column dropdown and for export */
export const cellText = (col, row) => {
  if (col.text) return col.text(row) ?? "";
  if (col.kind === "tool") return "";
  const v = cellValue(col, row);
  if (isEmpty(v)) return "";
  if (col.type === "time") return shortTime(v);
  return String(v);
};

/** value used when sorting a column */
export const cellSortValue = (col, row) => {
  if (col.sortValue) return col.sortValue(row);
  const v = cellValue(col, row);
  return isEmpty(v) ? null : v;
};

export const sortRows = (rows, sorts, colByKey, extraFirst) => {
  const active = (sorts || []).filter((s) => colByKey[s.key]);
  if (!active.length && !extraFirst) return rows;
  const list = rows.map((row, i) => ({ row, i, keys: active.map((s) => cellSortValue(colByKey[s.key], row)), first: extraFirst ? extraFirst(row) : 0 }));
  list.sort((a, b) => {
    if (a.first !== b.first) return a.first - b.first;
    for (let k = 0; k < active.length; k += 1) {
      const c = compareValues(a.keys[k], b.keys[k]);
      if (c !== 0) return active[k].dir === "desc" ? -c : c;
    }
    return a.i - b.i; // stable
  });
  return list.map((x) => x.row);
};

export const matchesSearch = (hay, q) => {
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((t) => hay.includes(t));
};
