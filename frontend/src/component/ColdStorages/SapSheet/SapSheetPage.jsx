import ParentComponent from "./Asset/ParentComponent";

// Same shell as the Master Sheet (/prep/Sheet): no page header / footer, the page never scrolls, the table takes the whole height and scrolls inside itself.
const SapSheetPage = () => (
  <div style={{ backgroundColor: "#fff" }} className="flex-1 min-h-0 flex flex-col overflow-hidden relative z-10">
    <main className="max-w-8xl w-full mx-auto pt-2 pb-1 px-1 lg:px-8 flex-1 min-h-0">
      <ParentComponent />
    </main>
  </div>
);

export default SapSheetPage;
