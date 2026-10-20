import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, MenuItem, Paper, Select, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import DataGrid from "../../Layout/DataGrid/DataGrid";
import { buildRows } from "./buildRows";
import { DEFAULT_EXT } from "./ColorSettings";
import HamsterLoader from "../../Layout/DataGrid/HamsterLoader";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import GridOnIcon from "@mui/icons-material/GridOn";
import DoneExportDialog from "./DoneExportDialog";
import { SHIFT_COLUMN, shiftOf } from "./shift";

const API_URL = import.meta.env.VITE_API_URL;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const NO_TOOLS = { tools: () => [] };
const noKey = (r) => r.__key;

/**
 * Done table: finished rows (บรรจุเสร็จ / สำเร็จ) are not part of the work table. Pick the date range (and a text) first, press the button, and only those rows are read from the database.
 * `gridProps` = the column / settings props of the work table, so both tables use the same columns and the same account settings.
 */
const DonePanel = ({ gridKey, gridProps }) => {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() => ymd(new Date(today.getTime() - 7 * 86400000)));
  const [to, setTo] = useState(() => ymd(today));
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(2000);
  const [mappings, setMappings] = useState(null); // null = nothing searched yet
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeKey, setActiveKey] = useState(null);
  const [exportKind, setExportKind] = useState(null); // "pdf" | "excel"
  const [shift, setShift] = useState("all"); // all | DS | NS — by the time packing was done (shift.jsx)

  const search = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // a text search ignores the dates (the server looks in all finished rows); without text the dates apply
      const params = { q: q.trim(), limit };
      if (from && to) { params.date_from = from; params.date_to = to; }
      const res = await axios.get(`${API_URL}/api/sheet/done`, { params });
      if (!res.data?.success) throw new Error(res.data?.error || "ดึงข้อมูล Done ไม่สำเร็จ");
      setMappings(res.data.mappings || []);
      setInfo({ capped: !!res.data.capped, limit: res.data.limit, from: res.data.date_from, to: res.data.date_to });
    } catch (err) {
      console.error("[Sheet] Done search error:", err);
      setError(err.response?.data?.error || err.message || "ดึงข้อมูล Done ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [from, to, q, limit]);

  // a Supervisor edit (ParentComponent) asks for the same search again, once the table has been searched
  const searchRef = useRef(search);
  searchRef.current = search;
  const searchedRef = useRef(false);
  searchedRef.current = mappings !== null;
  useEffect(() => {
    const again = () => { if (searchedRef.current) searchRef.current(); };
    window.addEventListener("sheet-edited", again);
    return () => window.removeEventListener("sheet-edited", again);
  }, []);

  // the shift picked above the table: the table and the exports both show only that shift
  const shiftCount = useMemo(() => {
    const n = { DS: 0, NS: 0 };
    (mappings || []).forEach((m) => { const s = shiftOf(m.sc_pack_date); if (s) n[s] += 1; });
    return n;
  }, [mappings]);
  const shown = useMemo(() => (mappings && shift !== "all" ? mappings.filter((m) => shiftOf(m.sc_pack_date) === shift) : mappings), [mappings, shift]);
  const rows = useMemo(() => (shown ? buildRows([], shown, {}, [], Date.now()) : []), [shown]);
  // the column "กะ" is only in this table: it is added once to the saved columns of every account (and can be sorted / filtered like any column)
  const columns = useMemo(() => [...(gridProps.columns || []), SHIFT_COLUMN], [gridProps.columns]);
  const ensureVisible = useMemo(() => [...(gridProps.ensureVisible || []), { key: "shift", after: "mapping_id" }], [gridProps.ensureVisible]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.25, px: 1.5, py: 1, mb: 1, flexShrink: 0 }}>
        <TextField size="small" type="date" label="ตั้งแต่วันที่" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <TextField size="small" type="date" label="ถึงวันที่" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <TextField
          size="small" label="ค้นหาข้อมูลทั้งหมด" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") search(); }} sx={{ width: 330 }}
        />
        <Select size="small" value={limit} onChange={(e) => setLimit(Number(e.target.value))} sx={{ width: 130 }}>
          {[500, 2000, 5000, 10000].map((n) => <MenuItem key={n} value={n}>สูงสุด {n.toLocaleString()} แถว</MenuItem>)}
        </Select>
        <Button variant="contained" onClick={search} disabled={loading || (!!from && !!to && from > to)}>{loading ? "กำลังดึง..." : "ดึงข้อมูล Done"}</Button>
        <ToggleButtonGroup size="small" exclusive value={shift} onChange={(_, v) => { if (v) setShift(v); }} sx={{ "& .MuiToggleButton-root": { textTransform: "none", px: 1.5, fontWeight: 700 } }}>
          <ToggleButton value="all">ทุกกะ{mappings ? ` (${mappings.length})` : ""}</ToggleButton>
          <ToggleButton value="DS" title="บรรจุเสร็จ 06:00–17:30">DS{mappings ? ` (${shiftCount.DS})` : ""}</ToggleButton>
          <ToggleButton value="NS" title="บรรจุเสร็จ 17:30–06:00">NS{mappings ? ` (${shiftCount.NS})` : ""}</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" color="error" startIcon={<PictureAsPdfIcon />} disabled={!shown?.length || loading} onClick={() => setExportKind("pdf")}>Export PDF รายงาน Delay</Button>
        <Button variant="outlined" color="success" startIcon={<GridOnIcon />} disabled={!shown?.length || loading} onClick={() => setExportKind("excel")}>Export Excel (F3PFPV04)</Button>
      </Paper>
      <DoneExportDialog open={!!exportKind} kind={exportKind} rows={shown || []} onClose={() => setExportKind(null)} />
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {info?.capped && !loading && (
        <Alert severity="warning" sx={{ mb: 1 }}>ข้อมูลถึงเพดาน {info.limit.toLocaleString()} แถว อาจยังมีแถวที่ไม่ได้แสดง — ลดช่วงวันที่หรือใส่คำค้นให้แคบลง หรือเพิ่มจำนวนสูงสุด</Alert>
      )}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          {loading && !mappings?.length ? (
            <Paper variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, borderRadius: "16px" }}>
              <HamsterLoader />
              <span style={{ color: "#5B6B8C", fontWeight: 600 }}>กำลังดึงข้อมูลดำเนินการเสร็จสิ้น...</span>
            </Paper>
          ) : mappings === null ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
              ยังไม่ได้ดึงข้อมูล — พิมพ์คำค้น (ค้นทุกคอลัมน์ ทุกวันที่) หรือเลือกช่วงวันที่ แล้วกด "ดึงข้อมูล Done"
            </Paper>
          ) : (
            <DataGrid
              fill detail gridKey={gridKey} title="Done" defaultExt={DEFAULT_EXT} rows={rows} rowKey={noKey} loading={loading} hideReload ctx={NO_TOOLS}
              activeKey={activeKey} onRowClick={(r) => setActiveKey((k) => (k === r.__key ? null : r.__key))}
              searchPlaceholder="ค้นหาในผลลัพธ์ที่ดึงมา ... (คลิกแถวแล้วกด Detail → ผสมจาก เพื่อดูว่าผสมมาจากอะไร)" {...gridProps}
              columns={columns} ensureVisible={ensureVisible}
            />
          )}
        </div>
      </div>
    </Box>
  );
};

export default DonePanel;
