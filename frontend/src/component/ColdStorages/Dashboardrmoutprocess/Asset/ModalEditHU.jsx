import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogTitle,
  Box, Typography, Divider, Button, Stack, TextField
} from "@mui/material";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import SaveIcon from "@mui/icons-material/SaveOutlined";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const ModalEditHU = ({ open, onClose, data, onSuccess }) => {
  const [newHu, setNewHu] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && data) {
      setNewHu(data.hu != null ? String(data.hu) : "");
      setNewWeight(data.weight != null ? String(data.weight) : "");
      setError("");
    }
  }, [open, data]);

  if (!data) return null;

  const handleHuChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setNewHu(val);
    setError("");
  };

  const handleWeightChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setNewWeight(val);
    setError("");
  };

  const handleSubmit = async () => {
    if (!newHu || newHu.length === 0) {
      setError("กรุณากรอก New HU");
      return;
    }
    if (!newWeight || newWeight.length === 0) {
      setError("กรุณากรอก New Weight");
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const payload = {
        old_hu: data.hu,
        new_hu: parseInt(newHu, 10),
        new_weight: parseInt(newWeight, 10),
        mat: data.mat,
        batch: data.batch,
        sap_re_id: data.sap_re_id,
      };

      const response = await axios.put(
        `${API_URL}/api/coldstorages/sap/update-hu`,
        payload
      );

      if (response.data?.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(response.data?.error || "เกิดข้อผิดพลาด");
      }
    } catch (err) {
      console.error("ModalEditHU error:", err);
      setError(err.response?.data?.error || "ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <SaveIcon sx={{ color: "#1565C0" }} />
          <Typography variant="h6" sx={{ fontSize: "16px", color: "#1565C0", fontWeight: 700 }}>
            อัปเดต HU
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Divider sx={{ mb: 2 }} />

        {/* Info */}
        <Stack spacing={1} sx={{ bgcolor: "#f5f5f5", p: 2, borderRadius: 1, mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="caption" color="text.secondary">Material:</Typography>
            <Typography variant="body2" fontWeight={600}>{data.mat || "-"}</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="caption" color="text.secondary">Batch:</Typography>
            <Typography variant="body2" fontWeight={600}>{data.batch || "-"}</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="caption" color="text.secondary">HU ปัจจุบัน:</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ color: "#E65100" }}>
              {data.hu ?? "-"}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="caption" color="text.secondary">Weight ปัจจุบัน:</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ color: "#E65100" }}>
              {data.weight ?? "-"}
            </Typography>
          </Box>
        </Stack>

        {/* New HU Input */}
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          New HU <span style={{ color: "#E74A3B" }}>*</span>
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="กรอก HU ใหม่ (ตัวเลขสูงสุด 10 หลัก)"
          value={newHu}
          onChange={handleHuChange}
          inputProps={{ inputMode: "numeric", maxLength: 10 }}
          error={!!error && !newHu}
          sx={{
            mb: 2,
            "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: "14px" },
          }}
        />

        {/* New Weight Input */}
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          New Weight <span style={{ color: "#E74A3B" }}>*</span>
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="กรอก Weight ใหม่"
          value={newWeight}
          onChange={handleWeightChange}
          inputProps={{ inputMode: "numeric", maxLength: 10 }}
          error={!!error && !newWeight}
          helperText={error}
          sx={{
            mb: 2,
            "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: "14px" },
          }}
        />

        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={onClose}
            disabled={isSubmitting}
            sx={{ borderRadius: "8px", borderColor: "#9e9e9e", color: "#555" }}
          >
            ยกเลิก
          </Button>
          <Button
            fullWidth
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSubmit}
            disabled={isSubmitting || !newHu || !newWeight}
            sx={{ borderRadius: "8px", bgcolor: "#1565C0", "&:hover": { bgcolor: "#0d47a1" } }}
          >
            {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ModalEditHU;
