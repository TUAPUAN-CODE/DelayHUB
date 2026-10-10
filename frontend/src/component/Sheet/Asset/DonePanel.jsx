import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, MenuItem, Paper, Select, TextField } from "@mui/material";
import DataGrid from "../../Layout/DataGrid/DataGrid";
import { buildRows } from "./buildRows";
import { DEFAULT_EXT, rowColorOf } from "./ColorSettings";

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

  const search = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API_URL}/api/sheet/done`, { params: { date_from: from, date_to: to, q: q.trim(), limit } });
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

  const rows = useMemo(() => (mappings ? buildRows([], mappings, {}, [], Date.now()) : []), [mappings]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.25, px: 1.5, py: 1, mb: 1, flexShrink: 0 }}>
        <TextField size="small" type="date" label="ตั้งแต่วันที่" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <TextField size="small" type="date" label="ถึงวันที่" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <TextField
          size="small" label="ค้นหา (วัตถุดิบ / Batch / HU / รถเข็น / ไลน์ / รหัสผลิต)" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") search(); }} sx={{ width: 330 }}
        />
        <Select size="small" value={limit} onChange={(e) => setLimit(Number(e.target.value))} sx={{ width: 130 }}>
          {[500, 2000, 5000, 10000].map((n) => <MenuItem key={n} value={n}>สูงสุด {n.toLocaleString()} แถว</MenuItem>)}
        </Select>
        <Button variant="contained" onClick={search} disabled={loading || !from || !to}>{loading ? "กำลังดึง..." : "ดึงข้อมูล Done"}</Button>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {info?.capped && !loading && (
        <Alert severity="warning" sx={{ mb: 1 }}>ข้อมูลถึงเพดาน {info.limit.toLocaleString()} แถว อาจยังมีแถวที่ไม่ได้แสดง — ลดช่วงวันที่หรือใส่คำค้นให้แคบลง หรือเพิ่มจำนวนสูงสุด</Alert>
      )}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          {mappings === null ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
              ยังไม่ได้ดึงข้อมูล — เลือกช่วงวันที่ (และคำค้นถ้าต้องการ) แล้วกด "ดึงข้อมูล Done"
            </Paper>
          ) : (
            <DataGrid
              fill gridKey={gridKey} title="Done" defaultExt={DEFAULT_EXT} rows={rows} rowKey={noKey} loading={loading} hideReload ctx={NO_TOOLS}
              searchPlaceholder="ค้นหาในผลลัพธ์ที่ดึงมา ..." rowColor={rowColorOf} {...gridProps}
            />
          )}
        </div>
      </div>
    </Box>
  );
};

export default DonePanel;
