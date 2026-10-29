import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../../Layout/Header";
import Buttom from "../../Layout/Buttom";
import ProductionLineDelayDashboard from "./Asset/ProductionLineDelayDashboard";
import ForwardTrace from "./Asset/ForwardTrace";
import MockRecall from "./Asset/MockRecall";
import HoldList from "./Asset/HoldList";
import { T } from "./Asset/tracebackUI";
import { scopeFromParams, scopeToParams } from "./Asset/tracebackCore";

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
const VISIBLE_MODES = MODES.filter((m) => !m.hidden);
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

  const setMode = (m) => setParams(m === "backward" ? {} : { mode: m });

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
        <Header title="Traceback | สอบกลับการผลิต" />
      </main>
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <style>{`@keyframes tbSpin { to { transform: rotate(360deg) } }`}</style>

        {/* ── เลือกโหมด (หน้า recall / holds ซ่อนอยู่) ── */}
        {!selected && (
          <div className="tb-noprint" role="tablist" style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
            {VISIBLE_MODES.map((m) => {
              const on = mode === m.key;
              return (
                <button key={m.key} type="button" role="tab" aria-selected={on} onClick={() => setMode(m.key)}
                  style={{
                    textAlign: "left", cursor: "pointer", fontFamily: "inherit", borderRadius: 12, padding: "12px 14px",
                    border: `2px solid ${on ? T.orange : T.line}`, background: T.white,
                    boxShadow: on ? "0 6px 18px rgba(242,107,29,0.15)" : "none",
                  }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: on ? T.orange : T.blueDeep }}>
                    {m.title} <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text2 }}>· {m.en}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.text2, marginTop: 3 }}>{m.desc}</div>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ padding: "4px 0 12px" }}>
          {mode === "backward" && <ProductionLineDelayDashboard selected={selected} onSelect={onSelect} />}
          {mode === "forward" && (
            <div style={{ paddingTop: 16 }}>
              <ForwardTrace
                key={params.get("go") || "0"}
                initialCode={params.get("code") || ""}
                initialType={params.get("type") || "auto"}
                onOpenRecord={openRecord}
                onQueryChange={onForwardQuery}
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
