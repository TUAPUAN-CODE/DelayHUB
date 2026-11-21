import React, { useEffect, useRef, useState } from "react";
import { STATUS_KEYS, STATUS_META } from "./buildStockSummary";

// Look of the stock summary page: a dark "control room" band on top, light cards below.
export const FONT = { fontFamily: "Prompt, Kanit, sans-serif" };
export const INK = "#0B1B3F";
export const ACCENT = "#22D3EE";

export const HERO_BG = {
  backgroundColor: INK,
  backgroundImage: [
    "radial-gradient(900px 260px at 0% 0%, rgba(34,211,238,0.28), transparent 60%)",
    "radial-gradient(700px 300px at 100% 100%, rgba(99,102,241,0.35), transparent 60%)",
    "linear-gradient(135deg, #0B1B3F 0%, #12306A 55%, #1D4ED8 100%)",
  ].join(","),
};
// thin digital grid over the band, fading out to the right
export const GRID_BG = {
  backgroundImage: "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
  WebkitMaskImage: "linear-gradient(90deg, #000 0%, rgba(0,0,0,0.35) 70%, transparent 100%)",
  maskImage: "linear-gradient(90deg, #000 0%, rgba(0,0,0,0.35) 70%, transparent 100%)",
};

// keyframes used by the page (fade in, soft glow of overdue trolleys)
export const PageKeyframes = () => (
  <style>{`
    @keyframes ss-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    @keyframes ss-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.0); } 50% { box-shadow: 0 0 0 4px rgba(220,38,38,0.18); } }
    .ss-rise { animation: ss-rise .45s ease-out both; }
    .ss-glow { animation: ss-glow 2s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .ss-rise, .ss-glow { animation: none; } }
  `}</style>
);

// number that counts up to its value (600 ms) — the "digital" feel of the counters
export const useCountUp = (value, duration = 600) => {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = Number(value) || 0;
    let raf = 0;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(a + (b - a) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return shown;
};

export const LiveClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right leading-none">
      <div
        className="text-3xl sm:text-4xl font-semibold tabular-nums tracking-wider text-white"
        style={{ textShadow: "0 0 18px rgba(34,211,238,0.55)" }}
      >
        {now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
      </div>
      <div className="mt-1 text-xs text-cyan-100/80">
        {now.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );
};

// glass card inside the dark band
// display: text shown as is (no count-up), for values that are not one number
export const GlassKpi = ({ icon: Icon, label, value = 0, display, format = (v) => Math.round(v).toLocaleString("th-TH"), unit, sub, accent, delay = 0 }) => {
  const n = useCountUp(value);
  return (
    <div
      className="ss-rise relative overflow-hidden rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 text-sm text-white/75">
        <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ backgroundColor: `${accent}33`, color: accent }}>
          <Icon size={18} strokeWidth={2.2} />
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tabular-nums text-white">{display ?? format(n)}</span>
        {unit && <span className="text-sm text-white/70">{unit}</span>}
      </div>
      {sub && <div className="mt-1 truncate text-xs text-white/65">{sub}</div>}
      <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
    </div>
  );
};

// segmented control on the dark band
export const SegmentSwitch = ({ value, options, onChange }) => (
  <div className="inline-flex rounded-full border border-white/20 bg-white/10 p-1 backdrop-blur">
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3.5 py-1.5 text-sm transition ${active ? "bg-white font-semibold shadow" : "text-white/80 hover:bg-white/10"}`}
          style={active ? { color: INK } : undefined}
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
      <span className="grid h-9 w-9 place-items-center rounded-xl text-white shadow" style={{ background: `linear-gradient(135deg, ${INK}, #1D4ED8)` }}>
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <h2 className="text-lg font-semibold" style={{ color: INK }}>{title}</h2>
    </div>
    {children}
  </div>
);

// donut of the five time statuses + a legend with share bars
export const StatusDonut = ({ status, title }) => {
  const total = STATUS_KEYS.reduce((s, k) => s + status[k], 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="ss-rise rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm text-slate-500">{title}</div>
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0">
          <g transform="rotate(-90 70 70)">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#EEF2F7" strokeWidth="16" />
          {total > 0 && STATUS_KEYS.map((k) => {
            const len = (status[k] / total) * C;
            const seg = (
              <circle
                key={k} cx="70" cy="70" r={R} fill="none" stroke={STATUS_META[k].color} strokeWidth="16"
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
                style={{ transition: "stroke-dasharray .6s ease, stroke-dashoffset .6s ease" }}
              />
            );
            offset += len;
            return status[k] > 0 ? seg : null;
          })}
          </g>
          <g>
            <text x="70" y="68" textAnchor="middle" className="tabular-nums" style={{ ...FONT, fontSize: 30, fontWeight: 600, fill: STATUS_META.red.color }}>{status.red}</text>
            <text x="70" y="88" textAnchor="middle" style={{ ...FONT, fontSize: 11, fill: "#64748B" }}>{STATUS_META.red.label}</text>
          </g>
        </svg>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {STATUS_KEYS.map((k) => {
            const pct = total ? Math.round((status[k] / total) * 100) : 0;
            return (
              <div key={k} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_META[k].color }} />
                    {STATUS_META[k].label}
                  </span>
                  <span className="font-semibold tabular-nums" style={{ color: INK }}>{status[k]}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STATUS_META[k].color, transition: "width .6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
