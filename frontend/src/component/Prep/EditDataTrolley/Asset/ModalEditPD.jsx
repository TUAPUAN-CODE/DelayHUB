import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Divider,
  Button,
  Stack,
  IconButton,
  Alert,
  Autocomplete,
  TextField,
  Paper,
  CircularProgress,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel
} from "@mui/material";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { FaCheck } from "react-icons/fa";
import axios from "axios";
axios.defaults.withCredentials = true;
import ModalAlert from "../../../../Popup/AlertSuccess";
import ModalPrintDetail from "./ModalPrintDetail";

const API_URL = import.meta.env.VITE_API_URL;

const ConfirmProdModal = ({ open, onClose, material, materialName, batch, mapping_id, prod_id, selectedLine, selectedGroup, onSuccess, editorName, currentProdDetails, tray_count, weight_RM, deliveryLocation, deliveryType, rmStatus }) => {
  const [showAlert, setShowAlert] = useState(false);

  const handleConfirm = async () => {

    // ✅ ตรวจสอบ mapping_id
    if (!mapping_id) {
      console.error("❌ Cannot update: mapping_id is null");
      alert("ไม่สามารถบันทึกได้ เนื่องจากไม่พบรหัสรถเข็น");
      return;
    }

    // Format the original production plan if it exists
    const beforeProd = currentProdDetails ?
      `${currentProdDetails.prodCode}${currentProdDetails.prodDocNo ? ` (${currentProdDetails.prodDocNo})` : ''}${currentProdDetails.lineName ? ` - ${currentProdDetails.lineName}` : ''}` :
      '';

    // Format the new production plan
    const afterProd = prod_id ?
      `${currentProdDetails?.newProdCode || ''} (${currentProdDetails?.newProdDocNo || ''})${selectedLine ? ` - ${selectedLine.line_name}` : ''}` :
      '';

    const payload = {
      mat: material,
      mapping_id: parseInt(mapping_id, 10),
      prod_id: parseInt(prod_id, 10),
      line_name: selectedLine ? selectedLine.line_name : null,
      name_edit_prod: editorName,
      before_prod: beforeProd,
      after_prod: afterProd,
      weight_RM: parseFloat(weight_RM),
      tray_count: parseInt(tray_count, 10),
      // ถ้าเป็น QC Check จะไม่ส่ง deliveryLocation
      deliveryLocation: deliveryLocation,
    };

    try {
      const response = await axios.put(`${API_URL}/api/updateEditProd`, payload);
      if (response.status === 200) {
        console.log("Data sent successfully:", response.data);
        onSuccess(response.data);
        onClose();
        setShowAlert(true);
      } else {
        console.error("Error while sending data:", response.status);
      }
    } catch (error) {
      console.error("Error during API call:", error);
    }
    console.log("Sending payload:", payload);
  };

  return (
    <>
      <Dialog open={open} onClose={(e, reason) => {
        if (reason === 'backdropClick') return;
        onClose();
      }} fullWidth maxWidth="xs">
        <DialogContent>
          <Typography variant="h6" style={{ fontSize: "18px", color: "#6B7489" }} mb={2}>
            กรุณาตรวจสอบข้อมูลก่อนทำรายการ
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={1}>
            <Typography color="rgba(0, 0, 0, 0.6)">Material: {material}</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">Material Name: {materialName}</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">Batch: {batch}</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">ถาด: {tray_count}</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">น้ำหนัก: {weight_RM} กก.</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">
              สถานที่จัดส่ง: {deliveryLocation === "ไปบรรจุ" ? "บรรจุ" : "ห้องเย็น"}
            </Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">ผู้อนุมัติ: {editorName}</Typography>

            {currentProdDetails && (
              <Paper elevation={0} sx={{ p: 1, bgcolor: "#F5F8FF", mb: 1 }}>
                <Typography color="rgba(0, 0, 0, 0.6)" fontWeight="bold">
                  แผนการผลิตเดิม:
                </Typography>
                <Typography color="rgba(0, 0, 0, 0.6)">
                  {currentProdDetails.prodCode}{currentProdDetails.prodDocNo ? ` (${currentProdDetails.prodDocNo})` : ''}
                </Typography>
                {currentProdDetails.lineName && (
                  <Typography color="rgba(0, 0, 0, 0.6)">
                    ไลน์ผลิต: {currentProdDetails.lineName}
                  </Typography>
                )}
              </Paper>
            )}

            <Paper elevation={0} sx={{ p: 1, bgcolor: "#EAF0FF", mb: 1 }}>
              <Typography color="rgba(0, 0, 0, 0.6)" fontWeight="bold">
                แผนการผลิตใหม่:
              </Typography>
              <Typography color="rgba(0, 0, 0, 0.6)">
                {currentProdDetails?.newProdCode || ''} {currentProdDetails?.newProdDocNo ? `(${currentProdDetails.newProdDocNo})` : ''}
              </Typography>
              {selectedLine && (
                <Typography color="rgba(0, 0, 0, 0.6)">
                  ไลน์ผลิต: {selectedLine.line_name}
                </Typography>
              )}
            </Paper>
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
              onClick={handleConfirm}
            >
              ยืนยัน
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
      <ModalAlert open={showAlert} onClose={() => setShowAlert(false)} />
    </>
  );
};

const ModalEditPD = ({ open, onClose, data, onSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [production, setProduction] = useState([]);
  const [group, setGroup] = useState([]);
  const [allLinesByType, setAllLinesByType] = useState({});
  const [isConfirmProdOpen, setIsConfirmProdOpen] = useState(false);
  const [showDropdowns, setShowDropdowns] = useState(true);
  const [editorName, setEditorName] = useState("");
  const [editorNameError, setEditorNameError] = useState(false);
  const [currentProdDetails, setCurrentProdDetails] = useState(null);
  const [planError, setPlanError] = useState(false);
  const [lineError, setLineError] = useState(false);
  const [editLimitReached, setEditLimitReached] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [weight_RM, setWeight] = useState(0);
  const [weightError, setWeightError] = useState(false);
  const [tray_count, setTray] = useState(0);
  const [trayError, setTrayError] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState("");
  // const [deliveryType, setDeliveryType] = useState("");
  const [locationError, setLocationError] = useState(false);
  const [isModal3Open, setIsModal3Open] = useState(false);
  const [modal3Data, setModal3Data] = useState(null);
  const [rmStatus, setRmStatus] = useState("");
  const { batch, mat, mapping_id, production: currentProduction, line_name, tray_count: initialTray, weight_RM: initialWeight, tro_id } = data || {};


  // เพิ่มฟังก์ชันนี้หลังจาก useState ทั้งหมด
  const resetForm = () => {
    setSelectedPlan(null);
    setSelectedLine(null);
    setSelectedGroup(null);
    setErrorMessage("");
    setShowDropdowns(true);
    setEditorName("");
    setEditorNameError(false);
    setPlanError(false);
    setLineError(false);
    setWeightError(false);
    setTrayError(false);
    setLocationError(false);
    setDeliveryLocation("");
    // setDeliveryType("");
    setWeight(initialWeight || 0);
    setTray(initialTray || 0);
  };

  useEffect(() => {
    if (mat) {
      fetchMaterialName();
      fetchProduction();
      fetchGroup();
      checkEditHistory();

      if (initialTray !== undefined && initialTray !== null) {
        setTray(initialTray);

      }
      if (initialWeight !== undefined && initialWeight !== null) {
        setWeight(initialWeight);
      }

      // ถ้ามีข้อมูลแผนการผลิตปัจจุบัน ให้เก็บไว้
      if (currentProduction) {
        // แยกข้อมูลแผนการผลิตปัจจุบัน
        const [prodCode, prodDocNo] = currentProduction.includes('(') ?
          [currentProduction.split('(')[0].trim(),
          currentProduction.split('(')[1].replace(')', '').trim()] :
          [currentProduction, ''];

        setCurrentProdDetails({
          prodCode,
          prodDocNo,
          lineName: line_name || '',
          tray_count: initialTray || 0,
          weight_RM: initialWeight || 0
        });
      }
    }
  }, [mat, currentProduction, line_name, initialWeight, initialTray]);

  const fetchDataForModal3 = async (mappingId) => {
    try {
      console.log("🔵 [fetchDataForModal3] เริ่มดึงข้อมูล mapping_id:", mappingId);
      setIsLoading(true);

      // ดึงข้อมูลทั้งหมดที่ Modal3 ต้องการ
      const response = await axios.get(`${API_URL}/api/getDetailsByMapping`, {
        params: { mapping_id: mappingId }
      });

      console.log("✅ [fetchDataForModal3] Response:", response.data);

      if (response.data.success) {
        const data = response.data.data;
        console.log("📦 [fetchDataForModal3] Data received:", data);

        // จัดรูปแบบข้อมูลให้ตรงกับที่ Modal3 ต้องการ
        const formattedData = {
          // ข้อมูลพื้นฐาน
          mapping_id: data.mapping_id,
          mat: data.mat,
          mat_name: data.mat_name,
          batch: data.batch,
          batch_after: data.batch_after,
          level_eu: data.level_eu,
          tro_id: data.tro_id,
          tray_count: data.tray_count || tray_count,
          weight_RM: data.weight_RM || weight_RM,

          // ข้อมูลการผลิต
          production: data.doc_no,
          process_name: data.process_name,
          rmm_line_name: data.rmm_line_name || selectedLine?.line_name,
          dest: data.dest || deliveryLocation,

          // ข้อมูลเวลา
          withdraw_date: data.withdraw_date,
          rmit_date: data.rmit_date,
          ptp_time: data.ptp_time,
          rework_time: data.rework_time,

          // ข้อมูล QC
          qcData: {
            qccheck: data.qccheck,
            mdcheck: data.mdcheck,
            defectcheck: data.defectcheck,
            sq_acceptance: data.sq_acceptance === 1,
            defect_acceptance: data.defect_acceptance === 1,
            sq_remark: data.sq_remark,
            md_remark: data.md_remark,
            defect_remark: data.defect_remark,
            Moisture: data.Moisture,
            percent_fine: data.percent_fine,
            Temp: data.Temp,
            md_no: data.md_no,
            WorkAreaCode: data.WorkAreaCode,
            md_time_formatted: data.md_time_formatted,
            qc_datetime_formatted: data.qc_datetime_formatted,
            receiver_qc: data.receiver_qc,
            general_remark: data.general_remark,
            location: data.location,
            receiver: data.receiver,
            rm_status: data.rm_status,
            prepare_mor_night: data.prepare_mor_night,

            // ข้อมูลการแก้ไข Line
            name_edit_prod_two: data.name_edit_prod_two,
            name_edit_prod_three: data.name_edit_prod_three,
            first_prod: data.first_prod,
            two_prod: data.two_prod,
            three_prod: data.three_prod
          },

          // ข้อมูลการแก้ไข
          edit_rework: data.edit_rework,
          remark_rework: data.remark_rework,
          remark_rework_cold: data.remark_rework_cold,
          stay_place: data.stay_place,
          rmm_line_name: data.rmm_line_name
        };

        return formattedData;
      } else {
        throw new Error(response.data.error || "ไม่สามารถดึงข้อมูลได้");
      }
    } catch (error) {
      console.error("❌ [fetchDataForModal3] Error:", error);
      console.error("❌ [fetchDataForModal3] Error response:", error.response?.data);
      console.error("❌ [fetchDataForModal3] Error status:", error.response?.status);
      setErrorMessage("ไม่สามารถดึงข้อมูลสำหรับพิมพ์ Slip ได้");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const checkEditHistory = async () => {
    console.log("🔍 Checking mapping_id:", mapping_id);

    if (!mapping_id) {
      console.warn("⚠️ mapping_id is missing!");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {

      console.log("📤 Sending params:", { mapping_id });

      const response = await axios.get(`${API_URL}/api/checkEditHistoryByMapping`, {
        params: { mapping_id }
      });

      if (response.data.success) {
        setEditLimitReached(response.data.editLimitReached);
        setRmStatus(response.data.rm_status || "");
      } else {
        console.error("Error checking edit history:", response.data.error);
      }
    } catch (error) {
      console.error("Error checking edit history:", error);
      console.error("📥 Server response:", error.response?.data);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMaterialName = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/fetchRawMatName`, { params: { mat } });
      if (response.data.success) {
        setMaterialName(response.data.data[0]?.mat_name || "ไม่พบชื่อวัตถุดิบ");
      } else {
        console.error("Error fetching material name:", response.data.error);
      }
    } catch (error) {
      console.error("Error fetching material name:", error);
    }
  };

  const fetchProduction = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/fetchProduction`, { params: { mat } });
      if (response.data.success) {
        setProduction(response.data.data);
        setAllLinesByType(response.data.allLinesByType || {});
      } else {
        console.error("Error fetching production data:", response.data.error);
      }
    } catch (error) {
      console.error("Error fetching production data:", error);
    }
  };

  const fetchGroup = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/fetchGroup`, { params: { mat } });
      if (response.data.success) {
        setGroup(response.data.data);
      } else {
        console.error("Error fetching group data:", response.data.error);
      }
    } catch (error) {
      console.error("Error fetching group data:", error);
    }
  };

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setSelectedLine(null);
    setSelectedGroup(null);
    setErrorMessage("");
    setPlanError(false);


    // เก็บข้อมูลแผนการผลิตใหม่
    if (plan && currentProdDetails) {
      setCurrentProdDetails({
        ...currentProdDetails,
        newProdCode: plan.code,
        newProdDocNo: plan.doc_no
      });
    }
  };

  const handleLineSelect = (line) => {
    setSelectedLine(line);
    setErrorMessage("");
    setLineError(false);
  };

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    setErrorMessage("");
  };

  const toggleDropdowns = () => {
    setShowDropdowns(!showDropdowns);
  };

  const handleConfirm = () => {
    let hasError = false;

    if (!selectedPlan) {
      setPlanError(true);
      setErrorMessage("กรุณาเลือกแผนการผลิต");
      hasError = true;
    } else {
      setPlanError(false);
    }

    if (!selectedLine) {
      setLineError(true);
      if (!hasError) setErrorMessage("กรุณาเลือกไลน์ผลิต");
      hasError = true;
    } else {
      setLineError(false);
    }

    if (!editorName.trim()) {
      setEditorNameError(true);
      setErrorMessage("กรุณากรอกชื่อผู้ให้อนุมัติ");
      hasError = true;
    } else {
      setEditorNameError(false);
    }

    if (!tray_count || parseInt(tray_count) <= 0) {
      setTrayError(true);
      if (!hasError) setErrorMessage("กรุณากรอกจำนวนถาดที่ถูกต้อง");
      hasError = true;
    } else {
      setTrayError(false);
    }
    if (!weight_RM || parseFloat(weight_RM) <= 0) {
      setWeightError(true);
      if (!hasError) setErrorMessage("กรุณากรอกน้ำหนักที่ถูกต้อง");
      hasError = true;
    } else {
      setWeightError(false);
    }


    if (!deliveryLocation) {
      setLocationError(true);
      if (!hasError) setErrorMessage("กรุณาเลือกสถานที่จัดส่ง");
      hasError = true;
    } else {
      setLocationError(false);
    }

    if (hasError) {
      return;
    }

    setErrorMessage("");
    setIsConfirmProdOpen(true);
  };

  const handleConfirmSuccess = async (updatedData) => {
    resetForm();

    if (rmStatus === "QcCheck") {
      // ดึงข้อมูลใหม่หลังจากอัปเดต
      const dataForModal = await fetchDataForModal3(mapping_id);

      if (dataForModal) {
        // อัปเดตข้อมูลการแก้ไข Line
        dataForModal.qcData = {
          ...dataForModal.qcData,
          name_edit_prod_two: editorName,
          two_prod: selectedPlan ? `${selectedPlan.code} (${selectedPlan.doc_no})` : null,
          // ถ้ามีการแก้ไขครั้งที่ 3 เพิ่มข้อมูลที่นี่
        };

        setModal3Data(dataForModal);
        setIsModal3Open(true);
      }
    } else {
      onClose();
    }

    if (onSuccess) {
      onSuccess(updatedData);
    }
  };

  const handleEditorNameChange = (e) => {
    setEditorName(e.target.value);
    if (e.target.value.trim()) {
      setEditorNameError(false);
    }
  };

  const handleDeliveryLocationChange = (e) => {
    setDeliveryLocation(e.target.value);
    setLocationError(false);
  };


  if (isLoading) {
    return (
      <Dialog open={open} fullWidth maxWidth="sm">
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onClose={(e, reason) => {
        if (reason === 'backdropClick') return;
        resetForm();
        onClose();
      }} fullWidth maxWidth="sm">
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" style={{ fontSize: "18px", color: "#6B7489" }}>
              แก้ไขแผนการผลิต
            </Typography>
            {!editLimitReached && (
              <IconButton onClick={toggleDropdowns} size="small">
                <VisibilityIcon color={showDropdowns ? "primary" : "action"} />
              </IconButton>
            )}
          </Box>

          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}

          {editLimitReached && rmStatus !== "QcCheck" && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              ไม่สามารถแก้ไขแผนการผลิตได้ เนื่องจากมีการแก้ไขครบ 3 ครั้งแล้ว
            </Alert>
          )}

          {rmStatus === "QcCheck" && (
            <Alert severity="info" sx={{ mb: 2 }}>
              สถานะ: QC Check แล้ว - สามารถแก้ไขแผนผลิต, ไลน์ผลิต, ถาด, น้ำหนัก และสถานที่จัดส่งได้
            </Alert>
          )}

          <Stack spacing={2}>
            <Divider />
            <Typography color="rgba(0, 0, 0, 0.6)">Material: {mat}</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">Material Name: {materialName}</Typography>
            <Typography color="rgba(0, 0, 0, 0.6)">Batch: {batch}</Typography>

            {currentProdDetails && (
              <Paper elevation={1} sx={{ p: 2, borderRadius: 1, bgcolor: "#F5F8FF" }}>
                <Typography color="#333" fontWeight="bold" gutterBottom>
                  แผนการผลิตปัจจุบัน
                </Typography>
                <Typography color="rgba(0, 0, 0, 0.6)">
                  {currentProdDetails.prodCode} {currentProdDetails.prodDocNo ? `(${currentProdDetails.prodDocNo})` : ''}
                </Typography>
                {currentProdDetails.lineName && (
                  <Typography color="rgba(0, 0, 0, 0.6)">
                    ไลน์ผลิต: {currentProdDetails.lineName}
                  </Typography>
                )}
              </Paper>
            )}

            <Divider />

            {!editLimitReached && showDropdowns && (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                mb: 2,
                p: 2,
                border: '1px solid #eee',
                borderRadius: 1,
                backgroundColor: '#F5F8FF'
              }}>
                <Typography color="#333" fontWeight="bold" gutterBottom>
                  แผนการผลิตใหม่
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, mb: 2, flexDirection: { xs: 'column', md: 'row' } }}>
                  <Autocomplete
                    sx={{ flex: 2 }}
                    options={production}
                    getOptionLabel={(option) => `${option.code} (${option.doc_no})`}
                    value={selectedPlan}
                    onChange={(e, newValue) => handlePlanSelect(newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="แผนการผลิต"
                        size="small"
                        fullWidth
                        required
                        error={planError}
                        helperText={planError ? "กรุณาเลือกแผนการผลิต" : ""}
                      />
                    )}
                    renderOption={(props, option) => (
                      <Box
                        {...props}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                          px: 1,
                        }}
                      >
                        <Typography sx={{ flexGrow: 1 }}>
                          {option.code} ({option.doc_no})
                        </Typography>
                        <IconButton onClick={() => handlePlanSelect(option)} sx={{ ml: "auto" }}>
                          <FaCheck style={{ color: "#1552F0" }} />
                        </IconButton>
                      </Box>
                    )}
                  />

                  <Autocomplete
                    sx={{ flex: 1 }}
                    options={selectedPlan?.line_type_id ? (allLinesByType[selectedPlan.line_type_id] || []) : []}
                    getOptionLabel={(option) => option.line_name}
                    value={selectedLine}
                    onChange={(e, newValue) => handleLineSelect(newValue)}
                    renderInput={(params) => (
                      <TextField {...params}
                        label="เลือกไลน์ผลิต"
                        size="small"
                        fullWidth
                        required
                        error={lineError}
                        helperText={lineError ? "กรุณาเลือกไลน์ผลิต" : ""}
                      />
                    )}
                    disabled={!selectedPlan}
                    renderOption={(props, option) => (
                      <Box
                        {...props}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                          px: 1,

                        }}
                      >
                        <Typography sx={{ flexGrow: 1 }}>
                          {option.line_name}
                        </Typography>
                        <IconButton onClick={() => handleLineSelect(option)} sx={{ ml: "auto" }}>
                          <FaCheck style={{ color: "#1552F0" }} />
                        </IconButton>
                      </Box>
                    )}
                  />
                </Box>

                <TextField
                  label="ถาด"
                  variant="outlined"
                  fullWidth
                  size="small"
                  type="number"
                  value={tray_count}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value, 10) : 0;
                    setTray(value);
                    if (value > 0) setTrayError(false);
                  }}
                  error={trayError}
                  helperText={trayError ? "กรุณากรอกจำนวนถาดที่ถูกต้อง" : ""}
                  required
                  InputProps={{
                    inputProps: { min: 1, step: 1 }
                  }}
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="น้ำหนัก (กก.)"
                  variant="outlined"
                  fullWidth
                  size="small"
                  type="number"
                  value={weight_RM}
                  onChange={(e) => {
                    const value = e.target.value ? parseFloat(e.target.value) : 0;
                    setWeight(value);
                    if (value > 0) setWeightError(false);
                  }}
                  error={weightError}
                  helperText={weightError ? "กรุณากรอกน้ำหนักที่ถูกต้อง" : ""}
                  required
                  InputProps={{
                    inputProps: { min: 0, step: 0.01 }
                  }}
                  sx={{ mb: 2 }}
                />


                <Box sx={{
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "12px",
                  border: locationError ? '1px solid red' : 'none',
                  borderRadius: locationError ? '4px' : '0',
                  padding: locationError ? '8px' : '0'
                }}>
                  <Typography style={{ color: "#666", marginRight: "16px" }}>สถานที่จัดส่ง</Typography>
                  <RadioGroup row name="location" value={deliveryLocation} onChange={handleDeliveryLocationChange}>
                    <FormControlLabel value="ไปบรรจุ" control={<Radio />} style={{ color: "#666" }} label="บรรจุ" />
                    <FormControlLabel value="เข้าห้องเย็น" control={<Radio />} style={{ color: "#666" }} label="ห้องเย็น" />
                  </RadioGroup>
                </Box>
                {locationError && (
                  <Typography variant="caption" color="error" sx={{ ml: 2 }}>
                    กรุณาเลือกสถานที่จัดส่ง
                  </Typography>
                )}

                <TextField
                  label="ชื่อผู้อนุมัติ"
                  variant="outlined"
                  fullWidth
                  size="small"
                  value={editorName}
                  onChange={handleEditorNameChange}
                  error={editorNameError}
                  helperText={editorNameError ? "กรุณากรอกชื่อผู้อนุมัติ" : ""}
                  required
                  sx={{ mb: 2 }}
                />
              </Box>
            )}

            {!editLimitReached && !showDropdowns && selectedPlan && (
              <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 1, backgroundColor: '#F5F8FF' }}>
                <Typography fontWeight="bold" gutterBottom>
                  แผนการผลิตใหม่
                </Typography>
                <Typography>
                  {selectedPlan.code} ({selectedPlan.doc_no}) - {selectedLine?.line_name || 'ยังไม่ได้เลือกไลน์'}
                </Typography>
                <Typography sx={{ mt: 1 }}>
                  ผู้อนุมัติ: {editorName || 'ยังไม่ได้กรอกชื่อ'}
                </Typography>
              </Box>
            )}

            <Divider />

            <Box sx={{ display: "flex", justifyContent: "space-between", pt: 1 }}>
              <Button
                variant="contained"
                startIcon={<CancelIcon />}
                style={{ backgroundColor: "#E5484D", color: "#fff" }}
                onClick={() => {
                  resetForm();
                  onClose();
                }}
              >
                ยกเลิก
              </Button>

              {rmStatus === "QcCheck" && (
                <Button
                  variant="contained"
                  style={{ backgroundColor: "#4CAF50", color: "#fff" }}
                  onClick={async () => {
                    // ดึงข้อมูลตาม mapping_id
                    const dataForModal = await fetchDataForModal3(mapping_id);

                    if (dataForModal) {
                      setModal3Data(dataForModal);
                      setIsModal3Open(true);
                    }
                  }}
                >
                  พิมพ์ Slip
                </Button>
              )}

              {!editLimitReached && (
                <Button
                  variant="contained"
                  startIcon={<CheckCircleIcon />}
                  style={{ backgroundColor: "#1552F0", color: "#fff" }}
                  onClick={handleConfirm}
                >
                  ยืนยัน
                </Button>
              )}
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
      <ConfirmProdModal
        open={isConfirmProdOpen}
        onClose={() => setIsConfirmProdOpen(false)}
        material={mat}
        materialName={materialName}
        batch={batch}
        mapping_id={mapping_id}
        prod_id={selectedPlan ? selectedPlan.prod_id : ""}
        selectedLine={selectedLine}
        selectedGroup={selectedGroup}
        onSuccess={handleConfirmSuccess}
        editorName={editorName}
        currentProdDetails={currentProdDetails}
        tray_count={tray_count}
        weight_RM={weight_RM}
        deliveryLocation={deliveryLocation}
        rmStatus={rmStatus}
      />
      {modal3Data && (
        <ModalPrintDetail
          open={isModal3Open}
          onClose={() => {
            setIsModal3Open(false);
            setModal3Data(null);
            onClose(); // ปิด ModalEditPD ด้วย
          }}
          data={modal3Data}
          onEdit={(updatedData) => {
            // ฟังก์ชันนี้จะถูกเรียกเมื่อแก้ไขเวลา QC ใน Modal3
            console.log("QC datetime updated:", updatedData);

            // อัปเดตข้อมูลใน modal3Data
            setModal3Data({
              ...modal3Data,
              qcData: {
                ...modal3Data.qcData,
                qc_datetime_formatted: updatedData.qc_datetime_formatted
              }
            });
          }}
        />
      )}
    </>
  );
};
export default ModalEditPD;