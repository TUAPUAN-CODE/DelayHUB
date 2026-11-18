import { buildSections, docTitle, productInfoLines } from "./recipeDocs";

const COMPANY = "i-Tail Corporation Public Company Limited";
const BRAND = [30, 64, 175];

// jsPDF + the Thai fonts are heavy; they are loaded only when someone exports.
async function loadPdfTools() {
  const [{ default: jsPDF }, { default: autoTable }, regular, bold] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("../../../../fonts/thSarabunBase64.js"),
    import("../../../../fonts/thSarabunBoldBase64.js"),
  ]);
  return { jsPDF, autoTable, regular: regular.thSarabunBase64, bold: bold.thSarabunBoldBase64 };
}

function registerFonts(doc, regular, bold) {
  doc.addFileToVFS("Sarabun-Regular.ttf", regular);
  doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
  doc.addFileToVFS("Sarabun-Bold.ttf", bold);
  doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");
  doc.setFont("Sarabun", "normal");
}

function drawDocument(doc, autoTable, detail, document, isFirst) {
  if (!isFirst) doc.addPage();
  const { header } = detail;
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Title band
  doc.setFont("Sarabun", "bold");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(COMPANY, margin, 12);
  doc.setFontSize(10);
  doc.text(document.iso || "", pageW - margin, 12, { align: "right" });
  doc.setFontSize(18);
  doc.setTextColor(...BRAND);
  doc.text(docTitle(document) || `MixType ${document.mixType}`, margin, 22);
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.6);
  doc.line(margin, 25, pageW - margin, 25);

  // Product block
  autoTable(doc, {
    startY: 29,
    body: productInfoLines(header),
    theme: "plain",
    styles: { font: "Sarabun", fontSize: 11, cellPadding: { top: 0.8, bottom: 0.8, left: 1, right: 1 } },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 32, textColor: [90, 90, 90] } },
    margin: { left: margin, right: margin },
  });

  const weights = [
    ["Target NW", header.targetNW],
    ["Target FW", header.targetFW],
    ["Label NW", header.labelNW],
  ].filter(([, v]) => Number(v) > 0);
  if (weights.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 2,
      head: [weights.map(([k]) => k)],
      body: [weights.map(([, v]) => String(Number(v)))],
      theme: "grid",
      styles: { font: "Sarabun", fontSize: 10.5, halign: "center" },
      headStyles: { fillColor: [241, 245, 249], textColor: 60, fontStyle: "bold" },
      margin: { left: margin, right: margin },
      tableWidth: 32 * weights.length,
    });
  }

  // Document sections
  buildSections(detail, document).forEach((section) => {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [
        [{ content: section.title, colSpan: section.columns.length, styles: { halign: "left", fillColor: BRAND, textColor: 255 } }],
        section.columns.map((c) => c.label),
      ],
      body: section.rows.map((r) => section.columns.map((c) => String(r[c.key] ?? ""))),
      theme: "grid",
      styles: { font: "Sarabun", fontSize: 10.5, cellPadding: 1.8, valign: "middle" },
      headStyles: { fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: Object.fromEntries(
        section.columns.map((c, i) => [i, { halign: c.align || "left", ...(c.width ? { cellWidth: c.width } : {}) }])
      ),
      didParseCell: (d) => {
        if (d.section === "head" && d.row.index === 1) {
          d.cell.styles.fillColor = [226, 232, 240];
          d.cell.styles.textColor = 40;
        }
      },
      margin: { left: margin, right: margin, bottom: 16 },
    });
  });

  // Sign-off lines
  const y = Math.min(doc.lastAutoTable.finalY + 18, doc.internal.pageSize.getHeight() - 24);
  doc.setFont("Sarabun", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  ["ผู้เตรียม", "ผู้ตรวจสอบ", "ผู้อนุมัติ"].forEach((label, i) => {
    const x = margin + i * ((pageW - margin * 2) / 3);
    doc.line(x, y, x + 48, y);
    doc.text(label, x, y + 5);
  });
}

function addFooters(doc, productCode) {
  const total = doc.internal.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const printed = new Date().toLocaleString("th-TH");
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("Sarabun", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(130);
    doc.text(`${productCode}  ·  พิมพ์เมื่อ ${printed}`, 14, h - 8);
    doc.text(`หน้า ${i} / ${total}`, w - 14, h - 8, { align: "right" });
  }
}

const safeName = (s) => String(s).replace(/[^\w.-]+/g, "_");

/** Export one or several documents of a product into a single PDF file. */
export async function exportRecipePdf(detail, documents) {
  if (!documents.length) return;
  const { jsPDF, autoTable, regular, bold } = await loadPdfTools();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  registerFonts(doc, regular, bold);
  documents.forEach((d, i) => drawDocument(doc, autoTable, detail, d, i === 0));
  addFooters(doc, detail.header.productCode);
  const suffix = documents.length === 1 ? safeName(documents[0].iso || `mix${documents[0].mixType}`) : "all-documents";
  doc.save(`${safeName(detail.header.productCode)}_${suffix}.pdf`);
}
