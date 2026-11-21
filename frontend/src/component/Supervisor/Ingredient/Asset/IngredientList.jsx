import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, Search, StickyNote } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;
const LIMIT = 300;

// Every ingredient used in a recipe (TunaCodeIngredients), with the number of products that use it and the alias the Supervisor gave it.
const IngredientList = ({ version, selectedCode, onSelect }) => {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Debounced search; the previous request is aborted so a slow answer can't overwrite a newer one.
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_URL}/api/ingredient/fetchIngredients`, {
          params: { q: query.trim() || undefined, limit: LIMIT },
          signal: ctrl.signal,
        });
        setRows(res.data.data ?? []);
        setTotal(res.data.total ?? 0);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("fetchIngredients error:", err);
        setError(err.response?.data?.error || "โหลดรายการส่วนผสมไม่สำเร็จ");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, version]);

  const countText = loading
    ? "กำลังค้นหา..."
    : total > rows.length
      ? `${total} รายการ (แสดง ${rows.length} แรก)`
      : `${total} รายการ`;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white">
      <div className="space-y-2 border-b border-slate-100 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหารหัส / ชื่อ / ชื่อเรียกส่วนผสม"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{countText}</span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <div className="p-4 text-sm text-red-600">{error}</div>}
        {!loading && !error && rows.length === 0 && <div className="p-6 text-center text-sm text-slate-400">ไม่พบส่วนผสม</div>}
        {rows.map((i) => {
          const active = i.ingdntCode === selectedCode;
          return (
            <button
              key={i.ingdntCode}
              onClick={() => onSelect(i.ingdntCode)}
              className={`block w-full border-b border-l-4 border-b-slate-50 px-4 py-3 text-left transition ${
                active ? "border-l-blue-600 bg-blue-50" : "border-l-transparent hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-slate-800">{i.alias_name || i.ingdntName || i.ingdntCode}</span>
                {(i.alias_name || i.remark) && <StickyNote className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
              </div>
              <div className="mt-0.5 truncate text-xs text-slate-500">{[i.ingdntCode, i.alias_name ? i.ingdntName : null].filter(Boolean).join(" · ")}</div>
              <div className="mt-1 text-xs">
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">{`ใช้ใน ${i.productCount} สินค้า`}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default IngredientList;
