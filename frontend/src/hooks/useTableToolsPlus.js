import { useCallback, useEffect, useMemo, useState } from "react";
import { compareValues, deriveColumns } from "./useTableTools";
import { prettify } from "../component/Layout/TableToolbar";
import { cellText, matchesSearch } from "../component/Layout/DataGrid/gridUtils";

const storeKeyOf = (key) => {
  const userId = localStorage.getItem("user_id") || "0";
  return `tableSorts:${userId}:${key}`;
};
const readSorts = (key) => { try { const v = JSON.parse(localStorage.getItem(storeKeyOf(key)) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };

/**
 * Search + per-column value filters + multi sort over the FULL array (before the table paginates it).
 * Sorting is remembered per account (this browser) under `storeKey`. Columns are the primitive keys of the rows.
 */
const useTableToolsPlus = (rows, storeKey) => {
  const [search, setSearch] = useState("");
  const [sorts, setSorts] = useState(() => readSorts(storeKey)); // [{key, dir}]
  const [filters, setFilters] = useState({});                      // { key: [text values] }

  useEffect(() => {
    try { localStorage.setItem(storeKeyOf(storeKey), JSON.stringify(sorts)); } catch { /* storage may be blocked */ }
  }, [sorts, storeKey]);

  const keys = useMemo(() => deriveColumns(rows), [rows]);
  const columns = useMemo(() => keys.map((k) => {
    // numbers / dates are sorted and labelled as such in the column dropdown
    const vals = (rows || []).slice(0, 200).map((r) => r?.[k]).filter((v) => v !== null && v !== undefined && v !== "");
    const type = vals.length && vals.every((v) => typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))) ? "number"
      : vals.length && vals.every((v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) ? "time" : "text";
    return { key: k, label: prettify(k), kind: "data", type };
  }), [keys, rows]);
  const colByKey = useMemo(() => Object.fromEntries(columns.map((c) => [c.key, c])), [columns]);

  const searched = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    if (!search.trim()) return list;
    return list.filter((row) => {
      if (!row || typeof row !== "object") return String(row).toLowerCase().includes(search.trim().toLowerCase());
      const hay = keys.map((k) => row[k]).filter((v) => v !== null && v !== undefined).join(" ").toLowerCase();
      return matchesSearch(hay, search);
    });
  }, [rows, keys, search]);

  const pass = useCallback((row, skip) => Object.entries(filters).every(([k, values]) => k === skip || !colByKey[k] || values.includes(cellText(colByKey[k], row))), [filters, colByKey]);

  const result = useMemo(() => {
    let list = searched.filter((r) => pass(r));
    const active = sorts.filter((s) => colByKey[s.key]);
    if (active.length) {
      list = [...list].sort((x, y) => {
        for (const { key, dir } of active) {
          const c = compareValues(x?.[key], y?.[key]);
          if (c !== 0) return dir === "desc" ? -c : c;
        }
        return 0;
      });
    }
    return list;
  }, [searched, pass, sorts, colByKey]);

  const rowsFor = useCallback((key) => searched.filter((r) => pass(r, key)), [searched, pass]);
  const setSort = useCallback((key, dir) => setSorts((prev) => { const rest = prev.filter((s) => s.key !== key); return dir ? [...rest, { key, dir }] : rest; }), []);
  const setFilter = useCallback((key, values) => setFilters((prev) => { const next = { ...prev }; if (values) next[key] = values; else delete next[key]; return next; }), []);
  const clearAll = useCallback(() => { setSearch(""); setSorts([]); setFilters({}); }, []);

  return { search, setSearch, sorts, setSort, filters, setFilter, clearAll, columns, result, rowsFor, total: Array.isArray(rows) ? rows.length : 0 };
};

export default useTableToolsPlus;
