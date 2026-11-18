import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ChevronDown, Download, FileText, Loader2, Package } from "lucide-react";
import { exportRecipePdf } from "./recipePdf";
import { buildSections, docTitle, extraTable, groupByMixType, ingredientTable, stepTable } from "./recipeDocs";
import DataTable from "./DataTable";
import WeightSpec from "./WeightSpec";

const API_URL = import.meta.env.VITE_API_URL;

const TABS = [
  { id: "formula", label: "สูตรการผลิต" },
  { id: "steps", label: "ลำดับการผสม" },
  { id: "extras", label: "สารละลาย / Topping" },
  { id: "docs", label: "เอกสาร" },
];

const Info = ({ label, value }) => (
  <div>
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-sm font-semibold text-slate-800">{value || "-"}</div>
  </div>
);

const MixTypeGroup = ({ title, iso, children }) => (
  <div className="mb-6">
    <div className="mb-2 flex items-center gap-2">
      <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      {iso && <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{iso}</span>}
    </div>
    {children}
  </div>
);

const ProductDetail = ({ codeId }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("formula");
  const [openDoc, setOpenDoc] = useState(null);
  const [exporting, setExporting] = useState(null);

  useEffect(() => {
    if (!codeId) return undefined;
    const ctrl = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      setOpenDoc(null);
      try {
        const res = await axios.get(`${API_URL}/api/recipe/fetchProductDetail`, { params: { codeId }, signal: ctrl.signal });
        setDetail(res.data.data);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("fetchProductDetail error:", err);
        setDetail(null);
        setError("โหลดข้อมูลสินค้าไม่สำเร็จ");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => ctrl.abort();
  }, [codeId]);

  const docByMix = useMemo(() => new Map((detail?.documents || []).map((d) => [d.mixType, d])), [detail]);
  const mixLabel = (mixType) => {
    const d = docByMix.get(mixType);
    return d ? docTitle(d) : `MixType ${mixType}`;
  };

  const runExport = async (key, documents) => {
    setExporting(key);
    try {
      await exportRecipePdf(detail, documents);
    } catch (err) {
      console.error("PDF export error:", err);
      setError("สร้าง PDF ไม่สำเร็จ");
    } finally {
      setExporting(null);
    }
  };

  if (!codeId) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400">
        <Package className="mb-3 h-12 w-12" />
        เลือกสินค้าทางซ้ายเพื่อดูสูตรและเอกสาร
      </div>
    );
  }
  if (loading && !detail) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-200 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!detail) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-red-600">{error || "ไม่พบข้อมูล"}</div>;
  }

  const h = detail.header;
  const docs = detail.documents;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{h.productCode}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{[h.product, h.productDesc, h.species].filter(Boolean).join(" · ")}</p>
          </div>
          <button
            disabled={!docs.length || exporting === "all"}
            onClick={() => runExport("all", docs)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export PDF ทุกเอกสาร
          </button>
        </div>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Info label="ลูกค้า" value={h.customer} />
          <Info label="ตลาด" value={h.market} />
          <Info label="บรรจุภัณฑ์" value={[h.package, h.packageName].filter(Boolean).join(" / ")} />
          <Info label="Revision สูตร" value={h.revision} />
        </div>
      </div>

      <div className="space-y-6 p-5">
        <WeightSpec h={h} />

        <section>
          <div className="mb-4 flex gap-1 border-b border-slate-200">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                  tab === t.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "formula" &&
            (detail.ingredients.length ? (
              groupByMixType(detail.ingredients).map(([mixType, rows]) => (
                <MixTypeGroup key={mixType} title={mixLabel(mixType)} iso={docByMix.get(mixType)?.iso}>
                  <DataTable columns={ingredientTable.columns} rows={ingredientTable.toRows(rows)} />
                </MixTypeGroup>
              ))
            ) : (
              <DataTable columns={[]} rows={[]} empty="สินค้านี้ยังไม่มีสูตรการผลิต" />
            ))}

          {tab === "steps" &&
            (detail.mixSequences.length ? (
              groupByMixType(detail.mixSequences).map(([mixType, rows]) => (
                <MixTypeGroup key={mixType} title={mixLabel(mixType)} iso={docByMix.get(mixType)?.iso}>
                  <ol className="space-y-1.5">
                    {stepTable.toRows(rows).map((r) => (
                      <li key={r.no} className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">{r.no}</span>
                        <span className="text-slate-700">{r.text}</span>
                      </li>
                    ))}
                  </ol>
                </MixTypeGroup>
              ))
            ) : (
              <DataTable columns={[]} rows={[]} empty="ยังไม่ได้ตั้งลำดับการผสม" />
            ))}

          {tab === "extras" && (
            <>
              <MixTypeGroup title="สารละลาย (Solution)">
                <DataTable columns={extraTable.columns} rows={extraTable.toRows(detail.solutions)} empty="ไม่มีสารละลาย" />
              </MixTypeGroup>
              <MixTypeGroup title="ส่วนผสมเพิ่ม (Topping)">
                <DataTable columns={extraTable.columns} rows={extraTable.toRows(detail.toppings)} empty="ไม่มี Topping" />
              </MixTypeGroup>
            </>
          )}

          {tab === "docs" &&
            (docs.length ? (
              <div className="space-y-3">
                {docs.map((d) => {
                  const open = openDoc === d.mixType;
                  const sections = open ? buildSections(detail, d) : [];
                  return (
                    <div key={d.mixType} className="rounded-xl border border-slate-200">
                      <div className="flex flex-wrap items-center gap-3 p-4">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-slate-800">{docTitle(d)}</div>
                          <div className="text-xs text-slate-500">{d.iso}</div>
                        </div>
                        <button
                          onClick={() => setOpenDoc(open ? null : d.mixType)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          ดูตัวอย่าง
                          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
                        </button>
                        <button
                          disabled={exporting === d.mixType}
                          onClick={() => runExport(d.mixType, [d])}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {exporting === d.mixType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          PDF
                        </button>
                      </div>
                      {open && (
                        <div className="space-y-4 border-t border-slate-100 bg-slate-50/50 p-4">
                          {sections.map((s) => (
                            <div key={s.key}>
                              <div className="mb-2 text-sm font-semibold text-slate-600">{s.title}</div>
                              <DataTable columns={s.columns} rows={s.rows} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <DataTable columns={[]} rows={[]} empty="สินค้านี้ยังไม่มีข้อมูลสำหรับสร้างเอกสาร" />
            ))}
        </section>
      </div>
    </div>
  );
};

export default ProductDetail;
