import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Alert, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { ArrowDownRight, ArrowUpRight, History, Minus, Table2, ChartArea } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip as ChartTip, XAxis, YAxis } from "recharts";
import { CARD, FONT, TOKENS, SectionTitle, SegmentSwitch } from "./StockTheme";

const API_URL = import.meta.env.VITE_API_URL;

// three series on one axis (trolleys). Colours checked with the dataviz validator (CVD / contrast pass on white).
// key = the value drawn (trolleys or items, chosen on the card); trolleys / items = the two counts of the API
const IN = { key: "in_v", trolleys: "in_trolleys", items: "in_items", label: "เข้าห้องเย็นใหญ่", color: TOKENS.primary, grad: "ssGradIn" };
const OUT = { key: "out_v", trolleys: "out_trolleys", items: "out_items", label: "เคลียร์ออก", color: "#0D9488", grad: "ssGradOut" };
const LATE = { key: "late_v", trolleys: "late_trolleys", items: "late_items", label: "Delay (ออกเกินเวลา)", color: "#DC2626", grad: "ssGradLate" };
const SERIES = [IN, OUT, LATE];

const RANGES = [
  { value: 7, label: "7 วัน" },
  { value: 14, label: "14 วัน" },
  { value: 30, label: "30 วัน" },
];

const toDate = (day) => new Date(`${day}T00:00:00`);
const tickLabel = (days) => (day) => {
  const d = toDate(day);
  return days <= 7
    ? d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "numeric" })
    : d.toLocaleDateString("th-TH", { day: "numeric", month: "numeric" });
};
const fullLabel = (day) => toDate(day).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" });

const signedNum = (n) => (n > 0 ? `+${n}` : String(n));

const UNITS = [
  { value: "trolleys", label: "คัน" },
  { value: "items", label: "รายการ" },
];
const VIEWS = [
  { value: "chart", label: <ChartArea size={16} /> },
  { value: "table", label: <Table2 size={16} /> },
];

const HistoryTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-sm shadow-lg" style={{ ...FONT, border: `1px solid ${TOKENS.border}`, minWidth: 220 }}>
      <div className="mb-1.5 font-semibold" style={{ color: TOKENS.text }}>{fullLabel(row.day)}</div>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center gap-2 py-0.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
          <span style={{ color: TOKENS.muted }}>{s.label}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums" style={{ color: TOKENS.text }}>{row[s.trolleys]} คัน</span>
          <span className="text-xs tabular-nums" style={{ color: TOKENS.muted }}>{`(${row[s.items]} รายการ)`}</span>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-2 border-t pt-1" style={{ borderColor: TOKENS.border }}>
        <span style={{ color: TOKENS.muted }}>สุทธิ (เข้า − ออก)</span>
        <span className="ml-auto pl-3 font-semibold tabular-nums" style={{ color: TOKENS.text }}>{`${signedNum(row.in_trolleys - row.out_trolleys)} คัน`}</span>
        <span className="text-xs tabular-nums" style={{ color: TOKENS.muted }}>{`(${signedNum(row.in_items - row.out_items)} รายการ)`}</span>
      </div>
    </div>
  );
};

// legend above the plot: a line for the areas, a square for the bars; names in the text colour
const LegendRow = () => (
  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm" style={{ color: TOKENS.text }}>
    {SERIES.map((s) => (
      <span key={s.key} className="flex items-center gap-2">
        {s === LATE
          ? <span className="h-3 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
          : <span className="h-[3px] w-5 rounded-full" style={{ backgroundColor: s.color }} />}
        {s.label}
      </span>
    ))}
  </div>
);

const Delta = ({ now, before }) => {
  if (now == null || before == null) return null;
  const diff = now - before;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const signed = signedNum(diff);
  return (
    <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: TOKENS.muted }}>
      <Icon size={13} />
      {`${signed} จากเมื่อวาน`}
    </span>
  );
};

const TodayStat = ({ label, value, color, before, note, unit = "คัน" }) => (
  <div className="min-w-0 rounded-xl px-3 py-2.5" style={{ backgroundColor: "#F7F9FE", border: `1px solid ${TOKENS.border}` }}>
    <div className="flex items-center gap-2 text-sm" style={{ color: TOKENS.muted }}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
      <span className="text-2xl font-bold tabular-nums" style={{ color: TOKENS.text }}>{value ?? "-"}</span>
      <span className="text-sm" style={{ color: TOKENS.muted }}>{unit}</span>
      <Delta now={value} before={before} />
    </div>
    {note && <div className="truncate text-xs" style={{ color: TOKENS.muted }}>{note}</div>}
  </div>
);

// totals of the range under the chart
const RangeSummary = ({ rows, unit, days }) => {
  const k = unit === "items" ? "items" : "trolleys";
  const u = unit === "items" ? "รายการ" : "คัน";
  const sumIn = rows.reduce((a, r) => a + (r[`in_${k}`] || 0), 0);
  const sumOut = rows.reduce((a, r) => a + (r[`out_${k}`] || 0), 0);
  const sumLate = rows.reduce((a, r) => a + (r[`late_${k}`] || 0), 0);
  const peak = rows.reduce((a, r) => (!a || (r[`in_${k}`] || 0) > (a[`in_${k}`] || 0) ? r : a), null);
  const net = sumIn - sumOut;
  const items = [
    { label: `รวมเข้า ${days} วัน`, value: `${sumIn} ${u}` },
    { label: `รวมเคลียร์ ${days} วัน`, value: `${sumOut} ${u}` },
    { label: "สุทธิ (เข้า − ออก)", value: `${signedNum(net)} ${u}`, note: net > 0 ? "ของในห้องเพิ่มขึ้น" : net < 0 ? "ของในห้องลดลง" : "เท่าเดิม" },
    { label: "เฉลี่ยเข้าต่อวัน", value: `${rows.length ? Math.round((sumIn / rows.length) * 10) / 10 : 0} ${u}` },
    { label: "เข้ามากสุด", value: peak ? `${peak[`in_${k}`] || 0} ${u}` : "-", note: peak ? fullLabel(peak.day) : "" },
    { label: "ออกเกินเวลา", value: `${sumLate} ${u}`, note: sumOut ? `${Math.round((sumLate / sumOut) * 1000) / 10}% ของที่เคลียร์` : "" },
  ];
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 rounded-lg px-2.5 py-1.5" style={{ border: `1px dashed ${TOKENS.border}` }}>
          <div className="truncate text-[11px]" style={{ color: TOKENS.muted }}>{it.label}</div>
          <div className="text-sm font-semibold tabular-nums" style={{ color: TOKENS.text }}>{it.value}</div>
          {it.note && <div className="truncate text-[11px]" style={{ color: TOKENS.muted }}>{it.note}</div>}
        </div>
      ))}
    </div>
  );
};

// the same days as a table (newest first)
const DayTable = ({ rows }) => {
  const head = { ...FONT, whiteSpace: "nowrap", py: 0.75 };
  const cell = { ...FONT, py: 0.5, whiteSpace: "nowrap" };
  const num = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const both = (t, i) => `${t} คัน (${i})`;
  return (
    <TableContainer sx={{ maxHeight: 320, borderRadius: "12px", border: `1px solid ${TOKENS.border}` }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {["วันที่", "เข้าห้องเย็นใหญ่", "เคลียร์ออก", "สุทธิ (เข้า − ออก)", "Delay (ออกเกินเวลา)"].map((h, i) => (
              <TableCell key={h} sx={{ ...head, textAlign: i ? "right" : "left" }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {[...rows].reverse().map((r) => (
            <TableRow key={r.day} hover>
              <TableCell sx={cell}>{fullLabel(r.day)}</TableCell>
              <TableCell sx={num}>{both(r.in_trolleys, r.in_items)}</TableCell>
              <TableCell sx={num}>{both(r.out_trolleys, r.out_items)}</TableCell>
              <TableCell sx={num}>{both(signedNum(r.in_trolleys - r.out_trolleys), signedNum(r.in_items - r.out_items))}</TableCell>
              <TableCell sx={{ ...num, color: r.late_trolleys ? LATE.color : TOKENS.text, fontWeight: r.late_trolleys ? 600 : 400 }}>{both(r.late_trolleys, r.late_items)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

/**
 * Trolleys that came into / were cleared from the large cold rooms per day, and the cleared ones that were late
 * (GET /api/coldstorages/stock/fetchHistory). overdueNow = trolleys in a room over their limit right now (from the page).
 * reloadKey: changes when the page reloads its data. className: placement in the page grid.
 * onData(rows, days): the loaded days, for the other charts of the page (same range).
 */
const StockHistory = ({ overdueNow, reloadKey, className = "", onData }) => {
  const [days, setDays] = useState(7);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return; // heavy query: no second request while one runs
    busy.current = true;
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${API_URL}/api/coldstorages/stock/fetchHistory`, { params: { days } });
      const rows = res.data?.data ?? [];
      setData(rows);
      onData?.(rows, days);
    } catch (err) {
      console.error("StockHistory fetch error:", err);
      setError("โหลดประวัติห้องเย็นใหญ่ไม่สำเร็จ");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const [unit, setUnit] = useState("trolleys");
  const [view, setView] = useState("chart");
  const k = unit === "items" ? "items" : "trolleys";
  const uLabel = unit === "items" ? "รายการ" : "คัน";
  const chartData = data.map((r) => ({ ...r, in_v: r[`in_${k}`], out_v: r[`out_${k}`], late_v: r[`late_${k}`] }));
  const today = chartData[chartData.length - 1];
  const yesterday = chartData[chartData.length - 2];
  const dense = days > 14;

  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      <SectionTitle icon={History} title="ประวัติเข้า-ออกห้องเย็นใหญ่" subtitle={unit === "items" ? "รายวัน · นับเป็นรายการวัตถุดิบ" : "รายวัน · นับเป็นคัน"}>
        <SegmentSwitch value={days} options={RANGES} onChange={setDays} />
      </SectionTitle>

      {error && <Alert severity="error" sx={FONT}>{error}</Alert>}

      <div className="flex flex-1 flex-col px-4 py-4" style={CARD}>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <TodayStat label="เข้าวันนี้" value={today?.in_v} before={yesterday?.in_v} color={IN.color} unit={uLabel} />
          <TodayStat label="เคลียร์วันนี้" value={today?.out_v} before={yesterday?.out_v} color={OUT.color} unit={uLabel} />
          <TodayStat label="Delay วันนี้" value={today?.late_v} before={yesterday?.late_v} color={LATE.color} note="ออกจากห้องเกินเวลา" unit={uLabel} />
          <TodayStat label="ค้างเกินเวลาอยู่ตอนนี้" value={overdueNow} color={LATE.color} note="ยังอยู่ในห้องและเลยกำหนด" />
        </div>

        <div className="mt-4 mb-1 flex flex-wrap items-center justify-between gap-2">
          <LegendRow />
          <div className="flex items-center gap-2">
            <SegmentSwitch value={unit} options={UNITS} onChange={setUnit} />
            <SegmentSwitch value={view} options={VIEWS} onChange={setView} />
          </div>
        </div>

        <div className="relative min-h-[280px] flex-1">
          {view === "table" ? (
            <DayTable rows={data} />
          ) : loading && data.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center"><CircularProgress size={28} /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={280}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: -14, bottom: 0 }} barCategoryGap={dense ? "30%" : "40%"}>
                <defs>
                  <linearGradient id={IN.grad} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={IN.color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={IN.color} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id={OUT.grad} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={OUT.color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={OUT.color} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id={LATE.grad} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={LATE.color} stopOpacity={1} />
                    <stop offset="100%" stopColor={LATE.color} stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#EEF2F7" />
                <XAxis
                  dataKey="day"
                  tickFormatter={tickLabel(days)}
                  tickLine={false}
                  axisLine={{ stroke: TOKENS.border }}
                  tick={{ fill: TOKENS.muted, fontSize: 12, fontFamily: FONT.fontFamily }}
                  interval={dense ? 3 : days > 7 ? 1 : 0}
                  tickMargin={8}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} tick={{ fill: TOKENS.muted, fontSize: 12, fontFamily: FONT.fontFamily }} />
                <ChartTip content={<HistoryTip />} cursor={{ fill: "rgba(21,82,240,.05)" }} />
                <Bar dataKey={LATE.key} name={LATE.label} fill={`url(#${LATE.grad})`} radius={[4, 4, 0, 0]} maxBarSize={dense ? 8 : 14} />
                <Area
                  type="monotone" dataKey={OUT.key} name={OUT.label} stroke={OUT.color} strokeWidth={2.5} fill={`url(#${OUT.grad})`}
                  dot={dense ? false : { r: 3, fill: "#fff", stroke: OUT.color, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: OUT.color, stroke: "#fff", strokeWidth: 2 }}
                />
                <Area
                  type="monotone" dataKey={IN.key} name={IN.label} stroke={IN.color} strokeWidth={2.5} fill={`url(#${IN.grad})`}
                  dot={dense ? false : { r: 3, fill: "#fff", stroke: IN.color, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: IN.color, stroke: "#fff", strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        <RangeSummary rows={data} unit={unit} days={days} />
        <div className="mt-2 text-xs" style={{ color: TOKENS.muted }}>
          Delay = รถเข็นที่ออกจากห้องเย็นใหญ่ในวันนั้นแล้วเวลาเย็นคงเหลือติดลบ (ห้องที่ไม่คำนวณ DCS ไม่นับ) · นับตามวันปฏิทิน
        </div>
      </div>
    </section>
  );
};

export { tickLabel, fullLabel };
export default StockHistory;
