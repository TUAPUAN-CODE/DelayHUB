import React, { useState, useEffect } from "react";
import {
  Box, Typography, Divider, Button, Dialog,
  CircularProgress, Alert, TextField
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import axios from "axios";
axios.defaults.withCredentials = true;
import { styled } from "@mui/system";

const API_URL = import.meta.env.VITE_API_URL;

const ModalContent = styled(Box)(() => ({
  backgroundColor: "#ffffff",
  padding: "32px",
  width: "100%",
  maxWidth: "480px",
  boxShadow: "0px 4px 20px rgba(0,0,0,0.15)",
  position: "relative",
}));

// ─── Success Dialog ───────────────────────────────────────────────────────────
const ModalAlert = ({ open, onClose }) => (
  <Dialog open={open} onClose={onClose}
    sx={{ "& .MuiDialog-paper": { borderRadius: 2, padding: 3 } }}>
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <CheckCircleIcon sx={{ fontSize: 52, color: "#4caf50" }} />
      <Typography variant="h6" sx={{ color: "#333" }}>
        บันทึกข้อมูลเรียบร้อยแล้ว
      </Typography>
      <Button onClick={onClose}
        sx={{ bgcolor: "#1552F0", color: "#fff", px: 4, py: 1.5, borderRadius: 1,
          "&:hover": { bgcolor: "#1552F0" } }}>
        ปิด
      </Button>
    </Box>
  </Dialog>
);

// ─── Main Modal ───────────────────────────────────────────────────────────────
const ModalEditPD = ({ open, onClose, material, batch, hu }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  // Remark CS: one note per HU, printed on every slip; the current one of this HU is shown first and can be changed / cleared
  const [remarkCs, setRemarkCs] = useState("");
  const [remarkLoading, setRemarkLoading] = useState(false);

  // reset เมื่อเปิด
  useEffect(() => {
    if (!open) return undefined;
    setError(null);
    setRemarkCs("");
    let alive = true;
    const h = parseInt(hu, 10);
    if (Number.isInteger(h)) {
      setRemarkLoading(true);
      axios.get(`${API_URL}/api/prep/sap/remark-cs`, { params: { hu: h } })
        .then((res) => { if (alive) setRemarkCs(res.data?.data?.remark_cs || ""); })
        .catch((err) => console.error("❌ Remark CS load error:", err))
        .finally(() => { if (alive) setRemarkLoading(false); });
    }
    return () => { alive = false; };
  }, [open, hu]);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const payload = {
        mat:   material,
        batch: batch,
        hu:    parseInt(hu, 10), 
        remark_cs: remarkCs.trim(),
      };

      console.log("📤 Sending payload:", payload);

      const response = await axios.post(
        `${API_URL}/api/prep/checkin/sap`,
        payload
      );

      if (response.status === 200) {
        setShowAlert(true);
        onClose();
      }
    } catch (err) {
      console.error("❌ API Error:", err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={(_, reason) => { if (reason !== "backdropClick") onClose(); }}
        maxWidth="xs"
        fullWidth
      >
        <ModalContent>
          {/* Header */}
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: "#ff0000" }}>
            ยืนยันการ Time Stamp เพื่อบันทึกเวลารับเข้าวัตถุดิบจากห้องเย็นใหญ่
          </Typography>

          <Divider sx={{ mb: 2.5 }} />

          {/* Info */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
            <InfoRow label="Material" value={material} />
            <InfoRow label="Batch"    value={batch} />
            <InfoRow label="HU"       value={hu} />
          </Box>

          {/* Remark CS (ไม่บังคับ) — แสดงในทุกสลีปของวัตถุดิบจาก HU นี้ */}
          <TextField
            label="Remark CS" placeholder="หมายเหตุ (แสดงในทุกสลีป)" value={remarkCs} onChange={(e) => setRemarkCs(e.target.value.slice(0, 500))}
            fullWidth size="small" multiline minRows={2} disabled={isLoading || remarkLoading}
            helperText={remarkLoading ? "กำลังโหลด Remark CS เดิม..." : `${remarkCs.length}/500 · ไม่บังคับ`}
            sx={{ mb: 2.5 }}
          />

          {/* Error */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          )}

          {/* Buttons */}
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5 }}>
            <Button fullWidth variant="outlined" color="error"
              startIcon={<CancelIcon />}
              onClick={onClose}
              disabled={isLoading}
            >
              ยกเลิก
            </Button>

            <Button fullWidth variant="contained"
              startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
              onClick={handleConfirm}
              disabled={isLoading}
              sx={{ bgcolor: "#1552F0", "&:hover": { bgcolor: "#1552F0" } }}
            >
              {isLoading ? "กำลังบันทึก..." : "ยืนยัน"}
            </Button>
          </Box>
        </ModalContent>
      </Dialog>

      <ModalAlert open={showAlert} onClose={() => setShowAlert(false)} />
    </>
  );
};

// ─── Helper Component ─────────────────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
    <Typography sx={{ fontSize: "13px", color: "#888", minWidth: "80px" }}>
      {label}:
    </Typography>
    <Typography sx={{ fontSize: "14px", fontWeight: 500, color: "#333" }}>
      {value || "-"}
    </Typography>
  </Box>
);

export default ModalEditPD;