import Header from "../Layout/Header";
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
  </div>
);

export default SheetPage;
