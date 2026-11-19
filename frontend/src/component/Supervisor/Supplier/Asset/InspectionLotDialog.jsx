import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, X } from "lucide-react";
import DataTable from "../../ProductRecipe/Asset/DataTable";
import DecisionBadge from "./DecisionBadge";
import { TONE_CLASS, fmtDate, fmtDateTime, fmtNum, resultTone } from "./supFormat";

const API_URL = import.meta.env.VITE_API_URL;

const Info = ({ label, value }) => (
  <div>
    <div className="text-xs text-slate-500">{label}</div>
    <div className="break-words text-sm font-semibold text-slate-800">{value || "-"}</div>
  </div>
);

// One inspection lot: header, released / blocked quantities and every characteristic.
// Closes only from its own button (no backdrop click / Esc), like the other dialogs of the system.
const InspectionLotDialog = ({ lot, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      setData(null);
      setError("");
      try {
        const res = await axios.get(`${API_URL}/api/supplier/fetchInspectionLot`, { params: { lot }, signal: ctrl.signal });
        setData(res.data.data);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("fetchInspectionLot error:", err);
        setError(err.response?.data?.error || "โหลดข้อมูล Inspection Lot ไม่สำเร็จ");
      }
    };
    load();
    return () => ctrl.abort();
  }, [lot]);

  const h = data?.header;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-lg font-bold text-slate-900">{`Inspection Lot ${lot}`}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="ปิด">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error && <div className="text-sm text-red-600">{error}</div>}
          {!data && !error && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          )}
          {h && (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Info label="วัตถุดิบ" value={[h.materialCode, h.materialName].filter(Boolean).join(" · ")} />
                <Info label="Batch" value={h.batch} />
                <Info label="ผู้ขาย" value={[h.supplierId, h.supplierName].filter(Boolean).join(" · ")} />
                <Info label="PO" value={h.poNumber ? `${h.poNumber}/${h.poLine ?? ""}` : ""} />
                <Info label="วันที่รับ" value={fmtDate(h.receivedDate)} />
                <Info label="จำนวน" value={`${fmtNum(h.quantity, 3)} ${h.unit || ""}`} />
                <Info label="สร้าง Lot เมื่อ" value={fmtDateTime(h.createdDate)} />
                <Info label="ตัดสินเมื่อ" value={fmtDateTime(h.udDate)} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-500">ผลตัดสิน</span>
                <DecisionBadge code={h.udCode} description={h.udDescription} ar={h.udAR} />
                {h.remark && <span className="text-slate-500">{h.remark}</span>}
              </div>

              <h4 className="mb-2 mt-6 text-sm font-semibold text-slate-700">จำนวนที่ปล่อย / กัก</h4>
              <DataTable
                columns={[
                  { key: "item", label: "#", align: "center" },
                  { key: "reference", label: "อ้างอิง" },
                  { key: "released", label: "ปล่อย", align: "right" },
                  { key: "blocked", label: "กัก", align: "right" },
                  { key: "unit", label: "หน่วย" },
                  { key: "plan", label: "แผนตรวจ" },
                  { key: "closed", label: "ปิดเมื่อ" },
                ]}
                rows={data.points.map((p) => ({
                  item: p.item,
                  reference: p.reference || "-",
                  released: fmtNum(p.releasedQty, 3),
                  blocked: p.blockedQty ? <span className="font-semibold text-red-600">{fmtNum(p.blockedQty, 3)}</span> : "0",
                  unit: p.unit || "-",
                  plan: p.inspectionPlan || "-",
                  closed: fmtDateTime(p.closed),
                }))}
                empty="ไม่มีข้อมูลจุดตรวจ"
              />

              <h4 className="mb-2 mt-6 text-sm font-semibold text-slate-700">ผลตรวจรายหัวข้อ</h4>
              <DataTable
                columns={[
                  { key: "feature", label: "หัวข้อตรวจ" },
                  { key: "limits", label: "ต่ำสุด / เป้า / สูงสุด", align: "right" },
                  { key: "value", label: "ค่าที่วัด", align: "right" },
                  { key: "result", label: "ผล" },
                  { key: "remark", label: "หมายเหตุ" },
                ]}
                rows={data.features.map((f) => ({
                  feature: (
                    <div>
                      <div>{f.characteristicTH || f.characteristic || f.featureCode}</div>
                      <div className="text-xs text-slate-400">{[f.featureCode, f.workCenter, f.unit].filter(Boolean).join(" · ")}</div>
                    </div>
                  ),
                  limits: [f.lowerLimit, f.target, f.upperLimit].some((v) => v !== null && v !== undefined)
                    ? [f.lowerLimit, f.target, f.upperLimit].map((v) => (v === null || v === undefined ? "-" : fmtNum(v, 3))).join(" / ")
                    : "-",
                  value: f.measuredValue || "-",
                  result: f.resultText ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${TONE_CLASS[resultTone(f.resultAR)]}`}>{f.resultText}</span>
                  ) : (
                    "-"
                  ),
                  remark: f.remark || "",
                }))}
                empty="ไม่มีผลตรวจ"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InspectionLotDialog;
