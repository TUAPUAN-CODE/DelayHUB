import { useEffect, useState } from "react";
import axios from "axios";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import DataTable from "../../ProductRecipe/Asset/DataTable";
import { fmtDateTime, fmtNum, mixTypeLabel } from "./woFormat";

const API_URL = import.meta.env.VITE_API_URL;
const PAGE = 100;

const summaryColumns = [
  { key: "mix", label: "ประเภท" },
  { key: "state", label: "สถานะ", align: "center" },
  { key: "baskets", label: "ตะกร้า", align: "right" },
  { key: "range", label: "เลขที่", align: "center" },
  { key: "mixSpan", label: "ผสม (เริ่ม – จบ)" },
  { key: "packSpan", label: "บรรจุ (เริ่ม – จบ)" },
];

const batchColumns = [
  { key: "ingdntCode", label: "รหัส" },
  { key: "ingdntName", label: "วัตถุดิบ" },
  { key: "batchNo", label: "Batch" },
  { key: "rawMat", label: "Raw material" },
  { key: "baskets", label: "ตะกร้า", align: "right" },
  { key: "totalNetWt", label: "น้ำหนักรวม", align: "right" },
  { key: "span", label: "ผสม (แรก – ล่าสุด)" },
];

const detailColumns = [
  { key: "basketNumber", label: "ตะกร้า", align: "center" },
  { key: "ingdntCode", label: "รหัส" },
  { key: "ingdntName", label: "วัตถุดิบ" },
  { key: "batchNo", label: "Batch" },
  { key: "rawMat", label: "Raw material" },
  { key: "std", label: "Std", align: "right" },
  { key: "netWt", label: "จริง", align: "right" },
  { key: "mixingTime", label: "เวลาผสม" },
];

const span = (a, b) => (a || b ? `${fmtDateTime(a)} – ${fmtDateTime(b)}` : "-");

const BasketsTab = ({ woId, detail }) => {
  const mixTypes = [...new Set(detail.basketSummary.map((s) => s.mixType))].sort((a, b) => a - b);
  const [mixType, setMixType] = useState(mixTypes[0] ?? null);
  const [from, setFrom] = useState(1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const total = detail.basketSummary.filter((s) => s.mixType === mixType).reduce((n, s) => n + s.baskets, 0);

  useEffect(() => {
    if (mixType === null) return undefined;
    const ctrl = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_URL}/api/wo/fetchWorkOrderBaskets`, { params: { woId, from, count: PAGE, mixType }, signal: ctrl.signal });
        setRows(res.data.data ?? []);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("fetchWorkOrderBaskets error:", err);
        setError("โหลดรายละเอียดตะกร้าไม่สำเร็จ");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => ctrl.abort();
  }, [woId, mixType, from]);

  if (!detail.basketSummary.length) {
    return <DataTable columns={[]} rows={[]} empty="ใบสั่งผลิตนี้ยังไม่มีตะกร้า" />;
  }

  const pickMix = (t) => {
    setMixType(t);
    setFrom(1);
  };
  const lastShown = Math.min(from + PAGE - 1, total);

  return (
    <>
      <div className="mb-6">
        <h4 className="mb-2 text-sm font-semibold text-slate-700">สรุปตะกร้า</h4>
        <DataTable
          columns={summaryColumns}
          rows={detail.basketSummary.map((s) => ({
            mix: mixTypeLabel(s.mixType), state: s.basketState, baskets: s.baskets.toLocaleString(), range: `${s.firstNo} – ${s.lastNo}`,
            mixSpan: span(s.firstMixStart, s.lastMixEnd), packSpan: span(s.firstPackStart, s.lastPackEnd),
          }))}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {mixTypes.map((t) => (
          <button
            key={t}
            onClick={() => pickMix(t)}
            className={`rounded-full border px-3 py-1 text-sm transition ${t === mixType ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {mixTypeLabel(t)}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <h4 className="mb-2 text-sm font-semibold text-slate-700">วัตถุดิบ × Batch ที่ใช้</h4>
        <DataTable
          columns={batchColumns}
          rows={detail.ingredientBatches
            .filter((b) => b.mixType === mixType)
            .map((b) => ({
              ingdntCode: b.ingdntCode || "-", ingdntName: b.ingdntName || "-", batchNo: b.batchNo || "-",
              rawMat: [b.rawMatCode, b.rawMatBatchNo].filter(Boolean).join(" · ") || "-", baskets: b.baskets.toLocaleString(),
              totalNetWt: fmtNum(b.totalNetWt, 3), span: span(b.firstMix, b.lastMix),
            }))}
          empty="ยังไม่มีการบันทึกวัตถุดิบ"
        />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-700">รายละเอียดรายตะกร้า</h4>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{`ตะกร้าที่ ${from}–${lastShown} จาก ${total.toLocaleString()}`}</span>
            <button
              disabled={from <= 1 || loading}
              onClick={() => setFrom((f) => Math.max(1, f - PAGE))}
              className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40"
              aria-label="ก่อนหน้า"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={from + PAGE > total || loading}
              onClick={() => setFrom((f) => f + PAGE)}
              className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40"
              aria-label="ถัดไป"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        {error && <div className="mb-2 text-sm text-red-600">{error}</div>}
        <DataTable
          columns={detailColumns}
          rows={rows.map((r) => ({
            basketNumber: r.basketNumber, ingdntCode: r.ingdntCode || "-", ingdntName: r.ingdntName || "-", batchNo: r.batchNo || "-",
            rawMat: [r.rawMatCode, r.rawMatBatchNo].filter(Boolean).join(" · ") || "-", std: fmtNum(r.stdWt, 3), netWt: fmtNum(r.netWt, 3), mixingTime: fmtDateTime(r.mixingTime),
          }))}
          empty="ยังไม่มีการบันทึกวัตถุดิบรายตะกร้า"
        />
      </div>
    </>
  );
};

export default BasketsTab;
