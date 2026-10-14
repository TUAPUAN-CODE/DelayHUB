import React, { useState, useRef, useEffect } from "react";
import {
  Box, Typography, TextField, Button, Alert, Paper,
  CircularProgress, IconButton, Divider, Chip
} from "@mui/material";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import StopIcon from "@mui/icons-material/Stop";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import QrScanner from "qr-scanner";
import axios from "axios";
axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

const ScanCheckinPage = () => {
  const [huInput, setHuInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { success, message, hu, mat, batch }
  const [cameraActive, setCameraActive] = useState(false);
  const [scanBuffer, setScanBuffer] = useState("");

  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const inputRef = useRef(null);
  const bufferTimerRef = useRef(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // USB scanner: accumulate keystrokes, submit on Enter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        if (scanBuffer.trim()) {
          processRawScan(scanBuffer.trim());
          setScanBuffer("");
        }
        return;
      }
      // Only capture if input is NOT focused (USB scanner global capture)
      if (document.activeElement !== inputRef.current) {
        if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
        setScanBuffer((prev) => prev + e.key);
        bufferTimerRef.current = setTimeout(() => setScanBuffer(""), 200);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
    };
  }, [scanBuffer]);

  const processRawScan = (raw) => {
    // Format: mat|batch|HU|weight|unit
    const parts = raw.split("|");
    if (parts.length >= 3) {
      const mat   = parts[0].substring(0, 12);
      const batch = parts[1].substring(0, 10);
      const hu    = parts[2].substring(0, 9);
      submitHu(hu, mat, batch);
    } else {
      submitHu(raw.substring(0, 9));
    }
  };

  const submitHu = async (hu, mat = "", batch = "") => {
    const trimmed = (hu ?? "").toString().trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await axios.post(`${API_URL}/api/prep/checkin/sap`, { hu: trimmed });
      setResult({ success: true, message: res.data.message ?? "บันทึกสำเร็จ", hu: trimmed, mat, batch });
    } catch (err) {
      const msg = err.response?.data?.error ?? "เกิดข้อผิดพลาด";
      setResult({ success: false, message: msg, hu: trimmed, mat, batch });
    } finally {
      setLoading(false);
      setHuInput("");
      inputRef.current?.focus();
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    submitHu(huInput);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);

        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            processRawScan(result.data);
            stopCamera();
          },
          { highlightScanRegion: true, highlightCodeOutline: true }
        );
        qrScannerRef.current = scanner;
        scanner.start();
      }
    } catch {
      setResult({ success: false, message: "ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์การใช้กล้อง", hu: "" });
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    qrScannerRef.current?.stop();
    qrScannerRef.current = null;
    setCameraActive(false);
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <Box sx={{ maxWidth: 520, mx: "auto", py: 3 }}>
      <Paper elevation={2} sx={{ borderRadius: "12px", overflow: "hidden" }}>

        {/* Header */}
        <Box sx={{ bgcolor: "#0F3FC4", px: 3, py: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
          <QrCodeScannerIcon sx={{ color: "#fff", fontSize: 28 }} />
          <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: "16px" }}>
            Scan รับเข้าวัตถุดิบ (QR / Barcode)
          </Typography>
        </Box>

        <Box sx={{ px: 3, py: 3 }}>

          {/* Result feedback */}
          {result && (
            <Alert
              severity={result.success ? "success" : "error"}
              icon={result.success ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
              sx={{ mb: 2.5, borderRadius: "8px", fontSize: "14px" }}
            >
              <Box>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                  {result.mat   && <Chip label={`Mat: ${result.mat}`}   size="small" sx={{ fontSize: "11px", bgcolor: "#EAF0FF", color: "#0F3FC4" }} />}
                  {result.batch && <Chip label={`Batch: ${result.batch}`} size="small" sx={{ fontSize: "11px", bgcolor: "#f3e5f5", color: "#6a1b9a" }} />}
                  {result.hu    && <Chip label={`HU: ${result.hu}`}     size="small" sx={{ fontSize: "11px", bgcolor: "#e8f5e9", color: "#2e7d32" }} />}
                </Box>
                <Typography sx={{ fontSize: "13px" }}>{result.message}</Typography>
              </Box>
            </Alert>
          )}

          {/* Manual input form */}
          <form onSubmit={handleManualSubmit}>
            <Typography sx={{ fontSize: "13px", color: "#555", mb: 1, fontWeight: 600 }}>
              กรอก HU หรือ Scan ด้วย Scanner USB
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                inputRef={inputRef}
                fullWidth
                size="small"
                placeholder="กรอก HU หรือ Scan..."
                value={huInput}
                onChange={(e) => setHuInput(e.target.value)}
                disabled={loading}
                sx={{
                  "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: "14px" },
                }}
                InputProps={{
                  endAdornment: loading && <CircularProgress size={18} />,
                }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={!huInput.trim() || loading}
                sx={{ borderRadius: "8px", px: 3, whiteSpace: "nowrap", bgcolor: "#2e7d32", "&:hover": { bgcolor: "#1b5e20" } }}
              >
                รับเข้า
              </Button>
            </Box>
          </form>

          <Divider sx={{ my: 2.5 }}>
            <Chip label="หรือ Scan QR Code" size="small" sx={{ fontSize: "11px", color: "#999" }} />
          </Divider>

          {/* Camera */}
          <Box sx={{ textAlign: "center" }}>
            {!cameraActive ? (
              <Button
                variant="outlined"
                startIcon={<CameraAltIcon />}
                onClick={startCamera}
                sx={{ borderRadius: "8px", borderColor: "#0F3FC4", color: "#0F3FC4", px: 3 }}
              >
                เปิดกล้อง Scan QR
              </Button>
            ) : (
              <Box>
                <Box sx={{ position: "relative", display: "inline-block", width: "100%", maxWidth: 420 }}>
                  <video
                    ref={videoRef}
                    style={{ width: "100%", borderRadius: "10px", display: "block" }}
                    muted
                    playsInline
                  />
                  <IconButton
                    onClick={stopCamera}
                    sx={{
                      position: "absolute", top: 8, right: 8,
                      bgcolor: "rgba(0,0,0,0.55)", color: "#fff",
                      "&:hover": { bgcolor: "rgba(0,0,0,0.75)" }
                    }}
                  >
                    <StopIcon />
                  </IconButton>
                </Box>
                <Typography sx={{ fontSize: "12px", color: "#888", mt: 1 }}>
                  ชี้กล้องไปที่ QR Code — ระบบจะสแกนและบันทึกอัตโนมัติ
                </Typography>
              </Box>
            )}
          </Box>

        </Box>
      </Paper>
    </Box>
  );
};

export default ScanCheckinPage;
