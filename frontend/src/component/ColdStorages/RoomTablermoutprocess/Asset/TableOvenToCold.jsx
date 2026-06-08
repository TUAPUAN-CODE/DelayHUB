import React, { useState, useEffect } from 'react';
import {
  Table, TableContainer, TableHead, TableBody, TableRow, TableCell,
  Paper, Box, TextField, Collapse, TablePagination, Typography,
  Button, Menu, MenuItem, Tooltip
} from '@mui/material';
import { InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { FaEdit } from "react-icons/fa";
import axios from 'axios';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL;


// ─── Timeline ────────────────────────────────────────────────────────────────
const ALL_TIME_FIELDS_CS = [
  { key: 'start_defrost_date',       label: 'เริ่มละลาย',                color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date',         label: 'ละลายเสร็จ',                color: '#0277bd', bg: '#e3f2fd' },
  { key: 'start_defrost_date_two',   label: 'เริ่มละลาย (รอบ 2)',        color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date_two',     label: 'ละลายเสร็จ (รอบ 2)',        color: '#0277bd', bg: '#e3f2fd' },
  { key: 'start_defrost_date_three', label: 'เริ่มละลาย (รอบ 3)',        color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date_three',   label: 'ละลายเสร็จ (รอบ 3)',        color: '#0277bd', bg: '#e3f2fd' },
  { key: 'start_defrost_date_four',  label: 'เริ่มละลาย (รอบ 4)',        color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date_four',    label: 'ละลายเสร็จ (รอบ 4)',        color: '#0277bd', bg: '#e3f2fd' },
  { key: 'withdraw_date',            label: 'ส่งออกห้องเย็น',             color: '#1565C0', bg: '#e8eaf6' },
  { key: 'input_pd_date',            label: 'ไลน์รับเข้า รอบ 1',         color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date',           label: 'ไลน์ส่งคืน รอบ 1',          color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date',            label: 'ห้องเย็นรับเข้า รอบ 1',     color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_two',        label: 'ส่งออกห้องเย็น รอบ 2',      color: '#1565C0', bg: '#e8eaf6' },
  { key: 'input_pd_date_two',        label: 'ไลน์รับเข้า รอบ 2',         color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date_two',       label: 'ไลน์ส่งคืน รอบ 2',          color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date_two',        label: 'ห้องเย็นรับเข้า รอบ 2',     color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_three',      label: 'ส่งออกห้องเย็น รอบ 3',      color: '#1565C0', bg: '#e8eaf6' },
  { key: 'input_pd_date_three',      label: 'ไลน์รับเข้า รอบ 3',         color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date_three',     label: 'ไลน์ส่งคืน รอบ 3',          color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date_three',      label: 'ห้องเย็นรับเข้า รอบ 3',     color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_four',       label: 'ส่งออกห้องเย็น รอบ 4',      color: '#1565C0', bg: '#e8eaf6' },
];

const ROUND_EXTRA = {
  input_cd_date:       { purposeKey: 'storage_purpose',   histKey: 'histamine',   remarkKey: 'pd_remark_1' },
  input_cd_date_two:   { purposeKey: 'storage_purpose_2', histKey: 'histamine_2', remarkKey: 'pd_remark_2' },
  input_cd_date_three: { purposeKey: 'storage_purpose_3', histKey: 'histamine_3', remarkKey: 'pd_remark_3' },
};

const TimelineSubRow = ({ row, colSpan }) => {
  const sorted = ALL_TIME_FIELDS_CS
    .filter(f => row[f.key])
    .map(f => ({ ...f, value: row[f.key] }))
    .sort((a, b) => new Date(a.value.replace(' ', 'T')) - new Date(b.value.replace(' ', 'T')));

  if (sorted.length === 0) return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ p: 1.5, bgcolor: '#f8f9fa', borderBottom: '1px solid #e0e0e0', textAlign: 'center' }}>
        <Typography sx={{ fontSize: '12px', color: '#aaa' }}>ไม่มีข้อมูล Timeline</Typography>
      </TableCell>
    </TableRow>
  );

  return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ p: 0, border: 0 }}>
        <Box sx={{ px: 2, py: 1.5, bgcolor: '#f8f9fa', borderBottom: '1px solid #e0e0e0' }}>
          <Typography sx={{ fontSize: '11px', color: '#888', mb: 1, fontWeight: 600, letterSpacing: '0.5px' }}>
            TIMELINE
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', pb: 1, gap: 0 }}>
            {sorted.map((f, i) => {
              const extra = ROUND_EXTRA[f.key];
              const purpose = extra ? row[extra.purposeKey] : null;
              const hist = extra != null ? row[extra.histKey] : undefined;
              const remark = extra ? row[extra.remarkKey] : null;
              return (
                <Box key={f.key} sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <Box sx={{
                    position: 'relative', minWidth: '120px', maxWidth: '160px',
                    bgcolor: f.bg, border: `1px solid ${f.color}`,
                    borderRadius: '6px', px: 1.5, pt: 2, pb: 1,
                  }}>
                    <Box sx={{
                      position: 'absolute', top: '-10px', left: '8px',
                      width: '20px', height: '20px', borderRadius: '50%',
                      bgcolor: f.color, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 700,
                    }}>{i + 1}</Box>
                    <Typography sx={{ fontSize: '10px', color: f.color, fontWeight: 600, lineHeight: 1.2, mb: 0.5 }}>
                      {f.label}
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: '#333', fontWeight: 500 }}>
                      {f.value}
                    </Typography>
                    {purpose && (
                      <Typography sx={{ fontSize: '10px', color: '#6a1b9a', mt: 0.5, pt: 0.5, borderTop: '1px solid #e0e0e0' }}>
                        <span style={{ color: '#888', fontWeight: 700, fontSize: '9px' }}>วัตถุประสงค์: </span>{purpose}
                      </Typography>
                    )}
                    {hist != null && (
                      <Typography sx={{ fontSize: '10px', mt: 0.25, color: hist > 100 ? '#494848' : hist > 50 ? '#e65100' : '#2e7d32', fontWeight: 600 }}>
                        <span style={{ color: '#888', fontWeight: 700, fontSize: '9px' }}>Histamine: </span>{hist} ppm
                      </Typography>
                    )}
                    {remark && (
                      <Typography sx={{ fontSize: '10px', color: '#555', mt: 0.25, pt: 0.5, borderTop: '1px solid #e0e0e0' }}>
                        <span style={{ color: '#888', fontWeight: 700, fontSize: '9px' }}>หมายเหตุ: </span>{remark}
                      </Typography>
                    )}
                  </Box>
                  {i < sorted.length - 1 && (
                    <Typography sx={{ mx: 0.5, color: '#bbb', fontSize: '18px', flexShrink: 0, alignSelf: 'center' }}>›</Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </TableCell>
    </TableRow>
  );
};

// ─── Row ──────────────────────────────────────────────────────────────────────
const Row = ({ row, tableColumns, index, handleOpenDeleteModal }) => {
  if (!row) return null;
  const backgroundColor = index % 2 === 0 ? '#ffffff' : 'hsl(210,100%,93%)';
  const [expandedTimeline, setExpandedTimeline] = useState(false);

  return (
    <>
      <TableRow><TableCell style={{ height: '4px', padding: 0, border: 'none' }} /></TableRow>
      <TableRow>
        {tableColumns.map((col, i) => (
          <TableCell key={col.id} align="center" style={{ width: col.width, borderLeft: i === 0 ? '5px solid #9e9e9e' : '1px solid #f2f2f2', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', borderTopLeftRadius: i === 0 ? '8px' : 0, borderBottomLeftRadius: i === 0 ? '8px' : 0, whiteSpace: 'normal', wordWrap: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px', height: '36px', lineHeight: '1.4', padding: '0px 8px', color: col.getColor ? col.getColor(col.getValue ? col.getValue(row) : row[col.id]) : '#787878', backgroundColor }}>
            {(col.getValue ? col.getValue(row) : row[col.id]) ?? '-'}
          </TableCell>
        ))}
        {/* Timeline Eye */}
        <TableCell onClick={() => setExpandedTimeline(prev => !prev)} align="center" sx={{ borderLeft: '1px solid #e0e0e0', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', height: '36px', padding: 0, cursor: 'pointer', backgroundColor, '&:hover': { backgroundColor: 'rgba(33,150,243,0.15)' } }}>
          <Tooltip title={expandedTimeline ? 'ซ่อน Timeline' : 'ดู Timeline'} placement="left">
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: '8px' }}>
              {expandedTimeline
                ? <VisibilityOffIcon sx={{ color: '#1565C0', fontSize: '18px' }} />
                : <VisibilityIcon sx={{ color: '#9e9e9e', fontSize: '18px' }} />}
            </Box>
          </Tooltip>
        </TableCell>
        {/* Edit HU */}
        <TableCell onClick={(e) => { e.stopPropagation(); handleOpenDeleteModal?.(row); }} align="center" sx={{ borderLeft: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', height: '36px', padding: 0, cursor: 'pointer', backgroundColor, borderTopRightRadius: '8px', borderBottomRightRadius: '8px', '&:hover': { backgroundColor: 'rgba(255,152,0,0.15)' }, '&:hover .edit-hu-icon': { color: '#E65100', transform: 'scale(1.2)' } }}>
          <Tooltip title="เปลี่ยน HU">
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#FF9800', p: '8px', transition: 'all 0.2s' }} className="edit-hu-icon">
              <FaEdit style={{ fontSize: '16px' }} />
            </Box>
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow><TableCell style={{ height: '4px', padding: 0, border: 'none' }} /></TableRow>
      <TableRow>
        <TableCell style={{ padding: 0, border: 'none' }} colSpan={tableColumns.length + 2}>
          <Collapse in={expandedTimeline} timeout="auto" unmountOnExit>
            <TimelineSubRow row={row} colSpan={tableColumns.length + 2} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

// ─── tableColumns ─────────────────────────────────────────────────────────────
const tableColumns = [
  { id: 'batch',           name: 'Batch',           width: '120px' },
  { id: 'mat',             name: 'Material',         width: '130px' },
  { id: 'hu',              name: 'HU',               width: '110px' },
  { id: 'weight',          name: 'น้ำหนัก (kg)',      width: '100px' },
  { id: 'remark',          name: 'Remark',           width: '130px',
    getValue: (row) => row.pd_remark_3 ?? row.pd_remark_2 ?? row.pd_remark_1 ?? row.remark },
  { id: 'storage_purpose', name: 'วัตถุประสงค์',      width: '140px',
    getValue: (row) => row.storage_purpose_3 ?? row.storage_purpose_2 ?? row.storage_purpose },
  { id: 'histamine',       name: 'Histamine',        width: '110px',
    getValue: (row) => row.histamine_3 ?? row.histamine_2 ?? row.histamine,
    getColor: (v) => v != null ? '#2e7d32' : '#787878'
  },
];

// ─── Export helpers ────────────────────────────────────────────────────────────
const EXPORT_HEADERS = [
  'Batch', 'Material', 'HU', 'น้ำหนัก (kg)', 'Remark',
  'วัตถุประสงค์ รอบ 1', 'Histamine รอบ 1',
  'วัตถุประสงค์ รอบ 2', 'Histamine รอบ 2',
  'วัตถุประสงค์ รอบ 3', 'Histamine รอบ 3',
  'เริ่มละลาย', 'ละลายเสร็จ', 'ส่งออกห้องเย็น',
  'ไลน์รับเข้า รอบ 1', 'ไลน์ส่งคืน รอบ 1', 'ห้องเย็นรับเข้า รอบ 1',
  'ส่งออกห้องเย็น รอบ 2', 'ไลน์รับเข้า รอบ 2', 'ไลน์ส่งคืน รอบ 2', 'ห้องเย็นรับเข้า รอบ 2',
  'ส่งออกห้องเย็น รอบ 3', 'ไลน์รับเข้า รอบ 3', 'ไลน์ส่งคืน รอบ 3', 'ห้องเย็นรับเข้า รอบ 3',
];

const rowToExportData = (row) => [
  row.batch, row.mat, row.hu, row.weight, row.remark,
  row.storage_purpose, row.histamine,
  row.storage_purpose_2, row.histamine_2,
  row.storage_purpose_3, row.histamine_3,
  row.start_defrost_date, row.end_defrost_date, row.withdraw_date,
  row.input_pd_date, row.output_pd_date, row.input_cd_date,
  row.withdraw_date_two, row.input_pd_date_two, row.output_pd_date_two, row.input_cd_date_two,
  row.withdraw_date_three, row.input_pd_date_three, row.output_pd_date_three, row.input_cd_date_three,
];

const exportToExcel = (rows) => {
  const wsData = [EXPORT_HEADERS, ...rows.map(rowToExportData)];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ── style header row ─────────────────────────────────────────────────────
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: "1565C0" }, patternType: "solid" } };
  }

  // ── column widths ─────────────────────────────────────────────────────────
  ws['!cols'] = EXPORT_HEADERS.map(() => ({ wch: 22 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ห้องเย็นใหญ่');

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  XLSX.writeFile(wb, `cold_storage_${dateStr}.xlsx`);
};

const exportToPDF = (rows) => {
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  const tableRows = rows.map(row => `
    <tr>
      ${rowToExportData(row).map((v, i) => `<td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;white-space:nowrap;${i === 10 && v != null ? `color:${v > 100 ? '#494848' : v > 50 ? '#f57c00' : '#2e7d32'};font-weight:600` : ''}">${v ?? '-'}</td>`).join('')}
    </tr>`).join('');

  const html = `
    <html><head><meta charset="utf-8">
    <style>
      body { font-family: 'Sarabun', Arial, sans-serif; padding: 16px; }
      h2 { color: #1565C0; margin-bottom: 4px; font-size: 16px; }
      .meta { font-size: 11px; color: #666; margin-bottom: 12px; }
      table { border-collapse: collapse; width: 100%; }
      thead tr { background: #1565C0; color: #fff; }
      thead th { padding: 6px 8px; font-size: 11px; border: 1px solid #1976D2; white-space: nowrap; }
      tbody tr:nth-child(even) { background: #f0f7ff; }
      @media print { @page { size: A3 landscape; margin: 10mm; } }
    </style></head>
    <body>
      <h2>🏭 รายงานข้อมูลห้องเย็นใหญ่ (CS)</h2>
      <div class="meta">พิมพ์เมื่อ: ${now} | จำนวน: ${rows.length} รายการ</div>
      <table>
        <thead><tr>${EXPORT_HEADERS.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
};

// ─── Main TableMainPrep ───────────────────────────────────────────────────────
const TableMainPrep = ({ data, handleOpenDeleteModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRows, setFilteredRows] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(300);
  const [exportAnchor, setExportAnchor] = useState(null);

  useEffect(() => {
    const rows = Array.isArray(data) ? data : [];
    setFilteredRows(
      searchTerm
        ? rows.filter(r => Object.values(r).some(v => v && v.toString().toLowerCase().includes(searchTerm.toLowerCase())))
        : rows
    );
    setPage(0);
  }, [searchTerm, data]);

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden', boxShadow: '0 0 3px rgba(0,0,0,0.2)' }}>

      {/* ── Top Bar ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 2, py: '8px' }}>
        <TextField
          variant="outlined" fullWidth placeholder="พิมพ์เพื่อค้นหา..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>, sx: { height: '36px' } }}
          sx={{ flex: 1, minWidth: '180px', "& .MuiOutlinedInput-root": { height: '36px', fontSize: '13px', borderRadius: '8px', color: '#787878' }, "& input": { padding: '6px' } }}
        />

        {/* ✅ Export Button */}
        <Button
          variant="outlined" size="small"
          startIcon={<FileDownloadIcon />}
          onClick={(e) => setExportAnchor(e.currentTarget)}
          sx={{ borderRadius: '8px', borderColor: '#1565C0', color: '#1565C0', whiteSpace: 'nowrap', '&:hover': { borderColor: '#0d47a1', bgcolor: '#e3f2fd' } }}
        >
          Export
        </Button>
        <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
          <MenuItem onClick={() => { exportToExcel(filteredRows); setExportAnchor(null); }}>
            📊 Export Excel (.xlsx)
          </MenuItem>
          <MenuItem onClick={() => { exportToPDF(filteredRows); setExportAnchor(null); }}>
            🖨️ Export PDF (พิมพ์)
          </MenuItem>
        </Menu>
      </Box>

      {/* ── Count ── */}
      <Box sx={{ px: 2, pb: '8px', borderBottom: '1px solid #e0e0e0' }}>
        <Typography sx={{ fontSize: '11px', color: '#494848' }}>แสดง {filteredRows.length} รายการ</Typography>
      </Box>

      {/* ── Table ── */}
      <div style={{ padding: '0 10px' }}>
        <TableContainer style={{ padding: '0 5px' }} sx={{ height: 'calc(70vh)', overflowY: 'auto', whiteSpace: 'nowrap', '&::-webkit-scrollbar': { width: '8px', height: '8px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#ccc', borderRadius: '4px' } }}>
          <Table stickyHeader style={{ tableLayout: 'fixed' }} sx={{ width: '100%' }}>
            <TableHead>
              <TableRow sx={{ height: '36px' }}>
                {tableColumns.map((col, i) => (
                  <TableCell key={col.id} align="center" style={{ backgroundColor: 'hsl(210,100%,60%)', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #f2f2f2', fontSize: '12px', color: '#787878', padding: '4px', width: col.width, borderTopLeftRadius: i === 0 ? '8px' : 0, borderBottomLeftRadius: i === 0 ? '8px' : 0 }}>
                    <Box style={{ fontSize: '12px', color: '#ffffff' }}>{col.name}</Box>
                  </TableCell>
                ))}
                <TableCell align="center" style={{ backgroundColor: 'hsl(210,100%,60%)', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', borderLeft: '1px solid #f2f2f2', borderRight: '1px solid #f2f2f2', fontSize: '12px', padding: '4px', width: '60px' }}>
                  <Box style={{ fontSize: '12px', color: '#ffffff' }}>Timeline</Box>
                </TableCell>
                <TableCell align="center" style={{ backgroundColor: 'hsl(210,100%,60%)', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', borderLeft: '1px solid #f2f2f2', borderRight: '1px solid #e0e0e0', fontSize: '12px', padding: '4px', width: '60px', borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}>
                  <Box style={{ fontSize: '12px', color: '#ffffff' }}>เปลี่ยน HU</Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.length > 0
                ? filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, i) => (
                  <Row key={i} row={row} tableColumns={tableColumns} index={i} handleOpenDeleteModal={handleOpenDeleteModal} />
                ))
                : <TableRow><TableCell colSpan={tableColumns.length + 2} align="center" sx={{ padding: '20px', fontSize: '14px', color: '#787878' }}>ไม่มีรายการวัตถุดิบในขณะนี้</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      <TablePagination
        sx={{ "& .MuiTablePagination-selectLabel,.MuiTablePagination-displayedRows,.MuiTablePagination-toolbar": { fontSize: '12px', color: '#787878', padding: 0 } }}
        rowsPerPageOptions={[300, 1000, 5000]} component="div" count={filteredRows.length}
        rowsPerPage={rowsPerPage} page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
      />

    </Paper>
  );
};

export default TableMainPrep;