import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, Truck, X } from "lucide-react";
import { FailingTab, MaterialsTab, OverviewTab, ReceiptsTab, ResultsTab } from "./SupplierTabs";
import InspectionLotDialog from "./InspectionLotDialog";
import { fmtDate, fmtInt } from "./supFormat";

const API_URL = import.meta.env.VITE_API_URL;

const TABS = [
  { id: "overview", label: "ภาพรวม" },
  { id: "materials", label: "วัตถุดิบที่ส่ง", count: "materials" },
  { id: "receipts", label: "รายการรับเข้า" },
  { id: "results", label: "ผลตรวจรายหัวข้อ" },
  { id: "failing", label: "หัวข้อที่ไม่ผ่านบ่อย" },
];

const SupplierDetail = ({ supplierId, range }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [material, setMaterial] = useState("");
  const [openLot, setOpenLot] = useState(null);

  useEffect(() => {
    setMaterial("");
  }, [supplierId]);

  useEffect(() => {
    if (!supplierId) return undefined;
    const ctrl = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      setDetail(null);
      try {
        const res = await axios.get(`${API_URL}/api/supplier/fetchSupplierDetail`, {
          params: { supplierId, from: range.from, to: range.to },
          signal: ctrl.signal,
        });
        setDetail(res.data.data);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("fetchSupplierDetail error:", err);
        setError(err.response?.data?.error || "โหลดข้อมูลผู้ขายไม่สำเร็จ");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => ctrl.abort();
  }, [supplierId, range.from, range.to]);

  const pickMaterial = (code) => {
    setMaterial(code);
    setTab("receipts");
  };

  if (!supplierId) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400">
        <Truck className="mb-3 h-12 w-12" />
        เลือกผู้ขายทางซ้ายเพื่อดูรายละเอียด
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-200 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!detail) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-red-600">{error || "ไม่พบข้อมูล"}</div>;
  }

  const h = detail.header || {};
  const s = detail.stats || {};
  const counts = { materials: detail.materials.length };
  const materialName = material && detail.materials.find((m) => m.materialCode === material)?.descriptionEN;
  const showMaterialFilter = tab === "receipts" || tab === "results";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl font-bold text-slate-900">{h.name || h.receiptName || supplierId}</h2>
          <span className="text-sm text-slate-500">{supplierId}</span>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          {`${fmtDate(range.from)} - ${fmtDate(range.to)} · รับเข้า ${fmtInt(s.grLines)} บรรทัด · วัตถุดิบ ${fmtInt(s.materials)} ชนิด`}
        </p>
        <div className="-mb-5 mt-4 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition ${
                tab === t.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
              {t.count && counts[t.count] ? <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{counts[t.count].toLocaleString()}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 p-5">
        {showMaterialFilter && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">วัตถุดิบ</span>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="max-w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="">ทั้งหมด</option>
              {detail.materials.map((m) => (
                <option key={`${m.materialCode}-${m.unit}`} value={m.materialCode}>
                  {[m.materialCode, m.descriptionEN].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
            {material && (
              <button onClick={() => setMaterial("")} className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                {materialName || material}
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
        {tab === "overview" && <OverviewTab detail={detail} />}
        {tab === "materials" && <MaterialsTab detail={detail} onPickMaterial={pickMaterial} />}
        {tab === "receipts" && <ReceiptsTab supplierId={supplierId} range={range} material={material} onOpenLot={setOpenLot} />}
        {tab === "results" && <ResultsTab supplierId={supplierId} range={range} material={material} onOpenLot={setOpenLot} />}
        {tab === "failing" && <FailingTab detail={detail} />}
      </div>

      {openLot && <InspectionLotDialog lot={openLot} onClose={() => setOpenLot(null)} />}
    </div>
  );
};

export default SupplierDetail;
