import { useMemo, useState, useCallback } from "react";

const collator = new Intl.Collator(["th", "en"], { numeric: true, sensitivity: "base" });
const DATE_RE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?/;

const isPrimitive = (v) => v === null || ["string", "number", "boolean"].includes(typeof v);

// compare two cell values: empty last, number < number, date < date, else natural (Thai-aware) text
export const compareValues = (a, b) => {
  const ea = a === null || a === undefined || a === "";
  const eb = b === null || b === undefined || b === "";
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  if (DATE_RE.test(sa) && DATE_RE.test(sb)) {
    const ta = Date.parse(sa.replace(" ", "T"));
    const tb = Date.parse(sb.replace(" ", "T"));
    if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb;
  }
  const na = Number(sa);
  const nb = Number(sb);
  if (sa.trim() !== "" && sb.trim() !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return collator.compare(sa, sb);
};

export const deriveColumns = (rows) => {
  const keys = [];
  const seen = new Set();
  (rows || []).slice(0, 200).forEach((row) => {
    if (!row || typeof row !== "object") return;
    Object.keys(row).forEach((k) => {
      if (seen.has(k) || k.startsWith("_")) return;
      if (isPrimitive(row[k])) { seen.add(k); keys.push(k); }
    });
  });
  return keys;
};

// Runs search + multi-column sort on the FULL array (before any table pagination)
const useTableTools = (rows) => {
  const [search, setSearch] = useState("");
  const [sorts, setSorts] = useState([]); // [{key, dir}]

  const columns = useMemo(() => deriveColumns(rows), [rows]);

  const result = useMemo(() => {
    let list = Array.isArray(rows) ? rows : [];
    const q = search.trim().toLowerCase();
    if (q) {
      const terms = q.split(/\s+/);
      list = list.filter((row) => {
        if (!row || typeof row !== "object") return String(row).toLowerCase().includes(q);
        const hay = columns.map((k) => row[k]).filter((v) => v !== null && v !== undefined).join(" ").toLowerCase();
        return terms.every((t) => hay.includes(t));
      });
    }
    if (sorts.length) {
      list = [...list].sort((x, y) => {
        for (const { key, dir } of sorts) {
          const c = compareValues(x?.[key], y?.[key]);
          if (c !== 0) return dir === "desc" ? -c : c;
        }
        return 0;
      });
    }
    return list;
  }, [rows, columns, search, sorts]);

  const toggleSort = useCallback((key, dir) => {
    setSorts((prev) => {
      const cur = prev.find((s) => s.key === key);
      if (cur && cur.dir === dir) return prev.filter((s) => s.key !== key);
      if (cur) return prev.map((s) => (s.key === key ? { key, dir } : s));
      return [...prev, { key, dir }];
    });
  }, []);

  const clearSorts = useCallback(() => setSorts([]), []);

  return { search, setSearch, sorts, toggleSort, clearSorts, columns, result, total: Array.isArray(rows) ? rows.length : 0 };
};

export default useTableTools;
