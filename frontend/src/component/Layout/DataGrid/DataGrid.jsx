import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Chip, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import TableViewIcon from "@mui/icons-material/TableView";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import RefreshIcon from "@mui/icons-material/Refresh";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Fragment } from "react";
import DetailPanel from "./DetailPanel";
import HamsterLoader from "./HamsterLoader";
import { ColumnMenu } from "./ColumnFilterBar";
import ColumnChooser from "./ColumnChooser";
import useGridPrefs from "./useGridPrefs";
import { exportExcel, exportPdf } from "./exportGrid";
import { cellFilterText, cellText, cellValue, matchesSearch, shortTime, sortRows } from "./gridUtils";
import { registerSettings } from "./settingsBus";

// light delay colours with dark text (easy to read); blue = a finished (Done) row
const ROW_BG = { white: "#FFFFFF", green: "#BBF7D0", yellow: "#FEF08A", red: "#FECACA", blue: "#BFDBFE" };
const ROW_FG = { white: "#13213F", green: "#13213F", yellow: "#13213F", red: "#13213F", blue: "#13213F" };
const COLOR_LABEL = { green: "เขียว", yellow: "เหลือง", red: "แดง" };
const COLOR_FG = { green: "#22C55E", yellow: "#FACC15", red: "#EF4444" }; // the round colour buttons
const GRID = "1px solid #334155";
// solid hover colours: a translucent hover colour would let the scrolled cells show through the frozen columns
const HOVER_BG = { white: "#EAF1FF", green: "#86EFAC", yellow: "#FDE047", red: "#FCA5A5", blue: "#93C5FD" };
const CHECK_W = 44;
const EMPTY_SET = new Set();
const HEAD_H = 32;
const HEAD = { color: "#fff", fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap", borderColor: "rgba(255,255,255,.18)", padding: "8px 10px", letterSpacing: ".2px" };
const HEAD_BG = "#1552F0";        // normal column
const HEAD_SORT_BG = "#0F3FC4";   // sorted column
const HEAD_FILTER_BG = "#F26B1D"; // filtered column (orange: easy to notice that rows are hidden)

const DefaultCell = ({ col, row }) => {
  const v = cellValue(col, row);
  const empty = v === null || v === undefined || v === "" || v === "-";
  if (empty) return <span style={{ opacity: 0.45 }}>-</span>;
  if (col.type === "time") return <span style={{ whiteSpace: "nowrap" }}>{shortTime(v)}</span>;
  return <span>{String(v)}</span>;
};

// Body cells are plain <td> (with the MUI class names, so the table-level border / hover rules still apply) and the tick box is a native input:
// a MUI TableCell + Checkbox per cell made every render of a few hundred rows take seconds. Rows are memoised: every prop is a primitive or a stable reference.
const CELL = { fontFamily: "inherit", fontSize: 12.5, lineHeight: 1.43, color: "#13213F", padding: "5px 10px", verticalAlign: "inherit", display: "table-cell" };
const GridRow = memo(({ row, rowId, cols, frozenLeft, bg, fg, hoverBg, selectable, checked, canSelect, onToggle, ctx, active, onPick, onCell }) => (
  <TableRow
    hover onClick={onPick ? () => onPick(row) : undefined}
    sx={{ cursor: onPick ? "pointer" : undefined, "& td": active ? { boxShadow: "inset 0 2px 0 #F26B1D, inset 0 -2px 0 #F26B1D" } : undefined, "&.MuiTableRow-root.MuiTableRow-hover:hover > .MuiTableCell-root": { background: `${hoverBg} !important` } }}>
    {selectable && (
      <td className="MuiTableCell-root MuiTableCell-body" onClick={(e) => e.stopPropagation()}
        style={{ ...CELL, position: "sticky", left: 0, zIndex: 2, background: bg, color: fg, padding: 0, width: CHECK_W, minWidth: CHECK_W, maxWidth: CHECK_W, textAlign: "center" }}>
        <input type="checkbox" checked={checked} disabled={!canSelect} onChange={() => onToggle(rowId)} style={{ width: 16, height: 16, cursor: canSelect ? "pointer" : "default", accentColor: "#F26B1D", verticalAlign: "middle" }} />
      </td>
    )}
    {cols.map((c) => {
      const left = frozenLeft[c.key];
      const sticky = left !== undefined;
      return (
        <td
          key={c.key} className={`MuiTableCell-root MuiTableCell-body${c.lastFrozen ? " frozen-edge" : ""}`}
          onDoubleClick={onCell && c.editable ? () => onCell(row, c) : undefined} title={onCell && c.editable ? "ดับเบิลคลิกเพื่อแก้ไข" : undefined}
          style={{
            ...CELL, background: bg, color: fg, fontWeight: fg === "#FFFFFF" ? 500 : undefined, textAlign: c.align || "left",
            ...(sticky ? { position: "sticky", left, zIndex: 2, width: c.width, minWidth: c.width, maxWidth: c.width, overflow: "hidden", whiteSpace: c.kind === "tool" ? "normal" : "nowrap", textOverflow: "ellipsis" } : { width: c.width, maxWidth: c.width, overflow: "hidden", wordBreak: "break-word" }),
          }}
        >
          {c.render ? c.render(row, ctx) : <DefaultCell col={c} row={row} />}
        </td>
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
 * prepareRows(rows, ext) -> rows      (optional; re-derives row fields from the account's ext settings)
 * rowColor(row, ext) -> 'green' | 'yellow' | 'red' | null      (optional; enables the colour chips + colour sort)
 */
const DataGrid = ({
  gridKey, title, columns, groups, defaultVisible, defaultSorts, defaultExt, rows: rawRows, rowKey, prepareRows,
  loading = false, error = "", onReload, searchPlaceholder = "ค้นหาทุกคอลัมน์...", pageSize = 100,
  rowColor, colorSettings, toolbarExtra, selectable = false, selected, onSelectedChange, isSelectable, ctx,
  hideExport = false, caption, emptyText = "ไม่มีรายการ", maxHeight = "68vh",
  // fill: the grid takes the height of its parent and only the table body scrolls (no page scroll) · activeKey/onRowClick: a clicked row is the "chosen" row · actionBar: shown above the table
  fill = false, activeKey = null, onRowClick, actionBar, hideReload = false, rowSig,
  // detail: ปุ่ม Detail ขวาสุดของแถวค้นหา เปิดกล่องรายละเอียดทางขวาของตาราง (แสดงค่าทั้งหมดของแถวที่เลือก)
  detail = false,
  // statusChips: [{ label, name, color, bg, onBg, onFg }] ของคอลัมน์สถานะ (เรียงตามลำดับกระบวนการ) แสดงเหนือตาราง (โหมด fill); กดแล้วแสดงเฉพาะสถานะนั้น (row.__status.label)
  statusChips,
  // onCellEdit(row, col): double-click on a cell of a column marked `editable` (edit mode of the Supervisor)
  onCellEdit,
}) => {
  const prefs = useGridPrefs(gridKey, { visible: defaultVisible, sorts: defaultSorts, ext: defaultExt });
  // prepareRows(rows, ext): lets a page re-derive row fields from the account's own settings (ext) — it must return the same array when nothing changes
  const rows = useMemo(() => (prepareRows ? prepareRows(rawRows, prefs.ext) : rawRows), [rawRows, prefs.ext, prepareRows]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({}); // { colKey: [values] } — not saved (a saved filter would silently hide new rows)
  const [menuKey, setMenuKey] = useState(null); // column whose sort / filter modal is open (opened by clicking its header)
  const [colorOnly, setColorOnly] = useState(null); // show only the rows of this colour
  // no page buttons: rows are added while the table is scrolled down (setPage(0) = back to the first block after a search / sort / filter)
  const [limit, setLimit] = useState(pageSize);
  const setPage = () => setLimit(pageSize);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(true);
  const narrow = useMediaQuery("(max-width:900px)"); // จอแคบ: กล่องรายละเอียดอยู่ใต้ตาราง
  const [leadStatus, setLeadStatus] = useState(null); // สถานะที่กดในชิป: แถวของสถานะนี้ขึ้นก่อน
  const activeRow = useMemo(() => (detail && activeKey !== null ? rows.find((r) => rowKey(r) === activeKey) || null : null), [detail, rows, activeKey, rowKey]);
  // the column settings are opened from the "Setting" button of the top bar; a page without the top bar keeps its own button
  const [topbar, setTopbar] = useState(false);
  useEffect(() => { setTopbar(!!document.querySelector(".app-topbar")); }, []);
  useEffect(() => (topbar ? registerSettings(() => setChooserOpen(true)) : undefined), [topbar]);
  const [exporting, setExporting] = useState(false);

  const colByKey = useMemo(() => Object.fromEntries(columns.map((c) => [c.key, c])), [columns]);

  // columns frozen on the left: the account's own choice (column settings), or the default of the table
  const pinSet = useMemo(() => new Set(prefs.pins ?? columns.filter((c) => c.frozen).map((c) => c.key)), [prefs.pins, columns]);
  const pinnedKeys = useMemo(() => columns.filter((c) => pinSet.has(c.key)).map((c) => c.key), [columns, pinSet]);

  // visible columns: frozen ones first, then the rest — both in the order the account chose (column settings "ลำดับคอลัมน์")
  const visibleCols = useMemo(() => {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const list = [...new Set(prefs.visible)].filter((k) => byKey.has(k)).map((k) => ({ ...byKey.get(k), frozen: pinSet.has(k) }));
    return [...list.filter((c) => c.frozen), ...list.filter((c) => !c.frozen)];
  }, [columns, prefs.visible, pinSet]);

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
    return values.includes(cellFilterText(colByKey[key], row));
  }), [filters, colByKey]);

  const dSearch = useDeferredValue(search); // typing stays instant, the table follows a moment later
  const searched = useMemo(() => (dSearch.trim() ? rows.filter((r) => matchesSearch(hayOf(r), dSearch)) : rows), [rows, dSearch, hayOf]);
  const filtered = useMemo(() => searched.filter((r) => passFilters(r)), [searched, passFilters]);

  const colorOf = useCallback((row) => (rowColor ? rowColor(row, prefs.ext) : null), [rowColor, prefs.ext]);

  const counts = useMemo(() => {
    if (!rowColor) return null;
    const c = { green: 0, yellow: 0, red: 0 };
    filtered.forEach((r) => { const k = colorOf(r); if (k && k in c) c[k] += 1; });
    return c;
  }, [filtered, rowColor, colorOf]);

  // a status chip that is pressed shows only the rows of that status
  const shownRows = useMemo(() => filtered.filter((r) => (!colorOnly || colorOf(r) === colorOnly) && (!leadStatus || r.__status?.label === leadStatus)), [filtered, colorOnly, colorOf, leadStatus]);
  const sorted = useMemo(() => sortRows(shownRows, prefs.sorts, colByKey, null), [shownRows, prefs.sorts, colByKey]);

  const pageRows = useMemo(() => sorted.slice(0, limit), [sorted, limit]);
  const onTableScroll = (e) => {
    const el = e.currentTarget;
    if (limit < sorted.length && el.scrollTop + el.clientHeight >= el.scrollHeight - 900) setLimit((l) => l + Math.max(50, Math.round(pageSize / 2)));
  };

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
  const tableWidth = useMemo(() => (selectable ? CHECK_W : 0) + cols.reduce((sum, c) => sum + (c.width || 110), 0), [cols, selectable]);

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
  const clearAll = () => { setSearch(""); setFilters({}); setColorOnly(null); setLeadStatus(null); prefs.setSorts([]); setPage(0); };
  // กดชิปสถานะ: แสดงเฉพาะแถวของสถานะนั้น (กดอีกครั้ง = แสดงทุกสถานะ)
  // ลำดับชิปมาจากหน้าที่ส่งมา (หน้า Sheet ใช้ค่ากลางลำดับสถานะของทุกบัญชี)
  const chipsOrdered = statusChips || null;
  const pickStatus = (label) => {
    setLeadStatus((cur) => (cur === label ? null : label));
    setPage(0);
  };

  // selection
  const selSet = selected || EMPTY_SET;
  const selRef = useRef(selSet);
  selRef.current = selSet;
  const pickRef = useRef(onRowClick);
  pickRef.current = onRowClick;
  const cellRef = useRef(onCellEdit);
  cellRef.current = onCellEdit;
  const stableCell = useMemo(() => (onCellEdit ? (r, c) => cellRef.current?.(r, c) : undefined), [!!onCellEdit]); // eslint-disable-line react-hooks/exhaustive-deps
  const stablePick = useMemo(() => (onRowClick ? (r) => pickRef.current?.(r) : undefined), [!!onRowClick]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleOne = useCallback((key) => {
    if (!onSelectedChange) return;
    const next = new Set(selRef.current);
    if (next.has(key)) next.delete(key); else next.add(key);
    onSelectedChange(next);
  }, [onSelectedChange]);

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

  const activeFilters = Object.keys(filters).length + (search.trim() ? 1 : 0) + (colorOnly ? 1 : 0);

  // three round colour buttons like the window buttons of macOS (no number); a click shows just that colour, a second click shows all
  const colorChips = counts && (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", px: 0.75, ...(fill ? {} : { mb: 1, flexShrink: 0, width: "100%" }) }}>
      {["red", "yellow", "green"].map((k) => {
        const on = colorOnly === k;
        return (
          <Tooltip key={k} title={on ? "กดอีกครั้งเพื่อดูทุกสี" : `แสดงเฉพาะแถวสี${COLOR_LABEL[k]}`} arrow>
            <Box
              component="button" type="button" aria-label={`แถวสี${COLOR_LABEL[k]}`} aria-pressed={on}
              onClick={() => { setColorOnly(on ? null : k); setPage(0); }}
              sx={{
                width: 28, height: 28, p: 0, borderRadius: "50%", cursor: "pointer", flexShrink: 0, touchAction: "manipulation",
                background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.55), transparent 55%), ${COLOR_FG[k]}`,
                border: "1px solid rgba(0,0,0,.18)",
                boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${COLOR_FG[k]}` : "inset 0 -1px 1px rgba(0,0,0,.15)",
                opacity: colorOnly && !on ? 0.35 : 1,
                transition: "box-shadow .15s, opacity .15s, transform .1s",
                "&:hover": { transform: "scale(1.12)" },
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );

  return (
    <div style={fill ? { height: "100%", minHeight: 0, display: "flex", flexDirection: "column" } : undefined}>
      {/* fill: แถวเดียวเสมอ (เลื่อนแนวนอนได้เมื่อจอแคบ) เพื่อให้ปุ่ม Detail อยู่แถวเดียวกับช่องค้นหา */}
      <Box sx={{ display: "flex", flexWrap: fill ? "nowrap" : "wrap", overflowX: fill ? "auto" : undefined, gap: 1, alignItems: "center", mb: 1, flexShrink: 0, pb: fill ? 0.5 : 0,
        ...(fill ? {
          gap: 0.5,
          "& > :not(.MuiTextField-root)": { flexShrink: 0 },
          "& .MuiButton-root": { whiteSpace: "nowrap", minWidth: 0, px: 1, py: 0.5, fontSize: 13, lineHeight: 1.4 },
          "& .MuiButton-startIcon": { mr: 0.5, ml: 0 },
          "& .MuiChip-root": { height: 28 },
        } : {}) }}>
        {onReload && fill && (
          <Tooltip title="รีเฟรชข้อมูล" arrow>
            <span>
              <Button variant="outlined" aria-label="รีเฟรช" onClick={onReload} disabled={loading} sx={{ minWidth: 0, width: 40, height: 40, p: 0, borderRadius: "12px !important" }}>
                <RefreshIcon sx={{ fontSize: 22, animation: loading ? "dgspin 1s linear infinite" : "none", "@keyframes dgspin": { to: { transform: "rotate(360deg)" } } }} />
              </Button>
            </span>
          </Tooltip>
        )}
        <TextField
          size="small" placeholder={searchPlaceholder} value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ flex: 1, minWidth: fill ? 200 : 240 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        {fill && colorChips}
        {toolbarExtra}
        {!topbar && <Button variant="outlined" startIcon={<ViewColumnIcon />} onClick={() => setChooserOpen(true)}>ตั้งค่าคอลัมน์</Button>}
        {!hideExport && (
          <>
            <Button variant="outlined" startIcon={<TableViewIcon />} disabled={exporting || !sorted.length} onClick={() => doExport("xlsx")}>Excel</Button>
            <Button variant="outlined" startIcon={<PictureAsPdfIcon />} disabled={exporting || !sorted.length} onClick={() => doExport("pdf")}>PDF</Button>
          </>
        )}
        {onReload && !hideReload && !fill && <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onReload} disabled={loading}>รีเฟรช</Button>}
        {detail && <Button variant={detailOpen ? "contained" : "outlined"} color={detailOpen ? "secondary" : "primary"} startIcon={<InfoOutlinedIcon />} onClick={() => setDetailOpen((v) => !v)} sx={{ flexShrink: 0, whiteSpace: "nowrap", ml: "auto" }}>Detail</Button>}
      </Box>

      {fill && chipsOrdered && (
        // statuses in process order, with an arrow from each step to the next; a press shows only that status (a second press shows all)
        <Box sx={{ display: "flex", flexWrap: "nowrap", overflowX: "auto", alignItems: "center", gap: 0.25, mb: 1, px: 1, py: 0.75, flexShrink: 0,
          background: "#fff", border: "1px solid #E1E9FA", borderRadius: "14px", boxShadow: "0 1px 2px rgba(19,33,63,.04)" }}>
          {chipsOrdered.map((c, i) => {
            const on = leadStatus === c.label;
            const onBg = c.onBg || c.color;
            const onFg = c.onFg || c.bg; // default: the two colours swap, so the text never disappears into the button
            return (
              <Fragment key={c.label}>
                {i > 0 && <ChevronRightIcon sx={{ fontSize: 18, color: "#A3B3CF", flexShrink: 0 }} />}
                <Chip
                  size="small" clickable onClick={() => pickStatus(c.label)} label={c.name || c.label}
                  sx={{
                    flexShrink: 0, height: 30, fontWeight: 700, fontSize: 12.5, background: on ? onBg : c.bg, color: on ? onFg : c.color,
                    border: `1px solid ${on ? onBg : `${c.color}55`}`, boxShadow: on ? `0 3px 10px ${onBg}55` : "none",
                    "&::before": { content: '""', width: 8, height: 8, borderRadius: "50%", background: on ? onFg : c.color, ml: 1.25, mr: -0.5, flexShrink: 0 },
                    "&:hover": { background: on ? onBg : c.bg, filter: "brightness(.96)" },
                  }}
                />
              </Fragment>
            );
          })}
        </Box>
      )}

      {/* table and the right box in one row: both start and end at the same height */}
      <Box sx={{ display: "flex", flexDirection: detail && narrow ? "column" : "row", gap: 1, alignItems: "stretch", ...(fill ? { flex: 1, minHeight: 0 } : {}) }}>
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", ...(fill ? { minHeight: 0 } : {}) }}>
      {/* detail: เครื่องมือของแถว/ผสม อยู่ในแท็บ "เครื่องมือ" ของกล่องขวาแทน */}
      {!detail && actionBar}

      {!fill && colorChips}

      {!fill && <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexShrink: 0 }}>
        {!fill && <Typography variant="caption" color="text.secondary">
          {activeFilters || sorted.length !== rows.length ? `แสดง ${sorted.length} จาก ${rows.length} แถว` : `${rows.length} แถว`}{caption ? ` · ${caption}` : ""}
        </Typography>}
        {(activeFilters > 0 || prefs.sorts.length > 0) && <Button size="small" onClick={clearAll}>ล้างการค้นหา/กรอง/เรียง</Button>}
      </Box>}

      {error && <Alert severity="error" sx={{ mb: 1 }} action={onReload ? <Button color="inherit" size="small" onClick={onReload}>ลองใหม่</Button> : null}>{error}</Alert>}

      <Paper sx={{ position: "relative", borderRadius: "16px", overflow: "hidden", ...(fill ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : {}) }}>
        {/* โหลดครั้งแรก / รีเฟรช: ยังไม่มีข้อมูลสักแถว -> แสดงหน้าโหลดทับพื้นที่ตาราง (โหลดซ้ำตอนมีข้อมูลแล้วไม่บังตาราง) */}
        {loading && !rows.length && (
          <Box sx={{ position: "absolute", inset: 0, zIndex: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.9)", minHeight: 260 }}>
            <HamsterLoader />
          </Box>
        )}
        <TableContainer onScroll={onTableScroll} sx={fill ? { flex: 1, minHeight: 0 } : { maxHeight }}>
          <Table
            stickyHeader size="small"
            sx={{
              // fixed layout: the browser does not measure the content of thousands of cells at every change (this was the slowest part of every click)
              tableLayout: "fixed", width: tableWidth, minWidth: 600, borderCollapse: "separate", borderSpacing: 0,
              // black grid lines (separate borders keep the lines on the frozen columns while scrolling)
              "& .MuiTableCell-root": { borderRight: GRID, borderBottom: GRID },
              "& thead tr:first-of-type .MuiTableCell-root": { borderTop: GRID },
              "& .MuiTableCell-root:first-of-type": { borderLeft: GRID },
              "& .MuiTableCell-root.frozen-edge": { borderRight: "2px solid #0F172A" },
            }}
          >
            <colgroup>
              {selectable && <col style={{ width: CHECK_W }} />}
              {cols.map((c) => <col key={c.key} style={{ width: c.width }} />)}
            </colgroup>
            <TableHead>
              <TableRow>
                {(selectable || frozenCount > 0) && (
                  <TableCell colSpan={frozenCount + (selectable ? 1 : 0)} sx={{ ...HEAD, background: HEAD_SORT_BG, position: "sticky", left: 0, top: 0, zIndex: 6, height: HEAD_H }}>ทำรายการ</TableCell>
                )}
                {headGroups.map((g, i) => (
                  <TableCell key={`${g.key}-${i}`} colSpan={g.span} align="center" sx={{ ...HEAD, background: g.color, top: 0, height: HEAD_H }}>{g.label}</TableCell>
                ))}
              </TableRow>
              <TableRow>
                {selectable && (
                  <TableCell sx={{ ...HEAD, background: HEAD_BG, position: "sticky", left: 0, top: HEAD_H, zIndex: 6, p: 0, width: CHECK_W, minWidth: CHECK_W, maxWidth: CHECK_W }}>
                    {/* ไม่มีช่อง "เลือกทุกแถว": ต้องติ๊กทีละแถว กันเลือกเกินโดยไม่ตั้งใจ */}
                  </TableCell>
                )}
                {cols.map((c) => {
                  const left = frozenLeft[c.key];
                  const sticky = left !== undefined;
                  const s = prefs.sorts.find((x) => x.key === c.key);
                  return (
                    <TableCell
                      key={c.key} align={c.align || "left"} className={c.lastFrozen ? "frozen-edge" : undefined}
                      onClick={c.kind !== "tool" ? () => setMenuKey(c.key) : undefined}
                      title={c.kind !== "tool" ? "คลิกเพื่อเรียงลำดับ / ค้นหา / กรองคอลัมน์นี้" : undefined}
                      sx={{
                        ...HEAD, background: filters[c.key] ? HEAD_FILTER_BG : s ? HEAD_SORT_BG : HEAD_BG, top: HEAD_H, cursor: c.kind !== "tool" ? "pointer" : undefined,
                        "&:hover": c.kind !== "tool" ? { filter: "brightness(1.15)" } : undefined,
                        ...(sticky ? { position: "sticky", left, zIndex: 6, width: c.width, minWidth: c.width, maxWidth: c.width } : { minWidth: c.width }),
                      }}
                    >
                      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                        {c.label}
                        {c.kind !== "tool" && (s ? (s.dir === "asc" ? <ArrowUpwardIcon sx={{ fontSize: 15 }} /> : <ArrowDownwardIcon sx={{ fontSize: 15 }} />) : <UnfoldMoreIcon sx={{ fontSize: 15, opacity: 0.7 }} />)}
                        {filters[c.key] && <FilterAltIcon sx={{ fontSize: 15 }} />}
                      </Box>
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
                    key={key} rowId={key} row={row} cols={cols} frozenLeft={frozenLeft} bg={ROW_BG[color || "white"]} fg={ROW_FG[color || "white"]} hoverBg={HOVER_BG[color || "white"]}
                    selectable={selectable} checked={selSet.has(key)} canSelect={isSelectable ? isSelectable(row) : true} onToggle={toggleOne} ctx={ctx} sig={rowSig ? rowSig(row) : undefined}
                    active={activeKey !== null && activeKey === key} onPick={stablePick} onCell={stableCell}
                  />
                );
              })}
              {!pageRows.length && (
                <TableRow><TableCell colSpan={cols.length + (selectable ? 1 : 0)} align="center" sx={{ py: 5, color: "#90A4AE", ...(loading && !rows.length ? { height: 280 } : {}) }}>{loading ? "" : emptyText}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      </Box>

      {detail && detailOpen && (
        <DetailPanel row={activeRow} columns={columns} tools={actionBar} narrow={narrow} fill={fill} maxHeight={maxHeight} />
      )}
      </Box>

      {menuKey && colByKey[menuKey] && (
        <ColumnMenu
          col={colByKey[menuKey]} rows={rowsFor(menuKey)} sort={prefs.sorts.find((x) => x.key === menuKey)?.dir || null} selected={filters[menuKey] || null}
          onSort={(dir) => setSort(menuKey, dir)} onFilter={(values) => setFilter(menuKey, values)} onClose={() => setMenuKey(null)}
        />
      )}

      <ColumnChooser
        open={chooserOpen} onClose={() => setChooserOpen(false)} columns={columns} groups={groups} visible={prefs.visible} onChange={prefs.setVisible} onReset={prefs.reset}
        storage={prefs.storage} warning={prefs.warning} pins={pinnedKeys} onPinsChange={prefs.setPins}
        extra={colorSettings ? colorSettings(prefs.ext, prefs.setExt) : null}
      />
    </div>
  );
};

export default DataGrid;
