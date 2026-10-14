import React, { useState, useEffect } from "react";
import {
  Box, Typography, Divider, Button, Dialog,
  CircularProgress, Alert, TextField, Select, MenuItem,
  FormControl, InputLabel, FormHelperText
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import axios from "axios";
axios.defaults.withCredentials = true;
import { styled } from "@mui/system";

const API_URL = import.meta.env.VITE_API_URL;

const STORAGE_OPTIONS = [
  "ฝากเก็บเพื่อรอผลิต",
  "ฟรีสเพื่อจัดเก็บ",
  "ส่งคืน",
];

const ModalContent = styled(Box)(() => ({
  backgroundColor: "#ffffff",
  padding: "32px",
  width: "100%",
  maxWidth: "520px",
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
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState(null);
  const [showAlert, setShowAlert]     = useState(false);
  const [storageType, setStorageType] = useState("");
  const [histamine, setHistamine]     = useState("");
  const [supervisor, setSupervisor]   = useState("");
  const [remark, setRemark]           = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // reset เมื่อเปิด
  useEffect(() => {
    if (open) {
      setError(null);
      setStorageType("");
      setHistamine("");
      setSupervisor("");
      setRemark("");
      setFieldErrors({});
    }
  }, [open]);

  const validate = () => {
    const errs = {};
    if (!storageType) errs.storageType = "กรุณาเลือกวัตถุประสงค์การจัดเก็บ";
    if (!histamine.trim()) errs.histamine = "กรุณากรอกผล Histamine";
    if (!supervisor.trim()) errs.supervisor = "กรุณากรอกชื่อหัวหน้าผู้ทำการจัดส่งคืน";
    return errs;
  };

  const handleConfirm = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }

    try {
      setIsLoading(true);
      setError(null);

      const payload = {
        mat:          material,
        batch:        batch,
        hu:           parseInt(hu, 10),
        storage_type: storageType,
        histamine:    histamine,
        supervisor:   supervisor,
        remark:       remark.trim() || null,
      };

      console.log("📤 Sending payload:", payload);

      const response = await axios.post(
        `${API_URL}/api/prep/checkout/sap`,
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
        maxWidth="sm"
        fullWidth
      >
        <ModalContent>
          {/* Header */}
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: "#ff0000" }}>
            ยืนยันการ Time Stamp เพื่อบันทึกเวลาส่งคืนวัตถุดิบ
          </Typography>

          <Divider sx={{ mb: 2.5 }} />

          {/* Info */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
            <InfoRow label="Material" value={material} />
            <InfoRow label="Batch"    value={batch} />
            <InfoRow label="HU"       value={hu} />
          </Box>

          <Divider sx={{ mb: 2.5 }} />

          {/* Form Fields */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 3 }}>

            {/* วัตถุประสงค์การจัดเก็บ */}
            <FormControl size="small" error={!!fieldErrors.storageType}>
              <InputLabel sx={{ fontSize: "13px" }}>วัตถุประสงค์การจัดเก็บ *</InputLabel>
              <Select
                value={storageType}
                label="วัตถุประสงค์การจัดเก็บ *"
                onChange={(e) => { setStorageType(e.target.value); setFieldErrors(p => ({ ...p, storageType: undefined })); }}
                sx={{ fontSize: "13px" }}
              >
                {STORAGE_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt} sx={{ fontSize: "13px" }}>{opt}</MenuItem>
                ))}
              </Select>
              {fieldErrors.storageType && <FormHelperText>{fieldErrors.storageType}</FormHelperText>}
            </FormControl>

            {/* ผล Histamine */}
            <TextField
              size="small"
              label="ผล Histamine *"
              value={histamine}
              onChange={(e) => { setHistamine(e.target.value); setFieldErrors(p => ({ ...p, histamine: undefined })); }}
              error={!!fieldErrors.histamine}
              helperText={fieldErrors.histamine}
              inputProps={{ inputMode: "decimal" }}
              sx={{ "& .MuiInputBase-input": { fontSize: "13px" }, "& .MuiInputLabel-root": { fontSize: "13px" } }}
            />

            {/* ชื่อหัวหน้า */}
            <TextField
              size="small"
              label="ชื่อหัวหน้าผู้ทำการจัดส่งคืน *"
              value={supervisor}
              onChange={(e) => { setSupervisor(e.target.value); setFieldErrors(p => ({ ...p, supervisor: undefined })); }}
              error={!!fieldErrors.supervisor}
              helperText={fieldErrors.supervisor}
              sx={{ "& .MuiInputBase-input": { fontSize: "13px" }, "& .MuiInputLabel-root": { fontSize: "13px" } }}
            />

            {/* หมายเหตุ */}
            <TextField
              size="small"
              label="หมายเหตุ"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              multiline
              rows={2}
              inputProps={{ maxLength: 300 }}
              helperText={`${remark.length}/300`}
              sx={{ "& .MuiInputBase-input": { fontSize: "13px" }, "& .MuiInputLabel-root": { fontSize: "13px" } }}
            />

          </Box>

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