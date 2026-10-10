import { compareValues } from "../../../hooks/useTableTools";

export { compareValues };

const TIME_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/;
/** "2026-10-08 13:05:00" -> "08/10/2026 13:05" (the year is always shown: a table can hold several years). Plain string work: this runs for thousands of cells. */
export const shortTime = (v) => {
  if (!v) return "";
  const str = String(v);
  const m = TIME_RE.exec(str);
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
  const d = new Date(str.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return str;
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
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

/** text a column filter works on: normally the cell text; a column can group its values differently (e.g. the DBS columns by colour) */
export const cellFilterText = (col, row) => (col.filterText ? col.filterText(row) : cellText(col, row));

/** value used when sorting a column */
export const cellSortValue = (col, row) => {
  if (col.sortValue) return col.sortValue(row);
  const v = cellValue(col, row);
  return isEmpty(v) ? null : v;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;
const collator = new Intl.Collator(["th", "en"], { numeric: true, sensitivity: "base" });
/** sort key of a value, computed ONCE per row (dates -> time stamp, numeric text -> number, anything else -> text) so a sort does not parse in every comparison */
const sortKey = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return { n: v, s: String(v) };
  const s = String(v);
  if (DATE_RE.test(s)) { const t = Date.parse(s.replace(" ", "T")); if (!Number.isNaN(t)) return { n: t, s }; }
  if (s.trim() !== "") { const n = Number(s); if (!Number.isNaN(n)) return { n, s }; }
  return { n: null, s };
};
const compareKeys = (a, b) => {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  if (a.n !== null && b.n !== null) return a.n - b.n;
  return collator.compare(a.s, b.s);
};

export const sortRows = (rows, sorts, colByKey, extraFirst) => {
  const active = (sorts || []).filter((s) => colByKey[s.key]);
  if (!active.length && !extraFirst) return rows;
  const list = rows.map((row, i) => ({ row, i, keys: active.map((s) => sortKey(cellSortValue(colByKey[s.key], row))), first: extraFirst ? extraFirst(row) : 0 }));
  list.sort((a, b) => {
    if (a.first !== b.first) return a.first - b.first;
    for (let k = 0; k < active.length; k += 1) {
      const c = compareKeys(a.keys[k], b.keys[k]);
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
