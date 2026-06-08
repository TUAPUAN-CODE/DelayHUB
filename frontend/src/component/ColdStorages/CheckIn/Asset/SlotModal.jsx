import React from "react";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import {
  Button,
  Box,
  Divider,
  Typography,
  Stack,
} from "@mui/material";

const SlotModal = ({ slot, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div style={{ color: "#000" }} className="bg-white p-6 rounded-lg shadow-lg w-96">

        <Typography variant="h6" fontWeight={600} mb={0.5}>
          ยืนยันการรับเข้า
        </Typography>

        <Divider sx={{ my: 1.5 }} />

        {/* ข้อมูลช่องจอด */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: 2 }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Typography fontWeight={500} fontSize="14px" color="#555">ห้อง:</Typography>
            <Typography fontSize="14px" color="rgba(0,0,0,0.6)">
              {slot?.cs_id ?? "-"}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Typography fontWeight={500} fontSize="14px" color="#555">ช่องจอด:</Typography>
            <Typography fontSize="14px" color="rgba(0,0,0,0.6)">
              {slot?.slot_id ?? "-"}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" justifyContent="space-between" gap={1}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<CancelIcon />}
            onClick={onClose}
            sx={{ backgroundColor: "#E74A3B", color: "#fff" }}
          >
            ยกเลิก
          </Button>
          <Button
            fullWidth
            variant="contained"
            startIcon={<CheckCircleIcon />}
            onClick={() => onConfirm(slot)}
            sx={{ backgroundColor: "#41a2e6", color: "#fff" }}
          >
            ยืนยัน
          </Button>
        </Stack>

      </div>
    </div>
  );
};

export default SlotModal;