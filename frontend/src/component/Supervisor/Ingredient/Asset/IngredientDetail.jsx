import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { AlertTriangle, FlaskConical, Loader2, Save } from "lucide-react";
import DataTable from "../../ProductRecipe/Asset/DataTable";
import { mixTypeLabel } from "../../WorkOrder/Asset/woFormat";
import { fmtNum } from "../../Supplier/Asset/supFormat";
import IngredientUsage from "./IngredientUsage";
import IngredientBatches from "./IngredientBatches";
import IngredientLots from "./IngredientLots";

const API_URL = import.meta.env.VITE_API_URL;
const NOTE_MAX = 1000;
const ALIAS_MAX = 200;

const TABS = [
  { id: "products", label: "ใช้ในสินค้า" },
  { id: "usage", label: "การใช้งานจริง" },
  { id: "batches", label: "Batch / ผู้ขาย" },
  { id: "lots", label: "Lot ใน PFCM" },
];

const ProductsTab = ({ products }) => (
  <DataTable
    columns={[
      { key: "code", label: "รหัสสินค้า" },
      { key: "customer", label: "ลูกค้า / ตลาด" },
      { key: "mix", label: "ประเภทการผสม" },
      { key: "std", label: "Std (กก.)", align: "right" },
      { key: "min", label: "Min", align: "right" },
      { key: "max", label: "Max", align: "right" },
      { key: "pct", label: "%", align: "right" },
    ]}
    rows={products.map((p) => ({
      code: p.productCode || "-",
      customer: [p.customer, p.market].filter(Boolean).join(" / ") || "-",
      mix: mixTypeLabel(p.mixType),
      std: fmtNum(p.stdWt, 3),
      min: fmtNum(p.minWt, 3),
      max: fmtNum(p.maxWt, 3),
      pct: fmtNum(p.percentage, 2),
    }))}
    empty="ไม่มีสินค้าที่ใช้ส่วนผสมนี้"
  />
);

// Alias + remark of one ingredient; saved in PFCMv2.IngredientNote (nothing is written to WC). Only Supervisor / Master may save (the server answers 403 to others).
const NoteForm = ({ header, onSaved }) => {
  const [alias, setAlias] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // the form is filled again only for another ingredient or after a save — not when the usage range changes (that would drop what is being typed)
  useEffect(() => {
    setAlias(header.alias_name || "");
    setRemark(header.remark || "");
    setMessage(null);
  }, [header.ingdntCode, header.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = alias.trim() !== (header.alias_name || "") || remark.trim() !== (header.remark || "");

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await axios.put(`${API_URL}/api/ingredient/update-ingredient-note`, {
        ingdnt_code: header.ingdntCode,
        alias_name: alias,
        remark,
      });
      setMessage({ ok: true, text: "บันทึกข้อมูลสำเร็จ" });
      onSaved();
    } catch (err) {
      console.error("update-ingredient-note error:", err);
      setMessage({ ok: false, text: err.response?.data?.error || "บันทึกไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {!header.noteReady && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>ยังไม่ได้สร้างตารางเก็บชื่อเรียก/หมายเหตุ (IngredientNote) — ให้ DBA รัน backend/migrations/create_IngredientNote.sql ก่อน จึงจะบันทึกได้</span>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-[minmax(0,260px)_1fr]">
        <label className="block text-xs text-slate-500">
          ชื่อเรียก
          <input
            value={alias}
            maxLength={ALIAS_MAX}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="ชื่อที่หน้างานเรียก"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="block text-xs text-slate-500">
          หมายเหตุ
          <textarea
            value={remark}
            maxLength={NOTE_MAX}
            rows={2}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="เช่น ข้อควรระวัง วิธีเก็บ ผู้ขายที่ใช้"
            className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <button
          onClick={save}
          disabled={saving || !dirty || !header.noteReady}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </button>
        {message && <span className={message.ok ? "text-green-700" : "text-red-600"}>{message.text}</span>}
        {header.updated_at && <span className="ml-auto text-slate-400">{`แก้ไขล่าสุด ${header.updated_at.slice(0, 16)}`}{header.updated_by ? ` · ${header.updated_by}` : ""}</span>}
      </div>
    </div>
  );
};

const IngredientDetail = ({ code, onSaved }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("products");
  const [range, setRange] = useState(null); // null = the server's default (last 7 days); set by the usage tab
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setDetail(null);
    setRange(null);
    setTab("products");
  }, [code]);

  useEffect(() => {
    if (!code) return undefined;
    const ctrl = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_URL}/api/ingredient/fetchIngredientDetail`, {
          params: { code, from: range?.from, to: range?.to },
          signal: ctrl.signal,
        });
        setDetail(res.data.data);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("fetchIngredientDetail error:", err);
        setError(err.response?.data?.error || "โหลดข้อมูลส่วนผสมไม่สำเร็จ");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => ctrl.abort();
  }, [code, range?.from, range?.to, reload]);

  const handleSaved = useCallback(() => {
    setReload((n) => n + 1);
    onSaved();
  }, [onSaved]);

  if (!code) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400">
        <FlaskConical className="mb-3 h-12 w-12" />
        เลือกส่วนผสมทางซ้ายเพื่อดูรายละเอียด
      </div>
    );
  }
  if (!detail) {
    return loading ? (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-200 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    ) : (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-red-600">{error || "ไม่พบข้อมูล"}</div>
    );
  }

  const h = detail.header;
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl font-bold text-slate-900">{h.alias_name || h.ingdntName || h.ingdntCode}</h2>
          <span className="text-sm text-slate-500">{[h.ingdntCode, h.alias_name ? h.ingdntName : null].filter(Boolean).join(" · ")}</span>
        </div>
        <NoteForm header={h} onSaved={handleSaved} />
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
              {t.id === "products" && detail.products.length ? (
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{detail.products.length.toLocaleString()}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 p-5">
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        {tab === "products" && <ProductsTab products={detail.products} />}
        {tab === "usage" && <IngredientUsage usage={detail.usage} range={detail.range} loading={loading} onRangeChange={setRange} />}
        {tab === "batches" && <IngredientBatches code={code} range={detail.range} onRangeChange={setRange} />}
        {tab === "lots" && <IngredientLots code={code} range={detail.range} onRangeChange={setRange} />}
      </div>
    </div>
  );
};

export default IngredientDetail;
