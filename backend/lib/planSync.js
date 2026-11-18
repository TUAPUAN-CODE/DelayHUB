// Production plans that exist only in the recipe database (WC, TunaCodes) and the rule that turns one into a PFCM plan (table Production).
// Pure functions: the routes do the SQL, this decides — so the decision is testable without a database.
//
//   WC TunaCodes:  ProductCode "I8HPTD RCC822L2L - T087"  GroupCode "T087"  PackageName "Can"
//   PFCM Production: code "I8HPTD RCC822L2L"  doc_no "T087"  line_type_id 2
const { norm, splitProductCode, pickBest } = require("./planMatch");

// Production.doc_no is varchar(5) and Production.code varchar(50): a longer value would be refused by SQL Server (or cut by a driver)
const DOC_NO_MAX = 5;
const CODE_MAX = 50;

// LineType of PFCM: 1 cup · 2 can · 3 pouch · 13 unknown. WC has no such column, only the package name. Checked against the plans that
// already exist in both systems (Can -> 2: 77 of 77, cups -> 1: all, Pouch / Sachet / Spout -> 3: 93-99%).
const LINE_CUP = 1;
const LINE_CAN = 2;
const LINE_POUCH = 3;
const LINE_UNKNOWN = 13;
const LINE_TYPE_NAMES = { [LINE_CUP]: "cup", [LINE_CAN]: "can", [LINE_POUCH]: "pouch", [LINE_UNKNOWN]: "ไม่ทราบ Line" };

const lineTypeFromPackage = (packageName) => {
  const s = String(packageName ?? "");
  if (/cup|tub/i.test(s)) return LINE_CUP;
  if (/\bcan\b/i.test(s)) return LINE_CAN;
  if (/pouch|sachet|spout|twins/i.test(s)) return LINE_POUCH;
  return LINE_UNKNOWN;
};

/** The PFCM plan a WC product would become, and whether it can be created at all (reason = why not, in Thai). */
const planFromWc = (wc) => {
  const code = splitProductCode(wc.productCode).head;
  const docNo = String(wc.groupCode ?? "").trim();
  let reason = "";
  if (!code) reason = "ไม่มีรหัสสินค้า";
  else if (!docNo) reason = "ไม่มีเลขที่เอกสาร";
  else if (docNo.length > DOC_NO_MAX) reason = `เลขที่เอกสารยาวเกิน ${DOC_NO_MAX} ตัวอักษร`;
  else if (code.length > CODE_MAX) reason = `รหัสสินค้ายาวเกิน ${CODE_MAX} ตัวอักษร`;
  const lineTypeId = lineTypeFromPackage(wc.packageName);
  return {
    wc_code_id: wc.codeId,
    code,
    doc_no: docNo,
    line_type_id: lineTypeId,
    line_type_name: LINE_TYPE_NAMES[lineTypeId],
    selectable: !reason,
    reason,
  };
};

/** plans = rows of Production. Plans by doc no, so each WC product is only compared with the plans of its own document. */
const indexPlansByDocNo = (plans) => {
  const map = new Map();
  plans.forEach((p) => {
    const key = norm(p.doc_no);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  });
  return map;
};

/** The existing plan this WC product already is (same doc no, same code by the matching rule of planMatch), or null. */
const findExistingPlan = (wc, plansByDocNo) =>
  (plansByDocNo.get(norm(wc.groupCode)) || []).find((p) => pickBest(p.code, [wc])) || null;

/** WC products that have no plan in PFCM yet, as plan-shaped rows for the plan lists of the modals. */
const wcOnlyPlans = (wcRows, plans) => {
  const index = indexPlansByDocNo(plans);
  return wcRows.filter((wc) => !findExistingPlan(wc, index)).map(planFromWc);
};

/**
 * What to do when someone picks this WC product: use the plan that already exists, create it, or refuse (with the reason).
 * The existing-plan check is repeated here (not only when the list was built) because another user may have created it since.
 */
const decidePlan = (wc, plans) => {
  const existing = findExistingPlan(wc, indexPlansByDocNo(plans));
  if (existing) return { action: "reuse", prod_id: existing.prod_id, code: existing.code, doc_no: existing.doc_no, line_type_id: existing.line_type_id };
  const plan = planFromWc(wc);
  if (!plan.selectable) return { action: "reject", reason: plan.reason };
  return { action: "create", plan };
};

module.exports = { DOC_NO_MAX, CODE_MAX, LINE_UNKNOWN, LINE_TYPE_NAMES, lineTypeFromPackage, planFromWc, wcOnlyPlans, decidePlan, findExistingPlan, indexPlansByDocNo };
