import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Alert,
  useTheme,
  Divider,
} from "@mui/material";
import { styled } from "@mui/system";
import { IoClose } from "react-icons/io5";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import axios from "axios";
import CameraswitchIcon from "@mui/icons-material/Cameraswitch";
import useQrCamera from "../../../../../hooks/useQrCamera";
axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;
// ค่าเริ่มต้นต้องเป็น reference เดิมทุกครั้ง ไม่เช่นนั้น effect รีเซ็ตค่าทุก render และค่าที่สแกนจะถูกล้าง
const NO_BATCH = [];

const StyledModal = styled(Modal)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const ModalContent = styled(Box)(({ theme }) => ({
  position: "relative",
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  maxWidth: "500px",
  width: "100%",
  boxShadow: theme.shadows[5],
  height: "auto",
  maxHeight: "90vh",
  overflowY: "auto",
}));

const CloseButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  top: theme.spacing(1),
  right: theme.spacing(1),
  color: theme.palette.grey[600],
  zIndex: 1,
}));

const Modal1 = ({
  open,
  onClose,
  onNext,
  mat,
  mat_name,
  batch,
  batchArray = NO_BATCH,
  production,
  rmfp_id,
  dest,
  rm_type_id,
}) => {
  const [rmTypeId, setRmTypeId] = useState(rm_type_id ?? 3);
  const theme = useTheme();
  const videoRef = useRef(null);
  const [inputValue, setInputValue] = useState("");
  const [scannedValue, setScannedValue] = useState("");
  const [inputError, setInputError] = useState(false);
  const [apiError, setApiError] = useState("");

  const [batchInputs, setBatchInputs] = useState({});
  const [batchErrors, setBatchErrors] = useState({});
  // ---- รับค่าจากเครื่องสแกน (USB): ตัวเลขที่พิมพ์ติดกันเร็ว ๆ แล้วปิดด้วย Enter ----
  const scanBufferRef = useRef("");
  const scanLastKeyRef = useRef(0);

  const isFormValid = () => {
    const isTrolleyValid = inputValue.trim() !== "" && inputValue.trim().length <= 4;

    if ([3, 6, 7, 8].includes(rm_type_id)) {
      const allBatchesFilled = batchArray.every((b) => {
        const input = batchInputs[b] || "";
        return input.trim() !== "" && input.length === 10;
      });
      return isTrolleyValid && allBatchesFilled;
    }

    return isTrolleyValid;
  };

  useEffect(() => {
    if (open) {
      setInputValue("");
      setScannedValue("");
      setApiError("");
      setInputError(false);

      scanBufferRef.current = "";
      scanLastKeyRef.current = 0;

      const initialBatchInputs = {};
      const initialBatchErrors = {};

      if (batchArray && batchArray.length > 0) {
        batchArray.forEach((b) => {
          initialBatchInputs[b] = String(b).toUpperCase(); // ใส่ batch เดิมไว้ให้ แก้ไขได้
          initialBatchErrors[b] = false;
        });
      }

      setBatchInputs(initialBatchInputs);
      setBatchErrors(initialBatchErrors);
    }
  }, [open, batchArray]);

  // QR ที่สแกนได้ → ใส่ในช่องเลขรถเข็นแล้วตรวจสถานะทันที (ข้ามค่าที่ซ้ำภายใน 1.5 วินาที)
  const lastDecodeRef = useRef({ value: "", at: 0 });
  const handleDecode = (raw) => {
    const value = String(raw ?? "").replace(/\D/g, "").slice(-4);
    if (!value) {
      setApiError("QR Code นี้ไม่มีเลขรถเข็น");
      return;
    }
    const now = Date.now();
    if (lastDecodeRef.current.value === value && now - lastDecodeRef.current.at < 1500) return;
    lastDecodeRef.current = { value, at: now };
    setScannedValue(value);
    setInputError(false);
    setInputValue(value.padStart(4, "0"));
    checkTrolleyStatus(value);
  };

  const { start: startCamera, stop: stopCamera, switchCamera, facing } = useQrCamera(videoRef, handleDecode);

  const handleClose = () => {
    onClose();
    stopCamera();
  };

  useEffect(() => {
    if (open) startCamera();
    return stopCamera;
  }, [open]);

  const checkTrolleyStatus = async (value) => {
    try {
      const response = await axios.get(`${API_URL}/api/checkTrolley`, {
        params: { tro: value },
      });

      if (response.data.success === false) {
        setApiError(response.data.message || "ไม่มีรถเข็นคันนี้ในระบบ");
        return false;
      } else if (
        response.data.success === true &&
        ["รถเข็นไม่พร้อมใช้งาน", "รถเข็นถูกจองใช้งาน"].includes(response.data.message)
      ) {
        setApiError(response.data.message);
        return false;
      }

      return true;
    } catch (error) {
      setApiError("ไม่มีรถเข็นคันนี้ในระบบ");
      return false;
    }
  };

  const reserveTrolley = async (tro_id) => {
    try {
      const response = await axios.post(`${API_URL}/api/reserveTrolley`, {
        tro_id: tro_id,
      });

      return response.data.success;
    } catch (error) {
      setApiError("รถเข็นถูกจองแล้ว");
      return false;
    }
  };

  const handleNextModal2 = async () => {
    setInputError(false);
    setBatchErrors({});
    setApiError("");

    if (inputValue.trim() === "" || inputValue.trim().length > 4) {
      setInputError(true);
      return;
    }

    if ([3, 6, 7, 8].includes(rm_type_id)) {
      const newBatchErrors = {};
      let hasError = false;

      batchArray.forEach((b) => {
        const input = batchInputs[b] || "";
        if (input.trim() === "" || input.length !== 10) {
          newBatchErrors[b] = true;
          hasError = true;
        }
      });

      if (hasError) {
        setBatchErrors(newBatchErrors);
        return;
      }
    }

    const isValid = await checkTrolleyStatus(inputValue);
    if (!isValid) return;

    const isReserved = await reserveTrolley(inputValue);
    if (!isReserved) return;

    const batchAfterArray = batchArray.map((b) => ({
      batch_before: b,
      batch_after: batchInputs[b] ? batchInputs[b] : b,
    }));

    onNext({
      inputValues: [inputValue],
      batch: batch,
      batchArray: batchArray,
      batchAfterArray: batchAfterArray,
      rmfp_id: rmfp_id,
    });
  };

  const handleBatchInputChange = (batchValue, newValue) => {
    const upperValue = newValue.toUpperCase();
    if (upperValue.length <= 10) {
      setBatchInputs((prev) => ({
        ...prev,
        [batchValue]: upperValue,
      }));
      setBatchErrors((prev) => ({
        ...prev,
        [batchValue]: false,
      }));
    }
  };

  // เครื่องสแกนพิมพ์ทีละตัวเร็ว ๆ และปิดด้วย Enter: เก็บตัวอักษรไว้ แล้วส่งค่าเมื่อครบ
  // (พิมพ์ด้วยคีย์บอร์ดไม่ได้ เพราะช่องเป็น readOnly)
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      const now = Date.now();
      if (e.key === "Enter") {
        const value = scanBufferRef.current;
        scanBufferRef.current = "";
        if (value) handleDecode(value);
        return;
      }
      if (e.key.length !== 1) return;
      if (now - scanLastKeyRef.current > 100) scanBufferRef.current = ""; // ช้าเกินไป = ไม่ใช่เครื่องสแกน
      scanLastKeyRef.current = now;
      scanBufferRef.current += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <StyledModal
      open={open}
      onClose={(e, reason) => {
        if (reason === "backdropClick") return;
        onClose();
      }}
    >
      <ModalContent>
        <CloseButton aria-label="close" onClick={handleClose}>
          <IoClose />
        </CloseButton>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            fontSize: "15px",
            color: "#555",
          }}
        >
          <Typography
            sx={{
              fontSize: "18px",
              fontWeight: 500,
              color: "#545454",
              marginBottom: "10px",
            }}
          >
            กรุณากรอกข้อมูลหรือสแกนป้ายทะเบียน
          </Typography>

          {inputError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              กรุณากรอกข้อมูลหรือสแกนป้ายทะเบียน (ไม่เกิน 4 ตัวเลข)
            </Alert>
          )}
          {Object.values(batchErrors).some((e) => e) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              กรุณากรอก Batch ใหม่ให้ครบ 10 ตัวอักษรสำหรับทุก Batch
            </Alert>
          )}
          {apiError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {apiError}
            </Alert>
          )}

          <Divider sx={{ mb: 2 }} />

          <video
            ref={videoRef}
            style={{
              width: "100%",
              marginBottom: theme.spacing(1),
              borderRadius: "4px",
            }}
            autoPlay
            muted
            playsInline
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<CameraswitchIcon />}
            onClick={switchCamera}
            sx={{ alignSelf: "flex-end", mb: 1 }}
          >
            {facing === "environment" ? "กล้องหลัง · สลับเป็นกล้องหน้า" : "กล้องหน้า · สลับเป็นกล้องหลัง"}
          </Button>

          <Divider sx={{ mt: 1, mb: 1 }} />

          {batchArray && batchArray.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 2 }}>
              {batchArray.map((b, idx) => (
                <Box key={idx}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TextField
                      fullWidth
                      label={batchArray.length > 1 ? `Batch ${idx + 1} (10 ตัวอักษร)` : "Batch (10 ตัวอักษร)"}
                      value={batchInputs[b] || ""}
                      onChange={(e) => handleBatchInputChange(b, e.target.value)}
                      size="small"
                      error={batchErrors[b]}
                      inputProps={{
                        maxLength: 10,
                        style: { textTransform: "uppercase" },
                      }}
                      sx={{
                        "& .MuiInputBase-root": {
                          height: "40px",
                        },
                      }}
                    />

                  </Box>
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ display: "flex", alignItems: "center" }}>
            <TextField
              fullWidth
              label="เลขทะเบียนรถเข็น (สแกน QR Code หรือ Barcode Scanner)"
              value={inputValue}
              margin="normal"
              size="small"
              error={inputError}
              placeholder="กรุณาสแกน QR Code หรือ Barcode Scanner"
              InputProps={{ readOnly: true }}
              sx={{ "& .MuiInputBase-input": { cursor: "default" } }}
            />
          </Box>

          <Divider sx={{ mt: 1, mb: 1 }} />

          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              pt: 1,
              height: "42px",
            }}
          >
            <Button
              style={{ backgroundColor: "#E5484D", color: "#fff" }}
              variant="contained"
              startIcon={<CancelIcon />}
              onClick={handleClose}
            >
              ยกเลิก
            </Button>
            <Button
              style={{
                backgroundColor: isFormValid() ? "#1552F0" : "#E3E8F2",
                color: "#fff",
              }}
              variant="contained"
              startIcon={<CheckCircleIcon />}
              onClick={handleNextModal2}
              disabled={!isFormValid()}
            >
              ยืนยัน
            </Button>
          </Box>
        </Box>
      </ModalContent>
    </StyledModal>
  );
};

export default Modal1;