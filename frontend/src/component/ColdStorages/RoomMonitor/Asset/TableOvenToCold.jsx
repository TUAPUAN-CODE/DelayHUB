import React, { useState, useEffect, useRef } from 'react';
import {
  Table, TableContainer, TableHead, TableBody, TableRow, TableCell,
  Paper, Box, TextField, Collapse, TablePagination, Divider, Typography,
  Button, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, CircularProgress,
} from '@mui/material';
import { InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import { FaRegCircle, FaEye, FaTrash, FaSortAmountDown, FaSortAmountUp, FaExchangeAlt, FaSignInAlt, FaSignOutAlt } from "react-icons/fa";
import QualityCheckModal from './QualityCheckModal';
import axios from 'axios';
import * as XLSX from 'xlsx';

import withTableTools from "../../../Layout/withTableTools";
const API_URL = import.meta.env.VITE_API_URL;

// ✅ cs_id ที่ไม่คำนวณ DCS (temp <18 องศา)
const NO_DCS_CS_IDS = [10, 14, 21, 25, 26, 37, 38];

const DEST_RECEIVED = 'ในห้องเย็นใหญ่';
const DEST_PENDING  = 'เข้าห้องเย็นใหญ่';

const getDestLabel = (dest) => {
  if (dest === DEST_RECEIVED) return 'อยู่ในห้องเย็นแล้ว';
  return 'รอรับเข้า';
};
const getDestColor = (dest) => {
  if (dest === DEST_RECEIVED) return '#2E7D32';
  return '#E65100';
};

const getLatestComeColdDate = (row) => {
  const dates = [row.come_cold_date, row.come_cold_date_two, row.come_cold_date_three].filter(Boolean);
  if (dates.length === 0) return row.rmit_date || null;
  return new Date(Math.max(...dates.map(d => new Date(d)))).toISOString().replace('T', ' ');
};

const formatTime = (minutes) => {
  if (isNaN(minutes) || minutes === null) return '-';
  const abs   = Math.abs(minutes);
  const days  = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const mins  = Math.floor(abs % 60);
  let s = '';
  if (days  > 0)              s += `${days} วัน`;
  if (hours > 0)              s += `${s ? ' ' : ''}${hours} ชม.`;
  if (mins  > 0 || (!days && !hours)) s += `${s ? ' ' : ''}${mins} นาที`;
  return s.trim();
};

const getLatestCsComeCold = (row) => {
  const dates = [
    row.cs_come_cold_date, row.cs_come_cold_date_two,
    row.cs_come_cold_date_three, row.cs_come_cold_date_four,
  ].filter(Boolean);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map(d => new Date(d).getTime())));
};

// ✅ ตรวจสอบ cs_id ว่าอยู่ในกลุ่ม temp <18 หรือไม่
const isNoDcsRoom = (row) => NO_DCS_CS_IDS.includes(Number(row.cs_id));

const calculateCSDelayTime = (row) => {
  // ✅ ถ้าเป็นห้องที่ไม่คำนวณ DCS ให้ return ข้อความพิเศษ
  if (isNoDcsRoom(row)) {
    return { color: 'grey', statusMessage: 'temp ต่ำกว่า -18 องศา ไม่คำนวณ DCS', percentage: 0, noDcs: true };
  }

  const latestCS = getLatestCsComeCold(row);
  if (!latestCS) {
    return { color: 'grey', statusMessage: 'รอดำเนินการ', percentage: 0 };
  }

  const timePassed = (new Date() - latestCS) / (1000 * 60);

  const rawStd = parseFloat(row.standard_cold);
  const standardMinutes = !isNaN(rawStd) && rawStd > 0
    ? Math.floor(rawStd) * 60 + (rawStd % 1) * 100
    : 120;

  const rawCold = parseFloat(row.cold);

  if (!isNaN(rawCold)) {
    if (rawCold < 0) {
      const excMin   = Math.floor(Math.abs(rawCold)) * 60 + (Math.abs(rawCold) % 1) * 100;
      const totalExc = excMin + timePassed;
      return { color: 'red', statusMessage: `เลยกำหนด ${formatTime(totalExc)}`, percentage: ((standardMinutes + totalExc) / standardMinutes) * 100 };
    }
    if (rawCold === 0) {
      return { color: 'red', statusMessage: `เลยกำหนด ${formatTime(timePassed)}`, percentage: ((standardMinutes + timePassed) / standardMinutes) * 100 };
    }
    const coldMin = Math.floor(rawCold) * 60 + (rawCold % 1) * 100;
    if (timePassed > coldMin) {
      const exc = timePassed - coldMin;
      return { color: 'red', statusMessage: `เลยกำหนด ${formatTime(exc)}`, percentage: ((standardMinutes + exc) / standardMinutes) * 100 };
    }
    const remaining = coldMin - timePassed;
    const pct   = Math.min(100, (timePassed / standardMinutes) * 100);
    const color = pct >= 100 ? 'red' : pct >= 70 ? 'orange' : 'green';
    return { color, statusMessage: `เหลืออีก ${formatTime(remaining)}`, percentage: pct };
  }

  const pct = Math.min(100, (timePassed / standardMinutes) * 100);
  if (pct >= 100) {
    const exc = timePassed - standardMinutes;
    return { color: 'red', statusMessage: `เลยกำหนด ${formatTime(exc)}`, percentage: pct };
  }
  const remaining = standardMinutes - timePassed;
  const color = pct >= 70 ? 'orange' : 'green';
  return { color, statusMessage: `เหลืออีก ${formatTime(remaining)}`, percentage: pct };
};

const getHourglassColor = (color) => {
  switch (color) {
    case 'red':    return '#FF4444';
    case 'orange': return '#FFA500';
    case 'green':  return '#4CAF50';
    default:       return '#969696';
  }
};

const getBorderLeftColor = (color) => {
  switch (color) {
    case 'red':    return '#FF4444';
    case 'orange': return '#FFA500';
    case 'green':  return '#4CAF50';
    default:       return '#d0d0d0';
  }
};

const updateRmStatus = async (mapping_id) => {
  try {
    const r = await fetch(`${API_URL}/api/clodstorage/rmInTrolley`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapping_id, rm_status: 'รอแก้ไข' }),
    });
    if (!r.ok) throw new Error('Network error');
    return await r.json();
  } catch (e) { console.error('Error updating RM status:', e); throw e; }
};

const fmtDT = (val) => {
  if (!val) return '-';
  try { return new Date(val).toLocaleString('th-TH', { hour12: false }); } catch { return val; }
};

const ALL_TIME_FIELDS = [
  { key: 'cooked_date',              label: 'ต้ม/อบเสร็จ',                color: '#5D4037', bg: '#EFEBE9' },
  { key: 'rmit_date',                label: 'เตรียมเสร็จ',                 color: '#37474F', bg: '#ECEFF1' },
  { key: 'come_cold_date',           label: 'เข้าห้องเย็น PF (1)',         color: '#0277BD', bg: '#EAF0FF' },
  { key: 'out_cold_date',            label: 'ออกห้องเย็น PF (1)',          color: '#E65100', bg: '#FFF3E0', extra: ['receiver_out_cold','at_pd_storage_purpose','at_pd_histamine'] },
  { key: 'come_cold_date_two',       label: 'เข้าห้องเย็น PF (2)',         color: '#0277BD', bg: '#EAF0FF' },
  { key: 'out_cold_date_two',        label: 'ออกห้องเย็น PF (2)',          color: '#E65100', bg: '#FFF3E0', extra: ['receiver_out_cold_two','at_pd_storage_purpose_2','at_pd_histamine_2'] },
  { key: 'come_cold_date_three',     label: 'เข้าห้องเย็น PF (3)',         color: '#0277BD', bg: '#EAF0FF' },
  { key: 'out_cold_date_three',      label: 'ออกห้องเย็น PF (3)',          color: '#E65100', bg: '#FFF3E0', extra: ['receiver_out_cold_three','at_pd_storage_purpose_3','at_pd_histamine_3'] },
  { key: 'rework_date',              label: 'แก้ไข',                       color: '#FF8F00', bg: '#FFF8E1' },
  { key: 'cs_come_cold_date',        label: 'เข้าห้องเย็นใหญ่ (1)',        color: '#0F3FC4', bg: '#EAF0FF' },
  { key: 'cs_out_cold_date',         label: 'ออกห้องเย็นใหญ่ (1)',         color: '#BF360C', bg: '#FBE9E7' },
  { key: 'cs_come_cold_date_two',    label: 'เข้าห้องเย็นใหญ่ (2)',        color: '#0F3FC4', bg: '#EAF0FF' },
  { key: 'cs_out_cold_date_two',     label: 'ออกห้องเย็นใหญ่ (2)',         color: '#BF360C', bg: '#FBE9E7' },
  { key: 'cs_come_cold_date_three',  label: 'เข้าห้องเย็นใหญ่ (3)',        color: '#0F3FC4', bg: '#EAF0FF' },
  { key: 'cs_out_cold_date_three',   label: 'ออกห้องเย็นใหญ่ (3)',         color: '#BF360C', bg: '#FBE9E7' },
  { key: 'cs_come_cold_date_four',   label: 'เข้าห้องเย็นใหญ่ (4)',        color: '#0F3FC4', bg: '#EAF0FF' },
  { key: 'cs_come_cold_date_four',   label: 'ออกห้องเย็นใหญ่ (4)',         color: '#BF360C', bg: '#FBE9E7' },
  { key: 'withdraw_date',            label: 'ห้องเย็นใหญ่ส่งออก (1)',      color: '#C62828', bg: '#FFEBEE' },
  { key: 'start_defrost_date',       label: 'เริ่มละลาย (1)',              color: '#006064', bg: '#E0F7FA' },
  { key: 'end_defrost_date',         label: 'ละลายเสร็จ (1)',              color: '#004D40', bg: '#E0F2F1' },
  { key: 'input_pd_date',            label: 'ผลิตรับเข้า (1)',             color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'output_pd_date',           label: 'ผลิตส่งคืนไม่แปรรูป (1)',    color: '#6A1B9A', bg: '#F3E5F5', extra: ['pd_send','storage_purpose','histamine'] },
  { key: 'input_cd_date',            label: 'ห้องเย็นใหญ่รับ RM (1)',      color: '#4527A0', bg: '#EDE7F6', extra: ['cs_re'] },
  { key: 'withdraw_date_two',        label: 'ห้องเย็นใหญ่ส่งออก (2)',      color: '#C62828', bg: '#FFEBEE' },
  { key: 'start_defrost_date_two',   label: 'เริ่มละลาย (2)',              color: '#006064', bg: '#E0F7FA' },
  { key: 'end_defrost_date_two',     label: 'ละลายเสร็จ (2)',              color: '#004D40', bg: '#E0F2F1' },
  { key: 'input_pd_date_two',        label: 'ผลิตรับเข้า (2)',             color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'output_pd_date_two',       label: 'ผลิตส่งคืนไม่แปรรูป (2)',    color: '#6A1B9A', bg: '#F3E5F5', extra: ['pd_send2','storage_purpose_2','histamine_2'] },
  { key: 'input_cd_date_two',        label: 'ห้องเย็นใหญ่รับ RM (2)',      color: '#4527A0', bg: '#EDE7F6', extra: ['cs_re_2'] },
  { key: 'withdraw_date_three',      label: 'ห้องเย็นใหญ่ส่งออก (3)',      color: '#C62828', bg: '#FFEBEE' },
  { key: 'start_defrost_date_three', label: 'เริ่มละลาย (3)',              color: '#006064', bg: '#E0F7FA' },
  { key: 'end_defrost_date_three',   label: 'ละลายเสร็จ (3)',              color: '#004D40', bg: '#E0F2F1' },
  { key: 'input_pd_date_three',      label: 'ผลิตรับเข้า (3)',             color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'output_pd_date_three',     label: 'ผลิตส่งคืนไม่แปรรูป (3)',    color: '#6A1B9A', bg: '#F3E5F5', extra: ['pd_send3','storage_purpose_3','histamine_3'] },
  { key: 'input_cd_date_three',      label: 'ห้องเย็นใหญ่รับ RM (3)',      color: '#4527A0', bg: '#EDE7F6', extra: ['cs_re_3'] },
  { key: 'withdraw_date_four',       label: 'ห้องเย็นใหญ่ส่งออก (4)',      color: '#C62828', bg: '#FFEBEE' },
  { key: 'start_defrost_date_four',  label: 'เริ่มละลาย (4)',              color: '#006064', bg: '#E0F7FA' },
  { key: 'end_defrost_date_four',    label: 'ละลายเสร็จ (4)',              color: '#004D40', bg: '#E0F2F1' },
  { key: 'md_time',                  label: 'ผ่าน MD',                     color: '#1B5E20', bg: '#E8F5E9' },
];

const EXTRA_LABELS = {
  receiver_out_cold: 'ผู้รับออก', receiver_out_cold_two: 'ผู้รับออก', receiver_out_cold_three: 'ผู้รับออก',
  at_pd_storage_purpose: 'วัตถุประสงค์ (PD)', at_pd_storage_purpose_2: 'วัตถุประสงค์ (PD)', at_pd_storage_purpose_3: 'วัตถุประสงค์ (PD)',
  at_pd_histamine: 'Histamine PD (ppm)', at_pd_histamine_2: 'Histamine PD (ppm)', at_pd_histamine_3: 'Histamine PD (ppm)',
  storage_purpose: 'วัตถุประสงค์', storage_purpose_2: 'วัตถุประสงค์', storage_purpose_3: 'วัตถุประสงค์',
  histamine: 'Histamine (ppm)', histamine_2: 'Histamine (ppm)', histamine_3: 'Histamine (ppm)',
  pd_send: 'ปลายทาง PD', pd_send2: 'ปลายทาง PD', pd_send3: 'ปลายทาง PD',
  cs_re: 'CS รับเข้า', cs_re_2: 'CS รับเข้า', cs_re_3: 'CS รับเข้า',
};

const TimelineSubRow = ({ row }) => {
  const events = ALL_TIME_FIELDS
    .map(f => ({ ...f, value: row[f.key] }))
    .filter(f => f.value)
    .sort((a, b) => new Date(a.value.replace(' ', 'T')) - new Date(b.value.replace(' ', 'T')));

  if (events.length === 0)
    return <Box sx={{ p: 2, color: '#999', fontSize: '13px' }}>ไม่มีข้อมูล Timeline</Box>;

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

const getLatestAtPdStoragePurpose = (row) =>
  row.at_pd_storage_purpose_3 || row.at_pd_storage_purpose_2 || row.at_pd_storage_purpose || null;

const getLatestAtPdColdRemark = (row) =>
  row.at_pd_cold_remark_3 || row.at_pd_cold_remark_2 || row.at_pd_cold_remark || null;

const getLatestAtPdDepositDate = (row) =>
  row.at_pd_deposit_date_3 || row.at_pd_deposit_date_2 || row.at_pd_deposit_date || null;

const formatDepositDate = (v) => {
  if (!v) return '-';
  try {
    return new Date(v).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch { return v; }
};

const getColdStorageDuration = (row) => {
  const latest = getLatestCsComeCold(row);
  if (!latest) return '-';
  const now = new Date();
  let diff = Math.floor((now - latest) / 1000);
  const days    = Math.floor(diff / 86400); diff %= 86400;
  const hours   = Math.floor(diff / 3600);  diff %= 3600;
  const minutes = Math.floor(diff / 60);
  let txt = '';
  if (days  > 0)              txt += `${days} วัน `;
  if (hours > 0 || days > 0) txt += `${hours} ชม. `;
  txt += `${minutes} นาที`;
  return txt;
};

// ─── Table columns ─────────────────────────────────────────────────────────────
// ✅ ลำดับคอลัมน์:
//    1. สถานะรถเข็น  2. อยู่ในห้องเย็น  3. [เวลา DCS คงเหลือ — special cell]
//    4. รายการ (mapping_id)  5. tro_id  6. batch  7. mat  8. mat_name  9. production  10. weight_RM  11. cs_name
const tableColumns = [
  { id: 'dest',         name: 'สถานะรถเข็น',    width: '170px', bold: true, render: (val) => getDestLabel(val), getColor: (val) => getDestColor(val) },
  { id: 'cold_duration',name: 'อยู่ในห้องเย็น', width: '150px', bold: true, render: (_, row) => getColdStorageDuration(row), getColor: () => '#0F3FC4' },
  // ← คอลัมน์ที่ 3 จะ render พิเศษใน Row (ไม่ใส่ใน tableColumns เพื่อให้ควบคุมได้ง่าย)
  { id: 'mapping_id',   name: 'รายการ',          width: '80px'  },
  { id: 'tro_id',       name: 'ป้ายทะเบียน',     width: '120px' },
  { id: 'batch',        name: 'Batch',             width: '95px'  },
  { id: 'mat',          name: 'Material',           width: '95px'  },
  { id: 'mat_name',     name: 'รายชื่อวัตถุดิบ',  width: '200px' },
  { id: 'production',   name: 'แผนการผลิต',        width: '130px' },
  { id: 'weight_RM',    name: 'น้ำหนัก',           width: '90px'  },
  { id: 'cs_name',      name: 'ชื่อห้องเย็น',      width: '90px'  },
];

// ─── Row ───────────────────────────────────────────────────────────────────────
const Row = ({
  row, handleOpenModal, handleRowClick, handleOpenEditModal,
  handleOpenDeleteModal, handleOpenSuccess, handleOpenQualityCheckModal,
  handleOpenTransferModal, onCheckin, onCheckout,
  selectedColor, openRowId, setOpenRowId, index,
}) => {
  if (!row) return null;

  const { color: delayColor, statusMessage, percentage, noDcs } = calculateCSDelayTime(row);
  const hourglassColor  = getHourglassColor(delayColor);
  const borderLeftColor = getBorderLeftColor(delayColor);
  const backgroundColor = index % 2 === 0 ? '#ffffff' : '#EAF0FF';
  const isOverdue       = !noDcs && (percentage >= 100 || statusMessage.includes('เลยกำหนด'));

  useEffect(() => {
    if (isOverdue && row.rm_status !== 'รอแก้ไข') updateRmStatus(row.mapping_id).catch(console.error);
  }, [isOverdue, row.rm_status, row.mapping_id]);

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => forceUpdate(v => v + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const isPendingRow = row.dest !== DEST_RECEIVED;
  const isOpen = openRowId === row.mapping_id;
  const handleDetailClick = (e) => {
    e.stopPropagation();
    setOpenRowId(isOpen ? null : row.mapping_id);
    if (typeof handleRowClick === 'function') handleRowClick(row.mapping_id);
    else if (typeof handleOpenModal === 'function') handleOpenModal(row);
  };

  // สีตัวอักษรของ DCS cell
  const dcsTextColor = noDcs ? '#0F3FC4'
    : delayColor === 'red'    ? '#D32F2F'
    : delayColor === 'orange' ? '#E65100'
    : delayColor === 'green'  ? '#2E7D32'
    : '#6B7489';

  const cellBase = {
    borderTop: '1px solid #E3E8F2', borderBottom: '1px solid #E3E8F2',
    fontSize: '13px', height: '36px', padding: '0px 8px', backgroundColor,
  };

  return (
    <>
      <TableRow><TableCell style={{ height: '4px', padding: 0, border: 'none' }} /></TableRow>
      <TableRow>
        {/* ── คอลัมน์ 1: สถานะรถเข็น ── */}
        <TableCell align="center" style={{
          ...cellBase, width: '170px', fontWeight: 700,
          borderLeft: `5px solid ${borderLeftColor}`,
          borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px',
          color: getDestColor(row.dest),
        }}>
          {getDestLabel(row.dest)}
        </TableCell>

        {/* รับเข้า (เฉพาะรายการที่ยังรอรับเข้า) */}
        {isPendingRow ? (
          <TableCell onClick={(e) => { e.stopPropagation(); onCheckin?.(row); }} align="center" sx={{
            borderLeft: '1px solid #E3E8F2', borderTop: '1px solid #E3E8F2', borderBottom: '1px solid #E3E8F2',
            height: '36px', padding: 0, cursor: 'pointer', backgroundColor, color: '#E65100', fontSize: '12px', fontWeight: 700,
            '&:hover': { backgroundColor: 'rgba(230,81,0,0.12)' },
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '4px' }}>
              <FaSignInAlt style={{ fontSize: '15px' }} /> รับเข้า
            </Box>
          </TableCell>
        ) : (
          <TableCell align="center" sx={{ ...cellBase, borderLeft: '1px solid #E3E8F2', color: '#B0BAC9' }}>-</TableCell>
        )}

        {/* ส่งออก (เฉพาะรายการที่อยู่ในห้องเย็นแล้ว) */}
        {!isPendingRow ? (
          <TableCell onClick={(e) => { e.stopPropagation(); onCheckout?.(row); }} align="center" sx={{
            borderLeft: '1px solid #E3E8F2', borderTop: '1px solid #E3E8F2', borderBottom: '1px solid #E3E8F2',
            height: '36px', padding: 0, cursor: 'pointer', backgroundColor, color: '#2E7D32', fontSize: '12px', fontWeight: 700,
            '&:hover': { backgroundColor: 'rgba(46,125,50,0.12)' },
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '4px' }}>
              <FaSignOutAlt style={{ fontSize: '15px' }} /> ส่งออก
            </Box>
          </TableCell>
        ) : (
          <TableCell align="center" sx={{ ...cellBase, borderLeft: '1px solid #E3E8F2', color: '#B0BAC9' }}>-</TableCell>
        )}

        {/* ── คอลัมน์ 2: อยู่ในห้องเย็น ── */}
        <TableCell align="center" style={{ ...cellBase, width: '150px', borderLeft: '1px solid #f2f2f2', fontWeight: 700, color: '#0F3FC4' }}>
          {getColdStorageDuration(row)}
        </TableCell>

        {/* ── คอลัมน์ 3: เวลา DCS คงเหลือ ✅ ── */}
        <TableCell align="center" style={{
          ...cellBase, width: '180px', borderLeft: '1px solid #f2f2f2',
          fontWeight: 600, fontSize: noDcs ? '11px' : '12px',
          color: dcsTextColor,
          whiteSpace: noDcs ? 'normal' : 'nowrap',
          lineHeight: noDcs ? '1.3' : undefined,
        }}>
          {noDcs ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
              <span style={{ fontSize: '14px' }}>🌡️</span>
              <span>temp &lt;18 องศา ไม่คำนวณ DCS</span>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
              <HourglassBottomIcon style={{ color: hourglassColor, fontSize: '16px' }} />
              <span>{statusMessage}</span>
            </Box>
          )}
        </TableCell>

        {/* ── คอลัมน์ 4: รายการ (mapping_id) ── */}
        <TableCell align="center" style={{ ...cellBase, width: '80px', borderLeft: '1px solid #f2f2f2', color: '#6B7489' }}>
          {row.mapping_id ?? '-'}
        </TableCell>

        {/* ── คอลัมน์ 5: tro_id พร้อม hourglass ── */}
        <TableCell align="center" style={{ ...cellBase, width: '120px', borderLeft: '1px solid #f2f2f2', color: '#6B7489' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {!noDcs && <HourglassBottomIcon style={{ color: hourglassColor, fontSize: '16px', transition: 'color 0.3s ease' }} />}
            <span>{row.tro_id || '-'}</span>
          </Box>
        </TableCell>

        {/* ── คอลัมน์ที่เหลือ ── */}
        {[
          { id: 'batch',      width: '95px',  value: row.batch },
          { id: 'mat',        width: '95px',  value: row.mat },
          { id: 'mat_name',   width: '200px', value: row.mat_name },
          { id: 'production', width: '130px', value: row.production },
          { id: 'weight_RM',  width: '90px',  value: row.weight_RM },
          { id: 'cs_name',    width: '90px',  value: row.cs_name },
          { id: 'cold_remark',  width: '150px', value: getLatestAtPdColdRemark(row) },
          { id: 'deposit_date', width: '120px', value: formatDepositDate(getLatestAtPdDepositDate(row)) },
        ].map(col => (
          <TableCell key={col.id} align="center" style={{ ...cellBase, width: col.width, borderLeft: '1px solid #f2f2f2', color: '#6B7489' }}>
            {col.value ?? '-'}
          </TableCell>
        ))}

        {/* View Details */}
        <TableCell onClick={handleDetailClick} align="center" sx={{
          borderLeft: '1px solid #E3E8F2', borderTop: '1px solid #E3E8F2', borderBottom: '1px solid #E3E8F2',
          height: '36px', padding: 0, cursor: 'pointer', backgroundColor,
          '&:hover': { backgroundColor: 'rgba(33,150,243,0.15)' },
          '&:hover .vd-icon': { color: '#0D47A1', transform: 'scale(1.2)' },
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#1552F0', p: '8px', transition: 'all 0.2s' }} className="vd-icon">
            <FaEye style={{ fontSize: '18px' }} />
          </Box>
        </TableCell>

        {/* Transfer */}
        {isPendingRow ? <TableCell align="center" sx={{ ...cellBase, borderLeft: '1px solid #E3E8F2', color: '#B0BAC9' }}>-</TableCell> : (
        <TableCell onClick={(e) => { e.stopPropagation(); handleOpenTransferModal?.(row); }} align="center" sx={{
          borderLeft: '1px solid #E3E8F2',
          borderTop: '1px solid #E3E8F2', borderBottom: '1px solid #E3E8F2',
          height: '36px', padding: 0, cursor: 'pointer', backgroundColor,
          '&:hover': { backgroundColor: 'rgba(21,101,192,0.12)' },
          '&:hover .trn-icon': { color: '#0D47A1', transform: 'scale(1.2)' },
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#0F3FC4', p: '8px', transition: 'all 0.2s' }} className="trn-icon">
            <FaExchangeAlt style={{ fontSize: '16px' }} />
          </Box>
        </TableCell>
        )}

        {/* Delete */}
        {isPendingRow ? <TableCell align="center" sx={{ ...cellBase, borderLeft: '1px solid #E3E8F2', borderRight: '1px solid #E3E8F2', color: '#B0BAC9', borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}>-</TableCell> : (
        <TableCell onClick={(e) => { e.stopPropagation(); handleOpenDeleteModal?.(row); }} align="center" sx={{
          borderLeft: '1px solid #E3E8F2', borderRight: '1px solid #E3E8F2',
          borderTop: '1px solid #E3E8F2', borderBottom: '1px solid #E3E8F2',
          height: '36px', padding: 0, cursor: 'pointer', backgroundColor,
          borderTopRightRadius: '8px', borderBottomRightRadius: '8px',
          '&:hover': { backgroundColor: 'rgba(231,74,59,0.15)' },
          '&:hover .del-icon': { color: '#C0392B', transform: 'scale(1.2)' },
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#E5484D', p: '8px', transition: 'all 0.2s' }} className="del-icon">
            <FaTrash style={{ fontSize: '18px' }} />
          </Box>
        </TableCell>
        )}
      </TableRow>
      <TableRow><TableCell style={{ height: '4px', padding: 0, border: 'none' }} /></TableRow>

      {/* ── Collapse ── */}
      <TableRow>
        <TableCell style={{ padding: 0, border: 'none' }} colSpan={20}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{ m: 1, borderRadius: '10px', overflow: 'hidden', border: '1px solid #BBDEFB', boxShadow: '0 2px 8px rgba(33,150,243,0.1)' }}>
              <Box sx={{ background: 'linear-gradient(90deg,#0F3FC4,#1552F0)', p: '10px 16px', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                  🚛 รายละเอียดรถเข็น {row.tro_id}
                </Typography>
                <Box sx={{
                  ml: 'auto', px: 1.5, py: 0.5, borderRadius: '20px',
                  backgroundColor: noDcs ? '#EAF0FF' : delayColor === 'red' ? '#FFEBEE' : delayColor === 'orange' ? '#FFF3E0' : '#E8F5E9',
                  border: `1.5px solid ${noDcs ? '#0F3FC4' : hourglassColor}`,
                }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: noDcs ? '#0F3FC4' : hourglassColor }}>
                    {noDcs ? '🌡️ temp <18 องศา' : `⏱ ${statusMessage}`}
                  </Typography>
                </Box>
              </Box>

              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#EAF0FF' }}>
                    {['Batch','Material','รายชื่อวัตถุดิบ','Level EU','น้ำหนัก','จำนวนถาด','สถานะ'].map(h => (
                      <TableCell key={h} align="center" sx={{ fontSize: '12px', fontWeight: 700, color: '#0F3FC4', borderRight: '1px solid #BBDEFB', py: '6px' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow sx={{ bgcolor: '#fff' }}>
                    {[row.batch, row.mat, row.mat_name, row.level_eu, row.weight_RM, row.tray_count].map((v, i) => (
                      <TableCell key={i} align="center" sx={{ fontSize: '12px', color: '#333', borderRight: '1px solid #EAF0FF', py: '6px' }}>{v || '-'}</TableCell>
                    ))}
                    <TableCell align="center" sx={{
                      fontSize: '12px', fontWeight: 600, py: '6px',
                      color: ['รอกลับมาเตรียม','QcCheck รอ MD'].includes(row.rm_status) ? '#00bcd4'
                           : row.rm_status === 'เหลือจากไลน์ผลิต' ? '#ff9800'
                           : row.rm_status === 'QcCheck' ? '#4caf50'
                           : row.rm_status === 'รอแก้ไข' ? '#f44336' : '#333',
                    }}>{row.rm_status}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <Divider sx={{ borderColor: '#BBDEFB' }} />
              <TimelineSubRow row={row} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

// ─── TransferMappingDialog ─────────────────────────────────────────────────────
const TransferMappingDialog = ({ open, row, onClose, onSuccess }) => {
  const [targetTroId,     setTargetTroId]     = useState('');
  const [transferWeight,  setTransferWeight]  = useState('');
  const [error,           setError]           = useState('');
  const [loading,         setLoading]         = useState(false);

  useEffect(() => {
    if (open) { setTargetTroId(''); setTransferWeight(''); setError(''); }
  }, [open]);

  const handleSubmit = async () => {
    if (!targetTroId.trim()) { setError('กรุณากรอกป้ายทะเบียนปลายทาง'); return; }
    const w = parseFloat(transferWeight);
    if (isNaN(w) || w <= 0) { setError('กรุณากรอกน้ำหนักที่ถูกต้อง (มากกว่า 0)'); return; }
    if (w > parseFloat(row?.weight_RM)) { setError(`น้ำหนักต้องไม่เกิน ${row?.weight_RM} กก.`); return; }
    if (targetTroId.trim() === String(row?.tro_id)) { setError('ป้ายทะเบียนปลายทางต้องไม่ซ้ำกับต้นทาง'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/api/coldstorage/transfer-mapping`, {
        mapping_id: row.mapping_id,
        target_tro_id: targetTroId.trim(),
        transfer_weight: w,
      });
      if (res.data.success) { onSuccess(); onClose(); }
      else setError(res.data.error || 'เกิดข้อผิดพลาด');
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: '15px', fontWeight: 700, color: '#0F3FC4', pb: 0.5 }}>
        🔄 ย้ายวัตถุดิบไปรถเข็นอื่น
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 1.5, fontSize: '13px', py: 0.5 }}>{error}</Alert>}
        <Box sx={{ p: 1, mb: 1.5, backgroundColor: '#F3F6F9', borderRadius: '8px', border: '1px solid #BBDEFB' }}>
          <Typography sx={{ fontSize: '12px', color: '#555' }}>
            ต้นทาง: <strong>{row?.tro_id}</strong> &nbsp;|&nbsp; mapping: <strong>{row?.mapping_id}</strong>
          </Typography>
          <Typography sx={{ fontSize: '12px', color: '#555', mt: 0.5 }}>
            วัตถุดิบ: <strong>{row?.mat_name}</strong>
          </Typography>
          <Typography sx={{ fontSize: '12px', color: '#0F3FC4', mt: 0.5 }}>
            น้ำหนักปัจจุบัน: <strong>{row?.weight_RM} กก.</strong>
          </Typography>
        </Box>
        <TextField
          label="ป้ายทะเบียนปลายทาง" variant="outlined" fullWidth size="small"
          value={targetTroId}
          onChange={e => { setTargetTroId(e.target.value); setError(''); }}
          placeholder="เช่น PF001"
          sx={{ mb: 1.5 }}
        />
        <TextField
          label="น้ำหนักที่ย้าย (กก.)" variant="outlined" fullWidth size="small"
          value={transferWeight}
          onChange={e => { setTransferWeight(e.target.value); setError(''); }}
          inputProps={{ inputMode: 'decimal', pattern: '[0-9]*\\.?[0-9]*' }}
          helperText={`สูงสุด ${row?.weight_RM} กก. — row เดิมจะเหลือ ${row?.weight_RM && transferWeight ? (parseFloat(row.weight_RM) - (parseFloat(transferWeight) || 0)).toFixed(2) : row?.weight_RM} กก.`}
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} variant="outlined" color="error" size="small">ยกเลิก</Button>
        <Button onClick={handleSubmit} disabled={loading} variant="contained" size="small"
          sx={{ backgroundColor: '#0F3FC4', '&:hover': { backgroundColor: '#0D47A1' } }}>
          {loading ? <CircularProgress size={14} color="inherit" /> : 'ยืนยัน'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── FilterButton ─────────────────────────────────────────────────────────────
const FilterButton = ({ color, selectedColor, onClick }) => {
  const [isHovered, setHovered] = useState(false);
  const colors = {
    green:  { default: '#54e032', hover: '#6eff42', selected: '#54e032' },
    yellow: { default: '#f0cb4d', hover: '#ffdf5d', selected: '#f0cb4d' },
    red:    { default: '#ff4444', hover: '#ff6666', selected: '#ff4444' },
  };
  const isSelected   = selectedColor === color;
  const currentColor = colors[color];
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        border: isSelected ? `2px solid ${currentColor.selected}` : `1px solid ${isHovered ? currentColor.hover : '#E3E8F2'}`,
        padding: 6, borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s ease-in-out',
        backgroundColor: isSelected ? 'transparent' : isHovered ? currentColor.hover : currentColor.default,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 40, height: 40, position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
      }}
    >
      {isSelected && <div style={{ position: 'absolute', inset: 0, backgroundColor: currentColor.selected, opacity: 0.2, zIndex: 0 }} />}
      <FaRegCircle style={{ color: '#fff', fontSize: 24, position: 'relative', zIndex: 1, opacity: isSelected ? 1 : 0.9 }} />
    </div>
  );
};

// ─── Export helpers ────────────────────────────────────────────────────────────
const getLatestCsComeColdDate = (row) => {
  const dates = [row.cs_come_cold_date, row.cs_come_cold_date_two, row.cs_come_cold_date_three, row.cs_come_cold_date_four].filter(Boolean);
  if (dates.length === 0) return null;
  return fmtDT(new Date(Math.max(...dates.map(d => new Date(d)))));
};

const EXPORT_HEADERS = [
  'ลำดับ','วันที่ฝาก','ชนิด','แหล่งผลิต','mat','material description','batch',
  'เวลารับของ','จำนวน KG.','หมายเหตุ','วันที่ครบกำหนด','ผู้ส่ง','ผู้รับ','วัตถุประสงค์ (PD)','ห้องเย็น',
  'อยู่ในห้องเย็น','เวลา DCS คงเหลือ',
];
const rowToExportData = (row, index) => [
  index + 1, getLatestCsComeColdDate(row), row.rm_group_name, 'PF',
  row.mat, row.mat_name, row.batch, getLatestCsComeColdDate(row),
  row.weight_RM,
  getLatestAtPdColdRemark(row),
  getLatestAtPdDepositDate(row) ? new Date(getLatestAtPdDepositDate(row)).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' }) : null,
  row.receiver_out_cold, row.rd_section_colds,
  getLatestAtPdStoragePurpose(row),
  row.cs_name,
  getColdStorageDuration(row),
  calculateCSDelayTime(row).statusMessage,
];

const exportToExcel = (rows) => {
  const wsData = [EXPORT_HEADERS, ...rows.map((row, i) => rowToExportData(row, i))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: '1565C0' }, patternType: 'solid' } };
  }
  ws['!cols'] = EXPORT_HEADERS.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ห้องเย็นใหญ่');
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  XLSX.writeFile(wb, `cold_storage_${dateStr}.xlsx`);
};

const exportToPDF = (rows) => {
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const tableRows = rows.map((row, i) =>
    `<tr>${rowToExportData(row, i).map(v => `<td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;white-space:nowrap;">${v ?? '-'}</td>`).join('')}</tr>`
  ).join('');
  const html = `<html><head><meta charset="utf-8">
    <style>
      body{font-family:'Sarabun',Arial,sans-serif;padding:16px;}
      h2{color:#0F3FC4;margin-bottom:4px;font-size:16px;}
      .meta{font-size:11px;color:#666;margin-bottom:12px;}
      table{border-collapse:collapse;width:100%;}
      thead tr{background:#0F3FC4;color:#fff;}
      thead th{padding:6px 8px;font-size:11px;border:1px solid #1552F0;white-space:nowrap;}
      tbody tr:nth-child(even){background:#F5F8FF;}
      @media print{@page{size:A3 landscape;margin:10mm;}}
    </style></head>
    <body>
      <h2>🏭 รายงานข้อมูลห้องเย็นใหญ่ (CS)</h2>
      <div class="meta">พิมพ์เมื่อ: ${now} | จำนวน: ${rows.length} รายการ</div>
      <table><thead><tr>${EXPORT_HEADERS.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${tableRows}</tbody></table>
    </body></html>`;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
};

// ─── Header columns สำหรับ <TableHead> (รวม DCS column ที่ position 3) ────────
// ลำดับ: สถานะรถเข็น | อยู่ในห้องเย็น | เวลา DCS คงเหลือ | รายการ | ป้ายทะเบียน | Batch | Material | รายชื่อ | แผนผลิต | น้ำหนัก | ห้องเย็น | รายละเอียด | ลบ
const HEADER_COLS = [
  { name: 'สถานะรถเข็น',       width: '170px' },
  { name: 'รับเข้า',            width: '80px'  },
  { name: 'ส่งออก',             width: '80px'  },
  { name: 'อยู่ในห้องเย็น',    width: '150px' },
  { name: 'เวลา DCS คงเหลือ',  width: '180px' }, // ✅ คอลัมน์ที่ 3
  { name: 'รายการ',             width: '80px'  }, // ✅ mapping_id
  { name: 'ป้ายทะเบียน',       width: '120px' },
  { name: 'Batch',               width: '95px'  },
  { name: 'Material',            width: '95px'  },
  { name: 'รายชื่อวัตถุดิบ',   width: '200px' },
  { name: 'แผนการผลิต',         width: '130px' },
  { name: 'น้ำหนัก',            width: '90px'  },
  { name: 'ชื่อห้องเย็น',       width: '90px'  },
  { name: 'หมายเหตุ',           width: '150px' },
  { name: 'วันที่ครบกำหนด',     width: '120px' },
];

// ─── Main TableMainprep ──────────────────────────────────────────────────────────
const TableMainprep = ({ handleOpenModal, data, handleRowClick, handleOpenEditModal, handleOpenSuccess, handleOpenDeleteModal, onCheckin, onCheckout }) => {
  const [searchTerm,    setSearchTerm]    = useState('');
  const [filteredRows,  setFilteredRows]  = useState([]);
  const [page,          setPage]          = useState(0);
  const [rowsPerPage,   setRowsPerPage]   = useState(300);
  const [selectedColor, setSelectedColor] = useState('');
  const [openRowId,     setOpenRowId]     = useState(null);
  const [qualityCheckModalOpen, setQualityCheckModalOpen] = useState(false);
  const [selectedRowForQC,      setSelectedRowForQC]      = useState(null);
  const [transferDialogOpen,    setTransferDialogOpen]    = useState(false);
  const [transferRow,           setTransferRow]           = useState(null);
  const [transferSnackbar,      setTransferSnackbar]      = useState(false);
  const [sortField,  setSortField]  = useState('');
  const [sortDir,    setSortDir]    = useState('asc');
  const [exportAnchor, setExportAnchor] = useState(null);

  const colorMap = { green: 'green', yellow: 'orange', red: 'red' };

  const handleOpenQualityCheckModal = (row) => { if (!row) return; setSelectedRowForQC(row); setQualityCheckModalOpen(true); };
  const handleOpenTransferModal     = (row) => { if (!row) return; setTransferRow(row); setTransferDialogOpen(true); };
  const handleSubmitQualityCheck    = async (d) => {
    try { await axios.put(`${API_URL}/api/qc/cold/check`, d); setQualityCheckModalOpen(false); alert('บันทึกข้อมูลสำเร็จ'); }
    catch (e) { alert('เกิดข้อผิดพลาด: ' + e.message); }
  };

  useEffect(() => {
    let rows = Array.isArray(data) ? [...data] : [];
    if (searchTerm)
      rows = rows.filter(r => Object.values(r).some(v => v && v.toString().toLowerCase().includes(searchTerm.toLowerCase())));

    // ✅ filter by color (ไม่นับห้อง noDcs ในการ filter สี)
    if (selectedColor) {
      const targetColor = colorMap[selectedColor];
      rows = rows.filter(r => {
        const { color, noDcs } = calculateCSDelayTime(r);
        return !noDcs && color === targetColor;
      });
    }

    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const getLatest = (row) => {
          const fs = [row.cs_come_cold_date, row.cs_come_cold_date_two, row.cs_come_cold_date_three, row.cs_come_cold_date_four].filter(Boolean);
          return fs.length === 0 ? new Date(0) : new Date(Math.max(...fs.map(d => new Date(d))));
        };
        return sortDir === 'asc' ? getLatest(a) - getLatest(b) : getLatest(b) - getLatest(a);
      });
    }

    setFilteredRows(rows);
    setPage(0);
  }, [searchTerm, data, selectedColor, sortField, sortDir]);

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden', boxShadow: '0 0 3px rgba(0,0,0,0.2)' }}>

      {/* ── Top Bar ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 2, py: '8px' }}>
        <TextField
          variant="outlined" fullWidth placeholder="พิมพ์เพื่อค้นหา..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>, sx: { height: '36px' } }}
          sx={{ flex: 1, minWidth: '180px', '& .MuiOutlinedInput-root': { height: '36px', fontSize: '13px', borderRadius: '8px', color: '#6B7489' }, '& input': { padding: '6px' } }}
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          {['green','yellow','red'].map(color => (
            <FilterButton key={color} color={color} selectedColor={selectedColor}
              onClick={() => setSelectedColor(prev => prev === color ? '' : color)} />
          ))}
        </Box>
        <Button variant="outlined" size="small" startIcon={<FileDownloadIcon />}
          onClick={e => setExportAnchor(e.currentTarget)}
          sx={{ borderRadius: '8px', borderColor: '#0F3FC4', color: '#0F3FC4', whiteSpace: 'nowrap', '&:hover': { borderColor: '#0d47a1', bgcolor: '#EAF0FF' } }}>
          Export
        </Button>
        <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
          <MenuItem onClick={() => { exportToExcel(filteredRows); setExportAnchor(null); }}>📊 Export Excel (.xlsx)</MenuItem>
          <MenuItem onClick={() => { exportToPDF(filteredRows);   setExportAnchor(null); }}>🖨️ Export PDF (พิมพ์)</MenuItem>
        </Menu>
      </Box>

      {/* ── Filter Bar ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 2, pb: '10px', borderBottom: '1px solid #E3E8F2' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>🔃 เรียงตาม:</Typography>
          <button
            onClick={() => { sortField === 'cs_come_cold_date' ? setSortDir(d => d === 'asc' ? 'desc' : 'asc') : (setSortField('cs_come_cold_date'), setSortDir('asc')); }}
            style={{ padding: '3px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', border: sortField ? '2px solid #0F3FC4' : '1px solid #ccc', backgroundColor: sortField ? '#EAF0FF' : '#fff', color: sortField ? '#0F3FC4' : '#555', fontWeight: sortField ? 700 : 400, display: 'flex', alignItems: 'center', gap: '5px' }}>
            เรียงเวลาเข้าห้องเย็นก่อน-หลัง
            {sortField ? (sortDir === 'asc' ? <FaSortAmountUp style={{ fontSize: '10px' }} /> : <FaSortAmountDown style={{ fontSize: '10px' }} />) : <FaSortAmountUp style={{ fontSize: '10px', opacity: 0.35 }} />}
          </button>
          {sortField && <button onClick={() => { setSortField(''); setSortDir('asc'); }} style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '11px', cursor: 'pointer', backgroundColor: '#fff', color: '#494848' }}>ล้าง</button>}
        </Box>
        <Typography sx={{ fontSize: '11px', color: '#494848', ml: 'auto' }}>แสดง {filteredRows.length} รายการ</Typography>
      </Box>

      {/* ── Table ── */}
      <div style={{ padding: '0 10px' }}>
        <TableContainer style={{ padding: '0 5px' }}
          sx={{ height: 'calc(70vh)', overflowY: 'auto', whiteSpace: 'nowrap', '&::-webkit-scrollbar': { width: '8px', height: '8px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#ccc', borderRadius: '4px' } }}>
          <Table stickyHeader style={{ tableLayout: 'fixed' }} sx={{ width: '100%' }}>
            <TableHead>
              <TableRow sx={{ height: '36px' }}>
                {HEADER_COLS.map((col, i) => (
                  <TableCell key={col.name} align="center" style={{
                    backgroundColor: '#1552F0',
                    borderTop: '1px solid #E3E8F2', borderBottom: '1px solid #E3E8F2',
                    borderRight: '1px solid #f2f2f2', padding: '4px', width: col.width,
                    borderTopLeftRadius: i === 0 ? '8px' : 0,
                    borderBottomLeftRadius: i === 0 ? '8px' : 0,
                  }}>
                    <Box style={{ fontSize: '12px', color: '#ffffff' }}>{col.name}</Box>
                  </TableCell>
                ))}
                {['รายละเอียด','ย้าย','ลบ'].map((lbl, i, arr) => (
                  <TableCell key={lbl} align="center" style={{
                    backgroundColor: '#1552F0',
                    borderTop: '1px solid #E3E8F2', borderBottom: '1px solid #E3E8F2',
                    borderLeft: '1px solid #f2f2f2', borderRight: '1px solid #E3E8F2',
                    padding: '4px', width: '80px',
                    borderTopRightRadius: i === arr.length - 1 ? '8px' : 0,
                    borderBottomRightRadius: i === arr.length - 1 ? '8px' : 0,
                  }}>
                    <Box style={{ fontSize: '12px', color: '#ffffff' }}>{lbl}</Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {filteredRows.length > 0
                ? filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, i) => (
                  <Row key={i} row={row} tableColumns={tableColumns}
                    handleOpenModal={handleOpenModal} handleRowClick={handleRowClick}
                    handleOpenEditModal={handleOpenEditModal} handleOpenDeleteModal={handleOpenDeleteModal}
                    handleOpenQualityCheckModal={handleOpenQualityCheckModal}
                    handleOpenTransferModal={handleOpenTransferModal}
                    onCheckin={onCheckin} onCheckout={onCheckout}
                    handleOpenSuccess={handleOpenSuccess}
                    selectedColor={selectedColor}
                    openRowId={openRowId} setOpenRowId={setOpenRowId} index={i} />
                ))
                : <TableRow><TableCell colSpan={HEADER_COLS.length + 3} align="center" sx={{ padding: '20px', fontSize: '14px', color: '#6B7489' }}>ไม่มีรายการวัตถุดิบในขณะนี้</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      <TablePagination
        sx={{ '& .MuiTablePagination-selectLabel,.MuiTablePagination-displayedRows,.MuiTablePagination-toolbar': { fontSize: '12px', color: '#6B7489', padding: 0 } }}
        rowsPerPageOptions={[300, 1000, 5000]} component="div"
        count={filteredRows.length} rowsPerPage={rowsPerPage} page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
      />

      <QualityCheckModal open={qualityCheckModalOpen} handleClose={() => setQualityCheckModalOpen(false)}
        rowData={selectedRowForQC} handleSubmit={handleSubmitQualityCheck} />

      <TransferMappingDialog
        open={transferDialogOpen}
        row={transferRow}
        onClose={() => setTransferDialogOpen(false)}
        onSuccess={() => setTransferSnackbar(true)}
      />

      <Snackbar
        open={transferSnackbar}
        autoHideDuration={4000}
        onClose={() => setTransferSnackbar(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setTransferSnackbar(false)} severity="success" sx={{ width: '100%' }}>
          ย้ายวัตถุดิบสำเร็จ — ข้อมูลจะอัปเดตในไม่ช้า
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default withTableTools(TableMainprep);