import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../../Layout/Header";
import Buttom from "../../Layout/Buttom";
import ProductionLineDelayDashboard from "./Asset/ProductionLineDelayDashboard";
import ForwardTrace from "./Asset/ForwardTrace";
import MockRecall from "./Asset/MockRecall";
import { T } from "./Asset/tracebackUI";
import logoUrl from "../../../assets/brand/itail-logo.png";

// /sup/Traceback — ศูนย์สอบกลับการผลิต
//   ?mode=backward (ค่าเริ่มต้น) · ?doc_no=&code= เปิดใบสอบกลับตรง
//   ?mode=forward&code=&type=   สอบไปข้างหน้าจากรหัสรุ่น/Lot
//   ?mode=recall                 จำลองการเรียกคืน
const MODES = [
  { key: "backward", title: "สอบย้อนกลับ", en: "Trace Backward", desc: "จากสินค้า / เอกสารผลิต → วัตถุดิบ ส่วนผสม บรรจุภัณฑ์ ผู้ขาย" },
  { key: "forward", title: "สอบไปข้างหน้า", en: "Trace Forward", desc: "จากรหัสรุ่น / Lot → สินค้าทุกเอกสารที่ได้รับผลกระทบ" },
  { key: "recall", title: "จำลองการเรียกคืน", en: "Mock Recall", desc: "จับเวลา เช็กลิสต์ สมดุลมวล และออกโปรโตคอล PDF" },
];

const TracebackPage = () => {
  const [params, setParams] = useSearchParams();
  const [recallSeed, setRecallSeed] = useState(null);
  const docNo = params.get("doc_no");
  const mode = docNo ? "backward" : (params.get("mode") || "backward");
  const selected = docNo ? { doc_no: docNo, code: params.get("code") || "" } : null;

  const setMode = (m) => setParams(m === "backward" ? {} : { mode: m });

  const onSelect = useCallback((v) => {
    if (v) setParams({ doc_no: v.doc_no, ...(v.code ? { code: v.code } : {}) });
    else setParams({});
  }, [setParams]);

  const openRecord = useCallback((doc_no, code) => {
    onSelect({ doc_no, code });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [onSelect]);

  const onForwardQuery = useCallback(({ code, type }) => {
    setParams({ mode: "forward", code, type }, { replace: true });
  }, [setParams]);

  const clearSeed = useCallback(() => setRecallSeed(null), []);

  const startRecall = (fwd) => {
    setRecallSeed(fwd);
    setParams({ mode: "recall" });
  };

  return (
    <div style={{ backgroundColor: T.bg }} className="flex-1 overflow-auto relative z-10">
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Header title="Traceback | สอบกลับการผลิต" />
      </main>
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <style>{`@keyframes tbSpin { to { transform: rotate(360deg) } }`}</style>

        {/* ── แถบหัว: โลโก้ i-Tail (พื้นโปร่งใส) + เลือกโหมด ── */}
        {!selected && (
          <div className="tb-noprint" style={{
            marginTop: 12, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.line}`,
            background: `linear-gradient(120deg, ${T.white} 0%, ${T.blueSoft} 55%, ${T.orangeSoft} 100%)`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", flexWrap: "wrap" }}>
              <img src={logoUrl} alt="i-Tail" style={{ height: 56, width: "auto" }} />
              <div style={{ flex: "1 1 260px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, letterSpacing: 1 }}>TRACEABILITY CENTER</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.blueDeep, lineHeight: 1.2 }}>ศูนย์สอบกลับการผลิต</div>
                <div style={{ fontSize: 13, color: T.text2 }}>วัตถุดิบ · ส่วนผสม · บรรจุภัณฑ์ — ย้อนกลับ ไปข้างหน้า และจำลองการเรียกคืน</div>
              </div>
            </div>
            <div role="tablist" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, padding: "0 20px 16px" }}>
              {MODES.map((m) => {
                const on = mode === m.key;
                return (
                  <button key={m.key} type="button" role="tab" aria-selected={on} onClick={() => setMode(m.key)}
                    style={{
                      textAlign: "left", cursor: "pointer", fontFamily: "inherit", borderRadius: 12, padding: "12px 14px",
                      border: `2px solid ${on ? T.orange : T.line}`, background: on ? T.white : "rgba(255,255,255,0.7)",
                      boxShadow: on ? "0 6px 18px rgba(217,88,13,0.15)" : "none",
                    }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: on ? T.orange : T.blueDeep }}>
                      {m.title} <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text2 }}>· {m.en}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.text2, marginTop: 3 }}>{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ padding: "4px 0 12px" }}>
          {mode === "backward" && <ProductionLineDelayDashboard selected={selected} onSelect={onSelect} />}
          {mode === "forward" && (
            <div style={{ paddingTop: 16 }}>
              <ForwardTrace
                initialCode={params.get("code") || ""}
                initialType={params.get("type") || "auto"}
                onOpenRecord={openRecord}
                onStartRecall={startRecall}
                onQueryChange={onForwardQuery}
              />
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
