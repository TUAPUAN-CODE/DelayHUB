import { useMemo, useState } from "react";
import { Box, Button, Checkbox, Divider, InputAdornment, Popover, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { cellText } from "./gridUtils";

const MAX_OPTIONS = 300;

/** The dropdown of ONE column: sort, search inside the column, and tick the values to show (like an Excel filter). */
const ColumnMenu = ({ col, rows, sort, selected, onSort, onFilter, onClose, anchor }) => {
  const [q, setQ] = useState("");

  // distinct values of this column among the rows that pass the OTHER filters
  const options = useMemo(() => {
    const counts = new Map();
    rows.forEach((r) => { const t = cellText(col, r); counts.set(t, (counts.get(t) || 0) + 1); });
    return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, ["th", "en"], { numeric: true }));
  }, [rows, col]);

  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => options.filter((o) => !needle || (o.value || "(ว่าง)").toLowerCase().includes(needle)), [options, needle]);
  const visible = shown.slice(0, MAX_OPTIONS);
  const chosen = selected ? new Set(selected) : null;
  const isOn = (v) => (chosen ? chosen.has(v) : true);

  const toggle = (v) => {
    const base = chosen ? new Set(chosen) : new Set(options.map((o) => o.value));
    if (base.has(v)) base.delete(v); else base.add(v);
    onFilter(base.size === options.length ? null : [...base]);
  };
  const setMany = (values, on) => {
    const base = chosen ? new Set(chosen) : new Set(options.map((o) => o.value));
    values.forEach((v) => (on ? base.add(v) : base.delete(v)));
    onFilter(base.size === options.length ? null : [...base]);
  };

  const numeric = col.type === "time" || col.type === "number" || col.type === "dbs" || col.align === "right";

  return (
    <Popover open onClose={onClose} anchorEl={anchor} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}>
      <Box sx={{ width: 300, p: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>{col.label}</Typography>
        <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
          <Button size="small" fullWidth variant={sort === "asc" ? "contained" : "outlined"} startIcon={<ArrowUpwardIcon fontSize="small" />} onClick={() => onSort(sort === "asc" ? null : "asc")}>
            {numeric ? "น้อย → มาก" : "A → Z"}
          </Button>
          <Button size="small" fullWidth variant={sort === "desc" ? "contained" : "outlined"} startIcon={<ArrowDownwardIcon fontSize="small" />} onClick={() => onSort(sort === "desc" ? null : "desc")}>
            {numeric ? "มาก → น้อย" : "Z → A"}
          </Button>
        </Box>
        <Divider sx={{ mb: 1 }} />
        <TextField
          size="small" fullWidth autoFocus placeholder="ค้นหาในคอลัมน์นี้..." value={q} onChange={(e) => setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <Box sx={{ display: "flex", alignItems: "center", mt: 0.5 }}>
          <Checkbox size="small" checked={shown.length > 0 && shown.every((o) => isOn(o.value))} indeterminate={shown.some((o) => isOn(o.value)) && !shown.every((o) => isOn(o.value))}
            onChange={(e) => setMany(shown.map((o) => o.value), e.target.checked)} />
          <Typography variant="body2">{needle ? "เลือกทั้งหมดที่ค้นเจอ" : "(เลือกทั้งหมด)"}</Typography>
        </Box>
        <Box sx={{ maxHeight: 240, overflowY: "auto" }}>
          {visible.map((o) => (
            <Box key={o.value || "__empty"} sx={{ display: "flex", alignItems: "center" }}>
              <Checkbox size="small" checked={isOn(o.value)} onChange={() => toggle(o.value)} />
              <Typography variant="body2" sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={o.value || "(ว่าง)"}>{o.value || "(ว่าง)"}</Typography>
              <Typography variant="caption" color="text.secondary">{o.count}</Typography>
            </Box>
          ))}
          {shown.length > MAX_OPTIONS && <Typography variant="caption" color="text.secondary" sx={{ display: "block", py: 0.5 }}>แสดง {MAX_OPTIONS} จาก {shown.length} ค่า — พิมพ์ค้นหาเพื่อกรองให้แคบลง</Typography>}
          {!shown.length && <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>ไม่พบค่า</Typography>}
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
          <Button size="small" disabled={!selected} onClick={() => onFilter(null)}>ล้างตัวกรอง</Button>
          <Button size="small" variant="contained" onClick={onClose}>ตกลง</Button>
        </Box>
      </Box>
    </Popover>
  );
};

/**
 * One dropdown button above the table for every visible column (the number of buttons = the number of data columns shown).
 * `rowsFor(key)` returns the rows that pass every OTHER column filter, so the value list follows the filters like in Excel.
 */
const ColumnFilterBar = ({ columns, sorts, filters, rowsFor, onSort, onFilter }) => {
  const [open, setOpen] = useState(null); // { key, anchor }
  const col = open ? columns.find((c) => c.key === open.key) : null;

  return (
    <Box className="column-filter-bar" sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 0.75, mb: 0.5 }}>
      {columns.map((c) => {
        const s = sorts.find((x) => x.key === c.key);
        const filtered = !!filters[c.key];
        return (
          <Button
            key={c.key} size="small" variant={s || filtered ? "contained" : "outlined"} color={filtered ? "secondary" : "primary"}
            endIcon={<ArrowDropDownIcon />}
            onClick={(e) => setOpen({ key: c.key, anchor: e.currentTarget })}
            sx={{ flexShrink: 0, whiteSpace: "nowrap", textTransform: "none", py: 0, fontSize: 12.5 }}
          >
            {c.label}{s ? (s.dir === "asc" ? " ↑" : " ↓") : ""}
          </Button>
        );
      })}
      {col && (
        <ColumnMenu
          col={col} anchor={open.anchor} rows={rowsFor(col.key)} sort={sorts.find((x) => x.key === col.key)?.dir || null} selected={filters[col.key] || null}
          onSort={(dir) => onSort(col.key, dir)} onFilter={(values) => onFilter(col.key, values)} onClose={() => setOpen(null)}
        />
      )}
    </Box>
  );
};

export default ColumnFilterBar;
