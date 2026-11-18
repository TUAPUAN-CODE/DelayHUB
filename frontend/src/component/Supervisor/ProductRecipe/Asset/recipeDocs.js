// Shared by the on-screen document preview and the PDF export so both always show the same rows.
// A "document" is one printable form (one ISO number); MixType 0 is the solution / topping requisition sheet.

export const SOLUTION_SHEET_MIXTYPE = 0;

export const fmt = (v, digits = 4) => {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  return Number.isFinite(n) ? String(Number(n.toFixed(digits))) : String(v);
};

// ReportText may carry extra tick-box lines ("TYPE: [ ] CHUNK [ ] LOAF"); the title is the first line.
export const docTitle = (doc) => (doc?.reportText || "").split(/\r?\n/)[0].trim();

export const groupByMixType = (rows) => {
  const map = new Map();
  rows.forEach((r) => {
    if (!map.has(r.mixType)) map.set(r.mixType, []);
    map.get(r.mixType).push(r);
  });
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
};

const ingredientColumns = [
  { key: "seq", label: "#", align: "center", width: 10 },
  { key: "ingdntCode", label: "รหัส", width: 28 },
  { key: "ingdntName", label: "วัตถุดิบ" },
  { key: "stdWt", label: "Std", align: "right", width: 24 },
  { key: "minWt", label: "Min", align: "right", width: 24 },
  { key: "maxWt", label: "Max", align: "right", width: 24 },
  { key: "percentage", label: "%", align: "right", width: 20 },
];

const stepColumns = [
  { key: "no", label: "#", align: "center", width: 10 },
  { key: "text", label: "ขั้นตอน" },
];

const extraColumns = [
  { key: "name", label: "รายการ" },
  { key: "quantity", label: "ปริมาณ", align: "right", width: 28 },
  { key: "minVal", label: "Min", align: "right", width: 24 },
  { key: "maxVal", label: "Max", align: "right", width: 24 },
  { key: "flags", label: "หมายเหตุ", width: 34 },
];

export const ingredientRows = (rows) =>
  rows.map((r) => ({
    seq: r.seq,
    ingdntCode: r.ingdntCode || "-",
    ingdntName: r.ingdntName || "-",
    stdWt: fmt(r.stdWt),
    minWt: fmt(r.minWt),
    maxWt: fmt(r.maxWt),
    percentage: r.percentage ? fmt(r.percentage, 2) : "-",
  }));

export const stepRows = (rows) =>
  rows.map((r, i) => ({
    no: i + 1,
    text: [r.description, r.ingdntName && `(${r.ingdntName})`, r.alternateMaterialName && `ทดแทน: ${r.alternateMaterialName}`]
      .filter(Boolean)
      .join(" "),
  }));

export const extraRows = (rows) =>
  rows.map((r) => ({
    name: r.name || "-",
    quantity: fmt(r.quantity, 2),
    minVal: fmt(r.minVal, 2),
    maxVal: fmt(r.maxVal, 2),
    flags: [r.singleRound && "รอบเดียว", r.isNotUse && "ไม่ใช้"].filter(Boolean).join(", ") || "-",
  }));

export const ingredientTable = { columns: ingredientColumns, toRows: ingredientRows };
export const stepTable = { columns: stepColumns, toRows: stepRows };
export const extraTable = { columns: extraColumns, toRows: extraRows };

/** The sections that make up one printable document for this product (empty sections are left out). */
export function buildSections(detail, doc) {
  if (doc.mixType === SOLUTION_SHEET_MIXTYPE) {
    return [
      { key: "solutions", title: "สารละลาย (Solution)", columns: extraColumns, rows: extraRows(detail.solutions) },
      { key: "toppings", title: "ส่วนผสมเพิ่ม (Topping)", columns: extraColumns, rows: extraRows(detail.toppings) },
    ].filter((s) => s.rows.length);
  }
  const ing = detail.ingredients.filter((r) => r.mixType === doc.mixType);
  const steps = detail.mixSequences.filter((r) => r.mixType === doc.mixType);
  return [
    { key: "ingredients", title: "สูตรการผลิต", columns: ingredientColumns, rows: ingredientRows(ing) },
    { key: "steps", title: "ขั้นตอน / ลำดับการผสม", columns: stepColumns, rows: stepRows(steps) },
  ].filter((s) => s.rows.length);
}

export const productInfoLines = (h) => [
  ["ลูกค้า", h.customer || "-"],
  ["ตลาด", h.market || "-"],
  ["รหัสสินค้า", h.productCode],
  ["บรรจุภัณฑ์", [h.package, h.packageName].filter(Boolean).join(" / ") || "-"],
  ["Revision สูตร", h.revision || "-"],
];
