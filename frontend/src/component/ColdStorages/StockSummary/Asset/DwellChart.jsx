import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Alert, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { ArrowDownRight, ArrowUpRight, ChartLine, Hourglass, Minus, Table2 } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, LabelList, ReferenceLine, ResponsiveContainer, Tooltip as ChartTip, XAxis, YAxis } from "recharts";
import { CARD, FONT, TOKENS, SectionTitle, SegmentSwitch } from "./StockTheme";
import { RANGES, fullLabel, shortDay, tickLabel } from "./historyFormat";
import { formatTime } from "../../RoomMonitor/Asset/csDelay";

const API_URL = import.meta.env.VITE_API_URL;

// one axis (hours): a bar per day = the average time, blue when within the standard of that day, orange when over it.
// Colours checked with the dataviz validator.
const AVG = { label: "เวลาเฉลี่ย", color: TOKENS.primary, light: "#4D7BF5" };
const OVER = { label: "เฉลี่ยเกินมาตรฐาน", color: "#EB6834", light: "#F59E6B" };
const MAX = { label: "นานสุดของวัน", color: "#334155" };
const STD = { label: "มาตรฐาน (เฉลี่ยของกลุ่ม)", color: "#64748B" };

const VIEWS = [
  { value: "chart", label: <ChartLine size={16} /> },
  { value: "table", label: <Table2 size={16} /> },
];

// the point of each day: orange when the average of the day is over its standard
const dwellDot = (dense) => function DwellDot({ cx, cy, payload, index }) { // eslint-disable-line react/display-name
  if (cx == null || cy == null || payload?.avg_h == null) return <g key={index} />;
  const over = payload.over;
  if (dense && !over) return <g key={index} />;
  return <circle key={index} cx={cx} cy={cy} r={over ? 5.5 : 4} fill={over ? OVER.color : "#fff"} stroke={over ? "#fff" : AVG.color} strokeWidth={2} />;
};

const hrs = (min) => (min == null ? null : Math.round((min / 60) * 10) / 10);
const t = (min) => (min == null ? "-" : formatTime(min));

const DwellTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-sm shadow-lg" style={{ ...FONT, border: `1px solid ${TOKENS.border}`, minWidth: 250 }}>
      <div className="font-semibold" style={{ color: TOKENS.text }}>{fullLabel(r.day)}</div>
      <div className="mb-1.5 text-xs" style={{ color: TOKENS.muted }}>{`ออกจากห้อง ${r.items} รายการ`}</div>
      {r.items > 0 ? (
        <>
          {[[AVG, r.avg_min], [MAX, r.max_min], [STD, r.std_min]].map(([s, v]) => (
            <div key={s.label} className="flex items-center gap-2 py-0.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              <span style={{ color: TOKENS.muted }}>{s.label}</span>
              <span className="ml-auto pl-3 font-semibold tabular-nums" style={{ color: TOKENS.text }}>{t(v)}</span>
            </div>
          ))}
          {r.longest && (
            <div className="mt-1 text-xs" style={{ color: TOKENS.muted }}>
              {`นานสุด: ${r.longest.mat_name || r.longest.mat || "-"} · รถเข็น ${r.longest.tro}`}
            </div>
          )}
          <div className="mt-1 border-t pt-1 text-xs" style={{ borderColor: TOKENS.border, color: TOKENS.muted }}>
            {`อยู่นานกว่ามาตรฐาน ${r.over_std} จาก ${r.items} รายการ`}
          </div>
        </>
      ) : (
        <div className="text-xs" style={{ color: TOKENS.muted }}>ไม่มีรายการออกจากห้องในวันนี้</div>
      )}
      {r.long_items > 0 && <div className="text-xs" style={{ color: TOKENS.muted }}>{`เก็บระยะยาว (ไม่นับในเวลา) ${r.long_items} รายการ`}</div>}
    </div>
  );
};

const Delta = ({ now, before }) => {
  if (now == null || before == null) return null;
  const diff = now - before;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: TOKENS.muted }}>
      <Icon size={13} />
      {`${diff > 0 ? "+" : diff < 0 ? "-" : ""}${t(Math.abs(diff))} จากเมื่อวาน`}
    </span>
  );
};

const Stat = ({ label, value, note, children, color }) => (
  <div className="min-w-0 rounded-xl px-3 py-2.5" style={{ backgroundColor: "#F7F9FE", border: `1px solid ${TOKENS.border}` }}>
    <div className="flex items-center gap-2 text-sm" style={{ color: TOKENS.muted }}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
      <span className="text-xl font-bold tabular-nums" style={{ color: TOKENS.text }}>{value ?? "-"}</span>
      {children}
    </div>
    {note && <div className="truncate text-xs" style={{ color: TOKENS.muted }}>{note}</div>}
  </div>
);

const DwellTable = ({ rows }) => {
  const head = { ...FONT, whiteSpace: "nowrap", py: 0.75 };
  const cell = { ...FONT, py: 0.5, whiteSpace: "nowrap" };
  const num = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  return (
    <TableContainer sx={{ maxHeight: 320, borderRadius: "12px", border: `1px solid ${TOKENS.border}` }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {["วันที่", "ออกจากห้อง (รายการ)", "เวลาเฉลี่ย", "นานสุดของวัน", "วัตถุดิบที่อยู่นานสุด", "มาตรฐาน (เฉลี่ยของกลุ่ม)", "นานกว่ามาตรฐาน", "เก็บระยะยาว"].map((h, i) => (
              <TableCell key={h} sx={{ ...head, textAlign: i === 0 || i === 4 ? "left" : "right" }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {[...rows].reverse().map((r) => (
            <TableRow key={r.day} hover>
              <TableCell sx={cell}>{fullLabel(r.day)}</TableCell>
              <TableCell sx={num}>{r.items}</TableCell>
              <TableCell sx={num}>{t(r.avg_min)}</TableCell>
              <TableCell sx={num}>{t(r.max_min)}</TableCell>
              <TableCell sx={cell}>{r.longest ? `${r.longest.mat_name || r.longest.mat || "-"} (${r.longest.tro})` : "-"}</TableCell>
              <TableCell sx={num}>{t(r.std_min)}</TableCell>
              <TableCell sx={{ ...num, color: r.over_std ? "#DC2626" : TOKENS.text, fontWeight: r.over_std ? 600 : 400 }}>{r.over_std}</TableCell>
              <TableCell sx={num}>{r.long_items}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

/**
 * How long raw materials stayed in the large cold rooms, per day they went out: average (bar), longest (dot), standard (dashed line).
 * GET /api/coldstorages/stock/fetchDwell. overdueNow = trolleys in a room over their limit right now (from the page).
 */
const DwellChart = ({ overdueNow, reloadKey, className = "" }) => {
  const [days, setDays] = useState(7);
  const [view, setView] = useState("chart");
  const [data, setData] = useState([]);
  const [longHours, setLongHours] = useState(72);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return; // heavy query: no second request while one runs
    busy.current = true;
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${API_URL}/api/coldstorages/stock/fetchDwell`, { params: { days } });
      setData(res.data?.data ?? []);
      if (res.data?.long_hours) setLongHours(res.data.long_hours);
    } catch (err) {
      console.error("DwellChart fetch error:", err);
      setError("โหลดเวลาที่อยู่ในห้องเย็นใหญ่ไม่สำเร็จ");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const rows = data.map((r) => ({ ...r, avg_h: hrs(r.avg_min), over: r.avg_min != null && r.std_min != null && r.avg_min > r.std_min }));
  const today = rows[rows.length - 1];
  const yesterday = rows[rows.length - 2];
  const sumItems = rows.reduce((a, r) => a + r.items, 0);
  const rangeAvg = sumItems ? Math.round(rows.reduce((a, r) => a + (r.avg_min || 0) * r.items, 0) / sumItems) : null;
  const sumOver = rows.reduce((a, r) => a + r.over_std, 0);
  const sumLong = rows.reduce((a, r) => a + r.long_items, 0);
  const longestDay = rows.reduce((a, r) => (r.max_min != null && (!a || r.max_min > a.max_min) ? r : a), null);
  const dense = days > 14;
  // one standard line for the range: the standards of the items that went out, weighted by the items of each day
  const rangeStd = sumItems ? Math.round(rows.reduce((a, r) => a + (r.std_min || 0) * r.items, 0) / sumItems) : null;

  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      <SectionTitle icon={Hourglass} title="เวลาที่อยู่ในห้องเย็นใหญ่" subtitle="รายวัน ตามวันที่ออกจากห้อง">
        <SegmentSwitch value={days} options={RANGES} onChange={setDays} />
      </SectionTitle>

      {error && <Alert severity="error" sx={FONT}>{error}</Alert>}

      <div className="flex flex-1 flex-col px-4 py-4" style={CARD}>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Stat label="เฉลี่ยวันนี้" value={t(today?.avg_min)} color={AVG.color} note={today ? `ออก ${today.items} รายการ` : ""}>
            <Delta now={today?.avg_min} before={yesterday?.avg_min} />
          </Stat>
          <Stat label={`เฉลี่ย ${days} วัน`} value={t(rangeAvg)} color={AVG.color} note={longestDay ? `นานสุด ${t(longestDay.max_min)} (${shortDay(longestDay.day)})` : ""} />
          <Stat label="นานกว่ามาตรฐาน" value={sumItems ? `${Math.round((sumOver / sumItems) * 1000) / 10}%` : "-"} color="#F59E0B" note={`${sumOver} จาก ${sumItems} รายการ`} />
          <Stat label="ค้างเกินเวลาอยู่ตอนนี้" value={`${overdueNow} คัน`} color="#DC2626" note="ยังอยู่ในห้องและเลยกำหนด" />
        </div>

        <div className="mt-4 mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm" style={{ color: TOKENS.text }}>
            <span className="flex items-center gap-2"><span className="h-[3px] w-5 rounded-full" style={{ backgroundColor: AVG.color }} />{AVG.label}</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: OVER.color }} />วันที่เฉลี่ยเกินมาตรฐาน</span>
            <span className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed" style={{ borderColor: STD.color }} />{`มาตรฐาน ${t(rangeStd)}`}</span>
          </div>
          <SegmentSwitch value={view} options={VIEWS} onChange={setView} />
        </div>

        <div className="relative min-h-[280px] flex-1">
          {view === "table" ? (
            <DwellTable rows={rows} />
          ) : loading && data.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center"><CircularProgress size={28} /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={280}>
              <ComposedChart data={rows} margin={{ top: 10, right: 28, left: -6, bottom: 0 }}>
                <defs>
                  <linearGradient id="ssDwellArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AVG.color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={AVG.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#EEF2F7" />
                <XAxis
                  dataKey="day" tickFormatter={tickLabel(days)} tickLine={false} axisLine={{ stroke: TOKENS.border }}
                  tick={{ fill: TOKENS.muted, fontSize: 12, fontFamily: FONT.fontFamily }} interval={dense ? 3 : days > 7 ? 1 : 0} tickMargin={8}
                />
                <YAxis tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `${v} ชม.`} domain={[0, (max) => Math.ceil(Math.max(max, (rangeStd || 0) / 60) * 1.15)]}
                  tick={{ fill: TOKENS.muted, fontSize: 12, fontFamily: FONT.fontFamily }} />
                <ChartTip content={<DwellTip />} cursor={{ fill: "rgba(21,82,240,.05)" }} />
                {rangeStd != null && <ReferenceLine y={hrs(rangeStd)} stroke={STD.color} strokeDasharray="6 5" strokeWidth={1.5} />}
                {/* a line of the average; the point of a day over its standard is orange */}
                <Area
                  type="monotone" dataKey="avg_h" name={AVG.label} stroke={AVG.color} strokeWidth={3} fill="url(#ssDwellArea)" connectNulls
                  dot={dwellDot(dense)} activeDot={{ r: 6, fill: AVG.color, stroke: "#fff", strokeWidth: 2 }}
                >
                  {!dense && <LabelList dataKey="avg_h" position="top" offset={10} formatter={(v) => (v == null ? "" : `${v}`)} style={{ ...FONT, fontSize: 11, fontWeight: 600, fill: TOKENS.text }} />}
                </Area>
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-2 text-xs" style={{ color: TOKENS.muted }}>
          {`เวลา = เข้าห้องเย็นใหญ่ถึงออก นับตามวันที่ออก · รอบที่อยู่นานกว่า ${longHours} ชม. นับเป็นเก็บระยะยาว (ส่วนใหญ่คือห้องแช่แข็ง) ไม่รวมในเวลา: ${sumLong} รายการในช่วงนี้ · ระบบไม่ได้บันทึกห้องของแต่ละรอบ`}
        </div>
      </div>
    </section>
  );
};

export default DwellChart;
