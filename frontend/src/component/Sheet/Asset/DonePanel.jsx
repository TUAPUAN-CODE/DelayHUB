import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, MenuItem, Paper, Select, TextField } from "@mui/material";
import DataGrid from "../../Layout/DataGrid/DataGrid";
import { buildRows } from "./buildRows";
import { DEFAULT_EXT } from "./ColorSettings";
import HamsterLoader from "../../Layout/DataGrid/HamsterLoader";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import GridOnIcon from "@mui/icons-material/GridOn";
import DoneExportDialog from "./DoneExportDialog";

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
  const [shown, setShown] = useState(null); // rows the grid shows now (after its search / column filters)

  const search = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // a text search ignores the dates (the server looks in all finished rows); without text the dates apply
      const params = { q: q.trim(), limit };
      if (from && to) { params.date_from = from; params.date_to = to; }
      const res = await axios.get(`${API_URL}/api/sheet/done`, { params });
      if (!res.data?.success) throw new Error(res.data?.error || "ดึงข้อมูล Done ไม่สำเร็จ");
      setShown(null);
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

  const rows = useMemo(() => (mappings ? buildRows([], mappings, {}, [], Date.now()) : []), [mappings]);

  // Export takes the rows the user narrowed the grid down to; its Date is filled from them:
  // every row packed on one day -> that day, else the fetched range when it is one day, else today
  const exportRows = useMemo(() => {
    if (!mappings) return [];
    if (!shown) return mappings;
    const ids = new Set(shown.map((r) => r.mapping_id).filter((v) => v !== null && v !== undefined));
    return mappings.filter((m) => ids.has(m.mapping_id));
  }, [mappings, shown]);
  const exportDate = useMemo(() => {
    const days = new Set(exportRows.map((r) => String(r.sc_pack_date || "").slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)));
    if (days.size === 1) return [...days][0];
    if (info?.from && info.from === info.to) return info.from;
    return "";
  }, [exportRows, info]);

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
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" color="error" startIcon={<PictureAsPdfIcon />} disabled={!exportRows.length || loading} onClick={() => setExportKind("pdf")}>Export PDF รายงาน Delay</Button>
        <Button variant="outlined" color="success" startIcon={<GridOnIcon />} disabled={!exportRows.length || loading} onClick={() => setExportKind("excel")}>Export Excel (F3PFPV04)</Button>
      </Paper>
      <DoneExportDialog open={!!exportKind} kind={exportKind} rows={exportRows} defaultDate={exportDate} onClose={() => setExportKind(null)} />
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
              searchPlaceholder="ค้นหาในผลลัพธ์ที่ดึงมา ... (คลิกแถวแล้วกด Detail → ผสมจาก เพื่อดูว่าผสมมาจากอะไร)" {...gridProps} onShownRowsChange={setShown}
            />
          )}
        </div>
      </div>
    </Box>
  );
};

export default DonePanel;
