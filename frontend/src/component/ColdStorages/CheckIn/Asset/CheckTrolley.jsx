import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  Box,
  Typography,
  Divider,
} from "@mui/material";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const CheckTrolley = ({ open, onClose, trolleyData, selectedCsId }) => {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!API_URL) return;

    const newSocket = io(API_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () =>
      console.log("✅ Socket connected:", newSocket.id)
    );
    newSocket.on("disconnect", () =>
      console.warn("⚠️ Socket disconnected.")
    );

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ✅ ไม่ต้องเรียก API อีก — ScanTrolley เรียกไปแล้ว
  // แค่แจ้ง socket และปิด Modal
  const handleConfirm = () => {
    const tro_id = trolleyData?.inputValues?.[0];
    const slot_id = trolleyData?.trolleyData?.slot_id;

    console.log("✅ Confirmed check-in:", {
      tro_id,
      cs_id: selectedCsId,
      slot_id,
    });

    // แจ้ง socket ให้ refresh
    socket?.emit("dataUpdated", {
      tro_id,
      cs_id: selectedCsId,
      slot_id,
    });

    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  const tro_id = trolleyData?.inputValues?.[0] || "-";
  const slot_id = trolleyData?.trolleyData?.slot_id || "-";
  const message = trolleyData?.trolleyData?.message || "";

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason !== "backdropClick") onClose();
      }}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle
        sx={{ fontSize: "18px", fontWeight: 500, color: "#545454" }}
      >
        รับเข้าห้องเย็นสำเร็จ ✅
      </DialogTitle>

      <DialogContent>
        <Divider sx={{ mb: 2 }} />
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            fontSize: "15px",
            color: "#555",
          }}
        >
          {/* Success Badge */}
          <Box
            sx={{
              bgcolor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "10px",
              px: 2,
              py: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Typography sx={{ fontSize: "20px" }}>✅</Typography>
            <Typography
              sx={{ fontSize: "14px", fontWeight: 600, color: "#16a34a" }}
            >
              {message || "รับเข้าห้องเย็นสำเร็จ"}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Typography fontWeight={500}>ป้ายทะเบียน:</Typography>
            <Typography color="rgba(0,0,0,0.6)">{tro_id}</Typography>
          </Box>

          {/* <Box sx={{ display: "flex", gap: 1 }}>
            <Typography fontWeight={500}>ห้องเย็น :</Typography>
            <Typography color="rgba(0,0,0,0.6)">
              {selectedCsId ?? "-"}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Typography fontWeight={500}>ช่องจอดที่ได้รับ:</Typography>
            <Typography
              sx={{ fontWeight: 700, color: "#2563eb" }}
            >
              {slot_id}
            </Typography>
          </Box> */}

          <Divider />
        </Box>
      </DialogContent>

      <Box
        sx={{
          px: 2.25,
          pb: 2.25,
          display: "flex",
          justifyContent: "flex-end",
          gap: 1,
        }}
      >
        <Button
          fullWidth
          variant="contained"
          startIcon={<CheckCircleIcon />}
          onClick={handleConfirm}
          sx={{ backgroundColor: "#41a2e6", color: "#fff" }}
        >
          ตกลง
        </Button>
      </Box>
    </Dialog>
  );
};

export default CheckTrolley;