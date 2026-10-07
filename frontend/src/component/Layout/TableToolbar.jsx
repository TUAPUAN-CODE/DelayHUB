import { useState, useMemo } from "react";
import { Box, TextField, InputAdornment, Button, Popover, IconButton, Typography, Chip } from "@mui/material";
import { Search, ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";

const KEY_LABELS = {
  tro_id: "รถเข็น", trolley_number: "รถเข็น", mat: "รหัสวัตถุดิบ", mat_name: "ชื่อวัตถุดิบ", batch: "Batch",
  production: "แผนผลิต", rm_status: "สถานะ", weight_RM: "น้ำหนัก", tray_count: "จำนวนถาด", cs_name: "ห้อง",
  slot_id: "ช่อง", line_name: "ไลน์", dest: "ปลายทาง", cooked_date: "วันที่สุก", rmit_date: "วันที่เข้า",
  qc_date: "วันที่ QC", mixed_date: "วันที่ผสม", remaining_time: "เวลาคงเหลือ", standard_time: "เวลามาตรฐาน",
};
const prettify = (k) => KEY_LABELS[k] || k.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");

const TableToolbar = ({ tools, resultCount }) => {
  const { search, setSearch, sorts, toggleSort, clearSorts, columns, total } = tools;
  const [anchor, setAnchor] = useState(null);
  const [colQuery, setColQuery] = useState("");

  const shown = useMemo(() => {
    const q = colQuery.trim().toLowerCase();
    return columns.filter((k) => !q || k.toLowerCase().includes(q) || prettify(k).toLowerCase().includes(q));
  }, [columns, colQuery]);

  const dirOf = (k) => sorts.find((s) => s.key === k)?.dir;
  const orderOf = (k) => sorts.findIndex((s) => s.key === k) + 1;

  return (
    <Box className="table-toolbar" sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1 }}>
      <TextField
        size="small"
        placeholder="ค้นหาทุกคอลัมน์ในตาราง..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ flex: 1, minWidth: 240 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment>,
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearch("")}><X size={16} /></IconButton>
            </InputAdornment>
          ) : null,
        }}
      />
      <Button variant="outlined" startIcon={<ArrowUpDown size={16} />} onClick={(e) => setAnchor(e.currentTarget)}>
        เรียงลำดับ{sorts.length ? ` (${sorts.length})` : ""}
      </Button>
      <Typography variant="body2" color="text.secondary">
        {search ? `พบ ${resultCount} จาก ${total} รายการ` : `${total} รายการ`}
      </Typography>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}>
        <Box sx={{ p: 1.5, width: 340 }}>
          <TextField
            size="small" fullWidth autoFocus placeholder="ค้นหาคอลัมน์..." value={colQuery}
            onChange={(e) => setColQuery(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
          />
          <Box sx={{ maxHeight: 320, overflowY: "auto", mt: 1 }}>
            {shown.map((k) => (
              <Box key={k} sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.5 }}>
                <Typography variant="body2" sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }} title={k}>{prettify(k)}</Typography>
                {dirOf(k) && <Chip size="small" label={orderOf(k)} color="primary" />}
                <IconButton size="small" color={dirOf(k) === "asc" ? "primary" : "default"} onClick={() => toggleSort(k, "asc")} aria-label="asc"><ArrowUp size={16} /></IconButton>
                <IconButton size="small" color={dirOf(k) === "desc" ? "primary" : "default"} onClick={() => toggleSort(k, "desc")} aria-label="desc"><ArrowDown size={16} /></IconButton>
              </Box>
            ))}
            {!shown.length && <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>ไม่พบคอลัมน์</Typography>}
          </Box>
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
            <Button size="small" disabled={!sorts.length} onClick={clearSorts}>ล้างการเรียง</Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
};

export default TableToolbar;
