import { useSearchParams } from "react-router-dom";
import ParentComponent from "./Asset/ParentComponent";

// role = prep | qc | cs1 | cs2 | pack | sup — decides the tools (above the table) and the default columns.
// ?view=done = the Done table (finished rows, picked by date first and then read from the database); the top menu has an entry for it.
// The page never scrolls: the table takes the whole height and scrolls inside itself. (Name and language are in the top bar.)
const SheetPage = ({ role }) => {
  const [params] = useSearchParams();
  const view = params.get("view") === "done" ? "done" : "work";
  return (
    <div style={{ backgroundColor: "#fff" }} className="flex-1 min-h-0 flex flex-col overflow-hidden relative z-10">
      <main className="max-w-8xl w-full mx-auto pt-2 pb-1 px-1 lg:px-8 flex-1 min-h-0">
        <ParentComponent role={role} view={view} />
      </main>
    </div>
  );
};

export default SheetPage;
