import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, Search } from "lucide-react";
import { fmtDate, fmtInt } from "./supFormat";

const API_URL = import.meta.env.VITE_API_URL;
const LIMIT = 300;

// Suppliers that delivered (goods receipt, movement 101) in the chosen date range, most receipt lines first.
const SupplierList = ({ range, selectedId, onSelect }) => {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Debounced search; the previous request is aborted so a slow answer can't overwrite a newer one.
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_URL}/api/supplier/fetchSuppliers`, {
          params: { q: query.trim() || undefined, from: range.from, to: range.to, limit: LIMIT },
          signal: ctrl.signal,
        });
        setRows(res.data.data ?? []);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("fetchSuppliers error:", err);
        setError(err.response?.data?.error || "โหลดรายชื่อผู้ขายไม่สำเร็จ");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, range.from, range.to]);

  const countText = loading
    ? "กำลังค้นหา..."
    : rows.length >= LIMIT
      ? `${rows.length} ราย (แสดง ${LIMIT} แรก)`
      : `${rows.length} ราย`;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white">
      <div className="space-y-2 border-b border-slate-100 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหารหัส / ชื่อผู้ขาย"
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
        {!loading && !error && rows.length === 0 && <div className="p-6 text-center text-sm text-slate-400">ไม่พบผู้ขายที่ส่งของในช่วงนี้</div>}
        {rows.map((s) => {
          const active = s.supplierId === selectedId;
          return (
            <button
              key={s.supplierId}
              onClick={() => onSelect(s.supplierId)}
              className={`block w-full border-b border-l-4 border-b-slate-50 px-4 py-3 text-left transition ${
                active ? "border-l-blue-600 bg-blue-50" : "border-l-transparent hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-slate-800">{s.name || s.supplierId}</span>
                <span className="shrink-0 text-xs text-slate-400">{fmtDate(s.lastReceipt)}</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{s.supplierId}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">รับเข้า {fmtInt(s.grLines)}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">วัตถุดิบ {fmtInt(s.materials)}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">PO {fmtInt(s.purchaseOrders)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SupplierList;
