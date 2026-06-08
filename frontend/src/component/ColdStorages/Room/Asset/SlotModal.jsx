import React, { useState } from "react";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import {
  Box,
  Typography,
  Snackbar,
  Alert,
  Paper,
  CircularProgress,
  Chip,
  AppBar,
  Toolbar,
  IconButton,
  Button
} from "@mui/material";
import { TbBackground } from "react-icons/tb";

// ตรวจสอบเส้นทางการนำเข้าให้ถูกต้องตามโครงสร้างโฟลเดอร์ของคุณ
import ParentComponent from "../Modals/ParentComponent";
import ModalEditPD from "../Modals/ModalEditPD";
import MoveRawMatModal from "../Asset/MoveRawMatModal";

// นำเข้า Modal ของห้องเย็นต่างๆ 
import Modal4C from "../Modals/Modal4C"; 
import ModalAnte from "../Modals/ModalAnte"; 
import Modalchill2 from "../Modals/Modalchill2"; 
import Modalchill4 from "../Modals/Modalchill4"; 
import Modalchill5 from "../Modals/Modalchill5"; 
import Modalchill6 from "../Modals/Modalchill6"; 
import ModalCSR3 from "../Modals/ModalCSR3";

const SlotModal = ({ slot, onClose }) => {
  const [slotData, setSlotData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");
  const [selectedRawMaterial, setSelectedRawMaterial] = useState(null);
  const [openEditModal, setOpenEditModal] = useState(false);
  
  // เพิ่ม state สำหรับ MoveRawMatModal
  const [openMoveModal, setOpenMoveModal] = useState(false);
  const [moveData, setMoveData] = useState(null);
  
  // เพิ่ม state สำหรับ Modal ห้องเย็น
  const [openColdRoomModal, setOpenColdRoomModal] = useState(false);
  const [selectedColdRoom, setSelectedColdRoom] = useState(null);
  const [selectedColdRoomModal, setSelectedColdRoomModal] = useState(null);
  const [destinationSlot, setDestinationSlot] = useState(null);

  const handleCancel = () => {
    console.log("📌 Cancel button clicked, sending 'CANCEL_ONLY' signal");
    if (typeof onClose === 'function') {
      onClose('CANCEL_ONLY');
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      showSnackbar("รีเฟรชข้อมูลสำเร็จ", "success");
    }, 1000);
  };

  const handleDataFromParent = (data) => {
    setSlotData(data);
    console.log("ได้รับข้อมูลจาก ParentComponent:", data);
    
    if (data && data.rawMaterials && data.rawMaterials.length > 0) {
      showSnackbar("อัปเดตข้อมูลสำเร็จ", "success");
    }
  };

  const handleParentClose = (param) => {
    console.log("📌 handleParentClose called with:", param);
    if (param === 'CANCEL_ONLY' && typeof onClose === 'function') {
      onClose(param);
    }
  };
  
  const showSnackbar = (message, severity) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setOpenSnackbar(true);
  };

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  const handleDataForModalEditPD = (rowData) => {
    // เพิ่ม logging เพื่อดูข้อมูลที่ได้รับ
    console.log("Received data for ModalEditPD:", rowData);
    
    const enhancedData = {
      ...rowData,
      cs_id: slot.cs_id,
      slot_id: slot.slot_id,
      tro_id: slot.tro_id || "",
    };
    
    console.log("ข้อมูลที่ถูกปรับแต่งสำหรับ ModalEditPD:", enhancedData);
    setSelectedRawMaterial(enhancedData);
    setOpenEditModal(true);
    return enhancedData;
  };

  const handleEditModalClose = () => {
    setOpenEditModal(false);
  };

  // เพิ่มฟังก์ชันเพื่อรับข้อมูลที่อัปเดตจาก ModalEditPD
  const handleEditSuccess = (updatedData) => {
    console.log("SlotModal - ได้รับข้อมูลที่อัปเดตจาก ModalEditPD:", updatedData);
    setOpenEditModal(false);
    setMoveData(updatedData);
    
    // กำหนดห้องเย็นที่เลือก
    setSelectedColdRoom(updatedData.ColdMove);
    console.log("SlotModal - เลือกห้องเย็น:", updatedData.ColdMove);
    
    // ตรวจสอบห้องเย็นที่เลือกและเปิด Modal ตามประเภทห้องเย็น
    switch (updatedData.ColdMove) {
      case "4C":
        console.log("SlotModal - เปิด Modal 4C");
        setSelectedColdRoomModal("4C");
        setOpenColdRoomModal(true);
        break;
      case "Ante":
        console.log("SlotModal - เปิด Modal Ante");
        setSelectedColdRoomModal("Ante");
        setOpenColdRoomModal(true);
        break;
      case "Chill 2":
        console.log("SlotModal - เปิด Modal Chill2");
        setSelectedColdRoomModal("Chill2");
        setOpenColdRoomModal(true);
        break;
      case "Chill 4":
        console.log("SlotModal - เปิด Modal Chill4");
        setSelectedColdRoomModal("Chill4");
        setOpenColdRoomModal(true);
        break;
      case "Chill 5":
        console.log("SlotModal - เปิด Modal Chill5");
        setSelectedColdRoomModal("Chill5");
        setOpenColdRoomModal(true);
        break;
      case "Chill 6":
        console.log("SlotModal - เปิด Modal Chill6");
        setSelectedColdRoomModal("Chill6");
        setOpenColdRoomModal(true);
        break;
      case "CSR3":
        console.log("SlotModal - เปิด Modal CSR3");
        setSelectedColdRoomModal("CSR3");
        setOpenColdRoomModal(true);
        break;
      default:
        // หากไม่มีห้องเย็นที่เลือก ให้แสดงข้อความแจ้งเตือน
        console.log("SlotModal - ไม่พบห้องเย็นที่เลือก:", updatedData.ColdMove);
        showSnackbar("ไม่พบห้องเย็นที่เลือก", "error");
        break;
    }
    
    // แสดงข้อความแจ้งเตือน
    showSnackbar("เลือกข้อมูลสำเร็จ กรุณาเลือกช่องจอดปลายทาง", "info");
  };

  // ฟังก์ชันสำหรับปิด Modal ห้องเย็น
  const handleColdRoomModalClose = () => {
    console.log("SlotModal - ปิด Modal ห้องเย็น");
    setOpenColdRoomModal(false);
    setSelectedColdRoomModal(null);
  };

  // ฟังก์ชันสำหรับรับข้อมูลที่ได้รับจาก Modal ห้องเย็น
  const handleColdRoomModalNext = (action, slotData) => {
    console.log("SlotModal - ได้รับข้อมูลจาก Modal ห้องเย็น:", action, slotData);
    
    if (action === "SELECT_TROLLEY" && slotData) {
      setDestinationSlot(slotData);
      setOpenColdRoomModal(false);
      
      // ต่อไปเปิด MoveRawMatModal เพื่อยืนยันการย้าย
      console.log("SlotModal - เปิด MoveRawMatModal");
      setOpenMoveModal(true);
    } else {
      console.log("SlotModal - การเลือกช่องจอดไม่สมบูรณ์:", action, slotData);
    }
  };

  // ฟังก์ชันสำหรับปิด MoveRawMatModal
  const handleMoveModalClose = (result) => {
    console.log("SlotModal - ปิด MoveRawMatModal, result:", result);
    setOpenMoveModal(false);
    
    if (result && result.success) {
      // การย้ายวัตถุดิบสำเร็จ
      showSnackbar("ย้ายวัตถุดิบสำเร็จ", "success");
      
      // อาจจะมีการรีเฟรชข้อมูลในตาราง
      if (slotData && slotData.rawMaterials) {
        // อาจจะต้องมีโค้ดเพิ่มเติมตรงนี้เพื่ออัปเดตข้อมูลใน slotData
        // เช่น เรียก API ใหม่เพื่อดึงข้อมูลล่าสุด
        handleRefresh();
      }
    }
    
    // รีเซ็ต state
    setMoveData(null);
    setDestinationSlot(null);
    setSelectedColdRoom(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <Paper 
        elevation={8} 
        style={{ color: "#585858" }} 
        className="bg-white rounded-lg shadow-lg w-[1200px] h-[600px] overflow-hidden"
      >
        {/* Header */}
        <AppBar position="static" sx={{ backgroundColor: '#4e73df' }}>
          <Toolbar sx={{ minHeight: '50px', px: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <WarehouseIcon sx={{ mr: 1 }} />
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                ข้อมูลช่องจอด
              </Typography>
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            <IconButton color="inherit" onClick={handleRefresh} disabled={isLoading}>
              {isLoading ? <CircularProgress size={24} color="inherit" /> : <RefreshIcon />}
            </IconButton>
          </Toolbar>
        </AppBar>
        
        {/* ข้อมูลช่องจอด */}
        <Box 
          sx={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            backgroundColor: '#f8f9fc',
            borderBottom: '1px solid #e3e6f0'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Chip 
              icon={<WarehouseIcon />} 
              label={`ห้อง: ${slot.cs_id}`} 
              color="primary" 
              variant="outlined" 
              sx={{ mr: 1, borderRadius: '4px' }}
            />
            <Chip 
              icon={<TbBackground size={20} />} 
              label={`ช่องจอด: ${slot.slot_id}`} 
              color="primary" 
              variant="outlined" 
              sx={{ mr: 1, borderRadius: '4px' }}
            />
            {slot.tro_id ? (
              <Chip 
                icon={<LocalShippingIcon />} 
                label={`เลขทะเบียน: ${slot.tro_id}`} 
                color="secondary" 
                variant="outlined" 
                sx={{ borderRadius: '4px' }}
              />
            ) : (
              <Chip 
                icon={<LocalShippingIcon />} 
                label="ไม่มีรถเข็น" 
                color="error" 
                variant="outlined" 
                sx={{ borderRadius: '4px' }}
              />
            )}
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              อัปเดตล่าสุด: {new Date().toLocaleString('th-TH')}
            </Typography>
          </Box>
        </Box>
                
        {/* ส่วนเนื้อหาหลัก */}
        <Box sx={{ height: 'calc(100% - 200px)', overflow: 'auto' }}>
          <ParentComponent 
            slotId={slot.slot_id} 
            onClose={handleParentClose}
            onDataChange={handleDataFromParent}
            enhanceRowData={handleDataForModalEditPD}
            slotInfo={slot}
          />
        </Box>
        
        {/* ส่วนล่างสุด */}
        <Box 
          sx={{ 
            p: 2, 
            display: 'flex', 
            justifyContent: 'flex-end',
            borderTop: '1px solid #e3e6f0',
            backgroundColor: '#f8f9fc',
          }}
        >
          <Button
            variant="contained"
            startIcon={<CancelIcon />}
            sx={{ 
              bgcolor: "#E74A3B", 
              color: "#fff",
              '&:hover': {
                bgcolor: "#d52a1a",
              }
            }}
            onClick={handleCancel}
          >
            ยกเลิก
          </Button>
        </Box>

        {/* ModalEditPD สำหรับเลือกประเภทการย้ายและห้องเย็น */}
        {openEditModal && (
          <ModalEditPD
            open={openEditModal}
            onClose={handleEditModalClose}
            data={selectedRawMaterial}
            slotInfo={slot}
            onSuccess={handleEditSuccess}
          />
        )}

        {/* Modal ห้องเย็นต่างๆ สำหรับเลือกช่องจอดปลายทาง */}
        {openColdRoomModal && moveData && selectedColdRoomModal === "4C" && (
          <Modal4C
            open={openColdRoomModal}
            onClose={handleColdRoomModalClose}
            onNext={handleColdRoomModalNext}
            data={moveData}
            rmfp_id={moveData.rmfp_id}
            CookedDateTime={moveData.CookedDateTime}
            dest={moveData.ColdMove}
          />
        )}
        {openColdRoomModal && moveData && selectedColdRoomModal === "Ante" && (
          <ModalAnte
            open={openColdRoomModal}
            onClose={handleColdRoomModalClose}
            onNext={handleColdRoomModalNext}
            data={moveData}
            rmfp_id={moveData.rmfp_id}
            CookedDateTime={moveData.CookedDateTime}
            dest={moveData.ColdMove}
          />
        )}
        {openColdRoomModal && moveData && selectedColdRoomModal === "Chill2" && (
          <Modalchill2
            open={openColdRoomModal}
            onClose={handleColdRoomModalClose}
            onNext={handleColdRoomModalNext}
            data={moveData}
            rmfp_id={moveData.rmfp_id}
            CookedDateTime={moveData.CookedDateTime}
            dest={moveData.ColdMove}
          />
        )}
        {openColdRoomModal && moveData && selectedColdRoomModal === "Chill4" && (
          <Modalchill4
            open={openColdRoomModal}
            onClose={handleColdRoomModalClose}
            onNext={handleColdRoomModalNext}
            data={moveData}
            rmfp_id={moveData.rmfp_id}
            CookedDateTime={moveData.CookedDateTime}
            dest={moveData.ColdMove}
          />
        )}
        {openColdRoomModal && moveData && selectedColdRoomModal === "Chill5" && (
          <Modalchill5
            open={openColdRoomModal}
            onClose={handleColdRoomModalClose}
            onNext={handleColdRoomModalNext}
            data={moveData}
            rmfp_id={moveData.rmfp_id}
            CookedDateTime={moveData.CookedDateTime}
            dest={moveData.ColdMove}
          />
        )}
        {openColdRoomModal && moveData && selectedColdRoomModal === "Chill6" && (
          <Modalchill6
            open={openColdRoomModal}
            onClose={handleColdRoomModalClose}
            onNext={handleColdRoomModalNext}
            data={moveData}
            rmfp_id={moveData.rmfp_id}
            CookedDateTime={moveData.CookedDateTime}
            dest={moveData.ColdMove}
          />
        )}
        {openColdRoomModal && moveData && selectedColdRoomModal === "CSR3" && (
          <ModalCSR3
            open={openColdRoomModal}
            onClose={handleColdRoomModalClose}
            onNext={handleColdRoomModalNext}
            data={moveData}
            rmfp_id={moveData.rmfp_id}
            CookedDateTime={moveData.CookedDateTime}
            dest={moveData.ColdMove}
          />
        )}

        {/* MoveRawMatModal สำหรับยืนยันการย้ายวัตถุดิบ */}
        {openMoveModal && moveData && destinationSlot && (
          <MoveRawMatModal
            data={moveData}
            slot={destinationSlot}
            onClose={handleMoveModalClose}
          />
        )}

        {/* Snackbar สำหรับแสดงข้อความแจ้งเตือน */}
        <Snackbar
          open={openSnackbar}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbarSeverity}
            sx={{ width: '100%' }}
            variant="filled"
            elevation={6}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Paper>
    </div>
  );
};

export default SlotModal;