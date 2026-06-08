import React, { useState, useEffect } from 'react';
import {
  Table, TableContainer, TableHead, TableBody, TableRow, TableCell,
  Paper, Box, TextField, TablePagination, Typography, Button, Chip
} from '@mui/material';
import { InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/EditOutlined";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import axios from "axios";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL;
const socket = io(API_URL, { transports: ["websocket"], reconnectionAttempts: 5, reconnectionDelay: 1000, autoConnect: true });

const CUSTOM_COLUMN_WIDTHS = { edit: '80px' };
const HIDDEN_KEYS = ['sap_re_id'];
const HEADER_LABELS = {
  batch: 'Batch',
  mat: 'Material',
  hu: 'HU',
  remark: 'Remark',
  withdraw_date: 'เวลาส่งจากห้องเย็น',
  start_defrost_date: 'เวลาเริ่มละลาย',
  end_defrost_date: 'เวลาละลายเสร็จ',
  input_pd_date: 'เวลาไลน์รับเข้า (ครั้งที่ 1)',
  output_pd_date: 'เวลาส่งคืน (ครั้งที่ 1)',
  input_pd_date_two: 'เวลาไลน์รับเข้า (ครั้งที่ 2)',
  output_pd_date_two: 'เวลาส่งคืน (ครั้งที่ 2)',
  input_pd_date_three: 'เวลาไลน์รับเข้า (ครั้งที่ 3)',
  output_pd_date_three: 'เวลาส่งคืน (ครั้งที่ 3)',
};

const getToday = () => new Date().toISOString().split('T')[0];

// ─── EditActionCell ───────────────────────────────────────────────────────────
const EditActionCell = ({ onClick, icon, backgroundColor, isFirst }) => (
  <TableCell
    style={{ textAlign: 'center', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', borderLeft: '1px solid #e0e0e0', borderRight: '1px solid #f2f2f2', borderTopLeftRadius: isFirst ? "8px" : "0px", borderBottomLeftRadius: isFirst ? "8px" : "0px", height: '40px', padding: '0px', cursor: 'pointer', transition: 'background-color 0.2s ease-in-out', backgroundColor, width: CUSTOM_COLUMN_WIDTHS.edit }}
    onClick={onClick}
    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#edc026'; e.currentTarget.querySelector('svg').style.color = '#fff'; }}
    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = backgroundColor; e.currentTarget.querySelector('svg').style.color = '#edc026'; }}>
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>{icon}</div>
  </TableCell>
);

// ─── Row ──────────────────────────────────────────────────────────────────────
const Row = ({ row, columnWidths, handleOpenEditModal, index }) => {
  const { sap_re_id, ...displayRow } = row;
  const backgroundColor = index % 2 === 0 ? '#ffffff' : "hsl(210, 100.00%, 88%)";
  return (
    <>
      <TableRow><TableCell style={{ height: "7px", padding: "0px", border: "0px solid" }} /></TableRow>
      <TableRow>
        <EditActionCell onClick={(e) => { e.stopPropagation(); handleOpenEditModal(row); }} icon={<EditIcon style={{ color: '#edc026', fontSize: '22px' }} />} backgroundColor={backgroundColor} isFirst />
        {Object.values(displayRow).map((value, idx) => (
          <TableCell key={idx} align="center" style={{ width: columnWidths[idx], borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', whiteSpace: 'normal', wordWrap: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px', height: '40px', lineHeight: '1.5', padding: '0px 10px', color: "#787878", borderLeft: "1px solid #f2f2f2", borderRight: idx === Object.values(displayRow).length - 1 ? "1px solid #e0e0e0" : undefined, borderTopRightRadius: idx === Object.values(displayRow).length - 1 ? "8px" : "0px", borderBottomRightRadius: idx === Object.values(displayRow).length - 1 ? "8px" : "0px", backgroundColor }}>
            {value || '-'}
          </TableCell>
        ))}
      </TableRow>
      <TableRow><TableCell style={{ padding: "0px", border: "0px solid" }} /></TableRow>
    </>
  );
};

// ─── Main TableMainPrep ───────────────────────────────────────────────────────
const TableMainPrep = ({ handleOpenEditModal }) => {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRows, setFilteredRows] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const fetchData = async (date) => {
    try {
      const res = await axios.get(`${API_URL}/api/coldstorages/scan/sap/month`, {
        params: { withdraw_date: date }
      });
      setData(res.data.data ?? []);
    } catch (err) {
      console.error("fetchData error:", err);
    }
  };

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    socket.on("dataUpdated", () => fetchData(selectedDate));
    return () => { socket.off("dataUpdated"); };
  }, [selectedDate]);

  useEffect(() => {
    setFilteredRows(
      data.filter((row) => Object.values(row).some((value) => value?.toString().toLowerCase().includes(searchTerm.toLowerCase())))
    );
    setPage(0);
  }, [searchTerm, data]);

  const columns = Object.keys(data[0] || {}).filter(key => !HIDDEN_KEYS.includes(key));
  const totalCustomWidth = Object.values(CUSTOM_COLUMN_WIDTHS).reduce((sum, w) => sum + parseInt(w), 0);
  const remainingWidth = `calc((100% - ${totalCustomWidth}px) / ${columns.length || 1})`;
  const columnWidths = Array(columns.length).fill(remainingWidth);
  const displayDate = selectedDate ? selectedDate.split('-').reverse().join('/') : '';

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setPage(0);
  };

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden', boxShadow: '0px 0px 3px rgba(0,0,0,0.2)' }}>

      {/* Date Picker Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, pt: 1.5, pb: 1, borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap' }}>
        <CalendarTodayIcon sx={{ color: '#1565C0', fontSize: '18px' }} />
        <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#1565C0' }}>ข้อมูลวันที่:</Typography>
        <TextField
          type="date"
          size="small"
          value={selectedDate}
          onChange={(e) => handleDateChange(e.target.value)}
          inputProps={{ max: getToday() }}
          sx={{ '& .MuiOutlinedInput-root': { fontSize: '13px', height: '34px', borderRadius: '8px' }, width: '160px' }}
        />
        <Chip label={`วันที่ ${displayDate}`} color="primary" size="small" sx={{ fontSize: '12px' }} />
        <Button size="small" variant="outlined" onClick={() => handleDateChange(getToday())}
          sx={{ fontSize: '12px', height: '34px', borderRadius: '8px', textTransform: 'none' }}>
          วันนี้
        </Button>
      </Box>

      {/* Search Bar */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            variant="outlined" fullWidth placeholder="พิมพ์เพื่อค้นหา..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>, sx: { height: "40px" } }}
            sx={{ "& .MuiOutlinedInput-root": { height: "40px", fontSize: "14px", borderRadius: "8px", color: "#787878" }, "& input": { padding: "8px" } }}
          />
          <Chip label={`${filteredRows.length} รายการ`} color="primary" size="small" />
        </Box>
      </Box>

      {/* Table */}
      <TableContainer style={{ padding: '0px 20px' }} sx={{ height: 'calc(60vh)', overflowY: 'auto', whiteSpace: 'nowrap' }}>
        <Table stickyHeader style={{ tableLayout: 'auto' }} sx={{ minWidth: '1270px', width: 'max-content' }}>
          <TableHead>
            <TableRow sx={{ height: '40px' }}>
              <TableCell align="center" style={{ backgroundColor: "hsl(210, 100%, 60%)", borderTopLeftRadius: "8px", borderBottomLeftRadius: "8px", border: "1px solid #e0e0e0", borderRight: "1px solid #f2f2f2", fontSize: '12px', padding: '5px', width: CUSTOM_COLUMN_WIDTHS.edit }}>
                <Box style={{ fontSize: '14px', color: '#ffffff' }}>แก้ไข</Box>
              </TableCell>
              {columns.map((col, i) => (
                <TableCell key={col} align="center" style={{ backgroundColor: "hsl(210, 100%, 60%)", borderTopRightRadius: i === columns.length - 1 ? "8px" : "0", borderBottomRightRadius: i === columns.length - 1 ? "8px" : "0", borderTop: "1px solid #e0e0e0", borderBottom: "1px solid #e0e0e0", borderRight: i === columns.length - 1 ? "1px solid #e0e0e0" : "1px solid #f2f2f2", fontSize: '12px', padding: '5px', width: remainingWidth }}>
                  <Box style={{ fontSize: '14px', color: '#ffffff' }}>{HEADER_LABELS[col] || col}</Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.length > 0
              ? filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <Row key={index} row={row} columnWidths={columnWidths} handleOpenEditModal={handleOpenEditModal} index={index} />
              ))
              : <TableRow><TableCell colSpan={columns.length + 1} align="center" sx={{ padding: "20px", fontSize: "16px", color: "#787878" }}>ไม่มีรายการวัตถุดิบในวันที่เลือก</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        sx={{ "& .MuiTablePagination-selectLabel,.MuiTablePagination-displayedRows,.MuiTablePagination-toolbar": { fontSize: '10px', color: "#787878", padding: "0px" } }}
        rowsPerPageOptions={[20, 50, 100]} component="div" count={filteredRows.length}
        rowsPerPage={rowsPerPage} page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
      />
    </Paper>
  );
};

export default TableMainPrep;
