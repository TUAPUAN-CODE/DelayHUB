import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, Search } from "lucide-react";
import { fmtDate } from "./woFormat";

const API_URL = import.meta.env.VITE_API_URL;
const LIMIT = 100;

const WorkOrderList = ({ selectedId, onSelect }) => {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Debounced search; the previous request is aborted so a slow answer can't overwrite a newer one.
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_URL}/api/wo/fetchWorkOrders`, {
          params: { q: query.trim(), from: from || undefined, to: to || undefined, limit: LIMIT },
          signal: ctrl.signal,
        });
        setOrders(res.data.data ?? []);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("fetchWorkOrders error:", err);
        setError("โหลดรายการใบสั่งผลิตไม่สำเร็จ");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, from, to]);

  const countText = loading
    ? "กำลังค้นหา..."
    : orders.length >= LIMIT
      ? `${orders.length} รายการ (แสดง ${LIMIT} แรก)`
      : `${orders.length} รายการ`;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white">
      <div className="space-y-2 border-b border-slate-100 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาเลข WO / รหัสสินค้า / ลูกค้า"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          <span>-</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{countText}</span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <div className="p-4 text-sm text-red-600">{error}</div>}
        {!loading && !error && orders.length === 0 && <div className="p-6 text-center text-sm text-slate-400">ไม่พบใบสั่งผลิต</div>}
        {orders.map((o) => {
          const active = o.woId === selectedId;
          return (
            <button
              key={o.woId}
              onClick={() => onSelect(o.woId)}
              className={`block w-full border-b border-l-4 border-b-slate-50 px-4 py-3 text-left transition ${
                active ? "border-l-blue-600 bg-blue-50" : "border-l-transparent hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">{o.woNo}</span>
                <span className="text-xs text-slate-400">{fmtDate(o.prodDate)}</span>
              </div>
              <div className="mt-0.5 truncate text-xs text-slate-600">{o.productCode}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{o.customer || "ไม่ระบุลูกค้า"}</span>
                {o.market && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{o.market}</span>}
                {o.lineNo && <span className="text-slate-400">{o.lineNo}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WorkOrderList;
