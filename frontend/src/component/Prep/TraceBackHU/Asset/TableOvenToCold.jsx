import React, { useState, useEffect } from 'react';
import { Table, TableContainer, TableHead, TableBody, TableRow, TableCell, Paper, Box, TextField, Collapse, TablePagination, Typography } from '@mui/material';
import { InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { FaRegCircle } from "react-icons/fa";
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import InfoIcon from '@mui/icons-material/Info';

// ปรับขนาดของคอลัมน์ให้เหมาะสมกับข้อมูลใหม่
const CUSTOM_COLUMN_WIDTHS = {
  tro_id: '180px',
  mat: '250px',
  mat_name: '350px',
  doc_no: '150px',
  rmm_line_name: '150px',
  action: '120px'
};

const ViewActionCell = ({ width, onClick, icon, backgroundColor, status }) => {
  // กำหนดสีของ icon ดวงตาให้เป็นสีเดียวกับ table head (สีฟ้า)
  const iconColor = "hsl(210, 100%, 60%)";

  return (
    <TableCell
      style={{
        width,
        textAlign: 'center',
        borderTop: '1px solid #e0e0e0',
        borderBottom: '1px solid #e0e0e0',
        borderLeft: '1px solid #f2f2f2',
        height: '40px',
        padding: '0px',
        borderRight: "1px solid #e0e0e0",
        cursor: 'pointer',
        transition: 'background-color 0.2s ease-in-out',
        borderTopRightRadius: "8px",
        borderBottomRightRadius: "8px",
        backgroundColor: backgroundColor
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#007BFF';
        e.currentTarget.querySelector('svg').style.color = '#fff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = backgroundColor;
        e.currentTarget.querySelector('svg').style.color = iconColor;
      }}
      onTouchStart={(e) => {
        e.currentTarget.style.backgroundColor = '#007BFF';
        e.currentTarget.querySelector('svg').style.color = '#fff';
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.backgroundColor = backgroundColor;
        e.currentTarget.querySelector('svg').style.color = iconColor;
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <VisibilityIcon style={{ color: iconColor, fontSize: '22px' }} />
      </div>
    </TableCell>
  );
};

const Row = ({
  row,
  openRowId,
  setOpenRowId,
  index
}) => {
  const backgroundColor = index % 2 === 0 ? '#ffffff' : "hsl(210, 100.00%, 88%)";
  const isOpen = openRowId === row.mapping_id;

  const mainRowData = {
    tro_id: row.tro_id || '-',
    mat: row.mat || '-',
    mat_name: row.mat_name || '-',
    doc_no: row.doc_no || '-',
    rmm_line_name: row.rmm_line_name || '-'
  };

  return (
    <>
      <TableRow>
        <TableCell style={{ height: "7px", padding: "0px", border: "0px solid" }}></TableCell>
      </TableRow>
      <TableRow>
        {Object.values(mainRowData).map((value, idx) => (
          <TableCell
            key={idx}
            align="center"
            style={{
              width: Object.values(CUSTOM_COLUMN_WIDTHS)[idx],
              borderTopLeftRadius: idx === 0 ? "8px" : "0",
              borderBottomLeftRadius: idx === 0 ? "8px" : "0",
              borderTop: '1px solid #e0e0e0',
              borderBottom: '1px solid #e0e0e0',
              borderLeft: idx === 0 ? "1px solid #e0e0e0" : "1px solid #f2f2f2",
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: '14px',
              height: '40px',
              lineHeight: '1.5',
              padding: '0px 15px',
              color: "#787878",
              backgroundColor: backgroundColor
            }}
          >
            {value}
          </TableCell>
        ))}

        <ViewActionCell
          width={CUSTOM_COLUMN_WIDTHS.action}
          onClick={(e) => {
            e.stopPropagation();
            setOpenRowId(isOpen ? null : row.mapping_id);
          }}
          backgroundColor={backgroundColor}
          status={null}
        />

      </TableRow>

      <TableRow>
        <TableCell colSpan={7} style={{ paddingBottom: 0, paddingTop: 0, border: 0 }}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{
              margin: 1,
              backgroundColor: "#f9f9f9",
              padding: 2,
              borderRadius: 2,
              boxShadow: '0px 2px 4px rgba(0,0,0,0.1)'
            }}>
              <Typography
                variant="h6"
                gutterBottom
                component="div"
                sx={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#333',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <InfoIcon color="primary" />
                รายละเอียด traceback ของ Batch: {row.Batch_RMForProd}
              </Typography>

              <Table size="small" sx={{
                backgroundColor: 'white',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #e0e0e0'
              }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '14px' }}>Batch เริ่มต้น</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '14px' }}>HU </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '14px' }}>Mat</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '14px' }}>รายชื่อวัตถุดิบ</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '14px' }}>Batch Before to Batch After</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {row.traceback && row.traceback.length > 0 ? (
                    row.traceback.map((tracebackItem, idx) => (
                      <TableRow
                        key={`${row.mapping_id}-${idx}`}
                        sx={{
                          '&:nth-of-type(odd)': { backgroundColor: '#f9f9f9' },
                          '&:hover': { backgroundColor: '#f0f7ff' }
                        }}
                      >
                        <TableCell align="center">{tracebackItem.batch_begin || '-'}</TableCell>
                        <TableCell align="center">{tracebackItem.hu || '-'}</TableCell>

                        <TableCell align="center">{tracebackItem.mat_begin || '-'}</TableCell>
                        <TableCell align="center">{tracebackItem.mat_name_begin || '-'}</TableCell>
                        <TableCell align="center">
                          {tracebackItem.batch_before && tracebackItem.batch_after
                            ? `${tracebackItem.batch_before} → ${tracebackItem.batch_after}`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ padding: "20px", fontSize: "14px", color: "#787878", fontStyle: 'italic' }}>
                        ไม่มีข้อมูล traceback
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>

              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell style={{ padding: "0px", border: "0px solid" }}></TableCell>
      </TableRow>
    </>
  );
};

const TableRMForProd = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRows, setFilteredRows] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [openRowId, setOpenRowId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);

    if (data && data.length > 0) {
      // ข้อมูลมาในรูปแบบ array ของ RMForProd แล้ว ไม่ต้องจัดกลุ่ม
      setFilteredRows(data);
    } else {
      setFilteredRows([]);
    }

    setIsLoading(false);
  }, [data]);

  useEffect(() => {
    const filterData = () => {
      let filtered = [...data]; // สร้างสำเนาของข้อมูลต้นฉบับ

      // กรองตามคำค้นหา
      if (searchTerm) {
        filtered = filtered.filter((item) => {
          // ค้นหาในข้อมูลหลัก
          const mainDataMatch = Object.values(item).some(value =>
            value && typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase())
          );

          // ค้นหาในข้อมูล traceback
          const tracebackMatch = item.traceback && item.traceback.some(tracebackItem =>
            Object.values(tracebackItem).some(value =>
              value && typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase())
            )
          );

          return mainDataMatch || tracebackMatch;
        });
      }

      setFilteredRows(filtered);
    };

    filterData();
  }, [searchTerm, data]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  };

  const mainColumns = [
    "รถเข็น", "Material", "รายชื่อวัตถุดิบ", "DOC_NO", "ไลน์",
  ];

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden', boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.2)' }}>
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: 'center',
        gap: 1,
        paddingX: 2,
        height: { xs: 'auto', sm: '60px' },
        margin: '5px 5px'
      }}>
        <TextField
          variant="outlined"
          fullWidth
          placeholder="พิมพ์เพื่อค้นหา..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            sx: { height: "40px" },
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              height: "40px",
              fontSize: "14px",
              borderRadius: "8px",
              color: "#787878",
            },
            "& input": {
              padding: "8px",
            },
          }}
        />
      </Box>

      <TableContainer
        style={{ padding: '0px 20px' }}
        sx={{
          height: 'calc(68vh)',
          overflowY: 'auto',
          whiteSpace: 'nowrap',
          '@media (max-width: 1400px)': {
            overflowX: 'scroll',
            minWidth: "1400px"
          }
        }}
      >
        <Table
          stickyHeader
          style={{ tableLayout: 'auto' }}
          sx={{ minWidth: '1400px', width: '100%' }}
        >
          <TableHead style={{ marginBottom: "10px" }}>
            <TableRow sx={{ height: '40px' }}>
              {mainColumns.slice(0, 6).map((header, index) => (
                <TableCell
                  key={index}
                  align="center"
                  style={{
                    backgroundColor: "hsl(210, 100%, 60%)",
                    borderTop: "1px solid #e0e0e0",
                    borderBottom: "1px solid #e0e0e0",
                    borderRight: "1px solid #f2f2f2",
                    borderLeft: index === 0 ? "1px solid #e0e0e0" : "1px solid #f2f2f2",
                    borderTopLeftRadius: index === 0 ? "8px" : "0",
                    borderBottomLeftRadius: index === 0 ? "8px" : "0",
                    fontSize: '16px',
                    color: '#ffffff',
                    padding: '10px',
                    width: Object.values(CUSTOM_COLUMN_WIDTHS)[index]
                  }}
                >
                  {header}
                </TableCell>
              ))}

              {/* Action column */}
              <TableCell
                align="center"
                style={{
                  backgroundColor: "hsl(210, 100%, 60%)",
                  borderTopRightRadius: "8px",
                  borderBottomRightRadius: "8px",
                  borderTop: "1px solid #e0e0e0",
                  borderBottom: "1px solid #e0e0e0",
                  borderRight: "1px solid #e0e0e0",
                  fontSize: '16px',
                  color: '#ffffff',
                  padding: '10px',
                  width: CUSTOM_COLUMN_WIDTHS.action
                }}
              >
                Action
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody sx={{ '& > tr': { marginBottom: '8px' } }}>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ padding: "20px", fontSize: "16px", color: "#787878" }}>
                  กำลังโหลดข้อมูล...
                </TableCell>
              </TableRow>
            ) : filteredRows.length > 0 ? (
              filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <Row
                  key={row.mapping_id || index}
                  row={row}
                  openRowId={openRowId}
                  index={index}
                  setOpenRowId={setOpenRowId}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ padding: "20px", fontSize: "16px", color: "#787878" }}>
                  ไม่มีรายการข้อมูลในขณะนี้
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        sx={{
          "& .MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows, .MuiTablePagination-toolbar": {
            fontSize: '12px',
            color: "#787878",
            padding: "0px",
          }
        }}
        rowsPerPageOptions={[20, 50, 100]}
        component="div"
        count={filteredRows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default TableRMForProd;