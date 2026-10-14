import React, { useState, useEffect } from 'react';
import {
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  Box,
  Typography,
  Collapse,
  IconButton,
  Paper,
  Tooltip,
  Grid,
  Card,
  TextField,
  InputAdornment
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InventoryIcon from '@mui/icons-material/Inventory';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';
import ModalPrint from './ModalPrint';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PaletteIcon from '@mui/icons-material/Palette';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';
import StraightenIcon from '@mui/icons-material/Straighten';
import FactCheckIcon from '@mui/icons-material/FactCheck';

import withTableTools from "../../../Layout/withTableTools";
const formatDate = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };

  return new Intl.DateTimeFormat('en-TH', options).format(date);
};

const COLUMN_WIDTHS = {
  Batch: '13.98%',
  Material: '9.68%',
  รายชื่อวัตถุดิบ: '15.05%',
  แผนการผลิต: '8.6%',
  สถานที่จัดส่ง: '9.68%',
  น้ำหนัก: '8%',
  การจัดการ: '11.83%',
  LevelEu: '10.75%',
  เวลาต้มอบเสร็จ: '12.9%'
};

const Row = ({ row, index }) => {
  const [open, setOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const backgroundColor = index % 2 === 0 ? '#ffffff' : "#EAF0FF";
  const uniqueKey = `${row.mapping_id}_${row.created_at || index}`;

  const handlePrintClick = () => {
    setPrintModalOpen(true);
  };

  const handleClosePrintModal = () => {
    setPrintModalOpen(false);
  };

  const getStatusButton = (status) => {
    if (!status || status.trim() === '-') return null;

    const statusLower = status.trim().toLowerCase();
    if (statusLower === 'ผ่าน' || statusLower.includes('pass')) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 1, mb: 1 }}>
          <Box sx={{ backgroundColor: '#388e3c', color: 'white', borderRadius: '20px', padding: '4px 16px', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '14px', fontWeight: 'medium' }}>
            <CheckIcon fontSize="small" />
            ผ่าน
          </Box>
        </Box>
      );
    } else if (statusLower === 'ไม่ผ่าน' || statusLower.includes('fail') || statusLower.includes('not')) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 1, mb: 1 }}>
          <Box sx={{ backgroundColor: '#d32f2f', color: 'white', borderRadius: '20px', padding: '4px 16px', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '14px', fontWeight: 'medium' }}>
            <CloseIcon fontSize="small" />
            ไม่ผ่าน
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 1, mb: 1 }}>
        <Box sx={{ backgroundColor: '#388e3c', color: 'white', borderRadius: '20px', padding: '4px 16px', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '14px', fontWeight: 'medium' }}>
          <CheckIcon fontSize="small" />
          {status}
        </Box>
      </Box>
    );
  };

  const displayBatch = row.batch_after || row.batch_before || "-";

  return (
    <>
      <TableRow sx={{ backgroundColor: backgroundColor, height: '45px' }}>
        <TableCell align="left" style={{ padding: '8px 16px', borderBottom: '1px solid #eaeaea', fontSize: '14px', color: "#F1F4FA", fontWeight: 'medium' }}>
          {displayBatch}
        </TableCell>
        <TableCell align="center" style={{ padding: '8px 5px', borderBottom: '1px solid #eaeaea', fontSize: '14px', color: "rgba(241,244,250,.62)" }}>
          {row.mat || "-"}
        </TableCell>
        <TableCell align="center" style={{ padding: '8px 5px', borderBottom: '1px solid #eaeaea', fontSize: '14px', color: "rgba(241,244,250,.62)" }}>
          {row.mat_name || "-"}
        </TableCell>
        <TableCell align="center" style={{ padding: '8px 5px', borderBottom: '1px solid #eaeaea', fontSize: '14px', color: "rgba(241,244,250,.62)" }}>
          {row.production || "-"}
        </TableCell>
        <TableCell align="center" style={{ padding: '8px 5px', borderBottom: '1px solid #eaeaea', fontSize: '14px', color: "rgba(241,244,250,.62)" }}>
          {row.tro_id || "-"}
        </TableCell>
        <TableCell align="center" style={{ padding: '8px 5px', borderBottom: '1px solid #eaeaea', fontSize: '14px', color: "rgba(241,244,250,.62)" }}>
          {row.dest || "-"}
        </TableCell>
        <TableCell align="center" style={{ padding: '8px 5px', borderBottom: '1px solid #eaeaea', fontSize: '14px', color: "rgba(241,244,250,.62)" }}>
          {row.weight_RM ? parseFloat(row.weight_RM).toFixed(2) : "-"}
        </TableCell>
        <TableCell align="center" style={{ padding: '8px 5px', borderBottom: '1px solid #eaeaea', fontSize: '14px', color: "rgba(241,244,250,.62)" }}>
          {row.level_eu || "-"}
        </TableCell>
        <TableCell align="center" style={{ padding: '8px 5px', borderBottom: '1px solid #eaeaea', fontSize: '14px', color: "rgba(241,244,250,.62)" }}>
          {formatDate(row.CookedDateTime) || "-"}
        </TableCell>
        <TableCell align="center" style={{ padding: '8px 5px', borderBottom: '1px solid #eaeaea', fontSize: '14px', color: "rgba(241,244,250,.62)" }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
            <Tooltip title="ดูประวัติเพิ่มเติม">
              <IconButton aria-label="view history" size="small" onClick={() => setOpen(!open)} color={open ? "primary" : "default"} sx={{ width: '30px', height: '30px', border: open ? '1px solid #90caf9' : '1px solid #E3E8F2', backgroundColor: "rgba(255,255,255,.07)" }}>
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="พิมพ์ข้อมูล">
              <IconButton aria-label="print" size="small" onClick={handlePrintClick} sx={{ width: '30px', height: '30px', border: '1px solid rgba(255,255,255,.14)', backgroundColor: "rgba(255,255,255,.07)" }}>
                <PrintIcon fontSize="small" color="action" />
              </IconButton>
            </Tooltip>
          </Box>

          <ModalPrint open={printModalOpen} onClose={handleClosePrintModal} rowData={row} />
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell style={{ padding: 0 }} colSpan={9}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: '0 1px 16px 1px', backgroundColor: "rgba(255,255,255,.05)", borderRadius: '4px', padding: '16px', border: '1px solid rgba(255,255,255,.14)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <FactCheckIcon fontSize="small" sx={{ color: "#FFB27A" }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: "#F1F4FA" }}>
                  ข้อมูลการตรวจสอบ QC
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ height: '100%', minHeight: '180px' }}>
                    <Box sx={{ backgroundColor: "rgba(255,255,255,.05)", px: 2, py: 1.5, borderBottom: '1px solid #bbdefb' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PaletteIcon sx={{ color: "#FFB27A" }} />
                        <Typography variant="subtitle1" sx={{ color: "#FFB27A", fontWeight: 'bold' }}>
                          Sensory (สี, กลิ่น, เนื้อ)
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ p: 2 }}>
                      {getStatusButton(row?.qccheck?.trim())}

                      {row?.sq_remark && row.sq_remark !== '-' && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'medium', mb: 0.5, display: 'block' }}>
                            {row?.sq_acceptance === true ? "ยอมรับพิเศษ หมายเหตุ Sensory:" : "หมายเหตุ Sensory:"}
                          </Typography>
                          <TextField
                            fullWidth
                            variant="outlined"
                            size="small"
                            value={row.sq_remark || '-'}
                            InputProps={{
                              readOnly: true,
                              sx: { fontSize: '14px', backgroundColor: row?.sq_acceptance === true ? '#fff8e1' : '#F5F8FF' }
                            }}
                            multiline
                            minRows={2}
                          />
                        </Box>
                      )}

                      {(!row?.sq_remark || row.sq_remark === '-') && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" color="textSecondary">
                            ไม่มีหมายเหตุ
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ height: '100%', minHeight: '180px' }}>
                    <Box sx={{ backgroundColor: "rgba(251,191,36,.14)", px: 2, py: 1.5, borderBottom: '1px solid #ffe0b2' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SettingsInputComponentIcon sx={{ color: '#ff9800' }} />
                        <Typography variant="subtitle1" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
                          MD (เครื่องตรวจโลหะ)
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ p: 2 }}>
                      {getStatusButton(row?.mdcheck?.trim())}

                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'medium', mb: 0.5, display: 'block' }}>
                          พื้นที่/หมายเลขเครื่อง:
                        </Typography>
                        <TextField
                          fullWidth
                          variant="outlined"
                          size="small"
                          value={
                            row?.WorkAreaName
                              ? `${row.WorkAreaName} (${row.WorkAreaCode || '-'}/${row.md_no || '-'})`
                              : `${row.WorkAreaCode || '-'}/${row.md_no || '-'}`
                          }
                          InputProps={{
                            readOnly: true,
                            sx: { fontSize: '14px', backgroundColor: "rgba(255,255,255,.05)" }
                          }}
                        />
                      </Box>

                      {row?.md_remark && row.md_remark !== '-' && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'medium', mb: 0.5, display: 'block' }}>
                            หมายเหตุ:
                          </Typography>
                          <TextField
                            fullWidth
                            variant="outlined"
                            size="small"
                            value={row.md_remark || '-'}
                            InputProps={{
                              readOnly: true,
                              sx: { fontSize: '14px', backgroundColor: "rgba(255,255,255,.05)" }
                            }}
                            multiline
                            minRows={2}
                          />
                        </Box>
                      )}
                    </Box>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ height: '100%', minHeight: '180px' }}>
                    <Box sx={{ backgroundColor: "rgba(248,113,113,.16)", px: 2, py: 1.5, borderBottom: '1px solid #ffcdd2' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StraightenIcon sx={{ color: "#FCA5A5" }} />
                        <Typography variant="subtitle1" sx={{ color: "#FCA5A5", fontWeight: 'bold' }}>
                          Defect (ขนาด, ก้าง)
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ p: 2 }}>
                      {getStatusButton(row?.defectcheck?.trim())}

                      {row?.defect_remark && row.defect_remark !== '-' && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'medium', mb: 0.5, display: 'block' }}>
                            {row?.defect_acceptance === true ? "ยอมรับพิเศษ หมายเหตุ Defect:" : "หมายเหตุ Defect:"}
                          </Typography>
                          <TextField
                            fullWidth
                            variant="outlined"
                            size="small"
                            value={row.defect_remark || '-'}
                            InputProps={{
                              readOnly: true,
                              sx: { fontSize: '14px', backgroundColor: row?.defect_acceptance === true ? '#fff8e1' : '#F5F8FF' }
                            }}
                            multiline
                            minRows={2}
                          />
                        </Box>
                      )}

                      {(!row?.defect_remark || row.defect_remark === '-') && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" color="textSecondary">
                            ไม่มีหมายเหตุ
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Card>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 2, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon sx={{ color: "#FFB27A" }} />
                  <Typography variant="body2" sx={{ color: "rgba(241,244,250,.62)" }}>
                    <b>ผู้ดำเนินการ:</b> {row?.receiver_qc ?? '-'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarTodayIcon sx={{ color: "#FFB27A" }} />
                  <Typography variant="body2" sx={{ color: "rgba(241,244,250,.62)" }}>
                    <b>วันเวลาที่ QC ตรวจสอบ:</b> {row?.qc_datetime_formatted ?? '-'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const QcHisTable = ({
  filteredData = [],
  page = 0,
  rowsPerPage = 20,
  handleChangePage,
  handleChangeRowsPerPage,
  backgroundColor = "#ffffff"
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [internalFilteredData, setInternalFilteredData] = useState(filteredData);

  useEffect(() => {
    if (searchTerm === '') {
      setInternalFilteredData(filteredData);
    } else {
      const filtered = filteredData.filter(row =>
        Object.values(row).some(value =>
          value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      setInternalFilteredData(filtered);
    }
  }, [searchTerm, filteredData]);

  return (
    <>
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
              color: "rgba(241,244,250,.62)",
            },
            "& input": {
              padding: "8px",
            },
          }}
        />
      </Box>

      <TableContainer
        component={Paper}
        elevation={0}
        variant="outlined"
        style={{ padding: '0' }}
        sx={{
          height: 'calc(80vh - 8rem)',
          width: '100%',
          overflowY: 'auto',
          marginTop: 0,
          borderRadius: '8px',
          borderColor: 'rgba(255,255,255,.14)',
          backgroundColor: backgroundColor
        }}
      >
        <Table stickyHeader style={{ tableLayout: 'fixed' }} sx={{ width: '100%' }}>
          <TableHead>
            <TableRow sx={{ height: '45px', backgroundColor: "rgba(255,255,255,.05)" }}>
              <TableCell align="center" style={{ backgroundColor: "#1552F0", borderBottom: "2px solid rgba(255,255,255,.14)", borderRight: "1px solid rgba(255,255,255,.14)", fontSize: '12px', color: "rgba(241,244,250,.62)", padding: '5px', width: COLUMN_WIDTHS.Batch, fontWeight: 'normal' }}>
                <Box style={{ fontSize: '14px', color: '#ffffff' }}>Batch</Box>
              </TableCell>
              <TableCell align="center" style={{ backgroundColor: "#1552F0", borderBottom: "2px solid rgba(255,255,255,.14)", borderRight: "1px solid rgba(255,255,255,.14)", fontSize: '12px', color: "rgba(241,244,250,.62)", padding: '5px', width: COLUMN_WIDTHS.Material, fontWeight: 'normal' }}>
                <Box style={{ fontSize: '14px', color: '#ffffff' }}>Material</Box>
              </TableCell>
              <TableCell align="center" style={{ backgroundColor: "#1552F0", borderBottom: "2px solid rgba(255,255,255,.14)", borderRight: "1px solid rgba(255,255,255,.14)", fontSize: '12px', color: "rgba(241,244,250,.62)", padding: '5px', width: COLUMN_WIDTHS.รายชื่อวัตถุดิบ, fontWeight: 'normal' }}>
                <Box style={{ fontSize: '14px', color: '#ffffff' }}>รายชื่อวัตถุดิบ
                </Box>
              </TableCell>
              <TableCell align="center" style={{ backgroundColor: "#1552F0", borderBottom: "2px solid rgba(255,255,255,.14)", borderRight: "1px solid rgba(255,255,255,.14)", fontSize: '12px', color: "rgba(241,244,250,.62)", padding: '5px', width: COLUMN_WIDTHS.แผนการผลิต, fontWeight: 'normal' }}>
                <Box style={{ fontSize: '14px', color: '#ffffff' }}>แผนการผลิต
                </Box>
              </TableCell>
              <TableCell align="center" style={{ backgroundColor: "#1552F0", borderBottom: "2px solid rgba(255,255,255,.14)", borderRight: "1px solid rgba(255,255,255,.14)", fontSize: '12px', color: "rgba(241,244,250,.62)", padding: '5px', width: COLUMN_WIDTHS.แผนการผลิต, fontWeight: 'normal' }}>
                <Box style={{ fontSize: '14px', color: '#ffffff' }}>หมายเลขรถเข็น
                </Box>
              </TableCell>
              <TableCell align="center" style={{ backgroundColor: "#1552F0", borderBottom: "2px solid rgba(255,255,255,.14)", borderRight: "1px solid rgba(255,255,255,.14)", fontSize: '12px', color: "rgba(241,244,250,.62)", padding: '5px', width: COLUMN_WIDTHS.สถานที่จัดส่ง, fontWeight: 'normal' }}>
                <Box style={{ fontSize: '14px', color: '#ffffff' }}>สถานที่จัดส่ง</Box>
              </TableCell>
              <TableCell align="center" style={{ backgroundColor: "#1552F0", borderBottom: "2px solid rgba(255,255,255,.14)", borderRight: "1px solid rgba(255,255,255,.14)", fontSize: '12px', color: "rgba(241,244,250,.62)", padding: '5px', width: COLUMN_WIDTHS.น้ำหนัก, fontWeight: 'normal' }}>
                <Box style={{ fontSize: '14px', color: '#ffffff' }}>น้ำหนัก (kg)</Box>
              </TableCell>
              <TableCell align="center" style={{ backgroundColor: "#1552F0", borderBottom: "2px solid rgba(255,255,255,.14)", borderRight: "1px solid rgba(255,255,255,.14)", fontSize: '12px', color: "rgba(241,244,250,.62)", padding: '5px', width: COLUMN_WIDTHS.LevelEu, fontWeight: 'normal' }}>
                <Box style={{ fontSize: '14px', color: '#ffffff' }}>Level Eu</Box>
              </TableCell>
              <TableCell align="center" style={{ backgroundColor: "#1552F0", borderBottom: "2px solid rgba(255,255,255,.14)", fontSize: '12px', color: "rgba(241,244,250,.62)", padding: '5px', width: COLUMN_WIDTHS.เวลาต้มอบเสร็จ, fontWeight: 'normal' }}>
                <Box style={{ fontSize: '14px', color: '#ffffff' }}>เวลาต้ม/อบเสร็จ</Box>
              </TableCell>
              <TableCell align="center" style={{ backgroundColor: "#1552F0", borderBottom: "2px solid rgba(255,255,255,.14)", borderLeft: "1px solid #ffffff", fontSize: '12px', color: "rgba(241,244,250,.62)", padding: '5px', width: COLUMN_WIDTHS.การจัดการ, fontWeight: 'normal' }}>
                <Box style={{ fontSize: '14px', color: '#ffffff' }}>การจัดการ</Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={{ '& > tr': { marginBottom: '8px' } }}>
            {internalFilteredData.length > 0 ? (
              internalFilteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <React.Fragment key={`${row.mapping_id}_${row.create_at || index}`}>
                  <Row key={index} row={row} index={index} />
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ padding: "40px", fontSize: "16px", color: "rgba(241,244,250,.62)" }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <InventoryIcon sx={{ fontSize: 40, color: "rgba(241,244,250,.30)" }} />
                    <Typography>ไม่มีข้อมูลประวัติการตรวจสอบ</Typography>
                  </Box>
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
            color: "rgba(241,244,250,.62)",
            padding: "0px",
          },
          marginTop: '8px',
          padding: '0'
        }}
        rowsPerPageOptions={[20, 1000, 10000]}
        component="div"
        count={internalFilteredData.length || 0}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="แสดง"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}–${to} จาก ${count !== -1 ? count : `มากกว่า ${to}`}`
        }
      />
    </>
  );
};

export default withTableTools(QcHisTable, "filteredData");