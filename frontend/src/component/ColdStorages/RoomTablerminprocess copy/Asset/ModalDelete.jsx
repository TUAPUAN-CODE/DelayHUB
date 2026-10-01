import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
  Divider,
  Button,
  Stack
} from "@mui/material";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const ModalDelete = ({ open, onClose, data, onSuccess }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    console.log("🔍 ModalDelete Props:", { open, data });
  }, [open, data]);

  if (!data) return null;

  const handleUpdate = async () => {
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      const url = `${API_URL}/api/coldstorage/update/${data.mapping_id}`;
      const payload = {
        mapping_id: data.mapping_id,
        weight_RM: data.weight_RM,
        cooked_date: data.cooked_date,
        come_cold_date: data.come_cold_date,
        out_cold_date: data.out_cold_date,
      };

      console.log("🌐 PUT URL:", url);
      console.log("✏️ Updating with payload:", payload);

      const response = await axios.put(url, payload);

      console.log("📦 Response status:", response.status);
      console.log("📦 Response data:", response.data);

      if (response.data.success) {
        console.log("✅ Update successful");
        onSuccess();
        onClose();
      } else {
        console.error("❌ Update failed:", response.data.message);
        alert("เกิดข้อผิดพลาด: " + response.data.message);
      }

    } catch (error) {
      if (error.response) {
        // Server ตอบกลับมาแต่เป็น error (4xx, 5xx)
        console.error("❌ Server error status:", error.response.status);
        console.error("❌ Server error data:", error.response.data);
        alert(`Server error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        // ส่ง request ออกไปแล้วแต่ไม่ได้รับ response เลย (network/CORS/timeout)
        console.error("❌ No response received:", error.request);
        alert("ไม่ได้รับการตอบกลับจาก server — ตรวจสอบ network หรือ CORS");
      } else {
        console.error("❌ Request setup error:", error.message);
        alert("ไม่สามารถส่ง request ได้: " + error.message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <DeleteIcon color="error" />
          <Typography variant="h6" style={{ fontSize: "18px", color: "#E74A3B" }}>
            ยืนยันการลบข้อมูล
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Stack spacing={1.5} sx={{ bgcolor: "#f5f5f5", p: 2, borderRadius: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Material:</Typography>
            <Typography variant="body2" fontWeight={500}>{data.mat || "-"}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Material Name:</Typography>
            <Typography variant="body2" fontWeight={500}>{data.mat_name || "-"}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Batch:</Typography>
            <Typography variant="body2" fontWeight={500}>{data.batch || "-"}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Production:</Typography>
            <Typography variant="body2" fontWeight={500}>{data.production || "-"}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Trolley ID:</Typography>
            <Typography variant="body2" fontWeight={500}>{data.tro_id || "-"}</Typography>
          </Box>
          {/* แสดง mapping_id เพื่อ debug */}
          <Box>
            <Typography variant="caption" color="text.secondary">Mapping ID:</Typography>
            <Typography variant="body2" fontWeight={500} color="primary">
              {data.mapping_id ?? "⚠️ ไม่มี mapping_id!"}
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            style={{ borderColor: "#6c757d", color: "#6c757d", flex: 1 }}
            onClick={onClose}
            disabled={isDeleting}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            startIcon={<DeleteIcon />}
            style={{ backgroundColor: "#E74A3B", color: "#fff", flex: 1 }}
            onClick={handleUpdate}
            disabled={isDeleting}
          >
            {isDeleting ? "กำลังดำเนินการ..." : "ยืนยันการลบ"}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ModalDelete;