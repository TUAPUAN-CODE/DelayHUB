import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  Box,
  Typography,
  Divider
} from "@mui/material";

import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import axios from "axios";
const API_URL = import.meta.env.VITE_API_URL;

const CheckTrolley = ({ open, onClose, trolleyData, selectedSlot, selectedOption }) => {
  // ฟังก์ชันในการยืนยันและส่งข้อมูลไปยัง API
  const socketRef = useRef(null);


  useEffect(() => {
    if (!API_URL) {
      console.error("❌ API_URL is not defined.");
      return;
    }

    // เชื่อมต่อ Socket.IO ไปที่ API_URL
    const newSocket = io(API_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5, // จำนวนครั้งที่ลอง reconnect
      reconnectionDelay: 1000, // หน่วงเวลา 1 วินาทีระหว่างการ reconnect
      autoConnect: true
    });
    socketRef.current = newSocket;
    setSocket(newSocket);
    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
    });

    newSocket.on("disconnect", () => {
      console.warn("⚠️ Socket disconnected.");
    });

    setSocket(newSocket);

    // Cleanup function
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);



  const [socket, setSocket] = useState(null);
  const handleConfirm = async () => {
    console.log("selectedSlot:", selectedSlot);  // ตรวจสอบ selectedSlot
    console.log("trolleyData:", trolleyData);    // ตรวจสอบ trolleyData

    // สร้างข้อมูลที่ต้องการส่ง
    const dataToSend = {
      cs_id: selectedSlot?.cs_id,
      slot_id: selectedSlot?.slot_id,
      selectedOption: selectedOption,
      tro_id: trolleyData?.inputValues?.join(", ") || "-",  // เพิ่ม inputValues ในข้อมูลที่จะส่ง
    };

    // ตรวจสอบว่า dataToSend เต็มหรือไม่
    console.log("Data to send:", dataToSend);
    onClose();
    // เช็คว่า fields ทั้งหมดมีค่า
    if (!dataToSend.cs_id || !dataToSend.slot_id || !dataToSend.tro_id || !dataToSend.selectedOption) {
      console.error("Missing required fields:", dataToSend);
      return; // หากมีฟิลด์ที่หายไปไม่ส่งข้อมูล
    }
    console.log("📤 Sending to API:", `${API_URL}/api/cold/checkin/update/Trolley`);
console.log("📤 Payload:", JSON.stringify(dataToSend, null, 2));

try {
  const response = await fetch(`${API_URL}/api/cold/checkin/update/Trolley`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dataToSend),
  });
  
  const data = await response.json();
  
  if (response.ok) {
  console.log("✅ Data submitted successfully:", data);
  socket.emit("reserveSlot", {
    slot_id: data.slot_id,
    cs_id: data.cs_id,
  });
} else {
  console.error("❌ Error submitting trolley data:", data);

  if (response.status === 400) {
    alert("ไม่สามารถดำเนินการได้เนื่องจากเลยเวลาดำเนินการ 5 นาที");
  } else {
    const errorMessage = data.message || "เกิดข้อผิดพลาดในการส่งข้อมูล";
    alert(errorMessage);
  }

  return; 

  }
} catch (error) {
  console.error("❌ Error submitting trolley data:", error);
  
  const errorMessage = "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้";
  alert(errorMessage);
  
}
  };

 const handleClose = async () => {
  const troId = trolleyData?.inputValues?.[0]; // ใช้ trolleyData แทน data

    if (troId) {
      const success = await returnreserveTrolley(troId);
      if (!success) {
        setErrorDialogOpen(true);
        return;
      }
    }
    onClose();
  };

    const returnreserveTrolley = async (tro_id) => {
  try {
    const response = await axios.post(`${API_URL}/api/re/reserveTrolley`, {
      tro_id: tro_id,
      selectedOption: selectedOption  
    });
    return response.data.success;
  } catch (error) {
    console.error(error);
    return false;
  }
};

  return (
    <Dialog open={open} onClose={(e, reason) => {
      if (reason === 'backdropClick') return;
      onClose();
    }}
      fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontSize: "18px", fontWeight: 500, color: "#545454" }}>
        ตรวจสอบข้อมูลรถเข็น
      </DialogTitle>
      <DialogContent>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "15px", color: "#555" }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Typography fontWeight={500}>ป้ายทะเบียน:</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">
              {trolleyData?.inputValues?.join(", ") || "-"}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Typography fontWeight={500}>ประเภทการรับเข้า:</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">{selectedOption || "-"}</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 0 }}>
            <Typography fontWeight={500}>ข้อมูลช่องจอด:</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">
              {selectedSlot
                ? `ห้อง : ${selectedSlot.cs_id} ช่องจอด : ${selectedSlot.slot_id}`
                : "ข้อมูลไม่สมบูรณ์"}
            </Typography>
          </Box>
          <Divider />
        </Box>
      </DialogContent>

      <Box sx={{ paddingLeft: "18px", paddingRight: "18px", paddingBottom: "18px", display: "flex", justifyContent: "space-between" }}>
        <Button
          style={{ backgroundColor: "#E74A3B", color: "#fff" }}
          variant="contained"
          startIcon={<CancelIcon />}
          onClick={handleClose}
        >
          ยกเลิก
        </Button>
        <Button
          style={{ backgroundColor: "#41a2e6", color: "#fff" }}
          variant="contained"
          startIcon={<CheckCircleIcon />}
          onClick={handleConfirm} // เรียกฟังก์ชัน handleConfirm
        >
          ยืนยัน
        </Button>
      </Box>
    </Dialog>
  );
};

export default CheckTrolley;
