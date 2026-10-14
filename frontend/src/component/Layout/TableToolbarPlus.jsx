import { useState } from "react";
import { Box, Button, Chip, IconButton, InputAdornment, Popover, TextField, Typography } from "@mui/material";
import { ArrowDown, ArrowUp, ChevronRight, FileSpreadsheet, FileText, Search, SlidersHorizontal, X } from "lucide-react";
import { ColumnMenu } from "./DataGrid/ColumnFilterBar";
import { exportExcel, exportPdf } from "./DataGrid/exportGrid";

/**
 * Standard toolbar of every table: search, "เรียง/กรอง" (one dropdown per column: sort + search + value filter) and Excel / PDF export.
 * Same look as the toolbar of the Master Delay Sheet.
 */
const TableToolbarPlus = ({ tools, resultCount, title }) => {
  const { search, setSearch, sorts, setSort, filters, setFilter, clearAll, columns, result, rowsFor, total } = tools;
  const [anchor, setAnchor] = useState(null);
  const [colQuery, setColQuery] = useState("");
  const [menu, setMenu] = useState(null); // { key, anchor }
  const [busy, setBusy] = useState(false);

  const shown = columns.filter((c) => !colQuery.trim() || c.label.toLowerCase().includes(colQuery.trim().toLowerCase()) || c.key.toLowerCase().includes(colQuery.trim().toLowerCase()));
  const active = sorts.length + Object.keys(filters).length;
  const menuCol = menu ? columns.find((c) => c.key === menu.key) : null;

  const doExport = async (kind) => {
    setBusy(true);
    try {
      if (kind === "xlsx") exportExcel(title, columns, result);
      else await exportPdf(title, columns, result);
    } catch (err) {
      console.error(`[TableToolbarPlus] export ${kind} error:`, err);
      window.alert(`ส่งออกไม่สำเร็จ: ${err.message}`);
    } finally { setBusy(false); }
  };

  return (
    <Box className="table-toolbar" sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1 }}>
      <TextField
        size="small" placeholder="ค้นหาทุกคอลัมน์ในตาราง..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 240 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment>,
          endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch("")}><X size={16} /></IconButton></InputAdornment> : null,
        }}
      />
      <Button variant="outlined" startIcon={<SlidersHorizontal size={16} />} onClick={(e) => setAnchor(e.currentTarget)}>
        เรียง / กรอง{active ? ` (${active})` : ""}
      </Button>
      <Button variant="outlined" startIcon={<FileSpreadsheet size={16} />} disabled={busy || !result.length} onClick={() => doExport("xlsx")}>Excel</Button>
      <Button variant="outlined" startIcon={<FileText size={16} />} disabled={busy || !result.length} onClick={() => doExport("pdf")}>PDF</Button>
      {active > 0 && <Button size="small" onClick={clearAll}>ล้างเรียง/กรอง</Button>}
      <Typography variant="body2" color="text.secondary">{resultCount !== total ? `พบ ${resultCount} จาก ${total} รายการ` : `${total} รายการ`}</Typography>

      <Popover open={!!anchor} anchorEl={anchor} onClose={() => { setAnchor(null); setMenu(null); }} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}>
        <Box sx={{ p: 1.5, width: 340 }}>
          <TextField
            size="small" fullWidth autoFocus placeholder="ค้นหาคอลัมน์..." value={colQuery} onChange={(e) => setColQuery(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
          />
          <Box sx={{ maxHeight: 340, overflowY: "auto", mt: 1 }}>
            {shown.map((c) => {
              const s = sorts.find((x) => x.key === c.key);
              const f = !!filters[c.key];
              return (
                <Box key={c.key} onClick={(e) => setMenu({ key: c.key, anchor: e.currentTarget })} sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.5, px: 0.5, cursor: "pointer", borderRadius: 1, "&:hover": { background: "#F1F5FF" } }}>
                  <Typography variant="body2" sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }} title={c.key}>{c.label}</Typography>
                  {s && <Chip size="small" color="primary" icon={s.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />} label={sorts.indexOf(s) + 1} />}
                  {f && <Chip size="small" color="secondary" label="กรอง" />}
                  <ChevronRight size={16} />
                </Box>
              );
            })}
            {!shown.length && <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>ไม่พบคอลัมน์</Typography>}
          </Box>
        </Box>
      </Popover>
      {menuCol && (
        <ColumnMenu
          col={menuCol} anchor={menu.anchor} rows={rowsFor(menuCol.key)} sort={sorts.find((x) => x.key === menuCol.key)?.dir || null} selected={filters[menuCol.key] || null}
          onSort={(dir) => setSort(menuCol.key, dir)} onFilter={(values) => setFilter(menuCol.key, values)} onClose={() => setMenu(null)}
        />
      )}
    </Box>
  );
};

export default TableToolbarPlus;
