import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Buttom from "../../Layout/Buttom";
import ProductionLineDelayDashboard from "./Asset/ProductionLineDelayDashboard";
import ForwardTrace from "./Asset/ForwardTrace";
import MockRecall from "./Asset/MockRecall";
import HoldList from "./Asset/HoldList";
import SearchPanel from "./Asset/SearchPanel";
import { makeForm, defaultSort, defaultStatus } from "./Asset/traceForm";
import { T } from "./Asset/tracebackUI";
import { scopeFromParams, scopeToParams, readRecent, readVariants, saveVariants } from "./Asset/tracebackCore";

// /sup/Traceback — ศูนย์สอบกลับการผลิต
//   ?mode=backward (ค่าเริ่มต้น) · ?doc_no=&code= เปิดใบสอบกลับตรง · ?scope=1&code=&batch=&line=… ใบสอบกลับตามตัวกรอง
//   ?mode=forward&code=&type=   สอบไปข้างหน้าจากรหัสรุ่น/Lot
//   ?mode=recall                 จำลองการเรียกคืน
//   ?mode=holds                  รายการกักสินค้า
const MODES = [
  { key: "backward", title: "สอบย้อนกลับ", en: "Trace Backward", desc: "จากสินค้า / เอกสารผลิต → วัตถุดิบ ส่วนผสม บรรจุภัณฑ์ ผู้ขาย" },
  { key: "forward", title: "สอบไปข้างหน้า", en: "Trace Forward", desc: "จากรหัสรุ่น / Lot → สินค้าทุกเอกสารที่ได้รับผลกระทบ" },
  { key: "recall", hidden: true, title: "จำลองการเรียกคืน", en: "Mock Recall", desc: "จับเวลา เช็กลิสต์ สมดุลมวล และออกโปรโตคอล PDF" },
  { key: "holds", hidden: true, title: "รายการกักสินค้า", en: "Hold / QN", desc: "เอกสารที่ถูกกักจากผลสอบกลับ · ปลดกักพร้อมเหตุผล" },
];

// hidden = the page is not shown (no tab, the address ?mode=recall / ?mode=holds opens the default page); its code stays here and in Asset/ so it can be switched on again
const HIDDEN_KEYS = new Set(MODES.filter((m) => m.hidden).map((m) => m.key));

const TracebackPage = () => {
  const [params, setParams] = useSearchParams();
  const [recallSeed, setRecallSeed] = useState(null);
  const docNo = params.get("doc_no");
  // ?scope=1&code=&batch=&line=... = ใบสอบกลับตามตัวกรองของหน้าค้นหา (ไม่ผูกกับเอกสารเดียว)
  const scope = scopeFromParams(params);
  const requested = params.get("mode") || "backward";
  const mode = (scope || docNo || HIDDEN_KEYS.has(requested)) ? "backward" : requested;
  const selected = scope || (docNo ? { doc_no: docNo, code: params.get("code") || "" } : null);

  // the one search form of the page (SearchPanel) — both directions read it; the buttons of each direction are called through a ref
  const [form, setForm] = useState(() => makeForm(mode, mode === "forward" ? { trace: params.get("code") || "", type: params.get("type") || "auto" } : {}));
  const dashRef = useRef(null);
  const fwdRef = useRef(null);
  const [variants, setVariants] = useState(readVariants);
  const [recentTick, setRecentTick] = useState(0);
  const recent = useMemo(() => readRecent().filter((r) => r.kind === "fwd"), [recentTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const setMode = (m) => {
    setParams(m === "backward" ? {} : { mode: m });
    setForm((f) => ({ ...f, sort: defaultSort(m), pack_status: defaultStatus(m) })); // each direction starts from its own order / status
  };
  const activeRef = () => (mode === "forward" ? fwdRef : dashRef);
  const onSearch = () => activeRef().current?.search();
  const onReset = () => { setForm(makeForm(mode)); activeRef().current?.reset(); };

  const saveVariant = () => {
    const q = form.multi ? form.multiText.trim() : form.trace.trim();
    if (!q) return;
    const name = window.prompt("ตั้งชื่อการค้นหานี้ (บันทึกไว้ในเครื่องนี้)", q.slice(0, 30));
    if (!name) return;
    setVariants(saveVariants([{ name, code: q, type: form.type, multi: form.multi }, ...variants.filter((v) => v.name !== name)]));
  };
  // a saved / recent search: one code runs at once, several codes fill the list and wait for the button
  const runSaved = (code, type, multi) => {
    const many = multi || /[\s,;]/.test(code.trim());
    setForm((f) => ({ ...f, type, multi: many, ...(many ? { multiText: code } : { trace: code }) }));
    if (!many) activeRef().current?.run(code, type);
  };
  const applyVariant = (v) => runSaved(v.code, v.type, !!v.multi);
  const removeVariant = (v) => setVariants(saveVariants(variants.filter((x) => x.name !== v.name)));
  const pickRecent = (r) => runSaved(r.code, r.type, false);

  const onSelect = useCallback((v) => {
    if (v?.scope) setParams(scopeToParams(v));
    else if (v) setParams({ doc_no: v.doc_no, ...(v.code ? { code: v.code } : {}) });
    else setParams({});
  }, [setParams]);

  const openRecord = useCallback((doc_no, code) => {
    onSelect({ doc_no, code });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [onSelect]);

  const onForwardQuery = useCallback(({ code, type }) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("mode", "forward"); next.set("code", code); next.set("type", type);
      return next;
    }, { replace: true });
  }, [setParams]);

  const clearSeed = useCallback(() => setRecallSeed(null), []);

  return (
    <div style={{ backgroundColor: T.bg }} className="flex-1 overflow-auto relative z-10">
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <style>{`@keyframes tbSpin { to { transform: rotate(360deg) } }`}</style>

        {!selected && (
          <SearchPanel
            mode={mode} onModeChange={setMode} form={form} setForm={setForm} onSearch={onSearch} onReset={onReset}
            variants={variants} onSaveVariant={saveVariant} onApplyVariant={applyVariant} onRemoveVariant={removeVariant}
            recent={recent} onPickRecent={pickRecent}
          />
        )}

        <div style={{ padding: "4px 0 12px" }}>
          {mode === "backward" && <ProductionLineDelayDashboard ref={dashRef} selected={selected} onSelect={onSelect} form={form} onRan={() => setRecentTick((n) => n + 1)} />}
          {mode === "forward" && (
            <div style={{ paddingTop: 8 }}>
              <ForwardTrace
                ref={fwdRef}
                initialCode={params.get("code") || ""}
                initialType={params.get("type") || "auto"}
                onOpenRecord={openRecord}
                onQueryChange={onForwardQuery}
                onRan={() => setRecentTick((n) => n + 1)}
                form={form}
              />
            </div>
          )}
          {mode === "holds" && (
            <div style={{ paddingTop: 16 }}>
              <HoldList onOpenRecord={openRecord} />
            </div>
          )}
          {mode === "recall" && (
            <div style={{ paddingTop: 16 }}>
              <MockRecall seed={recallSeed} onSeedUsed={clearSeed} onOpenRecord={openRecord} />
            </div>
          )}
        </div>
      </main>
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
      </main>
    </div>
  );
};

export default TracebackPage;
