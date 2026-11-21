import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Alert, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { ArrowDownRight, ArrowUpRight, ChartArea, Layers, Minus, Table2 } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip as ChartTip, XAxis, YAxis } from "recharts";
import { CARD, FONT, TOKENS, SectionTitle, SegmentSwitch } from "./StockTheme";
import { RANGES, fullLabel, shortDay, signedNum, tickLabel } from "./historyFormat";

const API_URL = import.meta.env.VITE_API_URL;
const COLOR = TOKENS.primary;

const UNITS = [
  { value: "trolleys", label: "คัน" },
  { value: "items", label: "รายการ" },
];
const VIEWS = [
  { value: "chart", label: <ChartArea size={16} /> },
  { value: "table", label: <Table2 size={16} /> },
];

const LevelTip = ({ active, payload, unitLabel }) => {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-sm shadow-lg" style={{ ...FONT, border: `1px solid ${TOKENS.border}`, minWidth: 210 }}>
      <div className="mb-1.5 font-semibold" style={{ color: TOKENS.text }}>{r.isToday ? `${fullLabel(r.day)} (ตอนนี้)` : fullLabel(r.day)}</div>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR }} />
        <span style={{ color: TOKENS.muted }}>คงค้างสิ้นวัน</span>
        <span className="ml-auto pl-3 font-semibold tabular-nums" style={{ color: TOKENS.text }}>{`${r.trolleys} คัน`}</span>
        <span className="text-xs tabular-nums" style={{ color: TOKENS.muted }}>{`(${r.items} รายการ)`}</span>
      </div>
      {r.change != null && (
        <div className="mt-1 flex items-center gap-2 border-t pt-1" style={{ borderColor: TOKENS.border }}>
          <span style={{ color: TOKENS.muted }}>จากวันก่อน</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums" style={{ color: TOKENS.text }}>{`${signedNum(r.change)} ${unitLabel}`}</span>
        </div>
      )}
    </div>
  );
};

const Delta = ({ diff, unit }) => {
  if (diff == null) return null;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: TOKENS.muted }}>
      <Icon size={13} />
      {`${signedNum(diff)} ${unit} จากเมื่อวาน`}
    </span>
  );
};

const Stat = ({ label, value, unit, note, children, color = COLOR }) => (
  <div className="min-w-0 rounded-xl px-3 py-2.5" style={{ backgroundColor: "#F7F9FE", border: `1px solid ${TOKENS.border}` }}>
    <div className="flex items-center gap-2 text-sm" style={{ color: TOKENS.muted }}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
      <span className="text-2xl font-bold tabular-nums" style={{ color: TOKENS.text }}>{value ?? "-"}</span>
      {unit && <span className="text-sm" style={{ color: TOKENS.muted }}>{unit}</span>}
      {children}
    </div>
    {note && <div className="truncate text-xs" style={{ color: TOKENS.muted }}>{note}</div>}
  </div>
);

const LevelTable = ({ rows }) => {
  const head = { ...FONT, whiteSpace: "nowrap", py: 0.75 };
  const cell = { ...FONT, py: 0.5, whiteSpace: "nowrap" };
  const num = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  return (
    <TableContainer sx={{ maxHeight: 320, borderRadius: "12px", border: `1px solid ${TOKENS.border}` }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {["วันที่", "คงค้าง (คัน)", "คงค้าง (รายการ)", "เปลี่ยนจากวันก่อน (คัน)", "เปลี่ยนจากวันก่อน (รายการ)"].map((h, i) => (
              <TableCell key={h} sx={{ ...head, textAlign: i ? "right" : "left" }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {[...rows].reverse().map((r) => (
            <TableRow key={r.day} hover>
              <TableCell sx={cell}>{r.isToday ? `${fullLabel(r.day)} (ตอนนี้)` : fullLabel(r.day)}</TableCell>
              <TableCell sx={num}>{r.trolleys}</TableCell>
              <TableCell sx={num}>{r.items}</TableCell>
              <TableCell sx={num}>{r.dT == null ? "-" : signedNum(r.dT)}</TableCell>
              <TableCell sx={num}>{r.dI == null ? "-" : signedNum(r.dI)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

/**
 * Stock left in the large cold rooms at the end of each day (today = now): does it pile up or go down?
 * GET /api/coldstorages/stock/fetchLevel. overdueNow = trolleys in a room over their limit right now (from the page).
 */
const StockLevelChart = ({ overdueNow, reloadKey, className = "" }) => {
  const [days, setDays] = useState(7);
  const [unit, setUnit] = useState("trolleys");
  const [view, setView] = useState("chart");
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
      const res = await axios.get(`${API_URL}/api/coldstorages/stock/fetchLevel`, { params: { days } });
      setData(res.data?.data ?? []);
    } catch (err) {
      console.error("StockLevelChart fetch error:", err);
      setError("โหลด Stock คงค้างรายวันไม่สำเร็จ");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const k = unit === "items" ? "items" : "trolleys";
  const uLabel = unit === "items" ? "รายการ" : "คัน";
  const rows = data.map((r, i) => {
    const prev = data[i - 1];
    return {
      ...r,
      isToday: i === data.length - 1,
      v: r[k],
      change: prev ? r[k] - prev[k] : null,
      dT: prev ? r.trolleys - prev.trolleys : null,
      dI: prev ? r.items - prev.items : null,
    };
  });
  const now = rows[rows.length - 1];
  const first = rows[0];
  const peak = rows.reduce((a, r) => (!a || r.v > a.v ? r : a), null);
  const low = rows.reduce((a, r) => (!a || r.v < a.v ? r : a), null);
  const avg = rows.length ? Math.round((rows.reduce((a, r) => a + r.v, 0) / rows.length) * 10) / 10 : 0;
  const trend = now && first ? now.v - first.v : 0;
  const dense = days > 14;

  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      <SectionTitle icon={Layers} title="Stock คงค้างรายวัน" subtitle="จำนวนที่อยู่ในห้องเย็นใหญ่ตอนสิ้นวัน (วันนี้ = ตอนนี้)">
        <SegmentSwitch value={days} options={RANGES} onChange={setDays} />
      </SectionTitle>

      {error && <Alert severity="error" sx={FONT}>{error}</Alert>}

      <div className="flex flex-1 flex-col px-4 py-4" style={CARD}>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Stat label="คงค้างตอนนี้" value={now?.v} unit={uLabel}>
            <Delta diff={now?.change} unit={uLabel} />
          </Stat>
          <Stat label={`แนวโน้ม ${days} วัน`} value={rows.length ? signedNum(trend) : "-"} unit={uLabel}
            note={trend > 0 ? "สะสมเพิ่มขึ้น" : trend < 0 ? "ลดลง" : "เท่าเดิม"} color={trend > 0 ? "#F59E0B" : "#16A34A"} />
          <Stat label="สูงสุดในช่วง" value={peak?.v} unit={uLabel} note={peak ? shortDay(peak.day) : ""} color="#7C3AED" />
          <Stat label="ค้างเกินเวลาอยู่ตอนนี้" value={overdueNow} unit="คัน" note="ยังอยู่ในห้องและเลยกำหนด" color="#DC2626" />
        </div>

        <div className="mt-4 mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-5 text-sm" style={{ color: TOKENS.text }}>
            <span className="flex items-center gap-2">
              <span className="h-[3px] w-5 rounded-full" style={{ backgroundColor: COLOR }} />
              {`คงค้างสิ้นวัน (${uLabel})`}
            </span>
            <span className="flex items-center gap-2" style={{ color: TOKENS.muted }}>
              <span className="w-5 border-t-2 border-dashed" style={{ borderColor: "#64748B" }} />
              {`เฉลี่ย ${avg}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SegmentSwitch value={unit} options={UNITS} onChange={setUnit} />
            <SegmentSwitch value={view} options={VIEWS} onChange={setView} />
          </div>
        </div>

        <div className="relative min-h-[280px] flex-1">
          {view === "table" ? (
            <LevelTable rows={rows} />
          ) : loading && data.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center"><CircularProgress size={28} /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={280}>
              <ComposedChart data={rows} margin={{ top: 10, right: 28, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="ssLevel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLOR} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={COLOR} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#EEF2F7" />
                <XAxis
                  dataKey="day" tickFormatter={tickLabel(days)} tickLine={false} axisLine={{ stroke: TOKENS.border }}
                  tick={{ fill: TOKENS.muted, fontSize: 12, fontFamily: FONT.fontFamily }} interval={dense ? 3 : days > 7 ? 1 : 0} tickMargin={8}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} tick={{ fill: TOKENS.muted, fontSize: 12, fontFamily: FONT.fontFamily }} />
                <ChartTip content={<LevelTip unitLabel={uLabel} />} cursor={{ stroke: TOKENS.border, strokeWidth: 1.5 }} />
                <ReferenceLine y={avg} stroke="#64748B" strokeDasharray="5 5" strokeWidth={1.5} />
                <Area
                  type="monotone" dataKey="v" stroke={COLOR} strokeWidth={3} fill="url(#ssLevel)"
                  dot={dense ? false : { r: 4, fill: "#fff", stroke: COLOR, strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: COLOR, stroke: "#fff", strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "ต้นช่วง", value: first ? `${first.v} ${uLabel}` : "-", note: first ? shortDay(first.day) : "" },
            { label: "ต่ำสุดในช่วง", value: low ? `${low.v} ${uLabel}` : "-", note: low ? shortDay(low.day) : "" },
            { label: "เฉลี่ยต่อวัน", value: `${avg} ${uLabel}` },
            { label: "เปลี่ยนจากต้นช่วง", value: rows.length ? `${signedNum(trend)} ${uLabel}` : "-", note: first && first.v ? `${signedNum(Math.round((trend / first.v) * 1000) / 10)}%` : "" },
          ].map((it) => (
            <div key={it.label} className="min-w-0 rounded-lg px-2.5 py-1.5" style={{ border: `1px dashed ${TOKENS.border}` }}>
              <div className="truncate text-[11px]" style={{ color: TOKENS.muted }}>{it.label}</div>
              <div className="text-sm font-semibold tabular-nums" style={{ color: TOKENS.text }}>{it.value}</div>
              {it.note && <div className="truncate text-[11px]" style={{ color: TOKENS.muted }}>{it.note}</div>}
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs" style={{ color: TOKENS.muted }}>
          คงค้าง = เข้าห้องเย็นใหญ่ก่อนสิ้นวันและยังไม่ออก ณ สิ้นวัน (ทุกห้อง รวมห้องที่ไม่คำนวณ DCS) · นับตามวันปฏิทิน
        </div>
      </div>
    </section>
  );
};

export default StockLevelChart;
