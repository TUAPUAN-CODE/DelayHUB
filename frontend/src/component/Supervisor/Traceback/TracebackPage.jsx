import Header from "../../Layout/Header";
import Buttom from "../../Layout/Buttom";
import ProductionLineDelayDashboard from "./Asset/ProductionLineDelayDashboard";

// /sup/Traceback — สอบกลับการผลิต (ค้นหา → การ์ดต่อการผลิต → ใบสอบกลับเต็มหน้า)
// หมายเหตุ: ยังไม่ได้ลงทะเบียน route ใน AppSup.jsx / SidebarSup.jsx เพราะต้องรอไฟล์ Asset/TracebackDetailView.jsx และ Asset/tracebackUI.js ก่อน (ดูคำอธิบายในแชต)
const TracebackPage = () => (
  <div style={{ backgroundColor: "#fff" }} className="flex-1 overflow-auto relative z-10">
    <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
      <Header title="Traceback | สอบกลับการผลิต" />
    </main>
    <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
      <ProductionLineDelayDashboard />
    </main>
    <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
      <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
    </main>
  </div>
);

export default TracebackPage;
