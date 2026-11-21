import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Alert, CircularProgress } from "@mui/material";
import { ArrowDownRight, ArrowUpRight, History, Minus } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip as ChartTip, XAxis, YAxis } from "recharts";
import { CARD, FONT, TOKENS, SectionTitle, SegmentSwitch } from "./StockTheme";

const API_URL = import.meta.env.VITE_API_URL;

// three series on one axis (trolleys). Colours checked with the dataviz validator (CVD / contrast pass on white).
const IN = { key: "in_trolleys", items: "in_items", label: "เข้าห้องเย็นใหญ่", color: TOKENS.primary, grad: "ssGradIn" };
const OUT = { key: "out_trolleys", items: "out_items", label: "เคลียร์ออก", color: "#0D9488", grad: "ssGradOut" };
const LATE = { key: "late_trolleys", items: "late_items", label: "Delay (ออกเกินเวลา)", color: "#DC2626", grad: "ssGradLate" };
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
          <span className="ml-auto pl-3 font-semibold tabular-nums" style={{ color: TOKENS.text }}>{row[s.key]} คัน</span>
          <span className="text-xs tabular-nums" style={{ color: TOKENS.muted }}>{`(${row[s.items]} รายการ)`}</span>
        </div>
      ))}
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
  const signed = diff > 0 ? `+${diff}` : String(diff);
  return (
    <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: TOKENS.muted }}>
      <Icon size={13} />
      {`${signed} จากเมื่อวาน`}
    </span>
  );
};

const TodayStat = ({ label, value, color, before, note }) => (
  <div className="min-w-0 rounded-xl px-3 py-2.5" style={{ backgroundColor: "#F7F9FE", border: `1px solid ${TOKENS.border}` }}>
    <div className="flex items-center gap-2 text-sm" style={{ color: TOKENS.muted }}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
      <span className="text-2xl font-bold tabular-nums" style={{ color: TOKENS.text }}>{value ?? "-"}</span>
      <span className="text-sm" style={{ color: TOKENS.muted }}>คัน</span>
      <Delta now={value} before={before} />
    </div>
    {note && <div className="truncate text-xs" style={{ color: TOKENS.muted }}>{note}</div>}
  </div>
);

/**
 * Trolleys that came into / were cleared from the large cold rooms per day, and the cleared ones that were late
 * (GET /api/coldstorages/stock/fetchHistory). overdueNow = trolleys in a room over their limit right now (from the page).
 * reloadKey: changes when the page reloads its data. className: placement in the page grid.
 */
const StockHistory = ({ overdueNow, reloadKey, className = "" }) => {
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
      setData(res.data?.data ?? []);
    } catch (err) {
      console.error("StockHistory fetch error:", err);
      setError("โหลดประวัติห้องเย็นใหญ่ไม่สำเร็จ");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const today = data[data.length - 1];
  const yesterday = data[data.length - 2];
  const dense = days > 14;

  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      <SectionTitle icon={History} title="ประวัติเข้า-ออกห้องเย็นใหญ่" subtitle="รายวัน · นับเป็นคัน">
        <SegmentSwitch value={days} options={RANGES} onChange={setDays} />
      </SectionTitle>

      {error && <Alert severity="error" sx={FONT}>{error}</Alert>}

      <div className="flex flex-1 flex-col px-4 py-4" style={CARD}>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <TodayStat label="เข้าวันนี้" value={today?.in_trolleys} before={yesterday?.in_trolleys} color={IN.color} />
          <TodayStat label="เคลียร์วันนี้" value={today?.out_trolleys} before={yesterday?.out_trolleys} color={OUT.color} />
          <TodayStat label="Delay วันนี้" value={today?.late_trolleys} before={yesterday?.late_trolleys} color={LATE.color} note="ออกจากห้องเกินเวลา" />
          <TodayStat label="ค้างเกินเวลาอยู่ตอนนี้" value={overdueNow} color={LATE.color} note="ยังอยู่ในห้องและเลยกำหนด" />
        </div>

        <div className="mt-4 mb-1">
          <LegendRow />
        </div>

        <div className="relative min-h-[280px] flex-1">
          {loading && data.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center"><CircularProgress size={28} /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={280}>
              <ComposedChart data={data} margin={{ top: 10, right: 8, left: -14, bottom: 0 }} barCategoryGap={dense ? "30%" : "40%"}>
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
        <div className="mt-2 text-xs" style={{ color: TOKENS.muted }}>
          Delay = รถเข็นที่ออกจากห้องเย็นใหญ่ในวันนั้นแล้วเวลาเย็นคงเหลือติดลบ (ห้องที่ไม่คำนวณ DCS ไม่นับ) · นับตามวันปฏิทิน
        </div>
      </div>
    </section>
  );
};

export default StockHistory;
