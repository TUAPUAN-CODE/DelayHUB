import React, { useState, useEffect, useRef } from 'react';
import {
  Paper, Box, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination,
  Chip, IconButton, InputAdornment, Collapse, Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';
import jsPDF from 'jspdf';
import { thSarabunBase64 } from '../../../../fonts/thSarabunBase64';
import { thSarabunBoldBase64 } from '../../../../fonts/thSarabunBoldBase64';
import axios from 'axios';
axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getRemappedRow = (row) => {
  const gid = Number(row.rm_group_id);
  if (gid === 55) {
    return { _A: row.gm_date, _B: row.start_mixed_date, _C: row.rmit_date, _D: null, _E: null, _D3: null, _E3: null, _F: row.sc_pack_date };
  }
  if (gid === 85 || gid === 46 || gid === 49) {
    const colA = (row.out_cold_date && row.out_cold_date !== '-' && row.out_cold_date !== null)
      ? row.out_cold_date : (row.rmit_date_mix ?? null);
    return { _A: colA, _B: row.start_mixed_date, _C: row.rmit_date, _D: null, _E: null, _D3: null, _E3: null, _F: row.sc_pack_date };
  }
  return {
    _A: row.rmit_date, _B: row.come_cold_date, _C: row.out_cold_date,
    _D: row.come_cold_date_two, _E: row.out_cold_date_two,
    _D3: row.come_cold_date_three, _E3: row.out_cold_date_three, _F: row.sc_pack_date,
  };
};

const isSpecialGroup = (row) => {
  const gid = Number(row.rm_group_id);
  return gid === 55 || gid === 85 || gid === 46 || gid === 49;
};

const calculateMinutesDifference = (startDate, endDate) => {
  if (!startDate || startDate === '-' || !endDate || endDate === '-') return null;
  const start = new Date(startDate); const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const diff = (end - start) / (1000 * 60);
  return diff >= 0 ? diff : null;
};

const formatMinutesToTime = (minutes) => {
  if (minutes === null || minutes === undefined) return '-';
  const hours = Math.floor(minutes / 60); const mins = Math.floor(minutes % 60);
  let s = '';
  if (hours > 0) s += `${hours} h`;
  if (mins > 0) { if (s) s += ' '; s += `${mins} m`; }
  return s || '-';
};

const parseStandardDBSToMinutes = (val) => {
  if (val === null || val === undefined || val === '-' || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n * 60;
};

const calcDBS1Minutes = (mapped, row) => {
  const gid = Number(row.rm_group_id);
  if (gid === 46 || gid === 49 || gid === 85) return null;
  return calculateMinutesDifference(mapped._A, mapped._B);
};
const calcDBS2Minutes = (mapped, isSpecial) => {
  if (isSpecial) return null;
  let total = 0; let has = false;
  const c1 = calculateMinutesDifference(mapped._B, mapped._C); if (c1 !== null) { total += c1; has = true; }
  if (mapped._D && mapped._E) { const c2 = calculateMinutesDifference(mapped._D, mapped._E); if (c2 !== null) { total += c2; has = true; } }
  if (mapped._D3 && mapped._E3) { const c3 = calculateMinutesDifference(mapped._D3, mapped._E3); if (c3 !== null) { total += c3; has = true; } }
  return has ? total : null;
};
const calcDBS3Minutes = (mapped, isSpecial) => {
  if (isSpecial) return null;
  let lastOut = null;
  if (mapped._E3 && mapped._E3 !== '-') lastOut = mapped._E3;
  else if (mapped._E && mapped._E !== '-') lastOut = mapped._E;
  else if (mapped._C && mapped._C !== '-') lastOut = mapped._C;
  return calculateMinutesDifference(lastOut, mapped._F);
};
const calcDBS4Minutes = (mapped, isSpecial) => {
  if (isSpecial) {
    const p2 = calculateMinutesDifference(mapped._C, mapped._F);
    if (p2 !== null) return p2;
    return calculateMinutesDifference(mapped._A, mapped._F);
  }
  const d1 = calculateMinutesDifference(mapped._A, mapped._B);
  let lastOut = null;
  if (mapped._E3 && mapped._E3 !== '-') lastOut = mapped._E3;
  else if (mapped._E && mapped._E !== '-') lastOut = mapped._E;
  else if (mapped._C && mapped._C !== '-') lastOut = mapped._C;
  const d3 = calculateMinutesDifference(lastOut, mapped._F);
  if (d1 !== null && d3 !== null) return d1 + d3;
  return calculateMinutesDifference(mapped._A, mapped._F);
};

const calculateDBS1FromMapped = (mapped, row) => {
  const gid = Number(row.rm_group_id);
  if (gid === 46 || gid === 49 || gid === 85) return '-';
  return formatMinutesToTime(calculateMinutesDifference(mapped._A, mapped._B));
};
const calculateDBS2FromMapped = (mapped, isSpecial) => {
  if (isSpecial) return '-';
  const min = calcDBS2Minutes(mapped, false);
  return formatMinutesToTime(min);
};
const calculateDBS3FromMapped = (mapped, isSpecial) => {
  if (isSpecial) return '-';
  return formatMinutesToTime(calcDBS3Minutes(mapped, false));
};
const calculateDBS4FromMapped = (mapped, isSpecial) => {
  return formatMinutesToTime(calcDBS4Minutes(mapped, isSpecial));
};

const toDatetimeLocal = (val) => {
  if (!val || val === '-') return '';
  const s = String(val).replace('T', ' ').split('.')[0];
  const parts = s.split(' ');
  if (parts.length < 2) return parts[0];
  return `${parts[0]}T${parts[1].slice(0, 5)}`;
};
const fromDatetimeLocal = (val) => {
  if (!val) return null;
  return val.replace('T', ' ') + ':00';
};

const EDITABLE_DATE_FIELDS = [
  'rmit_date', 'come_cold_date', 'out_cold_date',
  'come_cold_date_two', 'out_cold_date_two',
  'come_cold_date_three', 'out_cold_date_three', 'sc_pack_date',
];

const formatDateTimeForPDF = (dateTimeStr) => {
  if (!dateTimeStr || dateTimeStr === '-') return '-';
  try {
    const s = String(dateTimeStr).replace('T', ' ').split('.')[0];
    const parts = s.split(' ');
    if (parts.length < 2) return s;
    const [year, month, day] = parts[0].split('-');
    const timePart = parts[1].slice(0, 5);
    const buddhistYear = parseInt(year, 10) + 543;
    return `${day}/${month}/${buddhistYear}\n${timePart}`;
  } catch { return dateTimeStr; }
};

// ─── Searchable Dropdown ───────────────────────────────────────────────────────
const SearchableDropdown = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const ref = useRef(null);
  const filtered = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: '180px' }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: value ? '2px solid #1552F0' : '1px solid #E3E8F2', borderRadius: '10px', cursor: 'pointer', backgroundColor: '#fff', height: '40px', fontSize: '13px', color: value ? '#1552F0' : '#999', transition: 'all 0.2s', boxShadow: isOpen ? '0 4px 12px rgba(33,150,243,0.15)' : 'none' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: value ? '500' : '400' }}>{value || placeholder}</span>
        <KeyboardArrowDownIcon style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', fontSize: '18px', color: value ? '#1552F0' : '#666' }} />
      </div>
      {isOpen && (
        <div style={{ position: 'absolute', top: '46px', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #E3E8F2', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1000, maxHeight: '280px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px' }}>
            <TextField fullWidth size="small" placeholder="ค้นหา..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon style={{ fontSize: '16px', color: '#999' }} /></InputAdornment>, sx: { height: '34px', fontSize: '12px', borderRadius: '8px' } }}
            />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '230px' }}>
            {value && (
              <div onClick={() => { onChange(''); setIsOpen(false); setSearchTerm(''); }}
                style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '12px', color: '#ff4444', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '6px' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff3f3'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              ><ClearIcon style={{ fontSize: '14px' }} /> ล้างตัวกรอง</div>
            )}
            {filtered.length > 0 ? filtered.map((opt, i) => (
              <div key={i} onClick={() => { onChange(opt); setIsOpen(false); setSearchTerm(''); }}
                style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '12px', color: '#333', backgroundColor: value === opt ? '#EAF0FF' : 'transparent', borderBottom: i < filtered.length - 1 ? '1px solid #f0f0f0' : 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => { if (value !== opt) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                onMouseLeave={e => { if (value !== opt) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >{opt}</div>
            )) : <div style={{ padding: '16px 12px', fontSize: '12px', color: '#999', textAlign: 'center' }}>ไม่พบข้อมูล</div>}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Badge ─────────────────────────────────────────────────────────────────────
const ShiftBadge = ({ shift }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', backgroundColor: shift === 'DS' ? '#FFF8E1' : '#E8EAF6', color: shift === 'DS' ? '#F57F17' : '#3949AB', border: `1px solid ${shift === 'DS' ? '#FFD54F' : '#9FA8DA'}`, letterSpacing: '0.5px' }}>
    {shift === 'DS' ? '☀️ DS' : '🌙 NS'}
  </span>
);

// ─── Detail Row (expanded sub-table) ──────────────────────────────────────────
const DetailRow = ({ mappingIds, open }) => {
  const cols = [
    { key: 'mapping_id', label: 'Mapping ID' }, { key: 'production', label: 'แผนการผลิต' },
    { key: 'mat_name', label: 'วัตถุดิบ' }, { key: 'batch_after', label: 'Batch' },
    { key: 'group_no', label: 'ชุดที่' }, { key: 'weight_RM', label: 'น้ำหนัก (kg)' },
    { key: 'sc_pack_date', label: 'บรรจุเสร็จ' }, { key: 'color', label: 'สี' },
    { key: 'odor', label: 'กลิ่น' }, { key: 'texture', label: 'เนื้อสัมผัส' },
  ];
  const formatVal = (v) => {
    if (v === null || v === undefined || v === '') return '-';
    if (typeof v === 'boolean') return v ? 'ผ่าน' : 'ไม่ผ่าน';
    if (typeof v === 'string' && v.includes('T')) {
      try { const d = new Date(v); if (!isNaN(d)) return d.toLocaleString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { }
    }
    return String(v);
  };
  return (
    <TableRow>
      <TableCell colSpan={11} style={{ padding: 0, borderBottom: 'none' }}>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ margin: '0 16px 12px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #EAF0FF', boxShadow: '0 2px 8px rgba(33,150,243,0.08)' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {cols.map(c => (
                    <TableCell key={c.key} align="center" sx={{ backgroundColor: '#EAF0FF', color: '#0F3FC4', fontWeight: '600', fontSize: '11px', padding: '8px 10px', whiteSpace: 'nowrap', borderBottom: '1px solid #BBDEFB' }}>{c.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {mappingIds && mappingIds.length > 0 ? mappingIds.map((row, i) => (
                  <TableRow key={i} sx={{ backgroundColor: i % 2 === 0 ? '#fff' : '#F5F8FF' }}>
                    {cols.map(c => (
                      <TableCell key={c.key} align="center" sx={{ fontSize: '12px', color: '#424242', padding: '7px 10px', whiteSpace: 'nowrap', borderBottom: '1px solid #F5F8FF' }}>
                        {formatVal(row[c.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={cols.length} align="center" sx={{ padding: '20px', color: '#90A4AE', fontSize: '12px' }}>ไม่มีข้อมูลรายละเอียด</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </Collapse>
      </TableCell>
    </TableRow>
  );
};

// ─── Main Row ──────────────────────────────────────────────────────────────────
const MainRow = ({ record, index, onExportPDF }) => {
  const [open, setOpen] = useState(false);
  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
    catch { return d; }
  };
  const bgColor = index % 2 === 0 ? '#ffffff' : '#F5F8FF';

  return (
    <>
      <TableRow sx={{ cursor: 'pointer', '&:hover td': { backgroundColor: '#EFF7FF !important' }, transition: 'all 0.15s' }}>
        <TableCell align="center" sx={{ padding: '8px', backgroundColor: bgColor, borderLeft: '1px solid #EAF0FF', borderTop: '1px solid #EAF0FF', borderBottom: '1px solid #EAF0FF', width: '48px' }}>
          <IconButton size="small" onClick={() => setOpen(!open)} sx={{ color: '#1552F0', backgroundColor: open ? '#EAF0FF' : 'transparent', '&:hover': { backgroundColor: '#BBDEFB' }, width: '28px', height: '28px' }}>
            {open ? <KeyboardArrowUpIcon sx={{ fontSize: '18px' }} /> : <KeyboardArrowDownIcon sx={{ fontSize: '18px' }} />}
          </IconButton>
        </TableCell>
        <TableCell align="center" sx={{ padding: '8px 12px', backgroundColor: bgColor, borderTop: '1px solid #EAF0FF', borderBottom: '1px solid #EAF0FF', fontSize: '13px', color: '#78909C', width: '50px' }}>{index + 1}</TableCell>
        <TableCell align="center" sx={{ padding: '8px 12px', backgroundColor: bgColor, borderTop: '1px solid #EAF0FF', borderBottom: '1px solid #EAF0FF', fontSize: '13px', whiteSpace: 'nowrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <CalendarTodayIcon sx={{ fontSize: '14px', color: '#90A4AE' }} />
            <span style={{ color: '#37474F', fontWeight: '500' }}>{formatDate(record.date)}</span>
          </Box>
        </TableCell>
        <TableCell align="center" sx={{ padding: '8px 12px', backgroundColor: bgColor, borderTop: '1px solid #EAF0FF', borderBottom: '1px solid #EAF0FF' }}><ShiftBadge shift={record.shift} /></TableCell>
        <TableCell align="center" sx={{ padding: '8px 12px', backgroundColor: bgColor, borderTop: '1px solid #EAF0FF', borderBottom: '1px solid #EAF0FF', fontSize: '13px', color: '#37474F', fontWeight: '500' }}>{record.line || '-'}</TableCell>
        <TableCell align="center" sx={{ padding: '8px 12px', backgroundColor: bgColor, borderTop: '1px solid #EAF0FF', borderBottom: '1px solid #EAF0FF', fontSize: '13px', color: '#546E7A' }}>{record.plant || '-'}</TableCell>
        <TableCell align="center" sx={{ padding: '8px 12px', backgroundColor: bgColor, borderTop: '1px solid #EAF0FF', borderBottom: '1px solid #EAF0FF', fontSize: '12px' }}>
          {record.recorded_by ? <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><PersonIcon sx={{ fontSize: '13px', color: '#42A5F5' }} /><span style={{ color: '#37474F' }}>{record.recorded_by}</span></Box> : '-'}
        </TableCell>
        <TableCell align="center" sx={{ padding: '8px 12px', backgroundColor: bgColor, borderTop: '1px solid #EAF0FF', borderBottom: '1px solid #EAF0FF', fontSize: '12px', color: '#546E7A' }}>{record.reviewed_by || '-'}</TableCell>
        <TableCell align="center" sx={{ padding: '8px 12px', backgroundColor: bgColor, borderTop: '1px solid #EAF0FF', borderBottom: '1px solid #EAF0FF', fontSize: '12px', color: '#546E7A' }}>{record.qc_manager || '-'}</TableCell>
        <TableCell align="center" sx={{ padding: '8px 12px', backgroundColor: bgColor, borderTop: '1px solid #EAF0FF', borderBottom: '1px solid #EAF0FF' }}>
          <Chip label={`${record.mapping_ids?.length || 0} รายการ`} size="small" sx={{ backgroundColor: '#EAF0FF', color: '#0F3FC4', fontWeight: '600', fontSize: '11px', height: '22px' }} />
        </TableCell>
        {/* ── Actions: Export PDF ── */}
        <TableCell align="center" sx={{ padding: '8px 12px', backgroundColor: bgColor, borderTop: '1px solid #EAF0FF', borderBottom: '1px solid #EAF0FF', borderRight: '1px solid #EAF0FF' }}>
          <Box sx={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
            <Tooltip title="Export PDF">
              <IconButton size="small" onClick={() => onExportPDF(record)}
                sx={{ color: '#7B1FA2', backgroundColor: '#F3E5F5', '&:hover': { backgroundColor: '#CE93D8', transform: 'translateY(-1px)' }, width: '30px', height: '30px', transition: 'all 0.2s', borderRadius: '8px' }}>
                <PictureAsPdfIcon sx={{ fontSize: '15px' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </TableCell>
      </TableRow>
      <DetailRow mappingIds={record.mapping_ids} open={open} />
      <TableRow><TableCell sx={{ height: '4px', padding: 0, border: 'none' }} /></TableRow>
    </>
  );
};

// ─── PDF Preview Modal ─────────────────────────────────────────────────────────
const PDFPreviewModal = ({ record, onClose, API_URL }) => {
  const displayColumns = [
    'production', 'mat_name', 'batch_after', 'group_no', 'weight_RM', 'detail',
    'color', 'odor', 'texture',
    'rmit_date', 'come_cold_date', 'out_cold_date',
    'come_cold_date_two', 'out_cold_date_two',
    'come_cold_date_three', 'out_cold_date_three',
    'sc_pack_date', 'dbs1', 'dbs2', 'dbs3', 'dbs4',
  ];
  const headerNames = {
    production: 'แผนการผลิต', mat_name: 'วัตถุดิบ', batch_after: 'Batch',
    group_no: 'ชุดที่', weight_RM: 'น้ำหนัก (kg)', detail: 'Hist./Viscosity/Temp',
    color: 'สี', odor: 'กลิ่น', texture: 'เนื้อสัมผัส',
    rmit_date: 'เตรียมเสร็จ (A)', come_cold_date: 'เข้าห้องเย็น1 (B)',
    out_cold_date: 'ออกห้องเย็น1 (C)', come_cold_date_two: 'เข้าห้องเย็น2 (D)',
    out_cold_date_two: 'ออกห้องเย็น2 (E)', come_cold_date_three: 'เข้าห้องเย็น3',
    out_cold_date_three: 'ออกห้องเย็น3', sc_pack_date: 'บรรจุเสร็จ (F)',
    dbs1: 'DBS 1', dbs2: 'DBS 2', dbs3: 'DBS 3', dbs4: 'DBS 4',
  };

  const [previewData, setPreviewData] = useState([]);
  const [editedCells, setEditedCells] = useState({});
  const [signatureData, setSignatureData] = useState({ recordedBy: record.recorded_by || '', reviewedBy: record.reviewed_by || '', qcManager: record.qc_manager || '' });
  const [exportDate, setExportDate] = useState(record.date || '');
  const [exportShift, setExportShift] = useState(record.shift || '');
  const [exportLine, setExportLine] = useState(record.line || '');
  const [exportPlant, setExportPlant] = useState(record.plant || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveEditsError, setSaveEditsError] = useState('');
  const [saveEditsSuccess, setSaveEditsSuccess] = useState('');

  useEffect(() => {
    setPreviewData((record.mapping_ids || []).map(r => ({ ...r })));
  }, [record]);

  const editedCount = Object.keys(editedCells).length;

  // ── Save edited datetime rows ──
  const saveEditedRows = async () => {
    const changedRows = previewData.map((row, rowIdx) => {
      const changedFields = {};
      EDITABLE_DATE_FIELDS.forEach(field => {
        const key = `${rowIdx}_${field}`;
        if (editedCells[key]) changedFields[field] = row[field] ?? null;
      });
      if (Object.keys(changedFields).length === 0) return null;
      return { mapping_id: row.mapping_id, ...changedFields };
    }).filter(Boolean);

    if (changedRows.length === 0) { setSaveEditsError('ไม่มีข้อมูลที่แก้ไข'); return; }
    setIsSavingEdits(true); setSaveEditsError(''); setSaveEditsSuccess('');
    try {
      const response = await fetch(`${API_URL}/api/pack/data/time`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ rows: changedRows }),
      });
      if (!response.ok) { const errText = await response.text(); throw new Error(`บันทึกไม่สำเร็จ: ${response.status} - ${errText}`); }
      await response.json();
      setSaveEditsSuccess(`บันทึกสำเร็จ ${changedRows.length} แถว`);
      setEditedCells({});
    } catch (err) { setSaveEditsError(err.message || 'เกิดข้อผิดพลาด'); }
    finally { setIsSavingEdits(false); }
  };

  // ── Generate PDF blob ──
  const generatePDFBlob = async (dataRows, sigData) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 5;

    doc.addFileToVFS('Sarabun-Regular.ttf', thSarabunBase64);
    doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
    doc.addFileToVFS('Sarabun-Bold.ttf', thSarabunBoldBase64);
    doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
    doc.setFont('Sarabun', 'normal');

    const drawRect = (x, y, w, h) => { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.1); doc.rect(x, y, w, h); };
    const fillRect = (x, y, w, h, rgb) => { doc.setFillColor(...rgb); doc.rect(x, y, w, h, 'F'); };
    const drawText = (text, x, y, opts = {}) => {
      const { fontSize = 8, align = 'center', bold = false, color = [0, 0, 0] } = opts;
      doc.setFont('Sarabun', bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize); doc.setTextColor(...color);
      doc.text(String(text ?? '').normalize('NFC'), x, y, { align });
    };
    const drawCell = (text, x, y, w, h, opts = {}) => {
      const { fill, fontSize = 8, bold = false, align = 'center' } = opts;
      if (fill) fillRect(x, y, w, h, fill);
      drawRect(x, y, w, h);
      const lines = String(text ?? '').split('\n');
      const lineH = fontSize * 0.5;
      const totalH = lines.length * lineH;
      const startY = y + (h - totalH) / 2 + lineH * 0.8;
      lines.forEach((line, i) => {
        const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 1.5 : x + 1.5;
        drawText(line, tx, startY + i * lineH, { fontSize, bold, align });
      });
    };

    const tX = margin; const tY = 29; const tW = pageW - margin * 2;
    const colCode = 14; const colRM = 45; const colBatch = 18; const batchCols = 10;
    const batchCellW = colBatch / batchCols; const colWeight = 10; const colGrpNo = 9;
    const colDate = 15; const colHist = 15; const sensoryCellW = 7; const colSensory = sensoryCellW * 3;
    const colPrepA = 13; const colCold1 = 13; const colColdOut1 = 13;
    const colCold2 = 13; const colColdOut2 = 13; const colPacked = 13;
    const colDBS1 = 10; const colDBS2 = 10; const colDBS3 = 10; const colDBS4 = 10;
    const colRemark = tW - colCode - colRM - colBatch - colWeight - colGrpNo
      - colDate - colHist - colSensory - colPrepA - colCold1 - colColdOut1
      - colCold2 - colColdOut2 - colPacked - colDBS1 - colDBS2 - colDBS3 - colDBS4;
    const h1 = 7; const h2 = 14; const headerH = h1 + h2; const hFill = [210, 228, 255];
    const minRows = 17;
    const bottomReserved = 80;
    const availableH = pageH - (tY + headerH) - bottomReserved;
    const rowH = Math.floor((availableH / minRows) * 10) / 10;

    const drawPageHeader = (pageNumber, totalPages) => {
      drawText('บริษัท ไอ-เทล คอร์ปอเรชั่น จำกัด (มหาชน)', pageW / 2, 12, { fontSize: 16, bold: true, align: 'center' });
      drawText('รายงานควบคุมเวลากระบวนการผลิต โรงผลิตอาหารสัตว์เลี้ยง (Delay Time for Production Control Report)', pageW / 2, 19, { fontSize: 10, align: 'center' });
      drawText('F3PFPF67-0-25/08/25', pageW - margin, 12, { fontSize: 8, align: 'right' });
      const infoY = 24;
      const infoItems = [
        { label: 'Date:', value: exportDate || '', dotWidth: 30 },
        { label: 'Shift:', value: exportShift || '', dotWidth: 15 },
        { label: 'Line:', value: exportLine || '', dotWidth: 20 },
        { label: 'Plant:', value: exportPlant || '', dotWidth: 20 },
      ];
      let infoX = margin;
      infoItems.forEach(({ label, value, dotWidth }) => {
        drawText(label, infoX, infoY, { fontSize: 9, align: 'left' });
        const labelWidth = doc.getTextWidth(label);
        const lineStartX = infoX + labelWidth + 1; const lineEndX = lineStartX + dotWidth;
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
        doc.line(lineStartX, infoY + 1, lineEndX, infoY + 1);
        if (value) drawText(value, lineStartX + dotWidth / 2, infoY - 0.5, { fontSize: 9, align: 'center', color: [0, 0, 0] });
        infoX = lineEndX + 4;
      });
      drawText(`Page: ${pageNumber} / ${totalPages}`, pageW - margin, infoY, { fontSize: 9, align: 'right' });
    };

    const drawTableHeader = () => {
      let cx = tX; const cy = tY;
      drawCell('โค้ด\n(Product\nCode)', cx, cy, colCode, headerH, { fill: hFill, bold: true, fontSize: 5 }); cx += colCode;
      drawCell('วัตถุดิบ\n(Raw Mat.)', cx, cy, colRM, headerH, { fill: hFill, bold: true, fontSize: 5 }); cx += colRM;
      fillRect(cx, cy, colBatch, h1, hFill); drawRect(cx, cy, colBatch, h1);
      drawText('Batch', cx + colBatch / 2, cy + h1 / 2 + 2, { fontSize: 5, bold: true });
      for (let i = 0; i < batchCols; i++) drawCell('', cx + i * batchCellW, cy + h1, batchCellW, h2, { fill: hFill, fontSize: 5 });
      cx += colBatch;
      drawCell('น้ำหนัก\n(kgs.)', cx, cy, colWeight, headerH, { fill: hFill, bold: true, fontSize: 5 }); cx += colWeight;
      drawCell('ชุดที่', cx, cy, colGrpNo, headerH, { fill: hFill, bold: true, fontSize: 5 }); cx += colGrpNo;
      drawCell('วันที่-\nเวลาเตรียม', cx, cy, colDate, headerH, { fill: hFill, bold: true, fontSize: 5 }); cx += colDate;
      drawCell('Hist./\nViscosity\n/Temp', cx, cy, colHist, headerH, { fill: hFill, bold: true, fontSize: 5 }); cx += colHist;
      fillRect(cx, cy, colSensory, h1, hFill); drawRect(cx, cy, colSensory, h1);
      drawText('Sensory', cx + colSensory / 2, cy + h1 / 2 + 2, { fontSize: 5, bold: true });
      [['สี', 'Color'], ['กลิ่น', 'Odor'], ['เนื้อสัมผัส', 'Texture']].forEach(([th, en], i) =>
        drawCell(`${th}\n${en}`, cx + i * sensoryCellW, cy + h1, sensoryCellW, h2, { fill: hFill, fontSize: 5 })
      ); cx += colSensory;
      const timeGroupW = colPrepA + colCold1 + colColdOut1 + colCold2 + colColdOut2 + colPacked;
      fillRect(cx, cy, timeGroupW, h1, hFill); drawRect(cx, cy, timeGroupW, h1);
      drawText('เวลา (Time)', cx + timeGroupW / 2, cy + h1 / 2 + 2, { fontSize: 5, bold: true });
      const timeCols = [
        { label: 'เตรียมเสร็จ\n(A)', w: colPrepA }, { label: 'เข้าห้องเย็น 1\n(B)', w: colCold1 },
        { label: 'ออกห้องเย็น 1\n(C)', w: colColdOut1 }, { label: 'เข้าห้องเย็น 2\n(D)', w: colCold2 },
        { label: 'ออกห้องเย็น 2\n(E)', w: colColdOut2 }, { label: 'บรรจุเสร็จ\n(F)', w: colPacked },
      ];
      let tcx = cx;
      timeCols.forEach(tc => { drawCell(tc.label, tcx, cy + h1, tc.w, h2, { fill: hFill, fontSize: 5 }); tcx += tc.w; });
      cx += timeGroupW;
      const delayGroupW = colDBS1 + colDBS2 + colDBS3 + colDBS4;
      fillRect(cx, cy, delayGroupW, h1, hFill); drawRect(cx, cy, delayGroupW, h1);
      drawText('Delay time (hr.)', cx + delayGroupW / 2, cy + h1 / 2 + 2, { fontSize: 5, bold: true });
      [{ label: '1\n(B-A)', w: colDBS1 }, { label: '2\n(C-B)', w: colDBS2 }, { label: '3\n(F-C)', w: colDBS3 }, { label: '4', w: colDBS4 }]
        .forEach(dc => { drawCell(dc.label, cx, cy + h1, dc.w, h2, { fill: hFill, fontSize: 5 }); cx += dc.w; });
      drawCell('หมายเหตุ\n(Remark)', cx, cy, colRemark, headerH, { fill: hFill, bold: true, fontSize: 5 });
    };

    const drawPageFooter = (sigData) => {
      const finalY = tY + headerH + minRows * rowH + 4;
      const legendY = finalY + 8; const noteRowH = 4; const hFillLegend = [210, 228, 255];
      const drawMatTable = (startX, startY, colMatW, colChW, rows) => {
        drawCell('วัตถุดิบ', startX, startY, colMatW, noteRowH * 2, { fill: hFillLegend, bold: true, fontSize: 5.5 });
        fillRect(startX + colMatW, startY, colChW * 4, noteRowH, hFillLegend); drawRect(startX + colMatW, startY, colChW * 4, noteRowH);
        drawText('ช่วงที่', startX + colMatW + (colChW * 4) / 2, startY + noteRowH / 2 + 1.2, { fontSize: 5.5, bold: true });
        [1, 2, 3, 4].forEach((n, i) => drawCell(String(n), startX + colMatW + i * colChW, startY + noteRowH, colChW, noteRowH, { fill: hFillLegend, bold: true, fontSize: 5.5 }));
        rows.forEach((r, i) => {
          const ry2 = startY + noteRowH * 2 + i * noteRowH;
          drawCell(r.mat, startX, ry2, colMatW, noteRowH, { fontSize: 5.5, align: 'left' });
          r.v.forEach((val, j) => drawCell(String(val), startX + colMatW + j * colChW, ry2, colChW, noteRowH, { fontSize: 5.5 }));
        });
      };
      const blk1X = margin; const colNote = 12.5; const colDesc = 32;
      drawCell('หมายเหตุ', blk1X, legendY, colNote, noteRowH, { fill: hFillLegend, bold: true, fontSize: 5.5 });
      drawCell('คำจำกัดความ', blk1X + colNote, legendY, colDesc, noteRowH, { fill: hFillLegend, bold: true, fontSize: 5.5 });
      [{ note: 'ช่วงที่ 1', desc: 'เตรียมเสร็จ - เข้าห้องเย็น' }, { note: 'ช่วงที่ 2', desc: 'เข้าห้องเย็น - ออกห้องเย็น' }, { note: 'ช่วงที่ 3', desc: 'ออกห้องเย็น - บรรจุเสร็จ' }, { note: 'ช่วงที่ 4', desc: 'เตรียมเสร็จ - บรรจุเสร็จ' }]
        .forEach((r, i) => { const ry2 = legendY + noteRowH + i * noteRowH; drawCell(r.note, blk1X, ry2, colNote, noteRowH, { fontSize: 5.5 }); drawCell(r.desc, blk1X + colNote, ry2, colDesc, noteRowH, { fontSize: 5.5, align: 'left' }); });
      const blk2X = blk1X + colNote + colDesc + 4;
      drawMatTable(blk2X, legendY, 28, 5, [
        { mat: 'เนื้อสัตว์ (วัว/ เป็ด/ แกะ)', v: [3, 9, 2, 5] }, { mat: 'เนื้อไก่ (ไก่/ ไก่งวง)', v: [2, 5, 2, 4] },
        { mat: 'ปลาแกะ (MK/ SE/ SD)', v: [3, 6, 2, 5] }, { mat: 'ปลาแกะ (TN/ SM)', v: [6, 6, 2, 8] },
        { mat: 'Shelf fish (กุ้ง/ ปลาหมึก/ หอย)', v: [2, 3, 2, 4] }, { mat: 'เลือดทูน่า/ เศษทูน่า', v: [2, 4, 2, 4] },
      ]);
      const blk3X = blk2X + 28 + 5 * 4 + 4;
      drawMatTable(blk3X, legendY, 38, 5, [
        { mat: 'ปลาสับสด/ เนื้อไก่สด', v: [1, 6, 1, 2] }, { mat: 'ผัก-ผลไม้สด/ ผัก+ผลไม้แช่/ ผัก+ผลไม้ต้มแช่', v: [2, 10, 2, 4] },
        { mat: 'ผักต้ม/ ลวก/ ฟักทองต้ม', v: [2, 6, 2, 4] }, { mat: 'ปลากระตัก/ ปลาข้าวสาร', v: [2, 6, 2, 4] },
        { mat: 'ข้าว/ ปลายข้าว', v: [2, 9, 2, 4] }, { mat: 'น้ำอบไก่/ น้ำอบ MDM', v: [1, '-', '-', '-'] },
      ]);
      const blk4X = blk3X + 38 + 5 * 4 + 4;
      drawMatTable(blk4X, legendY, 27, 5, [
        { mat: 'Chunk', v: [1, 12, 2, 3] }, { mat: 'Stuff Chunk (แท่ง)', v: [2, 48, 3, 5] },
        { mat: 'Stuff Chunk (เส้น)', v: [2, 9, 3, 5] }, { mat: 'CCM/ MDM อบ', v: [4, 2, 2, 6] },
        { mat: 'CCM/ MDM อบ (Cai 300)*', v: ['-', '-', '-', 3] }, { mat: 'สาวละสาย/ เกรวี่', v: ['-', 6, '-', 2] },
      ]);
      const legendBlockH = noteRowH * 2 + 6 * noteRowH;
      const footerY = legendY + legendBlockH + 5;
      drawText('เอกสารการควบคุม Delay time:', margin, footerY, { fontSize: 8, align: 'left' });
      drawText('W3QCPF18, SQCIS001/ ISPP018', margin, footerY + 5, { fontSize: 8, align: 'left' });
      const sigY = footerY + 5 + 7;
      [
        { label: 'Recorded by :', name: sigData.recordedBy || '', sub: '(Production Staff)', x: margin + 40, lineWidth: 40 },
        { label: 'Reviewed by :', name: sigData.reviewedBy || '', sub: '(Production Section Manager)', x: pageW / 2, lineWidth: 40 },
        { label: '', name: sigData.qcManager || '', sub: '(Quality Control Section Manager)', x: pageW - margin - 38, lineWidth: 40 },
      ].forEach(({ label, name, sub, x, lineWidth }) => {
        if (label) { const lw = doc.getTextWidth(label); drawText(label, x - lineWidth / 2 - lw - 2, sigY, { fontSize: 8, align: 'left' }); }
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
        doc.line(x - lineWidth / 2, sigY + 1, x + lineWidth / 2, sigY + 1);
        if (name) drawText(name, x, sigY - 0.5, { fontSize: 8, bold: true, align: 'center' });
        drawText(sub, x, sigY + 5, { fontSize: 8, align: 'center' });
      });
    };

    const toDisplay = (v, isSensory = false) => {
      if (v === null || v === undefined || v === '') return '-';
      if (typeof v === 'boolean') return isSensory ? (v ? 'ผ่าน' : 'ไม่ผ่าน') : (v ? '✓' : '✗');
      return String(v);
    };

    const drawCellWithOver = (text, rx, ry, w, rH, opts, isOver) => {
      const fill = isOver ? [255, 235, 235] : opts.fill;
      drawCell(toDisplay(text), rx, ry, w, rH, { ...opts, fill });
      if (isOver) {
        const cx2 = rx + w - 3.5; const cy2 = ry + 2.5;
        doc.setFillColor(211, 47, 47); doc.circle(cx2, cy2, 1.8, 'F');
        doc.setFontSize(5); doc.setFont('Sarabun', 'bold'); doc.setTextColor(255, 255, 255);
        doc.text('!', cx2, cy2 + 0.6, { align: 'center' }); doc.setTextColor(0, 0, 0);
      }
    };

    const totalPages = Math.ceil(dataRows.length / minRows);
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (pageNum > 1) doc.addPage();
      drawPageHeader(pageNum, totalPages);
      drawTableHeader();

      const startIdx = (pageNum - 1) * minRows;
      const pageRows = dataRows.slice(startIdx, Math.min(startIdx + minRows, dataRows.length));

      pageRows.forEach((row, i) => {
        const ry = tY + headerH + i * rowH;
        const rowFill = i % 2 === 0 ? [255, 255, 255] : [240, 248, 255];
        const m = getRemappedRow(row);
        const sp = isSpecialGroup(row);

        const s1 = parseStandardDBSToMinutes(row.DBS1 ?? row.dbs1);
        const s2 = parseStandardDBSToMinutes(row.DBS2 ?? row.dbs2);
        const s3 = parseStandardDBSToMinutes(row.DBS3 ?? row.dbs3);
        const s4 = parseStandardDBSToMinutes(row.DBS4 ?? row.dbs4);
        const c1 = calcDBS1Minutes(m, row); const c2 = calcDBS2Minutes(m, sp);
        const c3 = calcDBS3Minutes(m, sp); const c4 = calcDBS4Minutes(m, sp);
        const over1 = s1 !== null && c1 !== null && c1 > s1;
        const over2 = !sp && s2 !== null && c2 !== null && c2 > s2;
        const over3 = !sp && s3 !== null && c3 !== null && c3 > s3;
        const over4 = s4 !== null && c4 !== null && c4 > s4;

        let rx = tX;
        const cell = (text, w, opts = {}, isSensory = false) => {
          drawCell(toDisplay(text, isSensory), rx, ry, w, rowH, { fill: rowFill, fontSize: 8, ...opts }); rx += w;
        };
        const cellOver = (text, w, isOver, opts = {}) => {
          drawCellWithOver(text, rx, ry, w, rowH, { fill: rowFill, fontSize: 8, ...opts }, isOver); rx += w;
        };

        cell(row.production, colCode, { fontSize: 6.5, bold: true });
        cell(row.mat_name, colRM, { align: 'left', fontSize: 6 });
        const batchStr = String(row.batch_after ?? '').padEnd(batchCols, ' ');
        for (let b = 0; b < batchCols; b++) cell(batchStr[b] || '', batchCellW, { fontSize: 5 });
        cell(row.weight_RM, colWeight);
        cell(row.group_no, colGrpNo);
        cell(formatDateTimeForPDF(row.rmit_date), colDate, { fontSize: 5, bold: true });
        cell(row.detail, colHist, { fontSize: 7, bold: true });
        cell(row.color, sensoryCellW, { fontSize: 7 }, true);
        cell(row.odor, sensoryCellW, { fontSize: 7 }, true);
        cell(row.texture, sensoryCellW, { fontSize: 7 }, true);
        cell(formatDateTimeForPDF(m._A), colPrepA, { fontSize: 5, bold: true });
        cell(formatDateTimeForPDF(m._B), colCold1, { fontSize: 5, bold: true });
        cell(formatDateTimeForPDF(m._C), colColdOut1, { fontSize: 5, bold: true });
        cell(sp ? '-' : formatDateTimeForPDF(m._D), colCold2, { fontSize: 5, bold: true });
        cell(sp ? '-' : formatDateTimeForPDF(m._E), colColdOut2, { fontSize: 5, bold: true });
        cell(formatDateTimeForPDF(m._F), colPacked, { fontSize: 5, bold: true });
        cellOver(calculateDBS1FromMapped(m, row), colDBS1, over1, { fontSize: 5, bold: true });
        cellOver(calculateDBS2FromMapped(m, sp), colDBS2, over2, { fontSize: 5, bold: true });
        cellOver(calculateDBS3FromMapped(m, sp), colDBS3, over3, { fontSize: 5, bold: true });
        cellOver(calculateDBS4FromMapped(m, sp), colDBS4, over4, { fontSize: 5, bold: true });
        cell('', colRemark);
      });

      // empty rows
      const remaining = minRows - pageRows.length;
      for (let e = 0; e < remaining; e++) {
        const ry = tY + headerH + (pageRows.length + e) * rowH; let rx2 = tX;
        const emptyCell = (w) => { drawRect(rx2, ry, w, rowH); rx2 += w; };
        [colCode, colRM, ...Array(batchCols).fill(batchCellW), colWeight, colGrpNo, colDate, colHist,
          sensoryCellW, sensoryCellW, sensoryCellW, colPrepA, colCold1, colColdOut1,
          colCold2, colColdOut2, colPacked, colDBS1, colDBS2, colDBS3, colDBS4, colRemark].forEach(emptyCell);
      }
      drawPageFooter(sigData);
    }
    return doc.output('blob');
  };

  const handleExportAndSave = async () => {
    if (!exportDate) { setSaveError('กรุณาระบุวันที่'); return; }
    if (!exportShift) { setSaveError('กรุณาเลือก Shift'); return; }
    if (!exportLine) { setSaveError('กรุณาเลือก Line'); return; }
    if (!signatureData.recordedBy) { setSaveError('กรุณาระบุผู้บันทึก (Recorded by)'); return; }
    if (!signatureData.reviewedBy) { setSaveError('กรุณาระบุผู้ตรวจสอบ (Reviewed by)'); return; }

    if (editedCount > 0) {
      const ok = window.confirm(`มีการแก้ไขเวลา ${editedCount} เซลล์ที่ยังไม่ได้บันทึก\nต้องการบันทึกก่อน Export PDF หรือไม่?`);
      if (ok) await saveEditedRows();
    }

    setSaveError(''); setSaveSuccess(false); setIsSaving(true);
    try {
      const pdfBlob = await generatePDFBlob(previewData, signatureData);
      // download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `F3PFPF67_${exportDate}_${exportShift}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setSaveSuccess(true);
      await new Promise(r => setTimeout(r, 800));
      onClose();
    } catch (err) {
      console.error(err);
      setSaveError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '16px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* Modal Header */}
        <div style={{ background: 'linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%)', padding: '14px 20px', borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PictureAsPdfIcon style={{ color: '#fff', fontSize: '28px' }} />
            <div style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>ตรวจสอบก่อน Export PDF</div>
            {editedCount > 0 && (
              <div style={{ backgroundColor: '#FFC107', color: '#4E2A00', borderRadius: '20px', padding: '3px 12px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '14px' }}>✎</span> แก้ไขแล้ว {editedCount} เซลล์
              </div>
            )}
          </div>
          <IconButton onClick={onClose} sx={{ color: '#fff', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}><ClearIcon /></IconButton>
        </div>

        {/* Info bar */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #E1BEE7', backgroundColor: '#F3E5F5', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { label: 'Date', value: exportDate, type: 'date', onChange: setExportDate },
              { label: 'Shift', value: exportShift, type: 'select', options: [{ value: 'DS', label: 'DS (Day Shift)' }, { value: 'NS', label: 'NS (Night Shift)' }], onChange: setExportShift },
              { label: 'Line', value: exportLine, type: 'text', onChange: setExportLine },
              { label: 'Plant', value: exportPlant, type: 'text', onChange: setExportPlant },
            ].map(({ label, value, type, options, onChange }) => (
              <div key={label} style={{ flex: 1, minWidth: '160px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#7B1FA2', marginBottom: '6px', fontWeight: '600' }}>{label}</label>
                {type === 'select' ? (
                  <select value={value} onChange={e => onChange(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CE93D8', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', color: '#333', cursor: 'pointer' }}>
                    <option value="">-- เลือก Shift --</option>
                    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input type={type} value={value} onChange={e => onChange(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CE93D8', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', color: '#333' }}
                    onFocus={e => { e.target.style.border = '2px solid #7B1FA2'; }}
                    onBlur={e => { e.target.style.border = '1px solid #CE93D8'; }}
                  />
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#666' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FFC107' }} />
              <span>เซลล์ที่แก้ไขแล้ว (ยังไม่ได้บันทึก)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#666' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '2px', backgroundColor: '#FFCDD2', border: '1px solid #FFCDD2' }} />
              <span style={{ color: '#C62828', fontWeight: '600' }}>!</span>
              <span>เกินกำหนด DBS</span>
            </div>
            <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>💡 คลิกที่เซลล์วันที่/เวลาเพื่อแก้ไข</div>
          </div>
        </div>

        {/* Preview Table */}
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          <style>{`
            @keyframes editPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
            input[type="datetime-local"].h24::-webkit-datetime-edit-ampm-field { display: none !important; }
          `}</style>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1400px' }}>
            <thead>
              <tr>
                {displayColumns.map((col, i) => (
                  <th key={i} style={{ backgroundColor: '#7B1FA2', color: '#fff', padding: '10px 8px', textAlign: 'center', fontWeight: '600', whiteSpace: 'nowrap', border: '1px solid #6A1B9A', position: 'sticky', top: 0, zIndex: 10, fontSize: '12px' }}>
                    {headerNames[col] || col}
                    {EDITABLE_DATE_FIELDS.includes(col) && <div style={{ fontSize: '10px', fontWeight: '400', opacity: 0.8, marginTop: '2px' }}>✎ แก้ไขได้</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.length > 0 ? previewData.map((row, rowIdx) => {
                const m = getRemappedRow(row);
                const sp = isSpecialGroup(row);
                const s1 = parseStandardDBSToMinutes(row.DBS1 ?? row.dbs1);
                const s2 = parseStandardDBSToMinutes(row.DBS2 ?? row.dbs2);
                const s3 = parseStandardDBSToMinutes(row.DBS3 ?? row.dbs3);
                const s4 = parseStandardDBSToMinutes(row.DBS4 ?? row.dbs4);
                const c1 = calcDBS1Minutes(m, row); const c2 = calcDBS2Minutes(m, sp);
                const c3 = calcDBS3Minutes(m, sp); const c4 = calcDBS4Minutes(m, sp);
                const overFlags = {
                  dbs1: s1 !== null && c1 !== null && c1 > s1,
                  dbs2: !sp && s2 !== null && c2 !== null && c2 > s2,
                  dbs3: !sp && s3 !== null && c3 !== null && c3 > s3,
                  dbs4: s4 !== null && c4 !== null && c4 > s4,
                };
                const rowBg = rowIdx % 2 === 0 ? '#fff' : '#F3E5F5';

                return (
                  <tr key={rowIdx}>
                    {displayColumns.map((col, colIdx) => {
                      let cellValue;
                      switch (col) {
                        case 'dbs1': cellValue = calculateDBS1FromMapped(m, row); break;
                        case 'dbs2': cellValue = calculateDBS2FromMapped(m, sp); break;
                        case 'dbs3': cellValue = calculateDBS3FromMapped(m, sp); break;
                        case 'dbs4': cellValue = calculateDBS4FromMapped(m, sp); break;
                        case 'rmit_date': cellValue = m._A ?? ''; break;
                        case 'come_cold_date': cellValue = m._B ?? ''; break;
                        case 'out_cold_date': cellValue = m._C ?? ''; break;
                        case 'come_cold_date_two': cellValue = sp ? '-' : (m._D ?? ''); break;
                        case 'out_cold_date_two': cellValue = sp ? '-' : (m._E ?? ''); break;
                        case 'come_cold_date_three': cellValue = sp ? '-' : (m._D3 ?? ''); break;
                        case 'out_cold_date_three': cellValue = sp ? '-' : (m._E3 ?? ''); break;
                        case 'sc_pack_date': cellValue = m._F ?? ''; break;
                        default: cellValue = row[col] ?? '';
                      }
                      const isCalculated = ['dbs1', 'dbs2', 'dbs3', 'dbs4'].includes(col);
                      const isReadOnly = sp && ['come_cold_date_two', 'out_cold_date_two', 'come_cold_date_three', 'out_cold_date_three'].includes(col);
                      const isEditableDate = EDITABLE_DATE_FIELDS.includes(col) && !isReadOnly;
                      const isOver = overFlags[col] === true;
                      const cellKey = `${rowIdx}_${col}`;
                      const isEdited = editedCells[cellKey] === true;

                      const getRawFieldValue = () => {
                        if (EDITABLE_DATE_FIELDS.includes(col)) return row[col] ?? '';
                        return cellValue;
                      };

                      return (
                        <td key={colIdx} style={{ padding: '3px 5px', border: isOver ? '1px solid #FFCDD2' : isEdited ? '1px solid #FFC107' : '1px solid #E1BEE7', textAlign: 'center', whiteSpace: 'nowrap', backgroundColor: isOver ? '#FFF5F5' : isEdited ? '#FFFDE7' : rowBg, position: 'relative', transition: 'background-color 0.2s' }}>
                          {isEdited && (
                            <span style={{ position: 'absolute', top: '3px', right: '3px', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#FFC107', display: 'inline-block', boxShadow: '0 0 3px rgba(255,193,7,0.8)', zIndex: 1, animation: 'editPulse 1.5s infinite' }} title="มีการแก้ไข (ยังไม่บันทึก)" />
                          )}
                          {isCalculated ? (
                            <span style={{ color: isOver ? '#C62828' : '#555', fontSize: '12px', fontWeight: isOver ? '700' : 'normal', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              {isOver && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '15px', height: '15px', borderRadius: '50%', backgroundColor: '#D32F2F', color: '#fff', fontSize: '10px', fontWeight: '900', flexShrink: 0 }}>!</span>}
                              {String(cellValue || '-')}
                            </span>
                          ) : isEditableDate ? (
                            <div dir="ltr" style={{ display: 'inline-block', width: '100%' }}>
                              <input type="datetime-local" className="h24" lang="en-GB"
                                value={toDatetimeLocal(getRawFieldValue())}
                                onChange={(e) => {
                                  const newVal = fromDatetimeLocal(e.target.value);
                                  setPreviewData(prev => { const u = [...prev]; u[rowIdx] = { ...u[rowIdx], [col]: newVal }; return u; });
                                  setEditedCells(prev => ({ ...prev, [cellKey]: true }));
                                  setSaveEditsSuccess(''); setSaveEditsError('');
                                }}
                                style={{ border: 'none', borderRadius: '4px', padding: '3px 2px', fontSize: '11px', textAlign: 'center', width: '100%', minWidth: '145px', backgroundColor: 'transparent', outline: 'none', cursor: 'pointer', color: isOver ? '#C62828' : 'inherit', fontWeight: isEdited ? '600' : 'normal' }}
                                onFocus={e => { e.target.style.backgroundColor = '#fffef0'; e.target.style.boxShadow = '0 0 0 2px rgba(123,31,162,0.3)'; e.target.style.borderRadius = '4px'; }}
                                onBlur={e => { e.target.style.backgroundColor = 'transparent'; e.target.style.boxShadow = 'none'; }}
                              />
                            </div>
                          ) : isReadOnly ? (
                            <span style={{ color: '#bbb', fontSize: '12px' }}>-</span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#333' }}>{String(cellValue || '-')}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              }) : (
                <tr><td colSpan={displayColumns.length} style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>ไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Signature Section */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #E1BEE7', backgroundColor: '#FCE4EC', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { key: 'recordedBy', label: 'Recorded by', placeholder: 'ชื่อผู้บันทึก', sub: '(Production Staff)', required: true },
              { key: 'reviewedBy', label: 'Reviewed by', placeholder: 'ชื่อผู้ตรวจสอบ', sub: '(Production Section Manager)', required: true },
              { key: 'qcManager', label: 'QC Manager', placeholder: 'ชื่อผู้จัดการ QC', sub: '(Quality Control Section Manager)', required: false },
            ].map(({ key, label, placeholder, sub, required }) => (
              <div key={key} style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#880E4F', marginBottom: '6px', fontWeight: '600' }}>
                  {label} {required && <span style={{ color: '#7B1FA2' }}>*</span>}
                </label>
                <input type="text" value={signatureData[key]}
                  onChange={e => setSignatureData(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #F48FB1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', color: '#333' }}
                  onFocus={e => { e.target.style.border = '2px solid #7B1FA2'; }}
                  onBlur={e => { e.target.style.border = '1px solid #F48FB1'; }}
                />
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Buttons */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #E1BEE7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', backgroundColor: '#F8F0FF', borderRadius: '0 0 16px 16px', flexShrink: 0, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {saveEditsError && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b71c1c', fontSize: '13px', backgroundColor: '#FFEBEE', padding: '7px 12px', borderRadius: '8px', border: '1px solid #FFCDD2' }}><ClearIcon style={{ fontSize: '15px' }} />{saveEditsError}</div>}
            {saveEditsSuccess && <div style={{ color: '#1B5E20', fontSize: '13px', backgroundColor: '#E8F5E9', padding: '7px 12px', borderRadius: '8px', border: '1px solid #C8E6C9' }}>✓ {saveEditsSuccess}</div>}
            {saveError && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7B1FA2', fontSize: '13px', backgroundColor: '#F3E5F5', padding: '7px 12px', borderRadius: '8px', border: '1px solid #CE93D8' }}><ClearIcon style={{ fontSize: '15px' }} />{saveError}</div>}
            {saveSuccess && <div style={{ color: '#2E7D32', fontSize: '13px', backgroundColor: '#E8F5E9', padding: '7px 12px', borderRadius: '8px', border: '1px solid #C8E6C9' }}>✓ กำลังสร้าง PDF...</div>}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={onClose} disabled={isSaving || isSavingEdits}
              style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: (isSaving || isSavingEdits) ? 'not-allowed' : 'pointer', fontSize: '14px', color: '#666', opacity: (isSaving || isSavingEdits) ? 0.6 : 1 }}>
              ยกเลิก
            </button>
            {editedCount > 0 && (
              <button onClick={saveEditedRows} disabled={isSavingEdits || isSaving}
                style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #FFD54F 0%, #FF8F00 100%)', color: '#4E2A00', cursor: (isSavingEdits || isSaving) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '7px', minWidth: '200px', justifyContent: 'center', boxShadow: '0 2px 8px rgba(255,143,0,0.3)', opacity: (isSavingEdits || isSaving) ? 0.7 : 1 }}>
                {isSavingEdits ? <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(78,42,0,0.3)', borderTop: '2px solid #4E2A00', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />กำลังบันทึก...</> : <><span style={{ fontSize: '16px' }}>💾</span>บันทึกการแก้ไขเวลา ({editedCount} เซลล์)</>}
              </button>
            )}
            <button onClick={handleExportAndSave} disabled={isSaving || isSavingEdits}
              style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: (isSaving || isSavingEdits) ? 'linear-gradient(135deg, #CE93D8 0%, #9575CD 100%)' : 'linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%)', color: '#fff', cursor: (isSaving || isSavingEdits) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px', justifyContent: 'center' }}>
              {isSaving ? <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />กำลังสร้าง PDF...</> : <><PictureAsPdfIcon style={{ fontSize: '18px' }} />Export PDF</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const PDFRecordsHistory = () => {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterLine, setFilterLine] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [exportingRecord, setExportingRecord] = useState(null); // record ที่กำลัง export

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true); setError('');
      try {
        const res = await axios.get(`${API_URL}/api/pack/data/pdf/history`);
        const data = res.data?.data || [];
        setRecords(data); setFilteredRecords(data);
      } catch (err) {
        console.error('Fetch error:', err);
        setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        const mock = Array.from({ length: 6 }, (_, i) => ({
          paper_id: i + 1,
          date: `2026-03-${String(i + 1).padStart(2, '0')}`,
          shift: i % 2 === 0 ? 'DS' : 'NS',
          line: `Line ${(i % 3) + 1}`,
          plant: 'Plant A',
          recorded_by: `สมชาย ${i + 1}`,
          reviewed_by: `สมหญิง ${i + 1}`,
          qc_manager: i % 3 === 0 ? `QC Manager ${i}` : '',
          mapping_ids: Array.from({ length: Math.floor(Math.random() * 5) + 2 }, (_, j) => ({
            mapping_id: 1000 + i * 10 + j,
            production: `PROD-${100 + j}`,
            mat_name: ['เนื้อไก่', 'ปลาทูน่า', 'เนื้อวัว'][j % 3],
            batch_after: `BT${String(j + 1).padStart(8, '0')}`,
            group_no: j + 1,
            weight_RM: (Math.random() * 100 + 10).toFixed(2),
            sc_pack_date: `2026-03-${String(i + 1).padStart(2, '0')} ${i % 2 === 0 ? '10' : '20'}:${String(j * 5 % 60).padStart(2, '0')}:00`,
            rmit_date: `2026-03-${String(i + 1).padStart(2, '0')} ${i % 2 === 0 ? '06' : '18'}:00:00`,
            come_cold_date: null, out_cold_date: null,
            come_cold_date_two: null, out_cold_date_two: null,
            come_cold_date_three: null, out_cold_date_three: null,
            color: true, odor: true, texture: j % 2 === 0,
            detail: '-', rm_group_id: 1,
            DBS1: '3', DBS2: '9', DBS3: '2', DBS4: '5',
          }))
        }));
        setRecords(mock); setFilteredRecords(mock);
      } finally { setLoading(false); }
    };
    fetchRecords();
  }, []);

  useEffect(() => {
    let filtered = records;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(r => r.recorded_by?.toLowerCase().includes(s) || r.reviewed_by?.toLowerCase().includes(s) || r.line?.toLowerCase().includes(s) || r.date?.includes(s));
    }
    if (filterShift) filtered = filtered.filter(r => r.shift === filterShift);
    if (filterLine) filtered = filtered.filter(r => r.line === filterLine);
    if (filterDate) filtered = filtered.filter(r => r.date?.startsWith(filterDate));
    setFilteredRecords(filtered); setPage(0);
  }, [searchTerm, filterShift, filterLine, filterDate, records]);

  const uniqueLines = [...new Set(records.map(r => r.line).filter(Boolean))].sort();
  const totalItems = filteredRecords.reduce((s, r) => s + (r.mapping_ids?.length || 0), 0);

  const headers = [
    { label: '', width: '48px' }, { label: '#', width: '48px' },
    { label: 'วันที่', width: '130px' }, { label: 'Shift', width: '90px' },
    { label: 'Line', width: '100px' }, { label: 'Plant', width: '80px' },
    { label: 'Recorded by', width: '140px' }, { label: 'Reviewed by', width: '140px' },
    { label: 'QC Manager', width: '130px' }, { label: 'จำนวนรายการ', width: '110px' },
    { label: 'Export PDF', width: '100px' },
  ];

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden', boxShadow: '0 4px 20px rgba(33,150,243,0.1)', borderRadius: '16px', background: 'linear-gradient(135deg, #fff 0%, #F5F8FF 100%)' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <Box sx={{ background: 'linear-gradient(135deg, #1552F0 0%, #0F3FC4 100%)', padding: '18px 22px', borderRadius: '16px 16px 0 0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <PictureAsPdfIcon sx={{ color: '#fff', fontSize: '26px' }} />
          <div>
            <div style={{ color: '#fff', fontSize: '17px', fontWeight: '700', letterSpacing: '0.3px' }}>ประวัติการส่งออก PDF</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px' }}>รายงานควบคุมเวลากระบวนการผลิต</div>
          </div>
          <Box sx={{ ml: 'auto', display: 'flex', gap: '10px' }}>
            <Chip label={`${filteredRecords.length} เอกสาร`} sx={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: '600', fontSize: '12px' }} />
            <Chip label={`${totalItems} Mapping IDs`} sx={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: '600', fontSize: '12px' }} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <TextField variant="outlined" size="small" placeholder="ค้นหา..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#1552F0', fontSize: '18px' }} /></InputAdornment>, sx: { backgroundColor: '#fff', borderRadius: '10px', height: '40px', fontSize: '13px', '& fieldset': { borderColor: 'transparent' } } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' }, minWidth: '200px' }}
          />
          <FilterListIcon sx={{ color: '#fff', fontSize: '18px' }} />
          <SearchableDropdown options={['DS', 'NS']} value={filterShift} onChange={setFilterShift} placeholder="เลือก Shift" />
          <SearchableDropdown options={uniqueLines} value={filterLine} onChange={setFilterLine} placeholder="เลือก Line" />
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #E3E8F2', fontSize: '13px', backgroundColor: '#fff', color: filterDate ? '#1552F0' : '#999', outline: 'none', height: '40px', cursor: 'pointer' }}
          />
          {(filterShift || filterLine || filterDate || searchTerm) && (
            <IconButton onClick={() => { setFilterShift(''); setFilterLine(''); setFilterDate(''); setSearchTerm(''); }}
              sx={{ color: '#fff', backgroundColor: 'rgba(255,255,255,0.15)', '&:hover': { backgroundColor: 'rgba(255,255,255,0.25)' }, width: '40px', height: '40px', borderRadius: '10px' }}>
              <ClearIcon sx={{ fontSize: '18px' }} />
            </IconButton>
          )}
        </Box>
      </Box>

      {error && (
        <Box sx={{ padding: '10px 20px', backgroundColor: '#FFF3E0', borderBottom: '1px solid #FFE0B2', fontSize: '13px', color: '#E65100', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚠️ {error} (แสดงข้อมูลตัวอย่าง)
        </Box>
      )}

      <TableContainer sx={{ maxHeight: 'calc(72vh)', overflowY: 'auto', padding: '0 16px', '&::-webkit-scrollbar': { width: '6px', height: '6px' }, '&::-webkit-scrollbar-thumb': { background: '#1552F0', borderRadius: '8px' }, '&::-webkit-scrollbar-track': { background: '#f1f1f1', borderRadius: '8px' } }}>
        <Table stickyHeader size="small" sx={{ minWidth: '900px' }}>
          <TableHead>
            <TableRow>
              {headers.map((h, i) => (
                <TableCell key={i} align="center"
                  sx={{ backgroundColor: '#1552F0', color: '#fff', fontWeight: '600', fontSize: '13px', padding: '11px 12px', whiteSpace: 'nowrap', width: h.width, borderLeft: i === 0 ? '1px solid #1552F0' : '1px solid rgba(255,255,255,0.1)', borderRight: i === headers.length - 1 ? '1px solid #1552F0' : 'none' }}>
                  {h.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={headers.length} align="center" sx={{ padding: '60px', color: '#90A4AE' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ width: '36px', height: '36px', border: '3px solid #BBDEFB', borderTop: '3px solid #1552F0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: '14px' }}>กำลังโหลดข้อมูล...</span>
                  </Box>
                </TableCell>
              </TableRow>
            ) : filteredRecords.length > 0 ? (
              filteredRecords.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((record, i) => (
                <MainRow key={record.paper_id || i} record={record} index={page * rowsPerPage + i} onExportPDF={setExportingRecord} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={headers.length} align="center" sx={{ padding: '60px', color: '#90A4AE' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <PictureAsPdfIcon sx={{ fontSize: '48px', color: '#BBDEFB' }} />
                    <span style={{ fontSize: '15px', fontWeight: '500' }}>ไม่พบข้อมูลที่บันทึก</span>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        sx={{ borderTop: '1px solid #EAF0FF', backgroundColor: '#F5F8FF', '& .MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontSize: '12px', color: '#546E7A' }, '& .MuiTablePagination-select': { fontSize: '12px', color: '#1552F0', fontWeight: '600' }, '& .MuiTablePagination-actions button': { color: '#1552F0' } }}
        rowsPerPageOptions={[10, 25, 50, 100]} component="div" count={filteredRecords.length} rowsPerPage={rowsPerPage} page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        labelRowsPerPage="แถวต่อหน้า:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} จาก ${count}`}
      />

      {/* PDF Preview Modal */}
      {exportingRecord && (
        <PDFPreviewModal
          record={exportingRecord}
          onClose={() => setExportingRecord(null)}
          API_URL={API_URL}
        />
      )}
    </Paper>
  );
};

export default PDFRecordsHistory;