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
import QrScanner from "qr-scanner";
axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

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
  batchArray = [],
  production,
  rmfp_id,
  dest,
  rm_type_id,
}) => {
  const [rmTypeId, setRmTypeId] = useState(rm_type_id ?? 3);
  const theme = useTheme();
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const [inputValue, setInputValue] = useState("");
  const [scannedValue, setScannedValue] = useState("");
  const [inputError, setInputError] = useState(false);
  const [apiError, setApiError] = useState("");

  const [batchInputs, setBatchInputs] = useState({});
  const [batchErrors, setBatchErrors] = useState({});
  const [isEditableUser, setIsEditableUser] = useState(false);

  // ---- refs สำหรับตรวจจับ Barcode Scanner ----
  const lastKeyTime = useRef(0);
  // --------------------------------------------

  useEffect(() => {
    const storedUser = localStorage.getItem("user_id");
    const userId = storedUser ? parseInt(storedUser, 10) : null;
    const allowedUsers = [6590019, 4590390, 6760051, 6760099, 6760052, 3590269, 6390056];
    setIsEditableUser(allowedUsers.includes(userId));
  }, []);

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

      const initialBatchInputs = {};
      const initialBatchErrors = {};

      if (batchArray && batchArray.length > 0) {
        batchArray.forEach((b) => {
          initialBatchInputs[b] = "";
          initialBatchErrors[b] = false;
        });
      }

      setBatchInputs(initialBatchInputs);
      setBatchErrors(initialBatchErrors);
    }
  }, [open, batchArray]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      videoRef.current.srcObject = stream;
      videoRef.current.play();

      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => {
          if (result) {
            let value = result?.data || result;
            value = value.replace(/\D/g, "").slice(-4);
            setScannedValue(value);
            setInputValue(value);
            checkTrolleyStatus(value);
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      qrScannerRef.current = qrScanner;
      qrScanner.start();
    } catch (err) {
      console.error("Error opening camera:", err);
      setApiError("ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบการอนุญาตใช้งานกล้อง");
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

  const useOldBatch = (batchValue) => {
    setBatchInputs((prev) => ({
      ...prev,
      [batchValue]: batchValue.toUpperCase(),
    }));
    setBatchErrors((prev) => ({
      ...prev,
      [batchValue]: false,
    }));
  };

  // ---- Handler: ตรวจจับว่าเป็น Scanner หรือพิมพ์เอง ----
  const handleTrolleyKeyDown = (e) => {
    // user พิเศษ → พิมพ์ได้ทุกอย่าง ไม่บล็อก
    if (isEditableUser) return;

    const now = Date.now();
    const timeDiff = now - lastKeyTime.current;
    lastKeyTime.current = now;

    // Enter / Tab / Backspace → อนุญาตเสมอ (Scanner ส่ง Enter ปิดท้าย)
    if (["Enter", "Tab", "Backspace", "Delete"].includes(e.key)) return;

    // ถ้าเป็นตัวอักษร/ตัวเลข
    if (e.key.length === 1) {
      // Scanner พิมพ์เร็วมาก (< 50ms ต่อตัว) → อนุญาต
      // คนพิมพ์เองช้ากว่า (> 100ms) → บล็อก
      if (timeDiff > 100) {
        e.preventDefault();
      }
    }
  };
  // -------------------------------------------------------

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
          <Typography
            sx={{
              fontSize: "18px",
              fontWeight: 500,
              color: "#545454",
              marginBottom: "10px",
            }}
          >
            Old Batch: {batch || "ไม่มีข้อมูล"}
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
          />

          <Divider sx={{ mt: 1, mb: 1 }} />

          <Typography
            sx={{
              fontSize: "16px",
              fontWeight: 400,
              color: "#333",
              marginBottom: "8px",
            }}
          >
            Batch Array:
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, marginBottom: 2 }}>
            {batchArray && batchArray.length > 0 ? (
              batchArray.map((b, idx) => (
                <Box
                  key={idx}
                  sx={{
                    padding: "4px 8px",
                    backgroundColor: "#f0f0f0",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                >
                  {b}
                </Box>
              ))
            ) : (
              <Typography sx={{ fontSize: "14px", color: "#999" }}>
                ไม่มีข้อมูล
              </Typography>
            )}
          </Box>

          {batchArray &&
            batchArray.length > 0 && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 2 }}>
                <Typography
                  sx={{
                    fontSize: "16px",
                    fontWeight: 500,
                    color: "#333",
                  }}
                >
                  กรอก Batch ใหม่สำหรับแต่ละ Batch:
                </Typography>

                {batchArray.map((b, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      padding: 2,
                      backgroundColor: "#f9f9f9",
                      borderRadius: "4px",
                      border: "1px solid #e0e0e0",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#666",
                      }}
                    >
                      Batch เดิม: {b}
                    </Typography>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TextField
                        fullWidth
                        label={`Batch ใหม่ ${idx + 1} (10 ตัวอักษร)`}
                        value={batchInputs[b] || ""}
                        onChange={(e) =>
                          handleBatchInputChange(b, e.target.value)
                        }
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

                      <Button
                        variant="contained"
                        onClick={() => useOldBatch(b)}
                        sx={{
                          backgroundColor: "#41b0e6",
                          color: "#fff",
                          height: "40px",
                          minWidth: "auto",
                          px: 2,
                          fontSize: "0.875rem",
                          whiteSpace: "nowrap",
                          "&:hover": {
                            backgroundColor: "#2c8fcc",
                          },
                        }}
                      >
                        ใช้เดิม
                      </Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

          <Box sx={{ display: "flex", alignItems: "center" }}>
            <TextField
              fullWidth
              label={
                isEditableUser
                  ? "เลขทะเบียนรถเข็น (สามารถพิมพ์หรือสแกนได้)"
                  : "เลขทะเบียนรถเข็น (สแกน QR Code หรือ Barcode Scanner)"
              }
              value={inputValue}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                const formatted = raw.padStart(4, "0").slice(-4);
                setInputValue(formatted);
                setInputError(false);
              }}
              onKeyDown={handleTrolleyKeyDown}
              onPaste={(e) => {
                // อนุญาต paste เฉพาะ user พิเศษ
                if (!isEditableUser) e.preventDefault();
              }}
              margin="normal"
              size="small"
              error={inputError}
              placeholder={
                isEditableUser
                  ? "พิมพ์หรือสแกนหมายเลขรถเข็น"
                  : "กรุณาสแกน QR Code หรือ Barcode Scanner"
              }
              sx={{
                "& .MuiInputBase-input": {
                  cursor: isEditableUser ? "text" : "default",
                },
              }}
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
              style={{ backgroundColor: "#E74A3B", color: "#fff" }}
              variant="contained"
              startIcon={<CancelIcon />}
              onClick={handleClose}
            >
              ยกเลิก
            </Button>
            <Button
              style={{
                backgroundColor: isFormValid() ? "#41a2e6" : "#e0e0e0",
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