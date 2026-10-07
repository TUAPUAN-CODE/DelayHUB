import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../../Layout/Header";
import Buttom from "../../Layout/Buttom";
import ReworkList from "./Asset/ParentComponent";
import ImportList from "../MatImport/Asset/ParentComponent";

const TABS = [
  { id: "rework", label: "วัตถุดิบรอแก้ไข", Component: ReworkList },
  { id: "import", label: "กลับมาเตรียม", Component: ImportList },
];

/**
 * วัตถุดิบรอแก้ไข + กลับมาเตรียม on one page. Material split from one mapping_id can come back to either list, so both are one click apart.
 * Only the open tab is mounted (each list keeps its own socket + data and must not run twice).
 * `?tab=import` opens the second tab (the old /prep/MatImport/MatImportPage address redirects there).
 */
const MatReworkPage = () => {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "import" ? "import" : "rework");
  const Active = TABS.find((t) => t.id === tab).Component;

  const choose = (id) => {
    setTab(id);
    setParams(id === "rework" ? {} : { tab: id }, { replace: true });
  };

  return (
    <div style={{ backgroundColor: "#f4f7fe", fontFamily: "Prompt, sans-serif" }} className="flex-1 overflow-auto relative z-10">
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Header title="วัตถุดิบรอแก้ไข / กลับมาเตรียม" />
      </main>
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <div role="tablist" className="inline-flex gap-1 p-1 mb-3 rounded-xl bg-white border border-[#e3e9f6]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => choose(t.id)}
              className="px-4 py-2 rounded-lg text-sm transition-colors"
              style={{ background: tab === t.id ? "#1552F0" : "transparent", color: tab === t.id ? "#fff" : "#475569", fontWeight: tab === t.id ? 600 : 400 }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Active key={tab} />
      </main>
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
      </main>
    </div>
  );
};

export default MatReworkPage;
