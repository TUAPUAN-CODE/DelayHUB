import { useEffect, useState } from "react";
import axios from "axios";
import { ClipboardList, Loader2 } from "lucide-react";
import { ExtrasTab, FormulaTab, InspectTab, OverviewTab, WeightsTab } from "./WoSections";
import BasketsTab from "./BasketsTab";
import { countsOf, fmtDate } from "./woFormat";

const API_URL = import.meta.env.VITE_API_URL;

const TABS = [
  { id: "overview", label: "ภาพรวม" },
  { id: "formula", label: "สูตร / ลำดับผสม" },
  { id: "baskets", label: "ตะกร้า / Batch", count: "baskets" },
  { id: "extras", label: "สารละลาย / Topping" },
  { id: "weights", label: "น้ำหนัก / รายชั่วโมง" },
  { id: "inspect", label: "ตรวจสอบ / ประวัติ" },
];

const WorkOrderDetail = ({ woId }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (!woId) return undefined;
    const ctrl = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      setDetail(null);
      try {
        const res = await axios.get(`${API_URL}/api/wo/fetchWorkOrderDetail`, { params: { woId }, signal: ctrl.signal });
        setDetail(res.data.data);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("fetchWorkOrderDetail error:", err);
        setError("โหลดข้อมูลใบสั่งผลิตไม่สำเร็จ");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => ctrl.abort();
  }, [woId]);

  if (!woId) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400">
        <ClipboardList className="mb-3 h-12 w-12" />
        เลือกใบสั่งผลิตทางซ้ายเพื่อดูรายละเอียด
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

  const h = detail.header[0];
  const counts = countsOf(detail.overview);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl font-bold text-slate-900">{h.woNo}</h2>
          <span className="text-sm text-slate-500">{h.productCode}</span>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          {[h.customer, h.market, h.lineNo, fmtDate(h.prodDate)].filter(Boolean).join(" · ")}
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
        {tab === "overview" && <OverviewTab detail={detail} />}
        {tab === "formula" && <FormulaTab detail={detail} />}
        {tab === "baskets" && <BasketsTab key={woId} woId={woId} detail={detail} />}
        {tab === "extras" && <ExtrasTab detail={detail} />}
        {tab === "weights" && <WeightsTab detail={detail} />}
        {tab === "inspect" && <InspectTab detail={detail} />}
      </div>
    </div>
  );
};

export default WorkOrderDetail;
