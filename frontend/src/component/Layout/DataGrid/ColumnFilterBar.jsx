import { useMemo, useState } from "react";
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Divider, InputAdornment, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { cellFilterText } from "./gridUtils";

const MAX_OPTIONS = 150;
const collator = new Intl.Collator(["th", "en"], { numeric: true });

/** The dropdown of ONE column: sort, search inside the column, and tick the values to show (like an Excel filter). */
export const ColumnMenu = ({ col, rows, sort, selected, onSort, onFilter, onClose, anchor }) => {
  const [q, setQ] = useState("");

  // distinct values of this column among the rows that pass the OTHER filters
  const options = useMemo(() => {
    const counts = new Map();
    const first = new Map();
    rows.forEach((r) => { const t = cellFilterText(col, r); counts.set(t, (counts.get(t) || 0) + 1); if (!first.has(t)) first.set(t, r); });
    const list = [...counts.entries()].map(([value, count]) => ({ value, count, meta: col.optionMeta ? col.optionMeta(first.get(value)) : null }));
    // a column with `optionMeta(row)` -> { rank, zone } (the status) lists its values in the order of its zones instead of A-Z
    return list.sort((a, b) => (a.meta && b.meta && a.meta.rank !== b.meta.rank ? a.meta.rank - b.meta.rank : collator.compare(a.value, b.value)));
  }, [rows, col]);

  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => options.filter((o) => !needle || (o.value || "(ว่าง)").toLowerCase().includes(needle)), [options, needle]);
  // a value can be listed in several areas (meta.zones): it then appears under each of them, in the order of the areas. The checkbox is the same value everywhere.
  const entries = useMemo(() => {
    const list = [];
    shown.forEach((o) => {
      const zones = o.meta ? (o.meta.zones || [o.meta.zone]) : [undefined];
      zones.forEach((zone) => list.push({ ...o, meta: o.meta && { ...o.meta, zone }, zoneKey: zone ? zone.id : "__none" }));
    });
    if (options.some((o) => o.meta?.zones && o.meta.zones.length > 1)) list.sort((a, b) => ((a.meta?.zone?.order ?? 9999) - (b.meta?.zone?.order ?? 9999)) || (a.meta.rank - b.meta.rank));
    return list;
  }, [shown, options]);
  const visible = entries.slice(0, MAX_OPTIONS);
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
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700, pb: 1 }}>{col.label}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
          <Button size="small" fullWidth variant={sort === "asc" ? "contained" : "outlined"} startIcon={<ArrowUpwardIcon fontSize="small" />} onClick={() => onSort(sort === "asc" ? null : "asc")}>
            {col.sortLabels ? col.sortLabels[0] : numeric ? "น้อย → มาก" : "A → Z"}
          </Button>
          <Button size="small" fullWidth variant={sort === "desc" ? "contained" : "outlined"} startIcon={<ArrowDownwardIcon fontSize="small" />} onClick={() => onSort(sort === "desc" ? null : "desc")}>
            {col.sortLabels ? col.sortLabels[1] : numeric ? "มาก → น้อย" : "Z → A"}
          </Button>
        </Box>
        <Divider sx={{ mb: 1.5 }} />
        <TextField
          size="small" fullWidth autoFocus placeholder="ค้นหาในคอลัมน์นี้..." value={q} onChange={(e) => setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <Box sx={{ display: "flex", alignItems: "center", mt: 0.5 }}>
          <Checkbox size="small" checked={shown.length > 0 && shown.every((o) => isOn(o.value))} indeterminate={shown.some((o) => isOn(o.value)) && !shown.every((o) => isOn(o.value))}
            onChange={(e) => setMany(shown.map((o) => o.value), e.target.checked)} />
          <Typography variant="body2">{needle ? "เลือกทั้งหมดที่ค้นเจอ" : "(เลือกทั้งหมด)"}</Typography>
        </Box>
        <Box sx={{ maxHeight: 340, overflowY: "auto" }}>
          {visible.map((o, i) => {
            const zone = o.meta ? o.meta.zone : undefined;
            const prevZone = i > 0 ? visible[i - 1].meta?.zone : undefined;
            const newZone = o.meta && (i === 0 || zone !== prevZone);
            return (
              <div key={`${o.zoneKey}|${o.value || "__empty"}`}>
                {newZone && (() => {
                  // click the area / group header = tick (or untick) every value of it at once
                  const values = options.filter((x) => x.meta && (x.meta.zones || [x.meta.zone]).includes(zone)).map((x) => x.value);
                  const allOn = values.length > 0 && values.every(isOn);
                  const someOn = values.some(isOn);
                  // nothing filtered yet: the click shows ONLY this area; otherwise it adds / removes the area to what is shown
                  const pick = () => { if (!chosen) onFilter(values.length === options.length ? null : values); else setMany(values, !allOn); };
                  return (
                    <div
                      role="button" tabIndex={0} title="กดเพื่อเลือกทั้งกลุ่ม (ถ้ายังไม่กรอง = แสดงเฉพาะกลุ่มนี้ · ถ้ากรองอยู่ = เพิ่ม/เอากลุ่มนี้ออก)" onClick={pick}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } }}
                      style={{ margin: "8px 0 2px", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 8, background: zone ? zone.bg : "#F1F3F8", color: zone ? zone.color : "#6B7489" }}
                    >
                      <span style={{ width: 14, height: 14, borderRadius: 3, border: "2px solid currentColor", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, lineHeight: 1, flexShrink: 0 }}>{allOn ? "✓" : someOn ? "–" : ""}</span>
                      <span style={{ flex: 1 }}>{zone ? zone.title : "อื่นๆ"}</span>
                      <span style={{ fontWeight: 400, opacity: 0.85 }}>{values.length}</span>
                    </div>
                  );
                })()}
                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 11px", cursor: "pointer", fontSize: 14 }}>
                  <input type="checkbox" checked={isOn(o.value)} onChange={() => toggle(o.value)} style={{ width: 16, height: 16, accentColor: zone ? zone.dot : "#1552F0", flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={o.value || "(ว่าง)"}>{o.value || "(ว่าง)"}</span>
                  <span style={{ fontSize: 12, color: "#6B7489" }}>{o.count}</span>
                </label>
              </div>
            );
          })}
          {entries.length > MAX_OPTIONS && <Typography variant="caption" color="text.secondary" sx={{ display: "block", py: 0.5 }}>แสดง {MAX_OPTIONS} จาก {entries.length} ค่า — พิมพ์ค้นหาเพื่อกรองให้แคบลง</Typography>}
          {!shown.length && <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>ไม่พบค่า</Typography>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: "space-between" }}>
        <Button size="small" disabled={!selected} onClick={() => onFilter(null)}>ล้างตัวกรอง</Button>
        <Button size="small" variant="contained" onClick={onClose}>ตกลง</Button>
      </DialogActions>
    </Dialog>
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
