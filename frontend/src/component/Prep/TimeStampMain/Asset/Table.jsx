import React, { useMemo, useState } from 'react';
import {
  Box, Chip, Collapse, IconButton, InputAdornment, LinearProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, Button, Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCartOutlined';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import SwapIcon from '@mui/icons-material/SwapHorizOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { TIME_FIELDS, shortDateTime, sortByTime } from './timeFields';
import { searchText } from './unify';

const PRIMARY = '#1552F0';
const STAMPS = [
  { id: 'receive', label: 'รับ', title: 'บันทึกเวลารับวัตถุดิบ', color: '#2e7d32' },
  { id: 'boil', label: 'ต้ม/อบเสร็จ', title: 'บันทึกเวลาต้มอบเสร็จ', color: '#e65100' },
  { id: 'return', label: 'ส่งคืน', title: 'บันทึกเวลาส่งคืนวัตถุดิบ', color: '#6a1b9a' },
];

/** Every time of the SAP row, oldest first, as small coloured chips (what the three old stamp pages showed in their timeline) */
const TimeChips = React.memo(function TimeChips({ sap }) {
  const events = useMemo(() => TIME_FIELDS.map((f) => ({ ...f, value: sap?.[f.key] })).filter((f) => f.value).sort(sortByTime), [sap]);
  if (!events.length) return <Typography sx={{ color: '#9aa4b2', fontSize: 12 }}>ยังไม่มีเวลา</Typography>;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 380 }}>
      {events.map((e) => (
        <Tooltip key={e.key} title={`${e.label}: ${e.value}`}>
          <Chip size="small" label={`${e.short}${e.round > 1 ? ` (${e.round})` : ''} ${shortDateTime(e.value)}`}
            sx={{ bgcolor: e.bg, color: e.color, border: `1px solid ${e.color}33`, fontSize: 11, height: 22, fontFamily: 'Prompt, sans-serif' }} />
        </Tooltip>
      ))}
    </Box>
  );
});

const ManageRow = ({ rmfp, actions }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1, borderTop: '1px dashed #dbe3f5' }}>
    <Box sx={{ minWidth: 200, flex: 1 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{rmfp.production || '-'}</Typography>
      <Typography sx={{ fontSize: 12, color: '#64748b' }}>{[rmfp.rm_group_name, rmfp.level_eu && `EU ${rmfp.level_eu}`, rmfp.dest].filter(Boolean).join(' · ')}</Typography>
    </Box>
    <Box sx={{ minWidth: 150 }}>
      <Typography sx={{ fontSize: 11, color: '#64748b' }}>เวลาต้ม/อบเสร็จ</Typography>
      <Typography sx={{ fontSize: 13 }}>{rmfp.CookedDateTime || '-'}</Typography>
    </Box>
    {rmfp.remark ? <Box sx={{ minWidth: 120 }}><Typography sx={{ fontSize: 11, color: '#64748b' }}>Remark</Typography><Typography sx={{ fontSize: 13 }}>{rmfp.remark}</Typography></Box> : null}
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <Tooltip title="รถเข็น"><IconButton size="small" onClick={() => actions.cart(rmfp)} sx={{ color: PRIMARY }}><ShoppingCartIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="สลิป"><IconButton size="small" onClick={() => actions.slip(rmfp)} sx={{ color: '#64748b' }}><ReceiptIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="เสร็จสิ้น"><IconButton size="small" onClick={() => actions.complete(rmfp)} sx={{ color: '#26c200' }}><CheckCircleIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="เปลี่ยนแผนการผลิต"><IconButton size="small" onClick={() => actions.editPlan(rmfp)} sx={{ color: '#d49a00' }}><SwapIcon fontSize="small" /></IconButton></Tooltip>
    </Box>
  </Box>
);

const DataRow = React.memo(function DataRow({ row, index, onStamp, actions }) {
  const [open, setOpen] = useState(false);
  const { sap } = row;
  const bg = index % 2 === 0 ? '#fff' : '#f5f8ff';
  const cell = { fontSize: 13, color: '#334155', borderBottom: open ? 'none' : '1px solid #e8edf7', bgcolor: bg, verticalAlign: 'top' };
  return (
    <>
      <TableRow hover>
        <TableCell sx={{ ...cell, fontWeight: 600 }}>{row.batch || '-'}</TableCell>
        <TableCell sx={cell}>
          <Typography sx={{ fontSize: 13 }}>{row.mat || '-'}</Typography>
          <Typography sx={{ fontSize: 12, color: '#64748b' }}>{row.mat_name}</Typography>
        </TableCell>
        <TableCell sx={cell}>{sap?.hu || '-'}</TableCell>
        <TableCell sx={cell} align="right">{sap?.weight ?? '-'}</TableCell>
        <TableCell sx={cell}>{sap?.remark || '-'}</TableCell>
        <TableCell sx={cell}>{sap ? <TimeChips sap={sap} /> : <Typography sx={{ color: '#9aa4b2', fontSize: 12 }}>ไม่มีรายการ SAP ของวันนี้</Typography>}</TableCell>
        <TableCell sx={cell}>
          {sap ? (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {STAMPS.map((s) => (
                <Tooltip key={s.id} title={s.title}>
                  <Button size="small" variant="outlined" onClick={() => onStamp(s.id, row)}
                    sx={{ minWidth: 0, px: 1, fontSize: 12, borderColor: s.color, color: s.color, fontFamily: 'Prompt, sans-serif', '&:hover': { bgcolor: `${s.color}14`, borderColor: s.color } }}>
                    {s.label}
                  </Button>
                </Tooltip>
              ))}
            </Box>
          ) : '-'}
        </TableCell>
        <TableCell sx={cell} align="center">
          {row.rmfps.length ? (
            <Button size="small" onClick={() => setOpen((v) => !v)} endIcon={<ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.2s' }} />}
              sx={{ fontSize: 12, fontFamily: 'Prompt, sans-serif', color: PRIMARY, whiteSpace: 'nowrap' }}>
              จัดการ ({row.rmfps.length})
            </Button>
          ) : <Typography sx={{ color: '#9aa4b2', fontSize: 12 }}>-</Typography>}
        </TableCell>
      </TableRow>
      {row.rmfps.length > 0 && (
        <TableRow>
          <TableCell colSpan={8} sx={{ p: 0, border: 0 }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ px: 2, pb: 1.5, bgcolor: '#eef3ff', borderBottom: '1px solid #e8edf7' }}>
                {row.rmfps.map((r) => <ManageRow key={r.rmfp_id} rmfp={r} actions={actions} />)}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
});

const FILTERS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'manage', label: 'มีรายการจัดการ' },
  { id: 'nomanage', label: 'ยังไม่มีแผนจัดการ' },
];

const TimeStampTable = ({ rows, date, onDateChange, loading, errors, updatedAt, onRefresh, onStamp, actions }) => {
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(20);

  const shown = useMemo(() => {
    const t = term.trim().toLowerCase();
    return rows.filter((r) => (filter === 'all' || (filter === 'manage' ? r.rmfps.length > 0 : r.rmfps.length === 0)) && (!t || searchText(r).includes(t)));
  }, [rows, term, filter]);
  const maxPage = Math.max(0, Math.ceil(shown.length / perPage) - 1);
  const safePage = Math.min(page, maxPage);
  const pageRows = shown.slice(safePage * perPage, safePage * perPage + perPage);

  const head = { bgcolor: PRIMARY, color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: 'Prompt, sans-serif', whiteSpace: 'nowrap' };

  return (
    <Paper elevation={0} sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, border: '1px solid #e3e9f6', boxShadow: '0 1px 3px rgba(21,82,240,.08)' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, p: 2 }}>
        <TextField size="small" placeholder="ค้นหา Batch / Material / HU / แผนผลิต…" value={term} onChange={(e) => { setTerm(e.target.value); setPage(0); }}
          sx={{ flex: '1 1 260px', '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
        <TextField size="small" type="date" label="วันที่จ่ายออก" value={date} onChange={(e) => e.target.value && onDateChange(e.target.value)}
          InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14 } }} />
        <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => { if (v) { setFilter(v); setPage(0); } }}>
          {FILTERS.map((f) => <ToggleButton key={f.id} value={f.id} sx={{ textTransform: 'none', fontSize: 12, px: 1.5, fontFamily: 'Prompt, sans-serif' }}>{f.label}</ToggleButton>)}
        </ToggleButtonGroup>
        <Tooltip title={updatedAt ? `อัปเดตล่าสุด ${updatedAt.toLocaleTimeString('th-TH')}` : 'โหลดใหม่'}>
          <span><IconButton onClick={onRefresh} disabled={loading} sx={{ color: PRIMARY }}><RefreshIcon /></IconButton></span>
        </Tooltip>
      </Box>
      {loading && <LinearProgress />}
      {errors.map((e) => <Alert key={e} severity="error" sx={{ mx: 2, mb: 1 }} action={<Button color="inherit" size="small" onClick={onRefresh}>ลองใหม่</Button>}>{e}</Alert>)}
      <TableContainer sx={{ maxHeight: 'calc(100vh - 330px)', minHeight: 240 }}>
        <Table stickyHeader size="small" sx={{ minWidth: 980 }}>
          <TableHead>
            <TableRow>
              {['Batch', 'Material', 'HU', 'น้ำหนัก (kg)', 'Remark', 'เวลาทั้งหมด', 'Time Stamp'].map((h) => <TableCell key={h} sx={head} align={h === 'น้ำหนัก (kg)' ? 'right' : 'left'}>{h}</TableCell>)}
              <TableCell sx={head} align="center">จัดการวัตถุดิบ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.length ? pageRows.map((r, i) => <DataRow key={r.key} row={r} index={i} onStamp={onStamp} actions={actions} />) : (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748b', fontSize: 15 }}>{loading ? 'กำลังโหลด…' : 'ไม่มีรายการวัตถุดิบ'}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination component="div" rowsPerPageOptions={[20, 50, 100]} count={shown.length} rowsPerPage={perPage} page={safePage}
        onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        labelRowsPerPage="แถวต่อหน้า" />
    </Paper>
  );
};

export default TimeStampTable;
