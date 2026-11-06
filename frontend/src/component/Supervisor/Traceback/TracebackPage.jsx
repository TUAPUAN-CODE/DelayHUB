import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import Buttom from "../../Layout/Buttom";
import ProductionLineDelayDashboard from "./Asset/ProductionLineDelayDashboard";
import ForwardTrace from "./Asset/ForwardTrace";
import SearchPanel from "./Asset/SearchPanel";
import TracebackDetailView from "./Asset/TracebackDetailView";
import BatchPairsView from "./Asset/BatchPairsView";
import CodeFishView from "./Asset/CodeFishView";
import { Segmented, Spinner } from "./Asset/TraceAtoms";
import { makeForm, defaultSort, traceCodes } from "./Asset/traceForm";
import { T } from "./Asset/tracebackUI";
import { scopeFromParams, readRecent } from "./Asset/tracebackCore";

const API_URL = import.meta.env.VITE_API_URL;

// /sup/Traceback — ONE page, ONE search form (SearchPanel): put as many conditions as you like (Batch ตั้งต้น / 2X / Lot, Mat, Code, document, line, dates — all optional),
// press ค้นหา, and read the result in the view you need (the tabs share the same conditions; a tab searches when it is opened after a new search):
//   pairs   : Batch ตั้งต้น ↔ Batch 2X (+ the rows that used them)        · fish    : how many fish Batches each product Code used, and which
//   docs    : the production documents that used the Batch / Lot          · forward : where the Batch / Lot went next (needs a Batch / Lot)
//   ?doc_no=&code= opens that document's sheet · ?scope=1&code=&batch=&line=… the sheet of a filter · ?code=&type= opens the forward tab with that code
// (the old pages "จำลองการเรียกคืน" / "รายการกักสินค้า" were already hidden; their code stays in Asset/ — MockRecall.jsx, HoldList.jsx)
const TABS = [
  { value: "pairs", label: "Batch ตั้งต้น ↔ 2X" },
  { value: "fish", label: "Code ใช้ปลากี่ Batch" },
  { value: "docs", label: "เอกสารการผลิตที่ใช้" },
  { value: "forward", label: "ปลายทางของ Batch / Lot" },
];

const TracebackPage = () => {
  const [params, setParams] = useSearchParams();
  const docNo = params.get("doc_no");
  // ?scope=1&code=&batch=&line=... = ใบสอบกลับตามตัวกรองของหน้าค้นหา (ไม่ผูกกับเอกสารเดียว)
  const scope = scopeFromParams(params);
  const fromForwardLink = !!(params.get("code") && (params.get("mode") === "forward" || params.get("type")));
  // ใบสอบกลับแสดงใต้ตารางผลในหน้านี้เลย (ลิงก์ ?doc_no= / ?scope=1 เปิดมาพร้อมใบนั้น)
  const [record, setRecord] = useState(() => scope || (docNo ? { doc_no: docNo, code: params.get("code") || "" } : null));
  const recordRef = useRef(null);
  useEffect(() => {
    if (record) recordRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [record]);

  const [form, setForm] = useState(() => makeForm("backward", fromForwardLink ? { trace: (params.get("code") || "").split(",").join(" ") } : {}));
  const formRef = useRef(form);
  formRef.current = form;
  const [tab, setTab] = useState(fromForwardLink ? "forward" : "pairs");
  const [searchVer, setSearchVer] = useState(fromForwardLink ? 1 : 0);   // +1 at every press of ค้นหา
  const ran = useRef({});                                                // tab group -> the searchVer it was searched for
  const dashRef = useRef(null);
  const fwdRef = useRef(null);
  const [links, setLinks] = useState({ rows: null, loading: false, error: "", capped: false });
  const [recentTick, setRecentTick] = useState(0);
  const recent = useMemo(() => readRecent().filter((r) => r.kind === "fwd"), [recentTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // pairs + fish share one request: the rows of every Batch that matches the conditions
  const fetchLinks = useCallback(async () => {
    const f = formRef.current;
    setLinks((l) => ({ ...l, loading: true, error: "" }));
    try {
      const res = await axios.get(`${API_URL}/api/traceback/batch-link`, {
        params: {
          batch: traceCodes(f).join(","), mat: f.mat, mat_name: f.mat_name, code: f.code, doc_no: f.doc_no, line: f.rmm_line_name,
          pack_status: f.pack_status, from: f.from, to: f.single ? f.from : f.to,
        },
      });
      if (!res.data?.success) throw new Error(res.data?.error || "ค้นหาไม่สำเร็จ");
      setLinks({ rows: res.data.data || [], loading: false, error: "", capped: !!res.data.capped });
    } catch (e) {
      console.error("batch-link error:", e);
      setLinks({ rows: null, loading: false, error: e.response?.data?.error || e.message || "ค้นหาไม่สำเร็จ", capped: false });
    }
  }, []);

  // a tab searches when it is shown and has not been searched for the current ค้นหา
  useEffect(() => {
    if (searchVer === 0) return;
    const group = tab === "fish" ? "pairs" : tab;
    if (ran.current[group] === searchVer) return;
    ran.current[group] = searchVer;
    if (group === "pairs") fetchLinks();
    else if (group === "docs") dashRef.current?.search();
    else if (group === "forward" && traceCodes(formRef.current).length) fwdRef.current?.search();
  }, [tab, searchVer, fetchLinks]);

  const onSearch = () => { setRecord(null); ran.current = {}; setSearchVer((v) => v + 1); };
  const onReset = () => {
    setRecord(null); ran.current = {}; setSearchVer(0); setForm(makeForm("backward"));
    setLinks({ rows: null, loading: false, error: "", capped: false });
    dashRef.current?.reset(); fwdRef.current?.reset();
  };

  // a recent search: the code(s) go back into the box and the search runs at once
  const pickRecent = (r) => {
    const trace = r.code.split(",").join(" ");
    setForm((f) => ({ ...f, trace }));
    formRef.current = { ...formRef.current, trace };
    onSearch();
  };

  const openRecord = useCallback((doc_no, code) => setRecord({ doc_no, code }), []);
  const onSelect = useCallback((v) => setRecord(v || null), []);
  const onForwardQuery = useCallback(({ code, type }) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("mode"); next.set("code", code); next.set("type", type);
      return next;
    }, { replace: true });
  }, [setParams]);

  // the forward trace keeps its own order (day, newest first) and shows every status
  const fwdForm = useMemo(() => ({ ...form, sort: defaultSort("forward"), pack_status: "all" }), [form]);
  const show = (v) => ({ display: tab === v || (v === "pairs" && tab === "fish") ? "block" : "none" });
  const hasCodes = traceCodes(form).length > 0;

  return (
    <div style={{ backgroundColor: T.bg }} className="flex-1 overflow-auto relative z-10">
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <style>{`@keyframes tbSpin { to { transform: rotate(360deg) } }`}</style>

        <SearchPanel form={form} setForm={setForm} onSearch={onSearch} onReset={onReset} loading={links.loading} recent={recent} onPickRecent={pickRecent} />

        <div style={{ margin: "14px 0 10px" }}><Segmented value={tab} onChange={setTab} options={TABS} /></div>

        <div style={{ paddingBottom: 12 }}>
          {(tab === "pairs" || tab === "fish") && (
            <div>
              {searchVer === 0 && <div style={{ padding: 18, fontSize: 13, color: T.text2, border: `1px dashed ${T.blueLine}`, borderRadius: 12, textAlign: "center" }}>ใส่เงื่อนไขอย่างน้อย 1 อย่าง (Batch · Mat · Code · เอกสาร · ไลน์ · วันที่ — วันที่ไม่ใส่ก็ได้) แล้วกดค้นหา</div>}
              {links.loading && <div style={{ padding: 18, display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: T.text2 }}><Spinner size={16} />กำลังค้นหา...</div>}
              {links.error && <div style={{ padding: "8px 2px", color: T.bad, fontSize: 13 }}>{links.error}</div>}
              {links.capped && <div style={{ padding: "8px 2px", color: T.orange, fontSize: 12.5 }}>ผลลัพธ์ถึงเพดาน แสดงเฉพาะส่วนแรก — เพิ่มเงื่อนไขให้แคบลง</div>}
              {links.rows && !links.loading && (tab === "pairs" ? <BatchPairsView rows={links.rows} /> : <CodeFishView rows={links.rows} />)}
            </div>
          )}

          <div style={show("docs")}>
            <ProductionLineDelayDashboard ref={dashRef} onSelect={onSelect} form={form} onRan={() => setRecentTick((n) => n + 1)} />
          </div>
          <div style={{ ...show("forward"), paddingTop: 8 }}>
            {!hasCodes && <div style={{ padding: 18, fontSize: 13, color: T.text2, border: `1px dashed ${T.blueLine}`, borderRadius: 12, textAlign: "center" }}>ใส่ Batch / Lot ในช่องค้นหา เพื่อดูว่าไปที่ไหนต่อ</div>}
            <div style={{ display: hasCodes ? "block" : "none" }}>
              <ForwardTrace
                ref={fwdRef}
                initialCode={params.get("code") || ""}
                initialType={params.get("type") || "auto"}
                onOpenRecord={openRecord}
                onQueryChange={onForwardQuery}
                onRan={() => setRecentTick((n) => n + 1)}
                form={fwdForm}
              />
            </div>
          </div>
        </div>

        {record && (
          <div ref={recordRef} style={{ paddingBottom: 12 }}>
            <TracebackDetailView
              docNo={record.doc_no} code={record.code} scope={record.scope ? record : null}
              onClose={() => setRecord(null)}
            />
          </div>
        )}
      </main>
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
      </main>
    </div>
  );
};

export default TracebackPage;
