import React, { useState, useEffect } from "react";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InfoIcon from '@mui/icons-material/Info';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ScaleIcon from '@mui/icons-material/Scale';
import CategoryIcon from '@mui/icons-material/Category';
import BugReportIcon from '@mui/icons-material/BugReport';

import {
  Dialog,
  Stack,
  DialogContent,
  Button,
  Box,
  Divider,
  Typography,
  Chip,
  Paper,
  Alert,
  Grid,
  Fade,
  AppBar,
  Toolbar,
  IconButton,
  CircularProgress,
  Tooltip,
  Collapse
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import { io } from "socket.io-client";
const API_URL = import.meta.env.VITE_API_URL;

const MoveRawMatModal = ({ data, slot, onClose, onBack }) => {
  console.log("MoveRawMatModal - ข้อมูลที่ได้รับ:", data, slot);

  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [requestData, setRequestData] = useState(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);
  const [socket, setSocket] = useState(null);
  // รีเซ็ตค่าเมื่อ Modal เปิด
  useEffect(() => {
    setShowSuccess(false);
    setErrorMessage("");
    setIsProcessing(false);
    setRequestData(null);
    setApiResponse(null);
    setShowDebugInfo(false);
  }, []);
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

    newSocket.on("disconnect", () => {
      console.warn("⚠️ Socket disconnected.");
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, []);
  const handleConfirm = () => {
    console.log("MoveRawMatModal - ยืนยันการย้าย");
    setIsProcessing(true);
    setErrorMessage("");

    // 1. ตรวจสอบและแปลงค่าน้ำหนัก
    const weightNum = parseFloat(data?.weight) || 0;

    // 2. สร้างข้อมูลสำหรับส่งไปยัง API
    const apiData = {
      tro_id: String(data?.oldTrolleyId || data?.tro || "").trim(),
      new_tro_id: String(slot?.tro_id || "").trim(),
      weight: parseFloat(data?.weight) || 0,
      slot_id: String(data?.slot_id || "").trim(),

      // สำหรับวัตถุดิบปกติ
      rawmat: String(data?.mat || data?.rawmat || "").trim(),
      rmfp_id: String(data?.rmfp_id || "").trim(),

      // สำหรับวัตถุดิบผสม
      mix_code: String(data?.mix_code || "").trim(),
      mapping_id: String(data?.mapping_id || "").trim(),
      isMixed: data?.isMixed || false
    };

    // 3. จัดเก็บข้อมูลที่ส่ง
    setRequestData(apiData);

    console.log("MoveRawMatModal - ข้อมูลที่จะส่งไปยัง API:", apiData);

    // 4. ตรวจสอบข้อมูลก่อนส่งอย่างละเอียด
    if (!apiData.tro_id) {
      setErrorMessage("ไม่พบข้อมูลรถเข็นต้นทาง");
      setIsProcessing(false);
      return;
    }

    if (!apiData.new_tro_id) {
      setErrorMessage("ไม่พบข้อมูลรถเข็นปลายทาง");
      setIsProcessing(false);
      return;
    }

    if (!apiData.weight || apiData.weight <= 0) {
      setErrorMessage("น้ำหนักต้องมากกว่า 0");
      setIsProcessing(false);
      return;
    }

    if (!apiData.slot_id) {
      setErrorMessage("ไม่พบข้อมูลช่องจอด");
      setIsProcessing(false);
      return;
    }

    // ตรวจสอบข้อมูลวัตถุดิบ
    if (apiData.isMixed) {
      if (!apiData.mix_code) {
        setErrorMessage("ไม่พบข้อมูลรหัสวัตถุดิบผสม");
        setIsProcessing(false);
        return;
      }
      if (!apiData.mapping_id) {
        setErrorMessage("ไม่พบข้อมูล Mapping ID สำหรับวัตถุดิบผสม");
        setIsProcessing(false);
        return;
      }
    } else {
      if (!apiData.rawmat) {
        setErrorMessage("ไม่พบข้อมูลรหัสวัตถุดิบ");
        setIsProcessing(false);
        return;
      }
      if (!apiData.rmfp_id) {
        setErrorMessage("ไม่พบข้อมูลรหัสวัตถุดิบ (RMFP ID)");
        setIsProcessing(false);
        return;
      }
    }
    // 5. เพิ่ม timeout สำหรับการเรียก API
    const apiTimeout = setTimeout(() => {
      setErrorMessage("การเชื่อมต่อกับเซิร์ฟเวอร์ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง");
      setIsProcessing(false);
    }, 15000); // 15 วินาที

    // 6. เรียกใช้ API
    fetch(`${API_URL}/api/coldstorage/moveRawmatintolley`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(apiData)
    })
      .then(response => {
        clearTimeout(apiTimeout);

        // อ่านข้อมูล response และเก็บไว้
        return response.json().then(data => {
          if (!response.ok) {
            // เก็บข้อมูล response ไว้แสดงในกรณีเกิดข้อผิดพลาด
            setApiResponse({
              status: response.status,
              statusText: response.statusText,
              data: data
            });
            throw new Error(data.error || data.message || data.details || `HTTP error! Status: ${response.status}`);
          }
          return data;
        });
      })
      .then(result => {
        console.log("MoveRawMatModal - API ตอบกลับ:", result);
        setShowSuccess(true);
        setApiResponse({
          status: 200,
          statusText: "OK",
          data: result
        });

        // 7. สร้างข้อมูลเพื่อส่งกลับไปยัง SlotModal
        const moveData = {
          material: {
            mat: data?.mat || "",
            mat_name: data?.mat_name || "",
            batch: data?.batch || "",
            weight: data?.weight || 0,
            production: data?.production || data?.แผนการผลิต || "",
            rmfp_id: data?.rmfp_id || ""
          },
          moveType: data?.TypeColdMove || "",
          destination: data?.ColdMove || "",
          sourceTrolley: {
            id: data?.oldTrolleyId || data?.tro || "",
            cs_id: data?.cs_id || "",
            slot_id: data?.slot_id || ""
          },
          destinationTrolley: {
            id: slot?.tro_id || "",
            cs_id: slot?.cs_id || "",
            slot_id: slot?.slot_id || ""
          },
          timestamp: new Date().toISOString(),
          apiResponse: result
        };

        // 8. ปิด Modal หลังจากแสดงข้อความสำเร็จ
        setTimeout(() => {
          if (onClose) {
            if (socket) {
              console.log("📢 Emit updateFetch event");
              socket.emit("updateFetch", "hello");
            }
            console.log("MoveRawMatModal - ส่งข้อมูลกลับไปยัง SlotModal:", { success: true, data: moveData });
            onClose({ success: true, data: moveData });
          }
        }, 1500);
      })
      .catch(error => {
        clearTimeout(apiTimeout);
        console.error("MoveRawMatModal - เกิดข้อผิดพลาดในการเรียก API:", error);

        // 9. แสดงข้อความแจ้งเตือนที่ชัดเจนมากขึ้น
        let errorMsg = "เกิดข้อผิดพลาดในการย้ายวัตถุดิบ";

        // 10. แปลข้อความข้อผิดพลาดเป็นภาษาไทย
        if (error.message.includes("Weight must be greater than 0") ||
          error.message.includes("Weight must be a positive number")) {
          errorMsg = "น้ำหนักต้องมากกว่า 0";
        } else if (error.message.includes("Not enough weight in the trolley")) {
          errorMsg = "น้ำหนักในรถเข็นไม่เพียงพอ";
        } else if (error.message.includes("Not enough trays in the trolley")) {
          errorMsg = "จำนวนถาดในรถเข็นไม่เพียงพอ";
        } else if (error.message.includes("Raw material not found")) {
          errorMsg = "ไม่พบข้อมูลวัตถุดิบในรถเข็นต้นทาง";
        } else if (error.message.includes("Invalid weight per tray")) {
          errorMsg = "ค่าน้ำหนักต่อถาดไม่ถูกต้อง";
        } else if (error.message.includes("Destination trolley not found")) {
          errorMsg = "ไม่พบข้อมูลรถเข็นปลายทาง";
        } else if (error.message.includes("Database connection failed")) {
          errorMsg = "ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้";
        } else if (error.message.includes("Missing required fields")) {
          errorMsg = "ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบข้อมูลที่ส่ง";
        } else if (error.message.includes("Transaction failed")) {
          errorMsg = "เกิดข้อผิดพลาดระหว่างการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง";
        } else {
          errorMsg = `เกิดข้อผิดพลาด: ${error.message}`;
        }

        setErrorMessage(errorMsg);
        setIsProcessing(false);
      });
  };

  const handleBack = () => {
    console.log("MoveRawMatModal - กลับไปเลือกรถเข็นใหม่");
    if (onBack) {
      onBack(data); // ส่งข้อมูลปัจจุบันกลับไป
    } else {
      // ถ้าไม่มี onBack function ให้ปิด modal แทน
      onClose ? onClose({ success: false, action: 'back' }) : null;
    }
  };

  // ฟังก์ชันสำหรับแสดงข้อมูล
  const displayData = (label, value, defaultValue = "ไม่มีข้อมูล") => {
    return (
      <Typography color="rgba(0, 0, 0, 0.7)" sx={{ mb: 1 }}>
        <strong>{label}:</strong> {value || defaultValue}
      </Typography>
    );
  };

  return (
    <Dialog
      open={true}
      onClose={() => {
        if (isProcessing || showSuccess) return; // ป้องกันการปิดหากกำลังประมวลผล
        console.log("MoveRawMatModal - ปิด modal");
        onClose ? onClose({ success: false }) : null;
      }}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: { borderRadius: '10px', overflow: 'hidden' }
      }}
    >
      {/* AppBar Header */}
      <AppBar position="relative" sx={{ bgcolor: '#1552F0' }}>
        <Toolbar sx={{ minHeight: '64px', px: 2 }}>
          <LocalShippingIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            ยืนยันการย้ายวัตถุดิบ
          </Typography>
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => {
              if (isProcessing || showSuccess) return; // ป้องกันการปิดหากกำลังประมวลผล
              console.log("MoveRawMatModal - คลิกปุ่มปิด");
              onClose ? onClose({ success: false }) : null;
            }}
            aria-label="close"
            disabled={isProcessing || showSuccess}
          >
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* ข้อความแจ้งเตือน */}
      {errorMessage && (
        <Alert
          severity="error"
          sx={{
            m: 2,
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}
          onClose={() => setErrorMessage("")}
          action={
            <IconButton
              aria-label="debug info"
              color="inherit"
              size="small"
              onClick={() => setShowDebugInfo(!showDebugInfo)}
            >
              <BugReportIcon fontSize="inherit" />
            </IconButton>
          }
        >
          <Typography variant="body1">{errorMessage}</Typography>

          {/* แสดงข้อมูลที่ส่งไป API กรณีเกิดข้อผิดพลาด */}
          <Collapse in={showDebugInfo}>
            <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: '4px', fontSize: '0.85rem' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>ข้อมูลที่ส่งไป API:</Typography>
              <Box component="pre" sx={{ mt: 0.5, fontSize: '0.75rem', overflow: 'auto', maxHeight: '100px' }}>
                {JSON.stringify(requestData, null, 2)}
              </Box>

              {apiResponse && (
                <>
                  <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mt: 1 }}>
                    API Response (Status: {apiResponse.status} {apiResponse.statusText}):
                  </Typography>
                  <Box component="pre" sx={{ mt: 0.5, fontSize: '0.75rem', overflow: 'auto', maxHeight: '100px' }}>
                    {JSON.stringify(apiResponse.data, null, 2)}
                  </Box>
                </>
              )}
            </Box>
          </Collapse>
        </Alert>
      )}

      {/* ข้อความแจ้งสำเร็จ */}
      {showSuccess && (
        <Fade in={showSuccess}>
          <Alert
            severity="success"
            sx={{
              m: 2,
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}
          >
            <Typography variant="body1" fontWeight={500}>
              ย้ายวัตถุดิบสำเร็จ กำลังบันทึกข้อมูล...
            </Typography>
          </Alert>
        </Fade>
      )}

      <DialogContent sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* ข้อมูลการย้าย */}
          <Grid item xs={12}>
            <Paper
              elevation={1}
              sx={{
                p: 2,
                borderRadius: '8px',
                border: '1px solid #E3E8F2',
                mb: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <InfoIcon sx={{ mr: 1, color: '#1552F0' }} />
                <Typography variant="h6" sx={{ fontSize: '18px', color: '#1552F0', fontWeight: 600 }}>
                  ข้อมูลการย้ายวัตถุดิบ
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  {displayData("รหัสวัตถุดิบ", data?.mat||data?.mix_code)}
                  {displayData("ชื่อวัตถุดิบ", data?.mat_name||`Mixed: ${data?.mix_code}`)}
                  {displayData("Batch", data?.batch)}
                  {displayData("แผนการผลิต", data?.production || data?.แผนการผลิต)}
                  {data?.rmfp_id && displayData("รหัสวัตถุดิบ (RMFP ID)", data?.rmfp_id)}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: '6px',
                      bgcolor: data?.TypeColdMove === 'ย้ายทั้งรายการ' ? '#e8f5e9' : '#f3e5f5',
                      mb: 1.5
                    }}
                  >
                    <Typography sx={{ display: 'flex', alignItems: 'center' }}>
                      <CategoryIcon sx={{ mr: 1, color: data?.TypeColdMove === 'ย้ายทั้งรายการ' ? '#43a047' : '#8e24aa' }} />
                      <strong>ประเภทการย้าย:</strong> {data?.TypeColdMove || "ไม่ระบุ"}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: '6px',
                      bgcolor: '#EAF0FF',
                      mb: 1.5
                    }}
                  >
                    <Typography sx={{ display: 'flex', alignItems: 'center' }}>
                      <WarehouseIcon sx={{ mr: 1, color: '#1552F0' }} />
                      <strong>ห้องเย็นปลายทาง:</strong> {data?.ColdMove || "ไม่ระบุ"}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: '6px',
                      bgcolor: '#fff8e1',
                      mb: 1.5
                    }}
                  >
                    <Typography sx={{ display: 'flex', alignItems: 'center' }}>
                      <ScaleIcon sx={{ mr: 1, color: '#f57c00' }} />
                      <strong>น้ำหนักที่ย้าย:</strong> {data?.weight || 0} กก.
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* แสดงข้อมูลการย้าย */}
          <Grid item xs={12}>
            <Paper
              elevation={1}
              sx={{
                p: 2,
                borderRadius: '8px',
                border: '1px solid #E3E8F2'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <LocalShippingIcon sx={{ mr: 1, color: '#1552F0' }} />
                <Typography variant="h6" sx={{ fontSize: '18px', color: '#1552F0', fontWeight: 600 }}>
                  รายละเอียดการย้าย
                </Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              {/* แสดงข้อมูลการย้าย */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 2,
                  bgcolor: '#F5F8FF',
                  borderRadius: '8px',
                  border: '1px solid #e3e6f0'
                }}
              >
                {/* รถเข็นต้นทาง */}
                <Box
                  sx={{
                    bgcolor: '#565656',
                    color: '#fff',
                    p: 2,
                    borderRadius: '8px',
                    width: '45%',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="subtitle1" fontWeight={500}>
                      <LocalShippingIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                      รถเข็นต้นทาง
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 1 }}>
                      {data?.oldTrolleyId || data?.tro || data?.tro_id || "ไม่มีข้อมูล"}
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 1.5, bgcolor: 'rgba(255,255,255,0.2)' }} />

                  <Stack spacing={1}>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ScaleIcon sx={{ fontSize: 16, mr: 0.5 }} />
                      น้ำหนัก: {data?.weight || "0"} / {data?.weighttotal || data?.weight_RM || "0"} กก.
                    </Typography>
                    {data?.cs_id && data?.slot_id && (
                      <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <GpsFixedIcon sx={{ fontSize: 16, mr: 0.5 }} />
                        ตำแหน่ง: {data.cs_id} - {data.slot_id}
                      </Typography>
                    )}
                  </Stack>
                </Box>

                {/* ลูกศร */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <ArrowForwardIcon sx={{ fontSize: 40, color: '#1552F0' }} />
                  <Chip
                    label={`${data?.weight || 0} กก.`}
                    color="info"
                    size="small"
                    sx={{ mt: 1, fontWeight: 'bold' }}
                  />
                </Box>

                {/* รถเข็นปลายทาง (ที่เลือกไว้แล้ว) */}
                <Box
                  sx={{
                    bgcolor: '#41cc4f',
                    color: '#fff',
                    p: 2,
                    borderRadius: '8px',
                    width: '45%',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="subtitle1" fontWeight={500}>
                      <LocalShippingIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                      รถเข็นปลายทาง
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 1 }}>
                      {slot?.tro_id || "ไม่มีข้อมูล"}
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 1.5, bgcolor: 'rgba(255,255,255,0.2)' }} />

                  <Stack spacing={1}>
                    {slot?.cs_id && slot?.slot_id && (
                      <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <GpsFixedIcon sx={{ fontSize: 16, mr: 0.5 }} />
                        ตำแหน่ง: {slot.cs_id} - {slot.slot_id}
                      </Typography>
                    )}
                    {slot?.status && (
                      <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        สถานะ: {slot.status}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #E3E8F2', bgcolor: '#F5F8FF' }}>
        <Grid container spacing={2} justifyContent="space-between">
          {/* ปุ่มด้านซ้าย */}
          <Grid item>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<CancelIcon />}
                onClick={() => {
                  if (isProcessing || showSuccess) return;
                  console.log("MoveRawMatModal - คลิกปุ่มยกเลิก");
                  onClose ? onClose({ success: false }) : null;
                }}
                disabled={isProcessing || showSuccess}
                sx={{
                  bgcolor: "#E5484D",
                  color: "#fff",
                  '&:hover': {
                    bgcolor: "#d52a1a",
                  },
                  borderRadius: '8px',
                  px: 3
                }}
              >
                ยกเลิก
              </Button>
              <Tooltip title="กลับไปหน้าเลือกรถเข็นใหม่">
                <Button
                  variant="contained"
                  startIcon={<ArrowBackIcon />}
                  onClick={handleBack}
                  disabled={isProcessing || showSuccess}
                  sx={{
                    bgcolor: "#6c757d",
                    color: "#fff",
                    '&:hover': {
                      bgcolor: "#5a6268",
                    },
                    borderRadius: '8px',
                    px: 3
                  }}
                >
                  เลือกรถเข็นใหม่
                </Button>
              </Tooltip>
            </Stack>
          </Grid>

          {/* ปุ่มด้านขวา */}
          <Grid item>
            <Button
              variant="contained"
              startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
              onClick={handleConfirm}
              disabled={isProcessing || showSuccess}
              sx={{
                bgcolor: "#1552F0",
                color: "#fff",
                '&:hover': {
                  bgcolor: "#2a8dce",
                },
                borderRadius: '8px',
                px: 3
              }}
            >
              {isProcessing ? "กำลังบันทึก..." : "ยืนยัน"}
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Dialog>
  );
};

export default MoveRawMatModal;