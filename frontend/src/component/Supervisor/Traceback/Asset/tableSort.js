import { useMemo, useState } from 'react';

// Click-to-sort for the Traceback tables: a column sorts by col.sortValue(row) when it has one, else by row[col.key]
// (a column that has neither — a button, a drawing — is not sortable). Empty values always go last.
const isEmpty = (v) => v === null || v === undefined || v === '' || v === '—' || v === '-';
const asNumber = (v) => (typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : null));

export const valueOf = (col, row) => (col.sortValue ? col.sortValue(row) : row?.[col.key]);

export const isSortable = (col, rows) => col.sortable !== false && (!!col.sortValue || (rows || []).some((r) => r?.[col.key] !== undefined));

const compare = (a, b) => {
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== null && nb !== null) return na - nb;
  return String(a).localeCompare(String(b), 'th', { numeric: true });
};

/** rows sorted by sort = { key, dir: 'asc' | 'desc' } (the same array when no sort is picked) */
export const sortRows = (rows, columns, sort) => {
  if (!sort?.key || !rows?.length) return rows;
  const col = (columns || []).find((c) => c.key === sort.key);
  if (!col) return rows;
  const dir = sort.dir === 'desc' ? -1 : 1;
  return rows
    .map((r, i) => ({ r, i, v: valueOf(col, r) }))
    .sort((x, y) => {
      const ex = isEmpty(x.v);
      const ey = isEmpty(y.v);
      if (ex || ey) return ex === ey ? x.i - y.i : (ex ? 1 : -1);
      return compare(x.v, y.v) * dir || x.i - y.i;
    })
    .map((x) => x.r);
};

/** state of the header clicks: first click ascending, second descending, third back to the original order */
const useTableSort = (rows, columns) => {
  const [sort, setSort] = useState(null);
  const sorted = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);
  const toggle = (key) => setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));
  return { sorted, sort, toggle };
};

export default useTableSort;
