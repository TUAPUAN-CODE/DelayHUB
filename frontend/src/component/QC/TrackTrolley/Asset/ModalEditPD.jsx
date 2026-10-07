import React, { useState, useEffect, useCallback, useRef } from "react";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Stack,
  Alert,
  TextField,
  CircularProgress,
} from "@mui/material";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import axios from "axios";
axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

const ModalEditPD = ({ open, onClose, data, onSuccess }) => {
  const { tro_id } = data || {};

  const [scannedCode, setScannedCode] = useState("");
  const [scanError, setScanError] = useState("");
  const [inputMode, setInputMode] = useState("manual");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scanInputRef = useRef(null);
  const qrScannerRef = useRef(null);
  const scannerInstanceRef = useRef(null);

  // ── Reset state เมื่อ open/close ─────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setScannedCode("");
      setScanError("");
      setInputMode("manual");
      setIsSubmitting(false);
    } else {
      stopCameraScanner();
    }
  }, [open]);

  useEffect(() => {
    return () => stopCameraScanner();
  }, []);

  // ── Focus input เมื่อ manual mode ────────────────────────────────────────
  useEffect(() => {
    if (open && inputMode === "manual" && scanInputRef.current) {
      setTimeout(() => scanInputRef.current?.focus(), 300);
    }
  }, [open, inputMode]);

  // ── Camera helpers ───────────────────────────────────────────────────────
  const loadHtml5QrcodeScript = () =>
    new Promise((resolve, reject) => {
      if (window.Html5Qrcode) return resolve();
      const script = document.createElement("script");
      script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
      script.async = true;
      script.onload = () => setTimeout(() => window.Html5Qrcode ? resolve() : reject(new Error("โหลดไม่สำเร็จ")), 100);
      script.onerror = () => reject(new Error("ไม่สามารถโหลด QR Scanner Library ได้"));
      document.head.appendChild(script);
    });

  const stopCameraScanner = async () => {
    if (scannerInstanceRef.current) {
      try {
        await scannerInstanceRef.current.stop();
        await scannerInstanceRef.current.clear();
      } catch (e) {}
      scannerInstanceRef.current = null;
    }
    setIsScanning(false);
    setIsCameraActive(false);
  };

  const startCameraScanner = async () => {
    if (isScanning || scannerInstanceRef.current) return;
    setIsScanning(true);
    setIsCameraActive(true);
    setScanError("");
    setIsLoadingLibrary(true);
    try {
      await loadHtml5QrcodeScript();
      setIsLoadingLibrary(false);
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Browser ไม่รองรับการใช้กล้อง");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      if (!qrScannerRef.current) throw new Error("ไม่พบพื้นที่แสดงกล้อง");
      scannerInstanceRef.current = new window.Html5Qrcode("qr-reader-edit");
      await scannerInstanceRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const last4 = decodedText.slice(-4).replace(/\D/g, "");
          if (last4.length === 4) {
            setScannedCode(last4);
            if (last4 === tro_id?.slice(-4)) {
              stopCameraScanner();
              submitToApi();
            } else {
              setScanError(`ป้ายทะเบียนไม่ตรงกับรถเข็น ${tro_id}`);
              setScannedCode("");
              setTimeout(() => setScanError(""), 3000);
            }
          }
        },
        () => {}
      );
    } catch (error) {
      setIsLoadingLibrary(false);
      setScanError(error.message || "ไม่สามารถเปิดกล้องได้");
      setIsScanning(false);
      setIsCameraActive(false);
    }
  };

  // ── Submit API ────────────────────────────────────────────────────────────
  const submitToApi = useCallback(async () => {
    if (!tro_id || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await axios.put(`${API_URL}/api/prep/clear/trolley`, { tro_id });
      if (response.status === 200) {
        console.log("✅ Data sent successfully:", response.data);
        onSuccess?.();
        onClose();
      } else {
        setScanError(`เกิดข้อผิดพลาด: ${response.status}`);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Error during API call:", error);
      setScanError("ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่");
      setIsSubmitting(false);
    }
  }, [tro_id, isSubmitting, onSuccess, onClose]);

  // ── Verify scan ───────────────────────────────────────────────────────────
  const handleScanVerify = useCallback(() => {
    if (!tro_id) {
      setScanError("ไม่พบหมายเลขรถเข็น");
      return;
    }
    const troIdLast4 = tro_id.slice(-4);
    if (scannedCode === troIdLast4) {
      setScanError("");
      submitToApi();
    } else {
      setScanError(`ป้ายทะเบียนไม่ตรงกับรถเข็น ${tro_id}`);
      setScannedCode("");
    }
  }, [scannedCode, tro_id, submitToApi]);

  // Auto-verify เมื่อครบ 4 หลัก
  useEffect(() => {
    if (scannedCode.length === 4) {
      const timer = setTimeout(() => handleScanVerify(), 300);
      return () => clearTimeout(timer);
    }
  }, [scannedCode, handleScanVerify]);

  const handleScanInputChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
    setScannedCode(value);
    setScanError("");
  };

  const handleScanKeyPress = (e) => {
    if (e.key === "Enter" && scannedCode.length === 4) handleScanVerify();
  };

  const switchToManualMode = () => {
    stopCameraScanner();
    setInputMode("manual");
    setScannedCode("");
    setScanError("");
  };

  const switchToCameraMode = () => {
    setInputMode("camera");
    setScannedCode("");
    setScanError("");
    startCameraScanner();
  };

  const handleClose = () => {
    stopCameraScanner();
    setScannedCode("");
    setScanError("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => { if (reason === "backdropClick") return; handleClose(); }}
      fullWidth
      maxWidth="sm"
      TransitionProps={{
        onEntered: () => { if (inputMode === "camera") startCameraScanner(); },
      }}
    >
      <DialogContent>
        <Stack spacing={3} alignItems="center" sx={{ py: 2 }}>
          <Box sx={{ fontSize: 60, color: isSubmitting ? "#4caf50" : scannedCode.length === 4 ? "#4caf50" : "#1552F0" }}>
            <QrCodeScannerIcon sx={{ fontSize: "inherit" }} />
          </Box>

          <Typography variant="h6" align="center" color="#6B7489">
            สแกนป้ายทะเบียนรถเข็น
          </Typography>

          <Typography variant="body2" align="center" color="#6B7489">
            รถเข็น: <strong>{tro_id || "-"}</strong>
          </Typography>

          {/* Mode switch buttons */}
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant={inputMode === "camera" ? "contained" : "outlined"}
              startIcon={<CameraAltIcon />}
              onClick={switchToCameraMode}
              size="small"
              disabled={inputMode === "camera"}
            >
              สแกนกล้อง
            </Button>
            <Button
              variant={inputMode === "manual" ? "contained" : "outlined"}
              startIcon={<KeyboardIcon />}
              onClick={switchToManualMode}
              size="small"
              disabled={inputMode === "manual"}
            >
              พิมพ์เอง
            </Button>
          </Box>

          {/* Camera area */}
          <Box sx={{ width: "100%", maxWidth: 400 }}>
            {isLoadingLibrary ? (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4 }}>
                <CircularProgress size={50} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  กำลังโหลด QR Scanner...
                </Typography>
              </Box>
            ) : (
              <>
                <div
                  id="qr-reader-edit"
                  ref={qrScannerRef}
                  style={{ width: "100%", display: inputMode === "camera" && isCameraActive ? "block" : "none" }}
                />
                {inputMode === "camera" && !isCameraActive && !isScanning && (
                  <Box sx={{ textAlign: "center", py: 4, backgroundColor: "#F5F8FF", borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>กล้องปิดอยู่</Typography>
                    <Button variant="outlined" onClick={switchToCameraMode} startIcon={<CameraAltIcon />} size="small">
                      เปิดกล้องใหม่
                    </Button>
                  </Box>
                )}
                {inputMode === "manual" && (
                  <Box sx={{ textAlign: "center", py: 3, backgroundColor: "#F5F8FF", borderRadius: 2, border: "2px dashed #1552F0" }}>
                    <KeyboardIcon sx={{ fontSize: 48, color: "#1552F0", mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">โหมดพิมพ์เอง</Typography>
                    <Typography variant="caption" color="#999">
                      พิมพ์เลข 4 หลักท้ายของป้ายทะเบียนรถเข็น
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>

          {/* Input */}
          <Box sx={{ width: "100%", maxWidth: 350 }}>
            <TextField
              inputRef={scanInputRef}
              fullWidth
              label="พิมพ์เลข 4 หลักท้าย / ใช้ Scanner"
              value={scannedCode}
              onChange={handleScanInputChange}
              onKeyPress={handleScanKeyPress}
              placeholder="0000"
              disabled={isSubmitting}
              inputProps={{
                maxLength: 4,
                inputMode: "numeric",
                pattern: "[0-9]*",
                style: { fontSize: 24, textAlign: "center", letterSpacing: 8 },
              }}
              error={!!scanError}
              autoFocus={inputMode === "manual"}
              autoComplete="off"
            />
            {/* Dot indicators */}
            <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mt: 2 }}>
              {[1, 2, 3, 4].map((dot) => (
                <Box key={dot} sx={{
                  width: 12, height: 12, borderRadius: "50%",
                  backgroundColor: scannedCode.length >= dot ? "#1552F0" : "#E3E8F2",
                  transition: "background-color 0.3s",
                }} />
              ))}
            </Box>
          </Box>

          {scanError && <Alert severity="error" sx={{ width: "100%" }}>{scanError}</Alert>}
          {isSubmitting && <Alert severity="info" sx={{ width: "100%" }}>กำลังส่งข้อมูล...</Alert>}

          <Typography variant="caption" color="#999" align="center">
            สแกน QR Code หรือพิมพ์เลข 4 หลักท้ายของป้ายทะเบียน แล้วระบบจะส่งข้อมูลทันที
          </Typography>

          {/* Buttons */}
          <Box sx={{ display: "flex", gap: 2, width: "100%", mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<CancelIcon />}
              onClick={handleClose}
              fullWidth
              disabled={isSubmitting}
              sx={{ color: "#E5484D", borderColor: "#E5484D" }}
            >
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              startIcon={<CheckCircleIcon />}
              onClick={handleScanVerify}
              disabled={scannedCode.length !== 4 || isSubmitting}
              fullWidth
              sx={{ backgroundColor: "#1552F0" }}
            >
              ยืนยัน
            </Button>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default ModalEditPD;