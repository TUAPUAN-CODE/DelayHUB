import React from "react";
import { ChartColumnStacked } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip as ChartTip, XAxis, YAxis } from "recharts";
import { CARD, FONT, TOKENS, SectionTitle } from "./StockTheme";
import { fullLabel, tickLabel } from "./StockHistory";

// status colours (good / critical): the share of delayed raw materials among those that came in that day
const OK = { key: "ok_pct", label: "ไม่ delay", color: "#16A34A" };
const LATE = { key: "late_pct", label: "Delay", color: "#DC2626" };

const pct = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);

const ShareTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-sm shadow-lg" style={{ ...FONT, border: `1px solid ${TOKENS.border}`, minWidth: 220 }}>
      <div className="mb-1.5 font-semibold" style={{ color: TOKENS.text }}>{fullLabel(r.day)}</div>
      <div style={{ color: TOKENS.muted }}>{`เข้าห้องเย็นใหญ่ ${r.in_items} รายการ`}</div>
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

const lateLabel = (v) => (v > 0 ? `${v}%` : "");

/**
 * Raw materials that came into the large cold rooms per day, one 100 % bar per day: delayed (red) / not delayed (green).
 * rows: GET /api/coldstorages/stock/fetchHistory (in_items, in_late_items), days: the range chosen on the history chart.
 */
const DelayShareChart = ({ rows, days }) => {
  const data = rows.map((r) => {
    const late = Math.min(r.in_late_items || 0, r.in_items || 0);
    const ok = (r.in_items || 0) - late;
    return { ...r, late, ok, late_pct: pct(late, r.in_items), ok_pct: r.in_items ? Math.round((100 - pct(late, r.in_items)) * 10) / 10 : 0 };
  });
  const sumIn = data.reduce((s, r) => s + (r.in_items || 0), 0);
  const sumLate = data.reduce((s, r) => s + r.late, 0);
  const dense = days > 14;

  return (
    <section className="space-y-3">
      <SectionTitle icon={ChartColumnStacked} title="สัดส่วนวัตถุดิบ Delay ที่เข้าห้องเย็นใหญ่" subtitle="รายวัน · ทุกรายการที่เข้าในวันนั้น = 100%">
        <div className="rounded-xl px-3 py-2 text-sm" style={{ ...CARD, color: TOKENS.muted }}>
          {`${days} วัน: Delay ${pct(sumLate, sumIn)}% (${sumLate} จาก ${sumIn} รายการ)`}
        </div>
      </SectionTitle>
      <div className="px-4 py-4" style={CARD}>
        <div className="mb-2 flex flex-wrap items-center gap-x-5 text-sm" style={{ color: TOKENS.text }}>
          {[LATE, OK].map((s) => (
            <span key={s.key} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barCategoryGap={dense ? "20%" : "35%"}>
              <CartesianGrid vertical={false} stroke="#EEF2F7" />
              <XAxis
                dataKey="day" tickFormatter={tickLabel(days)} tickLine={false} axisLine={{ stroke: TOKENS.border }}
                tick={{ fill: TOKENS.muted, fontSize: 12, fontFamily: FONT.fontFamily }} interval={dense ? 3 : days > 7 ? 1 : 0} tickMargin={8}
              />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={48}
                tick={{ fill: TOKENS.muted, fontSize: 12, fontFamily: FONT.fontFamily }} />
              <ChartTip content={<ShareTip />} cursor={{ fill: "rgba(21,82,240,.05)" }} />
              {/* red at the bottom (the part to watch), green on top; a thin white line between the two */}
              <Bar dataKey={LATE.key} stackId="share" fill={LATE.color} stroke="#fff" strokeWidth={1} maxBarSize={dense ? 18 : 40} />
              <Bar dataKey={OK.key} stackId="share" fill={OK.color} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={dense ? 18 : 40}>
                {/* the Delay % above each bar */}
                {!dense && <LabelList dataKey={LATE.key} position="top" formatter={lateLabel} style={{ ...FONT, fontSize: 12, fontWeight: 600, fill: TOKENS.text }} />}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-xs" style={{ color: TOKENS.muted }}>
          Delay = ออกจากห้องเกินเวลา หรือยังจอดอยู่ในห้องที่คำนวณ DCS เกินเวลาเย็นของรายการ · วันที่ไม่มีรายการเข้า แท่งว่าง
        </div>
      </div>
    </section>
  );
};

export default DelayShareChart;
