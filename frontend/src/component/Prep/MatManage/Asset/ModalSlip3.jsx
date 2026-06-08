import React, { useState, useEffect } from "react";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import EditIcon from "@mui/icons-material/EditOutlined";

import {
  Dialog,
  Stack,
  DialogContent,
  Button,
  Box,
  Divider,
  Typography,
} from "@mui/material";
import axios from "axios";

axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

// Utility function to safely convert to decimal with specified precision
const safeDecimalConvert = (value, precision = 2) => {
  if (value == null || value === '') return 0;
  const numValue = Number(value);
  if (isNaN(numValue)) return 0;
  return Number(numValue.toFixed(precision));
};

const ModalSlip3 = ({ 
  open, 
  onClose,
  onConfirm, 
  data, 
  onEdit,
  mat_name,
  withdraw_date,
  production,
  mat
}) => {
  const [userId, setUserId] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchArray, setBatchArray] = useState([]);
  const [batchAfterArray, setBatchAfterArray] = useState([]);

  console.log("Data passed to ModalSlip3:", data);

  const { input2 = {}, rmfp_id, batchAfterArray: dataBatchAfter = [] } = data || {};
  const level_eu = input2?.level_eu || data?.level_eu || '';
  const materialName = mat_name || input2?.mat_name || data?.mat_name || "ยังไม่ได้กำหนด";
  const withdrawDateVal = withdraw_date || data?.withdraw_date || "";
  const productionValue = production || data?.production || "";
  const materialCode = mat || input2?.mat || data?.mat || "";

  useEffect(() => {
    // ดึงค่า user_id จาก localStorage
    const storedUserId = localStorage.getItem("user_id");
    if (storedUserId) {
      setUserId(storedUserId);
      console.log("✅ User ID loaded:", storedUserId); // ✅ เพิ่ม
  } else {
    console.warn("⚠️ No user_id found in localStorage"); // ✅ เพิ่ม
    }

    // ดึงค่า batchArray
    if (data?.batchArray && Array.isArray(data.batchArray)) {
      setBatchArray(data.batchArray);
      console.log("✅ Batch Array:", data.batchArray); // ✅ เพิ่ม
    }

    // ดึงค่า batchAfterArray แบบ object
    if (dataBatchAfter && Array.isArray(dataBatchAfter)) {
      const afterBatches = dataBatchAfter.map(item => ({
        batch_before: item.batch_before,
        batch_after: item.batch_after || item.new_batch_after || ""
      }));
      setBatchAfterArray(afterBatches);
      console.log("✅ Batch After Array:", afterBatches); // ✅ เพิ่ม
    }
  }, [data, dataBatchAfter]);

  function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return null;

    dateTimeStr = dateTimeStr.replace(',', '');

    try {
      // สำหรับรูปแบบเวลาไทย (DD/MM/YYYY HH:MM)
      if (dateTimeStr.includes('/')) {
        const parts = dateTimeStr.split(' ');
        if (parts.length < 2) {
          console.error("Invalid date time format:", dateTimeStr);
          return null;
        }

        const dateParts = parts[0].split('/');
        const timePart = parts[1];

        if (dateParts.length !== 3) {
          console.error("Invalid date format:", parts[0]);
          return null;
        }

        const day = dateParts[0].padStart(2, '0');
        const month = dateParts[1].padStart(2, '0');
        const year = dateParts[2];

        return `${year}-${month}-${day} ${timePart}:00`;
      }
      // สำหรับรูปแบบ ISO (จาก input datetime-local)
      else if (dateTimeStr.includes('T')) {
        const date = new Date(dateTimeStr);
        date.setHours(date.getHours() + 7);

        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:00`;
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return null;
    }
  }

  const handleConfirm = async () => {
  if (isLoading) return;

  if (!rmfp_id) return setError("ไม่พบ rmfp_id กรุณาลองใหม่อีกครั้ง");
  if (!userId) return setError("ไม่พบข้อมูลผู้ใช้ กรุณา Login ใหม่");
  if (!materialCode) return setError("ไม่พบรหัสวัตถุดิบ (mat)");
  if (!batchAfterArray || batchAfterArray.length === 0) return setError("ไม่พบข้อมูล Batch");

  setIsLoading(true);
  setIsProcessing(true);
  setError(null);

  try {
    const formattedDateTime = formatDateTime(data?.cookedDateTimeNew);
    const formattedPreparedTime = formatDateTime(data?.preparedDateTimeNew);
    const formattedWithdrawDate = formatDateTime(withdrawDateVal);

    const weightTotal = safeDecimalConvert(input2?.weightPerCart);
    const numberOfTrays = safeDecimalConvert(input2?.numberOfTrays, 0);

    const payload = {
      rmfpID: rmfp_id || "",
      batchAfterArray,
      cookedDateTimeNew: formattedDateTime || "",
      preparedDateTimeNew: formattedPreparedTime || "",
      weightTotal,
      ntray: numberOfTrays,
      recorder: input2?.operator || "",
      Dest: input2?.deliveryLocation || "",
      Process: input2?.selectedProcessType?.process_id || "",
      deliveryType: input2?.deliveryType || "",
      userID: Number(userId),
      level_eu: level_eu || "",
      tray_count: numberOfTrays,
      weight_RM: weightTotal,
      mat_name: materialName,
      withdraw_date: formattedWithdrawDate || "",
      production: productionValue,
      mat: materialCode
    };

    console.log("📤 Payload sending to API:", payload);

    const apiResponse = await axios.post(
      `${API_URL}/api/prep/manage/PrintMapping`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("✅ API Response:", apiResponse.data);

    const mapping_id = apiResponse?.data?.mapping_id; // ✅ เก็บไว้ใน try
    const rmfpFromApi = apiResponse?.data?.rmfp_id;

    // (1) ถ้าจะโชว์สลิปแบบเร็ว ใช้ข้อมูลเดิมก่อนก็ได้
    // setShowAlert(true);

    // (2) ถ้าต้องการดึงข้อมูลจาก TrolleyRMMapping เพื่อเติมข้อมูลสลิป
    let mappingData = null;
    if (mapping_id) {
      console.log("📥 Fetching TrolleyRMMapping data for mapping_id:", mapping_id);

      const mappingResponse = await axios.get(
        `${API_URL}/api/prep/manage/fetchTrolleyRMMapping`,
        { params: { mapping_id } }
      );

      console.log("✅ TrolleyRMMapping data:", mappingResponse.data);

      if (mappingResponse.data?.success && mappingResponse.data?.data?.length > 0) {
        mappingData = mappingResponse.data.data[0];
      }
    }

    // ✅ สร้าง completeData “ครั้งเดียว” แล้ว onConfirm ครั้งเดียว
    const completeData = {
      ...data,
      rmfp_id: rmfpFromApi || rmfp_id,
      mapping_id,
      input2,
      batchArray,
      batchAfterArray,
      mat_name: mappingData?.mat_name || materialName,
      mat: mappingData?.mat || materialCode,
      withdraw_date: formattedWithdrawDate || withdrawDateVal,
      production: mappingData?.doc_no || productionValue,
      level_eu: mappingData?.level_eu || level_eu,

      cookedDateTimeNew: data?.cookedDateTimeNew,
      preparedDateTimeNew: data?.preparedDateTimeNew,

      // เพิ่มเติมจาก mapping (ถ้ามี)
      process_name: mappingData?.process_name,
      weight_RM: mappingData?.weight_RM ?? weightTotal,
      tray_count: mappingData?.tray_count ?? numberOfTrays,
      dest: mappingData?.dest,
      rm_status: mappingData?.rm_status,
      batch_info: mappingData?.batch_info,
      created_at: mappingData?.created_at
    };

    console.log("📄 Complete data for slip:", completeData);

    setShowAlert(true);
    onConfirm?.(completeData);

  } catch (error) {
    console.error("❌ Error:", error);
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
    setError(errorMessage);
  } finally {
    setIsLoading(false);
    setIsProcessing(false);
  }
};


  const handleClose = () => {
    onClose();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={(e, reason) => {
          if (reason === 'backdropClick') return;
          onClose();
        }}
        maxWidth="xs"
        fullWidth
      >
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          fontSize: "15px",
          color: "#555"
        }}>
          <DialogContent sx={{ paddingBottom: 0 }}>
            <Typography sx={{
              fontSize: "18px",
              fontWeight: 500,
              color: "#545454",
              marginBottom: "10px"
            }}>
              กรุณาตรวจสอบข้อมูลก่อนทำรายการ
            </Typography>
            <Divider sx={{ mt: 2, mb: 2 }} />

            {error && (
            <Typography color="error" sx={{ 
             mb: 2, 
             p: 1, 
             backgroundColor: "#ffebee", // ✅ เพิ่ม background สีแดงอ่อน
             borderRadius: 1 
            }}>
            {error}
            </Typography>
            )}

            <Typography>ชื่อวัตถุดิบ: {materialName}</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">รหัสวัตถุดิบ: {materialCode}</Typography> {/* ✅ เพิ่ม */}

            {/* แสดงรายการ Batch ทั้งหมด */}
            {batchArray.length > 0 && (
              <>
                <Divider sx={{ mt: 2, mb: 2 }} />
                <Typography sx={{ fontSize: "16px", fontWeight: 500, color: "#333", marginBottom: "8px" }}>
                  รายการ Batch ทั้งหมด:
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 2 }}>
                  {batchArray.map((batchItem, idx) => {
                    const afterBatch = batchAfterArray[idx];
                    const newBatch = afterBatch?.batch_after || "N/A";
                    return (
                      <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {/* Batch เดิม */}
                        <Box
                          sx={{
                            padding: "4px 8px",
                            backgroundColor: "#f0f0f0",
                            borderRadius: "4px",
                            fontSize: "14px",
                            minWidth: "120px",
                            textAlign: "center",
                            color: "#666"
                          }}
                        >
                          {batchItem}
                        </Box>

                        {/* ลูกศร */}
                        <Typography sx={{ fontSize: "16px", color: "#666" }}>→</Typography>

                        {/* Batch ใหม่ */}
                        <Box
                          sx={{
                            padding: "4px 8px",
                            backgroundColor: "#d0f0d0",
                            borderRadius: "4px",
                            fontSize: "14px",
                            minWidth: "120px",
                            textAlign: "center",
                            fontWeight: "bold",
                            color: "#2e7d32"
                          }}
                        >
                          {newBatch}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </>
            )}

            <Typography>น้ำหนักวัตถุดิบ/รถเข็น: {input2?.weightPerCart || "ข้อมูลไม่พบ"} กก.</Typography>
            <Typography>จำนวนถาด: {input2?.numberOfTrays || "ข้อมูลไม่พบ"} ถาด</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">
              เวลาต้ม/อบเสร็จ: {data?.cookedDateTimeNew || "ข้อมูลไม่พบ"}
            </Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">
              วันที่เตรียมเสร็จ: {data?.preparedDateTimeNew || "ข้อมูลไม่พบ"}
            </Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">
              เวลาเบิกวัตถุดิบจากห้องเย็นใหญ่: {withdrawDateVal || "ข้อมูลไม่พบ"}
            </Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">
              ประเภทการแปรรูป: {input2?.selectedProcessType?.process_name || "ข้อมูลไม่พบ"}
            </Typography>
            <Typography>
              Level EU (สำหรับวัตถุดิบปลา): {level_eu || "ไม่มีข้อมูล EU"}
            </Typography>
            {/* <Typography color="rgba(0, 0, 0, 0.6)">
              สถานที่จัดส่ง: {input2?.deliveryLocation || "ข้อมูลไม่พบ"}
            </Typography> */}
            <Typography color="rgba(0, 0, 0, 0.6)">
              แผนการผลิต: {productionValue || "ข้อมูลไม่พบ"}
            </Typography>

            {/* {input2?.deliveryLocation === "เข้าห้องเย็น" && (
              <Typography color="rgba(0, 0, 0, 0.6)">
                ประเภทการส่ง: {input2?.deliveryType || "ข้อมูลไม่พบ"}
              </Typography>
            )} */}

            <Typography>ผู้ดำเนินการ: {input2?.operator || "ข้อมูลไม่พบ"}</Typography>
            <Divider sx={{ mt: 2, mb: 0 }} />
          </DialogContent>
        </Box>

        <Stack
          sx={{
            padding: "20px",
          }}
          direction="row"
          spacing={10}
          justifyContent="center"
        >
          <Button
            sx={{ backgroundColor: "#E74A3B", color: "#fff" }}
            variant="contained"
            startIcon={<CancelIcon />}
            onClick={handleClose}
            disabled={isProcessing}
          >
            ยกเลิก
          </Button>
          <Button
            sx={{ backgroundColor: "#edc026", color: "#fff" }}
            variant="contained"
            startIcon={<EditIcon />}
            onClick={onEdit}
            disabled={isProcessing}
          >
            แก้ไข
          </Button>
          <Button
            sx={{ backgroundColor: "#41a2e6", color: "#fff" }}
            variant="contained"
            startIcon={<CheckCircleIcon />}
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? "กำลังประมวลผล..." : "ยืนยัน"}
          </Button>
        </Stack>
      </Dialog>
    </>
  );
};

export default ModalSlip3;
