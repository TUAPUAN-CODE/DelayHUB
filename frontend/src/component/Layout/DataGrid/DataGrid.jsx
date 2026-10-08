import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import TableViewIcon from "@mui/icons-material/TableView";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import RefreshIcon from "@mui/icons-material/Refresh";
import ColumnFilterBar from "./ColumnFilterBar";
import ColumnChooser from "./ColumnChooser";
import useGridPrefs from "./useGridPrefs";
import { exportExcel, exportPdf } from "./exportGrid";
import { cellText, cellValue, matchesSearch, shortTime, sortRows } from "./gridUtils";

const ROW_BG = { green: "#E8F5E9", yellow: "#FFF8E1", red: "#FDECEA" };
const COLOR_LABEL = { green: "เขียว", yellow: "เหลือง", red: "แดง" };
const COLOR_FG = { green: "#2E7D32", yellow: "#B26A00", red: "#C62828" };
const COLOR_ORDER = { red: 0, yellow: 1, green: 2 };
const CHECK_W = 44;
const HEAD_H = 32;
const HEAD = { color: "#fff", fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap", borderColor: "rgba(255,255,255,.18)", padding: "6px 8px" };

const DefaultCell = ({ col, row }) => {
  const v = cellValue(col, row);
  const empty = v === null || v === undefined || v === "" || v === "-";
  if (empty) return <span style={{ color: "#C5CCD9" }}>-</span>;
  if (col.type === "time") return <span style={{ whiteSpace: "nowrap" }}>{shortTime(v)}</span>;
  return <span>{String(v)}</span>;
};

const GridRow = memo(({ row, cols, frozenLeft, bg, selectable, checked, canSelect, onToggle, ctx }) => (
  <TableRow hover sx={{ "& td": { background: bg, borderBottom: "1px solid #EEF2F9" } }}>
    {selectable && (
      <TableCell sx={{ position: "sticky", left: 0, zIndex: 2, background: bg, p: 0, width: CHECK_W, minWidth: CHECK_W, maxWidth: CHECK_W }}>
        <Checkbox size="small" checked={checked} disabled={!canSelect} onChange={onToggle} />
      </TableCell>
    )}
    {cols.map((c) => {
      const left = frozenLeft[c.key];
      const sticky = left !== undefined;
      return (
        <TableCell
          key={c.key} align={c.align || "left"}
          sx={{
            fontSize: 12.5, padding: "3px 8px", background: bg,
            ...(sticky ? { position: "sticky", left, zIndex: 2, width: c.width, minWidth: c.width, maxWidth: c.width, borderRight: c.lastFrozen ? "2px solid #D5DCEB" : undefined } : { minWidth: c.width }),
          }}
        >
          {c.render ? c.render(row, ctx) : <DefaultCell col={c} row={row} />}
        </TableCell>
      );
    })}
  </TableRow>
));
GridRow.displayName = "GridRow";

/**
 * Standard table of the whole system: tool columns frozen on the left, "รายการ" (mapping_id) next, per-column dropdown buttons
 * (sort / search / value filter), column chooser per account, row colours by delay, Excel / PDF export.
 *
 * columns: [{ key, label, group, kind: 'tool'|'data', frozen, type: 'text'|'time'|'number', width, align, get(row), text(row), sortValue(row), render(row, ctx) }]
 * rowColor(row, ext) -> 'green' | 'yellow' | 'red' | null      (optional; enables the colour chips + colour sort)
 */
const DataGrid = ({
  gridKey, title, columns, groups, defaultVisible, defaultSorts, defaultExt, rows, rowKey,
  loading = false, error = "", onReload, searchPlaceholder = "ค้นหาทุกคอลัมน์...", pageSize = 100,
  rowColor, colorSettings, toolbarExtra, selectable = false, selected, onSelectedChange, isSelectable, ctx,
  hideExport = false, caption, emptyText = "ไม่มีรายการ", maxHeight = "68vh",
}) => {
  const prefs = useGridPrefs(gridKey, { visible: defaultVisible, sorts: defaultSorts, ext: defaultExt });
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({}); // { colKey: [values] } — not saved (a saved filter would silently hide new rows)
  const [colorFirst, setColorFirst] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const colByKey = useMemo(() => Object.fromEntries(columns.map((c) => [c.key, c])), [columns]);

  // visible columns: frozen ones (tools, status, รายการ) first, the rest in registry order
  const visibleCols = useMemo(() => {
    const on = new Set(prefs.visible);
    const list = columns.filter((c) => on.has(c.key));
    const frozen = list.filter((c) => c.frozen);
    const rest = list.filter((c) => !c.frozen);
    return [...frozen, ...rest];
  }, [columns, prefs.visible]);

  const { frozenLeft, cols } = useMemo(() => {
    let left = selectable ? CHECK_W : 0;
    const map = {};
    const frozenCols = visibleCols.filter((c) => c.frozen);
    const out = visibleCols.map((c) => {
      if (!c.frozen) return c;
      map[c.key] = left;
      left += c.width;
      return { ...c, lastFrozen: c === frozenCols[frozenCols.length - 1] };
    });
    return { frozenLeft: map, cols: out };
  }, [visibleCols, selectable]);

  // text of every column of a row (all registry columns, so hidden columns are still searchable)
  const hayCache = useRef(new WeakMap());
  const hayOf = useCallback((row) => {
    let h = hayCache.current.get(row);
    if (h === undefined) {
      h = columns.filter((c) => c.kind !== "tool").map((c) => cellText(c, row)).join(" ").toLowerCase();
      hayCache.current.set(row, h);
    }
    return h;
  }, [columns]);

  const passFilters = useCallback((row, skipKey) => Object.entries(filters).every(([key, values]) => {
    if (key === skipKey || !colByKey[key]) return true;
    return values.includes(cellText(colByKey[key], row));
  }), [filters, colByKey]);

  const searched = useMemo(() => (search.trim() ? rows.filter((r) => matchesSearch(hayOf(r), search)) : rows), [rows, search, hayOf]);
  const filtered = useMemo(() => searched.filter((r) => passFilters(r)), [searched, passFilters]);

  const colorOf = useCallback((row) => (rowColor ? rowColor(row, prefs.ext) : null), [rowColor, prefs.ext]);
  const sorted = useMemo(
    () => sortRows(filtered, prefs.sorts, colByKey, colorFirst ? (row) => (colorOf(row) === colorFirst ? 0 : 1) : null),
    [filtered, prefs.sorts, colByKey, colorFirst, colorOf],
  );

  const counts = useMemo(() => {
    if (!rowColor) return null;
    const c = { green: 0, yellow: 0, red: 0 };
    filtered.forEach((r) => { const k = colorOf(r); if (k) c[k] += 1; });
    return c;
  }, [filtered, rowColor, colorOf]);

  const pageRows = useMemo(() => sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [sorted, page, rowsPerPage]);

  // header groups over the columns that are actually shown
  const headGroups = useMemo(() => {
    const out = [];
    cols.filter((c) => !c.frozen).forEach((c) => {
      const last = out[out.length - 1];
      if (last && last.key === c.group) last.span += 1; else out.push({ key: c.group, span: 1 });
    });
    return out.map((g) => ({ ...g, ...(groups.find((x) => x.key === g.key) || { label: "", color: "#1552F0" }) }));
  }, [cols, groups]);
  const frozenCount = cols.filter((c) => c.frozen).length;

  const dropdownCols = useMemo(() => visibleCols.filter((c) => c.kind !== "tool"), [visibleCols]);
  const rowsFor = useCallback((key) => searched.filter((r) => passFilters(r, key)), [searched, passFilters]);

  const setSort = useCallback((key, dir) => {
    const rest = prefs.sorts.filter((s) => s.key !== key);
    prefs.setSorts(dir ? [...rest, { key, dir }] : rest);
    setPage(0);
  }, [prefs]);
  const setFilter = useCallback((key, values) => {
    setFilters((prev) => { const next = { ...prev }; if (values) next[key] = values; else delete next[key]; return next; });
    setPage(0);
  }, []);
  const clearAll = () => { setSearch(""); setFilters({}); setColorFirst(null); prefs.setSorts([]); setPage(0); };

  // selection
  const selSet = selected || new Set();
  const selectableRows = useMemo(() => (selectable ? sorted.filter((r) => (isSelectable ? isSelectable(r) : true)) : []), [sorted, selectable, isSelectable]);
  const allChecked = selectableRows.length > 0 && selectableRows.every((r) => selSet.has(rowKey(r)));
  const toggleAll = () => {
    if (!onSelectedChange) return;
    onSelectedChange(allChecked ? new Set() : new Set(selectableRows.map(rowKey)));
  };
  const toggleOne = useCallback((key) => {
    if (!onSelectedChange) return;
    const next = new Set(selSet);
    if (next.has(key)) next.delete(key); else next.add(key);
    onSelectedChange(next);
  }, [onSelectedChange, selSet]);

  const doExport = async (kind) => {
    setExporting(true);
    try {
      if (kind === "xlsx") exportExcel(title || gridKey, visibleCols, sorted);
      else await exportPdf(title || gridKey, visibleCols, sorted);
    } catch (err) {
      console.error(`[DataGrid ${gridKey}] export ${kind} error:`, err);
      window.alert(`ส่งออกไม่สำเร็จ: ${err.message}`);
    } finally { setExporting(false); }
  };

  const activeFilters = Object.keys(filters).length + (search.trim() ? 1 : 0) + (colorFirst ? 1 : 0);

  return (
    <div>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1 }}>
        <TextField
          size="small" placeholder={searchPlaceholder} value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ flex: 1, minWidth: 240 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        {toolbarExtra}
        <Button variant="outlined" startIcon={<ViewColumnIcon />} onClick={() => setChooserOpen(true)}>ตั้งค่าคอลัมน์</Button>
        {!hideExport && (
          <>
            <Button variant="outlined" startIcon={<TableViewIcon />} disabled={exporting || !sorted.length} onClick={() => doExport("xlsx")}>Excel</Button>
            <Button variant="outlined" startIcon={<PictureAsPdfIcon />} disabled={exporting || !sorted.length} onClick={() => doExport("pdf")}>PDF</Button>
          </>
        )}
        {onReload && <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onReload} disabled={loading}>รีเฟรช</Button>}
      </Box>

      {counts && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1 }}>
          <Typography variant="body2" color="text.secondary">เรียงตามสี Delay:</Typography>
          {["red", "yellow", "green"].map((k) => (
            <Tooltip key={k} title={colorFirst === k ? "กดอีกครั้งเพื่อยกเลิกการเรียงตามสี" : `เอาแถวสี${COLOR_LABEL[k]}ขึ้นก่อน`} arrow>
              <Chip
                clickable label={`${COLOR_LABEL[k]} ${counts[k]}`} onClick={() => { setColorFirst(colorFirst === k ? null : k); setPage(0); }}
                sx={{ fontWeight: 700, background: colorFirst === k ? COLOR_FG[k] : ROW_BG[k], color: colorFirst === k ? "#fff" : COLOR_FG[k], border: `1px solid ${COLOR_FG[k]}` }}
              />
            </Tooltip>
          ))}
        </Box>
      )}

      <ColumnFilterBar columns={dropdownCols} sorts={prefs.sorts} filters={filters} rowsFor={rowsFor} onSort={setSort} onFilter={setFilter} />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {activeFilters || sorted.length !== rows.length ? `แสดง ${sorted.length} จาก ${rows.length} แถว` : `${rows.length} แถว`}{caption ? ` · ${caption}` : ""}
        </Typography>
        {(activeFilters > 0 || prefs.sorts.length > 0) && <Button size="small" onClick={clearAll}>ล้างการค้นหา/กรอง/เรียง</Button>}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1 }} action={onReload ? <Button color="inherit" size="small" onClick={onReload}>ลองใหม่</Button> : null}>{error}</Alert>}

      <Paper sx={{ borderRadius: "16px", overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight }}>
          <Table stickyHeader size="small" sx={{ minWidth: 600 }}>
            <TableHead>
              <TableRow>
                {(selectable || frozenCount > 0) && (
                  <TableCell colSpan={frozenCount + (selectable ? 1 : 0)} sx={{ ...HEAD, background: "#0F3FC4", position: "sticky", left: 0, top: 0, zIndex: 6, height: HEAD_H }}>ทำรายการ</TableCell>
                )}
                {headGroups.map((g, i) => (
                  <TableCell key={`${g.key}-${i}`} colSpan={g.span} align="center" sx={{ ...HEAD, background: g.color, top: 0, height: HEAD_H }}>{g.label}</TableCell>
                ))}
              </TableRow>
              <TableRow>
                {selectable && (
                  <TableCell sx={{ ...HEAD, background: "#1552F0", position: "sticky", left: 0, top: HEAD_H, zIndex: 6, p: 0, width: CHECK_W, minWidth: CHECK_W, maxWidth: CHECK_W }}>
                    <Checkbox size="small" checked={allChecked} indeterminate={!allChecked && selectableRows.some((r) => selSet.has(rowKey(r)))} onChange={toggleAll} sx={{ color: "#fff", "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: "#fff" } }} />
                  </TableCell>
                )}
                {cols.map((c) => {
                  const left = frozenLeft[c.key];
                  const sticky = left !== undefined;
                  const s = prefs.sorts.find((x) => x.key === c.key);
                  return (
                    <TableCell
                      key={c.key} align={c.align || "left"}
                      sx={{
                        ...HEAD, background: "#1552F0", top: HEAD_H,
                        ...(sticky ? { position: "sticky", left, zIndex: 6, width: c.width, minWidth: c.width, maxWidth: c.width, borderRight: c.lastFrozen ? "2px solid #D5DCEB" : undefined } : { minWidth: c.width }),
                      }}
                    >
                      {c.label}{s ? (s.dir === "asc" ? " ↑" : " ↓") : ""}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((row) => {
                const key = rowKey(row);
                const color = colorOf(row);
                return (
                  <GridRow
                    key={key} row={row} cols={cols} frozenLeft={frozenLeft} bg={color ? ROW_BG[color] : "#fff"}
                    selectable={selectable} checked={selSet.has(key)} canSelect={isSelectable ? isSelectable(row) : true} onToggle={() => toggleOne(key)} ctx={ctx}
                  />
                );
              })}
              {!pageRows.length && (
                <TableRow><TableCell colSpan={cols.length + (selectable ? 1 : 0)} align="center" sx={{ py: 5, color: "#90A4AE" }}>{loading ? "กำลังโหลด..." : emptyText}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={sorted.length} page={page} rowsPerPage={rowsPerPage} rowsPerPageOptions={[50, 100, 200, 500]}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          labelRowsPerPage="แถวต่อหน้า:" labelDisplayedRows={({ from, to, count }) => `${from}-${to} จาก ${count}`}
        />
      </Paper>

      <ColumnChooser
        open={chooserOpen} onClose={() => setChooserOpen(false)} columns={columns} groups={groups} visible={prefs.visible} onChange={prefs.setVisible} onReset={prefs.reset}
        storage={prefs.storage} warning={prefs.warning}
        extra={colorSettings ? colorSettings(prefs.ext, prefs.setExt) : null}
      />
    </div>
  );
};

export { COLOR_ORDER };
export default DataGrid;
