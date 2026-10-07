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
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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
  position: "absolute",
  top: theme.spacing(1),
  right: theme.spacing(1),
  color: theme.palette.grey[600],
}));

const Modal1 = ({
  open,
  onClose,
  onNext,
  mat,
  mat_name,
  batch,
  batch_after,
  production,
  rmfp_id,
  dest,
  rm_type_id,
  mapping_id,
  tro_id,
}) => {
  const [rmTypeId, setRmTypeId] = useState(rm_type_id ?? 3);
  const theme = useTheme();
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const [inputValue, setInputValue] = useState("");
  const [scannedValue, setScannedValue] = useState("");
  const [inputError, setInputError] = useState(false);
  const [canManualInput, setCanManualInput] = useState(false);
  const [apiError, setApiError] = useState("");
  // const [batchInput, setBatchInput] = useState(batch || "");
  // const [batchError, setBatchError] = useState(false);
  // const [displayBatch, setDisplayBatch] = useState("");
  const [isEditableUser, setIsEditableUser] = useState(false);

  // const requiresBatchInput = [3, 6, 7, 8].includes(rm_type_id);

  const isFormValid = () => {
    const isTrolleyValid = inputValue.trim() !== "";
    return isTrolleyValid;
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user_id");
    const userId = storedUser ? parseInt(storedUser, 10) : null;
    const allowedUsers = [6590019, 4590390, 6760051,6760051];
    setIsEditableUser(allowedUsers.includes(userId));
  }, []);

  useEffect(() => {
    if (open) {
      // setBatchInput("");
      setInputValue("");
      setScannedValue("");
      setApiError("");
      setInputError(false);
      // setBatchError(false);
    }
  }, [open]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      videoRef.current.srcObject = stream;
      videoRef.current.play();

      const qrScanner = new QrScanner(
        videoRef.current,
        async (result) => {
          if (result?.data) {
            setScannedValue(result.data);
            setInputValue(result.data);
            await checkTrolleyStatus(result.data);
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
    const userId = localStorage.getItem("user_id");
    if (userId) {
      const isAllowed = userId === "6760051" || userId === 6760051;
      setCanManualInput(isAllowed);
    } else {
      setCanManualInput(false);
    }
  }, []);

  // useEffect(() => {
  //   if (open) {
  //     const batchValue = Array.isArray(batch_after)
  //       ? batch_after.length > 0
  //         ? batch_after[0]
  //         : "ไม่มีข้อมูล"
  //       : batch_after || "ไม่มีข้อมูล";
  //     setDisplayBatch(batchValue);
  //   }
  // }, [open, batch_after]);

  // useEffect(() => {
  //   if (open) {
  //     if (requiresBatchInput) {
  //       setBatchInput("");
  //     } else {
  //       const batchValue = Array.isArray(batch_after)
  //         ? batch_after.length > 0
  //           ? batch_after[0]
  //           : "ไม่มีข้อมูล"
  //         : batch_after || "ไม่มีข้อมูล";
  //       setBatchInput(batchValue);
  //     }
  //   }
  // }, [open, batch_after, rm_type_id, requiresBatchInput]);

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
        response.data.message === "รถเข็นไม่พร้อมใช้งาน"
      ) {
        setApiError("รถเข็นไม่พร้อมใช้งาน");
        return false;
      } else if (
        response.data.success === true &&
        response.data.message === "รถเข็นถูกจองใช้งาน"
      ) {
        setApiError("รถเข็นถูกจองใช้งาน");
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
    // setBatchError(false);

    if (inputValue.trim() === "") {
      setInputError(true);
      return;
    }

    // ❌ ลบการตรวจสอบ batch ทั้งหมดออก
    // if (requiresBatchInput) {
    //   if (batchInput.trim() === "") {
    //     setBatchError(true);
    //     return;
    //   }
    //   if (batchInput.length !== 10) {
    //     setBatchError(true);
    //     return;
    //   }
    // }

    const isValid = await checkTrolleyStatus(inputValue);
    if (!isValid) return;

    const isReserved = await reserveTrolley(inputValue);
    if (!isReserved) return;

    onNext({
      inputValues: [inputValue],
      mapping_id: mapping_id,
      batch: batch,
      // newBatch: batchInput,
      tro_id: tro_id,
    });
  };

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
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, fontSize: "15px", color: "#555" }}>
          <Typography sx={{ fontSize: "18px", fontWeight: 500, color: "#545454", marginBottom: "10px" }}>
            กรุณากรอกข้อมูลหรือสแกนป้ายทะเบียน
          </Typography>

          {/* <Typography sx={{ fontSize: "18px", fontWeight: 500, color: "#545454", marginBottom: "10px" }}>
            Old Batch: {displayBatch || "ไม่มีข้อมูล"}
          </Typography> */}

          {inputError && <Alert severity="error" sx={{ mb: 2 }}>กรุณากรอกข้อมูลหรือสแกนป้ายทะเบียน</Alert>}
          {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}

          <Divider sx={{ mb: 2 }} />

          <video ref={videoRef} style={{ width: "100%", marginBottom: theme.spacing(1), borderRadius: "4px" }} autoPlay muted />

          <Divider sx={{ mt: 1, mb: 1 }} />

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
              onKeyDown={(e) => {
                if (!isEditableUser && e.key.length === 1) {
                  e.preventDefault();
                }
              }}
              onPaste={(e) => {
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
                  cursor: isEditableUser ? "text" : "not-allowed",
                },
              }}
            />
          </Box>

          <Divider sx={{ mt: 1, mb: 1 }} />

          <Box sx={{ display: "flex", justifyContent: "space-between", pt: 1, height: "42px" }}>
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
