import Header from "../Layout/Header";
import ParentComponent from "./Asset/ParentComponent";

// role = prep | qc | cs1 | cs2 | pack | sup — decides the tools (above the table) and the default columns.
// The page never scrolls: the header keeps its height and the table takes the rest, scrolling inside itself.
const SheetPage = ({ role }) => (
  <div style={{ backgroundColor: "#fff" }} className="flex-1 min-h-0 flex flex-col overflow-hidden relative z-10">
    <main className="max-w-8xl w-full mx-auto py-1 px-1 lg:px-8 shrink-0">
      <Header title="ตารางรวมวัตถุดิบ (Master Delay Sheet)" />
    </main>
    <main className="max-w-8xl w-full mx-auto py-1 px-1 lg:px-8 flex-1 min-h-0">
      <ParentComponent role={role} />
    </main>
  </div>
);

export default SheetPage;
