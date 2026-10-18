// Export ของ Traceback: PDF (ใบสอบกลับ / ผลกระทบ forward / โปรโตคอลเรียกคืน) และ Excel
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { thSarabunBase64 } from '../../../../fonts/thSarabunBase64';
import { thSarabunBoldBase64 } from '../../../../fonts/thSarabunBoldBase64';
import logoUrl from '../../../../assets/brand/itail-logo.png';
import {
  fmtDT, fmtD, fmtDur, fmtNum, buildDelay, chainCompleteness, riskAssessment,
  loadImageDataUrl, currentUserName, STAGE_LABEL,
} from './tracebackCore';

const COMPANY = 'บริษัท ไอ-เทล คอร์ปอเรชั่น จำกัด (มหาชน)';
const HEAD_BLUE = [11, 95, 165];
const HEAD_ORANGE = [217, 88, 13];
const stamp = () => new Date().toISOString().slice(0, 10);

export const addThaiFonts = (doc) => {
  doc.addFileToVFS('Sarabun-Regular.ttf', thSarabunBase64);
  doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
  doc.addFileToVFS('Sarabun-Bold.ttf', thSarabunBoldBase64);
  doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
  doc.setFont('Sarabun', 'normal');
};

/** วางโลโก้ i-Tail (พื้นโปร่งใส) สูง h มม. คงสัดส่วน */
export const drawLogo = (doc, logo, x, y, h) => {
  if (!logo) return 0;
  const w = (logo.w / logo.h) * h;
  doc.addImage(logo.data, 'PNG', x, y, w, h);
  return w;
};

/** ท้ายทุกหน้า: ผู้พิมพ์ + เวลา + เลขหน้า (ใช้เป็นหลักฐาน audit trail) */
const stampFooter = (doc, watermark = '') => {
  const n = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const who = currentUserName();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    if (watermark) {
      // ลายน้ำสถานะเอกสาร (สำเนาควบคุม / ไม่ควบคุม / ใช้ภายใน)
      doc.saveGraphicsState();
      if (doc.GState) doc.setGState(new doc.GState({ opacity: 0.12 }));
      doc.setFont('Sarabun', 'bold'); doc.setFontSize(60); doc.setTextColor(168, 30, 20);
      doc.text(watermark, W / 2, H / 2, { align: 'center', angle: 30 });
      doc.restoreGraphicsState();
    }
    doc.setFont('Sarabun', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(60, 80, 100);
    doc.text(`พิมพ์โดย ${who || '-'} · ${fmtDT(new Date().toISOString())} · ระบบ PFCM Traceback`, 6, H - 3);
    doc.text(`หน้า ${i} / ${n}`, W - 6, H - 3, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
};

const tableStyle = (head = HEAD_BLUE) => ({
  styles: { font: 'Sarabun', fontSize: 8, cellPadding: 1.2, lineColor: [203, 223, 239], lineWidth: 0.1, textColor: [15, 39, 64] },
  headStyles: { font: 'Sarabun', fontStyle: 'bold', fillColor: head, textColor: 255 },
  alternateRowStyles: { fillColor: [245, 249, 253] },
  margin: { left: 8, right: 8, top: 22, bottom: 10 },
});

/** หัวหน้าแบบย่อสำหรับหน้ารายงานเสริม */
const miniHeader = (doc, logo, title, sub) => {
  const W = doc.internal.pageSize.getWidth();
  drawLogo(doc, logo, 8, 4, 12);
  doc.setFont('Sarabun', 'bold'); doc.setFontSize(13); doc.setTextColor(8, 62, 107);
  doc.text(title, W / 2, 10, { align: 'center' });
  doc.setFont('Sarabun', 'normal'); doc.setFontSize(9); doc.setTextColor(39, 72, 102);
  if (sub) doc.text(sub, W / 2, 15.5, { align: 'center' });
  doc.setDrawColor(...HEAD_ORANGE); doc.setLineWidth(0.6); doc.line(8, 18, W - 8, 18);
  doc.setTextColor(0, 0, 0);
};

const sectionTitle = (doc, y, t) => {
  doc.setFont('Sarabun', 'bold'); doc.setFontSize(11); doc.setTextColor(8, 62, 107);
  doc.text(t, 8, y);
  doc.setTextColor(0, 0, 0);
  return y + 2;
};

/** ภาคผนวกของใบสอบกลับ: ความครบถ้วน/ความเสี่ยง, ส่วนผสม, บรรจุภัณฑ์, ไทม์ไลน์ */
const appendixPages = (doc, data, { docNo, code, logo, qr, link }) => {
  const s = data.summary || {};
  const materials = data.materials || [];
  const sub = `เอกสาร ${docNo || s.doc_no || '-'} · Code ${code || s.code || '-'}`;
  const W = doc.internal.pageSize.getWidth();

  // หน้า A: คะแนนความครบถ้วน + ความเสี่ยง + QR
  doc.addPage();
  miniHeader(doc, logo, 'ภาคผนวก A · ความครบถ้วนของห่วงโซ่ และระดับความเสี่ยง', sub);
  const cc = chainCompleteness(materials);
  const rk = riskAssessment(materials);
  let y = sectionTitle(doc, 26, `คะแนนความครบถ้วน ${cc.score}%   ·   ระดับความเสี่ยง ${rk.label}`);
  autoTable(doc, {
    ...tableStyle(),
    startY: y + 1,
    tableWidth: W / 2 - 12,
    head: [['รายการตรวจ', 'ครบ', 'ทั้งหมด', '%']],
    body: cc.items.map(i => [i.label, i.ok, i.total, `${i.pct}%`]),
  });
  autoTable(doc, {
    ...tableStyle(HEAD_ORANGE),
    startY: y + 1,
    margin: { ...tableStyle().margin, left: W / 2 + 4 },
    head: [['เหตุผลของระดับความเสี่ยง']],
    body: (rk.reasons.length ? rk.reasons : ['ไม่พบประเด็นเสี่ยงจากข้อมูลที่บันทึก']).map(r => [r]),
  });
  if (qr) {
    const qy = Math.max(doc.lastAutoTable.finalY, 80) + 8;
    doc.addImage(qr, 'PNG', 8, qy, 28, 28);
    doc.setFontSize(8);
    doc.text('สแกนเพื่อเปิดใบสอบกลับนี้ในระบบ', 40, qy + 8);
    if (link) doc.text(link.length > 120 ? `${link.slice(0, 120)}…` : link, 40, qy + 13);
  }

  // หน้า B: ส่วนผสม
  const ing = data.ingredient_rows || [];
  doc.addPage();
  miniHeader(doc, logo, 'ภาคผนวก B · ส่วนผสม (Ingredient) ที่ใช้ในการผลิต', sub);
  autoTable(doc, {
    ...tableStyle(),
    startY: 22,
    head: [['รหัส', 'ชื่อส่วนผสม', 'Batch', 'น้ำหนักรวม (kg)', 'มาตรฐาน/ตะกร้า', 'ตะกร้า', 'หลุดพิกัด', 'WO', 'ช่วงเวลาผสม']],
    body: ing.length ? ing.map(g => [
      g.material_code, g.material_name || '', g.batch_no || '-', fmtNum(g.net_weight, 3), fmtNum(g.std_weight, 3),
      g.basket_count, g.out_of_spec_count || 0, (g.wo_list || []).join(', '), `${fmtDT(g.used_from)} → ${fmtDT(g.used_to)}`,
    ]) : [['—', 'ไม่มีข้อมูลส่วนผสมที่ผูกกับเอกสารนี้', '', '', '', '', '', '', '']],
  });

  // หน้า C: บรรจุภัณฑ์
  const pkg = data.packaging_rows || [];
  doc.addPage();
  miniHeader(doc, logo, 'ภาคผนวก C · บรรจุภัณฑ์ (Packaging) ที่ใช้ตอนบรรจุ', sub);
  autoTable(doc, {
    ...tableStyle(),
    startY: 22,
    head: [['Code', 'Material No', 'Batch', 'Lot', 'HU', 'ไลน์', 'ใช้', 'เสีย', 'ช่วงใช้บนไลน์', 'วันผลิตวัสดุ']],
    body: pkg.length ? pkg.map(p => [
      p.code || '', p.material_no || '', p.batch_no || '', p.lot_no || '', p.hu_no || '', p.line_name || '',
      fmtNum(p.qty_used, 0), fmtNum(p.qty_damaged, 0), `${fmtDT(p.used_from)} → ${fmtDT(p.used_to)}`, fmtD(p.produce_date),
    ]) : [['—', 'ไม่พบบรรจุภัณฑ์ที่ครอบคลุมเวลาบรรจุ', '', '', '', '', '', '', '', '']],
  });

  // หน้า D: ไทม์ไลน์รายล็อต
  doc.addPage();
  miniHeader(doc, logo, 'ภาคผนวก D · จุดบันทึกเวลารายล็อต และดีเลย์ DBS', sub);
  autoTable(doc, {
    ...tableStyle(),
    startY: 22,
    styles: { ...tableStyle().styles, fontSize: 7 },
    head: [['mapping', 'Mat', 'Batch', ...Object.values(STAGE_LABEL), 'DBS1', 'DBS2', 'DBS3', 'DBS4']],
    body: materials.map(m => {
      const d = buildDelay(m);
      return [
        m.mapping_id, m.mat, m.batch_before || '-',
        ...Object.keys(STAGE_LABEL).map(k => (d.mapped[k] ? fmtDT(d.mapped[k]) : '')),
        ...['dbs1', 'dbs2', 'dbs3', 'dbs4'].map(k => (d.value[k] == null ? '-' : `${d.over[k] ? '! ' : ''}${fmtDur(d.value[k])}`)),
      ];
    }),
    didParseCell: (h) => {
      if (h.section === 'body' && typeof h.cell.raw === 'string' && h.cell.raw.startsWith('! ')) {
        h.cell.styles.textColor = [168, 30, 20];
        h.cell.styles.fontStyle = 'bold';
      }
    },
  });
};

/* ═══ Export PDF — ฟอร์มทางการ ════════════════════════════════════════════ */
export const exportRecordPDF = async (data, docNo, code, sign, opts = {}) => {
  const doc = new jsPDF('l', 'mm', 'a4');
  const logo = await loadImageDataUrl(logoUrl);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 6;

  addThaiFonts(doc);

  const rect = (x, y, w, h) => { doc.setDrawColor(0); doc.setLineWidth(0.15); doc.rect(x, y, w, h); };
  const fill = (x, y, w, h, c) => { doc.setFillColor(...c); doc.rect(x, y, w, h, 'F'); };
  const text = (t, x, y, o = {}) => {
    const { size = 8, align = 'center', bold = false, color = [0, 0, 0] } = o;
    doc.setFont('Sarabun', bold ? 'bold' : 'normal');
    doc.setFontSize(size); doc.setTextColor(...color);
    doc.text(String(t ?? '').normalize('NFC'), x, y, { align });
  };
  const cell = (t, x, y, w, h, o = {}) => {
    const { bg, size = 7, bold = false, align = 'center', color = [0, 0, 0] } = o;
    if (bg) fill(x, y, w, h, bg);
    rect(x, y, w, h);
    const lines = String(t ?? '').split('\n');
    const lh = size * 0.45;
    const sy = y + (h - lines.length * lh) / 2 + lh * 0.85;
    lines.forEach((ln, i) => {
      const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 1.5 : x + 1.5;
      text(ln, tx, sy + i * lh, { size, bold, align, color });
    });
  };

  const HB = [231, 241, 250];   // ฟ้าอ่อน
  const OB = [255, 240, 227];   // ส้มอ่อน
  const RB = [253, 235, 233];   // แดงอ่อน

  const s = data.summary || {};
  const materials = data.materials || [];
  const rows = 14;

  // ── layout ──
  const tX = M, tY = 32, tW = W - M * 2;
  const cMat = 15, cMat2 = 15, cName = 30, cBatch = 20, bCols = 10, bW = cBatch / bCols;
  const cBatch2 = 19;
  const cStruct = 16, cRecv = 15, cGrp = 13, cWt = 12, cLine = 12;
  const cA = 16, cF = 16;
  const cD1 = 12, cD2 = 12, cD3 = 12, cD4 = 12;
  const cRem = tW - (cMat + cMat2 + cName + cBatch + cBatch2 + cStruct + cRecv + cGrp + cWt + cLine + cA + cF + cD1 + cD2 + cD3 + cD4);
  const h1 = 6, h2 = 11, hH = h1 + h2;
  const rowH = Math.floor(((H - (tY + hH) - 62) / rows) * 10) / 10;

  const header = (page, total) => {
    text('บริษัท ไอ-เทล คอร์ปอเรชั่น จำกัด (มหาชน)', W / 2, 11, { size: 15, bold: true });
    text('ใบสอบกลับการผลิต (Traceability / Traceback Record)', W / 2, 18, { size: 11, bold: true });
    text('F3PFTB01-1', W - M, 11, { size: 8, align: 'right' });
    drawLogo(doc, logo, M, 3, 15);


    const y = 25;
    const items = [
      ['เลขเอกสารผลิต:', docNo || s.doc_no, 32],
      ['Code สินค้า:', code || s.code, 48],
      ['ไลน์ผลิต:', (s.lines || []).join(', '), 40],
      ['ช่วงเวลาที่สอบกลับ:', `${fmtD(s.rm_date_first || s.pack_date_first)} - ${fmtD(s.pack_date_last)}`, 48],
    ];
    let x = M;
    items.forEach(([lb, val, w]) => {
      text(lb, x, y, { size: 8, align: 'left', bold: true });
      const lw = doc.getTextWidth(lb);
      const x1 = x + lw + 1.5, x2 = x1 + w;
      doc.setDrawColor(0); doc.setLineWidth(0.2); doc.line(x1, y + 1, x2, y + 1);
      if (val) text(val, x1 + w / 2, y - 0.5, { size: 8 });
      x = x2 + 5;
    });
    text(`หน้า ${page} / ${total}`, W - M, y, { size: 8, align: 'right' });
  };

  const tableHead = () => {
    let x = tX; const y = tY;
    cell('รหัส\nวัตถุดิบ', x, y, cMat, hH, { bg: HB, bold: true, size: 6.5 }); x += cMat;
    cell('รหัส\nวัตถุดิบ 2x', x, y, cMat2, hH, { bg: OB, bold: true, size: 6.5 }); x += cMat2;
    cell('ชื่อวัตถุดิบ\n(Raw Material)', x, y, cName, hH, { bg: HB, bold: true, size: 6.5 }); x += cName;
    fill(x, y, cBatch, h1, HB); rect(x, y, cBatch, h1);
    text('รหัสรุ่น (Batch)', x + cBatch / 2, y + h1 / 2 + 1.6, { size: 6.5, bold: true });
    for (let i = 0; i < bCols; i++) cell('', x + i * bW, y + h1, bW, h2, { bg: HB, size: 6 });
    x += cBatch;
    cell('รหัสรุ่น 2x\n(Batch 2x)', x, y, cBatch2, hH, { bg: OB, bold: true, size: 6.5 }); x += cBatch2;
    cell('ผู้ขาย /\nผู้ส่งมอบ', x, y, cStruct, hH, { bg: OB, bold: true, size: 6.5 }); x += cStruct;
    cell('วันที่ล็อต\n(รับเข้า)', x, y, cRecv, hH, { bg: OB, bold: true, size: 6.5 }); x += cRecv;
    cell('กลุ่ม\nวัตถุดิบ', x, y, cGrp, hH, { bg: HB, bold: true, size: 6.5 }); x += cGrp;
    cell('น้ำหนัก\n(kg)', x, y, cWt, hH, { bg: HB, bold: true, size: 6.5 }); x += cWt;
    cell('ไลน์', x, y, cLine, hH, { bg: HB, bold: true, size: 6.5 }); x += cLine;
    cell('เตรียมเสร็จ\n(A)', x, y, cA, hH, { bg: HB, bold: true, size: 6.5 }); x += cA;
    cell('บรรจุเสร็จ\n(F)', x, y, cF, hH, { bg: HB, bold: true, size: 6.5 }); x += cF;
    const dW = cD1 + cD2 + cD3 + cD4;
    fill(x, y, dW, h1, OB); rect(x, y, dW, h1);
    text('ดีเลย์ (Delay time)', x + dW / 2, y + h1 / 2 + 1.6, { size: 6.5, bold: true });
    [['DBS1', cD1], ['DBS2', cD2], ['DBS3', cD3], ['DBS4', cD4]].forEach(([l, w]) => {
      cell(l, x, y + h1, w, h2, { bg: OB, bold: true, size: 6.5 }); x += w;
    });
    cell('หมายเหตุ\n(Remark)', x, y, cRem, hH, { bg: HB, bold: true, size: 6.5 });
  };

  const footer = () => {
    const fy = tY + hH + rows * rowH + 6;
    text('เกณฑ์ดีเลย์: DBS1 เตรียมเสร็จ→เข้าห้องเย็น | DBS2 เข้าห้องเย็น→ออกห้องเย็น | DBS3 ออกห้องเย็น→บรรจุเสร็จ | DBS4 รวมทั้งกระบวนการ',
      M, fy, { size: 7, align: 'left' });
    text('ช่องที่แรเงาและมีเครื่องหมาย ! คือค่าที่เกินมาตรฐานของกลุ่มวัตถุดิบนั้น', M, fy + 4, { size: 7, align: 'left' });
    text('เอกสารนี้สร้างจากระบบ PFCM อัตโนมัติ มีข้อมูลเชิงพาณิชย์ที่เป็นความลับ ใช้ภายในองค์กรเท่านั้น',
      M, fy + 8, { size: 7, align: 'left' });

    const sy = fy + 20;
    [
      ['ผู้จัดทำ (Recorded by)', sign.recordedBy, M + 45],
      ['ผู้ตรวจสอบ (Reviewed by)', sign.reviewedBy, W / 2],
      ['ผู้อนุมัติ (QC Manager)', sign.qcManager, W - M - 45],
    ].forEach(([lb, name, x]) => {
      doc.setDrawColor(0); doc.setLineWidth(0.2);
      doc.line(x - 32, sy, x + 32, sy);
      if (name) text(name, x, sy - 1.5, { size: 8, bold: true });
      text(lb, x, sy + 5, { size: 8 });
      doc.line(x - 32, sy + 12, x + 32, sy + 12);
      text('วันที่ / Date', x, sy + 17, { size: 7.5 });
    });
  };

  const total = Math.max(1, Math.ceil(materials.length / rows));
  for (let p = 1; p <= total; p++) {
    if (p > 1) doc.addPage();
    header(p, total);
    tableHead();

    const slice = materials.slice((p - 1) * rows, p * rows);
    slice.forEach((m, i) => {
      const y = tY + hH + i * rowH;
      const bgRow = i % 2 ? [246, 250, 253] : [255, 255, 255];
      const d = buildDelay(m);
      let x = tX;
      const c = (t, w, o = {}) => { cell(t, x, y, w, rowH, { bg: bgRow, size: 6.5, ...o }); x += w; };
      const cOver = (t, w, over) => {
        cell(over ? `! ${t}` : t, x, y, w, rowH,
          { bg: over ? RB : bgRow, size: 6.5, bold: over, color: over ? [168, 30, 20] : [0, 0, 0] });
        x += w;
      };

      c(m.mat, cMat);
      c(m.mat_2x || '-', cMat2);
      c(m.mat_name, cName, { align: 'left' });
      const bs = String(m.batch_before ?? '').padEnd(bCols, ' ');
      for (let b = 0; b < bCols; b++) c(bs[b] || '', bW, { size: 7, bold: true });
      c(m.batch_after || '-', cBatch2, { size: 6 });
      c(m.supplier_name || '-', cStruct, { size: 5.5, align: 'left' });
      c(m.batch_date ? fmtD(m.batch_date) : '-', cRecv, { size: 6 });
      c(m.rm_group_name || m.rm_group_id || '-', cGrp, { size: 6 });
      c(m.weight_RM != null ? Number(m.weight_RM).toFixed(1) : '-', cWt);
      c(m.rmm_line_name || '-', cLine, { size: 6 });
      c(d.mapped._A ? fmtDT(d.mapped._A).replace(' ', '\n') : '-', cA, { size: 5.8 });
      c(d.mapped._F ? fmtDT(d.mapped._F).replace(' ', '\n') : '-', cF, { size: 5.8 });
      cOver(d.value.dbs1 == null ? '-' : fmtDur(d.value.dbs1), cD1, d.over.dbs1);
      cOver(d.value.dbs2 == null ? '-' : fmtDur(d.value.dbs2), cD2, d.over.dbs2);
      cOver(d.value.dbs3 == null ? '-' : fmtDur(d.value.dbs3), cD3, d.over.dbs3);
      cOver(d.value.dbs4 == null ? '-' : fmtDur(d.value.dbs4), cD4, d.over.dbs4);
      c(m.history?.remark_dalay || '', cRem, { align: 'left', size: 6 });
    });

    for (let e = slice.length; e < rows; e++) {
      const y = tY + hH + e * rowH;
      let x = tX;
      [cMat, cMat2, cName, ...Array(bCols).fill(bW), cBatch2, cStruct, cRecv, cGrp, cWt, cLine, cA, cF, cD1, cD2, cD3, cD4, cRem]
        .forEach(w => { rect(x, y, w, rowH); x += w; });
    }

    footer();
  }

  appendixPages(doc, data, { docNo, code, logo, qr: opts.qr, link: opts.link });
  stampFooter(doc, sign?.watermark || '');
  doc.save(`Traceback_${docNo || s.doc_no || 'record'}_${new Date().toISOString().slice(0, 10)}.pdf`);
};



/* ═══ Excel ═══════════════════════════════════════════════════════════════ */
const sheet = (rows, widths) => {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ หมายเหตุ: 'ไม่มีข้อมูล' }]);
  const keys = Object.keys(rows[0] || { หมายเหตุ: '' });
  ws['!cols'] = keys.map((k, i) => ({ wch: widths?.[i] || Math.min(Math.max(String(k).length + 2, 12), 40) }));
  return ws;
};

/** ใบสอบกลับเป็น Excel หลายชีต: สรุป / วัตถุดิบ+DBS / ส่วนผสม / บรรจุภัณฑ์ / ไทม์ไลน์ / ความครบถ้วน */
export const exportDetailExcel = (data, docNo, code) => {
  const s = data.summary || {};
  const materials = data.materials || [];
  const cc = chainCompleteness(materials);
  const rk = riskAssessment(materials);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, sheet([
    { หัวข้อ: 'เลขเอกสารผลิต', ค่า: s.doc_no || docNo },
    { หัวข้อ: 'Code สินค้า', ค่า: s.code || code },
    { หัวข้อ: 'ไลน์ผลิต', ค่า: (s.lines || []).join(', ') },
    { หัวข้อ: 'บรรจุ (แรก)', ค่า: fmtDT(s.pack_date_first) },
    { หัวข้อ: 'บรรจุ (สุดท้าย)', ค่า: fmtDT(s.pack_date_last) },
    { หัวข้อ: 'จำนวนล็อตวัตถุดิบ', ค่า: s.material_count },
    { หัวข้อ: 'น้ำหนักวัตถุดิบรวม (kg)', ค่า: s.total_weight_rm },
    { หัวข้อ: 'ผู้ขาย', ค่า: (s.supplier_list || []).join(', ') },
    { หัวข้อ: 'คะแนนความครบถ้วน (%)', ค่า: cc.score },
    { หัวข้อ: 'ระดับความเสี่ยง', ค่า: rk.label },
    { หัวข้อ: 'เหตุผลความเสี่ยง', ค่า: rk.reasons.join(' | ') },
    { หัวข้อ: 'ส่งออกโดย', ค่า: currentUserName() },
    { หัวข้อ: 'ส่งออกเมื่อ', ค่า: fmtDT(new Date().toISOString()) },
  ], [28, 70]), 'สรุป');

  XLSX.utils.book_append_sheet(wb, sheet(materials.map(m => {
    const d = buildDelay(m);
    const v = k => (d.value[k] == null ? '' : d.value[k]);
    const st = k => (d.std[k] == null ? '' : d.std[k]);
    return {
      mapping_id: m.mapping_id, Mat: m.mat, 'Mat 2x': m.mat_2x || '', ชื่อวัตถุดิบ: m.mat_name,
      Batch: m.batch_before || '', 'Batch 2x': m.batch_after || '', ผู้ขาย: m.supplier_name || m.supplier_code || '',
      'วันที่ล็อต (รับเข้า)': fmtD(m.batch_date), ผลตรวจรับเข้า: m.intake_decision || '',
      กลุ่ม: m.rm_group_name || '', ไลน์: m.rmm_line_name || '', 'น้ำหนัก (kg)': m.weight_RM,
      'เตรียมเสร็จ': fmtDT(d.mapped._A), 'บรรจุเสร็จ': fmtDT(d.mapped._F),
      'DBS1 (นาที)': v('dbs1'), 'มาตรฐาน DBS1': st('dbs1'),
      'DBS2 (นาที)': v('dbs2'), 'มาตรฐาน DBS2': st('dbs2'),
      'DBS3 (นาที)': v('dbs3'), 'มาตรฐาน DBS3': st('dbs3'),
      'DBS4 (นาที)': v('dbs4'), 'มาตรฐาน DBS4': st('dbs4'),
      เกินมาตรฐาน: d.anyOver ? 'ใช่' : '',
      QC: [m.qccheck, m.mdcheck, m.defectcheck].filter(Boolean).join(' / '),
      WO: (m.wo_list || []).join(', '),
      หมายเหตุ: m.history?.remark_dalay || '',
    };
  })), 'วัตถุดิบ+DBS');

  XLSX.utils.book_append_sheet(wb, sheet((data.ingredient_rows || []).map(g => ({
    รหัส: g.material_code, ชื่อ: g.material_name, Batch: g.batch_no || '', 'น้ำหนักรวม (kg)': g.net_weight,
    'มาตรฐาน/ตะกร้า': g.std_weight, ต่ำสุด: g.min_weight, สูงสุด: g.max_weight, ตะกร้า: g.basket_count,
    หลุดพิกัด: g.out_of_spec_count, WO: (g.wo_list || []).join(', '),
    เริ่มผสม: fmtDT(g.used_from), ผสมเสร็จ: fmtDT(g.used_to),
  }))), 'ส่วนผสม');

  XLSX.utils.book_append_sheet(wb, sheet((data.packaging_rows || []).map(p => ({
    Code: p.code, 'Material No': p.material_no, Batch: p.batch_no, Lot: p.lot_no, HU: p.hu_no, ไลน์: p.line_name,
    รับ: p.qty_received, ใช้: p.qty_used, เสีย: p.qty_damaged, คงเหลือ: p.qty_remaining,
    เริ่มใช้: fmtDT(p.used_from), เลิกใช้: fmtDT(p.used_to), วันผลิตวัสดุ: fmtD(p.produce_date),
    Slip: (p.slip_ids || []).join(', '), ผู้รายงาน: p.reported_by || '',
  }))), 'บรรจุภัณฑ์');

  XLSX.utils.book_append_sheet(wb, sheet(materials.map(m => {
    const d = buildDelay(m);
    const row = { mapping_id: m.mapping_id, Mat: m.mat, Batch: m.batch_before || '' };
    Object.entries(STAGE_LABEL).forEach(([k, label]) => { row[label] = d.mapped[k] ? fmtDT(d.mapped[k]) : ''; });
    return row;
  })), 'ไทม์ไลน์');

  XLSX.utils.book_append_sheet(wb, sheet(cc.items.map(i => ({ รายการตรวจ: i.label, ครบ: i.ok, ทั้งหมด: i.total, เปอร์เซ็นต์: i.pct }))), 'ความครบถ้วน');

  XLSX.writeFile(wb, `Traceback_${docNo || s.doc_no || 'record'}_${stamp()}.xlsx`);
};

/** ผลการค้นหา (การ์ด) เป็น Excel */
export const exportResultsExcel = (rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(rows.map(r => ({
    เลขเอกสาร: r.doc_no, Code: r.code, วัตถุดิบ: r.mat_names, 'จำนวนล็อต': r.material_count,
    'น้ำหนัก (kg)': r.total_weight_rm, ไลน์: r.lines, Batch: r.batches || '',
    'ดีเลย์รุนแรง': r.severe_delay_count, 'ดีเลย์เตือน': r.warn_delay_count,
    'ดีเลย์สูงสุด (นาที)': r.max_delay_minutes, บรรจุแรก: fmtDT(r.pack_date_first), บรรจุสุดท้าย: fmtDT(r.pack_date_last),
  }))), 'ผลการค้นหา');
  XLSX.writeFile(wb, `Traceback_search_${stamp()}.xlsx`);
};

const TYPE_LABEL = { rm: 'วัตถุดิบ', ing: 'ส่วนผสม', pkg: 'บรรจุภัณฑ์', auto: 'ค้นหาทุกประเภท' };

/** ผลกระทบ forward (สินค้าที่ต้องเรียกคืน/กัก) เป็น Excel */
export const exportForwardExcel = (fwd) => {
  const wb = XLSX.utils.book_new();
  const s = fwd.summary || {};
  XLSX.utils.book_append_sheet(wb, sheet([
    { หัวข้อ: 'รหัสที่สอบกลับ', ค่า: fwd.code },
    { หัวข้อ: 'ประเภท', ค่า: TYPE_LABEL[fwd.type] },
    { หัวข้อ: 'พบในประเภท', ค่า: (fwd.matched_types || []).map(t => TYPE_LABEL[t]).join(', ') },
    { หัวข้อ: 'สินค้าที่ได้รับผลกระทบ', ค่า: s.product_count },
    { หัวข้อ: 'ล็อตทั้งหมด', ค่า: s.lot_count },
    { หัวข้อ: 'บรรจุแล้ว', ค่า: s.packed_count },
    { หัวข้อ: 'ยังอยู่ในกระบวนการ (กักได้ทันที)', ค่า: s.in_process_count },
    { หัวข้อ: 'น้ำหนักรวม (kg)', ค่า: s.total_weight },
    { หัวข้อ: 'ไลน์', ค่า: (s.lines || []).join(', ') },
    { หัวข้อ: 'ช่วงบรรจุ', ค่า: `${fmtDT(s.pack_date_first)} → ${fmtDT(s.pack_date_last)}` },
    { หัวข้อ: 'ส่งออกโดย', ค่า: currentUserName() },
    { หัวข้อ: 'ส่งออกเมื่อ', ค่า: fmtDT(new Date().toISOString()) },
  ], [32, 70]), 'สรุป');
  XLSX.utils.book_append_sheet(wb, sheet((fwd.products || []).map(p => ({
    เลขเอกสาร: p.doc_no, Code: p.code, ล็อต: p.lots, บรรจุแล้ว: p.packed, ในกระบวนการ: p.in_process,
    'น้ำหนัก (kg)': p.total_weight, ไลน์: (p.lines || []).join(', '), วัตถุดิบ: (p.mats || []).join(', '),
    บรรจุแรก: fmtDT(p.pack_first), บรรจุสุดท้าย: fmtDT(p.pack_last),
  }))), 'สินค้าที่ได้รับผลกระทบ');
  XLSX.utils.book_append_sheet(wb, sheet((fwd.lots || []).map(l => ({
    mapping_id: l.mapping_id, Mat: l.mat, ชื่อ: l.mat_name, Batch: l.batch_before || '', 'Batch 2x': l.batch_after || '',
    เอกสาร: l.doc_no, Code: l.code, ไลน์: l.rmm_line_name, 'น้ำหนัก (kg)': l.weight_RM,
    เตรียมเสร็จ: fmtDT(l.rmit_date), บรรจุเสร็จ: fmtDT(l.sc_pack_date), สถานะ: l.sc_pack_date ? 'บรรจุแล้ว' : (l.dest || 'ในกระบวนการ'),
  }))), 'ล็อต');
  XLSX.utils.book_append_sheet(wb, sheet((fwd.sources || []).map(x => ({
    ประเภท: TYPE_LABEL[x.type], รายการ: x.label, WO: x.wo_no || '', ตะกร้า: (x.baskets || []).join(', '),
    Code: x.code || '', Batch: x.batch_no || '', Lot: x.lot_no || '', ไลน์: x.line_name || '',
    เริ่ม: fmtDT(x.start_time || x.used_at), สิ้นสุด: fmtDT(x.stop_time), จำนวนล็อตที่จับคู่: x.mapping_count ?? x.count ?? '',
  }))), 'แหล่งที่จับคู่');
  XLSX.writeFile(wb, `Traceforward_${fwd.code}_${stamp()}.xlsx`);
};

/** ผลกระทบ forward เป็น PDF (รายการสินค้าที่ต้องเรียกคืน/กัก) */
export const exportForwardPDF = async (fwd) => {
  const doc = new jsPDF('l', 'mm', 'a4');
  addThaiFonts(doc);
  const logo = await loadImageDataUrl(logoUrl);
  const s = fwd.summary || {};
  miniHeader(doc, logo, 'รายงานสอบกลับไปข้างหน้า (Trace Forward / Impact Analysis)',
    `${TYPE_LABEL[fwd.type]} · รหัส ${fwd.code} · ${COMPANY}`);
  autoTable(doc, {
    ...tableStyle(HEAD_ORANGE),
    startY: 22,
    head: [['สินค้าที่ได้รับผลกระทบ', 'ล็อต', 'บรรจุแล้ว', 'ในกระบวนการ', 'น้ำหนักรวม (kg)', 'ไลน์', 'ช่วงบรรจุ']],
    body: [[s.product_count, s.lot_count, s.packed_count, s.in_process_count, fmtNum(s.total_weight, 1),
      (s.lines || []).join(', '), `${fmtDT(s.pack_date_first)} → ${fmtDT(s.pack_date_last)}`]],
  });
  autoTable(doc, {
    ...tableStyle(),
    startY: doc.lastAutoTable.finalY + 5,
    head: [['เลขเอกสาร', 'Code สินค้า', 'ล็อต', 'บรรจุแล้ว', 'ในกระบวนการ', 'น้ำหนัก (kg)', 'ไลน์', 'บรรจุแรก', 'บรรจุสุดท้าย']],
    body: (fwd.products || []).map(p => [p.doc_no, p.code, p.lots, p.packed, p.in_process, fmtNum(p.total_weight, 1),
      (p.lines || []).join(', '), fmtDT(p.pack_first), fmtDT(p.pack_last)]),
  });
  stampFooter(doc);
  doc.save(`Traceforward_${fwd.code}_${stamp()}.pdf`);
};

/** โปรโตคอลจำลองการเรียกคืน (Mock Recall) — บันทึกเวลา ขั้นตอน ทีม ผลสมดุลมวล */
export const exportRecallPDF = async (p) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  addThaiFonts(doc);
  const logo = await loadImageDataUrl(logoUrl);
  const W = doc.internal.pageSize.getWidth();
  miniHeader(doc, logo, 'บันทึกการจำลองการเรียกคืนสินค้า (Mock Recall Protocol)', COMPANY);
  doc.setFontSize(8); doc.text('F3PFTB02-1', W - 8, 8, { align: 'right' });

  autoTable(doc, {
    ...tableStyle(),
    startY: 22,
    head: [['หัวข้อ', 'รายละเอียด']],
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' } },
    body: [
      ['เลขที่บันทึก', p.recordNo],
      ['ประเภทการทดสอบ', p.direction === 'forward' ? 'สอบไปข้างหน้า (วัตถุดิบ → สินค้า)' : 'สอบย้อนกลับ (สินค้า → วัตถุดิบ)'],
      ['รหัสที่ใช้เริ่มต้น', `${p.startType} · ${p.startCode || '-'}`],
      ['เหตุผล / สถานการณ์จำลอง', p.scenario || '-'],
      ['เริ่ม', fmtDT(p.startedAt)],
      ['สิ้นสุด', fmtDT(p.endedAt)],
      ['เวลาที่ใช้', `${fmtDur(p.elapsedMin)} (เป้าหมาย ≤ ${fmtDur(p.targetMin)}) → ${p.elapsedMin != null && p.elapsedMin <= p.targetMin ? 'ผ่าน' : 'ไม่ผ่าน'}`],
      ['ทีมเรียกคืน', p.team || '-'],
    ],
  });

  autoTable(doc, {
    ...tableStyle(HEAD_ORANGE),
    startY: doc.lastAutoTable.finalY + 4,
    head: [['#', 'ขั้นตอน', 'สถานะ', 'เวลาที่เสร็จ', 'บันทึก']],
    columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 18 }, 3: { cellWidth: 30 } },
    body: p.steps.map((st, i) => [i + 1, st.label, st.done ? 'เสร็จ' : 'ยังไม่เสร็จ', st.doneAt ? fmtDT(st.doneAt) : '-', st.note || '']),
  });

  const mb = p.massBalance || {};
  autoTable(doc, {
    ...tableStyle(),
    startY: doc.lastAutoTable.finalY + 4,
    head: [['สมดุลมวล (Mass balance)', 'ปริมาณ (kg)']],
    columnStyles: { 0: { cellWidth: 110 } },
    body: [
      ['วัตถุดิบที่ระบบสอบกลับได้', fmtNum(mb.traced, 2)],
      ['ผลิตเป็นสินค้า (กรอก)', fmtNum(mb.produced, 2)],
      ['คงคลัง / กักได้ (กรอก)', fmtNum(mb.onHand, 2)],
      ['ส่งลูกค้าแล้ว (กรอก)', fmtNum(mb.shipped, 2)],
      ['ของเสีย / ทำลาย (กรอก)', fmtNum(mb.waste, 2)],
      ['ระบุตำแหน่งได้ (%) = (คงคลัง + ส่งแล้ว + ของเสีย) / ผลิต', mb.recoveryPct == null ? '-' : `${mb.recoveryPct}%`],
    ],
  });

  if (p.products?.length) {
    autoTable(doc, {
      ...tableStyle(),
      startY: doc.lastAutoTable.finalY + 4,
      head: [['สินค้าที่เกี่ยวข้อง (เอกสาร)', 'Code', 'ล็อต', 'น้ำหนัก (kg)']],
      body: p.products.map(x => [x.doc_no, x.code, x.lots, fmtNum(x.total_weight, 1)]),
    });
  }

  let y = Math.min(doc.lastAutoTable.finalY + 8, 230);
  doc.setFont('Sarabun', 'bold'); doc.setFontSize(10); doc.text('สรุปผล / การแก้ไขป้องกัน', 8, y);
  doc.setFont('Sarabun', 'normal'); doc.setFontSize(9);
  doc.text(doc.splitTextToSize(p.conclusion || '-', W - 16), 8, y + 5);

  y = 262;
  [['ผู้จัดทำ', p.sign?.recordedBy, 38], ['ผู้ทวนสอบ', p.sign?.reviewedBy, W / 2], ['ผู้อนุมัติ (QA/QC Manager)', p.sign?.qcManager, W - 38]].forEach(([lb, name, x]) => {
    doc.setDrawColor(0); doc.line(x - 28, y, x + 28, y);
    if (name) { doc.setFont('Sarabun', 'bold'); doc.text(name, x, y - 1.5, { align: 'center' }); doc.setFont('Sarabun', 'normal'); }
    doc.text(lb, x, y + 4.5, { align: 'center' });
    doc.text('วันที่ ____/____/______', x, y + 10, { align: 'center' });
  });

  stampFooter(doc);
  doc.save(`MockRecall_${p.recordNo}.pdf`);
};
