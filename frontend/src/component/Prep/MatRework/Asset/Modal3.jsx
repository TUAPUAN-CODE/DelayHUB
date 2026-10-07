import React, { useState, useEffect } from "react";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import {
  Dialog,
  Stack,
  DialogContent,
  Button,
  Box,
  Divider,
  Typography,
  CircularProgress,
} from "@mui/material";
import axios from "axios";
axios.defaults.withCredentials = true;
import ModalAlert from "../../../../Popup/AlertSuccess";

const API_URL = import.meta.env.VITE_API_URL;

const Modal3 = ({ open, onClose, data, onEdit, onSuccess, CookedDateTime }) => {
  const [userId, setUserId] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [alertMessage, setAlertMessage] = useState("บันทึกข้อมูลเสร็จสิ้น");

  console.log("Data passed to Modal3:", data);
  const { inputValues = {}, input2 = {}, mapping_id, tro_id, rm_status } = data || {};

  const handleClose = async () => {
    const troId = data?.inputValues?.[0]; // สมมุติว่าเป็นรหัสรถเข็น

    if (troId) {
      const success = await returnreserveTrolley(troId);
      if (!success) {
        setErrorDialogOpen(true);
        return;
      }
    }
    
    // แสดง alert เมื่อปิด modal
    setShowAlert(true);
    onClose();
  };

  const returnreserveTrolley = async (tro_id) => {
    try {
      const response = await axios.post(`${API_URL}/api/re/reserveTrolley`, {
        tro_id: tro_id,
      });
      return response.data.success;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

 const handleConfirm = async () => {
  if (isLoading) return;
  setIsLoading(true);
  setError(null);
  setShowAlert(false);
  let hasError = false;
  
  try {
    let existingDataResponse = null;
    
    // ลองดึงข้อมูลเดิม แต่ถ้า 404 ให้ทำต่อไป
    try {
      existingDataResponse = await axios.get(
        `${API_URL}/api/prep/mat/rework/getTrolleyData/${mapping_id}`,
        { headers: { "Content-Type": "application/json" } }
      );
      console.log("✅ Successfully got existing data:", existingDataResponse.data);
    } catch (getError) {
      console.log("⚠️ Cannot get existing data (404), continuing with new data only...");
      console.log("GET Error:", getError.response?.status, getError.response?.statusText);
    }
    
    // ✅ Handle renderCorrectionMethods function
    let currentCorrectionMethods = "";
    
    // ตรวจสอบว่า renderCorrectionMethods function มีอยู่หรือไม่
    if (typeof renderCorrectionMethods === 'function') {
      try {
        currentCorrectionMethods = renderCorrectionMethods();
      } catch (renderError) {
        console.warn("⚠️ Error calling renderCorrectionMethods:", renderError);
        currentCorrectionMethods = "";
      }
    } else {
      console.warn("⚠️ renderCorrectionMethods function not found, using empty string");
      // ✅ Alternative: ใช้ข้อมูลจาก input2 หรือ props อื่น
      // currentCorrectionMethods = input2?.correctionMethods ? Object.keys(input2.correctionMethods).filter(key => input2.correctionMethods[key]).join(",") : "";
    }
    
    console.log("🔧 Current correction methods:", currentCorrectionMethods);
    
    let combinedEditRework = currentCorrectionMethods;
    
    // ตรวจสอบข้อมูลเดิมเฉพาะเมื่อมีข้อมูล
    if (existingDataResponse?.data?.edit_rework && currentCorrectionMethods !== "") {
      const existingMethods = existingDataResponse.data.edit_rework.split(",").map(m => m.trim());
      const newMethods = currentCorrectionMethods.split(",").map(m => m.trim());
      const uniqueNewMethods = newMethods.filter(m => !existingMethods.includes(m));
      if (uniqueNewMethods.length > 0) {
        combinedEditRework = existingDataResponse.data.edit_rework + "," + uniqueNewMethods.join(",");
      } else {
        combinedEditRework = existingDataResponse.data.edit_rework;
      }
    }
    
    const payload = {
      license_plate: inputValues.join(" "),
      mapping_id,
      tro_id,
      weightTotal: input2?.weightPerCart,
      ntray: input2?.numberOfTrays,
      recorder: input2?.operator,
      dest: input2?.deliveryLocation,
      userID: Number(userId),
      rm_status,
      edit_rework: combinedEditRework || null,
    };
    
    console.log("=== Sending payload to API ===");
    console.log("API Endpoint:", `${API_URL}/api/prep/mat/rework/saveTrolley`);
    console.log("Payload:", JSON.stringify(payload, null, 2));
    console.log("Raw payload object:", payload);
    console.log("Payload validation:");
    console.log("- license_plate:", payload.license_plate, typeof payload.license_plate);
    console.log("- mapping_id:", payload.mapping_id, typeof payload.mapping_id);
    console.log("- tro_id:", payload.tro_id, typeof payload.tro_id);
    console.log("- weightTotal:", payload.weightTotal, typeof payload.weightTotal);
    console.log("- ntray:", payload.ntray, typeof payload.ntray);
    console.log("- recorder:", payload.recorder, typeof payload.recorder);
    console.log("- dest:", payload.dest, typeof payload.dest);
    console.log("- userID:", payload.userID, typeof payload.userID);
    console.log("- rm_status:", payload.rm_status, typeof payload.rm_status);
    console.log("- edit_rework:", payload.edit_rework, typeof payload.edit_rework);
    console.log("Available variables check:");
    console.log("- inputValues:", inputValues);
    console.log("- mapping_id:", mapping_id);
    console.log("- tro_id:", tro_id);
    console.log("- input2:", input2);
    console.log("- userId:", userId);
    console.log("- rm_status:", rm_status);
    console.log("================================");
    
    const response = await axios.post(`${API_URL}/api/prep/mat/rework/saveTrolley`, payload);
    
    console.log("✅ API Response:", response.data);
    
    if (response.data.success) {
      setAlertMessage("บันทึกข้อมูลเสร็จสิ้น");
      setShowAlert(true);
      if (onSuccess) onSuccess();
      onClose();
    } else {
      hasError = true;
      const errorMessage = response.data.error || "การบันทึกข้อมูลล้มเหลว";
      setError(errorMessage);
      console.log("❌ API response success: false - ", errorMessage);
    }
    
  } catch (error) {
    hasError = true;
    console.error('❌ Error details:', error.response);
    
    console.log("=== API Error Response ===");
    console.log("Status:", error.response?.status);
    console.log("Status Text:", error.response?.statusText);
    console.log("Error Data:", error.response?.data);
    console.log("Request URL:", error.config?.url);
    console.log("Request Method:", error.config?.method);
    console.log("Request Data:", error.config?.data);
    console.log("Error Message:", error.message);
    console.log("Error Name:", error.name);
    console.log("Full Error Object:", error);
    console.log("==========================");
    
    let errorMessage = "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
    
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.response?.status === 404) {
      errorMessage = "ไม่สามารถทำรายการได้ เนื่องจากเลยเวลาที่กำหนด 10 นาที หรือ เกิดข้อผิดพลาดในการบันทึกข้อมูล";
    } else if (error.response?.status === 400) {
      errorMessage = "ข้อมูลไม่ถูกต้องหรือไม่สามารถทำรายการได้";
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    setError(errorMessage);
    setAlertMessage(errorMessage);
  } finally {
    setIsLoading(false);
  }
};


  // const renderCorrectionMethods = () => {
  //   if (!input2?.correctionMethods) return "";  // เปลี่ยนจาก "ไม่มีการแก้ไข" เป็น ""

  //   const { correctionMethods, otherCorrectionMethod } = input2;
  //   const activeMethods = [];

  //   // เพิ่มวิธีการแก้ไขที่ถูกเลือก
  //   // Object.entries(correctionMethods).forEach(([key, value]) => {
  //   //   if (value && key !== 'other') {
  //   //     activeMethods.push(correctionMethodLabels[key]);
  //   //   }
  //   // });

  //   // เพิ่มวิธีการอื่นๆ ถ้ามี
  //   if (correctionMethods.other && otherCorrectionMethod) {
  //     activeMethods.push(otherCorrectionMethod);
  //   }

  //   return activeMethods.length > 0 ? activeMethods.join(", ") : "";  // เปลี่ยนจาก "ไม่มีการแก้ไข" เป็น ""
  // };

  // // เพิ่มตัวแปร correctionMethodLabels ที่ด้านบนของคอมโพเนนต์
  // const correctionMethodLabels = {
  //   blanching: "ลวก",
  //   chemicalSoaking: "แช่เคมี",
  //   washing: "ล้างน้ำ",
  //   steam: "ผ่าน Steam",
  //   removeDefect: "คัด Defect ออก",
  //   removeFRM: "คัด FRM ออก",
  //   cooking: "หุง",
  //   boilingBaking: "ต้ม/อบ",
  //   other: "อื่นๆ"
  // };

  useEffect(() => {
    const storedUserId = localStorage.getItem("user_id");
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);

  return (
    <div>
      <Dialog
        open={open}
        onClose={(e, reason) => {
          if (reason === 'backdropClick') return;
          onClose();
        }}
        maxWidth="xs"
        fullWidth
      >
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          fontSize: "15px",
          color: "#555"
        }}>
          <DialogContent sx={{ paddingBottom: 0 }}>
            <Typography sx={{
              fontSize: "18px",
              fontWeight: 500,
              color: "#545454",
              marginBottom: "10px"
            }}>
              กรุณาตรวจสอบข้อมูลก่อนทำรายการ
            </Typography>
            <Divider sx={{ mt: 2, mb: 2 }} />

            {error && (
              <Typography color="error" sx={{ mb: 2 }}>
                {error}
              </Typography>
            )}

            <Typography>ป้ายทะเบียนคันใหม่: {inputValues[0] || "ไม่มีข้อมูล"}</Typography>
            {/* <Typography>ป้ายทะเบียนคันเก่า: {data?.tro_id || "ข้อมูลไม่พบ"}</Typography> */}
            <Typography>น้ำหนักวัตถุดิบ/รถเข็น: {input2?.weightPerCart || "ข้อมูลไม่พบ"}</Typography>
            <Typography>จำนวนถาด: {input2?.numberOfTrays || "ข้อมูลไม่พบ"}</Typography>

            {(data?.remark_rework || data?.remark_rework_cold) && (
              <>
                {data?.remark_rework_cold && (
                  <Typography>หมายเหตุแก้ไข-ห้องเย็น: {data?.remark_rework_cold}</Typography>
                )}
                {data?.remark_rework && (
                  <Typography>หมายเหตุแก้ไข-บรรจุ: {data?.remark_rework}</Typography>
                )}


                <Typography>วิธีการแก้ไขวัตถุดิบ: {renderCorrectionMethods()}</Typography>
              </>
            )}
            <Typography color="rgba(0, 0, 0, 0.6)">สถานที่จัดส่ง: {input2?.deliveryLocation || "ข้อมูลไม่พบ"}</Typography>
            <Typography>ผู้ดำเนินการ: {input2?.operator || "ข้อมูลไม่พบ"}</Typography>
            <Divider sx={{ mt: 2, mb: 0 }} />
          </DialogContent>
        </Box>

        <Stack
          sx={{
            padding: "20px"
          }}
          direction="row"
          spacing={10}
          justifyContent="center"
        >
          <Button
            sx={{ backgroundColor: "#E5484D", color: "#fff" }}
            variant="contained"
            startIcon={<CancelIcon />}
            onClick={handleClose}
            disabled={isLoading}
          >
            ยกเลิก
          </Button>
          <Button
            sx={{ backgroundColor: "#edc026", color: "#fff" }}
            variant="contained"
            startIcon={<EditIcon />}
            onClick={onEdit}
            disabled={isLoading}
          >
            แก้ไข
          </Button>
          <Button
            sx={{ backgroundColor: "#1552F0", color: "#fff" }}
            variant="contained"
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "กำลังประมวลผล..." : "ยืนยัน"}
          </Button>
        </Stack>
      </Dialog>

      <ModalAlert
        open={showAlert}
        message={alertMessage}
        onClose={() => {
          setShowAlert(false);
          setError(null);
        }}
      />
    </div>
  );
};

export default Modal3;