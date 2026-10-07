import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Table, TableContainer, TableHead, TableBody, TableRow, TableCell,
  Paper, Box, TextField, TablePagination, Chip, Checkbox, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
} from '@mui/material';
import { LiaShoppingCartSolid } from 'react-icons/lia';
import { InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/EditOutlined";
import Close from "@mui/icons-material/Close";
import QrCodeScanner from "@mui/icons-material/QrCodeScanner";
import { FaRegCheckCircle, FaWeight } from "react-icons/fa";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ClearIcon from '@mui/icons-material/Clear';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import QrScanner from 'qr-scanner';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';

const API_URL = import.meta.env.VITE_API_URL;

const CUSTOM_COLUMN_WIDTHS = {
  checkbox: '60px',
  weight: '120px',
  cart: '40px',
  edit: '40px',
  delete: '40px'
};

// ─────────────────────────────────────────────
// ✅ COLD STORAGE HELPER — รวม 6 รอบ (come/out ×3 + cs_come/cs_out ×3)
//    แล้วเรียงตามวันที่ "เข้า" ห้องเย็น จากเก่าไปใหม่
// ─────────────────────────────────────────────
const getSortedColdStoragePairs = (row) => {
  const candidates = [
    { in: row.come_cold_date,          out: row.out_cold_date          },
    { in: row.come_cold_date_two,      out: row.out_cold_date_two      },
    { in: row.come_cold_date_three,    out: row.out_cold_date_three    },
    { in: row.cs_come_cold_date,       out: row.cs_out_cold_date       },
    { in: row.cs_come_cold_date_two,   out: row.cs_out_cold_date_two   },
    { in: row.cs_come_cold_date_three, out: row.cs_out_cold_date_three },
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

// ─────────────────────────────────────────────
// SearchableDropdown
// ─────────────────────────────────────────────
const SearchableDropdown = ({ options, value, onChange, placeholder }) => {
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

  const handleSelect = (option) => {
    onChange(option);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onChange('');
    setSearchTerm('');
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '200px' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          border: value ? '2px solid #1552F0' : '1px solid #E3E8F2',
          borderRadius: '12px',
          cursor: 'pointer',
          backgroundColor: '#fff',
          height: '42px',
          fontSize: '14px',
          color: value ? '#1552F0' : '#999',
          transition: 'all 0.3s ease',
          boxShadow: isOpen ? '0 4px 12px rgba(33, 150, 243, 0.15)' : 'none'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: value ? '500' : '400' }}>
          {value || placeholder}
        </span>
        <KeyboardArrowDownIcon
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
            color: value ? '#1552F0' : '#666'
          }}
        />
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '48px',
            left: 0,
            right: 0,
            backgroundColor: '#fff',
            border: '1px solid #E3E8F2',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            zIndex: 1000,
            maxHeight: '320px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideDown 0.2s ease'
          }}
        >
          <div style={{ padding: '10px' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="ค้นหา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ fontSize: '18px', color: '#999' }} />
                  </InputAdornment>
                ),
                sx: { height: '38px', fontSize: '13px', borderRadius: '8px' }
              }}
            />
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '270px' }}>
            {value && (
              <div
                onClick={handleClear}
                style={{
                  padding: '12px 14px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#ff4444',
                  borderBottom: '1px solid #f0f0f0',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff3f3'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <ClearIcon style={{ fontSize: '16px' }} />
                <span>ล้างตัวกรอง</span>
              </div>
            )}

            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={index}
                  onClick={() => handleSelect(option)}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#333',
                    backgroundColor: value === option ? '#EAF0FF' : 'transparent',
                    borderBottom: index < filteredOptions.length - 1 ? '1px solid #f0f0f0' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (value !== option) e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    if (value !== option) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {option}
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 14px', fontSize: '13px', color: '#999', textAlign: 'center' }}>
                ไม่พบข้อมูล
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// QR Scanner
// ─────────────────────────────────────────────
const QrScannerView = ({ onScan, onError }) => {
  const videoRef = useRef(null);
  useEffect(() => {
    if (!videoRef.current) return;
    const scanner = new QrScanner(videoRef.current, (result) => {
      const text = typeof result === 'object' ? result.data : result;
      if (text) onScan(text);
    }, {
      preferredCamera: 'environment',
      highlightScanRegion: true,
      returnDetailedScanResult: true,
      onDecodeError: () => {},
    });
    scanner.start().catch((err) => onError(err.message || 'ไม่สามารถเข้าถึงกล้องได้'));
    return () => { scanner.stop(); scanner.destroy(); };
  }, []);
  return <video ref={videoRef} style={{ width: '100%', display: 'block', borderRadius: '6px' }} muted playsInline />;
};

const QrScanDialog = ({ open, onClose, onScan, title }) => {
  const [error, setError] = useState('');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid #E3E8F2' }}>
        <Box sx={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: 1 }}>
          <QrCodeScanner sx={{ color: '#1552F0' }} />
          {title}
        </Box>
        <IconButton onClick={onClose} size="small"><Close fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ p: 2 }}>
        {open && <QrScannerView onScan={(text) => { onScan(text); onClose(); }} onError={setError} />}
        {error && <Box sx={{ mt: 1, color: '#c62828', fontSize: '12px' }}>❌ {error}</Box>}
      </Box>
    </Dialog>
  );
};

// ─────────────────────────────────────────────
// Action Cell Components
// ─────────────────────────────────────────────
const ActionCell = ({ width, onClick, icon, backgroundColor, hoverColor, iconColor }) => (
  <TableCell
    style={{
      width,
      textAlign: 'center',
      borderTop: '1px solid #EAF0FF',
      borderBottom: '1px solid #EAF0FF',
      borderLeft: '1px solid #EAF0FF',
      height: '48px',
      padding: '0px',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease-in-out',
      backgroundColor
    }}
    onClick={onClick}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = hoverColor;
      const svg = e.currentTarget.querySelector('svg');
      if (svg) svg.style.color = '#fff';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = backgroundColor;
      const svg = e.currentTarget.querySelector('svg');
      if (svg) svg.style.color = iconColor;
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      {icon}
    </div>
  </TableCell>
);

// ─────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────
const Row = ({
  row,
  columnWidths,
  handleOpenEditModal,
  handleOpenDeleteModal,
  handleOpenEditLineModal,
  handleOpenSuccess,
  openRowId,
  setOpenRowId,
  index,
  displayColumns,
  isSelected,
  onSelectRow,
  weight,
  onWeightChange,
  isConfirmed
}) => {
  const backgroundColor = index % 2 === 0 ? '#ffffff' : '#F0F8FF';

  const [localWeight, setLocalWeight] = useState(weight || row.weight || '');
  const [weightError, setWeightError] = useState('');

  useEffect(() => {
    setLocalWeight(weight || row.weight || '');
  }, [weight, row.weight]);

  const handleWeightChange = (value) => {
    setLocalWeight(value);
    if (!value || parseFloat(value) <= 0) {
      setWeightError('น้ำหนักต้องมากกว่า 0');
      onWeightChange(row.mapping_id, '');
    } else {
      setWeightError('');
      onWeightChange(row.mapping_id, value);
    }
  };

  // ✅ รวม cold storage 6 รอบ (เรียงตามวันที่เข้าห้องเย็น)
  const sortedColdPairs = getSortedColdStoragePairs(row);

  const displayRow = {};
  displayColumns.forEach(col => {
    switch (col) {
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
      default:
        displayRow[col] = row[col];
    }
  });

  return (
    <>
      <TableRow>
        <TableCell style={{ height: '7px', padding: '0px', border: '0px solid' }} />
      </TableRow>

      <TableRow
        style={{
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          backgroundColor: isSelected ? '#EAF0FF' : 'transparent'
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.querySelectorAll('td').forEach(cell => {
              cell.style.backgroundColor = index % 2 === 0 ? '#F5F9FF' : '#E8F4FF';
            });
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.querySelectorAll('td').forEach(cell => {
              cell.style.backgroundColor = backgroundColor;
            });
          }
        }}
      >
        {/* Checkbox */}
        <TableCell
          align="center"
          style={{
            width: CUSTOM_COLUMN_WIDTHS.checkbox,
            borderLeft: '1px solid #EAF0FF',
            borderTop: '1px solid #EAF0FF',
            borderBottom: '1px solid #EAF0FF',
            padding: '0px',
            backgroundColor: isSelected ? '#EAF0FF' : backgroundColor,
            transition: 'background-color 0.2s ease'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onChange={() => onSelectRow(row.mapping_id)}
            disabled={isConfirmed}
            sx={{
              color: '#1552F0',
              '&.Mui-checked': { color: '#1552F0' }
            }}
          />
        </TableCell>

        {/* Data Columns */}
        {Object.entries(displayRow).map(([key, value], idx) => (
          <TableCell
            key={idx}
            align="center"
            style={{
              width: columnWidths[idx],
              borderLeft: '1px solid #EAF0FF',
              borderTop: '1px solid #EAF0FF',
              borderBottom: '1px solid #EAF0FF',
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: '14px',
              height: '48px',
              lineHeight: '1.5',
              padding: '0px 12px',
              color: '#353535',
              backgroundColor: isSelected ? '#EAF0FF' : backgroundColor,
              transition: 'background-color 0.2s ease'
            }}
            onClick={() => setOpenRowId(openRowId === row.rmfp_id ? null : row.rmfp_id)}
          >
            {value || '-'}
          </TableCell>
        ))}

        {/* Weight Input */}
        <TableCell
          align="center"
          style={{
            width: CUSTOM_COLUMN_WIDTHS.weight,
            borderLeft: '1px solid #EAF0FF',
            borderTop: '1px solid #EAF0FF',
            borderBottom: '1px solid #EAF0FF',
            fontSize: '14px',
            height: '48px',
            padding: '5px',
            backgroundColor: isSelected ? '#EAF0FF' : backgroundColor,
            transition: 'background-color 0.2s ease'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {isConfirmed ? (
            <span style={{ color: '#28a745', fontWeight: 'bold' }}>{localWeight || '-'}</span>
          ) : (
            <TextField
              type="number"
              value={localWeight}
              onChange={(e) => handleWeightChange(e.target.value)}
              error={!!weightError}
              helperText={weightError}
              disabled={!isSelected}
              InputProps={{
                sx: {
                  height: '35px',
                  fontSize: '13px',
                  backgroundColor: isSelected ? '#fff' : '#F5F8FF'
                }
              }}
              sx={{
                width: '100%',
                '& .MuiOutlinedInput-root': { height: '35px', fontSize: '13px' },
                '& input': { padding: '6px', textAlign: 'center' }
              }}
            />
          )}
        </TableCell>

        {/* Cart */}
        <ActionCell
          width={CUSTOM_COLUMN_WIDTHS.cart}
          onClick={(e) => { e.stopPropagation(); handleOpenEditModal(row); }}
          icon={<LiaShoppingCartSolid style={{ color: '#1552F0', fontSize: '22px' }} />}
          backgroundColor={isSelected ? '#EAF0FF' : backgroundColor}
          hoverColor="#1552F0"
          iconColor="#1552F0"
        />

        {/* Edit */}
        <ActionCell
          width={CUSTOM_COLUMN_WIDTHS.edit}
          onClick={(e) => { e.stopPropagation(); handleOpenEditLineModal(row); }}
          icon={<EditIcon style={{ color: '#ffc107', fontSize: '22px' }} />}
          backgroundColor={isSelected ? '#EAF0FF' : backgroundColor}
          hoverColor="#ffc107"
          iconColor="#ffc107"
        />

        {/* Delete / Confirm */}
        <ActionCell
          width={CUSTOM_COLUMN_WIDTHS.delete}
          onClick={(e) => { e.stopPropagation(); handleOpenDeleteModal(row); }}
          icon={<FaRegCheckCircle style={{ color: '#ff0000', fontSize: '22px' }} />}
          backgroundColor={isSelected ? '#EAF0FF' : backgroundColor}
          hoverColor="#ff4444"
          iconColor="#ff0000"
        />
      </TableRow>

      <TableRow>
        <TableCell style={{ padding: '0px', border: '0px solid' }} />
      </TableRow>
    </>
  );
};

// ─────────────────────────────────────────────
// WoBasketEntryRow — 1 แถวของ WONo + ช่วง Basket
// ─────────────────────────────────────────────
const EMPTY_WO_ENTRY = () => ({ wo_no: '', basket_from: '', basket_to: '' });

const WoBasketEntryRow = ({ entry, index, onChange, onRemove, onScanWo, canRemove }) => {
  const set = (field, val) => onChange(index, { ...entry, [field]: val });
  return (
    <Box sx={{
      display: 'flex', gap: 1, alignItems: 'flex-start', marginBottom: 1.5,
      padding: '10px', backgroundColor: '#F5F8FF', borderRadius: '10px', border: '1px solid #EAF0FF'
    }}>
      {/* Input 1: WONo */}
      <Box sx={{ flex: 2 }}>
        <Box sx={{ fontSize: '11px', color: '#666', marginBottom: 0.5 }}>WONo</Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <TextField
            fullWidth size="small" value={entry.wo_no}
            onChange={(e) => set('wo_no', e.target.value)}
            placeholder="พิมพ์ หรือ Scan WONo..."
            InputProps={{ sx: { height: '38px', fontSize: '13px', borderRadius: '8px', backgroundColor: '#fff' } }}
            sx={{ '& .MuiOutlinedInput-root': { height: '38px' }, '& input': { padding: '8px 10px' } }}
          />
          <IconButton
            onClick={() => onScanWo(index)}
            size="small"
            sx={{ border: '1.5px solid #1552F0', borderRadius: '8px', color: '#1552F0', width: '38px', height: '38px' }}
          >
            <QrCodeScanner fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Input 2: Basket จาก */}
      <Box sx={{ flex: 1 }}>
        <Box sx={{ fontSize: '11px', color: '#666', marginBottom: 0.5 }}>Basket (จาก)</Box>
        <TextField
          fullWidth size="small" type="number" value={entry.basket_from}
          onChange={(e) => set('basket_from', e.target.value)}
          placeholder="เช่น 3"
          InputProps={{ sx: { height: '38px', fontSize: '13px', borderRadius: '8px', backgroundColor: '#fff' } }}
          sx={{ '& .MuiOutlinedInput-root': { height: '38px' }, '& input': { padding: '8px 10px' } }}
        />
      </Box>

      {/* Input 3: Basket ถึง (ไม่บังคับ — ถ้าไม่กรอกถือว่ามี basket เดียว) */}
      <Box sx={{ flex: 1 }}>
        <Box sx={{ fontSize: '11px', color: '#666', marginBottom: 0.5 }}>Basket (ถึง)</Box>
        <TextField
          fullWidth size="small" type="number" value={entry.basket_to}
          onChange={(e) => set('basket_to', e.target.value)}
          placeholder="ไม่บังคับ"
          InputProps={{ sx: { height: '38px', fontSize: '13px', borderRadius: '8px', backgroundColor: '#fff' } }}
          sx={{ '& .MuiOutlinedInput-root': { height: '38px' }, '& input': { padding: '8px 10px' } }}
        />
      </Box>

      {/* ลบแถว */}
      <Box sx={{ paddingTop: '20px' }}>
        <IconButton
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          size="small"
          sx={{ color: canRemove ? '#f44336' : '#ccc' }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
};

// ─────────────────────────────────────────────
// MultiConfirmDialog
// ─────────────────────────────────────────────
const MultiConfirmDialog = ({
  open, onClose, selectedCount, onConfirm,
  group, setGroup, prepDateTime, setPrepDateTime,
  remark, setRemark,
  woEntries, setWoEntries,
  matPkg, setMatPkg,
  errors
}) => {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrField, setQrField] = useState(null); // { type: 'wo', index } หรือ { type: 'matPkg' }

  const handleQrScan = (text) => {
    if (qrField?.type === 'wo') {
      const updated = [...woEntries];
      updated[qrField.index] = { ...updated[qrField.index], wo_no: text.trim() };
      setWoEntries(updated);
    } else if (qrField?.type === 'matPkg') {
      setMatPkg(text.trim());
    }
    setQrOpen(false);
  };

  const openQrForWo = (index) => { setQrField({ type: 'wo', index }); setQrOpen(true); };
  const openQrForMatPkg = () => { setQrField({ type: 'matPkg' }); setQrOpen(true); };

  const handleEntryChange = (index, newEntry) => {
    const updated = [...woEntries];
    updated[index] = newEntry;
    setWoEntries(updated);
  };

  const handleAddEntry = () => setWoEntries([...woEntries, EMPTY_WO_ENTRY()]);
  const handleRemoveEntry = (index) => {
    if (woEntries.length <= 1) return;
    setWoEntries(woEntries.filter((_, i) => i !== index));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: '16px', boxShadow: '0 8px 32px rgba(33, 150, 243, 0.2)' }
      }}
    >
      <DialogTitle sx={{
        background: 'linear-gradient(135deg, #1552F0 0%, #1552F0 100%)',
        color: '#fff', fontSize: '18px', fontWeight: '600', padding: '20px 24px'
      }}>
        ยืนยันข้อมูลสำหรับ {selectedCount} รายการ
      </DialogTitle>

      <DialogContent sx={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* หม้อที่ */}
        <Box>
          <Box sx={{ marginBottom: 1, color: '#333', fontSize: '14px', fontWeight: '500' }}>
            หม้อที่ <span style={{ color: '#f44336' }}>*</span>
          </Box>
          <TextField
            fullWidth type="number" value={group}
            onChange={(e) => setGroup(e.target.value)}
            error={!!errors.group} helperText={errors.group}
            placeholder="กรุณาระบุหม้อที่"
            InputProps={{ sx: { height: '44px', fontSize: '14px', borderRadius: '8px' } }}
            sx={{ '& .MuiOutlinedInput-root': { height: '44px', fontSize: '14px' }, '& input': { padding: '10px 14px' } }}
          />
        </Box>

        {/* เวลาบรรจุเสร็จ */}
        <Box>
          <Box sx={{ marginBottom: 1, color: '#333', fontSize: '14px', fontWeight: '500' }}>
            เวลาบรรจุเสร็จ <span style={{ color: '#f44336' }}>*</span>
          </Box>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateTimePicker
              ampm={false} minutesStep={1} timeSteps={{ minutes: 1 }} maxDateTime={dayjs()}
              value={prepDateTime ? dayjs(prepDateTime) : null}
              onChange={(newValue) => setPrepDateTime(newValue ? newValue.format('YYYY-MM-DDTHH:mm') : '')}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.prepDateTime, helperText: errors.prepDateTime,
                  sx: {
                    '& .MuiOutlinedInput-root': { height: '44px', fontSize: '14px', borderRadius: '8px' },
                    '& input': { padding: '10px 14px' }
                  }
                }
              }}
            />
          </LocalizationProvider>
        </Box>

        {/* หมายเหตุ */}
        <Box>
          <Box sx={{ marginBottom: 1, color: '#333', fontSize: '14px', fontWeight: '500' }}>หมายเหตุ</Box>
          <TextField
            fullWidth multiline rows={3} value={remark}
            onChange={(e) => { if (e.target.value.length <= 300) setRemark(e.target.value); }}
            error={!!errors.remark} helperText={errors.remark || `${remark.length}/300`}
            placeholder="ระบุหมายเหตุ (ถ้ามี)..."
            InputProps={{ sx: { fontSize: '14px', borderRadius: '8px' } }}
            sx={{
              '& .MuiOutlinedInput-root': { fontSize: '14px' },
              '& .MuiFormHelperText-root': { textAlign: 'right', marginRight: 0, color: remark.length >= 300 ? '#f44336' : '#999' }
            }}
          />
        </Box>

        {/* รหัส Ingrediant (WONO) — รองรับหลายชุด แต่ละชุดมี WONo + ช่วง Basket */}
        <Box>
          <Box sx={{ marginBottom: 1, color: '#333', fontSize: '14px', fontWeight: '500' }}>
            รหัส Ingrediant (WONO)
          </Box>
          {woEntries.map((entry, index) => (
            <WoBasketEntryRow
              key={index}
              entry={entry}
              index={index}
              onChange={handleEntryChange}
              onRemove={handleRemoveEntry}
              onScanWo={openQrForWo}
              canRemove={woEntries.length > 1}
            />
          ))}
          <Button
            onClick={handleAddEntry}
            startIcon={<AddCircleOutlineIcon />}
            sx={{ color: '#1552F0', textTransform: 'none', fontSize: '13px' }}
          >
            เพิ่มชุด WONo
          </Button>
          {errors.woEntries && (
            <Box sx={{ color: '#f44336', fontSize: '12px', marginTop: 0.5 }}>{errors.woEntries}</Box>
          )}
        </Box>

        {/* รหัส Package */}
        <Box>
          <Box sx={{ marginBottom: 1, color: '#333', fontSize: '14px', fontWeight: '500' }}>รหัส Package</Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth value={matPkg} onChange={(e) => setMatPkg(e.target.value)}
              placeholder="พิมพ์ หรือ Scan รหัส Package..."
              InputProps={{ sx: { height: '44px', fontSize: '14px', borderRadius: '8px' } }}
              sx={{ '& .MuiOutlinedInput-root': { height: '44px', fontSize: '14px' }, '& input': { padding: '10px 14px' } }}
            />
            <IconButton
              onClick={openQrForMatPkg}
              sx={{ border: '1.5px solid #1552F0', borderRadius: '8px', color: '#1552F0', width: '44px', height: '44px', '&:hover': { backgroundColor: '#EAF0FF' } }}
            >
              <QrCodeScanner />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ padding: '16px', backgroundColor: '#EAF0FF', borderRadius: '8px', fontSize: '13px', color: '#1552F0' }}>
          <strong>หมายเหตุ:</strong> น้ำหนักของแต่ละรายการจะถูกใช้ตามที่ระบุในแต่ละแถว
        </Box>
      </DialogContent>

      <DialogActions sx={{ padding: '16px 24px', gap: 1 }}>
        <Button
          onClick={onClose}
          sx={{ color: '#666', borderRadius: '8px', padding: '8px 20px', textTransform: 'none', fontSize: '14px', '&:hover': { backgroundColor: '#F5F8FF' } }}
        >
          ยกเลิก
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{
            background: 'linear-gradient(135deg, #1552F0 0%, #1552F0 100%)',
            borderRadius: '8px', padding: '8px 24px', textTransform: 'none', fontSize: '14px',
            boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)',
            '&:hover': { background: 'linear-gradient(135deg, #1552F0 0%, #0F3FC4 100%)', boxShadow: '0 6px 16px rgba(33, 150, 243, 0.4)' }
          }}
        >
          ยืนยันทั้งหมด
        </Button>
      </DialogActions>

      <QrScanDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onScan={handleQrScan}
        title={qrField?.type === 'wo' ? `Scan WONo (ชุดที่ ${(qrField.index ?? 0) + 1})` : 'Scan รหัส Package'}
      />
    </Dialog>
  );
};

// ─────────────────────────────────────────────
// TableMainPrep (Main)
// ─────────────────────────────────────────────
const TableMainPrep = ({
  data,
  handleOpenEditModal,
  handleOpenDeleteModal,
  handleOpenEditLineModal,
  handleOpenSuccess,
  onConfirmRow
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRows, setFilteredRows] = useState(data);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [openRowId, setOpenRowId] = useState(null);
  const [selectedDocNo, setSelectedDocNo] = useState('');

  const [selectedRows, setSelectedRows] = useState([]);
  const [rowWeights, setRowWeights] = useState({});
  const [showMultiDialog, setShowMultiDialog] = useState(false);
  const [multiGroup, setMultiGroup] = useState('');
  const [multiPrepDateTime, setMultiPrepDateTime] = useState('');
  const [multiRemark, setMultiRemark] = useState('');
  const [multiWoEntries, setMultiWoEntries] = useState([EMPTY_WO_ENTRY()]);
  const [multiMatPkg, setMultiMatPkg] = useState('');
  const [multiErrors, setMultiErrors] = useState({ group: '', prepDateTime: '', remark: '', woEntries: '' });

  // ✅ เพิ่มคอลัมน์ cold storage ทั้ง 6 รอบ (แทนของเดิมที่มีแค่ 2 รอบ)
  const displayColumns = [
    'batch_after', 'mat_name', 'production', 'rmit_date',
    'cold_slot_1_in', 'cold_slot_1_out',
    'cold_slot_2_in', 'cold_slot_2_out',
    'cold_slot_3_in', 'cold_slot_3_out',
    'cold_slot_4_in', 'cold_slot_4_out',
    'cold_slot_5_in', 'cold_slot_5_out',
    'cold_slot_6_in', 'cold_slot_6_out',
    'weight_RM'
  ];

  const uniqueDocNos = [...new Set(data.map(row => row.doc_no).filter(Boolean))].sort();

  const totalWeight = filteredRows.reduce((sum, row) => sum + (parseFloat(row.weight_RM) || 0), 0);

  // ✅ Filter effect
  useEffect(() => {
    let filtered = data;

    if (searchTerm) {
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (selectedDocNo) {
      filtered = filtered.filter(row => row.doc_no === selectedDocNo);
    }

    setFilteredRows(filtered);
    setPage(0);
  }, [searchTerm, data, selectedDocNo]);

  const handleSelectRow = (mappingId) => {
    setSelectedRows(prev => {
      if (prev.includes(mappingId)) {
        setRowWeights(prevWeights => {
          const newWeights = { ...prevWeights };
          delete newWeights[mappingId];
          return newWeights;
        });
        return prev.filter(id => id !== mappingId);
      }
      return [...prev, mappingId];
    });
  };

  const handleWeightChange = (mappingId, weight) => {
    setRowWeights(prev => ({ ...prev, [mappingId]: weight }));
  };

  const unconfirmedRows = filteredRows.filter(row => !row.sc_pack_date || row.sc_pack_date === '-');
  const allSelected = selectedRows.length > 0 && selectedRows.length === unconfirmedRows.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedRows([]);
      setRowWeights({});
    } else {
      setSelectedRows(unconfirmedRows.map(row => row.mapping_id));
    }
  };

  const handleOpenMultiDialog = () => {
    const missingWeights = selectedRows.filter(id => !rowWeights[id] || parseFloat(rowWeights[id]) <= 0);
    if (missingWeights.length > 0) {
      alert('กรุณากรอกน้ำหนักให้ครบทุกแถวที่เลือก');
      return;
    }
    setShowMultiDialog(true);
  };

  const validateMultiInputs = () => {
    const newErrors = { group: '', prepDateTime: '', remark: '', woEntries: '' };
    let isValid = true;

    if (isNaN(Number(multiGroup)) || Number(multiGroup) <= 0) {
      newErrors.group = 'ต้องมีค่ามากกว่า 0';
      isValid = false;
    }

    if (!multiPrepDateTime) {
      newErrors.prepDateTime = 'กรุณาระบุเวลา';
      isValid = false;
    } else if (new Date(multiPrepDateTime) > new Date()) {
      newErrors.prepDateTime = 'เวลาต้องไม่เป็นอนาคต';
      isValid = false;
    }

    if (multiRemark && multiRemark.length > 300) {
      newErrors.remark = 'หมายเหตุต้องไม่เกิน 300 ตัวอักษร';
      isValid = false;
    }

    // WONo entries: ทุกแถวที่กรอก wo_no ต้องมี basket_from ด้วย (ถ้าแถวว่างทั้งคู่จะข้าม ไม่บังคับ)
    const filledEntries = multiWoEntries.filter(e => e.wo_no || e.basket_from || e.basket_to);
    for (const e of filledEntries) {
      if (!e.wo_no || e.basket_from === '' || e.basket_from == null) {
        newErrors.woEntries = 'กรุณากรอก WONo และ Basket (จาก) ให้ครบทุกชุดที่เพิ่มไว้';
        isValid = false;
        break;
      }
      if (e.basket_to !== '' && e.basket_to != null && Number(e.basket_to) < Number(e.basket_from)) {
        newErrors.woEntries = 'Basket (ถึง) ต้องมีค่ามากกว่าหรือเท่ากับ Basket (จาก)';
        isValid = false;
        break;
      }
    }

    setMultiErrors(newErrors);
    return isValid;
  };

  const handleMultiConfirm = async () => {
    if (!validateMultiInputs()) return;

    // เอาเฉพาะชุดที่กรอกข้อมูลจริง (ตัดแถวว่างเปล่าที่เผื่อไว้ทิ้ง)
    const woEntriesToSave = multiWoEntries
      .filter(e => e.wo_no && e.basket_from !== '' && e.basket_from != null)
      .map(e => ({
        wo_no: e.wo_no.trim(),
        basket_from: parseInt(e.basket_from, 10),
        basket_to: (e.basket_to !== '' && e.basket_to != null) ? parseInt(e.basket_to, 10) : null,
      }));

    try {
      await Promise.all(
        selectedRows.map(async (mappingId) => {
          // 1) บันทึกข้อมูลยืนยันหลักตามเดิม (ผ่าน prop onConfirmRow ที่มีอยู่แล้ว)
          await onConfirmRow({
            mapping_id: mappingId,
            weight: Number(rowWeights[mappingId]),
            group: Number(multiGroup),
            sc_pack_date: multiPrepDateTime,
            remark_dalay: multiRemark?.trim() || null,
            mat_pkg: multiMatPkg?.trim() || null,
          });

          // 2) บันทึกชุด WONo/Basket (หลายชุด) ลงตารางใหม่ HistoryIngredientWO
          if (woEntriesToSave.length > 0) {
            await axios.post(`${API_URL}/api/pack/ingredient/wo-mapping`, {
              mapping_id: mappingId,
              entries: woEntriesToSave,
            });
          }
        })
      );

      setSelectedRows([]);
      setRowWeights({});
      setMultiGroup('');
      setMultiPrepDateTime('');
      setMultiRemark('');
      setMultiWoEntries([EMPTY_WO_ENTRY()]);
      setMultiMatPkg('');
      setShowMultiDialog(false);
      alert(`ยืนยันข้อมูลสำเร็จ ${selectedRows.length} รายการ`);
    } catch (error) {
      console.error('Multi-confirm error:', error);
      alert('เกิดข้อผิดพลาดในการยืนยันข้อมูล');
    }
  };

  const totalCustomWidth = Object.values(CUSTOM_COLUMN_WIDTHS).reduce((sum, w) => sum + parseInt(w), 0);
  const remainingWidth = `calc((100% - ${totalCustomWidth}px) / ${displayColumns.length})`;
  const columnWidths = Array(displayColumns.length).fill(remainingWidth);

  // ✅ header ของคอลัมน์ cold storage 6 รอบ
  const headerNames = {
    batch_after: 'Batch',
    mat_name: 'ชื่อวัตถุดิบ',
    rmit_date: 'เวลาเตรียม',
    cold_slot_1_in: 'เข้าห้องเย็น 1',
    cold_slot_1_out: 'ออกห้องเย็น 1',
    cold_slot_2_in: 'เข้าห้องเย็น 2',
    cold_slot_2_out: 'ออกห้องเย็น 2',
    cold_slot_3_in: 'เข้าห้องเย็น 3',
    cold_slot_3_out: 'ออกห้องเย็น 3',
    cold_slot_4_in: 'เข้าห้องเย็น 4',
    cold_slot_4_out: 'ออกห้องเย็น 4',
    cold_slot_5_in: 'เข้าห้องเย็น 5',
    cold_slot_5_out: 'ออกห้องเย็น 5',
    cold_slot_6_in: 'เข้าห้องเย็น 6',
    cold_slot_6_out: 'ออกห้องเย็น 6',
    production: 'แผน',
    weight_RM: 'น้ำหนัก'
  };

  const getColumnWidth = (header) => {
    const widthMap = {
      mat_name: '150px',
      rmit_date: '110px',
      cold_slot_1_in: '110px',
      cold_slot_1_out: '110px',
      cold_slot_2_in: '110px',
      cold_slot_2_out: '110px',
      cold_slot_3_in: '110px',
      cold_slot_3_out: '110px',
      cold_slot_4_in: '110px',
      cold_slot_4_out: '110px',
      cold_slot_5_in: '110px',
      cold_slot_5_out: '110px',
      cold_slot_6_in: '110px',
      cold_slot_6_out: '110px',
      production: '80px',
      tro_id: '180px',
      weight_RM: '10px',
      batch_after: '50px'
    };
    return widthMap[header] || '150px';
  };

  const headerCellBase = {
    backgroundColor: '#1552F0',
    borderTop: '1px solid #1552F0',
    borderBottom: '1px solid #1552F0',
    borderLeft: '1px solid rgba(255,255,255,0.1)',
    borderRight: '1px solid rgba(255,255,255,0.1)',
    fontSize: '14px',
    color: '#fff',
    padding: '12px',
    fontWeight: '600',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  return (
    <Paper sx={{
      width: '100%',
      overflow: 'hidden',
      boxShadow: '0px 4px 20px rgba(33, 150, 243, 0.1)',
      borderRadius: '16px',
      background: 'linear-gradient(135deg, #ffffff 0%, #F5F8FF 100%)'
    }}>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>

      {/* ── Header ── */}
      <Box sx={{
        background: 'linear-gradient(135deg, #1552F0 0%, #1552F0 100%)',
        padding: '20px 24px',
        borderRadius: '16px 16px 0 0'
      }}>
        {/* Search */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
          <TextField
            variant="outlined"
            fullWidth
            placeholder="พิมพ์เพื่อค้นหา..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ color: '#1552F0' }} />
                </InputAdornment>
              ),
              sx: { height: '44px', backgroundColor: '#fff', borderRadius: '12px' }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                height: '44px', fontSize: '14px', borderRadius: '12px', color: '#546E7A',
                '& fieldset': { borderColor: 'transparent' },
                '&:hover fieldset': { borderColor: '#1552F0' },
                '&.Mui-focused fieldset': { borderColor: '#1552F0', borderWidth: '2px' }
              },
              '& input': { padding: '10px' }
            }}
          />
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterListIcon sx={{ color: '#fff', fontSize: '20px' }} />
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>ตัวกรอง:</span>
          </Box>

          <SearchableDropdown
            options={uniqueDocNos}
            value={selectedDocNo}
            onChange={setSelectedDocNo}
            placeholder="เลือก Doc No"
          />

          <Chip
            icon={<FaWeight style={{ fontSize: '16px' }} />}
            label={`น้ำหนักรวม: ${totalWeight.toFixed(2)} กก.`}
            sx={{
              backgroundColor: '#fff', color: '#1552F0', fontWeight: '600',
              fontSize: '14px', height: '42px', borderRadius: '12px', padding: '0 8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)', animation: 'pulse 2s infinite',
              '& .MuiChip-icon': { color: '#1552F0' }
            }}
          />

          {selectedRows.length > 0 && (
            <>
              <Chip
                label={`เลือกแล้ว: ${selectedRows.length} รายการ`}
                sx={{
                  backgroundColor: '#4CAF50', color: '#fff', fontWeight: '600',
                  fontSize: '14px', height: '42px', borderRadius: '12px', padding: '0 8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              />
              <Button
                variant="contained"
                onClick={handleOpenMultiDialog}
                sx={{
                  background: 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)',
                  color: '#fff', borderRadius: '12px', padding: '10px 20px',
                  textTransform: 'none', fontSize: '14px', fontWeight: '600', height: '42px',
                  boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #388E3C 0%, #2E7D32 100%)',
                    boxShadow: '0 6px 16px rgba(76,175,80,0.4)'
                  }
                }}
              >
                ยืนยันทั้งหมด
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* ── Table ── */}
      <TableContainer
        style={{ padding: '0px 20px' }}
        sx={{
          height: 'calc(68vh)',
          overflowY: 'auto',
          whiteSpace: 'nowrap',
          '@media (max-width: 1200px)': { overflowX: 'scroll', minWidth: '200px' },
          '&::-webkit-scrollbar': { width: '8px', height: '8px' },
          '&::-webkit-scrollbar-track': { background: '#f1f1f1', borderRadius: '10px' },
          '&::-webkit-scrollbar-thumb': {
            background: '#1552F0', borderRadius: '10px',
            '&:hover': { background: '#1552F0' }
          }
        }}
      >
        <Table stickyHeader style={{ tableLayout: 'auto' }} sx={{ minWidth: '1270px', width: 'max-content' }}>
          <TableHead>
            <TableRow sx={{ height: '48px' }}>
              {/* Select All */}
              <TableCell
                align="center"
                style={{
                  ...headerCellBase,
                  borderLeft: '1px solid #1552F0',
                  width: CUSTOM_COLUMN_WIDTHS.checkbox,
                  borderTopLeftRadius: '12px',
                  borderBottomLeftRadius: '12px'
                }}
              >
                <Checkbox
                  checked={allSelected}
                  onChange={handleSelectAll}
                  sx={{ color: '#fff', '&.Mui-checked': { color: '#fff' } }}
                />
              </TableCell>

              {displayColumns.map((header, index) => (
                <TableCell
                  key={index}
                  align="center"
                  style={{ ...headerCellBase, width: getColumnWidth(header) }}
                >
                  <Box style={{ fontSize: '15px', color: '#ffffff', letterSpacing: '0.3px' }}>
                    {headerNames[header] || header}
                  </Box>
                </TableCell>
              ))}

              {/* Weight */}
              <TableCell align="center" style={{ ...headerCellBase, width: CUSTOM_COLUMN_WIDTHS.weight }}>
                <Box style={{ fontSize: '15px', color: '#ffffff', letterSpacing: '0.3px' }}>น้ำหนัก (kg)</Box>
              </TableCell>

              {/* Cart */}
              <TableCell align="center" style={{ ...headerCellBase, width: '90px' }}>
                <Box style={{ fontSize: '15px', color: '#ffffff', letterSpacing: '0.3px' }}>รถเข็น</Box>
              </TableCell>

              {/* Edit */}
              <TableCell align="center" style={{ ...headerCellBase, width: '90px' }}>
                <Box style={{ fontSize: '15px', color: '#ffffff', letterSpacing: '0.3px' }}>แก้ไข</Box>
              </TableCell>

              {/* Delete */}
              <TableCell align="center" style={{
                ...headerCellBase,
                borderRight: '1px solid #1552F0',
                borderTopRightRadius: '12px',
                borderBottomRightRadius: '12px',
                width: '90px'
              }}>
                <Box style={{ fontSize: '15px', color: '#ffffff', letterSpacing: '0.3px' }}>ลบ</Box>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredRows.length > 0 ? (
              filteredRows
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => {
                  const isConfirmed = row.sc_pack_date && row.sc_pack_date !== '-';
                  return (
                    <Row
                      key={row.mapping_id ?? index}
                      row={row}
                      columnWidths={columnWidths}
                      handleOpenEditModal={handleOpenEditModal}
                      handleOpenEditLineModal={handleOpenEditLineModal}
                      handleOpenDeleteModal={handleOpenDeleteModal}
                      handleOpenSuccess={handleOpenSuccess}
                      openRowId={openRowId}
                      setOpenRowId={setOpenRowId}
                      index={index}
                      displayColumns={displayColumns}
                      isSelected={selectedRows.includes(row.mapping_id)}
                      onSelectRow={handleSelectRow}
                      weight={rowWeights[row.mapping_id]}
                      onWeightChange={handleWeightChange}
                      isConfirmed={isConfirmed}
                    />
                  );
                })
            ) : (
              <TableRow>
                <TableCell colSpan={displayColumns.length + 5} align="center" sx={{
                  padding: '40px', fontSize: '16px', color: '#90A4AE', fontWeight: '500'
                }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <SearchIcon sx={{ fontSize: '48px', color: '#BBDEFB' }} />
                    <span>ไม่มีรายการวัตถุดิบในขณะนี้</span>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Pagination ── */}
      <TablePagination
        sx={{
          borderTop: '1px solid #EAF0FF',
          backgroundColor: '#F5F8FF',
          '& .MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows, .MuiTablePagination-toolbar': {
            fontSize: '13px', color: '#546E7A', padding: '0px', fontWeight: '500'
          },
          '& .MuiTablePagination-select': { fontSize: '13px', color: '#1552F0', fontWeight: '600' },
          '& .MuiTablePagination-actions button': {
            color: '#1552F0',
            '&:hover': { backgroundColor: '#EAF0FF' }
          }
        }}
        rowsPerPageOptions={[100, 500, 1000]}
        component="div"
        count={filteredRows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        labelRowsPerPage="แถวต่อหน้า:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} จาก ${count}`}
      />

      {/* ── MultiConfirm Dialog ── */}
      <MultiConfirmDialog
        open={showMultiDialog}
        onClose={() => setShowMultiDialog(false)}
        selectedCount={selectedRows.length}
        onConfirm={handleMultiConfirm}
        group={multiGroup}
        setGroup={setMultiGroup}
        prepDateTime={multiPrepDateTime}
        setPrepDateTime={setMultiPrepDateTime}
        remark={multiRemark}
        setRemark={setMultiRemark}
        woEntries={multiWoEntries}
        setWoEntries={setMultiWoEntries}
        matPkg={multiMatPkg}
        setMatPkg={setMultiMatPkg}
        errors={multiErrors}
      />
    </Paper>
  );
};

export default TableMainPrep;