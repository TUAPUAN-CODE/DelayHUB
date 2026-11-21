import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Alert, CircularProgress } from "@mui/material";
import { History } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as ChartTip, XAxis, YAxis } from "recharts";
import { CARD, FONT, TOKENS, SectionTitle, SegmentSwitch } from "./StockTheme";

const API_URL = import.meta.env.VITE_API_URL;

// three series, one axis (trolleys). Colours checked with the dataviz validator (CVD / contrast pass on white).
const SERIES = [
  { key: "in_trolleys", items: "in_items", label: "เข้าห้องเย็นใหญ่", color: TOKENS.primary },
  { key: "out_trolleys", items: "out_items", label: "เคลียร์ออก", color: "#0D9488" },
  { key: "late_trolleys", items: "late_items", label: "Delay (ออกเกินเวลา)", color: "#DC2626" },
];

const RANGES = [
  { value: 7, label: "7 วัน" },
  { value: 14, label: "14 วัน" },
  { value: 30, label: "30 วัน" },
];

const dayLabel = (day) => {
  const d = new Date(`${day}T00:00:00`);
  return d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "numeric" });
};

// legend names in the text colour (the square beside them carries the series colour)
const legendText = (value) => <span style={{ color: TOKENS.text }}>{value}</span>;

const HistoryTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-sm shadow-lg" style={{ ...FONT, border: `1px solid ${TOKENS.border}` }}>
      <div className="mb-1 font-semibold" style={{ color: TOKENS.text }}>{label}</div>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center gap-2" style={{ color: TOKENS.text }}>
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
          <span style={{ color: TOKENS.muted }}>{s.label}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums">{row[s.key]} คัน</span>
          <span className="tabular-nums text-xs" style={{ color: TOKENS.muted }}>{`(${row[s.items]} รายการ)`}</span>
        </div>
      ))}
    </div>
  );
};

const TodayStat = ({ label, value, color, note }) => (
  <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "#F7F9FE", border: `1px solid ${TOKENS.border}` }}>
    <div className="flex items-center gap-2 text-sm" style={{ color: TOKENS.muted }}>
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </div>
    <div className="mt-0.5 flex items-baseline gap-1">
      <span className="text-2xl font-bold tabular-nums" style={{ color: TOKENS.text }}>{value}</span>
      <span className="text-sm" style={{ color: TOKENS.muted }}>คัน</span>
    </div>
    {note && <div className="text-xs" style={{ color: TOKENS.muted }}>{note}</div>}
  </div>
);

/**
 * Trolleys that came into / were cleared from the large cold rooms per day, and the cleared ones that were late
 * (GET /api/coldstorages/stock/fetchHistory). overdueNow = trolleys in a room over their limit right now (from the page).
 * reloadKey: changes when the page reloads its data.
 */
const StockHistory = ({ overdueNow, reloadKey }) => {
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
      setData((res.data?.data ?? []).map((d) => ({ ...d, label: dayLabel(d.day) })));
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

  return (
    <section className="space-y-3">
      <SectionTitle icon={History} title="ประวัติเข้า-ออกห้องเย็นใหญ่" subtitle="รายวัน · นับเป็นคัน">
        <SegmentSwitch value={days} options={RANGES} onChange={setDays} />
      </SectionTitle>

      {error && <Alert severity="error" sx={FONT}>{error}</Alert>}

      <div className="px-4 py-3" style={CARD}>
        <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <TodayStat label="เข้าวันนี้" value={today?.in_trolleys ?? "-"} color={SERIES[0].color} />
          <TodayStat label="เคลียร์วันนี้" value={today?.out_trolleys ?? "-"} color={SERIES[1].color} />
          <TodayStat label="Delay วันนี้" value={today?.late_trolleys ?? "-"} color={SERIES[2].color} note="ออกจากห้องเกินเวลา" />
          <TodayStat label="ค้างเกินเวลาอยู่ตอนนี้" value={overdueNow} color={SERIES[2].color} note="ยังอยู่ในห้องและเลยกำหนด" />
        </div>

        <div className="relative h-72">
          {loading && data.length === 0 ? (
            <div className="flex h-full items-center justify-center"><CircularProgress size={28} /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="#E8EEF9" />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: TOKENS.border }} tick={{ fill: TOKENS.muted, fontSize: 12, fontFamily: FONT.fontFamily }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: TOKENS.muted, fontSize: 12, fontFamily: FONT.fontFamily }} />
                <ChartTip content={<HistoryTip />} cursor={{ fill: "rgba(21,82,240,.06)" }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="square"
                  iconSize={10}
                  wrapperStyle={{ ...FONT, fontSize: 13, paddingBottom: 8 }}
                  formatter={legendText}
                />
                {SERIES.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22} />
                ))}
              </BarChart>
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
