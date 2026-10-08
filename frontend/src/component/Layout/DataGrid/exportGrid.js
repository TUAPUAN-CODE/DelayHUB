import * as XLSX from "xlsx";
import { cellText } from "./gridUtils";

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};
const dataColumns = (columns) => columns.filter((c) => c.kind !== "tool" && c.exportable !== false);
const safeName = (s) => String(s || "table").replace(/[\\/:*?"<>|\s]+/g, "_");

/** Excel: the visible data columns, the rows after search / filter / sort (all pages) */
export const exportExcel = (title, columns, rows) => {
  const cols = dataColumns(columns);
  const aoa = [cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => cellText(c, r)))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = cols.map((c) => ({ wch: Math.max(8, Math.min(40, Math.round((c.width || 100) / 7))) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${safeName(title)}_${stamp()}.xlsx`);
};

/** PDF (A3 landscape, Thai font). jsPDF and the font are loaded only when the user presses the button. */
export const exportPdf = async (title, columns, rows) => {
  const [{ default: jsPDF }, { default: autoTable }, { thSarabunBase64 }, { thSarabunBoldBase64 }] = await Promise.all([
    import("jspdf"), import("jspdf-autotable"), import("../../../fonts/thSarabunBase64"), import("../../../fonts/thSarabunBoldBase64"),
  ]);
  const cols = dataColumns(columns);
  const doc = new jsPDF("l", "mm", "a3");
  doc.addFileToVFS("Sarabun-Regular.ttf", thSarabunBase64);
  doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
  doc.addFileToVFS("Sarabun-Bold.ttf", thSarabunBoldBase64);
  doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");
  doc.setFont("Sarabun", "bold");
  doc.setFontSize(14);
  doc.text(String(title).normalize("NFC"), 8, 10);
  doc.setFont("Sarabun", "normal");
  doc.setFontSize(9);
  doc.text(`${new Date().toLocaleString("th-TH")} · ${rows.length} รายการ`.normalize("NFC"), 8, 15);
  autoTable(doc, {
    startY: 18,
    head: [cols.map((c) => c.label.normalize("NFC"))],
    body: rows.map((r) => cols.map((c) => cellText(c, r).normalize("NFC"))),
    styles: { font: "Sarabun", fontSize: 7, cellPadding: 1, overflow: "linebreak" },
    headStyles: { font: "Sarabun", fontStyle: "bold", fillColor: [21, 82, 240], textColor: 255 },
    margin: { left: 6, right: 6 },
  });
  doc.save(`${safeName(title)}_${stamp()}.pdf`);
};
