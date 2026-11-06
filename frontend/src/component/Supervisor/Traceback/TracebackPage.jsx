import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Buttom from "../../Layout/Buttom";
import ProductionLineDelayDashboard from "./Asset/ProductionLineDelayDashboard";
import ForwardTrace from "./Asset/ForwardTrace";
import SearchPanel from "./Asset/SearchPanel";
import TracebackDetailView from "./Asset/TracebackDetailView";
import BatchLinkSection from "./Asset/BatchLinkSection";
import CodeFishSection from "./Asset/CodeFishSection";
import { Card } from "./Asset/TraceAtoms";
import { makeForm, defaultSort, traceCodes } from "./Asset/traceForm";
import { T } from "./Asset/tracebackUI";
import { scopeFromParams, readRecent } from "./Asset/tracebackCore";

// /sup/Traceback — ONE page, no direction to pick:
//   1. สอบกลับ Mat วัตถุดิบเริ่มต้น ↔ 2X          (BatchLinkSection by="mat")
//   2. สินค้าแต่ละ Code ใช้ปลากี่ Batch           (CodeFishSection)
//   3. สอบกลับ Batch วัตถุดิบเริ่มต้น ↔ 2X        (BatchLinkSection by="batch")
//   4. สอบกลับเอกสารการผลิต + สอบไปข้างหน้า        (one search box: the production documents that used the Batch / Lot AND where it went)
//   ?doc_no=&code= opens that document's sheet · ?scope=1&code=&batch=&line=… the sheet of a filter · ?code=&type= runs the forward trace of a code at once
// (the old pages "จำลองการเรียกคืน" / "รายการกักสินค้า" were already hidden; their code stays in Asset/ — MockRecall.jsx, HoldList.jsx)

const TracebackPage = () => {
  const [params, setParams] = useSearchParams();
  const docNo = params.get("doc_no");
  // ?scope=1&code=&batch=&line=... = ใบสอบกลับตามตัวกรองของหน้าค้นหา (ไม่ผูกกับเอกสารเดียว)
  const scope = scopeFromParams(params);
  // ใบสอบกลับแสดงใต้ตารางผลในหน้านี้เลย (ลิงก์ ?doc_no= / ?scope=1 เปิดมาพร้อมใบนั้น)
  const [record, setRecord] = useState(() => scope || (docNo ? { doc_no: docNo, code: params.get("code") || "" } : null));
  const recordRef = useRef(null);
  useEffect(() => {
    if (record) recordRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [record]);

  // the one search form of section 4 (SearchPanel): the backward list and the forward trace both read it
  const [form, setForm] = useState(() => makeForm("backward", params.get("mode") === "forward" || params.get("type") ? { trace: (params.get("code") || "").split(",").join(" ") } : {}));
  const dashRef = useRef(null);
  const fwdRef = useRef(null);
  const [fwdRun, setFwdRun] = useState(() => (params.get("code") && (params.get("mode") === "forward" || params.get("type")) ? 1 : 0)); // > 0: the forward trace is on the page
  const [recentTick, setRecentTick] = useState(0);
  const recent = useMemo(() => readRecent().filter((r) => r.kind === "fwd"), [recentTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // the forward trace is mounted only after the first search that has a Batch / Lot: it runs when it is there
  const pendingFwd = useRef(null);
  useEffect(() => {
    if (fwdRun > 0 && pendingFwd.current) {
      const run = pendingFwd.current;
      pendingFwd.current = null;
      run(fwdRef.current);
    }
  }, [fwdRun]);

  const onSearch = () => {
    setRecord(null);
    dashRef.current?.search();
    if (traceCodes(form).length) {
      if (fwdRef.current) fwdRef.current.search();
      else { pendingFwd.current = (f) => f?.search(); setFwdRun((n) => n + 1); }
    }
  };
  const onReset = () => { setRecord(null); setForm(makeForm("backward")); dashRef.current?.reset(); fwdRef.current?.reset(); };

  // a recent search: the code(s) go back into the box and both searches run at once
  const pickRecent = (r) => {
    setForm((f) => ({ ...f, trace: r.code.split(",").join(" ") }));
    dashRef.current?.run(r.code);
    if (fwdRef.current) fwdRef.current.run(r.code);
    else { pendingFwd.current = (f) => f?.run(r.code); setFwdRun((n) => n + 1); }
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

  // the forward trace keeps its own order (day, newest first) while the backward list uses the order of the form
  const fwdForm = useMemo(() => ({ ...form, sort: defaultSort("forward"), pack_status: "all" }), [form]);

  return (
    <div style={{ backgroundColor: T.bg }} className="flex-1 overflow-auto relative z-10">
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <style>{`@keyframes tbSpin { to { transform: rotate(360deg) } }`}</style>

        <BatchLinkSection by="mat" title="1) สอบกลับ Mat วัตถุดิบเริ่มต้น ↔ 2X" />
        <CodeFishSection title="2) สินค้าแต่ละ Code ใช้ปลากี่ Batch" />
        <BatchLinkSection by="batch" title="3) สอบกลับ Batch วัตถุดิบเริ่มต้น ↔ 2X" />

        <Card title="4) สอบกลับเอกสารการผลิต และสอบไปข้างหน้า จาก Batch / Lot" pad="0 14px 14px">
          <SearchPanel form={form} setForm={setForm} onSearch={onSearch} onReset={onReset} recent={recent} onPickRecent={pickRecent} />

          <div style={{ padding: "4px 0 0" }}>
            <ProductionLineDelayDashboard ref={dashRef} onSelect={onSelect} form={form} onRan={() => setRecentTick((n) => n + 1)} />
            {fwdRun > 0 && (
              <div style={{ paddingTop: 8 }}>
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
            )}
          </div>
        </Card>

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
