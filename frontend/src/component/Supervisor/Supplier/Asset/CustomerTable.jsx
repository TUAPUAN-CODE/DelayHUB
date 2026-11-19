import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, Search } from "lucide-react";
import DataTable from "../../ProductRecipe/Asset/DataTable";
import { fmtDate, fmtInt } from "./supFormat";

const API_URL = import.meta.env.VITE_API_URL;

// Customers (WISEUP CRM_Client): how many products each has and how many production orders were made in the date range.
const CustomerTable = ({ range }) => {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_URL}/api/supplier/fetchCustomers`, {
          params: { q: query.trim() || undefined, from: range.from, to: range.to },
          signal: ctrl.signal,
        });
        setRows(res.data.data ?? []);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("fetchCustomers error:", err);
        setError(err.response?.data?.error || "โหลดข้อมูลลูกค้าไม่สำเร็จ");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, range.from, range.to]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหารหัส / ชื่อลูกค้า"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <span className="text-xs text-slate-400">{loading ? "กำลังค้นหา..." : `${rows.length} ราย`}</span>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {error ? (
          <div className="p-4 text-sm text-red-600">{error}</div>
        ) : (
          <DataTable
            columns={[
              { key: "id", label: "รหัสลูกค้า" },
              { key: "name", label: "ชื่อลูกค้า" },
              { key: "country", label: "ประเทศ" },
              { key: "products", label: "สินค้าทั้งหมด", align: "right" },
              { key: "orders", label: "ใบสั่งผลิตในช่วงนี้", align: "right" },
              { key: "produced", label: "สินค้าที่ผลิตในช่วงนี้", align: "right" },
              { key: "last", label: "ผลิตล่าสุด" },
            ]}
            rows={rows.map((c) => ({
              id: c.clientId,
              name: [c.name, c.abbreviation].filter(Boolean).join(" · ") || "-",
              country: c.countryCode || "-",
              products: fmtInt(c.products),
              orders: c.productionOrders ? <span className="font-semibold text-blue-700">{fmtInt(c.productionOrders)}</span> : "0",
              produced: fmtInt(c.productsProduced),
              last: fmtDate(c.lastProductionDate),
            }))}
            empty={loading ? "กำลังค้นหา..." : "ไม่พบลูกค้า"}
          />
        )}
      </div>
    </div>
  );
};

export default CustomerTable;
