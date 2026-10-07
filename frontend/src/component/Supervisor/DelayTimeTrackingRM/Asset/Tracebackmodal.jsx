import React, { useState, useEffect } from 'react';
import axios from 'axios';

// npm install xlsx jspdf jspdf-autotable
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = import.meta.env.VITE_API_URL;

const sectionStyle = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: '16px 18px', marginBottom: 14 };
const sectionTitle = { fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 };
const kv = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8, fontSize: 12 };
const kvLabel = { color: '#9CA3AF' };
const kvValue = { color: '#111827', fontWeight: 600 };
const miniTable = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const miniTh = { textAlign: 'left', padding: '6px 8px', background: '#F5F8FF', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' };
const miniTd = { padding: '6px 8px', borderBottom: '0.5px solid #F3F4F6', whiteSpace: 'nowrap' };
const badge = (bg, color) => ({ fontSize: 11, background: bg, color, padding: '2px 8px', borderRadius: 20, display: 'inline-block' });
const btnExport = { fontSize: 12, padding: '6px 14px', border: '0.5px solid #D1D5DB', borderRadius: 8, cursor: 'pointer', background: '#fff', color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 6 };
const tabBtn = (active) => ({
  fontSize: 12.5, padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
  border: active ? '1px solid #1552F0' : '0.5px solid #D1D5DB',
  background: active ? '#EAF0FF' : '#fff',
  color: active ? '#0F3FC4' : '#6B7280',
});

// ── Datetime display helper ─────────────────────────────────────────────────
// ตัด "T" และ timezone tag ("Z" หรือ "+HH:MM"/"-HH:MM") ออกจากสตริงเวลาที่
// backend ส่งมา แล้วตัดวินาทีทิ้ง เหลือแค่ "YYYY-MM-DD HH:mm"
// หมายเหตุ: ค่าตัวเลข (ปี/เดือน/วัน/ชม./นาที) ที่ backend ส่งมาถูกต้องอยู่แล้ว
// (เป็นเวลาไทยจริง) ฟังก์ชันนี้แค่จัดรูปแบบการแสดงผล ไม่แปลง timezone ซ้ำ
function fmtDT(val) {
  if (!val) return '-';
  const s = String(val)
    .replace('T', ' ')
    .replace(/(\.\d+)?Z$/i, '')
    .replace(/[+-]\d{2}:?\d{2}$/, '');
  return s.slice(0, 16); // "YYYY-MM-DD HH:mm"
}

// ── QC Pass/Fail helper ───────────────────────────────────────────────────
// ค่าจาก DB สมมติว่าเป็น '1' = ผ่าน, '0' = ไม่ผ่าน (ยังไม่ยืนยัน 100% — ถ้าค่าจริง
// เป็นรูปแบบอื่น เช่น 'Y'/'N' ให้แจ้งเพื่อแก้ตรงจุดนี้จุดเดียว)
function passFail(val) {
  if (val == null || val === '') return { text: '-', bg: '#F3F4F6', color: '#6B7280' };
  const s = String(val).trim();
  if (s === '1') return { text: 'PASS', bg: '#DCFCE7', color: '#166534' };
  if (s === '0') return { text: 'FAIL', bg: '#FEE2E2', color: '#991B1B' };
  return { text: s, bg: '#F3F4F6', color: '#374151' };
}

// ── ดึงค่า decoded จาก batch_before digits ตามคำใน meaning_th ─────────────
// ใช้สำหรับหา Vendor / แหล่งวัตถุดิบ / วันที่รับเข้า จากผล decode ของ batch_before
// เป็นการจับคู่ข้อความแบบ fuzzy (คำสำคัญ) — อาจไม่แม่นทุกกรณีถ้าถ้อยคำใน DB ต่างไป
function findDecodedByKeyword(batchBefore, keywords) {
  if (!batchBefore?.digits_by_type) return null;
  for (const rows of Object.values(batchBefore.digits_by_type)) {
    for (const r of rows) {
      const meaning = r.meaning_th || '';
      if (keywords.some(k => meaning.includes(k))) {
        return r.decoded_value || r.raw_value || null;
      }
    }
  }
  return null;
}

// ── PassFailBadge component ───────────────────────────────────────────────
const PassFailBadge = ({ value }) => {
  const pf = passFail(value);
  return <span style={badge(pf.bg, pf.color)}>{pf.text}</span>;
};

// ══════════════════════════════════════════════════════════════════════════
// ── TEMPLATE 1 (แบบเดิม) ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

function MatBatchSection({ data }) {
  if (!data) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>ไม่มีข้อมูล MAT/Batch</div>;
  const { mat_decode, batch_before } = data;

  const renderDigits = (decode) => {
    if (!decode) return null;
    return Object.entries(decode.digits_by_type).map(([typeCode, rows]) => (
      <div key={typeCode} style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0F3FC4', marginBottom: 4 }}>
          Batch Structure: {typeCode}
        </div>
        <table style={miniTable}>
          <thead>
            <tr>
              <th style={miniTh}>Digit</th>
              <th style={miniTh}>ความหมาย</th>
              <th style={miniTh}>ค่าดิบ</th>
              <th style={miniTh}>ถอดได้</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={miniTd}>{r.digit_from === r.digit_to ? r.digit_from : `${r.digit_from}-${r.digit_to}`}</td>
                <td style={miniTd}>{r.meaning_th}</td>
                <td style={miniTd}><span style={badge('#F3F4F6', '#374151')}>{r.raw_value}</span></td>
                <td style={miniTd}>
                  {r.decoded_value
                    ? <span style={badge('#DCFCE7', '#166534')}>{r.decoded_value}</span>
                    : r.date_decode
                      ? (
                        r.date_decode.month
                          ? <span style={badge('#EAF0FF', '#0F3FC4')}>
                              เดือน {r.date_decode.month.month_th} ({r.date_decode.month.month_en})
                              {r.date_decode.day_candidates?.length > 0 &&
                                ` / วันที่ ${r.date_decode.day_candidates.map(d => d.day_number).join(' หรือ ')}`}
                            </span>
                          : <span style={{ color: '#9CA3AF' }}>— (ยังไม่รองรับรูปแบบนี้)</span>
                      )
                      : <span style={{ color: '#9CA3AF' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ));
  };

  return (
    <div>
      <div style={kv}>
        <div><div style={kvLabel}>Material Type</div><div style={kvValue}>{mat_decode?.material_type_name || '-'}</div></div>
        <div><div style={kvLabel}>Import/Local</div><div style={kvValue}>{mat_decode?.import_local_name || '-'}</div></div>
        <div><div style={kvLabel}>Sub Type</div><div style={kvValue}>{mat_decode?.sub_type_name || '-'}</div></div>
        <div><div style={kvLabel}>Species</div><div style={kvValue}>{mat_decode?.species_name || '-'}</div></div>
        <div><div style={kvLabel}>Size</div><div style={kvValue}>{mat_decode?.size_name || '-'}</div></div>
        <div><div style={kvLabel}>Style</div><div style={kvValue}>{mat_decode?.style_name || '-'}</div></div>
        <div><div style={kvLabel}>Catch Method</div><div style={kvValue}>{mat_decode?.catch_method_name || '-'}</div></div>
        <div><div style={kvLabel}>Certificate</div><div style={kvValue}>{mat_decode?.certificate_name || '-'}</div></div>
        <div><div style={kvLabel}>Running No.</div><div style={kvValue}>{mat_decode?.running_no || '-'}</div></div>
      </div>

      {batch_before && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed #E5E7EB' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>Batch Tag (ก่อนเตรียม): {batch_before.raw}</div>
          {renderDigits(batch_before)}
        </div>
      )}
    </div>
  );
}

function IngredientSection({ rows }) {
  if (!rows || rows.length === 0) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>ไม่พบข้อมูล Ingredient สำหรับ WO นี้</div>;
  return (
    <table style={miniTable}>
      <thead>
        <tr>
          <th style={miniTh}>Basket</th>
          <th style={miniTh}>รหัสวัตถุดิบ</th>
          <th style={miniTh}>ชื่อวัตถุดิบ</th>
          <th style={miniTh}>Batch (Ingredient)</th>
          <th style={miniTh}>Std Wt</th>
          <th style={miniTh}>Net Wt</th>
          <th style={miniTh}>%</th>
          <th style={miniTh}>เวลาผสม</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={miniTd}>{r.BasketNumber ?? '-'}</td>
            <td style={miniTd}>{r.MaterialCode ?? '-'}</td>
            <td style={miniTd}>{r.MaterialName || r.MaterialShortName || '-'}</td>
            <td style={miniTd}>{r.IngredientBatchNo ?? '-'}</td>
            <td style={miniTd}>{r.StdWt ?? '-'}</td>
            <td style={miniTd}>{r.NetWt ?? '-'}</td>
            <td style={miniTd}>{r.Percentage ?? '-'}</td>
            <td style={miniTd}>{fmtDT(r.MixingTime)} → {fmtDT(r.MixingEndTime)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PackagingSection({ rows }) {
  if (!rows || rows.length === 0) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>ไม่พบข้อมูลการบรรจุที่ตรงกับช่วงเวลานี้</div>;
  return rows.map((r, i) => (
    <div key={r.detail_id ?? i} style={{ marginBottom: 12, padding: '10px 12px', background: '#FAFAFA', borderRadius: 8, border: '0.5px solid #F3F4F6' }}>
      <div style={kv}>
        <div><div style={kvLabel}>Plant / Line</div><div style={kvValue}>{r.plant} / {r.line_name}</div></div>
        <div><div style={kvLabel}>Shift</div><div style={kvValue}>{r.shift}</div></div>
        <div><div style={kvLabel}>ประเภทบรรจุภัณฑ์</div><div style={kvValue}>{r.package_type}</div></div>
        <div><div style={kvLabel}>ผู้รายงาน / QC</div><div style={kvValue}>{r.reported_by} / {r.qc_supervisor}</div></div>
        <div><div style={kvLabel}>Lot No.</div><div style={kvValue}>{r.lot_no ?? '-'}</div></div>
        <div><div style={kvLabel}>Batch No.</div><div style={kvValue}>{r.batch_no ?? '-'}</div></div>
        <div><div style={kvLabel}>HU No.</div><div style={kvValue}>{r.hu_no ?? '-'}</div></div>
        <div><div style={kvLabel}>Box No.</div><div style={kvValue}>{r.box_no ?? '-'}</div></div>
        <div><div style={kvLabel}>ช่วงเวลาบรรจุ</div><div style={kvValue}>{fmtDT(r.start_time)} → {fmtDT(r.stop_time)}</div></div>
      </div>

      {r.slip_id != null && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E5E7EB' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', marginBottom: 6 }}>
            🏷️ ข้อมูลสลิป (Slip ID: {r.slip_id})
          </div>
          <div style={kv}>
            <div><div style={kvLabel}>ประเภท</div><div style={kvValue}>{r.slip_type_choice ?? '-'}</div></div>
            <div><div style={kvLabel}>วันที่ส่ง</div><div style={kvValue}>{fmtDT(r.slip_send_date)}</div></div>
            <div><div style={kvLabel}>กะ (Slip)</div><div style={kvValue}>{r.slip_shift ?? '-'}</div></div>
            <div><div style={kvLabel}>ลำดับใช้งาน</div><div style={kvValue}>{r.slip_seq_use ?? '-'}</div></div>
            <div><div style={kvLabel}>Line ID</div><div style={kvValue}>{r.slip_line_id ?? '-'}</div></div>
            <div><div style={kvLabel}>Line (Slip)</div><div style={kvValue}>{r.slip_line_name ?? '-'}</div></div>
            <div><div style={kvLabel}>รหัสวัตถุดิบ</div><div style={kvValue}>{r.slip_code_mat ?? '-'}</div></div>
            <div><div style={kvLabel}>Batch No. (Slip)</div><div style={kvValue}>{r.slip_batch_no ?? '-'}</div></div>
            <div><div style={kvLabel}>วันที่รับเข้า</div><div style={kvValue}>{fmtDT(r.slip_receive_date)}</div></div>
            <div><div style={kvLabel}>Box No. (Slip)</div><div style={kvValue}>{r.slip_box_no ?? '-'}</div></div>
            <div><div style={kvLabel}>Lot (Slip)</div><div style={kvValue}>{r.slip_lot ?? '-'}</div></div>
            <div><div style={kvLabel}>Roll No.</div><div style={kvValue}>{r.slip_roll_no ?? '-'}</div></div>
            <div><div style={kvLabel}>HU (Slip)</div><div style={kvValue}>{r.slip_hu ?? '-'}</div></div>
            <div><div style={kvLabel}>Size</div><div style={kvValue}>{r.slip_size ?? '-'}</div></div>
            <div><div style={kvLabel}>TE</div><div style={kvValue}>{r.slip_te ?? '-'}</div></div>
            <div><div style={kvLabel}>Qty</div><div style={kvValue}>{r.slip_qty ?? '-'}</div></div>
            <div><div style={kvLabel}>หมายเหตุ (Slip)</div><div style={kvValue}>{r.slip_remark ?? '-'}</div></div>
            <div><div style={kvLabel}>สร้างเมื่อ</div><div style={kvValue}>{fmtDT(r.slip_created_at)}</div></div>
            <div><div style={kvLabel}>วันที่/เวลา (Slip)</div><div style={kvValue}>{fmtDT(r.slip_datetime)}</div></div>
            <div><div style={kvLabel}>วันที่ผลิต (Slip)</div><div style={kvValue}>{fmtDT(r.slip_produce_date)}</div></div>
          </div>
        </div>
      )}
    </div>
  ));
}

// ══════════════════════════════════════════════════════════════════════════
// ── TEMPLATE 2 (Traceback Template) ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

// ── Header block: Line / Code / Doc No. / Production Date ─────────────────
function TemplateV2Header({ row }) {
  return (
    <div style={{ ...sectionStyle, background: '#F0F9FF', border: '0.5px solid #BAE6FD' }}>
      <div style={kv}>
        <div><div style={kvLabel}>Line</div><div style={kvValue}>{row.rmm_line_name || '-'}</div></div>
        <div><div style={kvLabel}>Code</div><div style={kvValue}>{row.code || '-'}</div></div>
        <div><div style={kvLabel}>Document No.</div><div style={kvValue}>{row.doc_no || '-'}</div></div>
        <div><div style={kvLabel}>Production Date</div><div style={kvValue}>{fmtDT(row.sc_pack_date)}</div></div>
      </div>
    </div>
  );
}

// ── 1) Raw Material component ──────────────────────────────────────────────
function RawMaterialSectionV2({ row, matBatchData }) {
  const batchBefore = matBatchData?.batch_before;
  const vendor = findDecodedByKeyword(batchBefore, ['VENDOR']);
  const source = findDecodedByKeyword(batchBefore, ['แหล่งวัตถุดิบ']);
  const receivedDate = findDecodedByKeyword(batchBefore, ['รับเข้า']);

  return (
    <div style={kv}>
      <div><div style={kvLabel}>Material Name</div><div style={kvValue}>{row.mat_name || '-'}</div></div>
      <div><div style={kvLabel}>Material Code</div><div style={kvValue}>{row.mat || '-'}</div></div>
      <div><div style={kvLabel}>Material Code (2X)</div><div style={kvValue}>{row.mat_2x || '-'}</div></div>
      <div><div style={kvLabel}>Batch</div><div style={kvValue}>{row.batch_before || '-'}</div></div>
      <div><div style={kvLabel}>Batch (2X)</div><div style={kvValue}>{row.batch_after || '-'}</div></div>
      <div><div style={kvLabel}>Color</div><PassFailBadge value={row.color} /></div>
      <div><div style={kvLabel}>Odor</div><PassFailBadge value={row.odor} /></div>
      <div><div style={kvLabel}>Texture</div><PassFailBadge value={row.texture} /></div>
      <div><div style={kvLabel}>Metal Detection</div><PassFailBadge value={row.md} /></div>
      <div><div style={kvLabel}>Defect</div><PassFailBadge value={row.defect} /></div>
      {/* ⚠️ ยังไม่ทราบว่า "DBS ทั้ง 4 ช่วง" หมายถึง field ไหน — placeholder ไว้ก่อน */}
      <div><div style={kvLabel}>DBS</div><div style={{ ...kvValue, color: '#9CA3AF', fontWeight: 400 }}>ไม่มีข้อมูล (รอยืนยัน field)</div></div>
      <div><div style={kvLabel}>Vendor</div><div style={kvValue}>{vendor || '-'}</div></div>
      <div><div style={kvLabel}>Raw Material Source</div><div style={kvValue}>{source || '-'}</div></div>
      <div><div style={kvLabel}>Received Date</div><div style={kvValue}>{receivedDate || '-'}</div></div>
    </div>
  );
}

// ── 2) Ingredient component ─────────────────────────────────────────────────
function IngredientSectionV2({ rows }) {
  if (!rows || rows.length === 0) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>No ingredient data found for this Work Order</div>;
  return (
    <table style={miniTable}>
      <thead>
        <tr>
          <th style={miniTh}>Basket</th>
          <th style={miniTh}>Material Code</th>
          <th style={miniTh}>Material Name</th>
          <th style={miniTh}>Batch (Ingredient)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={miniTd}>{r.BasketNumber ?? '-'}</td>
            <td style={miniTd}>{r.MaterialCode ?? '-'}</td>
            <td style={miniTd}>{r.MaterialName || r.MaterialShortName || '-'}</td>
            <td style={miniTd}>{r.IngredientBatchNo ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── 3) Package component ────────────────────────────────────────────────────
function PackageSectionV2({ rows }) {
  if (!rows || rows.length === 0) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>No packaging data found for this time range</div>;
  return rows.map((r, i) => (
    <div key={r.detail_id ?? i} style={{ marginBottom: 12, padding: '10px 12px', background: '#FAFAFA', borderRadius: 8, border: '0.5px solid #F3F4F6' }}>
      <div style={kv}>
        <div><div style={kvLabel}>Lot Number</div><div style={kvValue}>{r.lot_no ?? '-'}</div></div>
        <div><div style={kvLabel}>Batch Number (Report)</div><div style={kvValue}>{r.batch_no ?? '-'}</div></div>
        <div><div style={kvLabel}>Handling Unit Number</div><div style={kvValue}>{r.hu_no ?? '-'}</div></div>
        <div><div style={kvLabel}>Box Number</div><div style={kvValue}>{r.box_no ?? '-'}</div></div>
        <div><div style={kvLabel}>Production Date</div><div style={kvValue}>{fmtDT(r.produce_date || r.slip_produce_date)}</div></div>
        <div><div style={kvLabel}>Material Code</div><div style={kvValue}>{r.material_no || r.slip_code_mat || '-'}</div></div>
        <div><div style={kvLabel}>Batch Number (Slip)</div><div style={kvValue}>{r.slip_batch_no ?? '-'}</div></div>
        <div><div style={kvLabel}>Receiving Date</div><div style={kvValue}>{fmtDT(r.receive_date || r.slip_receive_date)}</div></div>
        <div><div style={kvLabel}>Roll Number</div><div style={kvValue}>{r.slip_roll_no ?? '-'}</div></div>
        <div><div style={kvLabel}>Size</div><div style={kvValue}>{r.slip_size ?? '-'}</div></div>
        <div><div style={kvLabel}>TE</div><div style={kvValue}>{r.slip_te ?? '-'}</div></div>
        <div><div style={kvLabel}>Quantity</div><div style={kvValue}>{r.slip_qty ?? '-'}</div></div>
      </div>
    </div>
  ));
}

// ── Export helpers (Template 1 - แบบเดิม) ────────────────────────────────
function flattenForExport(row, traceback) {
  const flat = { ...row };
  if (traceback?.matBatch?.data?.mat_decode) {
    const md = traceback.matBatch.data.mat_decode;
    flat.material_type_name = md.material_type_name;
    flat.import_local_name = md.import_local_name;
    flat.sub_type_name = md.sub_type_name;
    flat.species_name = md.species_name;
    flat.size_name = md.size_name;
    flat.style_name = md.style_name;
    flat.catch_method_name = md.catch_method_name;
    flat.certificate_name = md.certificate_name;
  }
  return flat;
}

function exportExcel(row, traceback) {
  const wb = XLSX.utils.book_new();
  const summary = flattenForExport(row, traceback);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([summary]), 'สรุป');
  if (traceback?.ingredient?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(traceback.ingredient), 'Ingredient');
  }
  if (traceback?.packaging?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(traceback.packaging), 'Packaging');
  }
  XLSX.writeFile(wb, `traceback_${row.mat || 'unknown'}_${row.batch_after || row.batch_before || ''}.xlsx`);
}

function exportPDF(row, traceback) {
  const doc = new jsPDF();
  let y = 14;
  doc.setFontSize(14);
  doc.text(`Traceback Report`, 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.text(`Mat: ${row.mat || '-'}   Name: ${row.mat_name || '-'}`, 14, y);
  y += 5;
  doc.text(`Batch Tag: ${row.batch_before || '-'}   Batch: ${row.batch_after || '-'}   Line: ${row.rmm_line_name || '-'}`, 14, y);
  y += 8;

  const md = traceback?.matBatch?.data?.mat_decode;
  if (md) {
    autoTable(doc, {
      startY: y,
      head: [['Material Type', 'Import/Local', 'Sub Type', 'Species', 'Style']],
      body: [[md.material_type_name, md.import_local_name, md.sub_type_name, md.species_name, md.style_name]],
      styles: { fontSize: 8 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (traceback?.ingredient?.length) {
    doc.setFontSize(11);
    doc.text('Ingredient (WO)', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Basket', 'Material', 'Name', 'Batch', 'Std Wt', 'Net Wt', '%']],
      body: traceback.ingredient.map(r => [r.BasketNumber, r.MaterialCode, r.MaterialName, r.IngredientBatchNo, r.StdWt, r.NetWt, r.Percentage]),
      styles: { fontSize: 8 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (traceback?.packaging?.length) {
    doc.setFontSize(11);
    doc.text('Packaging', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Plant', 'Line', 'Lot No', 'Batch No', 'HU No', 'Start', 'Stop']],
      body: traceback.packaging.map(r => [r.plant, r.line_name, r.lot_no, r.batch_no, r.hu_no, fmtDT(r.start_time), fmtDT(r.stop_time)]),
      styles: { fontSize: 8 },
    });
  }

  doc.save(`traceback_${row.mat || 'unknown'}_${row.batch_after || row.batch_before || ''}.pdf`);
}

// ── Export helpers (Template 2 - Traceback Template) ──────────────────────
function exportExcelV2(row, traceback) {
  const wb = XLSX.utils.book_new();
  const batchBefore = traceback?.matBatch?.data?.batch_before;

  const rawMaterial = {
    Line: row.rmm_line_name, Code: row.code, DocumentNo: row.doc_no, ProductionDate: fmtDT(row.sc_pack_date),
    MaterialName: row.mat_name, MaterialCode: row.mat, MaterialCode2X: row.mat_2x,
    Batch: row.batch_before, Batch2X: row.batch_after,
    Color: passFail(row.color).text, Odor: passFail(row.odor).text, Texture: passFail(row.texture).text,
    MetalDetection: passFail(row.md).text, Defect: passFail(row.defect).text,
    Vendor: findDecodedByKeyword(batchBefore, ['VENDOR']),
    RawMaterialSource: findDecodedByKeyword(batchBefore, ['แหล่งวัตถุดิบ']),
    ReceivedDate: findDecodedByKeyword(batchBefore, ['รับเข้า']),
  };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([rawMaterial]), 'Raw Material');

  if (traceback?.ingredient?.length) {
    const ing = traceback.ingredient.map(r => ({
      Basket: r.BasketNumber, MaterialCode: r.MaterialCode, MaterialName: r.MaterialName, BatchIngredient: r.IngredientBatchNo,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ing), 'Ingredient');
  }

  if (traceback?.packaging?.length) {
    const pkg = traceback.packaging.map(r => ({
      LotNumber: r.lot_no, BatchNumberReport: r.batch_no, HandlingUnitNumber: r.hu_no, BoxNumber: r.box_no,
      ProductionDate: fmtDT(r.produce_date || r.slip_produce_date), MaterialCode: r.material_no || r.slip_code_mat,
      BatchNumberSlip: r.slip_batch_no, ReceivingDate: fmtDT(r.receive_date || r.slip_receive_date),
      RollNumber: r.slip_roll_no, Size: r.slip_size, TE: r.slip_te, Quantity: r.slip_qty,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pkg), 'Package');
  }

  XLSX.writeFile(wb, `traceback_v2_${row.mat || 'unknown'}_${row.batch_before || ''}.xlsx`);
}

function exportPDFV2(row, traceback) {
  const doc = new jsPDF();
  let y = 14;
  const batchBefore = traceback?.matBatch?.data?.batch_before;

  doc.setFontSize(14);
  doc.text(`Traceback Report`, 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Line: ${row.rmm_line_name || '-'}   Code: ${row.code || '-'}   Doc No.: ${row.doc_no || '-'}   Production Date: ${fmtDT(row.sc_pack_date)}`, 14, y);
  y += 8;

  doc.setFontSize(11);
  doc.text('1. Raw Material', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['Material Name', 'Material Code', 'Code (2X)', 'Batch', 'Batch (2X)', 'Color', 'Odor', 'Texture', 'MD', 'Defect']],
    body: [[
      row.mat_name, row.mat, row.mat_2x, row.batch_before, row.batch_after,
      passFail(row.color).text, passFail(row.odor).text, passFail(row.texture).text,
      passFail(row.md).text, passFail(row.defect).text,
    ]],
    styles: { fontSize: 7 },
  });
  y = doc.lastAutoTable.finalY + 4;
  autoTable(doc, {
    startY: y,
    head: [['Vendor', 'Raw Material Source', 'Received Date']],
    body: [[
      findDecodedByKeyword(batchBefore, ['VENDOR']) || '-',
      findDecodedByKeyword(batchBefore, ['แหล่งวัตถุดิบ']) || '-',
      findDecodedByKeyword(batchBefore, ['รับเข้า']) || '-',
    ]],
    styles: { fontSize: 8 },
  });
  y = doc.lastAutoTable.finalY + 8;

  if (traceback?.ingredient?.length) {
    doc.setFontSize(11);
    doc.text('2. Ingredient', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Basket', 'Material Code', 'Material Name', 'Batch (Ingredient)']],
      body: traceback.ingredient.map(r => [r.BasketNumber, r.MaterialCode, r.MaterialName, r.IngredientBatchNo]),
      styles: { fontSize: 8 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (traceback?.packaging?.length) {
    doc.setFontSize(11);
    doc.text('3. Package', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Lot No.', 'Batch No.(Report)', 'HU No.', 'Box No.', 'Production Date', 'Material Code', 'Batch No.(Slip)', 'Receiving Date', 'Roll No.', 'Size', 'TE', 'Qty']],
      body: traceback.packaging.map(r => [
        r.lot_no, r.batch_no, r.hu_no, r.box_no, fmtDT(r.produce_date || r.slip_produce_date),
        r.material_no || r.slip_code_mat, r.slip_batch_no, fmtDT(r.receive_date || r.slip_receive_date),
        r.slip_roll_no, r.slip_size, r.slip_te, r.slip_qty,
      ]),
      styles: { fontSize: 6.5 },
    });
  }

  doc.save(`traceback_v2_${row.mat || 'unknown'}_${row.batch_before || ''}.pdf`);
}

// ══════════════════════════════════════════════════════════════════════════
// ── Main Modal ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
const TracebackModal = ({ row, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [traceback, setTraceback] = useState({ matBatch: null, ingredient: [], packaging: [] });
  const [template, setTemplate] = useState('classic'); // 'classic' | 'v2'

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (!row) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [matBatchRes, ingredientRes, packagingRes] = await Promise.allSettled([
          axios.get(`${API_URL}/api/traceback/mat-batch`, {
            params: { mat: row.mat, batch_before: row.batch_before, batch_after: row.batch_after },
          }),
          row.wo_no
            ? axios.get(`${API_URL}/api/pack/ingredient/fetch-wo`, {
                params: { wo_no: row.wo_no, basket_no: row.basket_no },
              })
            : Promise.resolve({ data: { data: [] } }),
          axios.get(`${API_URL}/api/traceback/packaging`, {
            params: { line_name: row.rmm_line_name, sc_pack_date: row.sc_pack_date },
          }),
        ]);

        if (cancelled) return;

        setTraceback({
          matBatch: matBatchRes.status === 'fulfilled' ? matBatchRes.value.data : null,
          ingredient: ingredientRes.status === 'fulfilled' ? (ingredientRes.value.data?.data || []) : [],
          packaging: packagingRes.status === 'fulfilled' ? (packagingRes.value.data?.data || []) : [],
        });
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [row]);

  if (!row) return null;

  const handleExportExcel = () => (template === 'v2' ? exportExcelV2(row, traceback) : exportExcel(row, traceback));
  const handleExportPDF = () => (template === 'v2' ? exportPDFV2(row, traceback) : exportPDF(row, traceback));

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#F5F8FF', borderRadius: 20, width: '100%', maxWidth: 1100, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E5E7EB', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>📄 Traceback: {row.mat_name || row.mat}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Mat {row.mat} · Batch {row.batch_after || row.batch_before} · ไลน์ {row.rmm_line_name}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnExport} onClick={handleExportExcel}>📊 Export Excel</button>
              <button style={btnExport} onClick={handleExportPDF}>📄 Export PDF</button>
              <button onClick={onClose} style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', cursor: 'pointer', width: 34, height: 34, borderRadius: '50%' }}>✕</button>
            </div>
          </div>

          {/* template selector */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={tabBtn(template === 'classic')} onClick={() => setTemplate('classic')}>แบบเดิม</button>
            <button style={tabBtn(template === 'v2')} onClick={() => setTemplate('v2')}>Traceback Template</button>
          </div>
        </div>

        {/* body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>กำลังโหลดข้อมูล traceback...</div>}
          {error && <div style={{ padding: 12, background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, marginBottom: 12 }}>{error}</div>}

          {!loading && template === 'classic' && (
            <>
              <div style={sectionStyle}>
                <div style={sectionTitle}>🧬 MAT / Batch Digit Traceback</div>
                <MatBatchSection data={traceback.matBatch?.data} />
              </div>

              <div style={sectionStyle}>
                <div style={sectionTitle}>🥣 Ingredient (Work Order)</div>
                <IngredientSection rows={traceback.ingredient} />
              </div>

              <div style={sectionStyle}>
                <div style={sectionTitle}>📦 Packaging</div>
                <PackagingSection rows={traceback.packaging} />
              </div>
            </>
          )}

          {!loading && template === 'v2' && (
            <>
              <TemplateV2Header row={row} />

              <div style={sectionStyle}>
                <div style={sectionTitle}>1. Raw Material</div>
                <RawMaterialSectionV2 row={row} matBatchData={traceback.matBatch?.data} />
              </div>

              <div style={sectionStyle}>
                <div style={sectionTitle}>2. Ingredient</div>
                <IngredientSectionV2 rows={traceback.ingredient} />
              </div>

              <div style={sectionStyle}>
                <div style={sectionTitle}>3. Package</div>
                <PackageSectionV2 rows={traceback.packaging} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TracebackModal;