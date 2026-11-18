import { useState } from "react";
import Buttom from "../../Layout/Buttom";
import ProductList from "./Asset/ProductList";
import ProductDetail from "./Asset/ProductDetail";

// /sup/ProductRecipe — pick a product code (customer · market · package) and read its weights, formula, mixing steps,
// solutions and toppings, then export the documents it prints (one PDF per document, or all in one file). Data: /api/recipe (read-only).
const ProductRecipePage = () => {
  const [codeId, setCodeId] = useState(null);

  return (
    <div style={{ backgroundColor: "#f8fafc" }} className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
      <main className="max-w-8xl mx-auto grid min-h-0 w-full flex-1 grid-cols-1 gap-3 px-1 pb-1 pt-2 lg:grid-cols-[340px_1fr] lg:px-8">
        <div className="min-h-0 max-h-[40vh] lg:max-h-none">
          <ProductList selectedId={codeId} onSelect={setCodeId} />
        </div>
        <div className="min-h-0">
          <ProductDetail codeId={codeId} />
        </div>
      </main>
      <main className="max-w-8xl mx-auto w-full px-1 pb-1 lg:px-8">
        <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
      </main>
    </div>
  );
};

export default ProductRecipePage;
