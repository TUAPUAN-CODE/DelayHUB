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
import ModalAlert from "../../../../Popup/AlertSuccess";
import ModalPrint from "./ModalPrint"; // Add this import for ModalPrint

const API_URL = import.meta.env.VITE_API_URL;

// Utility function to safely convert to decimal with specified precision
const safeDecimalConvert = (value, precision = 2) => {
  // If value is null, undefined, or empty string, return 0
  if (value == null || value === '') return 0;

  // Try to parse the value as a number
  const numValue = Number(value);

  // If parsing fails, return 0
  if (isNaN(numValue)) return 0;

  // Round to specified precision
  return Number(numValue.toFixed(precision));
};

const Modal3 = ({ open, onClose, data, onEdit, cookedDateTimeNew, mat_name, withdraw_date, production, mat }) => {
  const [userId, setUserId] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [rowData, setRowData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  console.log("Data passed to Modal3:", data); // Debugging line to check data

  const { inputValues = {}, input2 = {}, rmfp_id } = data || {};
  const level_eu = input2?.level_eu || data?.level_eu || '';
  const [batchBefore, setBatchBefore] = useState(data?.batch || "ยังไม่ได้กำหนด");
  const [batchAfter, setBatchAfter] = useState(data?.newBatch || "ยังไม่ได้กำหนด");
  const materialName = mat_name || input2?.mat_name || data?.mat_name || "ยังไม่ได้กำหนด";
  const withdrawDateVal = withdraw_date || data?.withdraw_date || "";
  const productionValue = production || data?.production || "";
  const materialCode = mat || input2?.mat || data?.mat || "";
  const [errorDialogOpen, setErrorDialogOpen] = useState(false); // สำหรับแจ้ง error

  const handleClosePrintModal = () => {
    setPrintModalOpen(false);
    setShowAlert(true);
    onClose();
  };

  const handleClose = async () => {
    const troId = data?.inputValues?.[0]; // สมมุติว่าเป็นรหัสรถเข็น

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
      });
      return response.data.success;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return null;

    // ลบเครื่องหมายจุลภาคถ้ามี
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

        // สร้างวันที่ในเขตเวลาไทย (UTC+7)
        return `${year}-${month}-${day} ${timePart}:00`;
      }
      // สำหรับรูปแบบ ISO (จาก input datetime-local)
      else if (dateTimeStr.includes('T')) {
        const date = new Date(dateTimeStr);
        // แปลงเป็นเวลาไทยโดยเพิ่ม 7 ชั่วโมง
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

    setIsLoading(true);
    setIsProcessing(true);
    setError(null);


    try {

      const formattedDateTime = formatDateTime(data?.cookedDateTimeNew);
      const formattedPreparedTime = formatDateTime(data?.preparedDateTimeNew)
      const formattedWithdrawDate = formatDateTime(withdrawDateVal);

      // Safe conversion of numeric values
      const weightTotal = safeDecimalConvert(input2?.weightPerCart);
      const numberOfTrays = safeDecimalConvert(input2?.numberOfTrays, 0);

      const payload = {
        license_plate: Array.isArray(inputValues) ? inputValues.join(" ") : inputValues,
        rmfpID: rmfp_id || "",
        batch_before: batchBefore || "",
        batch_after: batchAfter || "",
        cookedDateTimeNew: formattedDateTime || "",
        preparedDateTimeNew: formattedPreparedTime || "",
        weightTotal: weightTotal,
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
        mat: materialCode || mat || ""
      };

      console.log("Payload before sending:", payload);

      const apiResponse = await axios.post(
        `${API_URL}/api/prep/manage/saveTrolley`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("API Response:", apiResponse.data);

      // ใช้ license_plate หรือ tro_id จาก API response
      const tro_id = apiResponse.data.TRO_ID || (Array.isArray(inputValues) ? inputValues.join(" ") : inputValues);

      // สร้างข้อมูลสำหรับการพิมพ์
      const printData = {
        tro_id: tro_id,
        batch_after: batchAfter || batchBefore,
        dest: input2?.deliveryLocation || "",
        mat_name: materialName,
        production: productionValue,
        rmm_line_name: input2?.deliveryLocation || "",
        level_eu: level_eu || "-",
        process_name: input2?.selectedProcessType?.process_name || "",
        weight_RM: weightTotal,
        tray_count: numberOfTrays,
        withdraw_date_formatted: formattedWithdrawDate || "",
        withdraw_date: withdrawDateVal || "",
        cooked_date: formattedDateTime || data?.cookedDateTimeNew || "",
        receiver: input2?.operator || "",
        qccheck: "-",
        mdcheck: "-",
        defectcheck: "-",
        qc_datetime_formatted: "",
        receiver_qc: input2?.operator || "",
        general_remark: input2?.deliveryType || "ทั่วไป",
        deliveryType: input2?.deliveryType || ""
      };

      setRowData(printData);

      // เปิด modal พิมพ์เฉพาะเมื่อประเภทการส่งเป็น "รอกลับมาเตรียม" เท่านั้น
      if (input2?.deliveryType === "รอกลับมาเตรียม") {
        setPrintModalOpen(true);
      } else {
        // กรณีไม่ใช่ "รอกลับมาเตรียม" ให้แสดง alert สำเร็จโดยตรง
        setShowAlert(true);
        setIsLoading(false);
        setIsProcessing(false);
        onClose();
      }

    } catch (error) {
      console.error("Error:", error);
      setError("ไม่สามารถทำรายการได้ เนื่องจากเลยเวลาที่กำหนด 10 นาที หรือ เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      setIsLoading(false);
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    // ดึงค่า user_id จาก localStorage
    const storedUserId = localStorage.getItem("user_id");
    setBatchBefore(data?.batch || "ยังไม่ได้กำหนด");
    setBatchAfter(data?.newBatch || data?.batch || "ยังไม่ได้กำหนด");

    console.log("🔄 Updating batch values...");
    console.log("✅ batchBefore:", data?.batch || "ไม่มีข้อมูล");
    console.log("✅ batchAfter:", data?.newBatch || data?.batch || "ไม่มีข้อมูล");

    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, [data]);

  const handleBatchAfterChange = (event) => {
    setBatchAfter(event.target.value); // Update batch_after when input changes
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={(e, reason) => {
          if (reason === 'backdropClick') return; // ไม่ให้ปิดเมื่อคลิกพื้นที่นอก
          onClose(); // ปิดเมื่อกดปุ่มหรือในกรณีอื่นๆ
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
              <Typography color="error" sx={{ mb: 2 }}>
                {error}
              </Typography>
            )}

            <Typography>ชื่อวัตถุดิบ: {materialName}</Typography>
            <Typography>Batch ก่อน: {batchBefore || "ยังไม่ได้กำหนด"}</Typography>
            <Typography>Batch ใหม่: {batchAfter || "ยังไม่ได้กำหนด"}</Typography>
            <Typography>
              ป้ายทะเบียน: {Array.isArray(inputValues) ?
                (inputValues.length > 0 ? inputValues[0] : "ไม่มีข้อมูล") :
                (inputValues || "ไม่มีข้อมูล")}
            </Typography>
            <Typography>น้ำหนักวัตถุดิบ/รถเข็น: {input2?.weightPerCart || "ข้อมูลไม่พบ"}</Typography>
            <Typography>จำนวนถาด: {input2?.numberOfTrays || "ข้อมูลไม่พบ"}</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">
              เวลาต้ม/อบเสร็จ: {data?.cookedDateTimeNew || cookedDateTimeNew || "ข้อมูลไม่พบ"}
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
            <Typography color="rgba(0, 0, 0, 0.6)">
              สถานที่จัดส่ง: {input2?.deliveryLocation || "ข้อมูลไม่พบ"}
            </Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">
              แผนการผลิต: {productionValue || "ข้อมูลไม่พบ"}
            </Typography>

            {input2?.deliveryLocation === "เข้าห้องเย็น" && (
              <Typography color="rgba(0, 0, 0, 0.6)">
                ประเภทการส่ง: {input2?.deliveryType || "ข้อมูลไม่พบ"}
              </Typography>
            )}

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
            sx={{ backgroundColor: "#E5484D", color: "#fff" }}
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
            sx={{ backgroundColor: "#1552F0", color: "#fff" }}
            variant="contained"
            startIcon={<CheckCircleIcon />}
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? "กำลังประมวลผล..." : "ยืนยัน"}
          </Button>
        </Stack>
      </Dialog>

      <ModalAlert open={showAlert} onClose={() => setShowAlert(false)} />

      {/* เปิด ModalPrint เมื่อข้อมูลพร้อมและประเภทการส่งเป็น "รอกลับมาเตรียม" */}
      {rowData && (
        <ModalPrint
          open={printModalOpen}
          onClose={handleClosePrintModal}
          rowData={rowData}
        />
      )}
    </>
  );
};

export default Modal3;