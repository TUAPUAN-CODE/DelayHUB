// ใบสรุปการสอบกลับ (PDF): สรุปว่า "วัตถุดิบ / รหัสรุ่น / ข้อมูลรับเข้า / ผู้ขาย / บรรจุภัณฑ์ / ส่วนผสม" ของข้อมูลที่เลือก (ตามตัวกรองจากหน้าค้นหา) มีอะไรบ้าง
// ไม่ใช่รายงาน Delay: ไม่มีคอลัมน์เวลา DBS / ดีเลย์
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../../../../assets/brand/itail-logo.png';
import { addThaiFonts, drawLogo, stampFooter } from './tracebackExport';
import { fmtDT, fmtD, fmtNum, loadImageDataUrl } from './tracebackCore';

const COMPANY = 'บริษัท ไอ-เทล คอร์ปอเรชั่น จำกัด (มหาชน)';
const BLUE = [11, 95, 165];
const ORANGE = [217, 88, 13];
const GREEN = [21, 128, 61];
const VIOLET = [91, 33, 182];
const dash = (v) => (v === null || v === undefined || String(v).trim() === '' ? '-' : String(v));
const uniq = (list) => [...new Set(list.filter((v) => v !== null && v !== undefined && String(v).trim() !== ''))];
const clip = (list, n = 6) => (list.length > n ? `${list.slice(0, n).join(', ')} … (+${list.length - n})` : list.join(', '));

/** เงื่อนไขที่ใช้สอบกลับ เป็นข้อความอ่านง่าย */
export const scopeText = (scope, s = {}) => {
  const parts = [];
  if (scope?.code) parts.push(`Code ${scope.code}`);
  if (scope?.batch) parts.push(`Batch ${scope.batch}`);
  if (scope?.doc_no) parts.push(`เอกสาร ${scope.doc_no}`);
  if (scope?.line) parts.push(`ไลน์ ${scope.line}`);
  if (scope?.mat) parts.push(`Mat ${scope.mat}`);
  if (scope?.mat_name) parts.push(`วัตถุดิบ ${scope.mat_name}`);
  if (scope?.supplier) parts.push(`ผู้ขาย ${scope.supplier}`);
  if (scope?.pack_from || scope?.pack_to) parts.push(`บรรจุ ${scope.pack_from || '…'} ถึง ${scope.pack_to || '…'}`);
  return parts.length ? parts.join(' · ') : `เอกสาร ${s.doc_no || '-'} · Code ${s.code || '-'}`;
};

/**
 * data = ผลของ /api/traceback/detail · scope = ตัวกรองที่ใช้ (หรือ null = สอบกลับตามเอกสารเดียว)
 * sign = { recordedBy, reviewedBy, qcManager, watermark } · opts = { qr, link }
 */
export const exportSummaryPDF = async (data, scope, sign = {}, opts = {}) => {
  const doc = new jsPDF('l', 'mm', 'a4');
  const logo = await loadImageDataUrl(logoUrl);
  addThaiFonts(doc);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const s = data.summary || {};
  const materials = data.materials || [];
  const rmRows = data.rm_rows || [];
  const ingRows = data.ingredient_rows || [];
  const pkgRows = data.packaging_rows || [];
  const byMapping = new Map(materials.map((m) => [m.mapping_id, m]));
  const docsOf = (ids = []) => uniq(ids.map((id) => byMapping.get(id)?.raw?.Production?.doc_no ?? byMapping.get(id)?.doc_no));
  const linesOf = (ids = []) => uniq(ids.map((id) => byMapping.get(id)?.rmm_line_name));

  const head = () => {
    drawLogo(doc, logo, 8, 4, 13);
    doc.setFont('Sarabun', 'bold'); doc.setFontSize(13); doc.setTextColor(8, 62, 107);
    doc.text(COMPANY, W / 2, 9, { align: 'center' });
    doc.setFontSize(11);
    doc.text('ใบสรุปการสอบกลับ · วัตถุดิบ ส่วนผสม บรรจุภัณฑ์ และผู้ขาย (Traceability Summary)', W / 2, 15, { align: 'center' });
    doc.setFont('Sarabun', 'normal'); doc.setFontSize(8.5); doc.setTextColor(39, 72, 102);
    doc.text(scopeText(scope, s), W / 2, 20, { align: 'center', maxWidth: W - 60 });
    doc.setDrawColor(...ORANGE); doc.setLineWidth(0.6); doc.line(8, 23, W - 8, 23);
    doc.setTextColor(0, 0, 0);
  };

  const base = (color) => ({
    styles: { font: 'Sarabun', fontSize: 8, cellPadding: 1.3, lineColor: [203, 223, 239], lineWidth: 0.1, textColor: [15, 39, 64], valign: 'middle' },
    headStyles: { font: 'Sarabun', fontStyle: 'bold', fillColor: color, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 249, 253] },
    margin: { left: 8, right: 8, top: 27, bottom: 12 },
    didDrawPage: head,
  });
  const section = (title, color, y) => {
    if (y > H - 40) { doc.addPage(); head(); y = 30; }
    doc.setFont('Sarabun', 'bold'); doc.setFontSize(11); doc.setTextColor(...color);
    doc.text(title, 8, y);
    doc.setTextColor(0, 0, 0);
    return y + 2;
  };

  // ── หน้าแรก: ข้อมูลทั่วไป ──
  head();
  const docNos = s.doc_nos?.length ? s.doc_nos : uniq([s.doc_no]);
  const codes = s.codes?.length ? s.codes : uniq([s.code]);
  autoTable(doc, {
    ...base(BLUE),
    startY: 27,
    theme: 'grid',
    body: [
      [{ content: 'เงื่อนไขที่สอบกลับ', styles: { fontStyle: 'bold', fillColor: [231, 241, 250] } }, { content: scopeText(scope, s), colSpan: 3 }],
      [{ content: 'เอกสารผลิต', styles: { fontStyle: 'bold', fillColor: [231, 241, 250] } }, `${docNos.length} เอกสาร: ${clip(docNos, 8)}`,
        { content: 'Code สินค้า', styles: { fontStyle: 'bold', fillColor: [231, 241, 250] } }, `${codes.length} Code: ${clip(codes, 8)}`],
      [{ content: 'ไลน์ผลิต', styles: { fontStyle: 'bold', fillColor: [231, 241, 250] } }, clip(s.lines || [], 10) || '-',
        { content: 'ช่วงเวลาบรรจุ', styles: { fontStyle: 'bold', fillColor: [231, 241, 250] } }, `${fmtD(s.pack_date_first)} – ${fmtD(s.pack_date_last)}`],
      [{ content: 'จำนวนล็อตวัตถุดิบ', styles: { fontStyle: 'bold', fillColor: [231, 241, 250] } }, `${fmtNum(s.material_count, 0)} ล็อต · น้ำหนักรวม ${fmtNum(s.total_weight_rm, 1)} kg`,
        { content: 'ผู้ขาย / ผู้ส่งมอบ', styles: { fontStyle: 'bold', fillColor: [231, 241, 250] } }, clip(s.supplier_list || [], 8) || '-'],
    ],
    columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 100 }, 2: { cellWidth: 34 }, 3: { cellWidth: 'auto' } },
  });

  // กล่องตัวเลขสรุป
  const ky = doc.lastAutoTable.finalY + 4;
  const kpis = [
    ['วัตถุดิบ (Mat + Batch)', rmRows.length, BLUE],
    ['ผู้ขาย', (s.supplier_list || []).length, GREEN],
    ['พบข้อมูลรับเข้า', `${s.intake_found_count ?? 0}/${s.material_count ?? 0} ล็อต`, GREEN],
    ['ส่วนผสม (ชนิด+Batch)', ingRows.length, VIOLET],
    ['บรรจุภัณฑ์ (Code+Lot)', pkgRows.length, ORANGE],
  ];
  const kw = (W - 16 - 4 * 3) / 5;
  kpis.forEach(([label, val, color], i) => {
    const x = 8 + i * (kw + 3);
    doc.setDrawColor(...color); doc.setLineWidth(0.4); doc.roundedRect(x, ky, kw, 14, 1.5, 1.5);
    doc.setFont('Sarabun', 'normal'); doc.setFontSize(8); doc.setTextColor(60, 80, 100);
    doc.text(label, x + 3, ky + 5);
    doc.setFont('Sarabun', 'bold'); doc.setFontSize(13); doc.setTextColor(...color);
    doc.text(String(val), x + 3, ky + 11.5);
  });
  doc.setTextColor(0, 0, 0);
  let y = ky + 20;

  // ── 1. วัตถุดิบและรหัสรุ่น ──
  y = section('1. วัตถุดิบและรหัสรุ่น (Raw Material · Batch)', BLUE, y);
  autoTable(doc, {
    ...base(BLUE),
    startY: y,
    head: [['Mat', 'ชื่อวัตถุดิบ', 'Batch', 'Batch 2x', 'น้ำหนัก (kg)', 'ล็อต', 'ช่วงที่ใช้', 'ไลน์', 'เอกสารผลิต']],
    body: rmRows.length ? rmRows.map((r) => [
      dash(r.mat), dash(r.mat_name), dash(r.batch_before), dash(r.batch_after === r.batch_before ? '' : r.batch_after),
      fmtNum(r.weight, 1), r.count, `${fmtD(r.used_from)} – ${fmtD(r.used_to)}`,
      clip(linesOf(r.mapping_ids), 4) || '-', clip(docsOf(r.mapping_ids), 3) || '-',
    ]) : [['—', 'ไม่มีข้อมูลวัตถุดิบ', '', '', '', '', '', '', '']],
    columnStyles: { 2: { fontStyle: 'bold' }, 4: { halign: 'right' }, 5: { halign: 'center' } },
  });

  // ── 2. ข้อมูลรับเข้าและผู้ขาย (1 แถวต่อ Batch) ──
  y = section('2. ข้อมูลรับเข้าและผู้ขาย (Intake · Supplier)', GREEN, doc.lastAutoTable.finalY + 8);
  const intakeByBatch = new Map();
  materials.forEach((m) => {
    const k = `${m.mat}|${m.batch_before || ''}`;
    if (!intakeByBatch.has(k) || (!intakeByBatch.get(k).intake && m.intake)) intakeByBatch.set(k, m);
  });
  const rmByKey = new Map(rmRows.map((r) => [`${r.mat}|${r.batch_before || ''}`, r]));
  autoTable(doc, {
    ...base(GREEN),
    startY: y,
    styles: { ...base(GREEN).styles, fontSize: 7.2 },
    head: [['Batch', 'Mat', 'ผู้ขาย / ผู้ส่งมอบ', 'วันรับเข้า', 'วันหมดอายุ', 'ชนิด / ขนาด', 'จำนวนรับ', 'Inspection lot', 'ผลตรวจรับ', 'ข้อบกพร่อง', 'อุณหภูมิ (°C)', 'ผู้ตรวจ', 'ทะเบียนรถ']],
    body: intakeByBatch.size ? [...intakeByBatch.values()].map((m) => {
      const r = rmByKey.get(`${m.mat}|${m.batch_before || ''}`) || {};
      const sup = [m.supplier_name || r.vendor_name, m.supplier_code ? `(${m.supplier_code})` : '', r.supplier_address].filter(Boolean).join(' ');
      if (!m.intake) return [dash(m.batch_before), dash(m.mat), dash(sup), { content: 'ไม่พบในระบบรับเข้า', colSpan: 10, styles: { textColor: [168, 30, 20], fontStyle: 'bold' } }];
      return [
        dash(m.batch_before), dash(m.mat), dash(sup), fmtD(m.batch_date), fmtD(m.expiration_date),
        dash([m.fish_specie, m.fish_size].filter(Boolean).join(' / ')),
        m.receive_qty != null ? `${fmtNum(m.receive_qty, 1)} ${m.receive_unit || ''}` : '-',
        dash(m.intake_inspection_lot), dash(m.intake_decision), dash(m.intake_defect),
        m.intake_temp_avg != null ? fmtNum(m.intake_temp_avg, 1) : '-', dash(m.intake_inspector), dash(m.intake_truck),
      ];
    }) : [['—', '', 'ไม่มีข้อมูลรับเข้า', '', '', '', '', '', '', '', '', '', '']],
    columnStyles: { 0: { fontStyle: 'bold' } },
  });

  // ── 3. บรรจุภัณฑ์ ──
  y = section('3. บรรจุภัณฑ์ (Packaging · PKG)', ORANGE, doc.lastAutoTable.finalY + 8);
  autoTable(doc, {
    ...base(ORANGE),
    startY: y,
    head: [['Code', 'Material No', 'Batch', 'Lot', 'ไลน์', 'รับ', 'ใช้', 'เสีย', 'คงเหลือ', 'วันผลิตวัสดุ', 'วันรับวัสดุ', 'ช่วงใช้บนไลน์']],
    body: pkgRows.length ? pkgRows.map((p) => [
      dash(p.code), dash(p.material_no), dash(p.batch_no), dash(p.lot_no), dash(p.line_name),
      fmtNum(p.qty_received, 0), fmtNum(p.qty_used, 0), fmtNum(p.qty_damaged, 0), fmtNum(p.qty_remaining, 0),
      fmtD(p.produce_date), fmtD(p.receive_date), `${fmtDT(p.used_from)} → ${fmtDT(p.used_to)}`,
    ]) : [['—', 'ไม่พบบรรจุภัณฑ์ที่ครอบคลุมเวลาบรรจุ', '', '', '', '', '', '', '', '', '', '']],
    columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
  });

  // ── 4. ส่วนผสม ──
  y = section('4. ส่วนผสม (Ingredient)', VIOLET, doc.lastAutoTable.finalY + 8);
  autoTable(doc, {
    ...base(VIOLET),
    startY: y,
    head: [['รหัส', 'ชื่อส่วนผสม', 'Batch', 'น้ำหนักรวม (kg)', 'ตะกร้า', 'หลุดพิกัด', 'WO', 'ช่วงที่ใช้']],
    body: ingRows.length ? ingRows.map((g) => [
      dash(g.material_code), dash(g.material_name), dash(g.batch_no), fmtNum(g.net_weight, 3), g.basket_count,
      g.out_of_spec_count ? `! ${g.out_of_spec_count}` : '0', clip(g.wo_list || [], 4) || '-', `${fmtDT(g.used_from)} → ${fmtDT(g.used_to)}`,
    ]) : [['—', 'ไม่มีข้อมูลส่วนผสมที่ผูกกับข้อมูลนี้', '', '', '', '', '', '']],
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'center' } },
    didParseCell: (h) => {
      if (h.section === 'body' && h.column.index === 5 && String(h.cell.raw).startsWith('!')) { h.cell.styles.textColor = [168, 30, 20]; h.cell.styles.fontStyle = 'bold'; }
    },
  });

  // ── ลงนาม + QR ──
  let sy = doc.lastAutoTable.finalY + 12;
  if (sy > H - 50) { doc.addPage(); head(); sy = 40; }
  [['ผู้จัดทำ (Recorded by)', sign.recordedBy, 45], ['ผู้ตรวจสอบ (Reviewed by)', sign.reviewedBy, W / 2], ['ผู้อนุมัติ (QC Manager)', sign.qcManager, W - 45]].forEach(([lb, name, x]) => {
    doc.setDrawColor(0); doc.setLineWidth(0.2);
    doc.line(x - 32, sy + 10, x + 32, sy + 10);
    doc.setFont('Sarabun', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    if (name) doc.text(String(name), x, sy + 8.5, { align: 'center' });
    doc.setFont('Sarabun', 'normal'); doc.setFontSize(8.5);
    doc.text(lb, x, sy + 15, { align: 'center' });
    doc.text('วันที่ / Date', x, sy + 21, { align: 'center' });
  });
  if (opts.qr) doc.addImage(opts.qr, 'PNG', 8, sy - 2, 22, 22);
  doc.setFont('Sarabun', 'normal'); doc.setFontSize(7); doc.setTextColor(90, 100, 115);
  doc.text('เอกสารนี้สร้างจากระบบ PFCM อัตโนมัติ มีข้อมูลเชิงพาณิชย์ที่เป็นความลับ ใช้ภายในองค์กรเท่านั้น', 8, sy + 27);
  if (opts.link) doc.text(`เปิดข้อมูลนี้ในระบบ: ${opts.link.length > 150 ? `${opts.link.slice(0, 150)}…` : opts.link}`, 8, sy + 31, { maxWidth: W - 16 });

  stampFooter(doc, sign?.watermark || '');
  const tag = (scope?.code || scope?.batch || s.doc_no || 'summary').toString().replace(/[^\w.-]+/g, '_');
  doc.save(`TracebackSummary_${tag}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
