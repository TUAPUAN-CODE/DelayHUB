import { useEffect, useState } from "react";
import axios from "axios";
import { AlertTriangle } from "lucide-react";
import DataTable from "../../ProductRecipe/Asset/DataTable";
import { fmtNum } from "../../Supplier/Asset/supFormat";
import RangeBar from "./RangeBar";

const API_URL = import.meta.env.VITE_API_URL;

const day = (v) => (v ? String(v).slice(0, 10) : "-"); // SQL "yyyy-MM-dd HH:mm:ss" strings are plain local times, so they are cut, not run through Date

// Which Batch of the ingredient was used in the range (WC), and who supplied it / when it was received / when it expires (WISEUP, matched by Batch).
// A Batch that WISEUP does not know (small ingredients may not go through goods receipt) is kept and marked.
const IngredientBatches = ({ code, range, onRangeChange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_URL}/api/ingredient/fetchIngredientBatches`, {
          params: { code, from: range.from, to: range.to },
          signal: ctrl.signal,
        });
        setData(res.data.data);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("fetchIngredientBatches error:", err);
        setError(err.response?.data?.error || "โหลดข้อมูล Batch ไม่สำเร็จ");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => ctrl.abort();
  }, [code, range.from, range.to]);

  const rows = data?.rows ?? [];
  return (
    <div>
      <RangeBar range={range} loading={loading} onRangeChange={onRangeChange} />
      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
      {data?.wiseupError && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{`${data.wiseupError} — แสดงเฉพาะ Batch จาก WC ยังไม่มีข้อมูลผู้ขาย`}</span>
        </div>
      )}
      {data && !data.wiseupError && (
        <div className="mb-2 text-xs text-slate-500">
          {`พบข้อมูลรับเข้าใน WISEUP ${data.summary.found} จาก ${data.summary.batches} Batch`}
          {data.capped ? ` · แสดง ${data.summary.batches} Batch ล่าสุด เลือกช่วงวันที่ให้แคบลงเพื่อดูรายการอื่น` : ""}
        </div>
      )}
      <DataTable
        columns={[
          { key: "batch", label: "Batch" },
          { key: "supplier", label: "ผู้ขาย" },
          { key: "received", label: "วันรับเข้า" },
          { key: "qty", label: "ปริมาณรับ", align: "right" },
          { key: "made", label: "วันที่ผลิต" },
          { key: "expiry", label: "หมดอายุ" },
          { key: "wo", label: "WO", align: "right" },
          { key: "weighings", label: "ชั่ง (ครั้ง)", align: "right" },
          { key: "net", label: "น้ำหนักรวม (กก.)", align: "right" },
          { key: "last", label: "ผสมล่าสุด" },
        ]}
        rows={rows.map((r) => ({
          batch: r.batchNo,
          supplier: r.found ? [r.supplierName, r.supplierCode].filter(Boolean).join(" · ") || "-" : data.wiseupError ? "-" : <span className="text-slate-400">ไม่พบใน WISEUP</span>, // WISEUP unreachable = unknown, not "not found"
          received: day(r.receiveFirst),
          qty: r.receiveQty == null ? "-" : `${fmtNum(r.receiveQty, 2)} ${r.receiveUnit || ""}`.trim(),
          made: day(r.batchDate),
          expiry: day(r.expirationDate),
          wo: r.workOrders,
          weighings: r.weighings,
          net: fmtNum(r.totalNetWt, 2),
          last: String(r.lastMix || "-").slice(0, 16),
        }))}
        empty={loading ? "กำลังโหลด..." : "ไม่มี Batch ของส่วนผสมนี้ในช่วงนี้"}
      />
    </div>
  );
};

export default IngredientBatches;
