import React, { useState, useEffect } from 'react';
import TableMainPrep from './Table';
import axios from "axios";
axios.defaults.withCredentials = true; 
import io from 'socket.io-client';

// Mui Components
import {
  Box,
  Typography,
  CircularProgress,
  Divider,
  Paper,
  Chip,
  Alert,
  Fade,
  Snackbar,
  Button,
  Stack, // Added Stack component for better button grouping
  Toolbar // Added Toolbar for better layout control
} from '@mui/material';

// Icons
import WarehouseIcon from '@mui/icons-material/Warehouse';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { Storage as StorageIcon, AddShoppingCart as AddShoppingCartIcon } from '@mui/icons-material';
import RawMatSelectionModal from './RawMatSelectionModal';
import MoveRawMaterialModal from './MoveRawMaterialModal';
import EditIcon from '@mui/icons-material/Edit'; // เพิ่ม Icon สำหรับปุ่มแก้ไขแผนผลิต
import PrintTrolleyModal from './PrintTrolleyModal';
import PrintIcon from '@mui/icons-material/Print';
import EditAllMat from './EditAllMat'; // เพิ่ม import EditAllMat component


const API_URL = import.meta.env.VITE_API_URL;

const ParentComponent = ({ onClose, slotId, onDataChange, enhanceRowData, slotInfo }) => {
  const [tableData, setTableData] = useState([]);
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [openRawMatModal, setOpenRawMatModal] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [openMoveModal, setOpenMoveModal] = useState(false);
  const [openPrintModal, setOpenPrintModal] = useState(false);
  const [openEditProdModal, setOpenEditProdModal] = useState(false); // เพิ่ม state สำหรับ modal แก้ไขแผนผลิต
   const [selectedRow, setSelectedRow] = useState(null); // เพิ่ม state สำหรับเก็บข้อมูลแถวที่เลือก

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io(API_URL, {
        transports: ["websocket"],
        reconnectionAttempts: 5, // จำนวนครั้งที่ลอง reconnect
        reconnectionDelay: 1000, // หน่วงเวลา 1 วินาทีระหว่างการ reconnect
        autoConnect: true
      });
    setSocket(newSocket);


    newSocket.on("refreshData", (msg) => {
      fetchAllData(slotId);
      console.log("🔄 รับ event refreshData:", msg);
      // ทำ action ที่ต้องการ เช่น refetch ข้อมูล
    });

    return () => newSocket.disconnect();
  }, [slotId]);

  const fetchNormalRawMat = async (slotId) => {
    try {
      const response = await axios.get(`${API_URL}/api/coldstorage/fetchSlotRawMat`, {
        params: { slot_id: slotId }
      });

      if (!response.data.success) {
        return [];
      }

      return response.data.data.map(item => ({
        ...item,
        _cs_id: slotInfo?.cs_id || item.cs_id || "",
        isMixed: false // เพิ่มฟิลด์เพื่อระบุว่าเป็นวัตถุดิบธรรมดา
      }));
    } catch (error) {
      console.error("Error fetching normal raw materials:", error);
      return [];
    }
  };

  const fetchMixedRawMat = async (slotId) => {
    try {
      const response = await axios.get(`${API_URL}/api/coldstorage/mixed/fetchSlotRawMat`, {
        params: { slot_id: slotId }
      });

      if (!response.data.success) {
        return [];
      }

      return response.data.data.map(item => ({
        ...item,
        _cs_id: slotInfo?.cs_id || item.cs_id || "",
        isMixed: true, // เพิ่มฟิลด์เพื่อระบุว่าเป็นวัตถุดิบที่ผสมแล้ว
        mat_name: `Mixed: ${item.mix_code}`, // เพิ่มฟิลด์ mat_name เพื่อความสะดวกในการแสดงผล
        mat: item.mix_code // กำหนดค่า mat เพื่อความสะดวกในการแสดงผล
      }));
    } catch (error) {
      console.error("Error fetching mixed raw materials:", error);
      return [];
    }
  };

  const fetchAllData = async (slotId) => {
    setIsLoading(true);
    setError(null);

    try {
      // ดึงข้อมูลจาก API ทั้งสองตัวพร้อมกัน
      const [normalRawMaterials, mixedRawMaterials] = await Promise.all([
        fetchNormalRawMat(slotId),
        fetchMixedRawMat(slotId)
      ]);

      // รวมข้อมูลทั้งหมด
      const combinedData = [...normalRawMaterials, ...mixedRawMaterials];

      if (combinedData.length === 0) {
        setError("ไม่พบวัตถุดิบในช่องจอดนี้ กรุณาเพิ่มวัตถุดิบ");
        showSnackbar("ไม่พบวัตถุดิบ", "error");
        setTableData([]);
      } else {
        setTableData(combinedData);

        if (onDataChange) {
          onDataChange({
            rawMaterials: combinedData,
            lastUpdated: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("เกิดข้อผิดพลาดในการดึงข้อมูล กรุณาลองใหม่อีกครั้ง");
      showSnackbar("เกิดข้อผิดพลาดในการดึงข้อมูล", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (slotId) {
      fetchAllData(slotId);
    }
  }, [slotId]);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const closeSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const handleOpenEditModal = (rowData) => {
    // สร้างข้อมูลสำหรับ modal ตามประเภทของวัตถุดิบ
    let enhancedData;

    if (rowData.isMixed) {
      // กรณีวัตถุดิบที่ผสมแล้ว
      enhancedData = {
        mapping_id: rowData.mapping_id,
        mix_code: rowData.mix_code,
        production: rowData.production || "",
        tro_id: rowData.tro_id || slotInfo?.tro_id || "",
        weight: rowData.weight_RM || rowData.weight || "",
        weighttotal: rowData.weight_in_trolley || "",
        mixed_date: rowData.mixed_date || "",
        isMixed: true,
        cs_id: rowData._cs_id || slotInfo?.cs_id || "",
        slot_id: slotInfo?.slot_id || slotId,
        rmfp_id: rowData.rmfp_id || ""
      };
    } else {
      // กรณีวัตถุดิบธรรมดา
      enhancedData = {
        batch: rowData.batch,
        mat_name: rowData.mat_name,
        mat: rowData.mat,
        production: rowData.production || "",
        rmfp_id: rowData.rmfp_id,
        cs_id: rowData._cs_id || slotInfo?.cs_id || "",
        slot_id: slotInfo?.slot_id || slotId,
        tro_id: rowData.tro_id || slotInfo?.tro_id || "",
        weight: rowData.weight_RM || rowData.weight || "",
        weighttotal: rowData.weight_in_trolley || "",
        CookedDateTime: rowData.CookedDateTime || "",
        isMixed: false
      };
    }

    // เรียกใช้ callback จาก SlotModal เพื่อให้ SlotModal จัดการเปิด modal
    if (enhanceRowData) {
      enhanceRowData(enhancedData);
    }
  };

  const handleOpenRawMatModal = () => {
    setOpenRawMatModal(true);
  };

  const handleCloseRawMatModal = () => {
    setOpenRawMatModal(false);
  };

  const handleAddRawMaterials = (selected) => {
    setSelectedMaterials(selected);
    setOpenMoveModal(true);

  };

  // ฟังก์ชันเมื่อย้ายวัตถุดิบสำเร็จ
const handleMoveSuccess = () => {
  setSelectedMaterials([]); // เคลียร์รายการที่เลือก
  setOpenRawMatModal(false); // ปิด Modal การเลือกวัตถุดิบ
  setOpenMoveModal(false); // ปิด Modal การย้ายวัตถุดิบ
  fetchAllData(slotId); // รีเฟรชข้อมูล
};
 // เพิ่มฟังก์ชันสำหรับเปิดหน้าต่างการแก้ไขแผนผลิต
  const handleOpenEditProdModal = () => {
    // ตรวจสอบว่ามีวัตถุดิบหรือไม่
    if (tableData.length === 0) {
      showSnackbar("ไม่พบวัตถุดิบในช่องจอดนี้", "error");
      return;
    }

    // เลือกแถวแรกเป็นตัวแทนเพื่อแก้ไขแผนผลิตทั้งหมด
//     setSelectedRow({
//       mat: tableData[0].mat,
//       mat_name: tableData[0].mat_name,
//       batch: tableData[0].batch || "",
//       production: tableData[0].production || "",
//       tro_id: tableData[0].tro_id || slotInfo?.tro_id || "",
//       mapping_id: tableData[0].mapping_id || ""
//     });
//  setOpenEditProdModal(true);
//   };
// ส่งข้อมูลทั้งหมดในรถเข็นแทนการเลือกแค่แถวแรก
  setSelectedRow({
    // ข้อมูลพื้นฐานจากแถวแรก (สำหรับ trolley และ production info)
    mat: tableData[0].mat,
    mat_name: tableData[0].mat_name,
    batch: tableData[0].batch || "",
    production: tableData[0].production || "",
    tro_id: tableData[0].tro_id || slotInfo?.tro_id || "",
    mapping_id: tableData[0].mapping_id || "",
    // เพิ่มข้อมูลทั้งหมดในรถเข็น
    allMaterials: tableData.map(item => ({
      mat: item.mat,
      mat_name: item.isMixed ? `Mixed: ${item.mix_code}` : item.mat_name,
      batch: item.batch || item.mix_code || "",
      production: item.production || "",
      weight: item.weight_RM || item.weight || "",
      isMixed: item.isMixed,
      mix_code: item.mix_code || null,
      CookedDateTime: item.CookedDateTime || "",
      mixed_date: item.mixed_date || ""
    }))
  });
  setOpenEditProdModal(true);
};

  const handleCloseEditProdModal = () => {
    setOpenEditProdModal(false);
    setSelectedRow(null);
  };

  // ฟังก์ชันจัดการเมื่อแก้ไขแผนผลิตสำเร็จ
  const handleEditProdSuccess = (updatedData) => {
    showSnackbar("แก้ไขแผนการผลิตสำเร็จ", "success");
    fetchAllData(slotId); // รีเฟรชข้อมูล
  };

  return (
    <Box sx={{ p: 0, height: '100%' }}>
      {/* Header Section with Title and Buttons */}
      <Toolbar
        sx={{
          px: 2,
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          mb: 2
        }}
        disableGutters
      >
        {/* Title with Icon */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <StorageIcon sx={{ mr: 1, color: '#1552F0' }} />
          <Typography variant="h6" sx={{ color: '#1552F0', fontWeight: 600 }}>
            รายการวัตถุดิบ
          </Typography>
        </Box>

        {/* Button Group - Aligned to the right */}
        <Stack direction="row" spacing={2}>
 
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={handleOpenEditProdModal}
            sx={{
              backgroundColor: '#FF8C00', // สีส้ม
              '&:hover': { backgroundColor: '#E67E00' }, // สีส้มเข้มเมื่อ hover
              minWidth: '180px'
            }}
            disabled={!slotInfo?.tro_id || tableData.length === 0}
          >
            แก้ไขแผนผลิตทั้งรถเข็น
          </Button>
          <Button
            variant="contained"
            startIcon={<AddShoppingCartIcon />}
            onClick={handleOpenRawMatModal}
            sx={{
              backgroundColor: '#1552F0',
              '&:hover': { backgroundColor: '#3a5bbf' },
              minWidth: '180px'
            }}
          >
            จัดชุดวัตถุดิบ
          </Button>

          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={() => setOpenPrintModal(true)}
            sx={{
              backgroundColor: '#28a745',
              '&:hover': { backgroundColor: '#218838' },
              minWidth: '180px'
            }}
            disabled={!slotInfo?.tro_id}
          >
            พิมพ์ข้อมูลรถเข็น
          </Button>
        </Stack>
      </Toolbar>

      {/* Content Section */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      ) : tableData.length === 0 ? (
        <Box sx={{ p: 2 }}>
          <Alert severity="info">ไม่พบรายการวัตถุดิบในช่องจอดนี้</Alert>
        </Box>
      ) : (
        <Fade in={!isLoading}>
          <Box>
            <TableMainPrep
              handleOpenEditModal={handleOpenEditModal}
              data={tableData}
            />
          </Box>
        </Fade>
      )}

      {/* Modals */}
      <RawMatSelectionModal
        open={openRawMatModal}
        onClose={handleCloseRawMatModal}
        onAdd={handleAddRawMaterials}
        currentTroId={slotInfo?.tro_id}
        onSelectionClear={() => setSelectedMaterials([])} // เพิ่ม callback นี้
      />

      {openMoveModal && (
        <MoveRawMaterialModal
          open={openMoveModal}
          onClose={() => setOpenMoveModal(false)}
          selectedMaterials={selectedMaterials}
          currentTroId={slotInfo?.tro_id}
          currentSlotId={slotId}
          onSuccess={handleMoveSuccess}
        />
      )}

      {openPrintModal && (
        <PrintTrolleyModal
          open={openPrintModal}
          onClose={() => setOpenPrintModal(false)}
          trolleyId={slotInfo?.tro_id}
          slotId={slotId}
        />
      )}

      {selectedRow && (
        <EditAllMat
          open={openEditProdModal}
          handleClose={handleCloseEditProdModal}
          selectedRow={selectedRow}
          onSuccess={handleEditProdSuccess}
        />
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ParentComponent;