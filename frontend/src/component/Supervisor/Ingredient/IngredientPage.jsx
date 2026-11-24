import { useCallback, useState } from "react";
import Buttom from "../../Layout/Buttom";
import IngredientList from "./Asset/IngredientList";
import IngredientDetail from "./Asset/IngredientDetail";

// /sup/Ingredient — every ingredient of the recipes (WC, read-only): which products use it (std / min / max), what was really weighed in each basket,
// and the alias / remark the Supervisor keeps for it (saved in PFCMv2.IngredientNote). Data: /api/ingredient.
const IngredientPage = () => {
  const [code, setCode] = useState(null);
  const [listVersion, setListVersion] = useState(0);

  // after a note is saved the list is read again, so the alias shows in it
  const handleSaved = useCallback(() => setListVersion((v) => v + 1), []);

  return (
    <div style={{ backgroundColor: "#f8fafc" }} className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
      <main className="max-w-8xl mx-auto grid min-h-0 w-full flex-1 grid-cols-1 gap-3 px-1 pb-1 pt-2 lg:grid-cols-[360px_1fr] lg:px-8">
        <div className="min-h-0 max-h-[40vh] lg:max-h-none">
          <IngredientList version={listVersion} selectedCode={code} onSelect={setCode} />
        </div>
        <div className="min-h-0">
          <IngredientDetail code={code} onSaved={handleSaved} />
        </div>
      </main>

      <main className="max-w-8xl mx-auto w-full px-1 pb-1 lg:px-8">
        <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
      </main>
    </div>
  );
};

export default IngredientPage;
