import React, { useState,useEffect } from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Paper
} from "@mui/material";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import ModalAlert from "../../../../Popup/AlertSuccess";
import axios from 'axios';
import io from 'socket.io-client';
const API_URL = import.meta.env.VITE_API_URL;

const ModalEditPD = ({ open, onClose, data, onSuccess }) => {
  const { tro_id, production, total_weight, tray_count } = data || {};
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [socket, setSocket] = useState(null);

  
  useEffect(() => {
    if (!API_URL) {
      console.error("❌ API_URL is not defined.");
      return;
    }

    const newSocket = io(API_URL, {
      transports: ["websocket"], // บังคับให้ใช้ WebSocket
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
    });
   newSocket.emit("joinRoom", { room: "Pack" });
    newSocket.on("disconnect", () => {
      console.warn("⚠️ Socket disconnected.");
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, []);

  const handleConfirm = async () => {

    
    setLoading(true);
    const payload = {
      tro_id: tro_id
    };

    try {
      const response = await axios.post(`${API_URL}/api/pack/input/Trolley`, payload);
      if (response.status === 200) {
        console.log("Trolley received successfully:", response.data);
      
        onSuccess();
        onClose();
        setShowAlert(true);
      } else {
        console.error("Error while receiving trolley:", response.status);
      }
    } catch (error) {
      console.error("Error during API call:", error);
    } finally {
     
      setLoading(false);
    }
    if (socket) {
      console.log("📢 Emit updateFetch event");
      io.to("Pack").emit("updatePack", "hello");

  }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={(e, reason) => {
          if (reason === "backdropClick") return;
          onClose();
        }}
        fullWidth
        maxWidth="sm"
        sx={{ "& .MuiDialog-paper": { borderRadius: "8px" } }}
      >
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontSize: "20px", color: "#1552F0", mb: 3, fontWeight: "bold" }}>
            กรุณาตรวจสอบข้อมูลก่อนรับวัตถุดิบ
          </Typography>

          {!data ? (
            <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
              <Typography>ไม่พบข้อมูลรถเข็น</Typography>
            </Box>
          ) : (
            <Box sx={{ mb: 3 }}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: "8px", backgroundColor: "#F5F8FF" }}>
                <Typography variant="h6" sx={{ fontSize: "18px", color: "#6B7489", mb: 2 }}>
                  ข้อมูลรถเข็น {tro_id}
                </Typography>
                
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #E3E8F2", pb: 1 }}>
                    <Typography variant="body1" sx={{ color: "#6B7489", fontWeight: "medium" }}>ป้ายทะเบียน</Typography>
                    <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                      {tro_id || "-"}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #E3E8F2", pb: 1 }}>
                    <Typography variant="body1" sx={{ color: "#6B7489", fontWeight: "medium" }}>แผนการผลิต</Typography>
                    <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                      {production || "-"}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #E3E8F2", pb: 1 }}>
                    <Typography variant="body1" sx={{ color: "#6B7489", fontWeight: "medium" }}>น้ำหนัก/คัน</Typography>
                    <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                      {total_weight ? `${total_weight} kg` : "-"}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body1" sx={{ color: "#6B7489", fontWeight: "medium" }}>จำนวนถาด/คัน</Typography>
                    <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                      {tray_count || "0"}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          )}

          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}>
            <Button
              variant="contained"
              startIcon={<CancelIcon />}
              sx={{ 
                backgroundColor: "#E5484D", 
                color: "#fff",
                '&:hover': {
                  backgroundColor: "#d32f2f"
                }
              }}
              onClick={onClose}
            >
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              startIcon={<CheckCircleIcon />}
              sx={{ 
                backgroundColor: "#1552F0", 
                color: "#fff",
                '&:hover': {
                  backgroundColor: "#3d8bc9"
                }
              }}
              onClick={handleConfirm}
              disabled={loading || !data}
            >
              ยืนยันรับเข้า
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
      <ModalAlert open={showAlert} onClose={() => setShowAlert(false)} />
    </>
  );
};

export default ModalEditPD;