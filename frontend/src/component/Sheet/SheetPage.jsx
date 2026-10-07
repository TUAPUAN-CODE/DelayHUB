import Header from "../Layout/Header";
import Buttom from "../Layout/Buttom";
import ParentComponent from "./Asset/ParentComponent";

// role = prep | qc | cs1 | cs2 | pack | sup — decides the tools shown in the "ทำรายการ" column and the default columns
const SheetPage = ({ role }) => (
  <div style={{ backgroundColor: "#fff" }} className="flex-1 overflow-auto relative z-10">
    <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
      <Header title="ตารางรวมวัตถุดิบ (Master Delay Sheet)" />
    </main>
    <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
      <ParentComponent role={role} />
    </main>
    <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
      <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
    </main>
  </div>
);

export default SheetPage;
