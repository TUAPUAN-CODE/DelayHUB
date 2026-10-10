import React, { useState, useEffect, useRef } from 'react';
import { Table, TableContainer, TableHead, TableBody, TableRow, TableCell, Paper, Box, TextField, TablePagination, IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress } from '@mui/material';
import { LiaShoppingCartSolid } from 'react-icons/lia';
import { InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/EditOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { FaRegCircle, FaRegCheckCircle, FaFileExcel, FaWeight } from "react-icons/fa";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { thSarabunBase64 } from "../../../../fonts/thSarabunBase64";
import { thSarabunBoldBase64 } from "../../../../fonts/thSarabunBoldBase64";

import axios from "axios";
axios.defaults.withCredentials = true;
import io from 'socket.io-client';
import withTableTools from "../../../Layout/withTableTools";
const API_URL = import.meta.env.VITE_API_URL;

// ─────────────────────────────────────────────────────────────
// REMAP HELPER
// ─────────────────────────────────────────────────────────────
const buildMappedRow = (row) => {
  const gid = Number(row.rm_group_id);

  if (gid === 55) {
    return {
      _A: row.gm_date,
      _B: row.start_mixed_date,
      _C: row.rmit_date,
      _D: null, _E: null, _D3: null, _E3: null,
      _F: row.sc_pack_date,
    };
  }

  if (gid === 85 || gid === 49 || gid === 82) {
    const colA = (row.out_cold_date && row.out_cold_date !== '-' && row.out_cold_date !== null)
      ? row.out_cold_date
      : (row.rmit_date_mix ?? null);
    return {
      _A: colA,
      _B: row.start_mixed_date,
      _C: row.rmit_date,
      _D: null, _E: null, _D3: null, _E3: null,
      _F: row.sc_pack_date,
    };
  }

  if (gid === 46) {
    return {
      _A: null,
      _B: row.rmit_date,
      _C: null,
      _D: null,
      _E: null,
      _D3: null,
      _E3: null,
      _F: row.sc_pack_date,
    };
  }

  return {
    _A: row.rmit_date,
    _B: row.come_cold_date,
    _C: row.out_cold_date,
    _D: row.come_cold_date_two,
    _E: row.out_cold_date_two,
    _D3: row.come_cold_date_three,
    _E3: row.out_cold_date_three,
    _F: row.sc_pack_date,
  };
};

const getRemappedRow = (row) => { const m = buildMappedRow(row); ROW_OF.set(m, row); return m; };

const isSpecialGroup = (row) => {
  const gid = Number(row.rm_group_id);
  return gid === 55 || gid === 85 || gid === 49 || gid === 46  || gid === 82;
};

// รวม cold storage pairs ทั้ง 6 คู่ → เรียงตามวันที่เข้า
const getSortedColdStoragePairs = (row) => {
  const candidates = [
    { in: row.come_cold_date,           out: row.out_cold_date           },
    { in: row.come_cold_date_two,       out: row.out_cold_date_two       },
    { in: row.come_cold_date_three,     out: row.out_cold_date_three     },
    { in: row.cs_come_cold_date,        out: row.cs_out_cold_date        },
    { in: row.cs_come_cold_date_two,    out: row.cs_out_cold_date_two    },
    { in: row.cs_come_cold_date_three,  out: row.cs_out_cold_date_three  },
  ].filter(p => p.in && p.in !== '-');

  candidates.sort((a, b) => {
    const da = new Date(a.in);
    const db = new Date(b.in);
    if (isNaN(da)) return 1;
    if (isNaN(db)) return -1;
    return da - db;
  });

  while (candidates.length < 6) candidates.push({ in: null, out: null });
  return candidates;
};

// ─────────────────────────────────────────────────────────────
// COLUMN WIDTHS
// ─────────────────────────────────────────────────────────────
const CUSTOM_COLUMN_WIDTHS = {
  delayTime: '180px',
  weight: '120px',
  prepDateTime: '200px',
  confirm: '90px',
  cart: '70px',
  complete: '70px',
  edit: '70px',
  delete: '70px'
};

// ─────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────
const formatDateOnly = (dateTime) => {
  if (!dateTime || dateTime === '-') return '';
  return dateTime.split(' ')[0];
};

const calculateMinutesDifference = (startDate, endDate) => {
  if (!startDate || startDate === '-' || !endDate || endDate === '-') return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const diffInMinutes = (end - start) / (1000 * 60);
  return diffInMinutes >= 0 ? diffInMinutes : null;
};

const formatMinutesToTime = (minutes) => {
  if (minutes === null || minutes === undefined) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  let timeString = '';
  if (hours > 0) timeString += `${hours} h`;
  if (mins > 0) {
    if (timeString) timeString += ' ';
    timeString += `${mins} m`;
  }
  return timeString || '-';
};

// ─────────────────────────────────────────────────────────────
// DATETIME 24H HELPERS
// ─────────────────────────────────────────────────────────────
const splitDateTimeParts = (val) => {
  if (!val || val === '-') return { date: '', hour: '', minute: '' };
  const s = String(val).replace('T', ' ').split('.')[0];
  const parts = s.split(' ');
  if (parts.length < 2) return { date: parts[0] || '', hour: '', minute: '' };
  const timeParts = parts[1].split(':');
  return {
    date: parts[0],
    hour: timeParts[0] || '',
    minute: timeParts[1] || '',
  };
};

const joinDateTimeParts = (date, hour, minute) => {
  if (!date) return null;
  const h = (hour || '00').padStart(2, '0');
  const m = (minute || '00').padStart(2, '0');
  return `${date} ${h}:${m}:00`;
};

// ─────────────────────────────────────────────────────────────
// DBS CALCULATIONS
// ─────────────────────────────────────────────────────────────
const calculateDBS1FromMapped = (mapped, row) => {
  const gid = Number(row.rm_group_id);
  if (gid === 49 || gid === 85 || gid === 46 || gid === 82) return '-';
  return formatMinutesToTime(calculateMinutesDifference(mapped._A, mapped._B));
};

const CS_WAIT_ROUNDS = [
  { come: 'cs_come_cold_date',       out: 'cs_out_cold_date',       p1: 'at_pd_storage_purpose',   p2: 'storage_purpose'   },
  { come: 'cs_come_cold_date_two',   out: 'cs_out_cold_date_two',   p1: 'at_pd_storage_purpose_2', p2: 'storage_purpose_2' },
  { come: 'cs_come_cold_date_three', out: 'cs_out_cold_date_three', p1: 'at_pd_storage_purpose_3', p2: 'storage_purpose_3' },
];
const CS_WAIT_PURPOSE = 'ฝากเก็บเพื่อรอผลิต';

const getCsWaitMinutes = (row) => {
  if (!row) return 0;
  let total = 0;
  CS_WAIT_ROUNDS.forEach(({ come, out, p1, p2 }) => {
    if (row[p1] === CS_WAIT_PURPOSE || row[p2] === CS_WAIT_PURPOSE) {
      const mins = calculateMinutesDifference(row[come], row[out]);
      if (mins !== null) total += mins;
    }
  });
  return total;
};

const calculateDBS2FromMapped = (mapped, isSpecial = false) => {
  if (isSpecial) return '-';
  const min = insideColdMinutes(mapped);
  return min === null ? '-' : formatMinutesToTime(min);
};

const calculateDBS3FromMapped = (mapped, isSpecial = false) => {
  if (isSpecial) return '-';
  const min = calcDBS3Minutes(mapped, false);
  return min === null ? '-' : formatMinutesToTime(min);
};

const calculateDBS4FromMapped = (mapped, isSpecial = false, row = null) => {
  const gid = Number(row?.rm_group_id);

  if (gid === 46) {
    return formatMinutesToTime(calculateMinutesDifference(mapped._B, mapped._F));
  }

  if (isSpecial) {
    const part2 = calculateMinutesDifference(mapped._C, mapped._F);
    if (part2 !== null) return formatMinutesToTime(part2);
    return formatMinutesToTime(calculateMinutesDifference(mapped._A, mapped._F));
  }

  const min1 = calcDBS1Minutes(mapped, row);
  const min3 = calcDBS3Minutes(mapped, isSpecial);

  // ✅ ถ้า DBS1 และ DBS3 ไม่มีค่าทั้งคู่ → ใช้ _A ถึง _F
  if (min1 === null && min3 === null) {
    return formatMinutesToTime(calculateMinutesDifference(mapped._A, mapped._F));
  }

  if (min1 !== null && min3 !== null) return formatMinutesToTime(min1 + min3);
  if (min1 !== null) return formatMinutesToTime(min1);
  if (min3 !== null) return formatMinutesToTime(min3);
  return '-';
};

const calcDBS4Minutes = (mapped, isSpecial, row = null) => {
  const gid = Number(row?.rm_group_id);

  if (gid === 46) {
    return calculateMinutesDifference(mapped._B, mapped._F);
  }

  if (isSpecial) {
    const p2 = calculateMinutesDifference(mapped._C, mapped._F);
    if (p2 !== null) return p2;
    return calculateMinutesDifference(mapped._A, mapped._F);
  }

  const min1 = calcDBS1Minutes(mapped, row);
  const min3 = calcDBS3Minutes(mapped, isSpecial);

  // ✅ ถ้า DBS1 และ DBS3 ไม่มีค่าทั้งคู่ → ใช้ rmit_date (_A) ถึง sc_pack_date (_F)
  if (min1 === null && min3 === null) {
    return calculateMinutesDifference(mapped._A, mapped._F);
  }

  if (min1 !== null && min3 !== null) return min1 + min3;
  if (min1 !== null) return min1;
  if (min3 !== null) return min3;
  return null;
};

const calcDBS1Minutes = (mapped, row) => {
  const gid = Number(row.rm_group_id);
  if (gid === 49 || gid === 85 || gid === 46 || gid === 82) return null;
  return calculateMinutesDifference(mapped._A, mapped._B);
};

const calcDBS2Minutes = (mapped, isSpecial) => {
  if (isSpecial) return null;
  return insideColdMinutes(mapped);
};

// Cold rooms (small + big, up to 7 stays) sorted by time in. DBS2 = the time spent IN them, DBS3 = the time OUTSIDE them after the first exit:
//   DBS2 = (in 1 -> out 1) + (in 2 -> out 2) + ...      DBS3 = (out 1 -> in 2) + (out 2 -> in 3) + ... + (last out -> packed)
// so DBS1 + DBS2 + DBS3 = the whole time from "prep finished" to "packed". A stay that is still open counts up to now only on a live row (mapped._now).
const ROW_OF = new WeakMap(); // mapped row -> the row it was made from
const sortedColdStays = (mapped) => {
  const row = ROW_OF.get(mapped);
  if (!row) return [];
  const pairs = [
    { in: row.come_cold_date, out: row.out_cold_date },
    { in: row.come_cold_date_two, out: row.out_cold_date_two },
    { in: row.come_cold_date_three, out: row.out_cold_date_three },
    { in: row.cs_come_cold_date, out: row.cs_out_cold_date },
    { in: row.cs_come_cold_date_two, out: row.cs_out_cold_date_two },
    { in: row.cs_come_cold_date_three, out: row.cs_out_cold_date_three },
    { in: row.cs_come_cold_date_four, out: row.cs_out_cold_date_four },
  ].filter((p) => p.in && p.in !== '-');
  pairs.sort((a, b) => { const da = new Date(a.in); const db = new Date(b.in); return (isNaN(da) ? 1 : 0) - (isNaN(db) ? 1 : 0) || da - db; });
  return pairs;
};
const insideColdMinutes = (mapped) => {
  let total = 0; let has = false;
  sortedColdStays(mapped).forEach((p) => {
    const out = p.out && p.out !== '-' ? p.out : mapped._now;
    const d = out ? calculateMinutesDifference(p.in, out) : null;
    if (d !== null) { total += d; has = true; }
  });
  return has ? total : null;
};
const outsideColdMinutes = (mapped) => {
  const pairs = sortedColdStays(mapped);
  if (!pairs.length) return null;
  let total = 0; let has = false;
  for (let i = 0; i < pairs.length; i += 1) {
    const out = pairs[i].out;
    if (!out || out === '-') break; // still in a cold room: nothing is counted after it
    const next = i + 1 < pairs.length ? pairs[i + 1].in : mapped._F;
    const gap = calculateMinutesDifference(out, next);
    if (gap !== null) { total += gap; has = true; }
  }
  return has ? total : null;
};

const calcDBS3Minutes = (mapped, isSpecial) => {
  if (isSpecial) return null;
  const min = outsideColdMinutes(mapped);
  return min === null ? null : (min >= 0 ? min : 0);
};

const parseStandardDBSToMinutes = (val) => {
  if (val === null || val === undefined || val === '-' || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n * 60;
};

const calculateDBS1 = (row) => calculateDBS1FromMapped(getRemappedRow(row), row);
const calculateDBS2 = (row) => calculateDBS2FromMapped(getRemappedRow(row), isSpecialGroup(row), row);
const calculateDBS3 = (row) => calculateDBS3FromMapped(getRemappedRow(row), isSpecialGroup(row));
const calculateDBS4 = (row) => calculateDBS4FromMapped(getRemappedRow(row), isSpecialGroup(row), row);

// ─────────────────────────────────────────────────────────────
// STATUS HELPERS
// ─────────────────────────────────────────────────────────────
const formatTime = (minutes) => {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = Math.floor(minutes % 60);
  let timeString = '';
  if (days > 0) timeString += `${days}day`;
  if (hours > 0) timeString += ` ${hours} h`;
  if (mins > 0) timeString += ` ${mins} m`;
  return timeString.trim();
};

const calculateTimeDifference = (dateString) => {
  if (!dateString || dateString === '-') return 0;
  const effectiveDate = new Date(dateString);
  const currentDate = new Date();
  const diffInMinutes = (currentDate - effectiveDate) / (1000 * 60);
  return diffInMinutes > 0 ? diffInMinutes : 0;
};

const parseTimeValue = (timeStr) => {
  if (!timeStr || timeStr === '-') return null;
  const timeParts = timeStr.split('.');
  const hours = parseInt(timeParts[0], 10);
  const minutes = timeParts.length > 1 ? parseInt(timeParts[1], 10) : 0;
  return hours * 60 + minutes;
};

const getLatestColdRoomExitDate = (item) => {
  const mapped = getRemappedRow(item);
  if (mapped._E3 && mapped._E3 !== '-') return mapped._E3;
  if (mapped._E && mapped._E !== '-') return mapped._E;
  if (mapped._C && mapped._C !== '-') return mapped._C;
  return '-';
};

const getItemStatus = (item) => {
  const latestColdRoomExitDate = getLatestColdRoomExitDate(item);
  const mapped = getRemappedRow(item);

  let referenceDate = null;
  let remainingTimeValue = null;
  let standardTimeValue = null;
  const defaultStatus = {
    textColor: "#6B7489",
    statusMessage: "-",
    borderColor: "#969696",
    hideDelayTime: true,
    percentage: 0,
    timeRemaining: 0
  };

  if (!item) return defaultStatus;

  if ((latestColdRoomExitDate !== '-') &&
    (!item.remaining_rework_time || item.remaining_rework_time === '-')) {
    referenceDate = latestColdRoomExitDate;
    remainingTimeValue = parseTimeValue(item.remaining_ctp_time);
    standardTimeValue = parseTimeValue(item.DBS3);
  } else if ((latestColdRoomExitDate === '-') &&
    (!item.remaining_rework_time || item.remaining_rework_time === '-')) {
    referenceDate = mapped._A;
    remainingTimeValue = parseTimeValue(item.remaining_ptp_time);
    standardTimeValue = parseTimeValue(item.DBS4);
  } else if (item.remaining_rework_time && item.remaining_rework_time !== '-') {
    referenceDate = item.qc_date;
    remainingTimeValue = parseTimeValue(item.remaining_rework_time);
    standardTimeValue = parseTimeValue(item.standard_rework_time);
  }

  if (!referenceDate || (!remainingTimeValue && !standardTimeValue)) {
    return defaultStatus;
  }

  const elapsedMinutes = calculateTimeDifference(referenceDate);
  let timeRemaining;
  if (remainingTimeValue !== null) {
    timeRemaining = remainingTimeValue - elapsedMinutes;
  } else if (standardTimeValue !== null) {
    timeRemaining = standardTimeValue - elapsedMinutes;
  } else {
    timeRemaining = 0;
  }

  let percentage = 0;
  if (standardTimeValue) {
    percentage = (elapsedMinutes / standardTimeValue) * 100;
  }

  let statusMessage;
  if (timeRemaining > 0) {
    statusMessage = `เหลืออีก ${formatTime(timeRemaining)}`;
  } else {
    statusMessage = `เลยกำหนด ${formatTime(Math.abs(timeRemaining))}`;
  }

  let textColor, borderColor;
  if (timeRemaining < 0) {
    textColor = "#FF0000"; borderColor = "#FF8175";
  } else if (percentage >= 80) {
    textColor = "#FFA500"; borderColor = "#FFF398";
  } else {
    textColor = "#008000"; borderColor = "#80FF75";
  }

  const isNegative = timeRemaining < 0;
  const absoluteTimeRemaining = Math.abs(timeRemaining);
  const hours = Math.floor(absoluteTimeRemaining / 60);
  const minutes = Math.floor(absoluteTimeRemaining % 60);
  const sign = isNegative ? '-' : '';
  const formattedDelayTime = `${sign}${hours}.${minutes.toString().padStart(2, '0')}`;

  return { textColor, statusMessage, borderColor, hideDelayTime: false, percentage, timeRemaining, formattedDelayTime };
};

// ─────────────────────────────────────────────────────────────
// SHIFT HELPERS
// ─────────────────────────────────────────────────────────────
const parseDateTime = (dateTimeStr) => {
  if (!dateTimeStr || dateTimeStr === '-') return null;
  const str = String(dateTimeStr).replace('T', ' ').split('.')[0];
  const parts = str.split(' ');
  if (parts.length < 2) return null;
  const datePart = parts[0];
  const timePart = parts[1];
  const [h, m] = timePart.split(':').map(Number);
  return { datePart, hours: h, minutes: m, totalMinutes: h * 60 + m };
};

const getShiftFromDate = (dateTimeStr) => {
  const parsed = parseDateTime(dateTimeStr);
  if (!parsed) return null;
  const { totalMinutes } = parsed;
  return (totalMinutes >= 360 && totalMinutes < 1080) ? 'DS' : 'NS';
};

const isInShift = (dateTimeStr, baseDate, shift) => {
  if (!dateTimeStr || dateTimeStr === '-') return false;
  if (!baseDate || !shift) return false;
  const str = String(dateTimeStr).replace('T', ' ').split('.')[0];
  const parts = str.split(' ');
  if (parts.length < 2) return false;
  const datePart = parts[0];
  const timePart = parts[1];
  const [h, m] = timePart.split(':').map(Number);
  const totalMinutes = h * 60 + m;

  if (shift === 'DS') {
    return datePart === baseDate && totalMinutes >= 360 && totalMinutes < 1080;
  } else if (shift === 'NS') {
    const isNightFirstHalf = datePart === baseDate && totalMinutes >= 1080;
    const [y, mo, d] = baseDate.split('-').map(Number);
    const nextDay = new Date(y, mo - 1, d + 1);
    const nextDateStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    const isNightSecondHalf = datePart === nextDateStr && totalMinutes < 360;
    return isNightFirstHalf || isNightSecondHalf;
  }
  return false;
};

// ─────────────────────────────────────────────────────────────
// CUSTOM 24H TIME PICKER
// ─────────────────────────────────────────────────────────────
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const DateTime24Input = ({ value, onChange, isOver, isEdited }) => {
  const { date, hour, minute } = splitDateTimeParts(value);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    onChange(joinDateTimeParts(newDate, hour, minute));
  };

  const handleHourChange = (e) => {
    const newHour = e.target.value;
    onChange(joinDateTimeParts(date, newHour, minute));
  };

  const handleMinuteChange = (e) => {
    const newMinute = e.target.value;
    onChange(joinDateTimeParts(date, hour, newMinute));
  };

  const inputBase = {
    border: '1px solid transparent',
    borderRadius: '4px',
    padding: '3px 4px',
    fontSize: '11px',
    textAlign: 'center',
    backgroundColor: 'transparent',
    outline: 'none',
    cursor: 'pointer',
    color: isOver ? '#C62828' : 'inherit',
    fontWeight: isEdited ? '600' : 'normal',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const selectStyle = {
    ...inputBase,
    width: '50px',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    paddingRight: '4px',
    backgroundImage: 'none',
  };

  return (
    <div
      dir="ltr"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '130px',
      }}
    >
      <input
        type="date"
        value={date}
        onChange={handleDateChange}
        style={{ ...inputBase, width: '120px' }}
        onFocus={(e) => {
          e.target.style.backgroundColor = '#fffef0';
          e.target.style.border = '1px solid #FFC107';
          e.target.style.boxShadow = '0 0 0 2px rgba(255,193,7,0.3)';
        }}
        onBlur={(e) => {
          e.target.style.backgroundColor = 'transparent';
          e.target.style.border = '1px solid transparent';
          e.target.style.boxShadow = 'none';
        }}
      />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        backgroundColor: '#fafafa',
        border: '1px solid #E3E8F2',
        borderRadius: '6px',
        padding: '2px 4px',
      }}>
        <select
          value={hour}
          onChange={handleHourChange}
          style={selectStyle}
          title="ชั่วโมง (00-23)"
        >
          <option value="">--</option>
          {HOURS_24.map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>

        <span style={{
          fontSize: '12px',
          fontWeight: '700',
          color: isOver ? '#C62828' : '#666',
          padding: '0 1px',
        }}>:</span>

        <select
          value={minute}
          onChange={handleMinuteChange}
          style={selectStyle}
          title="นาที (00-59)"
        >
          <option value="">--</option>
          {MINUTES_60.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// SEARCHABLE DROPDOWN
// ─────────────────────────────────────────────────────────────
const SearchableDropdown = ({ label, options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => { onChange(option); setIsOpen(false); setSearchTerm(''); };
  const handleClear = () => { onChange(''); setSearchTerm(''); };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '200px' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', border: value ? '2px solid #1552F0' : '1px solid #E3E8F2',
          borderRadius: '12px', cursor: 'pointer', backgroundColor: '#fff', height: '42px',
          fontSize: '14px', color: value ? '#1552F0' : '#999', transition: 'all 0.3s ease',
          boxShadow: isOpen ? '0 4px 12px rgba(33, 150, 243, 0.15)' : 'none'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: value ? '500' : '400' }}>
          {value || placeholder}
        </span>
        <KeyboardArrowDownIcon style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease', color: value ? '#1552F0' : '#666' }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '48px', left: 0, right: 0, backgroundColor: '#fff',
          border: '1px solid #E3E8F2', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 1000, maxHeight: '320px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          animation: 'slideDown 0.2s ease'
        }}>
          <div style={{ padding: '10px' }}>
            <TextField
              fullWidth size="small" placeholder="ค้นหา..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon style={{ fontSize: '18px', color: '#999' }} /></InputAdornment>,
                sx: { height: '38px', fontSize: '13px', borderRadius: '8px' }
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '270px' }}>
            {value && (
              <div onClick={handleClear}
                style={{ padding: '12px 14px', cursor: 'pointer', fontSize: '13px', color: '#ff4444', borderBottom: '1px solid #f0f0f0', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff3f3'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <ClearIcon style={{ fontSize: '16px' }} /><span>ล้างตัวกรอง</span>
              </div>
            )}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div key={index} onClick={() => handleSelect(option)}
                  style={{
                    padding: '12px 14px', cursor: 'pointer', fontSize: '13px', color: '#333',
                    backgroundColor: value === option ? '#EAF0FF' : 'transparent',
                    borderBottom: index < filteredOptions.length - 1 ? '1px solid #f0f0f0' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => { if (value !== option) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                  onMouseLeave={(e) => { if (value !== option) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {option}
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 14px', fontSize: '13px', color: '#999', textAlign: 'center' }}>ไม่พบข้อมูล</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// SEARCHABLE LINE DROPDOWN
// ─────────────────────────────────────────────────────────────
const SearchableLineDropdown = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', border: value ? '2px solid #1552F0' : '1px solid #ddd',
          borderRadius: '10px', cursor: 'pointer', backgroundColor: '#fff',
          fontSize: '14px', color: value ? '#333' : '#999', transition: 'all 0.3s ease', boxSizing: 'border-box'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '-- เลือก Line --'}</span>
        <KeyboardArrowDownIcon style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease', color: value ? '#1552F0' : '#666', fontSize: '20px' }} />
      </div>
      {isOpen && (
        <div style={{
          position: 'absolute', top: '48px', left: 0, right: 0, backgroundColor: '#fff',
          border: '1px solid #E3E8F2', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 1000, maxHeight: '300px', overflow: 'hidden', display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ padding: '10px' }}>
            <input
              type="text" placeholder="ค้นหา Line..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => { e.target.style.border = '2px solid #1552F0'; }}
              onBlur={(e) => { e.target.style.border = '1px solid #ddd'; }}
            />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '240px' }}>
            {value && (
              <div onClick={() => { onChange(''); setIsOpen(false); setSearchTerm(''); }}
                style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', color: '#ff4444', borderBottom: '1px solid #f0f0f0', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff3f3'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <ClearIcon style={{ fontSize: '16px' }} /><span>ล้างตัวเลือก</span>
              </div>
            )}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div key={index}
                  onClick={() => { onChange(option); setIsOpen(false); setSearchTerm(''); }}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', fontSize: '13px', color: '#333',
                    backgroundColor: value === option ? '#EAF0FF' : 'transparent',
                    borderBottom: index < filteredOptions.length - 1 ? '1px solid #f0f0f0' : 'none', transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => { if (value !== option) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                  onMouseLeave={(e) => { if (value !== option) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {option}
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 14px', fontSize: '13px', color: '#999', textAlign: 'center' }}>ไม่พบข้อมูล</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ROW COMPONENT
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// TraceBackModal — แสดงข้อมูล Trace Back (WC + PrintMasterSlip)
// ─────────────────────────────────────────────────────────────
const IngredientModal = ({ open, onClose, idIgd, idIgdNo, data, loading, error, slipData, slipLoading, slipError }) => {
  const woInfo = data && data.length > 0 ? data[0] : null;

  const slipFields = slipData ? [
    { label: 'Slip ID',       value: slipData.slip_id },
    { label: 'Type',          value: slipData.type_choice },
    { label: 'วันที่ส่ง',    value: slipData.send_date ? String(slipData.send_date).slice(0,10) : '-' },
    { label: 'ลำดับการใช้',  value: slipData.seq_use },
    { label: 'Line',          value: slipData.line_name },
    { label: 'Code Mat',      value: slipData.code_mat },
    { label: 'Batch No',      value: slipData.batch_no },
    { label: 'วันที่รับเข้า', value: slipData.receive_date ? String(slipData.receive_date).slice(0,10) : '-' },
    { label: 'วันที่ผลิต',   value: slipData.produce_date ? String(slipData.produce_date).slice(0,10) : '-' },
    { label: 'Box No',        value: slipData.box_no },
    { label: 'LOT',           value: slipData.lot },
    { label: 'Roll No',       value: slipData.roll_no },
    { label: 'HU',            value: slipData.hu },
    { label: 'Size',          value: slipData.size },
    { label: 'TE',            value: slipData.te },
    { label: 'จำนวน',        value: slipData.qty },
    { label: 'หมายเหตุ',     value: slipData.remark },
  ] : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth
      PaperProps={{ sx: { borderRadius: '16px', maxHeight: '90vh' } }}>
      <DialogTitle sx={{
        background: 'linear-gradient(135deg, #0F3FC4 0%, #1552F0 100%)',
        color: '#fff', fontSize: '18px', fontWeight: '600', padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span>Trace Back — WO: {idIgd || '-'}{idIgdNo != null ? ` / Basket: ${idIgdNo}` : ''}</span>
        {woInfo && (
          <span style={{ fontSize: '13px', fontWeight: '400', opacity: 0.85 }}>
            {woInfo.ProductCode} | {woInfo.packLine} | {woInfo.Shift}
          </span>
        )}
      </DialogTitle>

      <DialogContent sx={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* ── PrintMasterSlip Section ── */}
        <Box>
          <Box sx={{ fontSize: '14px', fontWeight: '700', color: '#0F3FC4', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            📦 ข้อมูลบรรจุภัณฑ์ (PrintMasterSlip)
          </Box>
          {slipLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#666', fontSize: '13px' }}>
              <CircularProgress size={16} sx={{ color: '#1552F0' }} /> กำลังโหลด...
            </Box>
          )}
          {!slipLoading && slipError && (
            <Box sx={{ color: '#c62828', fontSize: '13px' }}>{slipError}</Box>
          )}
          {!slipLoading && !slipError && slipData && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, p: 2, backgroundColor: '#F3F8FF', borderRadius: '10px', fontSize: '13px' }}>
              {slipFields.map(({ label, value }) => (
                <Box key={label} sx={{ display: 'flex', gap: 0.5 }}>
                  <span style={{ color: '#0F3FC4', fontWeight: '600' }}>{label}:</span>
                  <span style={{ color: '#333' }}>{value ?? '-'}</span>
                </Box>
              ))}
            </Box>
          )}
          {!slipLoading && !slipError && !slipData && (
            <Box sx={{ color: '#90A4AE', fontSize: '13px' }}>ไม่มีข้อมูล Package (mat_pkg ว่าง)</Box>
          )}
        </Box>

        {/* ── WC Ingredient Section ── */}
        <Box>
          <Box sx={{ fontSize: '14px', fontWeight: '700', color: '#0F3FC4', mb: 1.5 }}>
            🧪 ข้อมูล Ingredient จาก WC Database
          </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress size={32} sx={{ color: '#1552F0' }} />
            <span style={{ color: '#666', fontSize: '14px' }}>กำลังโหลดข้อมูล...</span>
          </Box>
        )}

        {!loading && error && (
          <Box sx={{ textAlign: 'center', py: 4, color: '#c62828', fontSize: '14px' }}>
            {error}
          </Box>
        )}

        {!loading && !error && data && data.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4, color: '#90A4AE', fontSize: '14px' }}>
            ไม่พบข้อมูล Trace Back สำหรับ WO นี้
          </Box>
        )}

        {!loading && !error && data && data.length > 0 && (
          <>
            {/* WO Info */}
            <Box sx={{
              display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3,
              p: 2, backgroundColor: '#EAF0FF', borderRadius: '10px', fontSize: '13px'
            }}>
              {[
                { label: 'WO No', value: woInfo.WONo },
                { label: 'วันที่', value: woInfo.Date ? String(woInfo.Date).slice(0, 10) : '-' },
                { label: 'Shift', value: woInfo.Shift },
                { label: 'Product Code', value: woInfo.ProductCode },
                { label: 'WO Batch', value: woInfo.WOBatchNo },
                { label: 'Pack Line', value: woInfo.packLine },
                { label: 'State', value: woInfo.state },
              ].map(({ label, value }) => (
                <Box key={label} sx={{ display: 'flex', gap: 1 }}>
                  <span style={{ color: '#0F3FC4', fontWeight: '600' }}>{label}:</span>
                  <span style={{ color: '#333' }}>{value ?? '-'}</span>
                </Box>
              ))}
            </Box>

            {/* Ingredients Table */}
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1552F0', color: '#fff' }}>
                    {[
                      '#', 'WO No', 'Basket', 'Material Code', 'Material Name', 'Short Name',
                      'Ingredient Batch', 'Std Wt', 'Min Wt', 'Max Wt', 'Net Wt',
                      'Percentage', 'Mixing Time', 'Mixing End Time'
                    ].map((h, i) => (
                      <th key={i} style={{
                        padding: '10px 12px', textAlign: i > 5 ? 'right' : 'left',
                        fontWeight: '600', whiteSpace: 'nowrap',
                        borderBottom: '2px solid #0F3FC4'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#F5F9FF' }}>
                                            <td style={{ padding: '9px 12px', color: '#999', borderBottom: '1px solid #EAF0FF' }}>{idx + 1}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #EAF0FF', fontWeight: '600', color: '#0F3FC4' }}>{row.WONo ?? '-'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #EAF0FF', fontWeight: '600', color: '#0F3FC4' }}>{row.BasketNumber ?? '-'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #EAF0FF', whiteSpace: 'nowrap' }}>{row.MaterialCode ?? '-'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #EAF0FF' }}>{row.MaterialName ?? '-'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #EAF0FF', color: '#555' }}>{row.MaterialShortName ?? '-'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #EAF0FF' }}>{row.IngredientBatchNo ?? '-'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #EAF0FF', textAlign: 'right' }}>{row.StdWt != null ? Number(row.StdWt).toFixed(3) : '-'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #EAF0FF', textAlign: 'right', color: '#1552F0' }}>{row.MinWt != null ? Number(row.MinWt).toFixed(3) : '-'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #EAF0FF', textAlign: 'right', color: '#1552F0' }}>{row.MaxWt != null ? Number(row.MaxWt).toFixed(3) : '-'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #EAF0FF', textAlign: 'right', fontWeight: '600' }}>{row.NetWt != null ? Number(row.NetWt).toFixed(3) : '-'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #EAF0FF', textAlign: 'right' }}>{row.Percentage != null ? `${Number(row.Percentage).toFixed(2)}%` : '-'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #EAF0FF', whiteSpace: 'nowrap', color: '#555' }}>{row.MixingTime ?? '-'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #EAF0FF', whiteSpace: 'nowrap', color: '#555' }}>{row.MixingEndTime ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>

            <Box sx={{ mt: 2, fontSize: '12px', color: '#90A4AE', textAlign: 'right' }}>
              {data.length} รายการ
            </Box>
          </>
        )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ padding: '12px 24px' }}>
        <Button onClick={onClose}
          sx={{ borderRadius: '8px', textTransform: 'none', color: '#666', '&:hover': { backgroundColor: '#F5F8FF' } }}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const Row = ({
  row, columnWidths, handleOpenModal, handleRowClick, handleOpenEditModal,
  handleOpenDeleteModal, handleOpenEditLineModal, handleOpenSuccess,
  handleConfirmRow, selectedColor, openRowId, setOpenRowId, index, displayColumns,
  handleOpenIngredientModal
}) => {
  const { borderColor, statusMessage, hideDelayTime, percentage, formattedDelayTime } = getItemStatus(row);
  const backgroundColor = index % 2 === 0 ? '#ffffff' : '#F0F8FF';

  const mapped = getRemappedRow(row);
  const special = isSpecialGroup(row);

  const stdDBS1 = parseStandardDBSToMinutes(row.DBS1 ?? row.dbs1);
  const stdDBS2 = parseStandardDBSToMinutes(row.DBS2 ?? row.dbs2);
  const stdDBS3 = parseStandardDBSToMinutes(row.DBS3 ?? row.dbs3);
  const stdDBS4 = parseStandardDBSToMinutes(row.DBS4 ?? row.dbs4);

  const calcMin1 = calcDBS1Minutes(mapped, row);
  const calcMin2 = calcDBS2Minutes(mapped, special, row);
  const calcMin3 = calcDBS3Minutes(mapped, special);
  const calcMin4 = calcDBS4Minutes(mapped, special, row);

  const isOver1 = stdDBS1 !== null && calcMin1 !== null && calcMin1 > stdDBS1;
  const isOver2 = !special && stdDBS2 !== null && calcMin2 !== null && calcMin2 > stdDBS2;
  const isOver3 = !special && stdDBS3 !== null && calcMin3 !== null && calcMin3 > stdDBS3;
  const isOver4 = stdDBS4 !== null && calcMin4 !== null && calcMin4 > stdDBS4;

  const overFlags = {};
  const displayRow = {};
  const sortedColdPairs = getSortedColdStoragePairs(row);

  displayColumns.forEach(col => {
    switch (col) {
      case 'tro_id':
        displayRow[col] = row.tro_id;
        break;
      case 'mapping_id':
        displayRow[col] = row.mapping_id;
        break;
      case 'withdraw_date':
        displayRow[col] = row.withdraw_date;
        break;
      case 'dbs1':
        displayRow[col] = calculateDBS1FromMapped(mapped, row);
        overFlags[col] = isOver1;
        break;
      case 'dbs2':
        displayRow[col] = calculateDBS2FromMapped(mapped, special, row);
        overFlags[col] = isOver2;
        break;
      case 'dbs3':
        displayRow[col] = calculateDBS3FromMapped(mapped, special);
        overFlags[col] = isOver3;
        break;
      case 'dbs4':
        displayRow[col] = calculateDBS4FromMapped(mapped, special, row);
        overFlags[col] = isOver4;
        break;
      case 'rmit_date':
        displayRow[col] = mapped._A ?? '-';
        break;
      case 'cold_slot_1_in':  displayRow[col] = sortedColdPairs[0]?.in  ?? '-'; break;
      case 'cold_slot_1_out': displayRow[col] = sortedColdPairs[0]?.out ?? '-'; break;
      case 'cold_slot_2_in':  displayRow[col] = sortedColdPairs[1]?.in  ?? '-'; break;
      case 'cold_slot_2_out': displayRow[col] = sortedColdPairs[1]?.out ?? '-'; break;
      case 'cold_slot_3_in':  displayRow[col] = sortedColdPairs[2]?.in  ?? '-'; break;
      case 'cold_slot_3_out': displayRow[col] = sortedColdPairs[2]?.out ?? '-'; break;
      case 'cold_slot_4_in':  displayRow[col] = sortedColdPairs[3]?.in  ?? '-'; break;
      case 'cold_slot_4_out': displayRow[col] = sortedColdPairs[3]?.out ?? '-'; break;
      case 'cold_slot_5_in':  displayRow[col] = sortedColdPairs[4]?.in  ?? '-'; break;
      case 'cold_slot_5_out': displayRow[col] = sortedColdPairs[4]?.out ?? '-'; break;
      case 'cold_slot_6_in':  displayRow[col] = sortedColdPairs[5]?.in  ?? '-'; break;
      case 'cold_slot_6_out': displayRow[col] = sortedColdPairs[5]?.out ?? '-'; break;
      case 'sc_pack_date':
        displayRow[col] = mapped._F ?? '-';
        break;
      case 'remark_dalay':
        displayRow[col] = row.remark_dalay ?? '-';
        break;
      default: {
        const value = row[col];
        if (typeof value === 'boolean') {
          displayRow[col] = value ? 'ผ่าน' : 'ไม่ผ่าน';
        } else if (value === null || value === undefined || value === '') {
          displayRow[col] = '-';
        } else {
          displayRow[col] = value;
        }
      }
    }
  });

  const colorMatch =
    (selectedColor === 'green' && borderColor === '#80FF75') ||
    (selectedColor === 'yellow' && borderColor === '#FFF398') ||
    (selectedColor === 'red' && borderColor === '#FF8175') ||
    (selectedColor === 'gray' && borderColor === '#969696');

  if (selectedColor && !colorMatch) return null;

  const isOpen = openRowId === row.rmfp_id;

  return (
    <>
      <TableRow>
        <TableCell style={{ height: "7px", padding: "0px", border: "0px solid" }}></TableCell>
      </TableRow>
      <TableRow
        onClick={() => { setOpenRowId(isOpen ? null : row.rmfp_id); handleRowClick && handleRowClick(row.rmfp_id); }}
        style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
        onMouseEnter={(e) => {
          const cells = e.currentTarget.querySelectorAll('td');
          cells.forEach(cell => {
            if (!cell.dataset.isover) {
              cell.style.backgroundColor = index % 2 === 0 ? '#F5F9FF' : '#E8F4FF';
            }
          });
        }}
        onMouseLeave={(e) => {
          const cells = e.currentTarget.querySelectorAll('td');
          cells.forEach(cell => {
            if (!cell.dataset.isover) {
              cell.style.backgroundColor = backgroundColor;
            }
          });
        }}
      >
        {Object.entries(displayRow).map(([key, value], idx) => {
          const isOver = overFlags[key] === true;
          const isRemark = key === 'remark_dalay';
          return (
            <TableCell
              key={idx}
              align={isRemark ? 'left' : 'center'}
              data-isover={isOver ? 'true' : undefined}
              style={{
                width: columnWidths[idx],
                borderLeft: "1px solid #EAF0FF",
                borderTop: isOver ? '1px solid #FFCDD2' : '1px solid #EAF0FF',
                borderBottom: isOver ? '1px solid #FFCDD2' : '1px solid #EAF0FF',
                whiteSpace: isRemark ? 'normal' : 'normal',
                wordWrap: 'break-word',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontSize: '14px',
                height: '48px',
                lineHeight: '1.5',
                padding: '0px 12px',
                backgroundColor: isOver ? '#FFF5F5' : backgroundColor,
                color: isOver ? '#C62828' : '#353535ff',
                fontWeight: isOver ? '700' : 'normal',
                transition: 'background-color 0.2s ease'
              }}
            >
              {isOver ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '17px', height: '17px', borderRadius: '50%',
                    backgroundColor: '#D32F2F', color: '#fff',
                    fontSize: '11px', fontWeight: '900', flexShrink: 0,
                    boxShadow: '0 1px 3px rgba(211,47,47,0.4)'
                  }}>!</span>
                  {value || '-'}
                </span>
              ) : (value || '-')}
            </TableCell>
          );
        })}

        {/* Ingredient button */}
        <TableCell
          align="center"
          onClick={(e) => { e.stopPropagation(); handleOpenIngredientModal?.(row); }}
          style={{
            width: '100px',
            borderLeft: '1px solid #EAF0FF',
            borderTop: '1px solid #EAF0FF',
            borderBottom: '1px solid #EAF0FF',
            borderRight: '1px solid #EAF0FF',
            height: '48px',
            padding: '0px 8px',
            backgroundColor,
            cursor: 'pointer',
            transition: 'background-color 0.2s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EAF0FF'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = backgroundColor; }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '4px 8px', borderRadius: '6px',
            backgroundColor: row.id_igd ? '#1552F0' : '#B0BEC5',
            color: '#fff',
            fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap'
          }}>
            🔍 Trace Back
          </span>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ padding: "0px", border: "0px solid" }}></TableCell>
      </TableRow>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// EDITABLE FIELDS
// ─────────────────────────────────────────────────────────────
const EDITABLE_DATE_FIELDS = [
  'rmit_date',
  'come_cold_date',
  'out_cold_date',
  'come_cold_date_two',
  'out_cold_date_two',
  'come_cold_date_three',
  'out_cold_date_three',
  'sc_pack_date',
];

// ─────────────────────────────────────────────────────────────
// MAIN TABLE COMPONENT
// ─────────────────────────────────────────────────────────────
const TableMainPrep = ({
  handleOpenModal, data, handleRowClick, handleOpenEditModal,
  handleOpenDeleteModal, handleOpenEditLineModal, handleOpenSuccess, onConfirmRow,
  // ✅ props ใหม่
  filterOptions = { lines: [], docNos: [], scPackDates: [], matNames: [] },
  filterOptionsLoading = false,
  onSearch,
  hasFetched = false,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRows, setFilteredRows] = useState(data);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [selectedColor, setSelectedColor] = useState('');
  const [openRowId, setOpenRowId] = useState(null);
  const [selectedLineName, setSelectedLineName] = useState('');
  const [selectedDocNo, setSelectedDocNo] = useState('');
  const [selectedMatName, setSelectedMatName] = useState('');
  const [selectedSCPackDate, setselectedSCPackDate] = useState('');
  const [exportLine, setExportLine] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [dbQuery, setDbQuery] = useState('');
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [signatureData, setSignatureData] = useState({ recordedBy: '', reviewedBy: '', qcManager: '' });
  const [exportDate, setExportDate] = useState('');
  const [exportShift, setExportShift] = useState('');
  const [exportPlant, setExportPlant] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [editedCells, setEditedCells] = useState({});
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const [saveEditsError, setSaveEditsError] = useState('');
  const [saveEditsSuccess, setSaveEditsSuccess] = useState('');

  // Trace Back modal states
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [ingredientIdIgd, setIngredientIdIgd] = useState('');
  const [ingredientIdIgdNo, setIngredientIdIgdNo] = useState(null);
  const [ingredientData, setIngredientData] = useState([]);
  const [ingredientLoading, setIngredientLoading] = useState(false);
  const [ingredientError, setIngredientError] = useState('');
  const [traceBackSlipData, setTraceBackSlipData] = useState(null);
  const [traceBackSlipLoading, setTraceBackSlipLoading] = useState(false);
  const [traceBackSlipError, setTraceBackSlipError] = useState('');

  // ✅ เพิ่ม remark_dalay เป็นคอลัมน์สุดท้าย
  const displayColumns = [
    'mapping_id', 'withdraw_date','production', 'mat_name', 'batch_after', 'group_no', 'weight_RM', 'detail',
    'color', 'odor', 'texture',
    'rmit_date',
    'cold_slot_1_in', 'cold_slot_1_out',
    'cold_slot_2_in', 'cold_slot_2_out',
    'cold_slot_3_in', 'cold_slot_3_out',
    'cold_slot_4_in', 'cold_slot_4_out',
    'cold_slot_5_in', 'cold_slot_5_out',
    'cold_slot_6_in', 'cold_slot_6_out',
    'sc_pack_date',
    'dbs1', 'dbs2', 'dbs3', 'dbs4',
    'remark_dalay'
  ];

  // ✅ ใช้ filterOptions จาก props แทนการคำนวณจาก data
  const uniqueLineNames = filterOptions.lines || [];
  const uniqueMatName = filterOptions.matNames || [];
  const uniqueDocNos = filterOptions.docNos || [];
  const uniqueSCPackDate = filterOptions.scPackDates || [];
  const lineOptions = filterOptions.lines || [];

  const totalWeight = filteredRows.reduce((sum, row) => {
    const weight = parseFloat(row.weight_RM) || 0;
    return sum + weight;
  }, 0);

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
    } catch {
      return dateTimeStr;
    }
  };

  // ✅ อัปเดต filteredRows เมื่อ data เปลี่ยน — กรอง local เฉพาะ searchTerm เท่านั้น
  useEffect(() => {
    let filtered = data;
    if (searchTerm) {
      filtered = filtered.filter((row) =>
        Object.values(row).some((value) =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    setFilteredRows(filtered);
    setPage(0);
  }, [searchTerm, data]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };
  const handleFilterChange = (color) => setSelectedColor(color === selectedColor ? '' : color);

  // ✅ ปุ่ม "ค้นหา" — เรียก onSearch เพื่อให้ parent ไปดึงข้อมูล
  const handleSearch = () => {
    if (onSearch) {
      onSearch({
        lineName: selectedLineName,
        docNo: selectedDocNo,
        scPackDate: selectedSCPackDate,
        matName: selectedMatName,
        shift: selectedShift,
        q: dbQuery.trim(),
      });
    }
  };

  // ✅ ปุ่ม "ล้างค่า"
  const handleClearFilters = () => {
    setDbQuery('');
    setSelectedLineName('');
    setSelectedDocNo('');
    setselectedSCPackDate('');
    setSelectedMatName('');
    setSelectedShift('');
    setSearchTerm('');
  };

  const handleOpenPDFPreview = () => {
    const pageRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    setPreviewData(pageRows.map(row => ({ ...row })));
    setSignatureData({ recordedBy: '', reviewedBy: '', qcManager: '' });
    const now = new Date();
    setExportDate(now.toISOString().split('T')[0]);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    setExportShift((currentMinutes >= 360 && currentMinutes < 1080) ? 'DS' : 'NS');
    setExportPlant('');
    setExportLine(selectedLineName || '');
    setEditedCells({});
    setSaveEditsError('');
    setSaveEditsSuccess('');
    setShowPDFPreview(true);
  };

  const saveEditedRows = async () => {
    const changedRows = previewData
      .map((row, rowIdx) => {
        const changedFields = {};
        EDITABLE_DATE_FIELDS.forEach(field => {
          const key = `${rowIdx}_${field}`;
          if (editedCells[key]) {
            changedFields[field] = row[field] ?? null;
          }
        });
        if (Object.keys(changedFields).length === 0) return null;
        return { mapping_id: row.mapping_id, ...changedFields };
      })
      .filter(Boolean);

    if (changedRows.length === 0) {
      setSaveEditsError('ไม่มีข้อมูลที่แก้ไข');
      return;
    }

    setIsSavingEdits(true);
    setSaveEditsError('');
    setSaveEditsSuccess('');
    try {
      const response = await fetch(`${API_URL}/api/pack/data/time`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows: changedRows }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`บันทึกไม่สำเร็จ: ${response.status} - ${errText}`);
      }
      await response.json();
      setSaveEditsSuccess(`บันทึกสำเร็จ ${changedRows.length} แถว`);
      setEditedCells({});
    } catch (err) {
      setSaveEditsError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSavingEdits(false);
    }
  };

  const saveSignatureToAPI = async (sigData, dataRows) => {
    const mappingIds = dataRows.map(row => row.mapping_id).filter(id => id !== null && id !== undefined);
    const pdfBlob = await generatePDFBlob(previewData, signatureData);
    const formData = new FormData();
    formData.append('pdf', pdfBlob, 'report.pdf');
    formData.append('recorded_by', sigData.recordedBy || '');
    formData.append('reviewed_by', sigData.reviewedBy || '');
    formData.append('qc_manager', sigData.qcManager || '');
    formData.append('date', exportDate || '');
    formData.append('shift', exportShift || '');
    formData.append('line', exportLine || '');
    formData.append('plant', exportPlant || '');
    formData.append('mapping_ids', JSON.stringify(mappingIds));
    const response = await fetch(`${API_URL}/api/pack/data/pdf`, { method: 'POST', body: formData });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`บันทึกไม่สำเร็จ: ${response.status} - ${errText}`);
    }
    return await response.json();
  };

  const generatePDFBlob = async (dataRows, sigData = {}) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 5;

    doc.addFileToVFS('Sarabun-Regular.ttf', thSarabunBase64);
    doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
    doc.addFileToVFS('Sarabun-Bold.ttf', thSarabunBoldBase64);
    doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
    doc.setFont('Sarabun', 'normal');
    doc.setLineWidth(0.03);

    const drawRect = (x, y, w, h) => { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.1); doc.rect(x, y, w, h); };
    const fillRect = (x, y, w, h, rgb) => { doc.setFillColor(...rgb); doc.rect(x, y, w, h, 'F'); };
    const drawText = (text, x, y, opts = {}) => {
      const { fontSize = 7, align = 'center', bold = false, color = [0, 0, 0] } = opts;
      doc.setFontSize(fontSize);
      doc.setFont('THSarabunNew', bold ? 'bold' : 'normal');
      doc.setTextColor(...color);
      doc.text(String(text ?? ''), x, y, { align });
      doc.setLineWidth(0.1);
    };
    const drawCell = (text, x, y, w, h, opts = {}) => {
      const { fill, fontSize = 7, bold = false, align = 'center' } = opts;
      if (fill) fillRect(x, y, w, h, fill);
      drawRect(x, y, w, h);
      const lines = String(text ?? '').split('\n');
      const lineH = fontSize * 0.42;
      const totalH = lines.length * lineH;
      const startY = y + (h - totalH) / 2 + lineH * 0.5;
      lines.forEach((line, i) => {
        const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 1.5 : x + 1.5;
        drawText(line, tx, startY + i * lineH, { fontSize, bold, align });
      });
    };

    drawText('บริษัท ไอ-เทล คอร์ปอเรชั่น จำกัด (มหาชน)', pageW / 2, 9, { fontSize: 10, bold: true, align: 'center' });
    drawText('รายงานควบคุมเวลากระบวนการผลิต โรงผลิตอาหารสัตว์เลี้ยง (Delay Time for Production Control Report)', pageW / 2, 15, { fontSize: 8, align: 'center' });
    drawText('F3PFPF67-2-19/06/26', pageW - margin, 9, { fontSize: 6, align: 'right' });

    const infoY = 20;
    const infoItems = [
      { label: 'Date:', value: exportDate, width: 35 },
      { label: 'Shift:', value: exportShift, width: 20 },
      { label: 'Line:', value: exportLine, width: 25 },
      { label: 'Plant:', value: exportPlant, width: 25 },
    ];
    let infoX = margin;
    infoItems.forEach(({ label, value, width }) => {
      drawText(label, infoX, infoY, { fontSize: 7, align: 'left', bold: true });
      const labelWidth = doc.getTextWidth(label);
      const lineStartX = infoX + labelWidth + 1;
      const lineEndX = lineStartX + width;
      doc.setDrawColor(0, 0, 0);
      doc.line(lineStartX, infoY + 1, lineEndX, infoY + 1);
      if (value) drawText(value, lineStartX + width / 2, infoY - 0.5, { fontSize: 7, align: 'center', color: [33, 150, 243] });
      infoX = lineEndX + 4;
    });
    drawText('Page:....../ .......', pageW - margin, infoY, { fontSize: 7, align: 'right' });

    const tX = margin; const tY = 24; const tW = pageW - margin * 2;
    const colCode = 14; const colRM = 30; const colBatch = 18; const batchCols = 10;
    const batchCellW = colBatch / batchCols; const colWeight = 13; const colGrpNo = 11;
    const colDate = 15; const colHist = 15; const sensoryCellW = 9; const colSensory = sensoryCellW * 3;
    const colPrepA = 13; const colCold1 = 13; const colColdOut1 = 13;
    const colCold2 = 13; const colColdOut2 = 13; const colPacked = 13;
    const colDBS1 = 10; const colDBS2 = 10; const colDBS3 = 10; const colDBS4 = 10;
    const colRemark = tW - colCode - colRM - colBatch - colWeight - colGrpNo
      - colDate - colHist - colSensory
      - colPrepA - colCold1 - colColdOut1
      - colCold2 - colColdOut2 - colPacked
      - colDBS1 - colDBS2 - colDBS3 - colDBS4;
    const h1 = 7; const h2 = 14; const headerH = h1 + h2;
    const hFill = [210, 228, 255];
    const minRows = 17;
    const bottomReserved = 75;
    const availableH = pageH - (tY + headerH) - bottomReserved;
    const rowH = Math.floor((availableH / minRows) * 10) / 10;

    let cx = tX; const cy = tY;
    drawCell('โค้ด\n(Product\nCode)', cx, cy, colCode, headerH, { fill: hFill, bold: true, fontSize: 10 }); cx += colCode;
    drawCell('วัตถุดิบ\n(Raw Mat.)', cx, cy, colRM, headerH, { fill: hFill, bold: true, fontSize: 7 }); cx += colRM;
    fillRect(cx, cy, colBatch, h1, hFill); drawRect(cx, cy, colBatch, h1);
    drawText('Batch', cx + colBatch / 2, cy + h1 / 2 + 2.5, { fontSize: 7, bold: true });
    for (let i = 0; i < batchCols; i++) drawCell('', cx + i * batchCellW, cy + h1, batchCellW, h2, { fill: hFill, fontSize: 6 });
    cx += colBatch;
    drawCell('น้ำหนัก\n(nn.)\nWeight\n(kgs.)', cx, cy, colWeight, headerH, { fill: hFill, bold: true, fontSize: 6 }); cx += colWeight;
    drawCell('ชุดที่\n(Batch)', cx, cy, colGrpNo, headerH, { fill: hFill, bold: true, fontSize: 6 }); cx += colGrpNo;
    drawCell('วันที่-\nเวลา\nเตรียม', cx, cy, colDate, headerH, { fill: hFill, bold: true, fontSize: 6 }); cx += colDate;
    drawCell('Hist. /ความ\nหนืด / อุณหภูมิ\nHist./ Viscosity\n/Temp', cx, cy, colHist, headerH, { fill: hFill, bold: true, fontSize: 6 }); cx += colHist;
    fillRect(cx, cy, colSensory, h1, hFill); drawRect(cx, cy, colSensory, h1);
    drawText('Sensory', cx + colSensory / 2, cy + h1 / 2 + 2.5, { fontSize: 7, bold: true });
    [['สี', 'Color'], ['กลิ่น', 'Odor'], ['เนื้อสัมผัส', 'Texture']].forEach(([th, en], i) => {
      drawCell(`${th}\n${en}`, cx + i * sensoryCellW, cy + h1, sensoryCellW, h2, { fill: hFill, fontSize: 6 });
    }); cx += colSensory;
    const timeGroupW = colPrepA + colCold1 + colColdOut1 + colCold2 + colColdOut2 + colPacked;
    fillRect(cx, cy, timeGroupW, h1, hFill); drawRect(cx, cy, timeGroupW, h1);
    drawText('เวลา (Time)', cx + timeGroupW / 2, cy + h1 / 2 + 2.5, { fontSize: 7, bold: true });
    const timeCols = [
      { label: 'เตรียมเสร็จ\n(A)', w: colPrepA },
      { label: 'เข้าห้องเย็น 1\n(B)', w: colCold1 },
      { label: 'ออกห้องเย็น 1\n(C)', w: colColdOut1 },
      { label: 'เข้าห้องเย็น 2\n(D)', w: colCold2 },
      { label: 'ออกห้องเย็น 2\n(E)', w: colColdOut2 },
      { label: 'บรรจุเสร็จ\n(F)', w: colPacked },
    ];
    let tcx = cx;
    timeCols.forEach(tc => { drawCell(tc.label, tcx, cy + h1, tc.w, h2, { fill: hFill, fontSize: 5 }); tcx += tc.w; });
    cx += timeGroupW;
    const delayGroupW = colDBS1 + colDBS2 + colDBS3 + colDBS4;
    fillRect(cx, cy, delayGroupW, h1, hFill); drawRect(cx, cy, delayGroupW, h1);
    drawText('ดีเลย์ (Delay time) (hr.)', cx + delayGroupW / 2, cy + h1 / 2 + 2.5, { fontSize: 6, bold: true });
    [{ label: '1\n(B-A)', w: colDBS1 }, { label: '2\n(C-B)', w: colDBS2 }, { label: '3\n(F-C)', w: colDBS3 }, { label: '4\n(B-A)+(F-C)', w: colDBS4 }]
      .forEach(dc => { drawCell(dc.label, cx, cy + h1, dc.w, h2, { fill: hFill, fontSize: 6 }); cx += dc.w; });
    drawCell('หมายเหตุ\n(Remark)', cx, cy, colRemark, headerH, { fill: hFill, bold: true, fontSize: 6 });

    const toDisplay = (v) => {
      if (v === null || v === undefined || v === '') return '-';
      if (typeof v === 'boolean') return v ? 'ผ่าน' : 'ไม่ผ่าน';
      return String(v);
    };

    const drawCellWithOverFlag = (text, rx, ry, w, rowH, opts, isOver) => {
      const overFill = [255, 235, 235];
      const fill = isOver ? overFill : opts.fill;
      drawCell(toDisplay(text), rx, ry, w, rowH, { ...opts, fill });
    };

    const pageRows = dataRows;
    pageRows.forEach((row, i) => {
      const ry = tY + headerH + i * rowH;
      if (ry + rowH > pageH - 22) return;
      const m = getRemappedRow(row);
      const sp = isSpecialGroup(row);
      const rowFill = i % 2 === 0 ? [255, 255, 255] : [240, 248, 255];

      const s1 = parseStandardDBSToMinutes(row.DBS1 ?? row.dbs1);
      const s2 = parseStandardDBSToMinutes(row.DBS2 ?? row.dbs2);
      const s3 = parseStandardDBSToMinutes(row.DBS3 ?? row.dbs3);
      const s4 = parseStandardDBSToMinutes(row.DBS4 ?? row.dbs4);
      const c1 = calcDBS1Minutes(m, row);
      const c2 = calcDBS2Minutes(m, sp);
      const c3 = calcDBS3Minutes(m, sp);
      const c4 = calcDBS4Minutes(m, sp, row);
      const over1 = s1 !== null && c1 !== null && c1 > s1;
      const over2 = !sp && s2 !== null && c2 !== null && c2 > s2;
      const over3 = !sp && s3 !== null && c3 !== null && c3 > s3;
      const over4 = s4 !== null && c4 !== null && c4 > s4;

      let rx = tX;
      const cell = (text, w, opts = {}) => { drawCell(toDisplay(text), rx, ry, w, rowH, { fill: rowFill, fontSize: 6, ...opts }); rx += w; };
      const cellOver = (text, w, isOver, opts = {}) => { drawCellWithOverFlag(text, rx, ry, w, rowH, { fill: rowFill, fontSize: 6, ...opts }, isOver); rx += w; };

      cell(row.production, colCode);
      cell(row.mat_name, colRM, { align: 'left' });
      const batchStr = String(row.batch_after ?? '').padEnd(batchCols, ' ');
      for (let b = 0; b < batchCols; b++) cell(batchStr[b] || '', batchCellW, { fontSize: 5 });
      cell(row.weight_RM, colWeight);
      cell(row.group_no, colGrpNo);
      cell(formatDateTimeForPDF(row.rmit_date), colDate, { fontSize: 5.5 });
      cell(row.detail, colHist);
      cell(row.color, sensoryCellW);
      cell(row.odor, sensoryCellW);
      cell(row.texture, sensoryCellW);
      cell(formatDateTimeForPDF(m._A), colPrepA, { fontSize: 5 });
      cell(formatDateTimeForPDF(m._B), colCold1, { fontSize: 5 });
      cell(formatDateTimeForPDF(m._C), colColdOut1, { fontSize: 5 });
      cell(sp ? '-' : formatDateTimeForPDF(m._D), colCold2, { fontSize: 5 });
      cell(sp ? '-' : formatDateTimeForPDF(m._E), colColdOut2, { fontSize: 5 });
      cell(formatDateTimeForPDF(m._F), colPacked, { fontSize: 5 });
      cellOver(calculateDBS1FromMapped(m, row), colDBS1, over1);
      cellOver(calculateDBS2FromMapped(m, sp), colDBS2, over2);
      cellOver(calculateDBS3FromMapped(m, sp), colDBS3, over3);
      cellOver(calculateDBS4FromMapped(m, sp, row), colDBS4, over4);
      // ✅ ใส่ remark_dalay ในคอลัมน์ Remark
      cell(row.remark_dalay, colRemark, { align: 'left', fontSize: 5.5 });
    });

    for (let e = pageRows.length; e < minRows; e++) {
      const ry = tY + headerH + e * rowH; let rx = tX;
      const emptyCell = (w) => { drawRect(rx, ry, w, rowH); rx += w; };
      [colCode, colRM, ...Array(batchCols).fill(batchCellW), colWeight, colGrpNo, colDate, colHist,
        sensoryCellW, sensoryCellW, sensoryCellW,
        colPrepA, colCold1, colColdOut1, colCold2, colColdOut2, colPacked,
        colDBS1, colDBS2, colDBS3, colDBS4, colRemark].forEach(emptyCell);
    }

    const finalY = tY + headerH + Math.max(pageRows.length, minRows) * rowH + 4;
    const legendY = finalY + 8;
    const noteRowH = 4;
    const hFillLegend = [210, 228, 255];

    const drawMatTable = (startX, startY, colMatW, colChW, rows) => {
      drawCell('วัตถุดิบ', startX, startY, colMatW, noteRowH * 2, { fill: hFillLegend, bold: true, fontSize: 7 });
      fillRect(startX + colMatW, startY, colChW * 4, noteRowH, hFillLegend);
      drawRect(startX + colMatW, startY, colChW * 4, noteRowH);
      drawText('ช่วงที่', startX + colMatW + (colChW * 4) / 2, startY + noteRowH / 2 + 1, { fontSize: 7, bold: true });
      [1, 2, 3, 4].forEach((n, i) => drawCell(String(n), startX + colMatW + i * colChW, startY + noteRowH, colChW, noteRowH, { fill: hFillLegend, bold: true, fontSize: 7 }));
      rows.forEach((r, i) => {
        const ry = startY + noteRowH * 2 + i * noteRowH;
        drawCell(r.mat, startX, ry, colMatW, noteRowH, { fontSize: 6, align: 'left' });
        r.v.forEach((val, j) => drawCell(String(val), startX + colMatW + j * colChW, ry, colChW, noteRowH, { fontSize: 7 }));
      });
    };

    const blk1X = margin; const colNote = 20; const colDesc = 25;
    drawCell('หมายเหตุ', blk1X, legendY, colNote, noteRowH, { fill: hFillLegend, bold: true, fontSize: 7 });
    drawCell('คำจำกัดความ', blk1X + colNote, legendY, colDesc, noteRowH, { fill: hFillLegend, bold: true, fontSize: 7 });
    [{ note: 'ช่วงที่ 1', desc: 'เตรียมเสร็จ - เข้าห้องเย็น' }, { note: 'ช่วงที่ 2', desc: 'เข้าห้องเย็น - ออกห้องเย็น' }, { note: 'ช่วงที่ 3', desc: 'ออกห้องเย็น - บรรจุเสร็จ' }, { note: 'ช่วงที่ 4', desc: 'เตรียมเสร็จ - บรรจุเสร็จ' }]
      .forEach((r, i) => { const ry = legendY + noteRowH + i * noteRowH; drawCell(r.note, blk1X, ry, colNote, noteRowH, { fontSize: 7 }); drawCell(r.desc, blk1X + colNote, ry, colDesc, noteRowH, { fontSize: 7, align: 'left' }); });

    const blk2X = blk1X + colNote + colDesc + 4;
    drawMatTable(blk2X, legendY, 25, 5, [
      { mat: 'เนื้อสัตว์ (วัว/ เป็ด/ แกะ)', v: [3, 9, 2, 5] }, { mat: 'เนื้อไก่ (ไก่/ ไก่งวง)', v: [2, 5, 2, 4] },
      { mat: 'ปลาแกะ (MK/ SE/ SD)', v: [3, 6, 2, 5] }, { mat: 'ปลาแกะ (TN/ SM)', v: [5, 6, 2, 7] },
      { mat: 'Shelf fish (กุ้ง/ ปลาหมึก/ หอย)', v: [2, 8, 2, 4] }, { mat: 'เลือดทูน่า/ เศษทูน่า', v: [2, 4, 2, 4] },
    ]);
    const blk3X = blk2X + 25 + 5 * 4 + 4;
    drawMatTable(blk3X, legendY, 25, 5, [
      { mat: 'ปลาสับสด/ เนื้อไก่สด', v: [1, 6, 1, 2] }, { mat: 'ผัก-ผลไม้สด/ ผัก+ผลไม้แช่/ ผัก+ผลไม้ต้มแช่', v: [2, 10, 2, 4] },
      { mat: 'ผักต้ม/ ลวก/ ฟักทองต้ม', v: [2, 6, 2, 4] }, { mat: 'ปลากระตัก/ ปลาข้าวสาร', v: [2, 6, 2, 4] },
      { mat: 'ข้าว/ ปลายข้าว', v: [2, 9, 2, 4] }, { mat: 'น้ำอบไก่/ น้ำอบ MDM', v: [1, '-', '-', '-'] },
    ]);
    const blk4X = blk3X + 25 + 5 * 4 + 4;
    drawMatTable(blk4X, legendY, 25, 5, [
      { mat: 'Chunk', v: [1, 12, 2, 3] }, { mat: 'Stuff Chunk (แท่ง)', v: [2, 48, 3, 5] },
      { mat: 'Stuff Chunk (เส้น)', v: [2, 9, 3, 5] }, { mat: 'CCM/ MDM อบ', v: [4, 2, 2, 6] },
      { mat: 'CCM/ MDM อบ (Cai 300)*', v: ['-', '-', '-', 3] }, { mat: 'สาวละสาย/ เกรวี่', v: ['-', 6, '-', 2] },
    ]);

    const legendBlockH = noteRowH * 2 + 6 * noteRowH;
    const footerY = legendY + legendBlockH + 5;
    drawText('เอกสารการควบคุม Delay time:', margin, footerY, { fontSize: 7, align: 'left' });
    drawText('W3QCPF18, SQCIS001/ ISPP018', margin, footerY + 5, { fontSize: 7, align: 'left' });

    const sigY = footerY + 5 + 8;
    [
      { label: 'Recorded by :', name: sigData.recordedBy || '', sub: '(Production Staff)', x: margin + 25 },
      { label: 'Reviewed by :', name: sigData.reviewedBy || '', sub: '(Production Section Manager)', x: pageW / 2 },
      { label: '', name: sigData.qcManager || '', sub: '(Quality Control Section Manager)', x: pageW - margin - 38 },
    ].forEach(({ label, name, sub, x }) => {
      if (label) drawText(label, x, sigY, { fontSize: 7, align: 'center' });
      if (name) drawText(name, x, sigY + 4, { fontSize: 7, bold: true, align: 'center' });
      drawText(sub, x, sigY + 7, { fontSize: 7, align: 'center' });
    });

    return doc.output('blob');
  };

  const exportToPDFWithData = async (dataRows, sigData = {}) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 5;

    doc.addFileToVFS('Sarabun-Regular.ttf', thSarabunBase64);
    doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
    doc.addFileToVFS('Sarabun-Bold.ttf', thSarabunBoldBase64);
    doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
    doc.setFont('Sarabun', 'normal');
    doc.setLanguage('th');
    doc.setLineWidth(0.05);

    const drawRect = (x, y, w, h) => { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.1); doc.rect(x, y, w, h); };
    const fillRect = (x, y, w, h, rgb) => { doc.setFillColor(...rgb); doc.rect(x, y, w, h, 'F'); };
    const drawText = (text, x, y, opts = {}) => {
      const { fontSize = 8, align = 'center', bold = false, color = [0, 0, 0] } = opts;
      doc.setFont('Sarabun', bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(...color);
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
//แก้ไขความกว้างใน PDF 
    const tX = margin; const tY = 29; const tW = pageW - margin * 2;
    const colCode = 8; const colRM = 33; const colBatch = 18; const batchCols = 10;
    const batchCellW = colBatch / batchCols; const colWeight = 8; const colGrpNo = 8;
    const colDate = 15; const colHist = 12; const sensoryCellW = 5; const colSensory = sensoryCellW * 3;
    const colPrepA = 13; const colCold1 = 13; const colColdOut1 = 13;
    const colCold2 = 13; const colColdOut2 = 13; const colPacked = 13;
    const colDBS1 = 10; const colDBS2 = 10; const colDBS3 = 10; const colDBS4 = 10;
    const colRemark = tW - colCode - colRM - colBatch - colWeight - colGrpNo
      - colDate - colHist - colSensory
      - colPrepA - colCold1 - colColdOut1
      - colCold2 - colColdOut2 - colPacked
      - colDBS1 - colDBS2 - colDBS3 - colDBS4;
    const h1 = 7; const h2 = 14; const headerH = h1 + h2; const hFill = [210, 228, 255];
    const minRows = 17;
    const bottomReserved = 80;
    const availableH = pageH - (tY + headerH) - bottomReserved;
    const rowH = Math.floor((availableH / minRows) * 10) / 10;

    const drawPageHeader = (pageNumber, totalPages) => {
      drawText('บริษัท ไอ-เทล คอร์ปอเรชั่น จำกัด (มหาชน)', pageW / 2, 12, { fontSize: 16, bold: true, align: 'center' });
      drawText('รายงานควบคุมเวลากระบวนการผลิต โรงผลิตอาหารสัตว์เลี้ยง (Delay Time for Production Control Report)', pageW / 2, 19, { fontSize: 10, align: 'center' });
      drawText('F3PFPF67-2-19/06/26', pageW - margin, 12, { fontSize: 8, align: 'right' });
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
        const lineStartX = infoX + labelWidth + 1;
        const lineEndX = lineStartX + dotWidth;
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
        doc.line(lineStartX, infoY + 1, lineEndX, infoY + 1); doc.setLineWidth(0.5);
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
      [
        { label: 'เตรียมเสร็จ\n(A)', w: colPrepA },
        { label: 'เข้าห้องเย็น 1\n(B)', w: colCold1 },
        { label: 'ออกห้องเย็น 1\n(C)', w: colColdOut1 },
        { label: 'เข้าห้องเย็น 2\n(D)', w: colCold2 },
        { label: 'ออกห้องเย็น 2\n(E)', w: colColdOut2 },
        { label: 'บรรจุเสร็จ\n(F)', w: colPacked },
      ].forEach((tc, i, arr) => {
        let tcx2 = cx;
        arr.slice(0, i).forEach(t => tcx2 += t.w);
        drawCell(tc.label, tcx2, cy + h1, tc.w, h2, { fill: hFill, fontSize: 5 });
      }); cx += timeGroupW;
      const delayGroupW = colDBS1 + colDBS2 + colDBS3 + colDBS4;
      fillRect(cx, cy, delayGroupW, h1, hFill); drawRect(cx, cy, delayGroupW, h1);
      drawText('Delay time (hr.)', cx + delayGroupW / 2, cy + h1 / 2 + 2, { fontSize: 5, bold: true });
      [{ label: '1\n(B-A)', w: colDBS1 }, { label: '2\n(C-B)', w: colDBS2 }, { label: '3\n(F-C)', w: colDBS3 }, { label: '4', w: colDBS4 }]
        .forEach(dc => { drawCell(dc.label, cx, cy + h1, dc.w, h2, { fill: hFill, fontSize: 5 }); cx += dc.w; });
      drawCell('หมายเหตุ\n(Remark)', cx, cy, colRemark, headerH, { fill: hFill, bold: true, fontSize: 5 });
    };

    const drawPageFooter = (sigData) => {
      const finalY = tY + headerH + minRows * rowH + 4;
      const legendY = finalY + 8;
      const noteRowH = 4;
      const hFillLegend = [210, 228, 255];

      const drawMatTable2 = (startX, startY, colMatW, colChW, rows) => {
        drawCell('วัตถุดิบ', startX, startY, colMatW, noteRowH * 2, { fill: hFillLegend, bold: true, fontSize: 5.5 });
        fillRect(startX + colMatW, startY, colChW * 4, noteRowH, hFillLegend); drawRect(startX + colMatW, startY, colChW * 4, noteRowH);
        drawText('ช่วงที่', startX + colMatW + (colChW * 4) / 2, startY + noteRowH / 2 + 1.2, { fontSize: 5.5, bold: true });
        [1, 2, 3, 4].forEach((n, i) => drawCell(String(n), startX + colMatW + i * colChW, startY + noteRowH, colChW, noteRowH, { fill: hFillLegend, bold: true, fontSize: 5.5 }));
        rows.forEach((r, i) => {
          const ry = startY + noteRowH * 2 + i * noteRowH;
          drawCell(r.mat, startX, ry, colMatW, noteRowH, { fontSize: 5.5, align: 'left' });
          r.v.forEach((val, j) => drawCell(String(val), startX + colMatW + j * colChW, ry, colChW, noteRowH, { fontSize: 5.5 }));
        });
      };

      const blk1X = margin; const colNote = 12.5; const colDesc = 32;
      drawCell('หมายเหตุ', blk1X, legendY, colNote, noteRowH, { fill: hFillLegend, bold: true, fontSize: 5.5 });
      drawCell('คำจำกัดความ', blk1X + colNote, legendY, colDesc, noteRowH, { fill: hFillLegend, bold: true, fontSize: 5.5 });
      [{ note: 'ช่วงที่ 1', desc: 'เตรียมเสร็จ - เข้าห้องเย็น' }, { note: 'ช่วงที่ 2', desc: 'เข้าห้องเย็น - ออกห้องเย็น' }, { note: 'ช่วงที่ 3', desc: 'ออกห้องเย็น - บรรจุเสร็จ' }, { note: 'ช่วงที่ 4', desc: 'เตรียมเสร็จ - บรรจุเสร็จ' }]
        .forEach((r, i) => { const ry = legendY + noteRowH + i * noteRowH; drawCell(r.note, blk1X, ry, colNote, noteRowH, { fontSize: 5.5 }); drawCell(r.desc, blk1X + colNote, ry, colDesc, noteRowH, { fontSize: 5.5, align: 'left' }); });
      const blk2X = blk1X + colNote + colDesc + 4;
      drawMatTable2(blk2X, legendY, 28, 5, [
        { mat: 'เนื้อสัตว์ (วัว/ เป็ด/ แกะ)', v: [3, 9, 2, 5] }, { mat: 'เนื้อไก่ (ไก่/ ไก่งวง)', v: [2, 5, 2, 4] },
        { mat: 'ปลาแกะ (MK/ SE/ SD)', v: [3, 6, 2, 5] }, { mat: 'ปลาแกะ (TN/ SM)', v: [5, 6, 2, 7] },
        { mat: 'Shelf fish (กุ้ง/ ปลาหมึก/ หอย)', v: [2, 8, 2, 4] }, { mat: 'เลือดทูน่า/ เศษทูน่า', v: [2, 4, 2, 4] },
      ]);
      const blk3X = blk2X + 28 + 5 * 4 + 4;
      drawMatTable2(blk3X, legendY, 38, 5, [
        { mat: 'ปลาสับสด/ เนื้อไก่สด', v: [1, 6, 1, 2] }, { mat: 'ผัก-ผลไม้สด/ ผัก+ผลไม้แช่/ ผัก+ผลไม้ต้มแช่', v: [2, 10, 2, 4] },
        { mat: 'ผักต้ม/ ลวก/ ฟักทองต้ม', v: [2, 6, 2, 4] }, { mat: 'ปลากระตัก/ ปลาข้าวสาร', v: [2, 6, 2, 4] },
        { mat: 'ข้าว/ ปลายข้าว', v: [2, 9, 2, 4] }, { mat: 'น้ำอบไก่/ น้ำอบ MDM', v: [1, '-', '-', '-'] },
      ]);
      const blk4X = blk3X + 38 + 5 * 4 + 4;
      drawMatTable2(blk4X, legendY, 27, 5, [
       { mat: 'Chunk (Normal/ Flat/ IJ)', v: [1, 12, 2, 3] }, { mat: 'Stuff Chunk (แท่ง)', v: [2, 48, 3, 5] },
        { mat: 'Stuff Chunk (เส้น)', v: [2, 9, 3, 5] }, { mat: 'CCM/ MDM อบ', v: [3, 3, 2, 5] },
       { mat: 'CCM/ MDM อบ (Can 300)*', v: ['-', '-', '-', 3] }, { mat: 'สาวละสาย/ เกรวี่', v: ['-', 6, '-', 2] },
      ]);

      // ✅ Block 5: Loaf table
      const blk5X = blk4X + 27 + 5 * 4 + 4;
      const loafMatW = 20, loafValW = 13;
      const loafHeaders = ['วัตถุดิบ', 'ช่วงที่ 1', 'ช่วงที่ 2', 'ออกห้องเย็น -\nผสมเสร็จ', 'ผสมเสร็จ -\nบรรจุเสร็จ'];
      const loafWidths = [loafMatW, loafValW, loafValW, loafValW, loafValW];
      let loafHX = blk5X;
      loafHeaders.forEach((h, i) => { drawCell(h, loafHX, legendY, loafWidths[i], noteRowH * 2, { fill: hFillLegend, bold: true, fontSize: 5.5 }); loafHX += loafWidths[i]; });
      [
        { mat: 'Loaf (ของสด)', v: [1, 6, 1, 2] },
        { mat: 'Loaf (ของสุก)**', v: ['ตามชนิดวัตถุดิบ', 'ตามชนิดวัตถุดิบ', 1, 2] },
        { mat: 'Loaf sachet', v: ['ตามชนิดวัตถุดิบ', 'ตามชนิดวัตถุดิบ', '1.0', '1.0'] },
        { mat: 'Loaf Mouse', v: ['ตามชนิดวัตถุดิบ', 'ตามชนิดวัตถุดิบ', '1.5', '1.5'] },
      ].forEach((r, i) => {
        const ry = legendY + noteRowH * 2 + i * noteRowH;
        let rx = blk5X;
        drawCell(r.mat, rx, ry, loafWidths[0], noteRowH, { fontSize: 5.5, align: 'left' }); rx += loafWidths[0];
        r.v.forEach((val, j) => { drawCell(String(val), rx, ry, loafWidths[j + 1], noteRowH, { fontSize: 5.5 }); rx += loafWidths[j + 1]; });
      });

      // ✅ Freeze storage note table, stacked below the Loaf table
      const freezeY = legendY + noteRowH * 2 + 4 * noteRowH;
      const freezeWidths = [loafMatW, 20, 32];
      const freezeHeaders = ['วัตถุดิบ', 'ห้อง Freeze (-18c)', 'ออกห้อง Freeze (-18c) - เข้าห้องเย็น PF'];
      let freezeHX = blk5X;
      freezeHeaders.forEach((h, i) => { drawCell(h, freezeHX, freezeY, freezeWidths[i], noteRowH, { fill: hFillLegend, bold: true, fontSize: 4.5 }); freezeHX += freezeWidths[i]; });
      const freezeRow = ['Chunk (Normal/ Flat/ IJ)', '*1 เดือน', '*1 ชั่วโมง'];
      let freezeRX = blk5X;
      freezeRow.forEach((val, i) => { drawCell(val, freezeRX, freezeY + noteRowH, freezeWidths[i], noteRowH, { fontSize: 4.5, align: i === 0 ? 'left' : 'center' }); freezeRX += freezeWidths[i]; });

      const legendBlockH = noteRowH * 2 + 6 * noteRowH;
      const footerY = legendY + legendBlockH + 5;
      drawText('** ปลาแกะ(TN/ SM) ช่วงที่ 1 เวลา 5 ชั่วโมง โดยแบ่งเป็นอบเสร็จ - cooling เสร็จ 2 ชั่วโมง และ Cooling เสร็จ-เข้าห้องเย็น 3 ชั่วโมง',
      blk2X, footerY, { fontSize: 6.5, align: 'left' });
      drawText('*โดยระบุในช่อง Remark', blk5X, freezeY + noteRowH * 2 + 3, { fontSize: 6.5, align: 'left' });
      drawText('เอกสารการควบคุม Delay time:', margin, footerY, { fontSize: 8, align: 'left' });
      drawText('W3QCPF18, SQCIS001/ ISPP018', margin, footerY + 5, { fontSize: 8, align: 'left' });

      const sigY = footerY + 5 + 7;
      [
        { label: 'Recorded by :', name: sigData.recordedBy || '', sub: '(Production Staff)', x: margin + 40, lineWidth: 40 },
        { label: 'Reviewed by :', name: sigData.reviewedBy || '', sub: '(Production Section Manager)', x: pageW / 2, lineWidth: 40 },
        { label: '', name: sigData.qcManager || '', sub: '(Quality Control Section Manager)', x: pageW - margin - 38, lineWidth: 40 },
      ].forEach(({ label, name, sub, x, lineWidth }) => {
        if (label) { const labelWidth = doc.getTextWidth(label); drawText(label, x - lineWidth / 2 - labelWidth - 2, sigY, { fontSize: 8, align: 'left' }); }
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
        doc.line(x - lineWidth / 2, sigY + 1, x + lineWidth / 2, sigY + 1); doc.setLineWidth(0.5);
        if (name) drawText(name, x, sigY - 0.5, { fontSize: 8, bold: true, align: 'center' });
        drawText(sub, x, sigY + 5, { fontSize: 8, align: 'center' });
      });
    };

    const toDisplay = (v, isSensory = false) => {
      if (v === null || v === undefined || v === '') return '-';
      if (typeof v === 'boolean') return isSensory ? (v ? 'ผ่าน' : 'ไม่ผ่าน') : (v ? '✓' : '✗');
      return String(v);
    };

    const drawCellWithOverFlagMP = (text, rx, ry, w, rowH, opts, isOver) => {
      const overFill = [255, 235, 235];
      const fill = isOver ? overFill : opts.fill;
      drawCell(toDisplay(text), rx, ry, w, rowH, { ...opts, fill });
    };

    const totalPages = Math.ceil(dataRows.length / minRows);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (pageNum > 1) doc.addPage();
      drawPageHeader(pageNum, totalPages);
      drawTableHeader();

      const startIdx = (pageNum - 1) * minRows;
      const endIdx = Math.min(startIdx + minRows, dataRows.length);
      const pageRows = dataRows.slice(startIdx, endIdx);

      pageRows.forEach((row, i) => {
        const ry = tY + headerH + i * rowH;
        const rowFill = i % 2 === 0 ? [255, 255, 255] : [240, 248, 255];
        const m = getRemappedRow(row);
        const sp = isSpecialGroup(row);

        const s1 = parseStandardDBSToMinutes(row.DBS1 ?? row.dbs1);
        const s2 = parseStandardDBSToMinutes(row.DBS2 ?? row.dbs2);
        const s3 = parseStandardDBSToMinutes(row.DBS3 ?? row.dbs3);
        const s4 = parseStandardDBSToMinutes(row.DBS4 ?? row.dbs4);
        const c1 = calcDBS1Minutes(m, row);
        const c2 = calcDBS2Minutes(m, sp);
        const c3 = calcDBS3Minutes(m, sp);
        const c4 = calcDBS4Minutes(m, sp, row);
        const over1 = s1 !== null && c1 !== null && c1 > s1;
        const over2 = !sp && s2 !== null && c2 !== null && c2 > s2;
        const over3 = !sp && s3 !== null && c3 !== null && c3 > s3;
        const over4 = s4 !== null && c4 !== null && c4 > s4;

        let rx = tX;
        const cell = (text, w, opts = {}, isSensory = false) => {
          drawCell(toDisplay(text, isSensory), rx, ry, w, rowH, { fill: rowFill, fontSize: 8, ...opts }); rx += w;
        };
        const cellOver = (text, w, isOver, opts = {}) => {
          drawCellWithOverFlagMP(text, rx, ry, w, rowH, { fill: rowFill, fontSize: 8, ...opts }, isOver); rx += w;
        };
//แก้ไขขนาดตัวอักษร
        cell(row.production, colCode, { fontSize: 4});
        cell(row.mat_name, colRM, { align: 'left', fontSize: 4 });
        const batchStr = String(row.batch_after ?? '').padEnd(batchCols, ' ');
        for (let b = 0; b < batchCols; b++) cell(batchStr[b] || '', batchCellW, { fontSize: 5 });
        cell(row.weight_RM, colWeight, { align: 'left', fontSize: 4 });
        cell(row.group_no, colGrpNo, { align: 'left', fontSize: 4 });
        cell(formatDateTimeForPDF(row.rmit_date), colDate, { fontSize: 5, bold: true });
        cell(row.detail, colHist, { fontSize: 4, bold: true });
        cell(row.color, sensoryCellW, { fontSize: 4 }, true);
        cell(row.odor, sensoryCellW, { fontSize: 4 }, true);
        cell(row.texture, sensoryCellW, { fontSize: 4 }, true);
        cell(formatDateTimeForPDF(m._A), colPrepA, { fontSize: 5, bold: true });
        cell(formatDateTimeForPDF(m._B), colCold1, { fontSize: 5, bold: true });
        cell(formatDateTimeForPDF(m._C), colColdOut1, { fontSize: 5, bold: true });
        cell(sp ? '-' : formatDateTimeForPDF(m._D), colCold2, { fontSize: 5, bold: true });
        cell(sp ? '-' : formatDateTimeForPDF(m._E), colColdOut2, { fontSize: 5, bold: true });
        cell(formatDateTimeForPDF(m._F), colPacked, { fontSize: 5, bold: true });
        cellOver(calculateDBS1FromMapped(m, row), colDBS1, over1, { fontSize: 5, bold: true });
        cellOver(calculateDBS2FromMapped(m, sp), colDBS2, over2, { fontSize: 5, bold: true });
        cellOver(calculateDBS3FromMapped(m, sp), colDBS3, over3, { fontSize: 5, bold: true });
        cellOver(calculateDBS4FromMapped(m, sp, row), colDBS4, over4, { fontSize: 5, bold: true });
        // ✅ ใส่ remark_dalay ในคอลัมน์ Remark
        cell(row.remark_dalay, colRemark, { align: 'left', fontSize: 4 });
      });

      const remainingRows = minRows - pageRows.length;
      for (let e = 0; e < remainingRows; e++) {
        const ry = tY + headerH + (pageRows.length + e) * rowH;
        let rx = tX;
        const emptyCell = (w) => { drawRect(rx, ry, w, rowH); rx += w; };
        [colCode, colRM, ...Array(batchCols).fill(batchCellW), colWeight, colGrpNo, colDate, colHist,
          sensoryCellW, sensoryCellW, sensoryCellW,
          colPrepA, colCold1, colColdOut1, colCold2, colColdOut2, colPacked,
          colDBS1, colDBS2, colDBS3, colDBS4, colRemark].forEach(emptyCell);
      }

      drawPageFooter(sigData);
    }

    doc.save(`F3PFPF67_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportToExcel = () => {
    const headerNames = {
      mapping_id: "รายการ", withdraw_date: "เวลาส่งออกจากห้องเย็นใหญ่", production: "แผนการผลิต", mat_name: "รายชื่อวัตถุดิบ", batch_after: "Batch",
      group_no: "ชุดที่",
      rmit_date: "เวลาเตรียมเสร็จ (A)\nสำหรับ Loaf สุก เวลาออกห้องเย็น\nสำหรับ Loaf ดิบ เวลาบดเสร็จ",
      color: "สี", odor: "กลิ่น", texture: "เนื้อสัมผัส", weight_RM: "น้ำหนักวัตถุดิบ", detail: "รายละเอียดวัตถุดิบ",
      cold_slot_1_in: "เข้าห้องเย็น1", cold_slot_1_out: "ออกห้องเย็น1",
      cold_slot_2_in: "เข้าห้องเย็น2", cold_slot_2_out: "ออกห้องเย็น2",
      cold_slot_3_in: "เข้าห้องเย็น3", cold_slot_3_out: "ออกห้องเย็น3",
      cold_slot_4_in: "เข้าห้องเย็น4", cold_slot_4_out: "ออกห้องเย็น4",
      cold_slot_5_in: "เข้าห้องเย็น5", cold_slot_5_out: "ออกห้องเย็น5",
      cold_slot_6_in: "เข้าห้องเย็น6", cold_slot_6_out: "ออกห้องเย็น6",
      sc_pack_date: "บรรจุเสร็จ (F)", dbs1: "DBS 1", dbs2: "DBS 2", dbs3: "DBS 3", dbs4: "DBS 4",
      remark_dalay: "หมายเหตุ"
    };

    const exportData = filteredRows.map(row => {
      const m = getRemappedRow(row);
      const sp = isSpecialGroup(row);
      const cp = getSortedColdStoragePairs(row);
      const exportRow = {};
      displayColumns.forEach(col => {
        switch (col) {
          case 'dbs1': exportRow[headerNames[col]] = calculateDBS1FromMapped(m, row); break;
          case 'dbs2': exportRow[headerNames[col]] = calculateDBS2FromMapped(m, sp, row); break;
          case 'dbs3': exportRow[headerNames[col]] = calculateDBS3FromMapped(m, sp); break;
          case 'dbs4': exportRow[headerNames[col]] = calculateDBS4FromMapped(m, sp, row); break;
          case 'rmit_date': exportRow[headerNames[col]] = m._A ?? '-'; break;
          case 'cold_slot_1_in':  exportRow[headerNames[col]] = cp[0]?.in  ?? '-'; break;
          case 'cold_slot_1_out': exportRow[headerNames[col]] = cp[0]?.out ?? '-'; break;
          case 'cold_slot_2_in':  exportRow[headerNames[col]] = cp[1]?.in  ?? '-'; break;
          case 'cold_slot_2_out': exportRow[headerNames[col]] = cp[1]?.out ?? '-'; break;
          case 'cold_slot_3_in':  exportRow[headerNames[col]] = cp[2]?.in  ?? '-'; break;
          case 'cold_slot_3_out': exportRow[headerNames[col]] = cp[2]?.out ?? '-'; break;
          case 'cold_slot_4_in':  exportRow[headerNames[col]] = cp[3]?.in  ?? '-'; break;
          case 'cold_slot_4_out': exportRow[headerNames[col]] = cp[3]?.out ?? '-'; break;
          case 'cold_slot_5_in':  exportRow[headerNames[col]] = cp[4]?.in  ?? '-'; break;
          case 'cold_slot_5_out': exportRow[headerNames[col]] = cp[4]?.out ?? '-'; break;
          case 'cold_slot_6_in':  exportRow[headerNames[col]] = cp[5]?.in  ?? '-'; break;
          case 'cold_slot_6_out': exportRow[headerNames[col]] = cp[5]?.out ?? '-'; break;
          case 'sc_pack_date': exportRow[headerNames[col]] = m._F ?? '-'; break;
          case 'remark_dalay': exportRow[headerNames[col]] = row.remark_dalay ?? '-'; break;
          default: exportRow[headerNames[col]] = row[col] ?? '-';
        }
      });
      return exportRow;
    });

    const headers = displayColumns.map(col => headerNames[col]);
    const csvContent = [
      headers.map(h => `"${(h ?? '').toString().replace(/"/g, '""')}"`).join(','),
      ...exportData.map(row => headers.map(h => `"${(row[h] ?? '-').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `prep_data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalCustomWidth = Object.values(CUSTOM_COLUMN_WIDTHS).reduce((sum, width) => sum + parseInt(width), 0);
  const remainingWidth = `calc((100% - ${totalCustomWidth}px) / ${displayColumns.length})`;
  const columnWidths = Array(displayColumns.length).fill(remainingWidth);

  const headerNames = {
    mapping_id: "รายการ", withdraw_date: "เวลาส่งออกจากห้องเย็นใหญ่", production: "แผนการผลิต", mat_name: "รายชื่อวัตถุดิบ", batch_after: "Batch",
    group_no: "ชุดที่",
    rmit_date: "เวลาเตรียมเสร็จ (A)\nสำหรับ Loaf สุก เวลาออกห้องเย็น\nสำหรับ Loaf ดิบ เวลาบดเสร็จ",
    color: "สี", odor: "กลิ่น", texture: "เนื้อสัมผัส", weight_RM: "น้ำหนักวัตถุดิบ", detail: "รายละเอียดวัตถุดิบ",
    cold_slot_1_in: "เข้าห้องเย็น1 (B) สำหรับ Loaf สุก เวลาเริ่มผสมสำหรับ Loaf ดิบ เวลาเริ่มผสม", 
    cold_slot_1_out: "ออกห้องเย็น1 (C)สำหรับ Loaf สุก เวลาผสมเสร็จสำหรับ Loaf ดิบ เวลาผสมเสร็จ",
    cold_slot_2_in: "เข้าห้องเย็น2 (D)", cold_slot_2_out: "ออกห้องเย็น2 (E)",
    cold_slot_3_in: "เข้าห้องเย็น3", cold_slot_3_out: "ออกห้องเย็น3",
    cold_slot_4_in: "เข้าห้องเย็น4", cold_slot_4_out: "ออกห้องเย็น4",
    cold_slot_5_in: "เข้าห้องเย็น5", cold_slot_5_out: "ออกห้องเย็น5",
    cold_slot_6_in: "เข้าห้องเย็น6", cold_slot_6_out: "ออกห้องเย็น6",
    sc_pack_date: "บรรจุเสร็จ (F)", dbs1: "DBS 1", dbs2: "DBS 2", dbs3: "DBS 3", dbs4: "DBS 4",
    remark_dalay: "หมายเหตุ"
  };

  const getColumnWidth = (header) => {
    if (header === "mapping_id") return "100px";
    if (["production"].includes(header)) return "150px";
    if (header === "mat_name") return "200px";
    if (["rmit_date", "color", "odor", "texture", "sc_pack_date",
      "cold_slot_1_in", "cold_slot_1_out", "cold_slot_2_in", "cold_slot_2_out",
      "cold_slot_3_in", "cold_slot_3_out", "cold_slot_4_in", "cold_slot_4_out",
      "cold_slot_5_in", "cold_slot_5_out", "cold_slot_6_in", "cold_slot_6_out",
    ].includes(header)) return "150px";
    if (["weight_RM"].includes(header)) return "90px";
    if (header === "batch_after") return "120px";
    if (header === "group_no") return "120px";
    if (header === "detail") return "150px";
    if (["dbs1", "dbs2", "dbs3", "dbs4"].includes(header)) return "130px";
    if (header === "remark_dalay") return "200px";
    return "150px";
  };

  const handleDeleteItemWithDelay = (row) => handleOpenDeleteModal({ ...row });

  const handleOpenIngredientModal = async (row) => {
  const mappingId = row.mapping_id;
  const legacyIdIgd = row.id_igd;
  const legacyIdIgdNo = row.id_igd_no ?? null;
  const matPkg = row.mat_pkg || null;

  setIngredientData([]);
  setIngredientError('');
  setTraceBackSlipData(null);
  setTraceBackSlipError('');
  setIngredientModalOpen(true);
  setIngredientLoading(true);

  try {
    let entries = [];
    if (mappingId) {
      try {
        const mapRes = await axios.get(`${API_URL}/api/pack/ingredient/wo-mapping/${mappingId}`);
        if (mapRes.data.success) entries = mapRes.data.data || [];
      } catch (e) {
        console.error('wo-mapping fetch error:', e);
      }
    }

    if (entries.length === 0 && legacyIdIgd) {
      entries = [{ wo_no: legacyIdIgd, basket_no: legacyIdIgdNo }];
    }

    setIngredientIdIgd(entries.map(e => e.wo_no).join(', ') || legacyIdIgd || '');
    setIngredientIdIgdNo(entries.length === 1 ? entries[0].basket_no : null);

    if (entries.length === 0) {
      setIngredientError('รายการนี้ยังไม่มีรหัส WONO บันทึกไว้');
    } else {
      const results = await Promise.all(
        entries.map(async (e) => {
          try {
            const params = { wo_no: e.wo_no };
            if (e.basket_no != null) params.basket_no = e.basket_no;
            const res = await axios.get(`${API_URL}/api/pack/ingredient/fetch-wo`, { params });
            return res.data.success ? res.data.data : [];
          } catch (err) {
            console.error('Trace Back WC fetch error:', err);
            return [];
          }
        })
      );
      const merged = results.flat();
      if (merged.length === 0) {
        setIngredientError('ไม่พบข้อมูล Trace Back สำหรับ WO นี้');
      } else {
        setIngredientData(merged);
      }
    }
  } finally {
    setIngredientLoading(false);
  }

  if (matPkg) {
    setTraceBackSlipLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/pack/printmaster/by-id`, { params: { slip_id: matPkg } });
      if (res.data.success) setTraceBackSlipData(res.data.data);
      else setTraceBackSlipError(res.data.error || 'ไม่พบข้อมูล Slip');
    } catch (err) {
      console.error('Trace Back Slip fetch error:', err);
      setTraceBackSlipError(err.response?.data?.error || 'ไม่สามารถดึงข้อมูล Slip ได้');
    } finally {
      setTraceBackSlipLoading(false);
    }
  }
};
  const editedCount = Object.keys(editedCells).length;

  // ✅ มี filter ใดๆ ที่ user เลือกไว้แต่ยังไม่ได้กดค้นหา?
  const hasPendingFilters = !!(selectedLineName || selectedDocNo || selectedSCPackDate || selectedMatName || selectedShift);

  return (
    <Paper sx={{
      width: '100%', overflow: 'hidden',
      boxShadow: '0px 4px 20px rgba(33, 150, 243, 0.1)',
      borderRadius: '16px',
      background: 'linear-gradient(135deg, #ffffff 0%, #F5F8FF 100%)'
    }}>
      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .edit-dot { animation: pulse 1.5s infinite; }
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }
        input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }
        .time24-select { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
      `}</style>

      {/* Header */}
      <Box sx={{ background: 'linear-gradient(135deg, #1552F0 0%, #1552F0 100%)', padding: '20px 24px', borderRadius: '16px 16px 0 0' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 2, marginBottom: 2 }}>
          <TextField
            variant="outlined" fullWidth placeholder="พิมพ์เพื่อค้นหาในข้อมูลที่โหลดแล้ว..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon style={{ color: '#1552F0' }} /></InputAdornment>,
              sx: { height: "44px", backgroundColor: '#fff', borderRadius: '12px' }
            }}
            sx={{ "& .MuiOutlinedInput-root": { height: "44px", fontSize: "14px", borderRadius: "12px", color: "#546E7A", '& fieldset': { borderColor: 'transparent' }, '&:hover fieldset': { borderColor: '#1552F0' }, '&.Mui-focused fieldset': { borderColor: '#1552F0', borderWidth: '2px' } }, "& input": { padding: "10px" } }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={exportToExcel}
              sx={{ backgroundColor: '#fff', color: '#4CAF50', width: '44px', height: '44px', borderRadius: '12px', transition: 'all 0.3s ease', '&:hover': { backgroundColor: '#E8F5E9', transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(76,175,80,0.25)' } }}
              title="Export เป็น CSV">
              <FileDownloadIcon />
            </IconButton>
            <IconButton onClick={handleOpenPDFPreview}
              sx={{ backgroundColor: '#fff', color: '#1552F0', width: '44px', height: '44px', borderRadius: '12px', transition: 'all 0.3s ease', '&:hover': { backgroundColor: '#eeebff', transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(0,166,255,0.25)' } }}
              title="Export เป็น PDF">
              <PictureAsPdfIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterListIcon sx={{ color: '#fff', fontSize: '20px' }} />
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>ตัวกรอง:</span>
          </Box>
          <SearchableDropdown label="Line Name" options={uniqueLineNames} value={selectedLineName} onChange={setSelectedLineName} placeholder="เลือก Line Name" />
          <SearchableDropdown label="Doc No" options={uniqueDocNos} value={selectedDocNo} onChange={setSelectedDocNo} placeholder="เลือก Doc No" />
          <SearchableDropdown label="sc_pack_date" options={uniqueSCPackDate} value={selectedSCPackDate} onChange={setselectedSCPackDate} placeholder="เลือกวันที่บรรจุเสร็จ" />
          <SearchableDropdown label="Shift" options={['DS', 'NS']} value={selectedShift} onChange={setSelectedShift} placeholder="เลือก Shift" />
          <SearchableDropdown label="mat_name" options={uniqueMatName} value={selectedMatName} onChange={setSelectedMatName} placeholder="เลือก วัตถุดิบ" />

          <input
            value={dbQuery}
            onChange={(e) => setDbQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="ค้นหาทุกวันจากฐานข้อมูล (วัตถุดิบ / Batch / รถเข็น / รายการ / แผน / HU)"
            title="พิมพ์แล้วกด Enter หรือปุ่มค้นหา — ค้นจากฐานข้อมูลทั้งหมด ใช้ร่วมกับตัวกรองด้านซ้ายได้"
            style={{ height: '42px', minWidth: '300px', padding: '0 12px', borderRadius: '12px', border: '1px solid #cfd8dc', fontSize: '14px' }}
          />

          {/* ✅ ปุ่มค้นหา */}
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              padding: '10px 22px',
              borderRadius: '12px',
              border: 'none',
              background: loading
                ? 'linear-gradient(135deg, #A5D6A7 0%, #66BB6A 100%)'
                : 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(76,175,80,0.3)',
              transition: 'all 0.3s ease',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(76,175,80,0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(76,175,80,0.3)';
            }}
            title="กดเพื่อดึงข้อมูลตามตัวกรอง"
          >
            {loading ? (
              <>
                <div style={{
                  width: '14px', height: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid #fff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                กำลังค้นหา...
              </>
            ) : (
              <>
                <SearchIcon style={{ fontSize: '18px' }} />
                ค้นหา
              </>
            )}
          </button>

          {/* ✅ ปุ่มล้างค่า */}
          <button
            onClick={handleClearFilters}
            disabled={loading}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.3)',
              backgroundColor: 'transparent',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.3s ease',
              opacity: loading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ClearIcon style={{ fontSize: '18px' }} />
            ล้างค่า
          </button>

          <Chip
            icon={<FaWeight style={{ fontSize: '16px' }} />}
            label={`น้ำหนักรวม: ${totalWeight.toFixed(2)} กก.`}
            sx={{ backgroundColor: '#fff', color: '#1552F0', fontWeight: '600', fontSize: '14px', height: '42px', borderRadius: '12px', padding: '0 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', animation: 'pulse 2s infinite', '& .MuiChip-icon': { color: '#1552F0' } }}
          />
        </Box>

        {/* ✅ แจ้งเตือนเมื่อมีการเปลี่ยน filter แต่ยังไม่กดค้นหา */}
        {hasFetched && hasPendingFilters && (
          <Box sx={{
            marginTop: 2,
            padding: '8px 14px',
            backgroundColor: 'rgba(255,193,7,0.15)',
            border: '1px solid rgba(255,193,7,0.4)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: '#fff',
            fontSize: '13px',
          }}>
            <span style={{ fontSize: '16px' }}>💡</span>
            <span>คุณได้เปลี่ยนตัวกรองแล้ว — กดปุ่ม "ค้นหา" เพื่อโหลดข้อมูลใหม่</span>
          </Box>
        )}
      </Box>

      {/* Table */}
      <TableContainer
        style={{ padding: '0px 20px' }}
        sx={{
          height: 'calc(68vh)', overflowY: 'auto', whiteSpace: 'nowrap',
          '@media (max-width: 1200px)': { overflowX: 'scroll', minWidth: "200px" },
          '&::-webkit-scrollbar': { width: '8px', height: '8px' },
          '&::-webkit-scrollbar-track': { background: '#f1f1f1', borderRadius: '10px' },
          '&::-webkit-scrollbar-thumb': { background: '#1552F0', borderRadius: '10px', '&:hover': { background: '#1552F0' } }
        }}
      >
        <Table stickyHeader style={{ tableLayout: 'auto' }} sx={{ minWidth: '1270px', width: 'max-content' }}>
          <TableHead>
            <TableRow sx={{ height: '48px' }}>
              {displayColumns.map((header, index) => (
                <TableCell key={index} align="center"
                  style={{
                    backgroundColor: "#1552F0", borderTop: "1px solid #1552F0", borderBottom: "1px solid #1552F0",
                    borderLeft: index === 0 ? "1px solid #1552F0" : "1px solid rgba(255,255,255,0.1)",
                    borderRight: "1px solid rgba(255,255,255,0.1)",
                    fontSize: '14px', color: '#fff', padding: '12px', width: getColumnWidth(header), fontWeight: '600',
                    borderTopLeftRadius: index === 0 ? '12px' : '0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <Box style={{ fontSize: '15px', color: '#ffffff', letterSpacing: '0.3px', whiteSpace: 'pre-line' }}>
                    {(headerNames[header] || header).split('\n').map((line, i, arr) => (
                      <React.Fragment key={i}>{line}{i < arr.length - 1 && <br />}</React.Fragment>
                    ))}
                  </Box>
                </TableCell>
              ))}
              <TableCell align="center" style={{
                backgroundColor: "#1552F0", borderTop: "1px solid #1552F0", borderBottom: "1px solid #1552F0",
                borderLeft: "1px solid rgba(255,255,255,0.1)", borderRight: "1px solid #1552F0",
                fontSize: '14px', color: '#fff', padding: '12px', width: '100px', fontWeight: '600',
                borderTopRightRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <Box style={{ fontSize: '14px', color: '#ffffff', letterSpacing: '0.3px' }}>Trace Back</Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={{ '& > tr': { marginBottom: '8px' } }}>
            {filteredRows.length > 0 ? (
              filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <Row
                  key={index} row={row} columnWidths={columnWidths}
                  handleOpenModal={handleOpenModal} handleRowClick={handleRowClick}
                  handleOpenEditModal={handleOpenEditModal} handleOpenEditLineModal={handleOpenEditLineModal}
                  handleOpenDeleteModal={handleDeleteItemWithDelay} handleOpenSuccess={handleOpenSuccess}
                  handleConfirmRow={onConfirmRow} selectedColor={selectedColor}
                  openRowId={openRowId} index={index} setOpenRowId={setOpenRowId}
                  displayColumns={displayColumns}
                  handleOpenIngredientModal={handleOpenIngredientModal}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={displayColumns.length + 1} align="center"
                  sx={{ padding: "60px 20px", fontSize: "16px", color: "#90A4AE", fontWeight: '500' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    {!hasFetched ? (
                      <>
                        <SearchIcon sx={{ fontSize: '64px', color: '#BBDEFB' }} />
                        <span style={{ fontSize: '18px', fontWeight: '600', color: '#1552F0' }}>
                          เลือกตัวกรองและกดปุ่ม "ค้นหา" เพื่อแสดงข้อมูล
                        </span>
                        <span style={{ fontSize: '13px', color: '#90A4AE', maxWidth: '500px', lineHeight: '1.6' }}>
                          ระบบจะดึงข้อมูลตามเงื่อนไขที่เลือก เพื่อความเร็วในการโหลดและการแสดงผล
                        </span>
                      </>
                    ) : loading ? (
                      <>
                        <div style={{
                          width: '40px', height: '40px',
                          border: '3px solid #BBDEFB',
                          borderTop: '3px solid #1552F0',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }} />
                        <span>กำลังโหลดข้อมูล...</span>
                      </>
                    ) : (
                      <>
                        <SearchIcon sx={{ fontSize: '48px', color: '#BBDEFB' }} />
                        <span>ไม่พบข้อมูลตามเงื่อนไขที่เลือก</span>
                      </>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        sx={{
          borderTop: '1px solid #EAF0FF', backgroundColor: '#F5F8FF',
          "& .MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows, .MuiTablePagination-toolbar": { fontSize: '13px', color: "#546E7A", padding: "0px", fontWeight: '500' },
          "& .MuiTablePagination-select": { fontSize: '13px', color: "#1552F0", fontWeight: '600' },
          "& .MuiTablePagination-actions button": { color: "#1552F0", '&:hover': { backgroundColor: '#EAF0FF' } }
        }}
        rowsPerPageOptions={[100, 500, 1000]}
        component="div" count={filteredRows.length} rowsPerPage={rowsPerPage} page={page}
        onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="แถวต่อหน้า:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} จาก ${count}`}
      />

      {/* ─── PDF Preview Modal ─── */}
      {showPDFPreview && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', width: '95vw', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>

            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1552F0 0%, #0b0082 100%)',
              padding: '14px 20px', borderRadius: '16px 16px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <PictureAsPdfIcon style={{ color: '#fff', fontSize: '28px' }} />
                <div style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>ตรวจสอบก่อน Export PDF</div>
                {editedCount > 0 && (
                  <div style={{
                    backgroundColor: '#FFC107', color: '#4E2A00', borderRadius: '20px',
                    padding: '3px 12px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px'
                  }}>
                    <span style={{ fontSize: '14px' }}>✎</span>
                    แก้ไขแล้ว {editedCount} เซลล์
                  </div>
                )}
              </div>
              <IconButton onClick={() => {
                setShowPDFPreview(false);
                setSaveError('');
                setSaveSuccess(false);
                setEditedCells({});
                setSaveEditsError('');
                setSaveEditsSuccess('');
              }} sx={{ color: '#fff', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}>
                <ClearIcon />
              </IconButton>
            </div>

            {/* Info bar */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid #cdeeff', backgroundColor: '#F0F8FF', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px', fontWeight: '500' }}>Date <span style={{ color: '#1552F0' }}>*</span></label>
                  <input type="date" value={exportDate} onChange={(e) => setExportDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', color: '#333' }}
                    onFocus={(e) => { e.target.style.border = '2px solid #1552F0'; e.target.style.boxShadow = '0 0 0 3px rgba(0,166,255,0.1)'; }}
                    onBlur={(e) => { e.target.style.border = '1px solid #ddd'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px', fontWeight: '500' }}>Shift <span style={{ color: '#1552F0' }}>*</span></label>
                  <select value={exportShift} onChange={(e) => setExportShift(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', color: '#333', cursor: 'pointer' }}
                    onFocus={(e) => { e.target.style.border = '2px solid #1552F0'; }}
                    onBlur={(e) => { e.target.style.border = '1px solid #ddd'; }}
                  >
                    <option value="">-- เลือก Shift --</option>
                    <option value="DS">DS (Day Shift)</option>
                    <option value="NS">NS (Night Shift)</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px', fontWeight: '500' }}>Line <span style={{ color: '#1552F0' }}>*</span></label>
                  <SearchableLineDropdown value={exportLine} onChange={setExportLine} options={lineOptions} />
                </div>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px', fontWeight: '500' }}>Plant</label>
                  <input type="text" value={exportPlant} onChange={(e) => setExportPlant(e.target.value)} placeholder="ระบุ Plant (ถ้ามี)"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', color: '#333' }}
                    onFocus={(e) => { e.target.style.border = '2px solid #1552F0'; }}
                    onBlur={(e) => { e.target.style.border = '1px solid #ddd'; }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#666' }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '2px', backgroundColor: '#FFCDD2', border: '1px solid #FFCDD2' }} />
                  <span style={{ color: '#C62828', fontWeight: '600' }}>!</span>
                  <span>เกินกำหนด DBS</span>
                </div>
              </div>
            </div>

            {/* Preview Table */}
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1200px' }}>
                <thead>
                  <tr>
                    {displayColumns.map((col, i) => (
                      <th key={i} style={{
                        backgroundColor: '#1552F0', color: '#fff', padding: '10px 8px',
                        textAlign: 'center', fontWeight: '600', whiteSpace: 'nowrap',
                        border: '1px solid #0090e0', position: 'sticky', top: 0, zIndex: 10,
                        fontSize: '12px'
                      }}>
                        {headerNames[col] || col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.length > 0 ? (
                    previewData.map((row, rowIdx) => {
                      const m = getRemappedRow(row);
                      const sp = isSpecialGroup(row);
                      const cp = getSortedColdStoragePairs(row);

                      const s1 = parseStandardDBSToMinutes(row.DBS1 ?? row.dbs1);
                      const s2 = parseStandardDBSToMinutes(row.DBS2 ?? row.dbs2);
                      const s3 = parseStandardDBSToMinutes(row.DBS3 ?? row.dbs3);
                      const s4 = parseStandardDBSToMinutes(row.DBS4 ?? row.dbs4);
                      const c1 = calcDBS1Minutes(m, row);
                      const c2 = calcDBS2Minutes(m, sp);
                      const c3 = calcDBS3Minutes(m, sp);
                      const c4 = calcDBS4Minutes(m, sp, row);
                      const previewOverFlags = {
                        dbs1: s1 !== null && c1 !== null && c1 > s1,
                        dbs2: !sp && s2 !== null && c2 !== null && c2 > s2,
                        dbs3: !sp && s3 !== null && c3 !== null && c3 > s3,
                        dbs4: s4 !== null && c4 !== null && c4 > s4,
                      };

                      const rowBg = rowIdx % 2 === 0 ? '#fff' : '#F0F8FF';

                      return (
                        <tr key={rowIdx}>
                          {displayColumns.map((col, colIdx) => {
                            let cellValue;
                            switch (col) {
                              case 'dbs1': cellValue = calculateDBS1FromMapped(m, row); break;
                              case 'dbs2': cellValue = calculateDBS2FromMapped(m, sp); break;
                              case 'dbs3': cellValue = calculateDBS3FromMapped(m, sp); break;
                              case 'dbs4': cellValue = calculateDBS4FromMapped(m, sp, row); break;
                              case 'rmit_date': cellValue = m._A ?? ''; break;
                              case 'cold_slot_1_in':  cellValue = cp[0]?.in  ?? ''; break;
                              case 'cold_slot_1_out': cellValue = cp[0]?.out ?? ''; break;
                              case 'cold_slot_2_in':  cellValue = cp[1]?.in  ?? ''; break;
                              case 'cold_slot_2_out': cellValue = cp[1]?.out ?? ''; break;
                              case 'cold_slot_3_in':  cellValue = cp[2]?.in  ?? ''; break;
                              case 'cold_slot_3_out': cellValue = cp[2]?.out ?? ''; break;
                              case 'cold_slot_4_in':  cellValue = cp[3]?.in  ?? ''; break;
                              case 'cold_slot_4_out': cellValue = cp[3]?.out ?? ''; break;
                              case 'cold_slot_5_in':  cellValue = cp[4]?.in  ?? ''; break;
                              case 'cold_slot_5_out': cellValue = cp[4]?.out ?? ''; break;
                              case 'cold_slot_6_in':  cellValue = cp[5]?.in  ?? ''; break;
                              case 'cold_slot_6_out': cellValue = cp[5]?.out ?? ''; break;
                              case 'sc_pack_date': cellValue = m._F ?? ''; break;
                              case 'remark_dalay': cellValue = row.remark_dalay ?? ''; break;
                              default: cellValue = row[col] ?? '';
                            }

                            const isCalculated = ['dbs1', 'dbs2', 'dbs3', 'dbs4'].includes(col);
                            const isReadOnly = sp && ['come_cold_date_two', 'out_cold_date_two', 'come_cold_date_three', 'out_cold_date_three'].includes(col);
                            const isEditableDate = EDITABLE_DATE_FIELDS.includes(col) && !isReadOnly;
                            const isOver = previewOverFlags[col] === true;
                            const cellKey = `${rowIdx}_${col}`;
                            const isEdited = editedCells[cellKey] === true;

                            const getRawFieldValue = () => {
                              if (col === 'rmit_date') return row.rmit_date ?? '';
                              if (col === 'come_cold_date') return row.come_cold_date ?? '';
                              if (col === 'out_cold_date') return row.out_cold_date ?? '';
                              if (col === 'come_cold_date_two') return row.come_cold_date_two ?? '';
                              if (col === 'out_cold_date_two') return row.out_cold_date_two ?? '';
                              if (col === 'come_cold_date_three') return row.come_cold_date_three ?? '';
                              if (col === 'out_cold_date_three') return row.out_cold_date_three ?? '';
                              if (col === 'sc_pack_date') return row.sc_pack_date ?? '';
                              return cellValue;
                            };

                            const getCellBg = () => {
                              if (isOver) return '#FFF5F5';
                              if (isEdited) return '#FFFDE7';
                              return rowBg;
                            };
                            const getCellBorder = () => {
                              if (isOver) return '1px solid #FFCDD2';
                              if (isEdited) return '1px solid #FFC107';
                              return '1px solid #cdeeff';
                            };

                            return (
                              <td key={colIdx} style={{
                                padding: '3px 5px',
                                border: getCellBorder(),
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                backgroundColor: getCellBg(),
                                position: 'relative',
                                transition: 'background-color 0.2s',
                              }}>
                                {isEdited && (
                                  <span className="edit-dot" style={{
                                    position: 'absolute', top: '3px', right: '3px',
                                    width: '7px', height: '7px', borderRadius: '50%',
                                    backgroundColor: '#FFC107', display: 'inline-block',
                                    boxShadow: '0 0 3px rgba(255,193,7,0.8)',
                                    zIndex: 1,
                                  }} title="มีการแก้ไข (ยังไม่บันทึก)" />
                                )}

                                {isCalculated ? (
                                  <span style={{
                                    color: isOver ? '#C62828' : '#555',
                                    fontSize: '12px', fontWeight: isOver ? '700' : 'normal',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                  }}>
                                    {isOver && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: '15px', height: '15px', borderRadius: '50%',
                                        backgroundColor: '#D32F2F', color: '#fff',
                                        fontSize: '10px', fontWeight: '900', flexShrink: 0
                                      }}>!</span>
                                    )}
                                    {String(cellValue || '-')}
                                  </span>

                                ) : isEditableDate ? (
                                  <span style={{ fontSize: '12px', color: isOver ? '#C62828' : '#555' }}>
                                    {String(cellValue || '-')}
                                  </span>

                                ) : isReadOnly ? (
                                  <span style={{ color: '#bbb', fontSize: '12px' }}>-</span>

                                ) : (
                                  <input
                                    value={String(cellValue)}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPreviewData(prev => {
                                        const updated = [...prev];
                                        updated[rowIdx] = { ...updated[rowIdx], [col]: val };
                                        return updated;
                                      });
                                    }}
                                    style={{
                                      border: '1px solid transparent', borderRadius: '4px',
                                      padding: '4px 6px', fontSize: '13px', textAlign: 'center',
                                      width: '100%', minWidth: '80px',
                                      backgroundColor: 'transparent', outline: 'none',
                                    }}
                                    onFocus={(e) => {
                                      e.target.style.border = '1px solid #1552F0';
                                      e.target.style.backgroundColor = '#fff';
                                      e.target.style.boxShadow = '0 0 0 2px rgba(0,166,255,0.15)';
                                    }}
                                    onBlur={(e) => {
                                      e.target.style.border = '1px solid transparent';
                                      e.target.style.backgroundColor = 'transparent';
                                      e.target.style.boxShadow = 'none';
                                    }}
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={displayColumns.length} style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
                        ไม่มีข้อมูล
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Signature Section */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #cdeeff', backgroundColor: '#FFFAFA', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {[
                  { key: 'recordedBy', label: 'Recorded by', placeholder: 'ชื่อผู้บันทึก', sub: '(Production Staff)', required: true },
                  { key: 'reviewedBy', label: 'Reviewed by', placeholder: 'ชื่อผู้ตรวจสอบ', sub: '(Production Section Manager)', required: true },
                  { key: 'qcManager', label: 'QC Manager', placeholder: 'ชื่อผู้จัดการ QC', sub: '(Quality Control Section Manager)', required: false },
                ].map(({ key, label, placeholder, sub, required }) => (
                  <div key={key} style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px', fontWeight: '500' }}>
                      {label} {required && <span style={{ color: '#1552F0' }}>*</span>}
                    </label>
                    <input type="text" value={signatureData[key]}
                      onChange={(e) => { const val = e.target.value; setSignatureData(prev => ({ ...prev, [key]: val })); }}
                      placeholder={placeholder}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', color: '#333' }}
                      onFocus={(e) => { e.target.style.border = '2px solid #1552F0'; }}
                      onBlur={(e) => { e.target.style.border = '1px solid #ddd'; }}
                    />
                    <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 24px', borderTop: '1px solid #cdeeff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: '12px', backgroundColor: '#FFF8F8',
              borderRadius: '0 0 16px 16px', flexShrink: 0, flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {saveEditsError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: '#b71c1c', fontSize: '13px', backgroundColor: '#FFEBEE',
                    padding: '7px 12px', borderRadius: '8px', border: '1px solid #FFCDD2',
                    animation: 'fadeIn 0.3s ease'
                  }}>
                    <ClearIcon style={{ fontSize: '15px' }} />
                    {saveEditsError}
                  </div>
                )}
                {saveEditsSuccess && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: '#1B5E20', fontSize: '13px', backgroundColor: '#E8F5E9',
                    padding: '7px 12px', borderRadius: '8px', border: '1px solid #C8E6C9',
                    animation: 'fadeIn 0.3s ease'
                  }}>
                    ✓ {saveEditsSuccess}
                  </div>
                )}
                {saveError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: '#0b0082', fontSize: '13px', backgroundColor: '#ffffff',
                    padding: '7px 12px', borderRadius: '8px', border: '1px solid #cdeeff',
                    animation: 'fadeIn 0.3s ease'
                  }}>
                    <ClearIcon style={{ fontSize: '15px' }} />
                    {saveError}
                  </div>
                )}
                {saveSuccess && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: '#2E7D32', fontSize: '13px', backgroundColor: '#E8F5E9',
                    padding: '7px 12px', borderRadius: '8px', border: '1px solid #C8E6C9',
                    animation: 'fadeIn 0.3s ease'
                  }}>
                    ✓ บันทึกรายชื่อสำเร็จ กำลังสร้าง PDF...
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => {
                    setShowPDFPreview(false);
                    setSaveError('');
                    setSaveSuccess(false);
                    setEditedCells({});
                    setSaveEditsError('');
                    setSaveEditsSuccess('');
                  }}
                  disabled={isSaving || isSavingEdits}
                  style={{
                    padding: '10px 20px', borderRadius: '10px', border: '1px solid #ddd',
                    backgroundColor: '#fff', cursor: (isSaving || isSavingEdits) ? 'not-allowed' : 'pointer',
                    fontSize: '14px', color: '#666',
                    opacity: (isSaving || isSavingEdits) ? 0.6 : 1,
                  }}
                >
                  ยกเลิก
                </button>

                <button
                  onClick={async () => {
                    if (!exportDate) { setSaveError('กรุณาระบุวันที่'); return; }
                    if (!exportShift) { setSaveError('กรุณาเลือก Shift'); return; }
                    if (!exportLine) { setSaveError('กรุณาเลือก Line'); return; }
                    if (!signatureData.recordedBy) { setSaveError('กรุณาระบุผู้บันทึก (Recorded by)'); return; }
                    if (!signatureData.reviewedBy) { setSaveError('กรุณาระบุผู้ตรวจสอบ (Reviewed by)'); return; }

                    if (editedCount > 0) {
                      const ok = window.confirm(`มีการแก้ไขเวลา ${editedCount} เซลล์ที่ยังไม่ได้บันทึกลงฐานข้อมูล\nต้องการบันทึกก่อน Export PDF หรือไม่?`);
                      if (ok) {
                        await saveEditedRows();
                      }
                    }

                    setSaveError(''); setSaveSuccess(false); setIsSaving(true);
                    try {
                      await saveSignatureToAPI(signatureData, previewData);
                      setSaveSuccess(true);
                      await new Promise(resolve => setTimeout(resolve, 800));
                      await exportToPDFWithData(previewData, signatureData);
                      setShowPDFPreview(false);
                      setSaveSuccess(false);
                      setEditedCells({});
                      setSaveEditsError('');
                      setSaveEditsSuccess('');
                    } catch (err) {
                      console.error('Error:', err);
                      setSaveError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  disabled={isSaving || isSavingEdits}
                  style={{
                    padding: '10px 24px', borderRadius: '10px', border: 'none',
                    background: (isSaving || isSavingEdits)
                      ? 'linear-gradient(135deg, #90CAF9 0%, #5C6BC0 100%)'
                      : 'linear-gradient(135deg, #1552F0 0%, #0b0082 100%)',
                    color: '#fff',
                    cursor: (isSaving || isSavingEdits) ? 'not-allowed' : 'pointer',
                    fontSize: '14px', fontWeight: '600',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    minWidth: '180px', justifyContent: 'center',
                  }}
                >
                  {isSaving ? (
                    <>
                      <div style={{
                        width: '16px', height: '16px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid #fff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }} />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <PictureAsPdfIcon style={{ fontSize: '18px' }} />
                      บันทึก & Export PDF
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      <IngredientModal
        open={ingredientModalOpen}
        onClose={() => setIngredientModalOpen(false)}
        idIgd={ingredientIdIgd}
        idIgdNo={ingredientIdIgdNo}
        data={ingredientData}
        loading={ingredientLoading}
        error={ingredientError}
        slipData={traceBackSlipData}
        slipLoading={traceBackSlipLoading}
        slipError={traceBackSlipError}
      />
    </Paper>
  );
};

export default withTableTools(TableMainPrep);