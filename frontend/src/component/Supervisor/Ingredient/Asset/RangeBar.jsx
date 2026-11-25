import { Loader2 } from "lucide-react";
import { lastDays } from "../../Supplier/Asset/supFormat";

const QUICK_RANGES = [
  { days: 7, label: "7 วัน" },
  { days: 14, label: "14 วัน" },
  { days: 31, label: "31 วัน" },
];

// Date range of the mixing time (at most 31 days — the API refuses more); shared by the usage and the batch / supplier tabs.
const RangeBar = ({ range, loading, onRangeChange }) => {
  const setDay = (key) => (e) => {
    const value = e.target.value;
    if (value) onRangeChange({ ...range, [key]: value });
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
      <span className="text-slate-500">ช่วงวันที่ผสม</span>
      <input type="date" value={range.from} max={range.to} onChange={setDay("from")} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
      <span className="text-slate-500">-</span>
      <input type="date" value={range.to} min={range.from} onChange={setDay("to")} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
      <div className="flex flex-wrap gap-1">
        {QUICK_RANGES.map((q) => (
          <button
            key={q.days}
            onClick={() => onRangeChange(lastDays(q.days))}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700"
          >
            {q.label}
          </button>
        ))}
      </div>
      {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
    </div>
  );
};

export default RangeBar;
