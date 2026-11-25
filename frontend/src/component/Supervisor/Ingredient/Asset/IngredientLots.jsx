import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import DataTable from "../../ProductRecipe/Asset/DataTable";
import { fmtNum } from "../../Supplier/Asset/supFormat";
import RangeBar from "./RangeBar";

const API_URL = import.meta.env.VITE_API_URL;

const dt = (v) => (v ? String(v).slice(0, 16) : "-"); // SQL "yyyy-MM-dd HH:mm:ss" strings are plain local times, so they are cut, not run through Date

// "WO123/B1-5" · "WO123/B3" · "WO123" — same wording as the Traceback sheet
const woLabel = (r) => {
  const s = r.basketFrom;
  const e = r.basketTo ?? s;
  if (s === null || s === undefined) return r.woNo;
  return `${r.woNo}/B${s}${Number(s) === Number(e) ? "" : `-${e}`}`;
};

// Lots of PFCM that used this ingredient. The link is the WONo + basket range the packing staff type when they confirm a lot (PFCMv2.HistoryIngredientWO),
// matched with the baskets of that WO in WC that hold the ingredient. Typing the WONo is not required yet, so a lot without it is simply not listed.
const IngredientLots = ({ code, range, onRangeChange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_URL}/api/ingredient/fetchIngredientLots`, {
          params: { code, from: range.from, to: range.to },
          signal: ctrl.signal,
        });
        setData(res.data.data);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("fetchIngredientLots error:", err);
        setError(err.response?.data?.error || "โหลดข้อมูล lot ไม่สำเร็จ");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => ctrl.abort();
  }, [code, range.from, range.to]);

  const rows = data?.rows ?? [];
  const cov = data?.coverage;
  return (
    <div>
      <RangeBar label="ช่วงวันที่บันทึก WO" range={range} loading={loading} onRangeChange={onRangeChange} />
      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
      {cov && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>
            {`lot จะแสดงที่นี่เมื่อมีการกรอก WONo + Basket ในหน้ายืนยันบรรจุ — ตอนนี้ผูก WO ไว้แล้ว ${cov.linkedLots} lot${cov.latest ? ` (ล่าสุด ${String(cov.latest).slice(0, 10)})` : ""}`}
            {data.capped ? ` · อ่านรายการผูก WO ล่าสุด ${cov.scanned} รายการ เลือกช่วงวันที่ให้แคบลงเพื่อดูรายการอื่น` : ""}
          </span>
        </div>
      )}
      <DataTable
        columns={[
          { key: "linked", label: "บันทึก WO" },
          { key: "lot", label: "Lot", align: "right" },
          { key: "doc", label: "เลขแผน" },
          { key: "product", label: "สินค้า" },
          { key: "line", label: "ไลน์" },
          { key: "wo", label: "WO / ตะกร้า" },
          { key: "batches", label: "Batch ส่วนผสม" },
          { key: "baskets", label: "ตะกร้า", align: "right" },
          { key: "net", label: "น้ำหนักส่วนผสม (กก.)", align: "right" },
          { key: "pack", label: "บรรจุ" },
          { key: "trace", label: "" },
        ]}
        rows={rows.map((r) => ({
          linked: dt(r.linkedAt),
          lot: r.mappingId,
          doc: r.docNo || "-",
          product: r.productCode || "-",
          line: r.lineName || "-",
          wo: woLabel(r),
          batches: r.batches.length ? r.batches.join(", ") : "-",
          baskets: r.baskets,
          net: fmtNum(r.netWt, 2),
          pack: dt(r.packDate),
          trace: r.docNo ? (
            <Link className="whitespace-nowrap text-blue-600 hover:underline" to={`/sup/Traceback?doc_no=${encodeURIComponent(r.docNo)}&code=${encodeURIComponent(r.productCode || "")}`}>
              ใบสอบกลับ
            </Link>
          ) : null,
        }))}
        empty={loading ? "กำลังโหลด..." : "ไม่มี lot ที่ผูก WO และใช้ส่วนผสมนี้ในช่วงนี้"}
      />
    </div>
  );
};

export default IngredientLots;
