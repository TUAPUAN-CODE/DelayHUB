import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL;

function getPercentileValue(rows, dbsField, p) {
  const vals = rows.map(r => r[dbsField]).filter(v => v !== null && v !== undefined).sort((a, b) => a - b);
  if (!vals.length) return null;
  const idx = Math.ceil((p / 100) * vals.length) - 1;
  return vals[Math.max(0, idx)];
}

function buildGroupedRows(data, groupBy, percentile) {
  const groups = {};
  data.forEach(r => {
    const key = r[groupBy] || '(ไม่ระบุ)';
    if (!groups[key]) groups[key] = {
      rows: [], rm_type_name: r.rm_type_name, rm_group_name: r.rm_group_name,
      prep_to_cold: r.prep_to_cold, cold_to_pack: r.cold_to_pack,
      cold: r.cold, prep_to_pack: r.prep_to_pack,
      line_set: new Set(), doc_set: new Set(),
      batch_before_set: new Set(), batch_after_set: new Set(),
      code_set: new Set(), mat_set: new Set(), mat_2x_set: new Set(),
      weight_total: 0,
    };
    groups[key].rows.push(r);
    if (r.rmm_line_name)  groups[key].line_set.add(r.rmm_line_name);
    if (r.doc_no)         groups[key].doc_set.add(r.doc_no);
    if (r.batch_before)   groups[key].batch_before_set.add(r.batch_before);
    if (r.batch_after)    groups[key].batch_after_set.add(r.batch_after);
    if (r.code)           groups[key].code_set.add(r.code);
    if (r.mat)            groups[key].mat_set.add(r.mat);
    if (r.mat_2x)         groups[key].mat_2x_set.add(r.mat_2x);
    groups[key].weight_total += (r.weight_RM || 0);
  });
  return Object.entries(groups).map(([name, g]) => ({
    name, rm_type_name: g.rm_type_name, rm_group_name: g.rm_group_name,
    rmm_line_name:  [...g.line_set].sort().join(', '),
    doc_no:         [...g.doc_set].sort().join(', '),
    batch_before:   [...g.batch_before_set].sort().join(', '),
    batch_after:    [...g.batch_after_set].sort().join(', '),
    code:           [...g.code_set].sort().join(', '),
    mat:            [...g.mat_set].sort().join(', '),
    mat_2x:         [...g.mat_2x_set].sort().join(', '),
    weight_total:   Math.round(g.weight_total * 10) / 10,
    total: g.rows.length,
    rows: g.rows,
    prep_to_cold: g.prep_to_cold, cold_to_pack: g.cold_to_pack,
    cold: g.cold, prep_to_pack: g.prep_to_pack,
    dbs1: getPercentileValue(g.rows, 'DBS1', percentile),
    dbs2: getPercentileValue(g.rows, 'DBS2', percentile),
    dbs3: getPercentileValue(g.rows, 'DBS3', percentile),
    dbs4: getPercentileValue(g.rows, 'DBS4', percentile),
    dbs1_count: g.rows.filter(r => r.DBS1 != null).length,
    dbs2_count: g.rows.filter(r => r.DBS2 != null).length,
    dbs3_count: g.rows.filter(r => r.DBS3 != null).length,
    dbs4_count: g.rows.filter(r => r.DBS4 != null).length,
  }));
}

function fmtHr(h) {
  if (h == null) return null;
  const abs = Math.abs(h);
  const hh = Math.floor(abs), mm = Math.round((abs - hh) * 60);
  const sign = h < 0 ? '-' : '';
  if (hh === 0) return `${sign}${mm}m`;
  if (mm === 0) return `${sign}${hh}h`;
  return `${sign}${hh}h ${mm}m`;
}

function fmtDatetime(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d)) return '-';
  const date = d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

// ── Excel Export ──────────────────────────────────────────────────────────────
function exportSummaryExcel(rows, percentile, filename) {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Summary (แถวหลัก) ──
  const headerRow = [
    'ชื่อ', 'RM Type', 'RM Group', 'ไลน์', 'เลขเอกสาร', 'Code',
    'Batch Tag ห้องเย็น', 'Batch หลังเตรียม', 'จำนวน batch',
    `DBS1 P${percentile} (h)`, `DBS2 P${percentile} (h)`,
    `DBS3 P${percentile} (h)`, `DBS4 P${percentile} (h)`,
    'มาตรฐาน DBS1 (h)', 'มาตรฐาน DBS2 (h)',
    'มาตรฐาน DBS3 (h)', 'มาตรฐาน DBS4 (h)',
    'สถานะ DBS1', 'สถานะ DBS2', 'สถานะ DBS3', 'สถานะ DBS4',
  ];

  const dataRows = rows.map(r => {
    const s1 = r.dbs1 != null && r.prep_to_cold != null && r.dbs1 > r.prep_to_cold ? 'delay' : 'ปกติ';
    const s2 = r.dbs2 != null && r.cold != null && r.dbs2 > r.cold ? 'delay' : 'ปกติ';
    const s3 = r.dbs3 != null && r.cold_to_pack != null && r.dbs3 > r.cold_to_pack ? 'delay' : 'ปกติ';
    const s4 = r.dbs4 != null && r.prep_to_pack != null && r.dbs4 > r.prep_to_pack ? 'delay' : 'ปกติ';
    return [
      r.name || '-',
      r.rm_type_name || '-',
      r.rm_group_name || '-',
      r.rmm_line_name || '-',
      r.doc_no || '-',
      r.code || '-',
      r.batch_before || '-',
      r.batch_after || '-',
      r.total,
      r.dbs1 ?? '',
      r.dbs2 ?? '',
      r.dbs3 ?? '',
      r.dbs4 ?? '',
      r.prep_to_cold ?? '',
      r.cold ?? '',
      r.cold_to_pack ?? '',
      r.prep_to_pack ?? '',
      s1, s2, s3, s4,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

  // column widths
  ws['!cols'] = [
    { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 14 },
    { wch: 22 }, { wch: 20 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];

  // header style
  headerRow.forEach((_, ci) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (!ws[addr]) ws[addr] = {};
    ws[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 11 },
      fill: { fgColor: { rgb: '1D4ED8' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '1E3A8A' } },
        bottom: { style: 'thin', color: { rgb: '1E3A8A' } },
        left: { style: 'thin', color: { rgb: '1E3A8A' } },
        right: { style: 'thin', color: { rgb: '1E3A8A' } },
      },
    };
  });

  // data row styles
  dataRows.forEach((row, ri) => {
    const isEven = ri % 2 === 0;
    const baseBg = isEven ? 'FFFFFF' : 'EFF6FF';
    row.forEach((_, ci) => {
      const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
      if (!ws[addr]) ws[addr] = {};
      const col = headerRow[ci];
      const isStatusCol = col.startsWith('สถานะ');
      const isDbs = col.startsWith('DBS') && col.includes('P');
      const cellVal = ws[addr].v;
      let bg = baseBg;
      let fontColor = '111827';

      if (isStatusCol && cellVal === 'delay') { bg = 'FEE2E2'; fontColor = '991B1B'; }
      else if (isStatusCol && cellVal === 'ปกติ') { bg = 'DCFCE7'; fontColor = '166534'; }

      ws[addr].s = {
        font: { name: 'Arial', sz: 10, color: { rgb: fontColor }, bold: isStatusCol },
        fill: { fgColor: { rgb: bg } },
        alignment: { horizontal: isDbs || col === 'จำนวน batch' ? 'center' : 'left', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } },
        },
      };
    });
  });

  ws['!rows'] = [{ hpt: 32 }, ...dataRows.map(() => ({ hpt: 22 }))];
  XLSX.utils.book_append_sheet(wb, ws, 'สรุปกลุ่ม');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportAllDetailExcel(rows, percentile, filename) {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Summary (แถวหลัก) ──
  const summaryHeader = [
    'ชื่อ', 'RM Type', 'RM Group', 'ไลน์', 'เลขเอกสาร', 'Code',
    'Batch Tag ห้องเย็น', 'Batch หลังเตรียม', 'จำนวน batch',
    `DBS1 P${percentile} (h)`, `DBS2 P${percentile} (h)`,
    `DBS3 P${percentile} (h)`, `DBS4 P${percentile} (h)`,
    'มาตรฐาน DBS1 (h)', 'มาตรฐาน DBS2 (h)',
    'มาตรฐาน DBS3 (h)', 'มาตรฐาน DBS4 (h)',
    'สถานะ DBS1', 'สถานะ DBS2', 'สถานะ DBS3', 'สถานะ DBS4',
  ];
  const summaryData = rows.map(r => {
    const s1 = r.dbs1 != null && r.prep_to_cold != null && r.dbs1 > r.prep_to_cold ? 'delay' : 'ปกติ';
    const s2 = r.dbs2 != null && r.cold != null && r.dbs2 > r.cold ? 'delay' : 'ปกติ';
    const s3 = r.dbs3 != null && r.cold_to_pack != null && r.dbs3 > r.cold_to_pack ? 'delay' : 'ปกติ';
    const s4 = r.dbs4 != null && r.prep_to_pack != null && r.dbs4 > r.prep_to_pack ? 'delay' : 'ปกติ';
    return [
      r.name || '-', r.rm_type_name || '-', r.rm_group_name || '-',
      r.rmm_line_name || '-', r.doc_no || '-', r.code || '-',
      r.batch_before || '-', r.batch_after || '-', r.total,
      r.dbs1 ?? '', r.dbs2 ?? '', r.dbs3 ?? '', r.dbs4 ?? '',
      r.prep_to_cold ?? '', r.cold ?? '', r.cold_to_pack ?? '', r.prep_to_pack ?? '',
      s1, s2, s3, s4,
    ];
  });

  const ws1 = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryData]);
  ws1['!cols'] = [
    { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 14 },
    { wch: 22 }, { wch: 20 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];

  // summary header style
  summaryHeader.forEach((_, ci) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (!ws1[addr]) ws1[addr] = {};
    ws1[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 11 },
      fill: { fgColor: { rgb: '1D4ED8' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { top: { style: 'thin', color: { rgb: '1E3A8A' } }, bottom: { style: 'thin', color: { rgb: '1E3A8A' } }, left: { style: 'thin', color: { rgb: '1E3A8A' } }, right: { style: 'thin', color: { rgb: '1E3A8A' } } },
    };
  });
  summaryData.forEach((row, ri) => {
    const isEven = ri % 2 === 0;
    const baseBg = isEven ? 'FFFFFF' : 'EFF6FF';
    row.forEach((_, ci) => {
      const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
      if (!ws1[addr]) ws1[addr] = {};
      const col = summaryHeader[ci];
      const isStatusCol = col.startsWith('สถานะ');
      const cellVal = ws1[addr].v;
      let bg = baseBg;
      let fontColor = '111827';
      if (isStatusCol && cellVal === 'delay') { bg = 'FEE2E2'; fontColor = '991B1B'; }
      else if (isStatusCol && cellVal === 'ปกติ') { bg = 'DCFCE7'; fontColor = '166534'; }
      ws1[addr].s = {
        font: { name: 'Arial', sz: 10, color: { rgb: fontColor }, bold: isStatusCol },
        fill: { fgColor: { rgb: bg } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: { top: { style: 'thin', color: { rgb: 'E5E7EB' } }, bottom: { style: 'thin', color: { rgb: 'E5E7EB' } }, left: { style: 'thin', color: { rgb: 'E5E7EB' } }, right: { style: 'thin', color: { rgb: 'E5E7EB' } } },
      };
    });
  });
  ws1['!rows'] = [{ hpt: 32 }, ...summaryData.map(() => ({ hpt: 22 }))];
  XLSX.utils.book_append_sheet(wb, ws1, 'สรุปกลุ่ม');

  // ── Sheet 2: Batch Detail (ทั้งหมด) ──
  const detailHeader = [
    'กลุ่ม', 'RM Type', 'RM Group',
    'เลขเอกสาร', 'Code', 'ไลน์',
    'Batch Tag ห้องเย็น', 'Batch หลังเตรียม', 'สถานะ batch',
    'เวลาเตรียมเสร็จ', 'เข้าห้องเย็น 1', 'ออกห้องเย็น 1',
    'เข้าห้องเย็น 2', 'ออกห้องเย็น 2',
    'เข้าห้องเย็น 3', 'ออกห้องเย็น 3',
    'บรรจุเสร็จ',
    'DBS1 (h)', 'DBS2 (h)', 'DBS3 (h)', 'DBS4 (h)',
    'มาตรฐาน DBS1 (h)', 'มาตรฐาน DBS2 (h)',
    'มาตรฐาน DBS3 (h)', 'มาตรฐาน DBS4 (h)',
    'สถานะ DBS1', 'สถานะ DBS2', 'สถานะ DBS3', 'สถานะ DBS4',
  ];

  const allBatchRows = [];
  rows.forEach(r => {
    const sorted = [...r.rows].sort((a, b) => new Date(a.sc_pack_date) - new Date(b.sc_pack_date));
    sorted.forEach(batch => {
      const isDelayAny = batch.dbs1_status === 'delay' || batch.dbs2_status === 'delay' || batch.dbs3_status === 'delay' || batch.dbs4_status === 'delay';
      allBatchRows.push([
        r.name || '-',
        r.rm_type_name || '-',
        r.rm_group_name || '-',
        batch.doc_no || '-',
        batch.code || '-',
        batch.rmm_line_name || '-',
        batch.batch_before != null ? String(batch.batch_before) : '-',
        batch.batch_after  != null ? String(batch.batch_after)  : '-',
        isDelayAny ? 'delay' : 'ปกติ',
        fmtDatetime(batch.rmit_date),
        fmtDatetime(batch.come_cold_date),
        fmtDatetime(batch.out_cold_date),
        fmtDatetime(batch.come_cold_date_two),
        fmtDatetime(batch.out_cold_date_two),
        fmtDatetime(batch.come_cold_date_three),
        fmtDatetime(batch.out_cold_date_three),
        fmtDatetime(batch.sc_pack_date),
        batch.DBS1 ?? '',
        batch.DBS2 ?? '',
        batch.DBS3 ?? '',
        batch.DBS4 ?? '',
        batch.prep_to_cold ?? '',
        batch.cold ?? '',
        batch.cold_to_pack ?? '',
        batch.prep_to_pack ?? '',
        batch.dbs1_status === 'delay' ? 'delay' : 'ปกติ',
        batch.dbs2_status === 'delay' ? 'delay' : 'ปกติ',
        batch.dbs3_status === 'delay' ? 'delay' : 'ปกติ',
        batch.dbs4_status === 'delay' ? 'delay' : 'ปกติ',
      ]);
    });
  });

  const ws2 = XLSX.utils.aoa_to_sheet([detailHeader, ...allBatchRows]);
  ws2['!cols'] = [
    { wch: 28 }, { wch: 16 }, { wch: 16 },
    { wch: 18 }, { wch: 14 }, { wch: 18 },
    { wch: 20 }, { wch: 20 }, { wch: 12 },
    { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 20 }, { wch: 20 },
    { wch: 20 }, { wch: 20 },
    { wch: 20 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];

  // detail header style
  detailHeader.forEach((_, ci) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (!ws2[addr]) ws2[addr] = {};
    ws2[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 11 },
      fill: { fgColor: { rgb: '374151' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { top: { style: 'thin', color: { rgb: '1F2937' } }, bottom: { style: 'thin', color: { rgb: '1F2937' } }, left: { style: 'thin', color: { rgb: '1F2937' } }, right: { style: 'thin', color: { rgb: '1F2937' } } },
    };
  });

  // detail data style
  allBatchRows.forEach((row, ri) => {
    const isEven = ri % 2 === 0;
    const baseBg = isEven ? 'FFFFFF' : 'F8FAFF';
    row.forEach((_, ci) => {
      const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
      if (!ws2[addr]) ws2[addr] = {};
      const col = detailHeader[ci];
      const isStatusCol = col.startsWith('สถานะ');
      const cellVal = ws2[addr].v;
      let bg = baseBg;
      let fontColor = '111827';
      if ((isStatusCol || col === 'สถานะ batch') && cellVal === 'delay') { bg = 'FEE2E2'; fontColor = '991B1B'; }
      else if ((isStatusCol || col === 'สถานะ batch') && cellVal === 'ปกติ') { bg = 'DCFCE7'; fontColor = '166534'; }
      ws2[addr].s = {
        font: { name: 'Arial', sz: 10, color: { rgb: fontColor }, bold: isStatusCol },
        fill: { fgColor: { rgb: bg } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
        border: { top: { style: 'thin', color: { rgb: 'E5E7EB' } }, bottom: { style: 'thin', color: { rgb: 'E5E7EB' } }, left: { style: 'thin', color: { rgb: 'E5E7EB' } }, right: { style: 'thin', color: { rgb: 'E5E7EB' } } },
      };
    });
  });

  ws2['!rows'] = [{ hpt: 32 }, ...allBatchRows.map(() => ({ hpt: 20 }))];
  XLSX.utils.book_append_sheet(wb, ws2, 'Batch Detail');

  // ── Sheet 3: Summary info ──
  const infoData = [
    ['Export Date', new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })],
    ['Export Time', new Date().toLocaleTimeString('th-TH')],
    ['Percentile ที่ใช้', `P${percentile}`],
    ['จำนวนกลุ่ม', rows.length],
    ['จำนวน batch ทั้งหมด', allBatchRows.length],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(infoData);
  ws3['!cols'] = [{ wch: 24 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'ข้อมูลการ Export');

  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ── ExcelExportDropdown ───────────────────────────────────────────────────────
const ExcelExportDropdown = ({ onExportSummary, onExportAll, summaryCount, allCount }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          fontSize: 13, padding: '0 14px', height: 34, border: '0.5px solid #22C55E',
          borderRadius: 8, cursor: 'pointer', background: '#F0FDF4', color: '#15803D',
          fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#DCFCE7'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#F0FDF4'; }}
        title="Export Excel"
      >
        <span style={{ fontSize: 15 }}>📊</span>
        Export Excel
        <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
          background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12,
          boxShadow: '0 8px 28px rgba(0,0,0,0.14)', minWidth: 280, overflow: 'hidden',
        }}>
          {/* header */}
          <div style={{ padding: '10px 14px', background: '#F0FDF4', borderBottom: '0.5px solid #DCFCE7', fontSize: 12, fontWeight: 600, color: '#15803D', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span>📊</span> Export Excel (.xlsx)
          </div>

          {/* option 1 */}
          <div
            onClick={() => { onExportSummary(); setOpen(false); }}
            style={{ padding: '13px 16px', cursor: 'pointer', borderBottom: '0.5px solid #F3F4F6', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F0FDF4'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>📋</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Export แถวหลัก (สรุปกลุ่ม)</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{summaryCount.toLocaleString()} กลุ่ม · 1 sheet</div>
              </div>
            </div>
          </div>

          {/* option 2 */}
          <div
            onClick={() => { onExportAll(); setOpen(false); }}
            style={{ padding: '13px 16px', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F0FDF4'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>📦</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Export ข้อมูลทั้งหมด</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{summaryCount.toLocaleString()} กลุ่ม + {allCount.toLocaleString()} batch · 2 sheets</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── SearchDropdown ────────────────────────────────────────────────────────────
const SearchDropdown = ({ value, onChange, options, placeholder = 'ทั้งหมด', label }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  const isActive = !!value;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <div style={labelStyle}>{label}</div>}
      <button onClick={() => { setOpen(o => !o); setQuery(''); }} style={{
        ...inputStyle, cursor: 'pointer', minWidth: 160,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        borderColor: isActive ? '#3B82F6' : '#D1D5DB',
        background: isActive ? '#EFF6FF' : '#fff',
        color: isActive ? '#1D4ED8' : '#6B7280',
        fontWeight: isActive ? 600 : 400,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
          {value || placeholder}
        </span>
        <span style={{ fontSize: 10, opacity: 0.6, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, maxWidth: 300,
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 8, fontSize: 12, color: '#9CA3AF', pointerEvents: 'none' }}>🔍</span>
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="ค้นหา..." style={{ ...inputStyle, paddingLeft: 26, width: '100%', fontSize: 12, height: 30 }} />
              {query && <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9CA3AF', padding: 0 }}>✕</button>}
            </div>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            <div onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, background: !value ? '#EFF6FF' : 'transparent', color: !value ? '#1D4ED8' : '#374151', fontWeight: !value ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={e => { if (value) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { if (value) e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ fontSize: 11, opacity: 0.5 }}>✕</span> ทั้งหมด
            </div>
            {filtered.length === 0
              ? <div style={{ padding: '10px 12px', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>ไม่พบ "{query}"</div>
              : filtered.map(o => (
                <div key={o} onClick={() => { onChange(o); setOpen(false); setQuery(''); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, background: value === o ? '#EFF6FF' : 'transparent', color: value === o ? '#1D4ED8' : '#374151', fontWeight: value === o ? 600 : 400 }}
                  onMouseEnter={e => { if (value !== o) e.currentTarget.style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { if (value !== o) e.currentTarget.style.background = 'transparent'; }}>
                  {highlightMatch(o, query)}
                </div>
              ))}
          </div>
          <div style={{ padding: '6px 12px', borderTop: '1px solid #F3F4F6', fontSize: 11, color: '#9CA3AF' }}>
            {filtered.length} รายการ{query ? ` (ค้นหา "${query}")` : ''}
          </div>
        </div>
      )}
    </div>
  );
};

// ── MultiSelectDropdown ───────────────────────────────────────────────────────
const MultiSelectDropdown = ({ value, onChange, options, placeholder = 'ทั้งหมด', label }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  const isActive = value.length > 0;
  const toggle = (item) => onChange(value.includes(item) ? value.filter(v => v !== item) : [...value, item]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <div style={labelStyle}>{label}</div>}
      <button onClick={() => { setOpen(o => !o); setQuery(''); }} style={{
        ...inputStyle, cursor: 'pointer', minWidth: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        borderColor: isActive ? '#3B82F6' : '#D1D5DB',
        background: isActive ? '#EFF6FF' : '#fff',
        color: isActive ? '#1D4ED8' : '#6B7280',
        fontWeight: isActive ? 600 : 400,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
          {value.length === 0 ? placeholder : `เลือก ${value.length} รายการ`}
        </span>
        <span style={{ fontSize: 10, opacity: 0.6, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 120,
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 280, maxWidth: 360,
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 8, fontSize: 12, color: '#9CA3AF', pointerEvents: 'none' }}>🔍</span>
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="ค้นหาวัตถุดิบ..." style={{ ...inputStyle, paddingLeft: 26, width: '100%', fontSize: 12, height: 30 }} />
              {query && <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9CA3AF', padding: 0 }}>✕</button>}
            </div>
          </div>
          <div style={{ padding: '5px 10px', borderBottom: '1px solid #F3F4F6', display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => onChange(filtered)}
              style={{ fontSize: 11, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>
              เลือกทั้งหมด ({filtered.length})
            </button>
            {value.length > 0 && (
              <button onClick={() => onChange([])}
                style={{ fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>
                ล้าง ({value.length})
              </button>
            )}
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0
              ? <div style={{ padding: '10px 12px', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>ไม่พบ "{query}"</div>
              : filtered.map(o => {
                  const checked = value.includes(o);
                  return (
                    <div key={o} onClick={() => toggle(o)} style={{
                      padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                      background: checked ? '#EFF6FF' : 'transparent',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                      onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#F9FAFB'; }}
                      onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: 4,
                        border: `1.5px solid ${checked ? '#3B82F6' : '#D1D5DB'}`,
                        background: checked ? '#3B82F6' : '#fff',
                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                      </div>
                      <span style={{ color: checked ? '#1D4ED8' : '#374151', fontWeight: checked ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {highlightMatch(o, query)}
                      </span>
                    </div>
                  );
                })}
          </div>
          <div style={{ padding: '5px 12px', borderTop: '1px solid #F3F4F6', fontSize: 11, color: '#9CA3AF' }}>
            {filtered.length} รายการ · เลือกแล้ว {value.length}
          </div>
        </div>
      )}
    </div>
  );
};

// ── PercentileCell ────────────────────────────────────────────────────────────
const PercentileCell = ({ value, standard, count, percentile }) => {
  const [hovered, setHovered] = useState(false);
  if (value === null || value === undefined)
    return <td style={cellStyle}><span style={{ color: '#9CA3AF', fontSize: 12 }}>N/A</span></td>;
  const isDelay = standard != null && value > standard;
  const diff = standard != null ? value - standard : null;
  const color = isDelay ? '#B91C1C' : '#15803D';
  const badgeBg = isDelay ? '#FEE2E2' : '#DCFCE7';
  const badgeText = isDelay ? '#991B1B' : '#166534';
  return (
    <td style={cellStyle}>
      <div style={{ position: 'relative', display: 'inline-block' }}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', cursor: 'default' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{fmtHr(value)}</span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: badgeBg, color: badgeText, whiteSpace: 'nowrap' }}>
            {isDelay ? '⚠ delay' : '✓ ปกติ'}
          </span>
          {diff !== null && (
            <span style={{ fontSize: 10, color: isDelay ? '#EF4444' : '#9CA3AF', whiteSpace: 'nowrap' }}>
              {diff > 0 ? '+' : ''}{fmtHr(diff)} จาก {fmtHr(standard)}
            </span>
          )}
        </div>
        {hovered && (
          <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: '#1F2937', color: '#fff', borderRadius: 8, padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap', zIndex: 50, boxShadow: '0 4px 16px rgba(0,0,0,0.25)', pointerEvents: 'none' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>P{percentile} Percentile</div>
            <div>ค่า P{percentile}: <strong style={{ color: '#93C5FD' }}>{fmtHr(value)}</strong></div>
            {standard != null && <div>มาตรฐาน: <strong style={{ color: '#6EE7B7' }}>{fmtHr(standard)}</strong></div>}
            {diff !== null && <div>ต่าง: <strong style={{ color: isDelay ? '#FCA5A5' : '#6EE7B7' }}>{diff > 0 ? '+' : ''}{fmtHr(diff)}</strong></div>}
            <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #374151', color: '#9CA3AF' }}>จาก {count} batch</div>
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1F2937' }} />
          </div>
        )}
      </div>
    </td>
  );
};

// ── BatchDetailRows ───────────────────────────────────────────────────────────
const BatchDetailRows = ({ rows, colSpan }) => {
  const sorted = [...rows].sort((a, b) => new Date(a.sc_pack_date) - new Date(b.sc_pack_date));
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0, background: '#F8FAFF', borderBottom: '2px solid #DBEAFE' }}>
        <div style={{ padding: '12px 20px 16px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8' }}>📦 {rows.length} batch</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
              <thead>
                <tr style={{ background: '#EFF6FF' }}>
                  {[
                    { label: '#', sub: null },
                    { label: 'เลขเอกสาร', sub: null },
                    { label: 'Code', sub: null },
                    { label: 'ไลน์', sub: null },
                    { label: 'MAT', sub: null },
                    { label: 'MAT 2x', sub: null },
                    { label: 'น้ำหนัก (kg)', sub: null },
                    { label: 'Batch จากป้าย Tag ห้องเย็น', sub: null },
                    { label: 'Batch หลังเตรียม', sub: null },
                    { label: 'สถานะ', sub: null },
                    { label: 'เวลาเตรียมเสร็จ', sub: 'rmit_date' },
                    { label: 'เข้าห้องเย็น', sub: 'come_cold_date' },
                    { label: 'ออกห้องเย็น', sub: 'out_cold_date' },
                    { label: 'เข้าห้องเย็น 2', sub: 'come_cold_date_two' },
                    { label: 'ออกห้องเย็น 2', sub: 'out_cold_date_two' },
                    { label: 'เข้าห้องเย็น 3', sub: 'come_cold_date_three' },
                    { label: 'ออกห้องเย็น 3', sub: 'out_cold_date_three' },
                    { label: 'บรรจุเสร็จ', sub: 'sc_pack_date' },
                    { label: 'DBS1', sub: 'เตรียม→เย็น' },
                    { label: 'DBS2', sub: 'เวลาในเย็น' },
                    { label: 'DBS3', sub: 'ออกเย็น→บรรจุ' },
                    { label: 'DBS4', sub: 'เตรียม→บรรจุ' },
                  ].map((col, ci) => (
                    <th key={ci} style={{ padding: '7px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600, color: '#374151', borderBottom: '1px solid #BFDBFE' }}>
                      {col.label}
                      {col.sub && <div style={{ fontSize: 9, fontWeight: 400, color: '#93C5FD', marginTop: 1 }}>{col.sub}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => {
                  const isDelayAny = row.dbs1_status === 'delay' || row.dbs2_status === 'delay' || row.dbs3_status === 'delay' || row.dbs4_status === 'delay';
                  const rowBg = i % 2 === 0 ? '#fff' : '#F8FAFF';
                  return (
                    <tr key={row.mapping_id || i} style={{ background: rowBg, borderLeft: `3px solid ${isDelayAny ? '#EF4444' : '#22C55E'}` }}>
                      <td style={dtCell}>{i + 1}</td>
                      <td style={dtCell}>
                        {row.doc_no ? <span style={{ fontSize: 11, background: '#F3F4F6', color: '#374151', padding: '2px 7px', borderRadius: 20 }}>{row.doc_no}</span> : <span style={{ color: '#D1D5DB' }}>-</span>}
                      </td>
                      <td style={dtCell}>
                        {row.code ? <span style={{ fontSize: 11, background: '#F0F9FF', color: '#0369A1', padding: '2px 7px', borderRadius: 20, fontWeight: 500 }}>{row.code}</span> : <span style={{ color: '#D1D5DB' }}>-</span>}
                      </td>
                      <td style={dtCell}>
                        {row.rmm_line_name ? <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '2px 7px', borderRadius: 20 }}>{row.rmm_line_name}</span> : <span style={{ color: '#D1D5DB' }}>-</span>}
                      </td>
                      <td style={dtCell}>
                        {row.mat ? <span style={{ fontSize: 11, background: '#F3F4F6', color: '#374151', padding: '2px 7px', borderRadius: 20 }}>{row.mat}</span> : <span style={{ color: '#D1D5DB' }}>-</span>}
                      </td>
                      <td style={dtCell}>
                        {row.mat_2x ? <span style={{ fontSize: 11, background: '#FFF7ED', color: '#9A3412', padding: '2px 7px', borderRadius: 20 }}>{row.mat_2x}</span> : <span style={{ color: '#D1D5DB' }}>-</span>}
                      </td>
                      <td style={{ ...dtCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.weight_RM != null ? row.weight_RM.toLocaleString() : <span style={{ color: '#D1D5DB' }}>-</span>}
                      </td>
                      <td style={dtCell}>
                        {row.batch_before != null ? <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: 20 }}>{row.batch_before}</span> : <span style={{ color: '#D1D5DB' }}>-</span>}
                      </td>
                      <td style={dtCell}>
                        {row.batch_after != null ? <span style={{ fontSize: 11, background: '#F0FDF4', color: '#166534', padding: '2px 7px', borderRadius: 20 }}>{row.batch_after}</span> : <span style={{ color: '#D1D5DB' }}>-</span>}
                      </td>
                      <td style={dtCell}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', background: isDelayAny ? '#FEE2E2' : '#DCFCE7', color: isDelayAny ? '#991B1B' : '#166534' }}>
                          {isDelayAny ? '⚠ delay' : '✓ ปกติ'}
                        </span>
                      </td>
                      <td style={dtCell}><DateCell val={row.rmit_date} /></td>
                      <td style={dtCell}><DateCell val={row.come_cold_date} /></td>
                      <td style={dtCell}><DateCell val={row.out_cold_date} /></td>
                      <td style={dtCell}><DateCell val={row.come_cold_date_two} dim /></td>
                      <td style={dtCell}><DateCell val={row.out_cold_date_two} dim /></td>
                      <td style={dtCell}><DateCell val={row.come_cold_date_three} dim /></td>
                      <td style={dtCell}><DateCell val={row.out_cold_date_three} dim /></td>
                      <td style={dtCell}><DateCell val={row.sc_pack_date} /></td>
                      <td style={dtCell}><DbsCell value={row.DBS1} standard={row.prep_to_cold} isDelay={row.dbs1_status === 'delay'} /></td>
                      <td style={dtCell}><DbsCell value={row.DBS2} standard={row.cold}         isDelay={row.dbs2_status === 'delay'} /></td>
                      <td style={dtCell}><DbsCell value={row.DBS3} standard={row.cold_to_pack} isDelay={row.dbs3_status === 'delay'} /></td>
                      <td style={dtCell}><DbsCell value={row.DBS4} standard={row.prep_to_pack} isDelay={row.dbs4_status === 'delay'} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
};

// ── DateCell ──────────────────────────────────────────────────────────────────
const DateCell = ({ val, dim }) => {
  if (!val) return <span style={{ color: '#E5E7EB', fontSize: 11 }}>—</span>;
  const d = new Date(val);
  if (isNaN(d)) return <span style={{ color: '#D1D5DB' }}>-</span>;
  const date = d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{ opacity: dim ? 0.5 : 1 }}>
      <div style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>{date}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap' }}>{time}</div>
    </div>
  );
};

// ── DbsCell ───────────────────────────────────────────────────────────────────
const DbsCell = ({ value, standard, isDelay }) => {
  if (value == null) return <span style={{ color: '#D1D5DB', fontSize: 11 }}>N/A</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', display: 'inline-block', background: isDelay ? '#FEE2E2' : '#DCFCE7', color: isDelay ? '#991B1B' : '#166534' }}>
        {isDelay ? '⚠ ' : '✓ '}{fmtHr(value)}
      </span>
      {standard != null && (
        <span style={{ fontSize: 10, color: isDelay ? '#EF4444' : '#9CA3AF', paddingLeft: 2, whiteSpace: 'nowrap' }}>
          {isDelay ? `+${fmtHr(value - standard)}` : `≤ ${fmtHr(standard)}`}
        </span>
      )}
    </div>
  );
};

const dtCell = { padding: '8px 12px', borderBottom: '0.5px solid #EFF6FF', verticalAlign: 'middle', whiteSpace: 'nowrap' };

const MultiValueCell = ({ value, searchTerm }) => {
  if (!value) return <td style={cellStyle}><span style={{ color: '#9CA3AF' }}>-</span></td>;
  return (
    <td style={cellStyle}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {value.split(', ').map((v, i) => {
          const isMatch = searchTerm && v.toLowerCase().includes(searchTerm.toLowerCase());
          return (
            <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', background: isMatch ? '#FDE68A' : '#F3F4F6', color: isMatch ? '#92400E' : '#374151', fontWeight: isMatch ? 600 : 400 }}>{v}</span>
          );
        })}
      </div>
    </td>
  );
};

const SortIcon = ({ field, sortField, sortDir }) => {
  if (sortField !== field) return <span style={{ opacity: 0.3, marginLeft: 4, fontSize: 10 }}>↕</span>;
  return <span style={{ marginLeft: 4, fontSize: 10, color: '#3B82F6' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
};

const cellStyle = { padding: '10px 14px', borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'middle' };
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', background: '#F9FAFB' };
const P_OPTIONS = Array.from({ length: 99 }, (_, i) => i + 1);

const DBS_WEIGHT_DEFS = [
  { key: 'dbs1', label: 'DBS1 Status', title: 'Delay ช่วงที่ 1', sub: 'เตรียมเสร็จ → เข้าห้องเย็น', color: '#3B82F6', bg: '#EFF6FF' },
  { key: 'dbs2', label: 'DBS2 Status', title: 'Delay ช่วงที่ 2', sub: 'เข้าห้องเย็น → ออกห้องเย็น', color: '#8B5CF6', bg: '#F5F3FF' },
  { key: 'dbs3', label: 'DBS3 Status', title: 'Delay ช่วงที่ 3', sub: 'ออกห้องเย็น → บรรจุเสร็จ',  color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'dbs4', label: 'DBS4 Status', title: 'Delay ช่วงที่ 4', sub: 'เตรียมเสร็จ → บรรจุเสร็จ',   color: '#10B981', bg: '#ECFDF5' },
];

const DelayChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const delay  = payload.find(p => p.dataKey === 'delay')?.value  ?? 0;
  const normal = payload.find(p => p.dataKey === 'normal')?.value ?? 0;
  const total  = delay + normal;
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 190 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
        <span style={{ color: '#EF4444' }}>Delay</span>
        <span style={{ fontWeight: 600, color: '#EF4444' }}>{delay.toFixed(3)} MT ({total > 0 ? (delay/total*100).toFixed(1) : 0}%)</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
        <span style={{ color: '#22C55E' }}>ปกติ</span>
        <span style={{ fontWeight: 600, color: '#22C55E' }}>{normal.toFixed(3)} MT ({total > 0 ? (normal/total*100).toFixed(1) : 0}%)</span>
      </div>
      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 5, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#6B7280' }}>รวม</span>
        <span style={{ fontWeight: 600, color: '#374151' }}>{total.toFixed(3)} MT</span>
      </div>
    </div>
  );
};

const ProductionLineDelayDashboard = () => {
  const [rawData, setRawData]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');
  const [groupBy, setGroupBy]           = useState('mat_name');
  const [sortField, setSortField]       = useState('name');
  const [sortDir, setSortDir]           = useState('asc');
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterLine, setFilterLine]     = useState('');
  const [filterDoc, setFilterDoc]       = useState('');
  const [filterBatchBefore, setFilterBatchBefore] = useState('');
  const [filterBatchAfter, setFilterBatchAfter]   = useState('');
  const [filterCode, setFilterCode]     = useState('');
  const [percentile, setPercentile]     = useState(80);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [selectedDbs, setSelectedDbs]    = useState(null);
  const [filterMatNames, setFilterMatNames] = useState([]);

  const fetchData = useCallback(async (sd = startDate, ed = endDate) => {
    try {
      setLoading(true); setError(null);
      const params = new URLSearchParams();
      if (sd) params.append('start_date', sd);
      if (ed) params.append('end_date', ed);
      const res = await fetch(`${API_URL}/api/report/rm-delay/%tie/line?${params}`, {
        headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      });
      if (!res.ok) throw new Error('โหลดข้อมูลล้มเหลว');
      const json = await res.json();
      setRawData(json.success && json.data ? json.data : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, []);

  const uniqueLines       = React.useMemo(() => [...new Set(rawData.map(r => r.rmm_line_name).filter(Boolean))].sort(), [rawData]);
  const uniqueDocs        = React.useMemo(() => [...new Set(rawData.map(r => r.doc_no).filter(Boolean))].sort(), [rawData]);
  const uniqueBatchBefore = React.useMemo(() => [...new Set(rawData.map(r => r.batch_before).filter(v => v != null).map(String))].sort(), [rawData]);
  const uniqueBatchAfter  = React.useMemo(() => [...new Set(rawData.map(r => r.batch_after).filter(v => v != null).map(String))].sort(), [rawData]);
  const uniqueCodes       = React.useMemo(() => [...new Set(rawData.map(r => r.code).filter(Boolean))].sort(), [rawData]);
  const uniqueMatNames    = React.useMemo(() => [...new Set(rawData.map(r => r.mat_name).filter(Boolean))].sort(), [rawData]);

  const filteredRaw = React.useMemo(() =>
    rawData.filter(r => {
      if (filterMatNames.length > 0 && !filterMatNames.includes(r.mat_name)) return false;
      if (filterLine        && r.rmm_line_name !== filterLine)               return false;
      if (filterDoc         && r.doc_no        !== filterDoc)                return false;
      if (filterBatchBefore && String(r.batch_before) !== filterBatchBefore) return false;
      if (filterBatchAfter  && String(r.batch_after)  !== filterBatchAfter)  return false;
      if (filterCode        && r.code          !== filterCode)               return false;
      return true;
    }), [rawData, filterMatNames, filterLine, filterDoc, filterBatchBefore, filterBatchAfter, filterCode]);

  const rows = React.useMemo(() => {
    const grouped = buildGroupedRows(filteredRaw, groupBy, percentile);
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? grouped.filter(r =>
          r.name?.toLowerCase().includes(q) ||
          r.rm_type_name?.toLowerCase().includes(q) ||
          r.rm_group_name?.toLowerCase().includes(q) ||
          r.rmm_line_name?.toLowerCase().includes(q) ||
          r.doc_no?.toLowerCase().includes(q) ||
          r.batch_before?.toLowerCase().includes(q) ||
          r.batch_after?.toLowerCase().includes(q) ||
          r.code?.toLowerCase().includes(q))
      : grouped;
    return [...filtered].sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv, 'th') : bv.localeCompare(av, 'th');
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [filteredRaw, groupBy, percentile, sortField, sortDir, searchTerm]);

  const metrics = React.useMemo(() => {
    const total = filteredRaw.length, groups = rows.length;
    const delayCount = rows.filter(r =>
      (r.dbs1 != null && r.prep_to_cold != null && r.dbs1 > r.prep_to_cold) ||
      (r.dbs2 != null && r.cold         != null && r.dbs2 > r.cold)         ||
      (r.dbs3 != null && r.cold_to_pack != null && r.dbs3 > r.cold_to_pack) ||
      (r.dbs4 != null && r.prep_to_pack != null && r.dbs4 > r.prep_to_pack)
    ).length;
    return { total, groups, delayCount };
  }, [rows, filteredRaw]);

  // total batch count for dropdown label
  const totalBatchCount = React.useMemo(() => rows.reduce((s, r) => s + r.rows.length, 0), [rows]);

  const tableRows = React.useMemo(() => {
    if (!selectedDbs) return rows;
    return rows.filter(r => {
      if (selectedDbs === 'dbs1') return r.dbs1 != null && r.prep_to_cold != null && r.dbs1 > r.prep_to_cold;
      if (selectedDbs === 'dbs2') return r.dbs2 != null && r.cold         != null && r.dbs2 > r.cold;
      if (selectedDbs === 'dbs3') return r.dbs3 != null && r.cold_to_pack != null && r.dbs3 > r.cold_to_pack;
      if (selectedDbs === 'dbs4') return r.dbs4 != null && r.prep_to_pack != null && r.dbs4 > r.prep_to_pack;
      return true;
    });
  }, [rows, selectedDbs]);

  const dbsStats = React.useMemo(() => {
    const compute = (statusField, dbsField) => {
      const relevant = filteredRaw.filter(r => r[dbsField] != null);
      const totalKg  = relevant.reduce((s, r) => s + (r.weight_RM || 0), 0);
      const delayKg  = relevant.filter(r => r[statusField] === 'delay').reduce((s, r) => s + (r.weight_RM || 0), 0);
      const totalMt  = totalKg / 1000;
      const delayPct = totalKg > 0 ? (delayKg / totalKg * 100) : 0;
      return { totalMt, delayPct, normalPct: 100 - delayPct };
    };
    return {
      dbs1: compute('dbs1_status', 'DBS1'),
      dbs2: compute('dbs2_status', 'DBS2'),
      dbs3: compute('dbs3_status', 'DBS3'),
      dbs4: compute('dbs4_status', 'DBS4'),
    };
  }, [filteredRaw]);

  const chartData = React.useMemo(() => {
    if (!selectedDbs) return [];
    const statusField = `${selectedDbs}_status`;
    const dbsField    = selectedDbs.toUpperCase();
    const groups = {};
    filteredRaw.forEach(r => {
      if (r[dbsField] == null) return;
      const d = r.sc_pack_date ? new Date(r.sc_pack_date) : null;
      const key = d && !isNaN(d) ? d.toISOString().split('T')[0] : '(ไม่ระบุ)';
      if (!groups[key]) groups[key] = { name: key, delay: 0, normal: 0 };
      const w = (r.weight_RM || 0) / 1000;
      if (r[statusField] === 'delay') groups[key].delay += w;
      else groups[key].normal += w;
    });
    return Object.values(groups)
      .map(g => ({ name: g.name, delay: +g.delay.toFixed(4), normal: +g.normal.toFixed(4) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredRaw, selectedDbs]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir(['name', 'rmm_line_name', 'doc_no', 'batch_before', 'batch_after', 'code'].includes(field) ? 'asc' : 'desc'); }
  };

  const toggleExpand = (name) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleReset = () => {
    setStartDate(''); setEndDate('');
    setGroupBy('mat_name'); setSortField('name'); setSortDir('asc');
    setSearchTerm(''); setFilterMatNames([]); setFilterLine(''); setFilterDoc('');
    setFilterBatchBefore(''); setFilterBatchAfter(''); setFilterCode('');
    setPercentile(80); setExpandedRows(new Set());
    fetchData('', '');
  };

  // ── Excel handlers ──
  const handleExportSummary = () => {
    if (rows.length === 0) return;
    exportSummaryExcel(rows, percentile, 'delay_summary');
  };

  const handleExportAll = () => {
    if (rows.length === 0) return;
    exportAllDetailExcel(rows, percentile, 'delay_all');
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #E5E7EB', borderTop: '3px solid #3B82F6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (error) return (
    <div style={{ padding: '1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 14 }}>
      เกิดข้อผิดพลาด: {error}
    </div>
  );

  const searchPlaceholder =
    groupBy === 'mat_name'      ? 'ค้นหา RM name...'   :
    groupBy === 'rm_type_name'  ? 'ค้นหา RM type...'   :
    groupBy === 'rmm_line_name' ? 'ค้นหา ไลน์...'      :
    groupBy === 'doc_no'        ? 'ค้นหา เลขเอกสาร...' : 'ค้นหา RM group...';

  const columns = [
    { key: 'expand',        label: '',                              sub: null, minW: 40  },
    { key: 'name',          label: 'ชื่อ',                         sub: null, minW: 160 },
    { key: 'rm_type_name',  label: 'RM Type',                      sub: null, minW: 100 },
    { key: 'rm_group_name', label: 'RM Group',                     sub: null, minW: 100 },
    { key: 'mat',           label: 'MAT',                          sub: null, minW: 100 },
    { key: 'mat_2x',        label: 'MAT 2x',                       sub: null, minW: 100 },
    { key: 'weight_total',  label: 'น้ำหนัก',                      sub: '(kg)', minW: 100 },
    { key: 'rmm_line_name', label: 'ไลน์',                         sub: null, minW: 120 },
    { key: 'doc_no',        label: 'เลขเอกสาร',                    sub: null, minW: 130 },
    { key: 'code',          label: 'Code',                         sub: null, minW: 100 },
    { key: 'batch_before',  label: 'Batch จากป้าย Tag ห้องเย็น',   sub: null, minW: 160 },
    { key: 'batch_after',   label: 'Batch หลังเตรียม',             sub: null, minW: 130 },
    { key: 'dbs1', label: 'DBS1', sub: 'เตรียม→เย็น',   minW: 130 },
    { key: 'dbs2', label: 'DBS2', sub: 'เวลาในเย็น',    minW: 130 },
    { key: 'dbs3', label: 'DBS3', sub: 'ออกเย็น→บรรจุ', minW: 130 },
    { key: 'dbs4', label: 'DBS4', sub: 'เตรียม→บรรจุ',  minW: 130 },
  ];

  const activeFilters = filterLine || filterDoc || filterBatchBefore || filterBatchAfter || filterCode;

  return (
    <div style={{ padding: '1rem 0', fontFamily: 'inherit' }}>

      {/* ── filter bar ── */}
      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>ตัวกรองข้อมูล</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <div style={labelStyle}>จัดกลุ่มตาม</div>
            <select value={groupBy} onChange={e => { setGroupBy(e.target.value); setSearchTerm(''); setExpandedRows(new Set()); }} style={inputStyle}>
              <option value="mat_name">Mat Name</option>
              <option value="rm_type_name">RM Type</option>
              <option value="rm_group_name">RM Group</option>
              <option value="rmm_line_name">ไลน์</option>
              <option value="doc_no">เลขเอกสาร</option>
            </select>
          </div>
          <MultiSelectDropdown label="ชื่อวัตถุดิบ (RM)" value={filterMatNames} onChange={setFilterMatNames} options={uniqueMatNames} placeholder="ทั้งหมด" />
          <SearchDropdown label="ไลน์"                          value={filterLine}        onChange={setFilterLine}        options={uniqueLines}       placeholder="ทั้งหมด" />
          <SearchDropdown label="เลขเอกสาร"                     value={filterDoc}         onChange={setFilterDoc}         options={uniqueDocs}        placeholder="ทั้งหมด" />
          <SearchDropdown label="Code"                          value={filterCode}        onChange={setFilterCode}        options={uniqueCodes}       placeholder="ทั้งหมด" />
          <SearchDropdown label="Batch จากป้าย Tag ห้องเย็น"    value={filterBatchBefore} onChange={setFilterBatchBefore} options={uniqueBatchBefore} placeholder="ทั้งหมด" />
          <SearchDropdown label="Batch หลังเตรียม"              value={filterBatchAfter}  onChange={setFilterBatchAfter}  options={uniqueBatchAfter}  placeholder="ทั้งหมด" />
          <div>
            <div style={labelStyle}>Percentile (P)</div>
            <select value={percentile} onChange={e => setPercentile(Number(e.target.value))}
              style={{ ...inputStyle, borderColor: '#3B82F6', color: '#1D4ED8', fontWeight: 600, minWidth: 90 }}>
              {P_OPTIONS.map(p => <option key={p} value={p}>P{p}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>ค้นหา</div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 9, fontSize: 13, color: '#9CA3AF', pointerEvents: 'none' }}>🔍</span>
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={searchPlaceholder}
                style={{ ...inputStyle, paddingLeft: 28, minWidth: 180 }} />
              {searchTerm && <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#9CA3AF', padding: 0 }}>✕</button>}
            </div>
          </div>
          <div>
            <div style={labelStyle}>เรียงตาม</div>
            <select value={sortField} onChange={e => { const f = e.target.value; setSortField(f); setSortDir(['name', 'rmm_line_name', 'doc_no', 'batch_before', 'batch_after', 'code'].includes(f) ? 'asc' : 'desc'); }} style={inputStyle}>
              <option value="name">ชื่อ</option>
              <option value="rmm_line_name">ไลน์</option>
              <option value="doc_no">เลขเอกสาร</option>
              <option value="code">Code</option>
              <option value="batch_before">Batch จากป้าย Tag ห้องเย็น</option>
              <option value="batch_after">Batch หลังเตรียม</option>
              <option value="dbs1">DBS1</option>
              <option value="dbs2">DBS2</option>
              <option value="dbs3">DBS3</option>
              <option value="dbs4">DBS4</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>ทิศทาง</div>
            <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              style={{ ...inputStyle, cursor: 'pointer', minWidth: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {sortDir === 'asc' ? <><span>↑</span><span>น้อย→มาก</span></> : <><span>↓</span><span>มาก→น้อย</span></>}
            </button>
          </div>
          <div>
            <div style={labelStyle}>วันเริ่มต้น</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>วันสิ้นสุด</div>
            <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
          </div>
          <button onClick={() => fetchData()} style={btnPrimary}>ยืนยัน</button>
          <button onClick={handleReset} style={btnSecondary}>รีเซ็ต</button>

          {/* ── Excel Export dropdown ── */}
          <div>
            <div style={labelStyle}>&nbsp;</div>
            <ExcelExportDropdown
              onExportSummary={handleExportSummary}
              onExportAll={handleExportAll}
              summaryCount={rows.length}
              allCount={totalBatchCount}
            />
          </div>
        </div>

        {/* active filter tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {(startDate || endDate) && (
            <div style={{ fontSize: 12, color: '#1D4ED8', background: '#EFF6FF', padding: '4px 10px', borderRadius: 6 }}>
              📅 {startDate ? `ตั้งแต่ ${startDate}` : ''}{endDate ? ` ถึง ${endDate}` : ''}
            </div>
          )}
          {filterMatNames.length > 0 && (
            <div style={{ fontSize: 12, color: '#1D4ED8', background: '#EFF6FF', padding: '4px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, maxWidth: 400, flexWrap: 'wrap' }}>
              🧪 วัตถุดิบ:&nbsp;
              {filterMatNames.slice(0, 3).map(n => <strong key={n} style={{ marginRight: 4 }}>{n}</strong>)}
              {filterMatNames.length > 3 && <span style={{ color: '#6B7280' }}>+{filterMatNames.length - 3} อื่น</span>}
              <button onClick={() => setFilterMatNames([])} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1D4ED8', padding: 0, marginLeft: 2 }}>✕</button>
            </div>
          )}
          {filterLine && (
            <div style={{ fontSize: 12, color: '#1D4ED8', background: '#EFF6FF', padding: '4px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              📍 ไลน์: <strong>{filterLine}</strong>
              <button onClick={() => setFilterLine('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1D4ED8', padding: 0 }}>✕</button>
            </div>
          )}
          {filterDoc && (
            <div style={{ fontSize: 12, color: '#1D4ED8', background: '#EFF6FF', padding: '4px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              📄 เอกสาร: <strong>{filterDoc}</strong>
              <button onClick={() => setFilterDoc('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1D4ED8', padding: 0 }}>✕</button>
            </div>
          )}
          {filterCode && (
            <div style={{ fontSize: 12, color: '#0369A1', background: '#F0F9FF', padding: '4px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              🏷️ Code: <strong>{filterCode}</strong>
              <button onClick={() => setFilterCode('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#0369A1', padding: 0 }}>✕</button>
            </div>
          )}
          {filterBatchBefore && (
            <div style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', padding: '4px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              📦 Batch Tag: <strong>{filterBatchBefore}</strong>
              <button onClick={() => setFilterBatchBefore('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#92400E', padding: 0 }}>✕</button>
            </div>
          )}
          {filterBatchAfter && (
            <div style={{ fontSize: 12, color: '#166534', background: '#F0FDF4', padding: '4px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              📦 Batch หลังเตรียม: <strong>{filterBatchAfter}</strong>
              <button onClick={() => setFilterBatchAfter('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#166534', padding: 0 }}>✕</button>
            </div>
          )}
          {searchTerm && (
            <div style={{ fontSize: 12, color: '#6D28D9', background: '#EDE9FE', padding: '4px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              🔍 <strong>{searchTerm}</strong>
              <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6D28D9', padding: 0 }}>✕</button>
            </div>
          )}
          <div style={{ fontSize: 12, color: '#6D28D9', background: '#EDE9FE', padding: '4px 10px', borderRadius: 6 }}>📊 P{percentile}</div>
          {activeFilters && (
            <div style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', padding: '4px 10px', borderRadius: 6, border: '0.5px solid #E5E7EB' }}>
              คำนวณจาก <strong>{filteredRaw.length}</strong> batch (จาก {rawData.length})
            </div>
          )}
        </div>
      </div>

      {/* ── metric cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'batch ทั้งหมด',                     value: metrics.total,                       sub: `${metrics.groups} กลุ่ม`,     color: '#3B82F6' },
          { label: `กลุ่มที่ P${percentile} > มาตรฐาน`, value: metrics.delayCount,                  sub: `จาก ${metrics.groups} กลุ่ม`, color: '#EF4444' },
          { label: 'กลุ่มที่ปกติ',                       value: metrics.groups - metrics.delayCount, sub: 'ทุก DBS ≤ มาตรฐาน',           color: '#22C55E' },
        ].map((m, i) => (
          <div key={i} style={{ background: '#F9FAFB', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── DBS Weight Status Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginBottom: 16 }}>
        {DBS_WEIGHT_DEFS.map(d => {
          const s = dbsStats[d.key];
          const isActive = selectedDbs === d.key;
          return (
            <div key={d.key} onClick={() => setSelectedDbs(prev => prev === d.key ? null : d.key)} style={{
              background: isActive ? d.bg : '#F9FAFB',
              border: `1.5px solid ${isActive ? d.color : '#E5E7EB'}`,
              borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
              transition: 'all 0.18s',
              boxShadow: isActive ? `0 2px 12px ${d.color}33` : 'none',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? d.color : '#6B7280', marginBottom: 1 }}>{d.label}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 8 }}>{d.sub}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                {s.totalMt.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 400, color: '#6B7280' }}>MT</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: '#EF4444' }}>Delay</span>
                <span style={{ fontWeight: 600, color: '#EF4444' }}>{s.delayPct.toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: '#22C55E' }}>ปกติ</span>
                <span style={{ fontWeight: 600, color: '#22C55E' }}>{s.normalPct.toFixed(2)}%</span>
              </div>
              <div style={{ height: 5, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${s.delayPct}%`, background: '#EF4444', borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── DBS Delay Bar Chart ── */}
      {chartData.length > 0 && (
        <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                {DBS_WEIGHT_DEFS.find(d => d.key === selectedDbs)?.title} — วิเคราะห์ Delay ตามน้ำหนัก
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                {DBS_WEIGHT_DEFS.find(d => d.key === selectedDbs)?.sub}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 12, alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 12, background: '#22C55E', borderRadius: 2 }} />
                <span style={{ color: '#6B7280' }}>ปกติ</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 12, background: '#EF4444', borderRadius: 2 }} />
                <span style={{ color: '#6B7280' }}>Delay</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {DBS_WEIGHT_DEFS.map(d => (
              <button key={d.key} onClick={() => setSelectedDbs(d.key)} style={{
                padding: '7px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                border: selectedDbs === d.key ? `1.5px solid ${d.color}` : '1px solid #E5E7EB',
                background: selectedDbs === d.key ? `${d.color}18` : '#F9FAFB',
                color: selectedDbs === d.key ? d.color : '#6B7280',
                transition: 'all 0.18s',
              }}>
                <div style={{ fontSize: 12, fontWeight: selectedDbs === d.key ? 600 : 400 }}>{d.title}</div>
                <div style={{ fontSize: 10, opacity: 0.75, marginTop: 1 }}>{d.sub}</div>
              </button>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B7280' }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={v => v.toFixed(0)} unit=" MT" width={55} />
              <RechartsTip content={<DelayChartTooltip />} />
              <Bar dataKey="normal" name="ปกติ"  stackId="s" fill="#22C55E" />
              <Bar dataKey="delay"  name="Delay" stackId="s" fill="#EF4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── legend ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12, fontSize: 11, color: '#6B7280', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: '#374151' }}>P{percentile}:</span>
        {[{ dot: '#22C55E', label: 'ปกติ (≤ มาตรฐาน)' }, { dot: '#EF4444', label: 'delay (> มาตรฐาน)' }].map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.dot }} />
            <span>{l.label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>▶ คลิกแถวเพื่อดู batch detail</span>
        <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>
          {tableRows.length} กลุ่ม{selectedDbs ? ` (delay ${selectedDbs.toUpperCase()})` : ''} · {filteredRaw.length} batch{activeFilters ? ' (กรองแล้ว)' : ''}
        </span>
      </div>

      {/* ── table ── */}
      {selectedDbs && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          {(() => {
            const d = DBS_WEIGHT_DEFS.find(x => x.key === selectedDbs);
            return (
              <>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: d.bg, color: d.color, border: `1px solid ${d.color}` }}>
                  ▼ กรอง: {d.label} — delay เท่านั้น ({tableRows.length} กลุ่ม)
                </span>
                <button onClick={() => setSelectedDbs(null)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px solid #D1D5DB', background: '#fff', color: '#6B7280', cursor: 'pointer' }}>
                  ล้างการกรอง
                </button>
              </>
            );
          })()}
        </div>
      )}
      {tableRows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9CA3AF', fontSize: 13, border: '0.5px solid #F3F4F6', borderRadius: 12 }}>
          {selectedDbs ? `ไม่พบกลุ่มที่ delay ใน ${selectedDbs.toUpperCase()}` : searchTerm ? `ไม่พบผลลัพธ์สำหรับ "${searchTerm}"` : 'ไม่มีข้อมูล'}
        </div>
      ) : (
        <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key}
                    onClick={() => col.key !== 'expand' && handleSort(col.key)}
                    style={{ ...thStyle, minWidth: col.minW, cursor: col.key === 'expand' ? 'default' : 'pointer' }}>
                    <span>{col.label}</span>
                    {col.sub && <div style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF' }}>{col.sub}</div>}
                    {col.key !== 'expand' && <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => {
                const isExpanded = expandedRows.has(r.name);
                const hasDelay =
                  (r.dbs1 != null && r.prep_to_cold != null && r.dbs1 > r.prep_to_cold) ||
                  (r.dbs2 != null && r.cold         != null && r.dbs2 > r.cold)         ||
                  (r.dbs3 != null && r.cold_to_pack != null && r.dbs3 > r.cold_to_pack) ||
                  (r.dbs4 != null && r.prep_to_pack != null && r.dbs4 > r.prep_to_pack);

                return (
                  <React.Fragment key={r.name}>
                    <tr
                      style={{ background: isExpanded ? '#EFF6FF' : (i % 2 === 0 ? '#fff' : '#FAFAFA'), cursor: 'pointer' }}
                      onClick={() => toggleExpand(r.name)}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#F0F9FF'; }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFAFA'; }}>

                      <td style={{ ...cellStyle, textAlign: 'center', width: 40 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: isExpanded ? '#DBEAFE' : '#F3F4F6', color: isExpanded ? '#1D4ED8' : '#6B7280', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </td>
                      <td style={{ ...cellStyle, fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {hasDelay && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', flexShrink: 0, display: 'inline-block' }} />}
                          {searchTerm && r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ? highlightMatch(r.name, searchTerm) : r.name}
                        </div>
                      </td>
                      <td style={{ ...cellStyle, color: '#6B7280' }}>{r.rm_type_name || '-'}</td>
                      <td style={{ ...cellStyle, color: '#6B7280' }}>{r.rm_group_name || '-'}</td>
                      <MultiValueCell value={r.mat}    searchTerm={searchTerm} />
                      <MultiValueCell value={r.mat_2x} searchTerm={searchTerm} />
                      <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>
                        {r.weight_total != null ? r.weight_total.toLocaleString() : '-'}
                      </td>
                      <MultiValueCell value={r.rmm_line_name} searchTerm={searchTerm} />
                      <MultiValueCell value={r.doc_no}        searchTerm={searchTerm} />
                      <td style={cellStyle}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {r.code ? r.code.split(', ').map((c, ci) => {
                            const isMatch = searchTerm && c.toLowerCase().includes(searchTerm.toLowerCase());
                            return (
                              <span key={ci} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', background: isMatch ? '#FDE68A' : '#F0F9FF', color: isMatch ? '#92400E' : '#0369A1', fontWeight: isMatch ? 600 : 500 }}>{c}</span>
                            );
                          }) : <span style={{ color: '#9CA3AF' }}>-</span>}
                        </div>
                      </td>
                      <MultiValueCell value={r.batch_before}  searchTerm={searchTerm} />
                      <MultiValueCell value={r.batch_after}   searchTerm={searchTerm} />
                      <PercentileCell value={r.dbs1} standard={r.prep_to_cold} count={r.dbs1_count} percentile={percentile} />
                      <PercentileCell value={r.dbs2} standard={r.cold}         count={r.dbs2_count} percentile={percentile} />
                      <PercentileCell value={r.dbs3} standard={r.cold_to_pack} count={r.dbs3_count} percentile={percentile} />
                      <PercentileCell value={r.dbs4} standard={r.prep_to_pack} count={r.dbs4_count} percentile={percentile} />
                    </tr>
                    {isExpanded && <BatchDetailRows rows={r.rows} colSpan={columns.length} />}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

function highlightMatch(text, query) {
  if (!text || !query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return <>{text.slice(0, idx)}<mark style={{ background: '#FDE68A', color: '#92400E', borderRadius: 2, padding: '0 2px' }}>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
}

const labelStyle   = { fontSize: 11, color: '#6B7280', marginBottom: 4 };
const inputStyle   = { fontSize: 13, padding: '6px 10px', height: 34, border: '0.5px solid #D1D5DB', borderRadius: 8, background: '#fff', color: '#111827', outline: 'none' };
const btnPrimary   = { fontSize: 13, padding: '0 16px', height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', background: '#3B82F6', color: '#fff', fontWeight: 500 };
const btnSecondary = { fontSize: 13, padding: '0 16px', height: 34, border: '0.5px solid #D1D5DB', borderRadius: 8, cursor: 'pointer', background: '#fff', color: '#374151' };

export default ProductionLineDelayDashboard;