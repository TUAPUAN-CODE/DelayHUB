import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Table, TableContainer, TableHead, TableBody, TableRow, TableCell,
  Paper, Box, TextField, Divider, TablePagination, Typography,
  Button, Menu, MenuItem, CircularProgress
} from '@mui/material';
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";
import axios from 'axios';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const diffHours = (a, b) => {
  if (!a || !b) return 0;
  return (new Date(b) - new Date(a)) / (1000 * 60 * 60);
};

// ─── Card Definitions ─────────────────────────────────────────────────────────
const CARD_DEFS = [
  { key: 'c1', label: 'บันทึกเวลาเริ่มละลาย(1)\nแต่ไม่บันทึกเวลาละลายเสร็จ',       color: '#006064', bg: '#E0F7FA', check: r => r.start_defrost_date && !r.end_defrost_date },
  { key: 'c2', label: 'ละลายเสร็จ(1)\nยังไม่ส่งออก',            color: '#BF360C', bg: '#FBE9E7', check: r => r.end_defrost_date && !r.withdraw_date },
  { key: 'c3', label: 'บันทึกเวลาเริ่มละลาย(2)\nแต่ไม่บันทึกเวลาละลายเสร็จ',       color: '#006064', bg: '#E0F7FA', check: r => r.start_defrost_date_two && !r.end_defrost_date_two },
  { key: 'c4', label: 'ละลายเสร็จ(2)\nยังไม่ส่งออก',            color: '#BF360C', bg: '#FBE9E7', check: r => r.end_defrost_date_two && !r.withdraw_date_two },
  { key: 'c5', label: 'ละลายวัตถุดิบรอบที่1\nเกิน 4 ชม.',                   color: '#E65100', bg: '#FFF3E0', check: r => r.start_defrost_date && r.end_defrost_date && diffHours(r.start_defrost_date, r.end_defrost_date) > 4 },
  { key: 'c6', label: 'ละลายวัตถุดิบรอบที่2\nเกิน 4 ชม.',                   color: '#E65100', bg: '#FFF3E0', check: r => r.start_defrost_date_two && r.end_defrost_date_two && diffHours(r.start_defrost_date_two, r.end_defrost_date_two) > 4 },
  { key: 'c7', label: 'ละลายเสร็จ(1)→ส่งออก\nเกิน 4 ชม.',      color: '#7B1FA2', bg: '#F3E5F5', check: r => r.end_defrost_date && r.withdraw_date && diffHours(r.end_defrost_date, r.withdraw_date) > 4 },
  { key: 'c8', label: 'ละลายเสร็จ(2)→ส่งออก\nเกิน 4 ชม.',      color: '#7B1FA2', bg: '#F3E5F5', check: r => r.end_defrost_date_two && r.withdraw_date_two && diffHours(r.end_defrost_date_two, r.withdraw_date_two) > 4 },
  { key: 'c9', label: 'ห้องเย็น2ส่งออกวัตถุดิบ\nฝ่ายผลิตยังไม่ทำรายการรับเข้า',           color: '#0F3FC4', bg: '#EAF0FF', check: r => r.withdraw_date && !r.input_pd_date },
  { key: 'c10',label: 'ห้องเย็น2ส่งออกวัตถุดิบรอบที่(2)\nฝ่ายผลิตยังไม่ทำรายการรับเข้า',           color: '#0F3FC4', bg: '#EAF0FF', check: r => r.withdraw_date_two && !r.input_pd_date_two },
];

// วันที่หลักของแต่ละการ์ด ใช้เป็น x-axis ในกราฟ
const CARD_DATE_FIELD = {
  c1: 'start_defrost_date',     c2: 'end_defrost_date',
  c3: 'start_defrost_date_two', c4: 'end_defrost_date_two',
  c5: 'start_defrost_date',     c6: 'start_defrost_date_two',
  c7: 'end_defrost_date',       c8: 'end_defrost_date_two',
  c9: 'withdraw_date',          c10: 'withdraw_date_two',
};

// ─── Table Columns ─────────────────────────────────────────────────────────────
const TABLE_COLS = [
  { id: 'sap_re_id',            name: 'SAP RE ID',         width: '90px' },
  { id: 'hu',                   name: 'HU',                width: '110px' },
  { id: 'batch',                name: 'Batch',             width: '120px' },
  { id: 'mat',                  name: 'Material',          width: '100px' },
  { id: 'mat_name',             name: 'ชื่อ Material',     width: '180px' },
  { id: 'start_defrost_date',   name: 'เริ่มละลาย(1)',     width: '140px' },
  { id: 'end_defrost_date',     name: 'ละลายเสร็จ(1)',     width: '140px' },
  { id: 'withdraw_date',        name: 'ส่งออก(1)',          width: '140px' },
  { id: 'input_pd_date',        name: 'ส่งเข้าผลิต(1)',    width: '140px' },
  { id: 'start_defrost_date_two', name: 'เริ่มละลาย(2)',   width: '140px' },
  { id: 'end_defrost_date_two',   name: 'ละลายเสร็จ(2)',   width: '140px' },
  { id: 'withdraw_date_two',      name: 'ส่งออก(2)',        width: '140px' },
  { id: 'input_pd_date_two',      name: 'ส่งเข้าผลิต(2)',  width: '140px' },
];

// ─── MultiSelectDropdown ──────────────────────────────────────────────────────
const MultiSelectDropdown = ({ label, options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = options.filter(o => String(o ?? '').toLowerCase().includes(search.toLowerCase()));
  const toggle = (opt) => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(v => !v)} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid #bbb', background: selected.length > 0 ? '#EAF0FF' : '#fff', color: selected.length > 0 ? '#0F3FC4' : '#555', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
        <SearchIcon style={{ fontSize: '14px' }} />
        {label}{selected.length > 0 ? ` (${selected.length})` : ''}
        <span style={{ fontSize: '10px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1200, background: '#fff', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: '8px', minWidth: '220px', maxHeight: '300px', display: 'flex', flexDirection: 'column' }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={`ค้นหา ${label}...`} style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px', marginBottom: '6px', outline: 'none' }} />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 && <div style={{ fontSize: '12px', color: '#999', padding: '4px' }}>ไม่พบรายการ</div>}
            {filtered.map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px', cursor: 'pointer', borderRadius: '4px', fontSize: '13px', color: '#333' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F5F8FF'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} style={{ accentColor: '#0F3FC4' }} />
                {String(opt)}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px', paddingTop: '6px', borderTop: '1px solid #eee', marginTop: '4px' }}>
            <button onClick={() => onChange(options)} style={{ flex: 1, padding: '4px', borderRadius: '6px', border: '1px solid #0F3FC4', color: '#0F3FC4', background: '#fff', cursor: 'pointer', fontSize: '11px' }}>เลือกทั้งหมด</button>
            <button onClick={() => { onChange([]); setSearch(''); }} style={{ flex: 1, padding: '4px', borderRadius: '6px', border: '1px solid #ccc', color: '#666', background: '#fff', cursor: 'pointer', fontSize: '11px' }}>ล้าง</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Summary Card ──────────────────────────────────────────────────────────────
const SummaryCard = ({ def, count, active, onClick }) => (
  <Box onClick={onClick} sx={{
    cursor: 'pointer', minWidth: '115px', px: 1.5, py: 1, borderRadius: '10px',
    border: active ? `2px solid ${def.color}` : `1px solid ${def.color}44`,
    background: active ? def.bg : '#fff',
    boxShadow: active ? `0 2px 8px ${def.color}44` : '0 1px 4px rgba(0,0,0,0.08)',
    transition: 'all 0.18s', textAlign: 'center',
    '&:hover': { boxShadow: `0 3px 10px ${def.color}55`, borderColor: def.color },
  }}>
    <Typography sx={{ fontSize: '24px', fontWeight: 700, color: def.color, lineHeight: 1 }}>{count}</Typography>
    <Typography sx={{ fontSize: '10px', color: def.color, mt: 0.25, whiteSpace: 'pre-line', lineHeight: 1.35 }}>{def.label}</Typography>
    {active && <Typography sx={{ fontSize: '9px', color: def.color, mt: 0.25, fontWeight: 600 }}>▼ กำลังกรอง</Typography>}
  </Box>
);

// ─── Row Component ─────────────────────────────────────────────────────────────
const getDefrostColor = (row) => {
  if (row.start_defrost_date && !row.end_defrost_date) return '#E65100';
  if (row.end_defrost_date && !row.withdraw_date) return '#7B1FA2';
  if (row.start_defrost_date && row.end_defrost_date && diffHours(row.start_defrost_date, row.end_defrost_date) > 4) return '#C62828';
  return '#0F3FC4';
};

const RowItem = ({ row, index }) => {
  const borderColor = getDefrostColor(row);
  const backgroundColor = index % 2 === 0 ? '#ffffff' : '#EAF0FF';
  return (
    <>
      <TableRow><TableCell style={{ height: '4px', padding: 0, border: 'none' }} /></TableRow>
      <TableRow>
        {TABLE_COLS.map((col, i) => (
          <TableCell key={col.id} align="center" style={{
            width: col.width, fontSize: '12px', height: '36px', lineHeight: '1.4',
            padding: '0px 6px', color: '#555', whiteSpace: 'nowrap',
            borderTop: '1px solid #E3E8F2', borderBottom: '1px solid #E3E8F2',
            borderLeft: i === 0 ? `5px solid ${borderColor}` : '1px solid #f2f2f2',
            borderTopLeftRadius: i === 0 ? '8px' : 0,
            borderBottomLeftRadius: i === 0 ? '8px' : 0,
            borderRight: i === TABLE_COLS.length - 1 ? '1px solid #E3E8F2' : undefined,
            borderTopRightRadius: i === TABLE_COLS.length - 1 ? '8px' : 0,
            borderBottomRightRadius: i === TABLE_COLS.length - 1 ? '8px' : 0,
            backgroundColor,
          }}>
            {row[col.id] ?? '-'}
          </TableCell>
        ))}
      </TableRow>
      <TableRow><TableCell style={{ height: '4px', padding: 0, border: 'none' }} /></TableRow>
    </>
  );
};

// ─── Export Excel ──────────────────────────────────────────────────────────────
const exportToExcel = (rows) => {
  const headers = TABLE_COLS.map(c => c.name);
  const rowData = rows.map(r => TABLE_COLS.map(c => r[c.id] ?? ''));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rowData]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true } };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'CS2_Defrost');
  const now = new Date();
  XLSX.writeFile(wb, `cs2_defrost_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.xlsx`);
};

// ─── Main Component ───────────────────────────────────────────────────────────
const TableMainPrep = () => {
  const [allData, setAllData]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(300);
  const [exportAnchor, setExportAnchor] = useState(null);

  const [dateInput, setDateInput] = useState({
    start_defrost_from: '', start_defrost_to: '',
    withdraw_from: '',      withdraw_to: '',
  });

  const [activeCard, setActiveCard] = useState(null);
  const [selMat,   setSelMat]   = useState([]);
  const [selBatch, setSelBatch] = useState([]);
  const [selHu,    setSelHu]    = useState([]);
  const [sortField, setSortField] = useState('');
  const [sortDir,   setSortDir]   = useState('asc');

  const fetchData = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (params.start_defrost_from) qs.set('start_defrost_from', params.start_defrost_from);
      if (params.start_defrost_to)   qs.set('start_defrost_to',   params.start_defrost_to);
      if (params.withdraw_from)      qs.set('withdraw_from',      params.withdraw_from);
      if (params.withdraw_to)        qs.set('withdraw_to',        params.withdraw_to);
      const res = await axios.get(`${API_URL}/api/coldstorages/cs2?${qs.toString()}`);
      setAllData(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error('fetchData error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = () => {
    setActiveCard(null);
    setSelMat([]);
    setSelBatch([]);
    setSelHu([]);
    setPage(0);
    fetchData(dateInput);
  };

  const handleClearAll = () => {
    setDateInput({ start_defrost_from: '', start_defrost_to: '', withdraw_from: '', withdraw_to: '' });
    setActiveCard(null);
    setSelMat([]);
    setSelBatch([]);
    setSelHu([]);
    setSortField('');
    setSortDir('asc');
    setPage(0);
    fetchData();
  };

  const uniqueMat   = useMemo(() => [...new Set(allData.map(r => r.mat).filter(Boolean))].sort(),   [allData]);
  const uniqueBatch = useMemo(() => [...new Set(allData.map(r => r.batch).filter(Boolean))].sort(), [allData]);
  const uniqueHu    = useMemo(() => [...new Set(allData.map(r => r.hu).filter(Boolean))].sort(),    [allData]);

  // base = allData ผ่าน mat/batch/hu filter (ยังไม่ apply activeCard)
  const baseRows = useMemo(() => {
    let rows = allData;
    if (selMat.length > 0)   rows = rows.filter(r => selMat.includes(r.mat));
    if (selBatch.length > 0) rows = rows.filter(r => selBatch.includes(r.batch));
    if (selHu.length > 0)    rows = rows.filter(r => selHu.includes(r.hu));
    return rows;
  }, [allData, selMat, selBatch, selHu]);

  // card counts สัมพันธ์กับ filter ที่เลือก
  const cardCounts = useMemo(() => {
    const obj = {};
    CARD_DEFS.forEach(c => { obj[c.key] = baseRows.filter(c.check).length; });
    return obj;
  }, [baseRows]);

  // กราฟ: group baseRows (filtered) ตามวันที่หลักของการ์ด
  const chartData = useMemo(() => {
    if (!activeCard) return [];
    const def = CARD_DEFS.find(c => c.key === activeCard);
    if (!def) return [];
    const dateField = CARD_DATE_FIELD[activeCard] || 'start_defrost_date';
    const groups = {};
    baseRows.filter(def.check).forEach(r => {
      const raw = r[dateField];
      if (!raw) return;
      const day = raw.slice(0, 10);
      groups[day] = (groups[day] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [baseRows, activeCard]);

  const filteredRows = useMemo(() => {
    let rows = baseRows;
    if (activeCard) { const def = CARD_DEFS.find(c => c.key === activeCard); if (def) rows = rows.filter(def.check); }
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortField] || '', bv = b[sortField] || '';
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [baseRows, activeCard, sortField, sortDir]);

  const paged = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden', boxShadow: '0 0 3px rgba(0,0,0,0.2)' }}>

      {/* ── Summary Cards ── */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Typography sx={{ fontSize: '12px', color: '#555', fontWeight: 600, mb: 1 }}>
          สรุปสถานะการละลาย — คลิกการ์ดเพื่อกรองตาราง
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {CARD_DEFS.map(def => (
            <SummaryCard
              key={def.key} def={def} count={cardCounts[def.key]}
              active={activeCard === def.key}
              onClick={() => { setActiveCard(activeCard === def.key ? null : def.key); setPage(0); }}
            />
          ))}
          {activeCard && (
            <Box sx={{ alignSelf: 'center' }}>
              <button onClick={() => setActiveCard(null)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '11px', cursor: 'pointer', background: '#fff', color: '#555' }}>
                ล้างการกรอง
              </button>
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Chart (แสดงเมื่อกดการ์ด) ── */}
      {activeCard && chartData.length > 0 && (() => {
        const def = CARD_DEFS.find(c => c.key === activeCard);
        return (
          <Box sx={{ px: 2, py: 1.5, backgroundColor: def.bg, borderTop: `2px solid ${def.color}22` }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 700, color: def.color, mb: 1 }}>
              📊 กราฟ: {def.label.replace('\n', ' ')} — จำนวนรายการตามวันที่
            </Typography>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E8F2" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#555' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#555' }} width={32} />
                <Tooltip
                  formatter={(value) => [value, 'จำนวนรายการ']}
                  labelFormatter={(label) => `วันที่: ${label}`}
                  contentStyle={{ fontSize: '12px', borderRadius: '8px', border: `1px solid ${def.color}` }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, idx) => <Cell key={idx} fill={def.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        );
      })()}

      <Divider sx={{ borderColor: '#E3E8F2' }} />

      {/* ── Filter Bar ── */}
      <Box sx={{ px: 2, py: 1, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <MultiSelectDropdown label="Material" options={uniqueMat}   selected={selMat}   onChange={v => { setSelMat(v);   setPage(0); }} />
        <MultiSelectDropdown label="Batch"    options={uniqueBatch} selected={selBatch} onChange={v => { setSelBatch(v); setPage(0); }} />
        <MultiSelectDropdown label="HU"       options={uniqueHu}    selected={selHu}    onChange={v => { setSelHu(v);    setPage(0); }} />

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: '#ddd' }} />

        <Typography sx={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>เริ่มละลาย(1):</Typography>
        <TextField
          type="datetime-local" size="small" value={dateInput.start_defrost_from}
          onChange={e => setDateInput(v => ({ ...v, start_defrost_from: e.target.value }))}
          sx={{ width: '175px' }} InputProps={{ sx: { height: '36px', fontSize: '12px' } }} InputLabelProps={{ shrink: true }}
        />
        <Typography sx={{ fontSize: '12px', color: '#999' }}>—</Typography>
        <TextField
          type="datetime-local" size="small" value={dateInput.start_defrost_to}
          onChange={e => setDateInput(v => ({ ...v, start_defrost_to: e.target.value }))}
          sx={{ width: '175px' }} InputProps={{ sx: { height: '36px', fontSize: '12px' } }} InputLabelProps={{ shrink: true }}
        />

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: '#ddd' }} />

        <Typography sx={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>ส่งออก(1):</Typography>
        <TextField
          type="datetime-local" size="small" value={dateInput.withdraw_from}
          onChange={e => setDateInput(v => ({ ...v, withdraw_from: e.target.value }))}
          sx={{ width: '175px' }} InputProps={{ sx: { height: '36px', fontSize: '12px' } }} InputLabelProps={{ shrink: true }}
        />
        <Typography sx={{ fontSize: '12px', color: '#999' }}>—</Typography>
        <TextField
          type="datetime-local" size="small" value={dateInput.withdraw_to}
          onChange={e => setDateInput(v => ({ ...v, withdraw_to: e.target.value }))}
          sx={{ width: '175px' }} InputProps={{ sx: { height: '36px', fontSize: '12px' } }} InputLabelProps={{ shrink: true }}
        />

        <Button variant="contained" size="small" onClick={handleSearch} disabled={loading}
          sx={{ height: '36px', borderRadius: '8px', bgcolor: '#0F3FC4', '&:hover': { bgcolor: '#0d47a1' }, whiteSpace: 'nowrap' }}>
          ค้นหา
        </Button>
        <Button variant="outlined" size="small" onClick={handleClearAll}
          sx={{ height: '36px', borderRadius: '8px', borderColor: '#bbb', color: '#666', whiteSpace: 'nowrap' }}>
          ล้างทั้งหมด
        </Button>
      </Box>

      {/* ── Action Bar ── */}
      <Box sx={{ px: 2, pb: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, borderBottom: '1px solid #E3E8F2' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>🔃 เรียงตาม:</Typography>
          {[
            { field: 'start_defrost_date', label: 'เริ่มละลาย(1)' },
            { field: 'withdraw_date',      label: 'ส่งออก(1)' },
          ].map(({ field, label }) => (
            <button key={field}
              onClick={() => { sortField === field ? setSortDir(d => d === 'asc' ? 'desc' : 'asc') : (setSortField(field), setSortDir('asc')); }}
              style={{ padding: '3px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', border: sortField === field ? '2px solid #0F3FC4' : '1px solid #ccc', backgroundColor: sortField === field ? '#EAF0FF' : '#fff', color: sortField === field ? '#0F3FC4' : '#555', fontWeight: sortField === field ? 700 : 400, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {label}
              {sortField === field ? (sortDir === 'asc' ? <FaSortAmountUp style={{ fontSize: '10px' }} /> : <FaSortAmountDown style={{ fontSize: '10px' }} />) : null}
            </button>
          ))}
          {sortField && (
            <button onClick={() => { setSortField(''); setSortDir('asc'); }} style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '11px', cursor: 'pointer', background: '#fff', color: '#555' }}>
              ล้าง
            </button>
          )}
        </Box>

        <Typography sx={{ fontSize: '11px', color: '#777', ml: 'auto', mr: 1 }}>
          {loading ? 'กำลังโหลด...' : `แสดง ${filteredRows.length} / ${allData.length} รายการ`}
        </Typography>

        <Button variant="outlined" size="small" startIcon={<FileDownloadIcon />}
          onClick={e => setExportAnchor(e.currentTarget)}
          sx={{ borderRadius: '8px', borderColor: '#0F3FC4', color: '#0F3FC4', whiteSpace: 'nowrap', '&:hover': { borderColor: '#0d47a1', bgcolor: '#EAF0FF' } }}>
          Export
        </Button>
        <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
          <MenuItem onClick={() => { exportToExcel(filteredRows); setExportAnchor(null); }}>📊 Export Excel (.xlsx)</MenuItem>
        </Menu>
      </Box>

      {/* ── Table ── */}
      <div style={{ padding: '0 10px' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <TableContainer sx={{ height: 'calc(62vh)', overflowY: 'auto', whiteSpace: 'nowrap', '&::-webkit-scrollbar': { width: '8px', height: '8px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#ccc', borderRadius: '4px' } }}>
            <Table stickyHeader style={{ tableLayout: 'fixed' }} sx={{ width: '100%', minWidth: '1600px' }}>
              <TableHead>
                <TableRow sx={{ height: '36px' }}>
                  {TABLE_COLS.map((col, i) => (
                    <TableCell key={col.id} align="center" style={{
                      backgroundColor: '#1552F0',
                      borderTop: '1px solid #E3E8F2', borderBottom: '1px solid #E3E8F2',
                      borderLeft: i === 0 ? '1px solid #E3E8F2' : '1px solid #f2f2f2',
                      borderRight: i === TABLE_COLS.length - 1 ? '1px solid #E3E8F2' : undefined,
                      fontSize: '11px', padding: '4px', width: col.width,
                      borderTopLeftRadius: i === 0 ? '8px' : 0,
                      borderBottomLeftRadius: i === 0 ? '8px' : 0,
                      borderTopRightRadius: i === TABLE_COLS.length - 1 ? '8px' : 0,
                      borderBottomRightRadius: i === TABLE_COLS.length - 1 ? '8px' : 0,
                    }}>
                      <Box style={{ fontSize: '12px', color: '#fff' }}>{col.name}</Box>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.length > 0
                  ? paged.map((row, i) => <RowItem key={row.sap_re_id ?? i} row={row} index={i} />)
                  : (
                    <TableRow>
                      <TableCell colSpan={TABLE_COLS.length} align="center" sx={{ py: 4, fontSize: '14px', color: '#6B7489' }}>
                        ไม่มีรายการ
                      </TableCell>
                    </TableRow>
                  )
                }
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      <TablePagination
        sx={{ '& .MuiTablePagination-selectLabel,.MuiTablePagination-displayedRows,.MuiTablePagination-toolbar': { fontSize: '12px', color: '#6B7489', padding: 0 } }}
        rowsPerPageOptions={[300, 1000, 5000]} component="div"
        count={filteredRows.length} rowsPerPage={rowsPerPage} page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
      />
    </Paper>
  );
};

export default TableMainPrep;
