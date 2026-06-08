import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
axios.defaults.withCredentials = true;
import {
  Modal, Box, Typography, TextField, Button,
  IconButton, Alert, Divider, Chip, Stack
} from "@mui/material";
import { styled } from "@mui/system";
import { IoClose } from "react-icons/io5";
import QrScanner from "qr-scanner";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import okSound from "./Sound OK.mp3";

const API_URL = import.meta.env.VITE_API_URL;

const StyledModal = styled(Modal)(() => ({
  display: "flex", alignItems: "center", justifyContent: "center",
  p: 2,
}));

const ModalContent = styled(Box)(({ theme }) => ({
  position: "relative",
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(3),
  borderRadius: "16px",
  maxWidth: "1200px",
  width: "95vw",
  boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
  maxHeight: "92vh",
  overflowY: "auto",
  "&::-webkit-scrollbar": { width: "6px" },
  "&::-webkit-scrollbar-thumb": { backgroundColor: "#cbd5e1", borderRadius: "3px" },
}));

const ScanTrolley = ({ open, onClose, selectedCsId, selectedRoomName }) => {
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const processingRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const scannerActiveRef = useRef(false);
  const scannerInputRef = useRef(""); // ✅ USB scanner buffer
  const manualInputRef = useRef(null);

  const [manualInput, setManualInput] = useState("");
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sectionLeader, setSectionLeader] = useState("");
  const [successLog, setSuccessLog] = useState([]);
  const [lastSuccess, setLastSuccess] = useState(null);

  // ── reset เมื่อเปิด ────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setManualInput("");
      setApiError("");
      setSuccessLog([]);
      setLastSuccess(null);
      processingRef.current = false;
      scannerInputRef.current = "";
      const firstName = localStorage.getItem("first_name") || "";
      setSectionLeader(firstName.trim());
    }
  }, [open]);

  // ── เสียง ──────────────────────────────────────────────────────────────────
  const playOkSound = () => {
    try {
      const audio = new Audio(okSound);
      audio.volume = 1;
      audio.play().catch((e) => console.warn("Sound:", e));
    } catch (e) { console.warn("Sound:", e); }
  };

  // ── Camera ─────────────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const qrScanner = new QrScanner(
          videoRef.current,
          (result) => handleScannedData(result.data),
          { highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true }
        );
        qrScannerRef.current = qrScanner;
        await qrScanner.start();
        scannerActiveRef.current = true;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setApiError("ไม่สามารถเปิดกล้องได้ — ใช้ USB Scanner หรือพิมพ์เลขรถเข็นแทน");
    }
  };

  const stopCamera = () => {
    scannerActiveRef.current = false;
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (open) startCamera();
    return () => stopCamera();
  }, [open]);

  // ── ✅ USB Scanner keyboard listener ───────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handleKeyPress = (e) => {
      // ไม่รับ keypress ถ้า focus อยู่ที่ input field อื่น (manual input / section leader)
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isInputFocused = tag === "input" || tag === "textarea";
      if (isInputFocused) return;

      if (processingRef.current) return;

      if (e.key === "Enter") {
        const val = scannerInputRef.current.trim();
        if (val) {
          handleScannedData(val);
          scannerInputRef.current = "";
        }
      } else if (e.key.length === 1) {
        scannerInputRef.current += e.key;
      }
    };
    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, [open]);

  // ── parse QR / barcode ─────────────────────────────────────────────────────
  const handleScannedData = (raw) => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 1200) return;
    lastScanTimeRef.current = now;
    if (processingRef.current) return;

    const text = raw.trim();
    let troId = null;

    if (text.includes("|")) {
      const parts = text.split("|");
      troId = parts[0]?.trim().slice(0, 4);
    } else if (/^\d+$/.test(text)) {
      troId = text.padStart(4, "0").slice(-4);
    }

    if (!troId) { setApiError(`รูปแบบไม่ถูกต้อง: "${text}"`); return; }
    submitTrolley(troId);
  };

  // ── API ────────────────────────────────────────────────────────────────────
  const submitTrolley = async (troId) => {
    if (!selectedCsId) { setApiError("ไม่พบห้องเย็นที่เลือก"); return; }
    if (processingRef.current) return;

    processingRef.current = true;
    setLoading(true);
    setApiError("");

    try {
      const response = await axios.put(
        `${API_URL}/api/largecold/checkin/update/Trolley`,
        { tro_id: troId, cs_id: selectedCsId, section_leader: sectionLeader }
      );

      playOkSound();

      const logEntry = {
        troId,
        slot: response.data.slot_id,
        time: new Date().toLocaleTimeString("th-TH"),
      };
      setLastSuccess(logEntry);
      setSuccessLog((prev) => [logEntry, ...prev.slice(0, 19)]);
      setManualInput("");
      setApiError("");

    } catch (error) {
      const serverData = error.response?.data;
      if (serverData?.details?.invalidDestinations) {
        let msg = serverData.message;
        serverData.details.invalidDestinations.forEach((d) => {
          msg += `\n- ${d.destination} (${d.count} รายการ)`;
          if (d.items) msg += `: ${d.items.join(", ")}`;
        });
        setApiError(msg);
      } else {
        setApiError(serverData?.message || "เกิดข้อผิดพลาด");
      }
    } finally {
      processingRef.current = false;
      setLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualInput.trim()) return;
    const troId = manualInput.trim().padStart(4, "0").slice(-4);
    await submitTrolley(troId);
  };

  const handleClose = () => { stopCamera(); onClose(); };

  return (
    <StyledModal
      open={open}
      onClose={(_, reason) => { if (reason !== "backdropClick") onClose(); }}
    >
      <ModalContent>

        {/* ── Header ── */}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2.5 }}>
          <Box>
            <Typography sx={{ fontSize: "22px", fontWeight: 800, color: "#1e3a5f", lineHeight: 1.2 }}>
              🏭 รับเข้าห้องเย็นใหญ่
            </Typography>
            {selectedRoomName && (
              <Box sx={{
                display: "inline-flex", alignItems: "center", gap: 0.75, mt: 1,
                bgcolor: "#1d4ed8", borderRadius: "8px", px: 1.5, py: 0.5,
              }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#93c5fd" }} />
                <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>
                  {selectedRoomName}
                </Typography>
              </Box>
            )}
          </Box>
          <IconButton onClick={handleClose} sx={{ color: "#94a3b8", mt: -0.5 }}>
            <IoClose size={22} />
          </IconButton>
        </Box>

        {/* ── Status Bar ── */}
        <Box sx={{
          display: "flex", alignItems: "center", gap: 1.5,
          bgcolor: loading ? "#fffbeb" : "#f0fdf4",
          border: `1px solid ${loading ? "#fde68a" : "#bbf7d0"}`,
          borderRadius: "10px", px: 2, py: 1, mb: 2,
        }}>
          <Box sx={{
            width: 12, height: 12, borderRadius: "50%",
            bgcolor: loading ? "#f59e0b" : "#22c55e",
            boxShadow: loading ? "0 0 8px #f59e0b" : "0 0 8px #22c55e",
            flexShrink: 0,
            animation: loading ? "none" : "pulse 2s infinite",
            "@keyframes pulse": {
              "0%, 100%": { opacity: 1 },
              "50%": { opacity: 0.5 },
            }
          }} />
          <Typography sx={{ fontSize: "13px", fontWeight: 700, color: loading ? "#92400e" : "#15803d" }}>
            {loading ? "⏳ กำลังประมวลผล..." : "พร้อมสแกน — วาง QR Code หน้ากล้อง หรือใช้ USB Scanner"}
          </Typography>
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.5 }}>
            <QrCodeScannerIcon sx={{ fontSize: "16px", color: "#64748b" }} />
            <Typography sx={{ fontSize: "11px", color: "#64748b" }}>USB Scanner พร้อมใช้</Typography>
          </Box>
        </Box>

        {/* ── Error ── */}
        {apiError && (
          <Alert severity="error" onClose={() => setApiError("")}
            sx={{ mb: 2, borderRadius: "10px", whiteSpace: "pre-line", fontSize: "13px" }}>
            {apiError}
          </Alert>
        )}

        {/* ── Last Success Banner ── */}
        {lastSuccess && (
          <Box sx={{
            display: "flex", alignItems: "center", gap: 1.5,
            bgcolor: "#dcfce7", border: "2px solid #16a34a",
            borderRadius: "10px", px: 2, py: 1.25, mb: 2,
          }}>
            <CheckCircleIcon sx={{ color: "#16a34a", fontSize: "22px" }} />
            <Box>
              <Typography sx={{ fontSize: "14px", fontWeight: 800, color: "#14532d" }}>
                รับเข้าสำเร็จ! รถเข็น {lastSuccess.troId}
              </Typography>
              <Typography sx={{ fontSize: "12px", color: "#166534" }}>
                ช่อง {lastSuccess.slot || "-"} • {lastSuccess.time}
              </Typography>
            </Box>
          </Box>
        )}

        {/* ── 2 Column Layout ── */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2.5 }}>

          {/* ── Left: Camera ── */}
          <Box>
            <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#64748b",
              textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
              📷 กล้อง QR Code
            </Typography>
            <Box sx={{ position: "relative", borderRadius: "12px", overflow: "hidden",
              border: "2px solid #4caf50", bgcolor: "#000" }}>
              <video ref={videoRef} style={{ width: "100%", display: "block",
                aspectRatio: "4/3", objectFit: "cover" }}
                autoPlay muted playsInline />
              <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0,
                background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                p: 1, textAlign: "center" }}>
                <Typography sx={{ fontSize: "11px", color: "#fff", opacity: 0.9 }}>
                  วาง QR Code ให้อยู่กลางกรอบ
                </Typography>
              </Box>
            </Box>

            {/* Manual Input */}
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#64748b",
                textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                ⌨️ พิมพ์เลขรถเข็น
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextField
                  inputRef={manualInputRef}
                  label="เลขทะเบียนรถเข็น"
                  value={manualInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    setManualInput(raw.slice(0, 4));
                    setApiError("");
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleManualSubmit(); }}
                  size="small" fullWidth
                  inputProps={{ inputMode: "numeric", maxLength: 4 }}
                  placeholder="0001"
                  disabled={loading}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: "18px",
                    fontWeight: 700, fontFamily: "monospace" } }}
                />
                <Button
                  variant="contained"
                  onClick={handleManualSubmit}
                  disabled={loading || !manualInput.trim()}
                  sx={{ borderRadius: "8px", px: 2, minWidth: "80px",
                    bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" },
                    "&:disabled": { bgcolor: "#e2e8f0" } }}
                >
                  ✓
                </Button>
              </Box>
              <Typography sx={{ fontSize: "11px", color: "#94a3b8", mt: 0.5 }}>
                กด Enter หรือปุ่ม ✓ เพื่อบันทึก
              </Typography>
            </Box>

            {/* Section Leader */}
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#64748b",
                textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                👤 หัวหน้าส่วนงานห้องเย็น
              </Typography>
              <TextField
                fullWidth label="ชื่อหัวหน้าส่วนงาน"
                value={sectionLeader}
                onChange={(e) => setSectionLeader(e.target.value)}
                size="small"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
                helperText="ดึงค่าจากบัญชีผู้ใช้อัตโนมัติ"
              />
            </Box>
          </Box>

          {/* ── Right: Success Log ── */}
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#64748b",
                textTransform: "uppercase", letterSpacing: "0.08em" }}>
                📋 ประวัติการรับเข้า
              </Typography>
              {successLog.length > 0 && (
                <Chip label={`${successLog.length} คัน`} size="small"
                  sx={{ bgcolor: "#dcfce7", color: "#166534", fontWeight: 700, fontSize: "11px" }} />
              )}
            </Box>

            <Box sx={{
              border: "1px solid #e2e8f0", borderRadius: "12px",
              overflow: "hidden", minHeight: "400px",
              maxHeight: "calc(92vh - 280px)", display: "flex", flexDirection: "column",
            }}>
              {successLog.length === 0 ? (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", flex: 1, py: 6, color: "#94a3b8" }}>
                  <QrCodeScannerIcon sx={{ fontSize: "48px", mb: 1.5, opacity: 0.4 }} />
                  <Typography sx={{ fontSize: "13px", fontWeight: 500 }}>
                    ยังไม่มีรายการ
                  </Typography>
                  <Typography sx={{ fontSize: "12px", mt: 0.5 }}>
                    สแกน QR Code เพื่อเริ่มบันทึก
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ overflowY: "auto", flex: 1,
                  "&::-webkit-scrollbar": { width: "4px" },
                  "&::-webkit-scrollbar-thumb": { bgcolor: "#cbd5e1", borderRadius: "2px" },
                }}>
                  {/* Header row */}
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                    bgcolor: "#f8fafc", px: 2, py: 1,
                    borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0 }}>
                    {["รถเข็น", "ช่อง", "เวลา"].map(h => (
                      <Typography key={h} sx={{ fontSize: "11px", fontWeight: 700,
                        color: "#64748b", textTransform: "uppercase" }}>{h}</Typography>
                    ))}
                  </Box>

                  {successLog.map((log, i) => (
                    <Box key={i} sx={{
                      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                      px: 2, py: 1.25,
                      bgcolor: i === 0 ? "#f0fdf4" : i % 2 === 0 ? "#fff" : "#f8fafc",
                      borderBottom: "1px solid #f1f5f9",
                      borderLeft: i === 0 ? "3px solid #22c55e" : "3px solid transparent",
                      transition: "all 0.2s",
                    }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        {i === 0 && <Box sx={{ width: 6, height: 6, borderRadius: "50%",
                          bgcolor: "#22c55e", flexShrink: 0 }} />}
                        <Typography sx={{ fontSize: "14px", fontWeight: 700,
                          color: i === 0 ? "#15803d" : "#1e293b",
                          fontFamily: "monospace" }}>
                          {log.troId}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: "13px", color: "#475569",
                        fontWeight: log.slot ? 600 : 400 }}>
                        {log.slot || "-"}
                      </Typography>
                      <Typography sx={{ fontSize: "12px", color: "#94a3b8" }}>
                        {log.time}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* ── Footer ── */}
        <Box sx={{ mt: 2.5, pt: 2, borderTop: "1px solid #e2e8f0",
          display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="outlined" color="error"
            startIcon={<CancelIcon />}
            onClick={handleClose}
            sx={{ borderRadius: "10px", px: 3 }}
          >
            ปิด
          </Button>
        </Box>

      </ModalContent>
    </StyledModal>
  );
};

export default ScanTrolley;