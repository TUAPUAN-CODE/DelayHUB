import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
axios.defaults.withCredentials = true;
import { Modal, Box, Typography, TextField, Button, IconButton, Alert, useTheme, Divider } from "@mui/material";
import { styled } from "@mui/system";
import { IoClose } from "react-icons/io5";
import QrScanner from "qr-scanner";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
const API_URL = import.meta.env.VITE_API_URL;

const StyledModal = styled(Modal)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const ModalContent = styled(Box)(({ theme }) => ({
  position: "relative",
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  maxWidth: "400px",
  width: "100%",
  boxShadow: theme.shadows[5],
  height: "auto",
}));

const CloseButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
  color: theme.palette.grey[600],
}));

const ScanTrolley = ({ open, onClose, onNext, selectedOption, selectedSlot }) => {
  console.log("ScanTrolley received slot:", selectedSlot);
  const theme = useTheme();
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [scannedValue, setScannedValue] = useState('');
  const [inputError, setInputError] = useState(false);
  const [apiError, setApiError] = useState("");

  // รีเซ็ตค่า state เมื่อ modal ถูกเปิด
  useEffect(() => {
    if (open) {
      setInputValue('');
      setScannedValue('');
      setApiError('');
      setInputError(false);
    }
  }, [open]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      videoRef.current.srcObject = stream;
      videoRef.current.play();

      const qrScanner = new QrScanner(videoRef.current, async (result) => {
        if (result?.data) {
          // 🔥 แก้ไข: เมื่อสแกน QR แล้ว ให้ set ค่าลง inputValue ด้วย
          const scannedTroId = result.data;
          setScannedValue(scannedTroId);
          setInputValue(scannedTroId); // เพิ่มบรรทัดนี้

          // เรียก checkTrolleyStatus พร้อมส่ง tro_id
          await checkTrolleyStatus(scannedTroId);
        }
      }, {
        highlightScanRegion: true,
        highlightCodeOutline: true
      });

      qrScannerRef.current = qrScanner;
      qrScanner.start();
    } catch (err) {
      console.error("Error opening camera:", err);
    }
  };

  const handleClose = () => {
    onClose();
    stopCamera();
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (qrScannerRef.current) qrScannerRef.current.stop();
  };

  useEffect(() => {
    if (open) startCamera();
    return stopCamera;
  }, [open]);

  // 🔥 แก้ไข: ฟังก์ชันนี้รับ tro_id เป็น parameter แรก
  const checkTrolleyStatus = async (troId) => {
    try {
      // ตรวจสอบว่า selectedSlot มีข้อมูลครบถ้วน
      if (!selectedSlot || typeof selectedSlot !== "object") {
        setApiError("ข้อมูลช่องว่างไม่ครบ");
        return;
      }

      const { cs_id, slot_id } = selectedSlot;

      console.log("🚀 Sending to API:", {
        tro_id: troId,
        cs_id,
        slot_id,
        selectedOption
      });

      const response = await axios.get(`${API_URL}/api/cold/checkin/check/Trolley`, {
        params: {
          tro_id: troId,
          cs_id,
          slot_id,
          selectedOption
        }
      });

      console.log("✅ API Success:", response.data);

      // กรณี success - ส่งข้อมูลไปยัง modal ถัดไป
      onNext({
        inputValues: [troId],
        trolleyData: response.data
      });

    } catch (error) {
      console.error("❌ API Error:", error);

      const serverData = error.response?.data;
      if (serverData?.details?.invalidDestinations) {
        // กรณีมีข้อมูลรายละเอียด
        let errorMsg = serverData.message;
        serverData.details.invalidDestinations.forEach(dest => {
          errorMsg += `\n- ${dest.destination} (${dest.count} รายการ)`;
          if (dest.items) errorMsg += `: ${dest.items.join(', ')}`;
        });
        setApiError(errorMsg);
      } else {
        setApiError(serverData?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ");
      }
    }
  };

  const handleNextModal2 = async () => {
    if (inputValue.trim() === '') {
      setInputError(true);
      setApiError("กรุณากรอกข้อมูลหรือสแกนป้ายทะเบียน");
      return;
    }
    setInputError(false);

    console.log("🛠 Debug ก่อนส่ง API: selectedSlot =", selectedSlot);
    console.log("🛠 Debug ก่อนส่ง API: selectedOption =", selectedOption);
    console.log("🛠 Debug ก่อนส่ง API: inputValue =", inputValue);

    // เรียก checkTrolleyStatus พร้อมส่ง tro_id จาก inputValue
    await checkTrolleyStatus(inputValue);
  };

  return (
    <StyledModal open={open} onClose={(e, reason) => {
      if (reason === 'backdropClick') return;
      onClose();
    }}>
      <ModalContent>
        <CloseButton aria-label="close" onClick={handleClose}><IoClose /></CloseButton>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: "15px", color: "#555" }}>
          <Typography sx={{ fontSize: "18px", fontWeight: 500, color: "#545454", marginBottom: "10px" }}>
            กรุณากรอกข้อมูลหรือสแกนป้ายทะเบียน
          </Typography>

          {inputError && <Alert severity="error" sx={{ mb: 2 }}>กรุณากรอกข้อมูลหรือสแกนป้ายทะเบียน</Alert>}
          {apiError && (
            <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
              {apiError}
            </Alert>
          )}

          <Divider sx={{ mb: 2 }} />

          <video ref={videoRef} style={{ width: "100%", marginBottom: theme.spacing(1), borderRadius: "4px" }} autoPlay muted />
          
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <TextField
              fullWidth
              label="เลขทะเบียนรถเข็น"
              value={inputValue}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, ""); // กรองเฉพาะตัวเลข
                const formatted = raw.padStart(4, "0").slice(-4); // เติม 0 ซ้าย และจำกัด 4 ตัว
                setInputValue(formatted);
                setInputError(false);
                setApiError(''); // ล้าง error เมื่อพิมพ์ใหม่
              }}
              margin="normal"
              size="small"
              style={{ padding: "0" }}
              error={inputError}
            />
          </Box>

          {/* <Box sx={{ display: "flex", alignItems: "center" }}>
            <TextField
              fullWidth
              label="เลขทะเบียนรถเข็น"
              value={inputValue}
              margin="normal"
              size="small"
              style={{ padding: "0" }}
              error={inputError}
              InputProps={{
                readOnly: true, // ทำให้กรอกค่าไม่ได้
              }}
            />
          </Box> */}

          {scannedValue && (
            <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
              ✓ สแกนสำเร็จ: {scannedValue}
            </Typography>
          )}

          <Divider sx={{ mt: 1, mb: 1 }} />

          <Box sx={{ display: "flex", justifyContent: "space-between", pt: 1, height: "42px" }}>
            <Button
              style={{ backgroundColor: "#E74A3B", color: "#fff" }}
              variant="contained"
              startIcon={<CancelIcon />}
              onClick={handleClose}
            >
              ยกเลิก
            </Button>
            <Button
              style={{ backgroundColor: "#41a2e6", color: "#fff" }}
              variant="contained"
              startIcon={<CheckCircleIcon />}
              onClick={handleNextModal2}
            >
              ยืนยัน
            </Button>
          </Box>
        </Box>
      </ModalContent>
    </StyledModal>
  );
};

export default ScanTrolley;