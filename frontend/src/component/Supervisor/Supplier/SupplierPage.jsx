import { useState } from "react";
import Buttom from "../../Layout/Buttom";
import SupplierList from "./Asset/SupplierList";
import SupplierDetail from "./Asset/SupplierDetail";
import CustomerTable from "./Asset/CustomerTable";
import { lastDays } from "./Asset/supFormat";

// /sup/Supplier — suppliers from WISEUP: what each one delivered, every goods receipt, the incoming inspection result of each lot
// (decision + every characteristic) and which characteristics fail most; plus a customer summary. Data: /api/supplier (read-only).
const QUICK_RANGES = [
  { days: 30, label: "30 วัน" },
  { days: 90, label: "90 วัน" },
  { days: 180, label: "180 วัน" },
  { days: 365, label: "1 ปี" },
];

const SupplierPage = () => {
  const [mode, setMode] = useState("supplier");
  const [range, setRange] = useState(() => lastDays(90));
  const [supplierId, setSupplierId] = useState(null);

  const setDay = (key) => (e) => {
    const value = e.target.value;
    if (value) setRange((r) => ({ ...r, [key]: value }));
  };

  return (
    <div style={{ backgroundColor: "#f8fafc" }} className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
      <main className="max-w-8xl mx-auto w-full px-1 pt-2 lg:px-8">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
            {[
              ["supplier", "ผู้ขาย (Supplier)"],
              ["customer", "ลูกค้า (Customer)"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${mode === id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>ช่วงวันที่</span>
            <input type="date" value={range.from} max={range.to} onChange={setDay("from")} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            <span>-</span>
            <input type="date" value={range.to} min={range.from} onChange={setDay("to")} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK_RANGES.map((q) => (
              <button
                key={q.days}
                onClick={() => setRange(lastDays(q.days))}
                className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700"
              >
                {q.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-slate-400">ข้อมูลจาก WISEUP (อ่านอย่างเดียว)</span>
        </div>
      </main>

      {mode === "supplier" ? (
        <main className="max-w-8xl mx-auto grid min-h-0 w-full flex-1 grid-cols-1 gap-3 px-1 pb-1 pt-2 lg:grid-cols-[360px_1fr] lg:px-8">
          <div className="min-h-0 max-h-[40vh] lg:max-h-none">
            <SupplierList range={range} selectedId={supplierId} onSelect={setSupplierId} />
          </div>
          <div className="min-h-0">
            <SupplierDetail supplierId={supplierId} range={range} />
          </div>
        </main>
      ) : (
        <main className="max-w-8xl mx-auto min-h-0 w-full flex-1 px-1 pb-1 pt-2 lg:px-8">
          <CustomerTable range={range} />
        </main>
      )}

      <main className="max-w-8xl mx-auto w-full px-1 pb-1 lg:px-8">
        <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
      </main>
    </div>
  );
};

export default SupplierPage;
