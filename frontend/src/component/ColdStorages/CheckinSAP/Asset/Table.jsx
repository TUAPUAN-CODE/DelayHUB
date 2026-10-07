import React, { useState, useEffect } from 'react';
import {
  Table, TableContainer, TableHead, TableBody, TableRow, TableCell,
  Paper, Box, TextField, TablePagination, Typography, Button, Chip,
  Collapse, Tooltip
} from '@mui/material';
import { InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/EditOutlined";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { io } from "socket.io-client";

import withTableTools from "../../../Layout/withTableTools";
const API_URL = import.meta.env.VITE_API_URL;
const socket = io(API_URL, { transports: ["websocket"], reconnectionAttempts: 5, reconnectionDelay: 1000, autoConnect: true });

// คอลัมน์หลักที่แสดงในตาราง
const MAIN_COLS = [
  { key: 'batch',  label: 'Batch' },
  { key: 'mat',    label: 'Material' },
  { key: 'hu',     label: 'HU' },
  { key: 'weight', label: 'น้ำหนัก' },
  { key: 'remark', label: 'Remark' },
];

// ทุก timestamp field พร้อม label และ color ตามประเภท
const ALL_TIME_FIELDS = [
  { key: 'start_defrost_date',       label: 'เริ่มละลาย',                color: '#0277bd', bg: '#EAF0FF' },
  { key: 'end_defrost_date',         label: 'ละลายเสร็จ',                color: '#0277bd', bg: '#EAF0FF' },
  { key: 'start_defrost_date_two',   label: 'เริ่มละลาย (รอบ 2)',        color: '#0277bd', bg: '#EAF0FF' },
  { key: 'end_defrost_date_two',     label: 'ละลายเสร็จ (รอบ 2)',        color: '#0277bd', bg: '#EAF0FF' },
  { key: 'start_defrost_date_three', label: 'เริ่มละลาย (รอบ 3)',        color: '#0277bd', bg: '#EAF0FF' },
  { key: 'end_defrost_date_three',   label: 'ละลายเสร็จ (รอบ 3)',        color: '#0277bd', bg: '#EAF0FF' },
  { key: 'start_defrost_date_four',  label: 'เริ่มละลาย (รอบ 4)',        color: '#0277bd', bg: '#EAF0FF' },
  { key: 'end_defrost_date_four',    label: 'ละลายเสร็จ (รอบ 4)',        color: '#0277bd', bg: '#EAF0FF' },
  { key: 'withdraw_date',            label: 'ส่งออกห้องเย็น',             color: '#0F3FC4', bg: '#e8eaf6' },
  { key: 'input_pd_date',            label: 'ไลน์รับเข้า รอบ 1',         color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date',           label: 'ไลน์ส่งคืน รอบ 1',          color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date',            label: 'ห้องเย็นรับเข้า รอบ 1',     color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_two',        label: 'ส่งออกห้องเย็น รอบ 2',      color: '#0F3FC4', bg: '#e8eaf6' },
  { key: 'input_pd_date_two',        label: 'ไลน์รับเข้า รอบ 2',         color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date_two',       label: 'ไลน์ส่งคืน รอบ 2',          color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date_two',        label: 'ห้องเย็นรับเข้า รอบ 2',     color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_three',      label: 'ส่งออกห้องเย็น รอบ 3',      color: '#0F3FC4', bg: '#e8eaf6' },
  { key: 'input_pd_date_three',      label: 'ไลน์รับเข้า รอบ 3',         color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date_three',     label: 'ไลน์ส่งคืน รอบ 3',          color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date_three',      label: 'ห้องเย็นรับเข้า รอบ 3',     color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_four',       label: 'ส่งออกห้องเย็น รอบ 4',      color: '#0F3FC4', bg: '#e8eaf6' },
];

const TOTAL_COLS = 2 + MAIN_COLS.length; // edit + eye + main

// ─── TimeSubRow ───────────────────────────────────────────────────────────────
const TimeSubRow = ({ row }) => {
  const sorted = ALL_TIME_FIELDS
    .filter(f => row[f.key])
    .map(f => ({ ...f, value: row[f.key] }))
    .sort((a, b) => new Date(a.value.replace(' ', 'T')) - new Date(b.value.replace(' ', 'T')));

  if (sorted.length === 0) {
    return (
      <Box sx={{ py: 1.5, px: 2, backgroundColor: '#f8fafc', borderBottom: '1px solid #E3E8F2' }}>
        <Typography sx={{ fontSize: '13px', color: '#9e9e9e', fontStyle: 'italic' }}>
          ยังไม่มีข้อมูลเวลา
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      py: 1.5,
      px: 2,
      backgroundColor: '#f8fafc',
      borderBottom: '1px solid #E3E8F2',
      overflowX: 'auto',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}>
        {sorted.map((item, idx) => (
          <React.Fragment key={item.key}>
            {/* Card */}
            <Box sx={{
              border: `1.5px solid ${item.color}50`,
              borderRadius: '8px',
              backgroundColor: item.bg,
              px: 1.5,
              py: 0.8,
              minWidth: '120px',
              maxWidth: '160px',
              textAlign: 'center',
              flexShrink: 0,
              position: 'relative',
            }}>
              {/* ลำดับ */}
              <Box sx={{
                position: 'absolute',
                top: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: item.color,
                color: '#fff',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 700,
                lineHeight: 1,
              }}>
                {idx + 1}
              </Box>
              <Typography sx={{ fontSize: '10px', color: item.color, fontWeight: 600, lineHeight: 1.3, mt: 0.3 }}>
                {item.label}
              </Typography>
              <Typography sx={{ fontSize: '11px', color: '#333', fontWeight: 500, mt: 0.4, lineHeight: 1.2 }}>
                {item.value}
              </Typography>
            </Box>
            {/* Arrow */}
            {idx < sorted.length - 1 && (
              <Box sx={{ color: '#bdbdbd', fontSize: '20px', px: 0.3, flexShrink: 0, lineHeight: 1 }}>
                ›
              </Box>
            )}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};

// ─── Row ──────────────────────────────────────────────────────────────────────
const Row = ({ row, handleOpenEditModal, index }) => {
  const [expanded, setExpanded] = useState(false);
  const backgroundColor = index % 2 === 0 ? '#ffffff' : "#EAF0FF";

  return (
    <>
      <TableRow>
        <TableCell colSpan={TOTAL_COLS} style={{ height: '7px', padding: '0px', border: '0px solid' }} />
      </TableRow>
      <TableRow>
        {/* Edit button */}
        <TableCell
          style={{
            textAlign: 'center',
            border: '1px solid #E3E8F2',
            borderRight: '1px solid #f2f2f2',
            borderTopLeftRadius: '8px',
            borderBottomLeftRadius: '8px',
            height: '40px',
            padding: '0px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            backgroundColor,
            width: '50px',
          }}
          onClick={(e) => { e.stopPropagation(); handleOpenEditModal(row); }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#edc026'; e.currentTarget.querySelector('svg').style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = backgroundColor; e.currentTarget.querySelector('svg').style.color = '#edc026'; }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <EditIcon style={{ color: '#edc026', fontSize: '20px' }} />
          </div>
        </TableCell>

        {/* Eye button */}
        <TableCell
          style={{
            textAlign: 'center',
            borderTop: '1px solid #E3E8F2',
            borderBottom: '1px solid #E3E8F2',
            borderRight: '1px solid #f2f2f2',
            height: '40px',
            padding: '0px',
            cursor: 'pointer',
            backgroundColor,
            width: '50px',
          }}
          onClick={() => setExpanded(prev => !prev)}
        >
          <Tooltip title={expanded ? 'ซ่อนข้อมูลเวลา' : 'ดูข้อมูลเวลา'} placement="top">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              {expanded
                ? <VisibilityOffIcon style={{ color: '#0F3FC4', fontSize: '20px' }} />
                : <VisibilityIcon style={{ color: '#9e9e9e', fontSize: '20px' }} />
              }
            </div>
          </Tooltip>
        </TableCell>

        {/* Main data cells */}
        {MAIN_COLS.map(({ key }, idx) => {
          const isLast = idx === MAIN_COLS.length - 1;
          return (
            <TableCell key={key} align="center" style={{
              borderTop: '1px solid #E3E8F2',
              borderBottom: '1px solid #E3E8F2',
              borderLeft: '1px solid #f2f2f2',
              borderRight: isLast ? '1px solid #E3E8F2' : undefined,
              borderTopRightRadius: isLast ? '8px' : '0px',
              borderBottomRightRadius: isLast ? '8px' : '0px',
              fontSize: '14px',
              height: '40px',
              padding: '0px 12px',
              color: '#6B7489',
              backgroundColor,
              whiteSpace: 'nowrap',
            }}>
              {row[key] ?? '-'}
            </TableCell>
          );
        })}
      </TableRow>

      {/* Sub-row: timestamps */}
      <TableRow>
        <TableCell colSpan={TOTAL_COLS} style={{ padding: 0, border: 'none' }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <TimeSubRow row={row} />
          </Collapse>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={TOTAL_COLS} style={{ padding: '0px', border: '0px solid' }} />
      </TableRow>
    </>
  );
};

// ─── Main TableMainPrep ───────────────────────────────────────────────────────
const TableMainPrep = ({
  handleOpenModal, data, handleOpenEditModal,
  handleOpenSuccess, handleOpenDeleteModal, onRefresh,
  selectedDate, onDateChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRows, setFilteredRows] = useState(data);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  useEffect(() => {
    socket.on("dataUpdated", () => { onRefresh?.(); });
    return () => { socket.off("dataUpdated"); };
  }, []);

  useEffect(() => {
    setFilteredRows(
      data.filter((row) => Object.values(row).some((value) => value?.toString().toLowerCase().includes(searchTerm.toLowerCase())))
    );
  }, [searchTerm, data]);

  const displayDate = selectedDate ? selectedDate.split('-').reverse().join('/') : '';

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden', boxShadow: '0px 0px 3px rgba(0,0,0,0.2)' }}>

      {/* Date Picker Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, pt: 1.5, pb: 1, borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap' }}>
        <CalendarTodayIcon sx={{ color: '#0F3FC4', fontSize: '18px' }} />
        <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#0F3FC4' }}>ข้อมูลวันที่:</Typography>
        <TextField
          type="date"
          size="small"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          inputProps={{ max: new Date().toISOString().split('T')[0] }}
          sx={{ '& .MuiOutlinedInput-root': { fontSize: '13px', height: '34px', borderRadius: '8px' }, width: '160px' }}
        />
        <Chip label={`วันที่ ${displayDate}`} color="primary" size="small" sx={{ fontSize: '12px' }} />
        <Button
          size="small"
          variant="outlined"
          onClick={() => onDateChange(new Date().toISOString().split('T')[0])}
          sx={{ fontSize: '12px', height: '34px', borderRadius: '8px', textTransform: 'none' }}
        >
          วันนี้
        </Button>
      </Box>

      {/* Search Bar */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            variant="outlined" fullWidth placeholder="พิมพ์เพื่อค้นหา..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>, sx: { height: '40px' } }}
            sx={{ "& .MuiOutlinedInput-root": { height: '40px', fontSize: '14px', borderRadius: '8px', color: '#6B7489' }, "& input": { padding: '8px' } }}
          />
          <Chip label={`${filteredRows.length} รายการ`} color="primary" size="small" />
        </Box>
      </Box>

      <TableContainer style={{ padding: '0px 20px' }} sx={{ height: 'calc(60vh)', overflowY: 'auto' }}>
        <Table stickyHeader style={{ tableLayout: 'auto' }} sx={{ minWidth: '500px', width: '100%' }}>
          <TableHead>
            <TableRow sx={{ height: '40px' }}>
              <TableCell align="center" style={{ backgroundColor: '#1552F0', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px', border: '1px solid #E3E8F2', borderRight: '1px solid #f2f2f2', fontSize: '13px', padding: '5px', width: '50px' }}>
                <Box style={{ color: '#fff' }}>แก้ไข</Box>
              </TableCell>
              <TableCell align="center" style={{ backgroundColor: '#1552F0', border: '1px solid #f2f2f2', fontSize: '13px', padding: '5px', width: '50px' }}>
                <Box style={{ color: '#fff', display: 'flex', justifyContent: 'center' }}>
                  <VisibilityIcon style={{ fontSize: '18px' }} />
                </Box>
              </TableCell>
              {MAIN_COLS.map(({ key, label }, i) => (
                <TableCell key={key} align="center" style={{
                  backgroundColor: '#1552F0',
                  borderTopRightRadius: i === MAIN_COLS.length - 1 ? '8px' : '0',
                  borderBottomRightRadius: i === MAIN_COLS.length - 1 ? '8px' : '0',
                  borderTop: '1px solid #E3E8F2',
                  borderBottom: '1px solid #E3E8F2',
                  borderRight: i === MAIN_COLS.length - 1 ? '1px solid #E3E8F2' : '1px solid #f2f2f2',
                  fontSize: '14px',
                  padding: '5px 10px',
                }}>
                  <Box style={{ color: '#fff' }}>{label}</Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.length > 0
              ? filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <Row key={row.sap_re_id ?? index} row={row} handleOpenEditModal={handleOpenEditModal} index={index} />
              ))
              : (
                <TableRow>
                  <TableCell colSpan={TOTAL_COLS} align="center" sx={{ padding: '20px', fontSize: '16px', color: '#6B7489' }}>
                    ไม่มีรายการวัตถุดิบในวันที่เลือก
                  </TableCell>
                </TableRow>
              )
            }
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        sx={{ "& .MuiTablePagination-selectLabel,.MuiTablePagination-displayedRows,.MuiTablePagination-toolbar": { fontSize: '10px', color: '#6B7489', padding: '0px' } }}
        rowsPerPageOptions={[20, 50, 100]} component="div" count={filteredRows.length}
        rowsPerPage={rowsPerPage} page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
      />
    </Paper>
  );
};

export default withTableTools(TableMainPrep);