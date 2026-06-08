import React, { useState, useEffect, useRef } from 'react';
import {
  Table, TableContainer, TableHead, TableBody, TableRow, TableCell,
  Paper, Box, TextField, Collapse, TablePagination, Divider, Typography,
  Button, Menu, MenuItem
} from '@mui/material';
import { InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { FaRegCircle, FaEye, FaTrash, FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";
import QualityCheckModal from './QualityCheckModal';
import axios from 'axios';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL;

const CUSTOM_COLUMN_WIDTHS = { viewDetails: '80px', qualityCheck: '80px', editAction: '80px' };

// ─── Date Helpers ─────────────────────────────────────────────────────────────
const getLatestComeColdDate = (row) => {
  const dates = [row.come_cold_date, row.come_cold_date_two, row.come_cold_date_three].filter(Boolean);
  if (dates.length === 0) return row.rmit_date || null;
  return new Date(Math.max(...dates.map(d => new Date(d)))).toISOString().replace('T', ' ');
};
const calculateTimeDifference = (dt) => (new Date() - new Date(dt)) / (1000 * 60);
const formatTime = (minutes) => {
  if (isNaN(minutes) || minutes === null) return "-";
  const abs = Math.abs(minutes);
  const days = Math.floor(abs / 1440), hours = Math.floor((abs % 1440) / 60), mins = Math.floor(abs % 60);
  let s = '';
  if (days > 0) s += `${days} วัน`;
  if (hours > 0) s += `${s ? ' ' : ''}${hours} ชม.`;
  if (mins > 0 || (!days && !hours)) s += `${s ? ' ' : ''}${mins} นาที`;
  return s.trim();
};
const getBorderColor = (pct, rem) => {
  if (rem < 0 || pct >= 100) return '#2c2c2c';
  if (pct >= 70) return '#FFF398';
  return '#80FF75';
};
const getRowStatus = (row) => {
  if (!row) return { borderColor: "#969696", statusMessage: "-", hideDelayTime: true, percentage: 0 };
  const latestComeColdDate = getLatestComeColdDate(row);
  if (!latestComeColdDate) return { borderColor: "#969696", statusMessage: "รอดำเนินการ", hideDelayTime: true, percentage: 0 };
  const timePassed = calculateTimeDifference(latestComeColdDate);
  if (row.mix_time != null) {
    const v = parseFloat(row.mix_time);
    const mixMin = Math.floor(v) * 60 + (v % 1) * 100;
    if (timePassed > mixMin) { const exc = timePassed - mixMin; return { borderColor: '#2c2c2c', statusMessage: `เลยกำหนด ${formatTime(exc)}`, hideDelayTime: false, percentage: ((120 + exc) / 120) * 100 }; }
    const rem = mixMin - timePassed; const pct = Math.min(100, Math.max(0, (timePassed / mixMin) * 100));
    return { borderColor: getBorderColor(pct, rem), statusMessage: `เหลืออีก ${formatTime(rem)}`, hideDelayTime: rem > 0, percentage: pct };
  }
  if (row.remaining_rework_time != null) {
    const rrt = parseFloat(row.remaining_rework_time), srt = parseFloat(row.standard_rework_time);
    const srtMin = Math.floor(srt) * 60 + (srt % 1) * 100;
    if (rrt < 0) { const exc = Math.floor(Math.abs(rrt)) * 60 + (Math.abs(rrt) % 1) * 100; return { borderColor: '#2c2c2c', statusMessage: `เลยกำหนด ${formatTime(-exc - timePassed)}`, hideDelayTime: false, percentage: ((srtMin + exc) / srtMin) * 100 }; }
    if (rrt === 0) return { borderColor: '#2c2c2c', statusMessage: `เลยกำหนด ${formatTime(timePassed)}`, hideDelayTime: false, percentage: 100 + (timePassed / srtMin) * 100 };
    const rrtMin = Math.floor(rrt) * 60 + (rrt % 1) * 100; const rem = rrtMin - timePassed; const pct = Math.min(100, Math.max(0, (1 - rem / srtMin) * 100));
    return { borderColor: getBorderColor(pct, rem), statusMessage: `เหลืออีก ${formatTime(rem)}`, hideDelayTime: rem > 0, percentage: pct };
  }
  const cold = parseFloat(row.cold), stdCold = parseFloat(row.standard_cold), stdMin = Math.floor(stdCold) * 60 + (stdCold % 1) * 100;
  if (cold < 0) { const exc = Math.floor(Math.abs(cold)) * 60 + (Math.abs(cold) % 1) * 100; return { borderColor: '#2c2c2c', statusMessage: `เลยกำหนด ${formatTime(-exc - timePassed)}`, hideDelayTime: false, percentage: ((stdMin + exc) / stdMin) * 100 }; }
  if (cold === 0) return { borderColor: '#2c2c2c', statusMessage: `เลยกำหนด ${formatTime(timePassed)}`, hideDelayTime: false, percentage: 100 + (timePassed / stdMin) * 100 };
  const coldMin = Math.floor(cold) * 60 + (cold % 1) * 100;
  if (timePassed > coldMin) { const exc = timePassed - coldMin; return { borderColor: '#2c2c2c', statusMessage: `เลยกำหนด ${formatTime(exc)}`, hideDelayTime: false, percentage: ((stdMin + exc) / stdMin) * 100 }; }
  const rem = coldMin - timePassed; const pct = Math.min(100, Math.max(0, (timePassed / stdMin) * 100));
  return { borderColor: getBorderColor(pct, rem), statusMessage: `เหลืออีก ${formatTime(rem)}`, hideDelayTime: rem > 0, percentage: pct };
};
const updateRmStatus = async (mapping_id) => {
  try {
    const r = await fetch(`${API_URL}/api/clodstorage/rmInTrolley`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapping_id, rm_status: 'รอแก้ไข' }) });
    if (!r.ok) throw new Error('Network error');
    return await r.json();
  } catch (e) { console.error('Error updating RM status:', e); throw e; }
};
const fmtDT = (val) => { if (!val) return '-'; try { return new Date(val).toLocaleString('th-TH', { hour12: false }); } catch { return val; } };

// ─── All Timeline Fields ──────────────────────────────────────────────────────
const ALL_TIME_FIELDS = [
  { key: 'cooked_date',              label: 'ต้ม/อบเสร็จ',                            color: '#5D4037', bg: '#EFEBE9' },
  { key: 'rmit_date',                label: 'เตรียมเสร็จ',                             color: '#37474F', bg: '#ECEFF1' },
  { key: 'come_cold_date',           label: 'เข้าห้องเย็น PF (1)',                    color: '#0277BD', bg: '#E3F2FD' },
  { key: 'out_cold_date',            label: 'ออกห้องเย็น PF (1)',                     color: '#E65100', bg: '#FFF3E0', extra: ['receiver_out_cold', 'at_pd_storage_purpose', 'at_pd_histamine'] },
  { key: 'come_cold_date_two',       label: 'เข้าห้องเย็น PF (2)',                    color: '#0277BD', bg: '#E3F2FD' },
  { key: 'out_cold_date_two',        label: 'ออกห้องเย็น PF (2)',                     color: '#E65100', bg: '#FFF3E0', extra: ['receiver_out_cold_two', 'at_pd_storage_purpose_2', 'at_pd_histamine_2'] },
  { key: 'come_cold_date_three',     label: 'เข้าห้องเย็น PF (3)',                    color: '#0277BD', bg: '#E3F2FD' },
  { key: 'out_cold_date_three',      label: 'ออกห้องเย็น PF (3)',                     color: '#E65100', bg: '#FFF3E0', extra: ['receiver_out_cold_three', 'at_pd_storage_purpose_3', 'at_pd_histamine_3'] },
  { key: 'rework_date',              label: 'แก้ไข',                                   color: '#FF8F00', bg: '#FFF8E1' },
  { key: 'cs_come_cold_date',        label: 'เข้าห้องเย็นใหญ่ (1)',                   color: '#1565C0', bg: '#E3F2FD' },
  { key: 'cs_out_cold_date',         label: 'ออกห้องเย็นใหญ่ (1)',                    color: '#BF360C', bg: '#FBE9E7' },
  { key: 'cs_come_cold_date_two',    label: 'เข้าห้องเย็นใหญ่ (2)',                   color: '#1565C0', bg: '#E3F2FD' },
  { key: 'cs_out_cold_date_two',     label: 'ออกห้องเย็นใหญ่ (2)',                    color: '#BF360C', bg: '#FBE9E7' },
  { key: 'cs_come_cold_date_three',  label: 'เข้าห้องเย็นใหญ่ (3)',                   color: '#1565C0', bg: '#E3F2FD' },
  { key: 'cs_out_cold_date_three',   label: 'ออกห้องเย็นใหญ่ (3)',                    color: '#BF360C', bg: '#FBE9E7' },
  { key: 'cs_come_cold_date_four',   label: 'เข้าห้องเย็นใหญ่ (4)',                   color: '#1565C0', bg: '#E3F2FD' },
  { key: 'cs_out_cold_date_four',    label: 'ออกห้องเย็นใหญ่ (4)',                    color: '#BF360C', bg: '#FBE9E7' },
  { key: 'withdraw_date',            label: 'ห้องเย็นใหญ่ส่งออก (1)',                 color: '#C62828', bg: '#FFEBEE' },
  { key: 'start_defrost_date',       label: 'เริ่มละลาย (1)',                          color: '#006064', bg: '#E0F7FA' },
  { key: 'end_defrost_date',         label: 'ละลายเสร็จ (1)',                          color: '#004D40', bg: '#E0F2F1' },
  { key: 'input_pd_date',            label: 'ผลิตรับเข้า (1)',                         color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'output_pd_date',           label: 'ผลิตส่งคืนไม่แปรรูป (1)',                color: '#6A1B9A', bg: '#F3E5F5', extra: ['pd_send', 'storage_purpose', 'histamine'] },
  { key: 'input_cd_date',            label: 'ห้องเย็นใหญ่รับ RM (1)',                 color: '#4527A0', bg: '#EDE7F6', extra: ['cs_re'] },
  { key: 'withdraw_date_two',        label: 'ห้องเย็นใหญ่ส่งออก (2)',                 color: '#C62828', bg: '#FFEBEE' },
  { key: 'start_defrost_date_two',   label: 'เริ่มละลาย (2)',                          color: '#006064', bg: '#E0F7FA' },
  { key: 'end_defrost_date_two',     label: 'ละลายเสร็จ (2)',                          color: '#004D40', bg: '#E0F2F1' },
  { key: 'input_pd_date_two',        label: 'ผลิตรับเข้า (2)',                         color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'output_pd_date_two',       label: 'ผลิตส่งคืนไม่แปรรูป (2)',                color: '#6A1B9A', bg: '#F3E5F5', extra: ['pd_send2', 'storage_purpose_2', 'histamine_2'] },
  { key: 'input_cd_date_two',        label: 'ห้องเย็นใหญ่รับ RM (2)',                 color: '#4527A0', bg: '#EDE7F6', extra: ['cs_re_2'] },
  { key: 'withdraw_date_three',      label: 'ห้องเย็นใหญ่ส่งออก (3)',                 color: '#C62828', bg: '#FFEBEE' },
  { key: 'start_defrost_date_three', label: 'เริ่มละลาย (3)',                          color: '#006064', bg: '#E0F7FA' },
  { key: 'end_defrost_date_three',   label: 'ละลายเสร็จ (3)',                          color: '#004D40', bg: '#E0F2F1' },
  { key: 'input_pd_date_three',      label: 'ผลิตรับเข้า (3)',                         color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'output_pd_date_three',     label: 'ผลิตส่งคืนไม่แปรรูป (3)',                color: '#6A1B9A', bg: '#F3E5F5', extra: ['pd_send3', 'storage_purpose_3', 'histamine_3'] },
  { key: 'input_cd_date_three',      label: 'ห้องเย็นใหญ่รับ RM (3)',                 color: '#4527A0', bg: '#EDE7F6', extra: ['cs_re_3'] },
  { key: 'withdraw_date_four',       label: 'ห้องเย็นใหญ่ส่งออก (4)',                 color: '#C62828', bg: '#FFEBEE' },
  { key: 'start_defrost_date_four',  label: 'เริ่มละลาย (4)',                          color: '#006064', bg: '#E0F7FA' },
  { key: 'end_defrost_date_four',    label: 'ละลายเสร็จ (4)',                          color: '#004D40', bg: '#E0F2F1' },
  { key: 'qc_datetime',              label: 'QC ตรวจสอบ',                              color: '#558B2F', bg: '#F1F8E9' },
  { key: 'md_time',                  label: 'ผ่าน MD',                                 color: '#1B5E20', bg: '#E8F5E9' },
];

const EXTRA_LABELS = {
  receiver_out_cold:       'ผู้รับออก',
  receiver_out_cold_two:   'ผู้รับออก',
  receiver_out_cold_three: 'ผู้รับออก',
  at_pd_storage_purpose:   'วัตถุประสงค์ (PD)', at_pd_storage_purpose_2: 'วัตถุประสงค์ (PD)', at_pd_storage_purpose_3: 'วัตถุประสงค์ (PD)',
  at_pd_histamine:         'Histamine PD (ppm)', at_pd_histamine_2: 'Histamine PD (ppm)',       at_pd_histamine_3: 'Histamine PD (ppm)',
  storage_purpose:         'วัตถุประสงค์',       storage_purpose_2: 'วัตถุประสงค์',            storage_purpose_3: 'วัตถุประสงค์',
  histamine:               'Histamine (ppm)',     histamine_2: 'Histamine (ppm)',                histamine_3: 'Histamine (ppm)',
  pd_send:                 'ปลายทาง PD',          pd_send2: 'ปลายทาง PD',                       pd_send3: 'ปลายทาง PD',
  cs_re:                   'CS รับเข้า',           cs_re_2: 'CS รับเข้า',                        cs_re_3: 'CS รับเข้า',
};

const TimelineSubRow = ({ row }) => {
  const events = ALL_TIME_FIELDS
    .map((f) => ({ ...f, value: row[f.key] }))
    .filter((f) => f.value)
    .sort((a, b) => new Date(a.value.replace(' ', 'T')) - new Date(b.value.replace(' ', 'T')));

  if (events.length === 0) {
    return <Box sx={{ p: 2, color: '#999', fontSize: '13px' }}>ไม่มีข้อมูล Timeline</Box>;
  }

  return (
    <Box sx={{ p: 1.5, backgroundColor: '#fafafa', overflowX: 'auto' }}>
      <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#555', mb: 1 }}>📅 Timeline</Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, flexWrap: 'nowrap', minWidth: 'max-content' }}>
        {events.map((ev, idx) => (
          <React.Fragment key={ev.key}>
            {idx > 0 && <Typography sx={{ fontSize: '18px', color: '#bbb', alignSelf: 'center', mx: 0.25 }}>›</Typography>}
            <Box sx={{ backgroundColor: ev.bg, border: `1.5px solid ${ev.color}`, borderRadius: '8px', px: 1.5, py: 0.75, minWidth: '145px', maxWidth: '195px', flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Box sx={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: ev.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
                  {idx + 1}
                </Box>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: ev.color, lineHeight: 1.2 }}>{ev.label}</Typography>
              </Box>
              <Typography sx={{ fontSize: '11px', color: '#333', fontFamily: 'monospace' }}>{ev.value}</Typography>
              {ev.extra && ev.extra.map(k => row[k] ? (
                <Typography key={k} sx={{ fontSize: '10px', color: ev.color, mt: 0.25 }}>
                  {EXTRA_LABELS[k]}: <strong>{row[k]}</strong>
                </Typography>
              ) : null)}
            </Box>
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};

// ─── Sub-table CS columns ─────────────────────────────────────────────────────
const CS_COLD_COLS = [
  { label: 'เข้าห้องเย็นใหญ่/1', field: 'cs_come_cold_date', enter: true },
  { label: 'ออกห้องเย็นใหญ่/1', field: 'cs_out_cold_date', enter: false },
  { label: 'เข้าห้องเย็นใหญ่/2', field: 'cs_come_cold_date_two', enter: true },
  { label: 'ออกห้องเย็นใหญ่/2', field: 'cs_out_cold_date_two', enter: false },
  { label: 'เข้าห้องเย็นใหญ่/3', field: 'cs_come_cold_date_three', enter: true },
  { label: 'ออกห้องเย็นใหญ่/3', field: 'cs_out_cold_date_three', enter: false },
  { label: 'เข้าห้องเย็นใหญ่/4', field: 'cs_come_cold_date_four', enter: true },
  { label: 'ออกห้องเย็นใหญ่/4', field: 'cs_out_cold_date_four', enter: false },
];

// ─── Row ──────────────────────────────────────────────────────────────────────
const Row = ({ row, tableColumns, handleOpenModal, handleRowClick, handleOpenEditModal, handleOpenDeleteModal, handleOpenSuccess, handleOpenQualityCheckModal, selectedColor, openRowId, setOpenRowId, index }) => {
  if (!row) return null;
  const isQcChecked = row.rm_status === 'QcCheck' && row.qccheck_cold !== null;
  const { borderColor, statusMessage, percentage } = getRowStatus(row);
  const backgroundColor = index % 2 === 0 ? '#ffffff' : 'hsl(210,100%,93%)';
  const isOverdue = percentage >= 100 || statusMessage.includes('เลยกำหนด');

  useEffect(() => {
    if (isOverdue && row.rm_status !== 'รอแก้ไข') updateRmStatus(row.mapping_id).catch(console.error);
  }, [isOverdue, row.rm_status, row.mapping_id]);

  const isOpen = openRowId === row.mapping_id;
  const handleDetailClick = (e) => { e.stopPropagation(); setOpenRowId(isOpen ? null : row.mapping_id); if (typeof handleRowClick === 'function') handleRowClick(row.mapping_id); else if (typeof handleOpenModal === 'function') handleOpenModal(row); };
  const subHeaderBg = '#1565C0', subHeaderColor = '#fff', subCellEnterBg = '#E3F2FD', subCellExitBg = '#FFF8E1', subCellEnterColor = '#0D47A1', subCellExitColor = '#E65100';

  return (
    <>
      <TableRow><TableCell style={{ height: '4px', padding: 0, border: 'none' }} /></TableRow>
      <TableRow>
        {tableColumns.map((col, i) => (
          <TableCell key={col.id} align="center" style={{ width: col.width, borderLeft: i === 0 ? `5px solid ${borderColor}` : '1px solid #f2f2f2', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', borderTopLeftRadius: i === 0 ? '8px' : 0, borderBottomLeftRadius: i === 0 ? '8px' : 0, whiteSpace: 'normal', wordWrap: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px', height: '36px', lineHeight: '1.4', padding: '0px 8px', color: col.getColor ? col.getColor(row[col.id]) : '#787878', backgroundColor }}>
            {row[col.id] ?? '-'}
          </TableCell>
        ))}
        {/* View Details */}
        <TableCell onClick={handleDetailClick} align="center" sx={{ borderLeft: '1px solid #e0e0e0', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', height: '36px', padding: 0, cursor: 'pointer', backgroundColor, '&:hover': { backgroundColor: 'rgba(33,150,243,0.15)' }, '&:hover .vd-icon': { color: '#0D47A1', transform: 'scale(1.2)' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#2196F3', p: '8px', transition: 'all 0.2s' }} className="vd-icon"><FaEye style={{ fontSize: '18px' }} /></Box>
        </TableCell>
        {/* Delete */}
        <TableCell onClick={(e) => { e.stopPropagation(); handleOpenDeleteModal?.(row); }} align="center" sx={{ borderLeft: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', height: '36px', padding: 0, cursor: 'pointer', backgroundColor, borderTopRightRadius: '8px', borderBottomRightRadius: '8px', '&:hover': { backgroundColor: 'rgba(231,74,59,0.15)' }, '&:hover .del-icon': { color: '#C0392B', transform: 'scale(1.2)' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#E74A3B', p: '8px', transition: 'all 0.2s' }} className="del-icon"><FaTrash style={{ fontSize: '18px' }} /></Box>
        </TableCell>
      </TableRow>
      <TableRow><TableCell style={{ height: '4px', padding: 0, border: 'none' }} /></TableRow>

      {/* ── Collapse ── */}
      <TableRow>
        <TableCell style={{ padding: 0, border: 'none' }} colSpan={tableColumns.length + 2}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{ m: 1, borderRadius: '10px', overflow: 'hidden', border: '1px solid #BBDEFB', boxShadow: '0 2px 8px rgba(33,150,243,0.1)' }}>
              <Box sx={{ background: 'linear-gradient(90deg,#1565C0,#1976D2)', p: '10px 16px', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>🚛 รายละเอียดรถเข็น {row.tro_id}</Typography>
              </Box>

              {/* Info */}
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#E3F2FD' }}>
                    {['Batch','Material','รายชื่อวัตถุดิบ','Level EU','น้ำหนัก','จำนวนถาด','สถานะ'].map(h => (
                      <TableCell key={h} align="center" sx={{ fontSize: '12px', fontWeight: 700, color: '#1565C0', borderRight: '1px solid #BBDEFB', py: '6px' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow sx={{ bgcolor: '#fff' }}>
                    {[row.batch, row.mat, row.mat_name, row.level_eu, row.weight_RM, row.tray_count].map((v, i) => (
                      <TableCell key={i} align="center" sx={{ fontSize: '12px', color: '#333', borderRight: '1px solid #E3F2FD', py: '6px' }}>{v || '-'}</TableCell>
                    ))}
                    <TableCell align="center" sx={{ fontSize: '12px', fontWeight: 600, py: '6px', color: ['รอกลับมาเตรียม','QcCheck รอ MD'].includes(row.rm_status) ? '#00bcd4' : row.rm_status === 'เหลือจากไลน์ผลิต' ? '#ff9800' : row.rm_status === 'QcCheck' ? '#4caf50' : row.rm_status === 'รอแก้ไข' ? '#f44336' : '#333' }}>{row.rm_status}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* ✅ CS Extra Info — receiver, section leader, storage purpose, histamine */}
              {/* <Box sx={{ p: '8px 12px', bgcolor: '#F8FBFF', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {[
                  { label: '👤 หัวหน้าส่วนงานห้องเย็นผลิต', value: row.receiver_out_cold },
                  { label: '👷 หัวหน้าส่วนงานห้องเย็นห้องเย็น', value: row.rd_section_colds },
                  { label: '📦 วัตถุประสงค์การจัดเก็บ', value: row.storage_purpose },
                  { label: '🧪 ผล Histamine', value: row.histamine != null ? `${row.histamine} ppm` : null },
                ].map(({ label, value }) => value ? (
                  <Box key={label}>
                    <Typography sx={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, mb: 0.25 }}>{label}</Typography>
                    <Typography sx={{ fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>{value}</Typography>
                  </Box>
                ) : null)}
              </Box> */}

              <Divider sx={{ borderColor: '#BBDEFB' }} />
              <TimelineSubRow row={row} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

// ─── tableColumns ─────────────────────────────────────────────────────────────
const tableColumns = [
  { id: 'batch', name: 'Batch', width: '95px' },
  { id: 'mat', name: 'Material', width: '95px' },
  { id: 'mat_name', name: 'รายชื่อวัตถุดิบ', width: '220px' },
  { id: 'production', name: 'แผนการผลิต', width: '130px' },
  { id: 'tro_id', name: 'ป้ายทะเบียน', width: '90px' },
  { id: 'weight_RM', name: 'น้ำหนัก', width: '90px' },
  { id: 'cs_name', name: 'ชื่อห้องเย็น', width: '90px' },

];

const CS_SORT_FIELDS = [{ field: 'cs_come_cold_date', label: 'เวลาเข้าห้องเย็นใหญ่' }];

// ─── Export helpers ────────────────────────────────────────────────────────────
const EXPORT_HEADERS = [
  'Batch', 'Material', 'รายชื่อวัตถุดิบ', 'แผนการผลิต', 'ป้ายทะเบียน',
  'น้ำหนัก (กก.)', 'ชื่อห้องเย็น', 'หัวหน้าส่วนงานผลิต', 'หัวหน้าส่วนงานห้องเย็นห้องเย็น',
  'วัตถุประสงค์การจัดเก็บ', 'Histamine (ppm)',
  'เข้าห้องเย็นใหญ่ 1', 'ออกห้องเย็นใหญ่ 1',
  'เข้าห้องเย็นใหญ่ 2', 'ออกห้องเย็นใหญ่ 2',
  'เข้าห้องเย็นใหญ่ 3', 'ออกห้องเย็นใหญ่ 3',
  'เข้าห้องเย็นใหญ่ 4', 'ออกห้องเย็นใหญ่ 4',
];

const rowToExportData = (row) => [
  row.batch, row.mat, row.mat_name, row.production, row.tro_id,
  row.weight_RM, row.cs_name, row.receiver_out_cold, row.rd_section_colds,
  row.storage_purpose, row.histamine,
  fmtDT(row.cs_come_cold_date), fmtDT(row.cs_out_cold_date),
  fmtDT(row.cs_come_cold_date_two), fmtDT(row.cs_out_cold_date_two),
  fmtDT(row.cs_come_cold_date_three), fmtDT(row.cs_out_cold_date_three),
  fmtDT(row.cs_come_cold_date_four), fmtDT(row.cs_out_cold_date_four),
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
const TableMainPrep = ({ handleOpenModal, data, handleRowClick, handleOpenEditModal, handleOpenSuccess, handleOpenDeleteModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRows, setFilteredRows] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(300);
  const [selectedColor, setSelectedColor] = useState('');
  const [openRowId, setOpenRowId] = useState(null);
  const [qualityCheckModalOpen, setQualityCheckModalOpen] = useState(false);
  const [selectedRowForQC, setSelectedRowForQC] = useState(null);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [exportAnchor, setExportAnchor] = useState(null);

  const handleOpenQualityCheckModal = (row) => { if (!row) return; setSelectedRowForQC(row); setQualityCheckModalOpen(true); };
  const handleSubmitQualityCheck = async (d) => { try { await axios.put(`${API_URL}/api/qc/cold/check`, d); setQualityCheckModalOpen(false); alert('บันทึกข้อมูลสำเร็จ'); } catch (e) { alert('เกิดข้อผิดพลาด: ' + e.message); } };

  useEffect(() => {
    let rows = Array.isArray(data) ? data.map(r => ({ ...r, qc_datetime: r.come_cold_date || r.rmit_date })) : [];
    if (searchTerm) rows = rows.filter(r => Object.values(r).some(v => v && v.toString().toLowerCase().includes(searchTerm.toLowerCase())));
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const getLatest = (row) => { const fs = [row.cs_come_cold_date, row.cs_come_cold_date_two, row.cs_come_cold_date_three, row.cs_come_cold_date_four].filter(Boolean); return fs.length === 0 ? new Date(0) : new Date(Math.max(...fs.map(d => new Date(d)))); };
        return sortDir === 'asc' ? getLatest(a) - getLatest(b) : getLatest(b) - getLatest(a);
      });
    }
    setFilteredRows(rows); setPage(0);
  }, [searchTerm, data, sortField, sortDir]);

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

      {/* ── Filter Bar ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 2, pb: '10px', borderBottom: '1px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>🔃 เรียงตาม:</Typography>
          <button onClick={() => { sortField === 'cs_come_cold_date' ? setSortDir(d => d === 'asc' ? 'desc' : 'asc') : (setSortField('cs_come_cold_date'), setSortDir('asc')); }}
            style={{ padding: '3px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', border: sortField ? '2px solid #1565C0' : '1px solid #ccc', backgroundColor: sortField ? '#E3F2FD' : '#fff', color: sortField ? '#1565C0' : '#555', fontWeight: sortField ? 700 : 400, display: 'flex', alignItems: 'center', gap: '5px' }}>
            เรียงเวลาเข้าห้องเย็นก่อน-หลัง
            {sortField ? (sortDir === 'asc' ? <FaSortAmountUp style={{ fontSize: '10px' }} /> : <FaSortAmountDown style={{ fontSize: '10px' }} />) : <FaSortAmountUp style={{ fontSize: '10px', opacity: 0.35 }} />}
          </button>
          {sortField && <button onClick={() => { setSortField(''); setSortDir('asc'); }} style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '11px', cursor: 'pointer', backgroundColor: '#fff', color: '#494848' }}>ล้าง</button>}
        </Box>
        <Typography sx={{ fontSize: '11px', color: '#494848', ml: 'auto' }}>แสดง {filteredRows.length} รายการ</Typography>
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
                {['รายละเอียด','ลบ'].map((lbl, i, arr) => (
                  <TableCell key={lbl} align="center" style={{ backgroundColor: 'hsl(210,100%,60%)', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', borderLeft: '1px solid #f2f2f2', borderRight: '1px solid #e0e0e0', fontSize: '12px', padding: '4px', width: '80px', borderTopRightRadius: i === arr.length - 1 ? '8px' : 0, borderBottomRightRadius: i === arr.length - 1 ? '8px' : 0 }}>
                    <Box style={{ fontSize: '12px', color: '#ffffff' }}>{lbl}</Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.length > 0
                ? filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, i) => (
                  <Row key={i} row={row} tableColumns={tableColumns} handleOpenModal={handleOpenModal} handleRowClick={handleRowClick} handleOpenEditModal={handleOpenEditModal} handleOpenDeleteModal={handleOpenDeleteModal} handleOpenQualityCheckModal={handleOpenQualityCheckModal} handleOpenSuccess={handleOpenSuccess} selectedColor={selectedColor} openRowId={openRowId} setOpenRowId={setOpenRowId} index={i} />
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

      <QualityCheckModal open={qualityCheckModalOpen} handleClose={() => setQualityCheckModalOpen(false)} rowData={selectedRowForQC} handleSubmit={handleSubmitQualityCheck} />
    </Paper>
  );
};

export default TableMainPrep;