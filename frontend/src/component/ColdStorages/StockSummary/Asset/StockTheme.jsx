import React from "react";
import { TOKENS, GLASS } from "../../../../theme/dochubTheme";

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
