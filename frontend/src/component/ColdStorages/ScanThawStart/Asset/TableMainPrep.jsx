import React, { useState, useEffect } from 'react';
import {
  Table, TableContainer, TableHead, TableBody, TableRow, TableCell,
  Paper, Box, TextField, Collapse, TablePagination, Typography, Tooltip
} from '@mui/material';
import { InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { SlClose } from "react-icons/sl";
import { FaRegCircle } from "react-icons/fa";

// คอลัมน์หลักที่แสดงในตาราง
const MAIN_COLS = [
  { key: 'batch',         label: 'Batch' },
  { key: 'mat',           label: 'Material' },
  { key: 'hu',            label: 'HU' },
  { key: 'weight',        label: 'Weight' },
];

// ทุก timestamp field พร้อม label และ color ตามประเภท
const ALL_TIME_FIELDS = [
  { key: 'start_defrost_date',       label: 'เริ่มละลาย',                color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date',         label: 'ละลายเสร็จ',                color: '#0277bd', bg: '#e3f2fd' },
  { key: 'start_defrost_date_two',   label: 'เริ่มละลาย (รอบ 2)',        color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date_two',     label: 'ละลายเสร็จ (รอบ 2)',        color: '#0277bd', bg: '#e3f2fd' },
  { key: 'start_defrost_date_three', label: 'เริ่มละลาย (รอบ 3)',        color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date_three',   label: 'ละลายเสร็จ (รอบ 3)',        color: '#0277bd', bg: '#e3f2fd' },
  { key: 'start_defrost_date_four',  label: 'เริ่มละลาย (รอบ 4)',        color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date_four',    label: 'ละลายเสร็จ (รอบ 4)',        color: '#0277bd', bg: '#e3f2fd' },
  { key: 'withdraw_date',            label: 'ส่งออกห้องเย็น',             color: '#1565C0', bg: '#e8eaf6' },
  { key: 'input_pd_date',            label: 'ไลน์รับเข้า รอบ 1',         color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date',           label: 'ไลน์ส่งคืน รอบ 1',          color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date',            label: 'ห้องเย็นรับเข้า รอบ 1',     color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_two',        label: 'ส่งออกห้องเย็น รอบ 2',      color: '#1565C0', bg: '#e8eaf6' },
  { key: 'input_pd_date_two',        label: 'ไลน์รับเข้า รอบ 2',         color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date_two',       label: 'ไลน์ส่งคืน รอบ 2',          color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date_two',        label: 'ห้องเย็นรับเข้า รอบ 2',     color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_three',      label: 'ส่งออกห้องเย็น รอบ 3',      color: '#1565C0', bg: '#e8eaf6' },
  { key: 'input_pd_date_three',      label: 'ไลน์รับเข้า รอบ 3',         color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date_three',     label: 'ไลน์ส่งคืน รอบ 3',          color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date_three',      label: 'ห้องเย็นรับเข้า รอบ 3',     color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_four',       label: 'ส่งออกห้องเย็น รอบ 4',      color: '#1565C0', bg: '#e8eaf6' },
];

// edit(x) + eye + MAIN_COLS + delete(x)
// header: eye + MAIN_COLS + delete = 1 + 4 + 1 = 6
const TOTAL_COLS = 1 + MAIN_COLS.length + 1;

// ─── TimeSubRow ───────────────────────────────────────────────────────────────
const TimeSubRow = ({ row }) => {
  const sorted = ALL_TIME_FIELDS
    .filter(f => row[f.key])
    .map(f => ({ ...f, value: row[f.key] }))
    .sort((a, b) => new Date(a.value.replace(' ', 'T')) - new Date(b.value.replace(' ', 'T')));

  if (sorted.length === 0) {
    return (
      <Box sx={{ py: 1.5, px: 2, backgroundColor: '#f8fafc', borderBottom: '1px solid #e0e0e0' }}>
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
      borderBottom: '1px solid #e0e0e0',
      overflowX: 'auto',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}>
        {sorted.map((item, idx) => (
          <React.Fragment key={item.key}>
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

// ─── CompleteActionCell (ปุ่มลบ) ─────────────────────────────────────────────
const CompleteActionCell = ({ onClick, icon, backgroundColor }) => (
  <TableCell
    style={{
      textAlign: 'center',
      borderTop: '1px solid #e0e0e0',
      borderBottom: '1px solid #e0e0e0',
      borderLeft: '1px solid #f2f2f2',
      borderRight: '1px solid #e0e0e0',
      borderTopRightRadius: '8px',
      borderBottomRightRadius: '8px',
      height: '40px',
      padding: '0px',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease-in-out',
      backgroundColor,
      width: '60px',
    }}
    onClick={onClick}
    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#c20000ff'; e.currentTarget.querySelector('svg').style.color = '#fff'; }}
    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = backgroundColor; e.currentTarget.querySelector('svg').style.color = '#c20000ff'; }}
    onTouchStart={(e) => { e.currentTarget.style.backgroundColor = '#c20000ff'; e.currentTarget.querySelector('svg').style.color = '#fff'; }}
    onTouchEnd={(e) => { e.currentTarget.style.backgroundColor = backgroundColor; e.currentTarget.querySelector('svg').style.color = '#c20000ff'; }}
  >
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      {icon}
    </div>
  </TableCell>
);

// ─── Row ──────────────────────────────────────────────────────────────────────
const Row = ({ row, handleOpenSuccess, index }) => {
  const [expanded, setExpanded] = useState(false);
  const backgroundColor = index % 2 === 0 ? '#ffffff' : 'hsl(210, 100.00%, 88%)';

  return (
    <>
      <TableRow>
        <TableCell colSpan={TOTAL_COLS} style={{ height: '7px', padding: '0px', border: '0px solid' }} />
      </TableRow>
      <TableRow>
        {/* Eye button */}
        <TableCell
          style={{
            textAlign: 'center',
            border: '1px solid #e0e0e0',
            borderRight: '1px solid #f2f2f2',
            borderTopLeftRadius: '8px',
            borderBottomLeftRadius: '8px',
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
                ? <VisibilityOffIcon style={{ color: '#1565C0', fontSize: '20px' }} />
                : <VisibilityIcon style={{ color: '#9e9e9e', fontSize: '20px' }} />
              }
            </div>
          </Tooltip>
        </TableCell>

        {/* Main data cells */}
        {MAIN_COLS.map(({ key }, idx) => (
          <TableCell key={key} align="center" style={{
            borderTop: '1px solid #e0e0e0',
            borderBottom: '1px solid #e0e0e0',
            borderLeft: '1px solid #f2f2f2',
            fontSize: '14px',
            height: '40px',
            padding: '0px 10px',
            color: '#787878',
            backgroundColor,
            whiteSpace: 'nowrap',
          }}>
            {row[key] ?? '-'}
          </TableCell>
        ))}

        {/* Delete button */}
        <CompleteActionCell
          onClick={(e) => { e.stopPropagation(); handleOpenSuccess(row); }}
          icon={<SlClose style={{ color: '#c20000ff', fontSize: '18px' }} />}
          backgroundColor={backgroundColor}
        />
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
const TableMainPrep = ({ handleOpenModal, data, handleRowClick, handleOpenEditModal, handleOpenSuccess }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRows, setFilteredRows] = useState(data);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [selectedColor, setSelectedColor] = useState('');

  useEffect(() => {
    setFilteredRows(
      data.filter((row) =>
        Object.values(row).some((value) =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    );
  }, [searchTerm, data]);

  const handleFilterChange = (color) => {
    setSelectedColor(color === selectedColor ? '' : color);
  };

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden', boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.2)' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 1, paddingX: 2, height: { xs: 'auto', sm: '60px' }, margin: '5px 5px' }}>
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
          sx={{
            '& .MuiOutlinedInput-root': { height: '40px', fontSize: '14px', borderRadius: '8px', color: '#787878' },
            '& input': { padding: '8px' },
          }}
        />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-start' }}>
          {['green', 'yellow', 'red'].map((color) => (
            <FilterButton key={color} color={color} selectedColor={selectedColor} onClick={() => handleFilterChange(color)} />
          ))}
        </Box>
      </Box>

      <TableContainer style={{ padding: '0px 20px' }} sx={{ height: 'calc(68vh)', overflowY: 'auto' }}>
        <Table stickyHeader style={{ tableLayout: 'auto' }} sx={{ minWidth: '500px', width: '100%' }}>
          <TableHead>
            <TableRow sx={{ height: '40px' }}>
              <TableCell align="center" style={{ backgroundColor: 'hsl(210,100%,60%)', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px', border: '1px solid #e0e0e0', borderRight: '1px solid #f2f2f2', padding: '5px', width: '50px' }}>
                <Box style={{ color: '#fff', display: 'flex', justifyContent: 'center' }}>
                  <VisibilityIcon style={{ fontSize: '18px' }} />
                </Box>
              </TableCell>
              {MAIN_COLS.map(({ key, label }) => (
                <TableCell key={key} align="center" style={{ backgroundColor: 'hsl(210,100%,60%)', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #f2f2f2', fontSize: '12px', padding: '5px' }}>
                  <Box style={{ fontSize: '16px', color: '#fff' }}>{label}</Box>
                </TableCell>
              ))}
              <TableCell align="center" style={{ backgroundColor: 'hsl(210,100%,60%)', borderTopRightRadius: '8px', borderBottomRightRadius: '8px', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0', fontSize: '12px', padding: '5px', width: '60px' }}>
                <Box style={{ fontSize: '16px', color: '#fff' }}>ลบ</Box>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredRows.length > 0
              ? filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <Row
                  key={row.rmfp_id ?? index}
                  row={row}
                  handleOpenSuccess={handleOpenSuccess}
                  index={index}
                />
              ))
              : (
                <TableRow>
                  <TableCell colSpan={TOTAL_COLS} align="center" sx={{ padding: '20px', fontSize: '16px', color: '#787878' }}>
                    ไม่มีรายการวัตถุดิบในขณะนี้
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

// ─── FilterButton ─────────────────────────────────────────────────────────────
const FilterButton = ({ color, selectedColor, onClick }) => {
  const [isHovered, setHovered] = useState(false);
  const colors = {
    green:  { default: '#54e032', hover: '#6eff42', selected: '#54e032' },
    yellow: { default: '#f0cb4d', hover: '#ffdf5d', selected: '#f0cb4d' },
    red:    { default: '#ff4444', hover: '#ff6666', selected: '#ff4444' },
  };
  const isSelected = selectedColor === color;
  const currentColor = colors[color];

  return (
    <div
      style={{
        border: isSelected ? `2px solid ${currentColor.selected}` : `1px solid ${isHovered ? currentColor.hover : '#e0e0e0'}`,
        padding: 6,
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        backgroundColor: isSelected ? 'transparent' : isHovered ? currentColor.hover : currentColor.default,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isSelected && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: currentColor.selected, opacity: 0.2, zIndex: 0 }} />
      )}
      <FaRegCircle style={{ color: '#ffffff', fontSize: 24, position: 'relative', zIndex: 1, opacity: isSelected ? 1 : 0.9 }} />
    </div>
  );
};

export default TableMainPrep;
