import { useState } from "react";
import Buttom from "../../Layout/Buttom";
import WorkOrderList from "./Asset/WorkOrderList";
import WorkOrderDetail from "./Asset/WorkOrderDetail";

// /sup/WorkOrder — pick a production order (WOId) and read everything recorded for it: header, formula, baskets and the batches
// they used, solutions / toppings, weights, inspections and the edit log. Data: /api/wo (read-only).
const WorkOrderPage = () => {
  const [woId, setWoId] = useState(null);

  return (
    <div style={{ backgroundColor: "#f8fafc" }} className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
      <main className="max-w-8xl mx-auto grid min-h-0 w-full flex-1 grid-cols-1 gap-3 px-1 pb-1 pt-2 lg:grid-cols-[360px_1fr] lg:px-8">
        <div className="min-h-0 max-h-[40vh] lg:max-h-none">
          <WorkOrderList selectedId={woId} onSelect={setWoId} />
        </div>
        <div className="min-h-0">
          <WorkOrderDetail woId={woId} />
        </div>
      </main>
      <main className="max-w-8xl mx-auto w-full px-1 pb-1 lg:px-8">
        <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
      </main>
    </div>
  );
};

export default WorkOrderPage;
