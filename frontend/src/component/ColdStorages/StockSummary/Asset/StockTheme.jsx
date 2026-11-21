import React from "react";
import { TOKENS, GLASS } from "../../../../theme/dochubTheme";
import { STATUS_KEYS, STATUS_META } from "./buildStockSummary";

// Pieces of the stock summary page in the look of the rest of the web (theme/dochubTheme.js):
// white cards with the soft blue shadow, primary blue for the controls.
export const FONT = { fontFamily: "Prompt, Kanit, sans-serif" };
export { TOKENS };
export const CARD = { ...GLASS, borderRadius: "16px" };

export const KpiCard = ({ icon: Icon, label, value, unit, sub, accent = TOKENS.primary }) => (
  <div className="relative overflow-hidden px-4 py-3" style={CARD}>
    <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: accent }} />
    <div className="flex items-center gap-2 text-sm" style={{ color: TOKENS.muted }}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${accent}1A`, color: accent }}>
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-2 flex items-baseline gap-1.5">
      <span className="text-3xl font-semibold tabular-nums" style={{ color: TOKENS.text }}>{value}</span>
      {unit && <span className="text-sm" style={{ color: TOKENS.muted }}>{unit}</span>}
    </div>
    {sub && <div className="mt-1 truncate text-xs" style={{ color: TOKENS.muted }}>{sub}</div>}
  </div>
);

export const SegmentSwitch = ({ value, options, onChange }) => (
  <div className="inline-flex rounded-xl p-1" style={{ backgroundColor: TOKENS.primarySoft }}>
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="rounded-lg px-3.5 py-1.5 text-sm transition"
          style={active
            ? { backgroundColor: TOKENS.primary, color: "#fff", fontWeight: 600, boxShadow: "0 2px 8px rgba(21,82,240,.25)" }
            : { color: TOKENS.primary }}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

// heading of a section: solid blue icon, big bold title, the orange accent of the page header under it
export const SectionTitle = ({ icon: Icon, title, subtitle, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
    <div className="flex items-center gap-3">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white"
        style={{ background: "linear-gradient(135deg, #3B7BFF, #1552F0)", boxShadow: "0 4px 12px rgba(21,82,240,.28)" }}
      >
        <Icon size={22} strokeWidth={2.2} />
      </span>
      <div>
        <h2 className="text-xl font-bold leading-tight" style={{ color: TOKENS.text }}>{title}</h2>
        <span className="mt-1 block h-1 w-12 rounded-full" style={{ background: "linear-gradient(90deg, #FF9A4D, #F26B1D)" }} />
        {subtitle && <div className="mt-1 text-sm" style={{ color: TOKENS.muted }}>{subtitle}</div>}
      </div>
    </div>
    {children}
  </div>
);

// ring of the five time statuses + one line per status (count, share bar, %). Tall card: sits beside the history chart.
export const StatusDonut = ({ status }) => {
  const total = STATUS_KEYS.reduce((s, k) => s + status[k], 0);
  const R = 54;
  const C = 2 * Math.PI * R;
  const GAP = total > 1 ? 2 : 0; // a thin white gap between two segments
  let offset = 0;
  return (
    <div className="flex h-full flex-col justify-center px-5 py-5" style={CARD}>
      <div className="flex justify-center">
        <svg viewBox="0 0 140 140" className="h-40 w-40">
          <g transform="rotate(-90 70 70)">
            <circle cx="70" cy="70" r={R} fill="none" stroke="#EEF2F7" strokeWidth="16" />
            {total > 0 && STATUS_KEYS.map((k) => {
              const len = (status[k] / total) * C;
              const seg = (
                <circle
                  key={k} cx="70" cy="70" r={R} fill="none" stroke={STATUS_META[k].color} strokeWidth="16"
                  strokeDasharray={`${Math.max(0, len - GAP)} ${C - Math.max(0, len - GAP)}`} strokeDashoffset={-offset}
                />
              );
              offset += len;
              return status[k] > 0 ? seg : null;
            })}
          </g>
          <text x="70" y="70" textAnchor="middle" className="tabular-nums" style={{ ...FONT, fontSize: 34, fontWeight: 700, fill: STATUS_META.red.color }}>{status.red}</text>
          <text x="70" y="90" textAnchor="middle" style={{ ...FONT, fontSize: 12, fill: TOKENS.muted }}>{STATUS_META.red.label}</text>
        </svg>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {STATUS_KEYS.map((k) => {
          const pct = total ? Math.round((status[k] / total) * 100) : 0;
          return (
            <div key={k}>
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_META[k].color }} />
                <span className="truncate" style={{ color: TOKENS.muted }}>{STATUS_META[k].label}</span>
                <span className="ml-auto font-semibold tabular-nums" style={{ color: TOKENS.text }}>{status[k]}</span>
                <span className="w-10 text-right text-xs tabular-nums" style={{ color: TOKENS.muted }}>{pct}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "#EEF2F7" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STATUS_META[k].color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
