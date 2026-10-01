import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  TextField,
  Button,
  Stack
} from '@mui/material';

import QcHisTable from "./Table";

const API_URL = import.meta.env.VITE_API_URL;

// Helper: คืนวันที่ปัจจุบันในรูปแบบ YYYY-MM-DD
const getToday = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

const ParentComponent = () => {
  // State สำหรับจัดการข้อมูล
  const [qcHistoryData, setQcHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State สำหรับ Pagination (ฝั่ง client เท่านั้น เพราะ API ดึงข้อมูลทั้งหมดมาแล้ว)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // State สำหรับช่วงวันที่ (rmit_date)
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());

  const fetchData = async (start, end) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_URL}/api/qc/History/ByDate`, {
        params: { start, end }
      });

      console.log('ได้รับข้อมูลจาก API:', response.data);

      const preparedData = response.data.data.map(item => {
        return {
          ...item,
          qcData: {
            sq_remark: item.sq_remark,
            md: item.md,
            md_remark: item.md_remark,
            defect: item.defect,
            defect_remark: item.defect_remark,
            md_no: item.md_no,
            WorkAreaCode: item.WorkAreaCode,
            WorkAreaName: item.WorkAreaName,
            qccheck: item.qccheck,
            mdcheck: item.mdcheck,
            defectcheck: item.defectcheck,
            sq_acceptance: item.sq_acceptance,
            defect_acceptance: item.defect_acceptance,
            process_name: item.process_name,
            name_edit_prod_two: item.name_edit_prod_two,
            name_edit_prod_three: item.name_edit_prod_three,
            first_prod: item.first_prod,
            two_prod: item.two_prod,
            three_prod: item.three_prod,
            mapping_id: item.mapping_id,
            mat: item.mat
          }
        };
      });

      setQcHistoryData(preparedData);
      setPage(0); // reset หน้าทุกครั้งที่ดึงข้อมูลใหม่
      setLoading(false);

    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
      setError(`ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้: ${error.message}`);
      setLoading(false);
    }
  };

  // โหลดข้อมูลครั้งแรก (ใช้ค่าเริ่มต้น = วันนี้)
  useEffect(() => {
    fetchData(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ค้นหาด้วยช่วงวันที่ที่เลือก
  const handleSearch = () => {
    if (!startDate || !endDate) {
      setError('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด');
      return;
    }
    if (startDate > endDate) {
      setError('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
      return;
    }
    fetchData(startDate, endDate);
  };

  // จัดการการเปลี่ยนหน้า
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // จัดการการเปลี่ยนจำนวนแถวต่อหน้า
  const handleChangeRowsPerPage = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  };

  return (
    <Paper sx={{
      width: '100%',
      height: 'calc(100vh - 5rem)',
      overflow: 'hidden',
      boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.2)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* แถบเลือกช่วงวันที่ */}
      <Box sx={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField
            label="วันที่เริ่มต้น"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="วันที่สิ้นสุด"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loading}
            sx={{ height: '40px' }}
          >
            ค้นหา
          </Button>
          {!loading && (
            <Typography variant="body2" sx={{ color: '#787878' }}>
              พบ {qcHistoryData.length.toLocaleString()} รายการ
            </Typography>
          )}
        </Stack>
      </Box>

      {/* แสดงข้อความ error (ไม่บล็อกการแสดงแถบค้นหา) */}
      {error && (
        <Box sx={{
          margin: '12px 16px',
          padding: '10px 16px',
          backgroundColor: '#fff3cd',
          borderRadius: '8px'
        }}>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </Box>
      )}

      {/* เนื้อหา: loading หรือ ตาราง */}
      {loading ? (
        <Box sx={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <QcHisTable
            filteredData={qcHistoryData}
            page={page}
            rowsPerPage={rowsPerPage}
            totalRows={qcHistoryData.length}
            handleChangePage={handleChangePage}
            handleChangeRowsPerPage={handleChangeRowsPerPage}
          />
        </Box>
      )}
    </Paper>
  );
};

export default ParentComponent;