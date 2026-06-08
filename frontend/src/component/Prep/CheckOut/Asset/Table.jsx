import React, { useState, useEffect } from 'react';
import {
  Table, TableContainer, TableHead, TableBody, TableRow, TableCell,
  Paper, Box, TextField, TablePagination, Typography, Button, Chip, Tooltip, Collapse
} from '@mui/material';
import { InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import EditIcon from "@mui/icons-material/EditOutlined";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL;
const socket = io(API_URL, { transports: ["websocket"], reconnectionAttempts: 5, reconnectionDelay: 1000, autoConnect: true });

// ─── Columns แสดงในแถวหลัก ────────────────────────────────────────────────────
const tableColumns = [
  { id: 'batch',         label: 'Batch',               width: '130px' },
  { id: 'mat',           label: 'Material',             width: '130px' },
  { id: 'hu',            label: 'HU',                   width: '110px' },
  { id: 'weight',        label: 'น้ำหนัก (kg)',          width: '100px' },
  { id: 'remark',        label: 'Remark',               width: '120px' },
];

// ─── Timeline fields ───────────────────────────────────────────────────────────
const ALL_TIME_FIELDS = [
  { key: 'withdraw_date',            label: 'จ่ายออกห้องเย็น (1)',    color: '#e65100', bg: '#fff3e0' },
  { key: 'start_defrost_date',       label: 'เริ่มละลาย (1)',          color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date',         label: 'ละลายเสร็จ (1)',          color: '#0277bd', bg: '#e3f2fd' },
  { key: 'input_pd_date',            label: 'ไลน์ผลิตรับเข้า (1)',     color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date',           label: 'ไลน์ผลิตส่งคืน (1)',      color: '#558b2f', bg: '#f1f8e9' },
  { key: 'input_cd_date',            label: 'เข้าห้องเย็น (1)',         color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_two',        label: 'จ่ายออกห้องเย็น (2)',    color: '#e65100', bg: '#fff3e0' },
  { key: 'start_defrost_date_two',   label: 'เริ่มละลาย (2)',          color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date_two',     label: 'ละลายเสร็จ (2)',          color: '#0277bd', bg: '#e3f2fd' },
  { key: 'input_pd_date_two',        label: 'ไลน์ผลิตรับเข้า (2)',     color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date_two',       label: 'ไลน์ผลิตส่งคืน (2)',      color: '#558b2f', bg: '#f1f8e9' },
  { key: 'input_cd_date_two',        label: 'เข้าห้องเย็น (2)',         color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_three',      label: 'จ่ายออกห้องเย็น (3)',    color: '#e65100', bg: '#fff3e0' },
  { key: 'start_defrost_date_three', label: 'เริ่มละลาย (3)',          color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date_three',   label: 'ละลายเสร็จ (3)',          color: '#0277bd', bg: '#e3f2fd' },
  { key: 'input_pd_date_three',      label: 'ไลน์ผลิตรับเข้า (3)',     color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date_three',     label: 'ไลน์ผลิตส่งคืน (3)',      color: '#558b2f', bg: '#f1f8e9' },
  { key: 'input_cd_date_three',      label: 'เข้าห้องเย็น (3)',         color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_four',       label: 'จ่ายออกห้องเย็น (4)',    color: '#e65100', bg: '#fff3e0' },
  { key: 'start_defrost_date_four',  label: 'เริ่มละลาย (4)',          color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date_four',    label: 'ละลายเสร็จ (4)',          color: '#0277bd', bg: '#e3f2fd' },
];

// ─── TimelineSubRow ────────────────────────────────────────────────────────────
const TimelineSubRow = ({ row }) => {
  const events = ALL_TIME_FIELDS
    .map((f) => ({ ...f, value: row[f.key] }))
    .filter((f) => f.value)
    .sort((a, b) => new Date(a.value.replace(' ', 'T')) - new Date(b.value.replace(' ', 'T')));

  if (events.length === 0) {
    return (
      <Box sx={{ p: 2, color: '#999', fontSize: '13px' }}>ไม่มีข้อมูล Timeline</Box>
    );
  }

  return (
    <Box sx={{ p: 1.5, backgroundColor: '#fafafa', borderRadius: '8px', overflowX: 'auto' }}>
      <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#555', mb: 1 }}>
        📅 Timeline
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, flexWrap: 'nowrap', minWidth: 'max-content' }}>
        {events.map((ev, idx) => (
          <React.Fragment key={ev.key}>
            {idx > 0 && (
              <Typography sx={{ fontSize: '18px', color: '#bbb', alignSelf: 'center', mx: 0.25 }}>›</Typography>
            )}
            <Box
              sx={{
                backgroundColor: ev.bg,
                border: `1.5px solid ${ev.color}`,
                borderRadius: '8px',
                px: 1.5,
                py: 0.75,
                minWidth: '140px',
                maxWidth: '170px',
                flexShrink: 0,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Box
                  sx={{
                    width: 20, height: 20, borderRadius: '50%',
                    backgroundColor: ev.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </Box>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: ev.color, lineHeight: 1.2 }}>
                  {ev.label}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '11px', color: '#333', fontFamily: 'monospace' }}>
                {ev.value}
              </Typography>
            </Box>
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};

// ─── Row ───────────────────────────────────────────────────────────────────────
const Row = ({ row, index, handleOpenEditModal }) => {
  const [expandedTimeline, setExpandedTimeline] = useState(false);
  const backgroundColor = index % 2 === 0 ? '#ffffff' : 'hsl(210,100%,93%)';
  const colSpan = tableColumns.length + 2;

  return (
    <>
      <TableRow>
        <TableCell style={{ height: '4px', padding: 0, border: 'none' }} colSpan={colSpan} />
      </TableRow>
      <TableRow>
        {tableColumns.map((col, i) => {
          const isFirst = i === 0;
          return (
            <TableCell
              key={col.id}
              align="center"
              style={{
                width: col.width,
                backgroundColor,
                borderTop: '1px solid #e0e0e0',
                borderBottom: '1px solid #e0e0e0',
                borderLeft: isFirst ? '1px solid #e0e0e0' : '1px solid #f2f2f2',
                borderRight: '1px solid #f2f2f2',
                borderTopLeftRadius: isFirst ? '8px' : '0',
                borderBottomLeftRadius: isFirst ? '8px' : '0',
                fontSize: '13px',
                height: '40px',
                padding: '0 10px',
                color: '#555',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {row[col.id] ?? '-'}
            </TableCell>
          );
        })}

        {/* Edit icon */}
        <TableCell
          align="center"
          onClick={() => handleOpenEditModal?.(row)}
          style={{
            width: '52px',
            backgroundColor,
            borderTop: '1px solid #e0e0e0',
            borderBottom: '1px solid #e0e0e0',
            borderLeft: '1px solid #f2f2f2',
            borderRight: '1px solid #f2f2f2',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <Tooltip title="Time Stamp บันทึกเวลาส่งคืนวัตถุดิบ">
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40px' }}>
              <EditIcon sx={{ fontSize: '18px', color: '#FF9800' }} />
            </Box>
          </Tooltip>
        </TableCell>

        {/* Eye icon */}
        <TableCell
          align="center"
          onClick={() => setExpandedTimeline((p) => !p)}
          style={{
            width: '52px',
            backgroundColor,
            borderTop: '1px solid #e0e0e0',
            borderBottom: '1px solid #e0e0e0',
            borderLeft: '1px solid #f2f2f2',
            borderRight: '1px solid #e0e0e0',
            borderTopRightRadius: '8px',
            borderBottomRightRadius: '8px',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <Tooltip title={expandedTimeline ? 'ซ่อน Timeline' : 'ดู Timeline'}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40px' }}>
              {expandedTimeline
                ? <VisibilityOffIcon sx={{ fontSize: '18px', color: '#e53935' }} />
                : <VisibilityIcon sx={{ fontSize: '18px', color: '#1976d2' }} />
              }
            </Box>
          </Tooltip>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={colSpan} style={{ padding: 0, border: 'none' }}>
          <Collapse in={expandedTimeline} unmountOnExit>
            <TimelineSubRow row={row} />
          </Collapse>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell style={{ padding: 0, border: 'none' }} colSpan={colSpan} />
      </TableRow>
    </>
  );
};

// ─── Main TableMainPrep ────────────────────────────────────────────────────────
const TableMainPrep = ({
  data,
  handleOpenEditModal,
  selectedDate,
  onDateChange,
  onRefresh,
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
      data.filter((row) =>
        Object.values(row).some((v) => v?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
      )
    );
    setPage(0);
  }, [searchTerm, data]);

  const displayDate = selectedDate ? selectedDate.split('-').reverse().join('/') : '';

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

      {/* Search */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            variant="outlined"
            fullWidth
            placeholder="พิมพ์เพื่อค้นหา..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              sx: { height: '40px' },
            }}
            sx={{ '& .MuiOutlinedInput-root': { height: '40px', fontSize: '14px', borderRadius: '8px', color: '#787878' }, '& input': { padding: '8px' } }}
          />
          <Chip label={`${filteredRows.length} รายการ`} color="primary" size="small" />
        </Box>
      </Box>

      <TableContainer style={{ padding: '0 20px' }} sx={{ height: 'calc(60vh)', overflowY: 'auto', whiteSpace: 'nowrap' }}>
        <Table stickyHeader style={{ tableLayout: 'auto' }} sx={{ minWidth: '900px', width: 'max-content' }}>
          <TableHead>
            <TableRow sx={{ height: '40px' }}>
              {tableColumns.map((col, i) => (
                <TableCell
                  key={col.id}
                  align="center"
                  style={{
                    backgroundColor: 'hsl(210, 100%, 60%)',
                    borderTopLeftRadius: i === 0 ? '8px' : '0',
                    borderBottomLeftRadius: i === 0 ? '8px' : '0',
                    borderTop: '1px solid #e0e0e0',
                    borderBottom: '1px solid #e0e0e0',
                    borderLeft: i === 0 ? '1px solid #e0e0e0' : '1px solid #f2f2f2',
                    borderRight: '1px solid #f2f2f2',
                    fontSize: '13px',
                    padding: '5px 10px',
                    width: col.width,
                    color: '#fff',
                  }}
                >
                  {col.label}
                </TableCell>
              ))}
              <TableCell
                align="center"
                style={{
                  backgroundColor: 'hsl(210, 100%, 60%)',
                  borderTop: '1px solid #e0e0e0',
                  borderBottom: '1px solid #e0e0e0',
                  borderLeft: '1px solid #f2f2f2',
                  borderRight: '1px solid #f2f2f2',
                  width: '52px',
                  padding: '5px',
                  color: '#fff',
                  fontSize: '12px',
                }}
              >
                Time Stamp บันทึกเวลาส่งคืนวัตถุดิบ
              </TableCell>
              <TableCell
                align="center"
                style={{
                  backgroundColor: 'hsl(210, 100%, 60%)',
                  borderTopRightRadius: '8px',
                  borderBottomRightRadius: '8px',
                  borderTop: '1px solid #e0e0e0',
                  borderBottom: '1px solid #e0e0e0',
                  borderLeft: '1px solid #f2f2f2',
                  borderRight: '1px solid #e0e0e0',
                  width: '52px',
                  padding: '5px',
                  color: '#fff',
                  fontSize: '12px',
                }}
              >
                Timeline
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.length > 0
              ? filteredRows
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, i) => <Row key={row.sap_re_id ?? i} row={row} index={i} handleOpenEditModal={handleOpenEditModal} />)
              : (
                <TableRow>
                  <TableCell
                    colSpan={tableColumns.length + 2}
                    align="center"
                    sx={{ padding: '20px', fontSize: '16px', color: '#787878' }}
                  >
                    ไม่มีรายการวัตถุดิบในวันที่เลือก
                  </TableCell>
                </TableRow>
              )
            }
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        sx={{ '& .MuiTablePagination-selectLabel,.MuiTablePagination-displayedRows,.MuiTablePagination-toolbar': { fontSize: '10px', color: '#787878', padding: '0px' } }}
        rowsPerPageOptions={[20, 50, 100]}
        component="div"
        count={filteredRows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
      />
    </Paper>
  );
};

export default TableMainPrep;
