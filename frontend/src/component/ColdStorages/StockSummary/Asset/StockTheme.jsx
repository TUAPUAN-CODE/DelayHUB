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

export const SectionTitle = ({ icon: Icon, title, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: TOKENS.primarySoft, color: TOKENS.primary }}>
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <h2 className="text-lg font-semibold" style={{ color: TOKENS.text }}>{title}</h2>
    </div>
    {children}
  </div>
);

// ring of the five time statuses + a legend with share bars
export const StatusDonut = ({ status, title }) => {
  const total = STATUS_KEYS.reduce((s, k) => s + status[k], 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="p-4" style={CARD}>
      <div className="mb-3 text-sm" style={{ color: TOKENS.muted }}>{title}</div>
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0">
          <g transform="rotate(-90 70 70)">
            <circle cx="70" cy="70" r={R} fill="none" stroke="#EEF2F7" strokeWidth="14" />
            {total > 0 && STATUS_KEYS.map((k) => {
              const len = (status[k] / total) * C;
              const seg = (
                <circle
                  key={k} cx="70" cy="70" r={R} fill="none" stroke={STATUS_META[k].color} strokeWidth="14"
                  strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
                />
              );
              offset += len;
              return status[k] > 0 ? seg : null;
            })}
          </g>
          <text x="70" y="70" textAnchor="middle" className="tabular-nums" style={{ ...FONT, fontSize: 28, fontWeight: 600, fill: STATUS_META.red.color }}>{status.red}</text>
          <text x="70" y="90" textAnchor="middle" style={{ ...FONT, fontSize: 11, fill: TOKENS.muted }}>{STATUS_META.red.label}</text>
        </svg>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {STATUS_KEYS.map((k) => {
            const pct = total ? Math.round((status[k] / total) * 100) : 0;
            return (
              <div key={k} className="rounded-xl px-3 py-2" style={{ backgroundColor: "#F7F9FE", border: `1px solid ${TOKENS.border}` }}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2" style={{ color: TOKENS.muted }}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_META[k].color }} />
                    {STATUS_META[k].label}
                  </span>
                  <span className="font-semibold tabular-nums" style={{ color: TOKENS.text }}>{status[k]}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STATUS_META[k].color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
