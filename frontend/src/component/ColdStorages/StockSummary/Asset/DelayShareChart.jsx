import React from "react";
import { Alert } from "@mui/material";
import { ChartColumnStacked } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip as ChartTip, XAxis, YAxis } from "recharts";
import { CARD, FONT, TOKENS, SectionTitle } from "./StockTheme";
import { fullLabel, tickLabel } from "./StockHistory";

// status colours (good / critical): the share of delayed raw materials among those that came in that day
const OK = { key: "ok_pct", label: "ไม่ delay", color: "#16A34A", light: "#4ADE80", grad: "ssShareOk" };
const LATE = { key: "late_pct", label: "Delay", color: "#DC2626", light: "#F87171", grad: "ssShareLate" };

const pct = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);
const shortDay = (day) => new Date(`${day}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

const ShareTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  if (!r.in_items) return null;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-sm shadow-lg" style={{ ...FONT, border: `1px solid ${TOKENS.border}`, minWidth: 220 }}>
      <div className="font-semibold" style={{ color: TOKENS.text }}>{fullLabel(r.day)}</div>
      <div className="mb-1.5 text-xs" style={{ color: TOKENS.muted }}>{`เข้าห้องเย็นใหญ่ ${r.in_items} รายการ`}</div>
      {[LATE, OK].map((s) => (
        <div key={s.key} className="flex items-center gap-2 py-0.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
          <span style={{ color: TOKENS.muted }}>{s.label}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums" style={{ color: TOKENS.text }}>{r[s.key]}%</span>
          <span className="text-xs tabular-nums" style={{ color: TOKENS.muted }}>{`(${s === LATE ? r.late : r.ok} รายการ)`}</span>
        </div>
      ))}
    </div>
  );
};

// the Delay % above each bar, in a small pill (red tint when the day is above the average)
const pillLabel = (avg) => function PillLabel({ x, y, width, value, index }) { // eslint-disable-line react/display-name
  if (value == null || x == null) return null;
  const late = value;
  const text = `${late}%`;
  const w = text.length * 7 + 14;
  const cx = x + width / 2;
  const high = late > avg;
  return (
    <g key={index}>
      <rect x={cx - w / 2} y={y - 24} width={w} height={18} rx={9} fill={high ? "#FEE2E2" : "#F1F5F9"} />
      <text x={cx} y={y - 11} textAnchor="middle" style={{ ...FONT, fontSize: 11, fontWeight: 700, fill: high ? "#B91C1C" : TOKENS.text }}>{text}</text>
    </g>
  );
};

const Gauge = ({ value }) => {
  const R = 46;
  const C = 2 * Math.PI * R;
  const len = (Math.min(100, value) / 100) * C;
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-36">
      <defs>
        <linearGradient id="ssGauge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={LATE.light} />
          <stop offset="100%" stopColor={LATE.color} />
        </linearGradient>
      </defs>
      <g transform="rotate(-90 60 60)">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#DCFCE7" strokeWidth="12" />
        <circle cx="60" cy="60" r={R} fill="none" stroke="url(#ssGauge)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${len} ${C - len}`} />
      </g>
      <text x="60" y="62" textAnchor="middle" className="tabular-nums" style={{ ...FONT, fontSize: 24, fontWeight: 700, fill: TOKENS.text }}>{`${value}%`}</text>
      <text x="60" y="80" textAnchor="middle" style={{ ...FONT, fontSize: 11, fill: TOKENS.muted }}>Delay</text>
    </svg>
  );
};

const MiniStat = ({ label, value, sub }) => (
  <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "#F7F9FE", border: `1px solid ${TOKENS.border}` }}>
    <div className="text-xs" style={{ color: TOKENS.muted }}>{label}</div>
    <div className="text-lg font-bold tabular-nums" style={{ color: TOKENS.text }}>{value}</div>
    {sub && <div className="truncate text-xs" style={{ color: TOKENS.muted }}>{sub}</div>}
  </div>
);

/**
 * Raw materials that came into the large cold rooms per day, one 100 % bar per day: delayed (red) / not delayed (green),
 * with a summary panel (the share over the range, the best and the worst day).
 * rows: GET /api/coldstorages/stock/fetchHistory (in_items, in_late_items), days: the range chosen on the history chart.
 */
const DelayShareChart = ({ rows, days }) => {
  const data = rows.map((r) => {
    const total = r.in_items || 0;
    const late = Math.min(r.in_late_items || 0, total);
    const latePct = pct(late, total);
    return {
      ...r,
      late,
      ok: total - late,
      // a day without items keeps an empty track (no bar)
      late_pct: total ? latePct : null,
      ok_pct: total ? Math.round((100 - latePct) * 10) / 10 : null,
    };
  });
  const sumIn = data.reduce((s, r) => s + (r.in_items || 0), 0);
  const sumLate = data.reduce((s, r) => s + r.late, 0);
  const avg = pct(sumLate, sumIn);
  const withItems = data.filter((r) => r.in_items > 0);
  const worst = withItems.reduce((a, r) => (!a || r.late_pct > a.late_pct ? r : a), null);
  const best = withItems.reduce((a, r) => (!a || r.late_pct < a.late_pct ? r : a), null);
  const dense = days > 14;
  // the backend before the Delay share (PR #63) does not send in_late_items: every bar would read 0 %
  const noLateData = rows.length > 0 && rows.every((r) => r.in_late_items === undefined);

  return (
    <section className="space-y-3">
      <SectionTitle icon={ChartColumnStacked} title="สัดส่วนวัตถุดิบ Delay ที่เข้าห้องเย็นใหญ่" subtitle="รายวัน · ทุกรายการที่เข้าในวันนั้น = 100%" />
      {noLateData && (
        <Alert severity="warning" sx={FONT}>ยังไม่มีข้อมูล Delay จากเซิร์ฟเวอร์ (backend ยังไม่ได้ reload) กราฟนี้จึงยังไม่ถูกต้อง</Alert>
      )}
      <div className="grid grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[280px_1fr]" style={CARD}>
        {/* summary of the range */}
        <div className="flex flex-col items-center gap-3 rounded-2xl p-4" style={{ background: "linear-gradient(160deg, #FFF5F5 0%, #F7F9FE 60%)", border: `1px solid ${TOKENS.border}` }}>
          <div className="text-sm font-semibold" style={{ color: TOKENS.text }}>{`ภาพรวม ${days} วัน`}</div>
          <Gauge value={avg} />
          <div className="text-center text-sm" style={{ color: TOKENS.muted }}>{`${sumLate} จาก ${sumIn} รายการ`}</div>
          <div className="grid w-full grid-cols-2 gap-2">
            <MiniStat label="Delay มากสุด" value={worst ? `${worst.late_pct}%` : "-"} sub={worst ? shortDay(worst.day) : ""} />
            <MiniStat label="Delay น้อยสุด" value={best ? `${best.late_pct}%` : "-"} sub={best ? shortDay(best.day) : ""} />
          </div>
        </div>

        {/* one bar per day */}
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm" style={{ color: TOKENS.text }}>
            {[LATE, OK].map((s) => (
              <span key={s.key} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded" style={{ background: `linear-gradient(180deg, ${s.light}, ${s.color})` }} />
                {s.label}
              </span>
            ))}
            <span className="flex items-center gap-2" style={{ color: TOKENS.muted }}>
              <span className="w-5 border-t-2 border-dashed" style={{ borderColor: "#64748B" }} />
              {`เฉลี่ย ${avg}%`}
            </span>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 30, right: 12, left: 0, bottom: 0 }} barCategoryGap={dense ? "18%" : "32%"}>
                <defs>
                  <linearGradient id={LATE.grad} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={LATE.light} />
                    <stop offset="100%" stopColor={LATE.color} />
                  </linearGradient>
                  <linearGradient id={OK.grad} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={OK.light} />
                    <stop offset="100%" stopColor={OK.color} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#EEF2F7" />
                <XAxis
                  dataKey="day" tickFormatter={tickLabel(days)} tickLine={false} axisLine={false}
                  tick={{ fill: TOKENS.muted, fontSize: 12, fontFamily: FONT.fontFamily }} interval={dense ? 3 : days > 7 ? 1 : 0} tickMargin={10}
                />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={48}
                  tick={{ fill: TOKENS.muted, fontSize: 12, fontFamily: FONT.fontFamily }} />
                <ChartTip content={<ShareTip />} cursor={{ fill: "rgba(21,82,240,.05)", radius: 8 }} />
                <ReferenceLine y={avg} stroke="#64748B" strokeDasharray="5 5" strokeWidth={1.5} ifOverflow="extendDomain" />
                {/* red at the bottom (the part to watch), green on top, on a light track; a thin white line between the two */}
                <Bar
                  dataKey={LATE.key} stackId="share" fill={`url(#${LATE.grad})`} stroke="#fff" strokeWidth={1.5}
                  radius={[0, 0, 6, 6]} maxBarSize={dense ? 18 : 44}
                  background={{ fill: "#F1F5F9", radius: 6 }}
                />
                <Bar dataKey={OK.key} stackId="share" fill={`url(#${OK.grad})`} stroke="#fff" strokeWidth={1.5} radius={[6, 6, 0, 0]} maxBarSize={dense ? 18 : 44}>
                  {!dense && <LabelList dataKey={LATE.key} position="top" content={pillLabel(avg)} />}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="text-xs" style={{ color: TOKENS.muted }}>
        Delay = ออกจากห้องเกินเวลา หรือยังจอดอยู่ในห้องที่คำนวณ DCS เกินเวลาเย็นของรายการ · วันที่ไม่มีรายการเข้า แท่งว่าง
      </div>
    </section>
  );
};

export default DelayShareChart;
