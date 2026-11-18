import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, Search } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

const ProductList = ({ selectedId, onSelect }) => {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Debounced search; the previous request is aborted so a slow answer can't overwrite a newer one.
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_URL}/api/recipe/fetchProducts`, { params: { q: query.trim() }, signal: ctrl.signal });
        setProducts(res.data.data ?? []);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("fetchProducts error:", err);
        setError("โหลดรายการสินค้าไม่สำเร็จ");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const countText = loading ? "กำลังค้นหา..." : `${products.length} รายการ`;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหารหัสสินค้า / ลูกค้า / ตลาด"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>{countText}</span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <div className="p-4 text-sm text-red-600">{error}</div>}
        {!loading && !error && products.length === 0 && <div className="p-6 text-center text-sm text-slate-400">ไม่พบสินค้า</div>}
        {products.map((p) => {
          const active = p.codeId === selectedId;
          return (
            <button
              key={p.codeId}
              onClick={() => onSelect(p.codeId)}
              className={`block w-full border-b border-l-4 border-b-slate-50 px-4 py-3 text-left transition ${
                active ? "border-l-blue-600 bg-blue-50" : "border-l-transparent hover:bg-slate-50"
              }`}
            >
              <div className="truncate text-sm font-semibold text-slate-800">{p.productCode}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{p.customer || "ไม่ระบุลูกค้า"}</span>
                {p.market && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{p.market}</span>}
                {p.package && <span className="text-slate-400">{p.package}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProductList;
