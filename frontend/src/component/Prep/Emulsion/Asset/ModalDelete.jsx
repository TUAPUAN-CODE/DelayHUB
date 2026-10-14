import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Divider,
  Button,
  Stack
} from "@mui/material";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import axios from "axios";
axios.defaults.withCredentials = true; 
import ModalAlert from "../../../../Popup/AlertSuccess";

const API_URL = import.meta.env.VITE_API_URL;

const ModalDelete = ({ open, onClose, mat, mat_name, batch, production,rmfemu_id, onSuccess }) => {
  const [confirm, setConfirm] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
  if (confirm) {
    const handleConfirm = async () => {
      try {
        // ✅ แสดง payload ก่อนส่ง
        const payload = { rmfemu_id: rmfemu_id };
        console.log("🚀 Sending payload:", payload);

        const response = await axios.post(`${API_URL}/api/delete/rmforemu`, payload);

        if (response.data.success) {
          console.log("Successfully updated production status:", response.data.message);
          onSuccess();
          onClose();
          setShowAlert(true);
        } else {
          console.error("Error:", response.data.message);
        }
      } catch (error) {
        console.error("API request failed:", error);
      }
      setConfirm(false);
    };
    handleConfirm();
  }
}, [confirm, rmfemu_id, onClose, onSuccess]);


  const handleAlertClose = () => {
    setShowAlert(false);
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={(e, reason) => {
          if (reason === 'backdropClick') return;
          onClose();
        }} 
        fullWidth 
        maxWidth="xs"
      >
        <DialogContent>
          <Typography variant="h6" style={{ fontSize: "18px", color: "#6B7489" }} mb={2}>
            กรุณาตรวจสอบข้อมูลก่อนลบรายการ
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Stack spacing={1}>
            <Typography color="rgba(0, 0, 0, 0.6)">Mat: {mat}</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">Material Name: {mat_name}</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">Batch: {batch}</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">
  rmfemu_id: {rmfemu_id ?? "ไม่มีข้อมูล"}
</Typography>

          </Stack>

          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Button
              variant="contained"
              startIcon={<CancelIcon />}
              style={{ backgroundColor: "#E5484D", color: "#fff" }}
              onClick={onClose}
            >
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              startIcon={<CheckCircleIcon />}
              style={{ backgroundColor: "#1552F0", color: "#fff" }}
              onClick={() => setConfirm(true)}
            >
              ยืนยัน
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
      <ModalAlert open={showAlert} onClose={handleAlertClose} />
    </>
  );
};

export default ModalDelete;