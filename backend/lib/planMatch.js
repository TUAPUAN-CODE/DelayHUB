// Matches a production plan of PFCM (Production.code + Production.doc_no) to a product code of the recipe database (TunaCodes).
//   PFCM:  code = "I8HPTD RCC822L2L"            doc_no = "T087"
//   WC:    ProductCode = "I8HPTD RCC822L2L - T087"   GroupCode = "T087"  (= the doc no)
// The doc no is the reliable half (GroupCode), so the caller first asks WC for every code with that GroupCode and this picks the one
// whose product code fits. The two systems are keyed by hand, so the code is not always spelled the same ("BDMB3A32F" in PFCM,
// "QPOPTD BDMB3A32F-T086" in WC): those are matched on the last word and reported as "partial".

const norm = (s) => String(s ?? "").toUpperCase().replace(/\s+/g, " ").trim();

/** "I8HPTD RCC822L2L - T087" -> { head: "I8HPTD RCC822L2L", tail: "T087" }; no dash -> tail "" */
const splitProductCode = (productCode) => {
  const s = String(productCode ?? "");
  const i = s.lastIndexOf("-");
  return i > 0 ? { head: s.slice(0, i).trim(), tail: s.slice(i + 1).trim() } : { head: s.trim(), tail: "" };
};

const lastWord = (s) => norm(s).split(" ").pop();
const MIN_WORD = 5; // a shorter last word ("TG1", "EX") is too common to identify a product

/** candidates = rows of WC that already share the plan's doc no. Returns { row, match: "exact" | "partial" } or null. */
const pickBest = (code, candidates) => {
  const wanted = norm(code);
  if (!wanted) return null;

  const exact = candidates.find((r) => norm(splitProductCode(r.productCode).head) === wanted);
  if (exact) return { row: exact, match: "exact" };

  // loose matching only for codes long enough to identify a product — showing the wrong customer is worse than showing none
  if (lastWord(wanted).length < MIN_WORD) return null;
  const partial =
    candidates.find((r) => norm(r.productCode).includes(wanted)) ||
    candidates.find((r) => lastWord(splitProductCode(r.productCode).head) === lastWord(wanted));
  return partial ? { row: partial, match: "partial" } : null;
};

module.exports = { norm, splitProductCode, pickBest };
