import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Chip, MenuItem, Paper, Select, Tab, Tabs, TextField, Typography } from "@mui/material";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as ChartTip, XAxis, YAxis } from "recharts";
import DataGrid from "../../Layout/DataGrid/DataGrid";
import { buildRows } from "../../Sheet/Asset/buildRows";
import { prepareSheetRows } from "../../Sheet/Asset/prepareRows";
import { columnsForRole, defaultVisible, GROUPS } from "../../Sheet/Asset/columns";
import { DEFAULT_EXT, rowColorOf } from "../../Sheet/Asset/ColorSettings";
import { fmtMin, GROUP_BY, groupStats, paretoOf, PARETO_MEASURES, totals } from "./reportStats";

const API_URL = import.meta.env.VITE_API_URL;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DBS_LABEL = ["DBS1 เตรียม→ห้องเย็น", "DBS2 อยู่ห้องเย็น", "DBS3 ห้องเย็น→บรรจุ", "DBS4 รวม"];
const NO_TOOLS = { tools: () => [] };
const keyOfStat = (r) => r.key;
const keyOfPareto = (r) => r.key;
const keyOfRow = (r) => r.__key;
const SUMMARY_GROUPS = [{ key: "g", label: "สรุป", color: "#1552F0" }];
const num = (key, label, width, get, text, extra = {}) => ({ key, label, group: "g", kind: "data", type: "number", width, align: "right", get, text, ...extra });

const Card = ({ label, value, sub, color }) => (
  <Paper variant="outlined" sx={{ px: 2, py: 1, minWidth: 150 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography sx={{ fontSize: 22, fontWeight: 700, color: color || "inherit", lineHeight: 1.2 }}>{value}</Typography>
    {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
  </Paper>
);

/** Unified Supervisor report: ONE data set (the Sheet rows, DBS formulas of Sheet/Asset/dbs.js) shown as a table, %Tie (percentile), Pareto or a daily trend. */
const ReportPage = () => {
  const today = useMemo(() => new Date(), []);
  const [source, setSource] = useState("done"); // done = finished rows · open = rows still in process
  const [from, setFrom] = useState(() => ymd(new Date(today.getTime() - 7 * 86400000)));
  const [to, setTo] = useState(() => ymd(today));
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(5000);
  const [dbsIdx, setDbsIdx] = useState(3);
  const [groupBy, setGroupBy] = useState("mat_name");
  const [pct, setPct] = useState(80);
  const [measure, setMeasure] = useState("excess");
  const [view, setView] = useState("tie");
  const [mappings, setMappings] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let res;
      if (source === "done") {
        res = await axios.get(`${API_URL}/api/sheet/done`, { params: { date_from: from, date_to: to, q: q.trim(), limit } });
      } else {
        res = await axios.get(`${API_URL}/api/sheet/rows`, { params: { days: 1, limit: 100, mlimit: limit, open_from: from, open_to: to } });
      }
      if (!res.data?.success) throw new Error(res.data?.error || "ดึงข้อมูลรายงานไม่สำเร็จ");
      setMappings(res.data.mappings || []);
      setInfo({ capped: !!res.data.capped || (res.data.mappings || []).length >= limit, limit, at: new Date() });
    } catch (err) {
      console.error("[Report] fetch error:", err);
      setError(err.response?.data?.error || err.message || "ดึงข้อมูลรายงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [source, from, to, q, limit]);

  const rows = useMemo(() => (mappings ? buildRows([], mappings, {}, [], Date.now()).filter((r) => r.__kind === "map") : []), [mappings]);
  const groupLabel = GROUP_BY.find((g) => g.key === groupBy)?.label || "";
  const stats = useMemo(() => groupStats(rows, groupBy, dbsIdx, pct), [rows, groupBy, dbsIdx, pct]);
  const pareto = useMemo(() => paretoOf(stats, measure), [stats, measure]);
  const tot = useMemo(() => totals(rows, dbsIdx), [rows, dbsIdx]);
  const trend = useMemo(() => groupStats(rows, "day", dbsIdx, pct).filter((s) => s.key !== "(ไม่ระบุ)").sort((a, b) => a.key.localeCompare(b.key))
    .map((s) => ({ day: s.key.slice(5), avg: Math.round(s.avg), pct: Math.round(s.pct), overPct: Math.round(s.overPct), count: s.count })), [rows, dbsIdx, pct]);

  // ── the three summary tables use the same DataGrid as the Sheet ──
  const tieColumns = useMemo(() => [
    { key: "key", label: groupLabel, group: "g", kind: "data", type: "text", frozen: true, width: 240 },
    num("count", "จำนวน", 80, (r) => r.count, (r) => String(r.count)),
    num("avg", "เฉลี่ย", 110, (r) => r.avg, (r) => fmtMin(r.avg)),
    num("pct", `P${pct}`, 110, (r) => r.pct, (r) => fmtMin(r.pct)),
    num("max", "สูงสุด", 110, (r) => r.max, (r) => fmtMin(r.max)),
    num("min", "ต่ำสุด", 110, (r) => r.min, (r) => fmtMin(r.min)),
    num("std", "มาตรฐาน (เฉลี่ย)", 130, (r) => r.std, (r) => fmtMin(r.std)),
    num("overCount", "เกินมาตรฐาน (รายการ)", 150, (r) => r.overCount, (r) => String(r.overCount)),
    num("overPct", "% เกินมาตรฐาน", 130, (r) => r.overPct, (r) => `${r.overPct.toFixed(1)}%`),
    num("excess", "เวลาเกินรวม", 120, (r) => r.excess, (r) => fmtMin(r.excess)),
  ], [groupLabel, pct]);
  const tieColor = useCallback((r) => (r.overPct >= 50 ? "red" : r.overPct >= 20 ? "yellow" : "green"), []);
  const paretoColumns = useMemo(() => [
    num("rank", "ลำดับ", 70, (r) => r.rank, (r) => String(r.rank), { frozen: true }),
    { key: "key", label: groupLabel, group: "g", kind: "data", type: "text", width: 240 },
    num("value", PARETO_MEASURES.find((m) => m.key === measure)?.label || "", 220, (r) => r.value, (r) => String(Math.round(r.value))),
    num("share", "สัดส่วน %", 110, (r) => r.share, (r) => `${r.share.toFixed(1)}%`),
    num("cum", "สะสม %", 110, (r) => r.cum, (r) => `${r.cum.toFixed(1)}%`),
    num("count", "จำนวนรายการ", 120, (r) => r.count, (r) => String(r.count)),
    num("overCount", "เกินมาตรฐาน (รายการ)", 150, (r) => r.overCount, (r) => String(r.overCount)),
  ], [groupLabel, measure]);
  const paretoColor = useCallback((r) => (r.cum - r.share < 80 ? "red" : null), []); // the "vital few": groups inside the first 80%

  const tableGrid = useMemo(() => ({ columns: columnsForRole("sup"), defaultVisible: defaultVisible("sup") }), []);

  const controls = (
    <Paper variant="outlined" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.25, px: 1.5, py: 1, mb: 1, flexShrink: 0 }}>
      <Select size="small" value={source} onChange={(e) => { setSource(e.target.value); setMappings(null); }} sx={{ width: 190 }}>
        <MenuItem value="done">เสร็จสิ้น (บรรจุเสร็จ)</MenuItem>
        <MenuItem value="open">กำลังดำเนินการ</MenuItem>
      </Select>
      <TextField size="small" type="date" label="ตั้งแต่วันที่" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
      <TextField size="small" type="date" label="ถึงวันที่" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
      {source === "done" && (
        <TextField size="small" label="ค้นหา (วัตถุดิบ / Batch / HU / รถเข็น / ไลน์)" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") search(); }} sx={{ width: 300 }} />
      )}
      <Select size="small" value={limit} onChange={(e) => setLimit(Number(e.target.value))} sx={{ width: 140 }}>
        {[1000, 5000, 10000, 20000].map((n) => <MenuItem key={n} value={n}>สูงสุด {n.toLocaleString()} แถว</MenuItem>)}
      </Select>
      <Button variant="contained" onClick={search} disabled={loading || !from || !to}>{loading ? "กำลังดึง..." : "ดึงข้อมูลรายงาน"}</Button>
    </Paper>
  );

  const viewOptions = view !== "table" && (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.25, mb: 1, flexShrink: 0 }}>
      <Select size="small" value={dbsIdx} onChange={(e) => setDbsIdx(Number(e.target.value))} sx={{ width: 210 }}>
        {DBS_LABEL.map((l, i) => <MenuItem key={l} value={i}>{l}</MenuItem>)}
      </Select>
      {view !== "trend" && (
        <Select size="small" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} sx={{ width: 230 }}>
          {GROUP_BY.map((g) => <MenuItem key={g.key} value={g.key}>จัดกลุ่มตาม: {g.label}</MenuItem>)}
        </Select>
      )}
      {view !== "pareto" && (
        <TextField size="small" type="number" label="Percentile (P)" value={pct} onChange={(e) => setPct(Math.min(Math.max(Number(e.target.value) || 0, 1), 100))} sx={{ width: 130 }} inputProps={{ min: 1, max: 100 }} />
      )}
      {view === "pareto" && (
        <Select size="small" value={measure} onChange={(e) => setMeasure(e.target.value)} sx={{ width: 290 }}>
          {PARETO_MEASURES.map((m) => <MenuItem key={m.key} value={m.key}>วัดด้วย: {m.label}</MenuItem>)}
        </Select>
      )}
    </Box>
  );

  const cards = mappings !== null && view !== "table" && (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, mb: 1, flexShrink: 0 }}>
      <Card label={`รายการที่วัด ${DBS_LABEL[dbsIdx].split(" ")[0]}`} value={tot.n.toLocaleString()} sub={`จากทั้งหมด ${rows.length.toLocaleString()} แถว`} />
      <Card label="เวลาเฉลี่ย" value={fmtMin(tot.avg)} />
      <Card label="เกินมาตรฐาน" value={tot.over.toLocaleString()} sub={`${tot.overPct.toFixed(1)}% ของรายการที่วัด`} color={tot.overPct >= 50 ? "#B91C1C" : tot.overPct >= 20 ? "#B45309" : "#047857"} />
      <Card label={`จำนวนกลุ่ม (${groupLabel})`} value={stats.length.toLocaleString()} />
    </Box>
  );

  const gridCommon = { fill: true, groups: SUMMARY_GROUPS, defaultExt: DEFAULT_EXT, ctx: NO_TOOLS, hideReload: true, loading };

  let body = null;
  if (mappings === null) {
    body = <Paper variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>เลือกที่มาของข้อมูลและช่วงวันที่ แล้วกด "ดึงข้อมูลรายงาน"</Paper>;
  } else if (view === "table") {
    body = (
      <DataGrid
        fill gridKey="report-table" title="Report" defaultExt={DEFAULT_EXT} rows={rows} rowKey={keyOfRow} loading={loading} hideReload ctx={NO_TOOLS} groups={GROUPS}
        prepareRows={prepareSheetRows} rowColor={rowColorOf} searchPlaceholder="ค้นหาในผลลัพธ์ ..." {...tableGrid}
      />
    );
  } else if (view === "tie") {
    body = (
      <DataGrid
        {...gridCommon} gridKey="report-tie" title={`%Tie · ${DBS_LABEL[dbsIdx]}`} columns={tieColumns} defaultVisible={tieColumns.map((c) => c.key)}
        rows={stats} rowKey={keyOfStat} rowColor={tieColor} defaultSorts={[{ key: "pct", dir: "desc" }]} searchPlaceholder={`ค้นหา${groupLabel} ...`}
      />
    );
  } else if (view === "pareto") {
    body = (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: 1 }}>
        <Paper variant="outlined" sx={{ height: 340, p: 1, flexShrink: 0 }}>
          {pareto.rows.length === 0 ? (
            <Typography sx={{ p: 3, textAlign: "center" }} color="text.secondary">ไม่มีข้อมูลที่เกินมาตรฐานในช่วงนี้</Typography>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pareto.rows} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="key" interval={0} angle={-30} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <ChartTip formatter={(v, n) => (n === "สะสม %" ? `${Number(v).toFixed(1)}%` : Math.round(v).toLocaleString())} />
                <Legend verticalAlign="top" />
                <ReferenceLine yAxisId="r" y={80} stroke="#C62828" strokeDasharray="4 4" label={{ value: "80%", position: "right", fontSize: 11, fill: "#C62828" }} />
                <Bar yAxisId="l" dataKey="value" name={PARETO_MEASURES.find((m) => m.key === measure)?.label} fill="#1552F0" />
                <Line yAxisId="r" type="monotone" dataKey="cum" name="สะสม %" stroke="#F59E0B" strokeWidth={2} dot />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Paper>
        {pareto.groups > pareto.shown && <Alert severity="info" sx={{ flexShrink: 0 }}>แสดง {pareto.shown} กลุ่มแรกจากทั้งหมด {pareto.groups} กลุ่ม</Alert>}
        <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
          <Box sx={{ position: "absolute", inset: 0 }}>
            <DataGrid {...gridCommon} gridKey="report-pareto" title={`Pareto · ${DBS_LABEL[dbsIdx]}`} columns={paretoColumns} defaultVisible={paretoColumns.map((c) => c.key)}
              rows={pareto.rows} rowKey={keyOfPareto} rowColor={paretoColor} searchPlaceholder={`ค้นหา${groupLabel} ...`} />
          </Box>
        </Box>
      </Box>
    );
  } else {
    body = (
      <Paper variant="outlined" sx={{ height: 380, p: 1 }}>
        {trend.length === 0 ? (
          <Typography sx={{ p: 3, textAlign: "center" }} color="text.secondary">ไม่มีข้อมูลรายวัน</Typography>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 11 }} unit=" น." />
              <YAxis yAxisId="r" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
              <ChartTip />
              <Legend verticalAlign="top" />
              <Line yAxisId="l" type="monotone" dataKey="avg" name="เฉลี่ย (นาที)" stroke="#1552F0" strokeWidth={2} />
              <Line yAxisId="l" type="monotone" dataKey="pct" name={`P${pct} (นาที)`} stroke="#C62828" strokeWidth={2} />
              <Line yAxisId="r" type="monotone" dataKey="overPct" name="% เกินมาตรฐาน" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Paper>
    );
  }

  return (
    <div style={{ backgroundColor: "#fff" }} className="flex-1 min-h-0 flex flex-col overflow-hidden relative z-10">
      <main className="max-w-8xl w-full mx-auto pt-2 pb-1 px-1 lg:px-8 flex-1 min-h-0 flex flex-col">
        {controls}
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        {info?.capped && !loading && <Alert severity="warning" sx={{ mb: 1 }}>ข้อมูลถึงเพดาน {info.limit.toLocaleString()} แถว ตัวเลขอาจไม่ครบ — ลดช่วงวันที่ หรือเพิ่มเพดาน</Alert>}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexShrink: 0 }}>
          <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5 } }}>
            <Tab value="tie" label="%Tie (Percentile)" />
            <Tab value="pareto" label="Pareto" />
            <Tab value="trend" label="แนวโน้มรายวัน" />
            <Tab value="table" label="ตารางรายการ" />
          </Tabs>
          {mappings !== null && <Chip size="small" label={`${rows.length.toLocaleString()} แถว`} />}
        </Box>
        {viewOptions}
        {cards}
        <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: view === "trend" ? "auto" : undefined }}>
          <div style={view === "trend" ? undefined : { position: "absolute", inset: 0 }}>{body}</div>
        </div>
      </main>
    </div>
  );
};

export default ReportPage;
