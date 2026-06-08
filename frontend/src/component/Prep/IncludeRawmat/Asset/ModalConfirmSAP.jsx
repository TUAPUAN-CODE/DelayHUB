import React, { useState, useEffect } from "react";
import {
  Modal,
  Box,
  Typography,
  Divider,
  Button,
  Stack,
  TextField,
  RadioGroup,
  Checkbox,
  FormControlLabel,
  Radio,
  Dialog,
  Autocomplete,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import axios from "axios";
axios.defaults.withCredentials = true;
import { height, styled } from "@mui/system";
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';


const API_URL = import.meta.env.VITE_API_URL;

const StyledModal = styled(Modal)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const ModalContent = styled(Box)(({ theme }) => ({
  backgroundColor: "#ffffff",
  padding: "24px",
  width: "100%",
  maxWidth: "800px",
  boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.15)",
  position: "relative",
  maxHeight: "90vh",
  overflow: "auto",
  '&::-webkit-scrollbar': {
    width: '30px',
    height: '30px',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#888',
    borderRadius: '10px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#f1f1f1',
  },
}));

const ModalAlert = ({ open, onClose }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      sx={{
        "& .MuiDialog-paper": {
          borderRadius: 0,
          padding: 3
        }
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box
          sx={{
            backgroundColor: 'white',
            color: '#4caf50',
            borderRadius: 0,
            width: 60,
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 40 }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: '4px', color: '#333' }}>
          บันทึกข้อมูลเรียบร้อยแล้ว
        </Typography>
        <Button
          onClick={onClose}
          sx={{
            backgroundColor: '#4aaaec',
            color: 'white',
            mt: 3,
            paddingX: 4,
            paddingY: 1.5,
            borderRadius: 0,
            '&:hover': {
              backgroundColor: '#4aaaec',
            }
          }}
        >
          ปิด
        </Button>
      </Box>
    </Dialog>
  );
};

const DeleteConfirmationDialog = ({
  open,
  onClose,
  onConfirm,
  planName
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>ยืนยันการลบแผน</DialogTitle>
      <DialogContent>
        <Typography>
          {planName ? `คุณแน่ใจหรือไม่ว่าต้องการลบแผน ${planName}?` : "คุณแน่ใจหรือไม่ว่าต้องการลบแผนนี้?"}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          ยกเลิก
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          ลบ
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ConfirmProdModal = ({
  open,
  onClose,
  material,
  materialName,
  batch,
  selectedPlanSets,
  deliveryLocation,
  emulsion,
  operator,
  weighttotal,
  isLoading,
  setIsLoading,
  onSuccess,
  level_eu,
  emulsionweightTotal,
  hu,
  selectedMaterials
}) => {
  const [showAlert, setShowAlert] = useState(false);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);

  // ⭐ เพิ่มฟังก์ชันนี้
  const handleAlertClose = () => {
    setShowAlert(false);
  };

  const handleConfirm = async () => {
  const currentDateTime = new Date();
  currentDateTime.setHours(currentDateTime.getHours() + 7);
  const formattedDateTime = currentDateTime.toISOString();

  const weightPerPlan = parseFloat(weighttotal) / (selectedPlanSets.length || 1);
  const cleanEuLevel = level_eu === "-" ? "-" : level_eu.replace("Eu ", "").trim();

  try {
    setIsLoading(true);
    setError(null);

    const url = `${API_URL}/api/prep/mix/MixToPack`;

    console.log("=== SENDING PAYLOAD ===");

    const requests = (selectedPlanSets.length > 0 ? selectedPlanSets : [{}]).map(set => {
      const payload = {
        mat: material,
        batch: batch,
        productId: set.plan?.prod_id || null,
        line_name: set.line?.line_name || "",
        groupId: set.group?.rm_group_id ? [set.group.rm_group_id] : [],
        weight: weightPerPlan,
        operator: operator,
        datetime: formattedDateTime,
        Dest: deliveryLocation,
        level_eu: cleanEuLevel,
        hu: hu || null,
        
        // ✅✅✅ แก้เฉพาะบรรทัดนี้ ✅✅✅
        selectedMaterials: (selectedMaterials || []).map(matObj => ({
          mixtp_id: matObj.mixtp_id || matObj.hu || matObj.rmfemu_id,
          mat: matObj.mat,
          batch: matObj.batch,
          weight: matObj.weight,
          level_eu: matObj.level_eu
        }))
      };

      console.log(`Payload for set ${selectedPlanSets.indexOf(set) + 1}:`, JSON.stringify(payload, null, 2));

      return axios.post(url, payload);
    });

    const responses = await Promise.all(requests);
    
    console.log("✅ All responses:", responses);

    if (responses.every(res => res.status === 200)) {
      if (onSuccess) onSuccess();
      setShowAlert(true);
      onClose();
    }
  } catch (error) {
    console.error("❌ Error during API call:", error);
    console.error("❌ Server Response:", error.response?.data);
    
    const errorMessage = error.response?.data?.message || error.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
    
    setError(errorMessage);
    alert(`เกิดข้อผิดพลาด: ${errorMessage}`);
  } finally {
    setIsLoading(false);
  }
};

  // ⭐ เพิ่ม useEffect สำหรับดึง userId (ถ้าจำเป็น)
  useEffect(() => {
    const storedUserId = localStorage.getItem("user_id");
    if (storedUserId) setUserId(storedUserId);
  }, []);

  return (
    <div>
      {isLoading && <CircularProgress />}
      <Dialog
        open={open}
        onClose={(e, reason) => {
          if (reason === 'backdropClick') return;
          onClose();
        }}
        maxWidth="sm"
        fullWidth
      >
        <ModalContent>
          <Typography variant="h6" sx={{ mb: 2 }}>ยืนยันข้อมูลการผลิต</Typography>

          {/* แสดงข้อมูล Plan Sets */}
          {emulsion !== "true" && selectedPlanSets && selectedPlanSets.length > 0 && (
            <Box sx={{ maxHeight: '400px', overflow: 'auto', mb: 2 }}>
              {selectedPlanSets.map((set, index) => (
                <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #eee', borderRadius: 1 }}>
                  <Typography><strong>ชุดที่ {index + 1}:</strong></Typography>
                  <Typography>แผน: {set.plan?.code} ({set.plan?.doc_no})</Typography>
                  <Typography>ไลน์ผลิต: {set.line?.line_name}</Typography>
                  <Typography>กลุ่มเวลา: {set.group?.rm_group_name}</Typography>
                </Box>
              ))}
            </Box>
          )}

          <Typography>น้ำหนักรวม: {weighttotal} กก.</Typography>
          {level_eu !== "-" && <Typography>Level Eu: {level_eu}</Typography>}
          <Typography>ผู้ดำเนินการ: {operator}</Typography>
          <Typography>สถานที่จัดส่ง: {deliveryLocation}</Typography>
          
          {hu && <Typography>HU Number: {hu}</Typography>}

          {emulsionweightTotal && (
            <Typography sx={{ mt: 1 }}>
              <strong>น้ำหนัก Emulsion รวม: {emulsionweightTotal} กก.</strong>
            </Typography>
          )}

          {selectedMaterials && selectedMaterials.length > 0 && (
            <Box sx={{ mt: 2, p: 2, border: '1px solid #ddd', borderRadius: 1, backgroundColor: '#f9f9f9' }}>
              <Typography variant="h6" sx={{ mb: 1 }}>รายการวัตถุดิบ Emulsion:</Typography>
              <Box sx={{ maxHeight: '200px', overflow: 'auto' }}>
                {selectedMaterials.map((matObj, idx) => (
                  <Box key={idx} sx={{ mb: 1, p: 1, backgroundColor: 'white', borderRadius: 1 }}>
                    <Typography variant="body2">
                      <strong>Material:</strong> {matObj.mat || "-"} |
                      <strong> Batch:</strong> {matObj.batch || "-"} |
                      <strong> HU:</strong> {matObj.hu || "-"} |
                      <strong> Weight:</strong> {matObj.weight || "-"} กก. |
                      <strong> Level:</strong> {matObj.level_eu || "-"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
            <Button variant="outlined" onClick={onClose} disabled={isLoading}>
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'กำลังบันทึก...' : 'ยืนยันทั้งหมด'}
            </Button>
          </Stack>
        </ModalContent>
      </Dialog>
      
      {/* ⭐ Modal Alert สำหรับแสดงผลสำเร็จ */}
      <ModalAlert open={showAlert} onClose={handleAlertClose} />
    </div>
  );
};

const DataReviewSAP = ({ open, onClose, material, batch, emulsionweightTotal, hu,selectedMaterials }) => {
  const [selectedPlanSets, setSelectedPlanSets] = useState([]);
  const [materialName, setMaterialName] = useState("");
  const [production, setProduction] = useState([]);
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [emulsion, setemulsion] = useState("false");
  const [jobType, setJobType] = useState("ผสมวัตถุดิบ");
  const [weighttotal, setWeighttotal] = useState("");
  // const [withdraw, setWithdraw] = useState("");
  const [group, setGroup] = useState([]);
  const [operator, setOperator] = useState("");
  const [isConfirmProdOpen, setIsConfirmProdOpen] = useState(false);
  const [weightError, setWeightError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allLinesByType, setAllLinesByType] = useState({});
  const [showDropdowns, setShowDropdowns] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [level_eu, setEuLevel] = useState("-");
  const [canSelectEu, setCanSelectEu] = useState(false);

  // เก็บข้อมูล emulsion ที่ส่งเข้ามา
  const [currentEmulsionWeight, setCurrentEmulsionWeight] = useState("");
  const [currentSelectedMaterials, setCurrentSelectedMaterials] = useState([]);

  // อัปเดตข้อมูล emulsion เมื่อ props เปลี่ยน
  useEffect(() => {
    console.log("DataReviewSAP received props:", {
      material,
      batch,
      emulsionweightTotal,
      selectedMaterials
    });

    setCurrentEmulsionWeight(emulsionweightTotal || "");
    setCurrentSelectedMaterials(selectedMaterials || []);
  }, [material, batch, emulsionweightTotal, selectedMaterials]);

  useEffect(() => {
    if (material) {
      fetchMaterialName();
      fetchProduction();
      fetchGroup();
    }
  }, [material]);

  useEffect(() => {
    if (open) {
      fetchUserDataFromLocalStorage();
    }
  }, [open]);

  const fetchUserDataFromLocalStorage = () => {
    try {
      const firstName = localStorage.getItem('first_name') || '';

      if (firstName) {
        setOperator(`${firstName}`.trim());
      }
    } catch (error) {
      console.error("Error fetching user data from localStorage:", error);
    }
  };

  const fetchMaterialName = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/fetchRawMatName`, { params: { mat: material } });
      if (response.data.success) {
        setMaterialName(response.data.data[0]?.mat_name || "ไม่พบชื่อวัตถุดิบ");
        const rmTypeId = response.data.data[0]?.rm_type_id;
        const allowedTypes = [3, 6, 7, 8];
        setCanSelectEu(allowedTypes.includes(rmTypeId));

        if (!allowedTypes.includes(rmTypeId)) {
          setEuLevel("-");
        }
      }
    } catch (error) {
      console.error("Error fetching material name:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProduction = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/fetchProduction`, { params: { mat: material } });
      if (response.data.success) {
        setProduction(response.data.data);
        setAllLinesByType(response.data.allLinesByType || {});
      }
    } catch (error) {
      console.error("Error fetching production data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGroup = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/fetchGroup`, { params: { mat: material } });
      if (response.data.success) {
        setGroup(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching group data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addNewPlanSet = () => {
    setSelectedPlanSets([...selectedPlanSets, {
      plan: null,
      line: null,
      group: null
    }]);
  };

  const updatePlanSet = (index, field, value) => {
    const updated = [...selectedPlanSets];
    updated[index][field] = value;

    if (field === 'plan' && value) {
      updated[index].line = null;
      updated[index].group = null;
    }

    setSelectedPlanSets(updated);
  };

  const handleRequestDelete = (index) => {
    const planName = selectedPlanSets[index].plan
      ? `${selectedPlanSets[index].plan.code} (${selectedPlanSets[index].plan.doc_no})`
      : null;
    setPlanToDelete({ index, planName });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (planToDelete !== null) {
      const updated = selectedPlanSets.filter((_, i) => i !== planToDelete.index);
      setSelectedPlanSets(updated);
    }
    setDeleteDialogOpen(false);
    setPlanToDelete(null);
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setPlanToDelete(null);
  };

  const validateWeight = (value) => {
    const regex = /^\d*\.?\d*$/;
    return regex.test(value);
  };

  const euOptions = [
    { value: "-", label: "-" },
    ...Array.from({ length: 10 }, (_, i) => ({
      value: (i + 1).toString(),
      label: (i + 1).toString()
    }))
  ];

  const handleWeightChange = (e) => {
    const value = e.target.value;
    if (value === "" || validateWeight(value)) {
      setWeighttotal(value);
      setWeightError(false);
    } else {
      setWeightError(true);
    }
  };

  const isFormComplete = () => {
    if (!weighttotal || isNaN(parseFloat(weighttotal)) || parseFloat(weighttotal) <= 0) {
      return false;
    }

    if (!operator || !deliveryLocation || !emulsion) {
      return false;
    }

    // ถ้าเป็น emulsion = "true" ไม่ต้องเช็ค plan sets
    if (emulsion === "true") {
      return true;
    }

    return selectedPlanSets.every(set =>
      set.plan && set.line && set.group
    );
  };

  const resetForm = () => {
    setSelectedPlanSets([]);
    setDeliveryLocation("");
    setemulsion("false");
    setOperator("");
    // setWithdraw("");
    setWeighttotal("");
    setEuLevel("-");
    setShowDropdowns(true);
    setCurrentEmulsionWeight("");
    setCurrentSelectedMaterials([]);
  };

  const handleSaveSuccess = () => {
    resetForm();
    onClose();
  };

  const handleConfirm = () => {
    if (!weighttotal || isNaN(parseFloat(weighttotal)) || parseFloat(weighttotal) <= 0) {
      setErrorMessage("กรุณากรอกน้ำหนักที่ถูกต้อง");
      setSnackbarOpen(true);
      return;
    }

    if (!isFormComplete()) {
      setErrorMessage("กรุณากรอกข้อมูลให้ครบถ้วน");
      setSnackbarOpen(true);
      return;
    }

    setIsConfirmProdOpen(true);
  };

  const toggleDropdowns = () => {
    setShowDropdowns(!showDropdowns);
  };

  // const handleWithdrawChange = (e) => {
  //   const value = e.target.value;

  //   if (!value) {
  //     setWithdraw(value);
  //     return;
  //   }

  //   const selectedDate = new Date(value + ':00');
  //   const now = new Date();

  //   if (selectedDate >= now) {
  //     alert("ไม่สามารถเลือกเวลาในอนาคตได้");
  //     return;
  //   }

  //   const hours = selectedDate.getHours();
  //   if (hours >= 12) {
  //     alert("กรุณาเลือกเวลาในช่วง AM (00:00 - 11:59)");
  //     return;
  //   }

  //   setWithdraw(value);
  // };

  return (
    <>
      <Dialog
        open={open}
        onClose={(e, reason) => {
          if (reason === 'backdropClick') return;
          onClose();
        }}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            margin: '16px'
          }
        }}
      >
        <ModalContent>
          <Typography variant="h6" sx={{ mb: 2 }}>บันทึกการเบิกวัตถุดิบ</Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography>Material: {material}</Typography>
              <Typography>Material Name: {materialName}</Typography>
              <Typography>Batch: {batch}</Typography>

              {/* แสดงข้อมูล Emulsion ในส่วนข้อมูลพื้นฐาน */}
              {currentEmulsionWeight && (
                <Typography sx={{ mt: 1, color: 'primary.main', fontWeight: 'bold' }}>
                  น้ำหนักรวม: {currentEmulsionWeight} กก.
                </Typography>
              )}

              {currentSelectedMaterials && currentSelectedMaterials.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    รายการวัตถุดิบ Emulsion ({currentSelectedMaterials.length} รายการ):
                  </Typography>
                  <Box sx={{ maxHeight: '150px', overflow: 'auto', mt: 1 }}>
                    {currentSelectedMaterials.map((matObj, idx) => (
                      <Typography key={idx} variant="body2" sx={{ fontSize: '0.85rem', ml: 1 }}>
                        • {matObj.mat || "-"} (Batch: {matObj.batch || "-"},
                        Weight: {matObj.weight || "-"}กก., Level: {matObj.level_eu || "-"})
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>

            <Box>
              <TextField
                label="ผู้ดำเนินการ"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
                required
              />

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <TextField
                  label="น้ำหนักรวม (กก.)"
                  value={weighttotal}
                  onChange={handleWeightChange}
                  error={weightError}
                  helperText={weightError ? "กรุณากรอกเฉพาะตัวเลขเท่านั้น" : ""}
                  fullWidth
                  size="small"
                  required
                  inputProps={{
                    inputMode: 'decimal',
                    pattern: '[0-9]*\\.?[0-9]*'
                  }}
                  sx={{ flex: 1 }}
                />

                <FormControl
                  size="small"
                  sx={{
                    flex: 1,
                    opacity: canSelectEu ? 1 : 0.6
                  }}
                >
                  <InputLabel id="eu-level-label">Level Eu</InputLabel>
                  <Select
                    labelId="eu-level-label"
                    value={level_eu}
                    onChange={(e) => setEuLevel(e.target.value)}
                    label="EU Level"
                    disabled={!canSelectEu}
                    required={canSelectEu}
                  >
                    {euOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  {canSelectEu && (
                    <FormHelperText>กรุณาเลือกระดับ EU</FormHelperText>
                  )}
                </FormControl>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* เลือกประเภทงาน */}
          {/* <Box sx={{ mb: 2 }}>
            <Typography sx={{ mb: 1 }}>วัตถุดิบ Loaf / Chunk</Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={emulsion === "true"}
                  onChange={(e) => setemulsion(e.target.checked ? "true" : "false")}
                />
              }
              label="ผสมวัตถุดิบ"
            />
          </Box> */}

          <Divider sx={{ my: 2 }} />

          {emulsion === "false" && (
            <>
              {/* แผนการผลิต */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">แผนการผลิต</Typography>
                <Box>
                  <IconButton onClick={toggleDropdowns} size="small" sx={{ mr: 1 }}>
                    <VisibilityIcon color={showDropdowns ? "primary" : "action"} />
                  </IconButton>
                  <Button
                    onClick={addNewPlanSet}
                    startIcon={<AddIcon />}
                    variant="outlined"
                    size="small"
                  >
                    เพิ่มแผน
                  </Button>
                </Box>
              </Box>

              <Box sx={{
                maxHeight: '400px',
                overflow: 'auto',
                mb: 2,
                '&::-webkit-scrollbar': {
                  width: '17px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: '#f1f1f1',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: '#888',
                  borderRadius: '10px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  backgroundColor: '#555',
                },
              }}>
                {selectedPlanSets.map((set, index) => (
                  <Box
                    key={index}
                    sx={{
                      mb: 2,
                      p: 2,
                      border: '1px solid #eee',
                      borderRadius: 1,
                      backgroundColor: '#f9f9f9'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography><strong>ชุดที่ {index + 1}</strong></Typography>
                      <Button
                        onClick={() => handleRequestDelete(index)}
                        startIcon={<DeleteIcon />}
                        color="error"
                        size="small"
                      >
                        ลบ
                      </Button>
                    </Box>

                    {showDropdowns && (
                      <>
                        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexDirection: { xs: 'column', md: 'row' } }}>
                          <Autocomplete
                            sx={{ flex: 2 }}
                            options={production}
                            getOptionLabel={(option) => `${option.code} (${option.doc_no})`}
                            value={set.plan}
                            onChange={(e, newValue) => updatePlanSet(index, 'plan', newValue)}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="แผนการผลิต"
                                size="small"
                                fullWidth
                                required
                              />
                            )}
                          />

                          <Autocomplete
                            sx={{ flex: 1 }}
                            options={set.plan?.line_type_id ? (allLinesByType[set.plan.line_type_id] || []) : []}
                            getOptionLabel={(option) => option.line_name}
                            value={set.line}
                            onChange={(e, newValue) => updatePlanSet(index, 'line', newValue)}
                            renderInput={(params) => (
                              <TextField {...params} label="เลือกไลน์ผลิต" size="small" fullWidth required />
                            )}
                            disabled={!set.plan}
                          />
                        </Box>

                        <Autocomplete
                          options={group}
                          getOptionLabel={(option) => option.rm_group_name}
                          value={set.group}
                          onChange={(e, newValue) => updatePlanSet(index, 'group', newValue)}
                          renderInput={(params) => (
                            <TextField {...params} label="กลุ่มเวลาการผลิต" size="small" fullWidth required />
                          )}
                          disabled={!set.plan}
                        />
                      </>
                    )}

                    {!showDropdowns && set.plan && (
                      <Box>
                        <Typography>
                          {set.plan.code} ({set.plan.doc_no}) - {set.line?.line_name || 'ยังไม่ได้เลือกไลน์'}
                        </Typography>
                        {set.group && (
                          <Typography sx={{ color: 'text.secondary' }}>
                            - {set.group.rm_group_name}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 2 }} />
            </>
          )}


          <>
            {/* วันที่เบิก */}
            {/* <Box sx={{ mb: 2 }}>
              <Typography sx={{ mb: 1 }}>วันที่เบิกวัตถุดิบจากห้องเย็นใหญ่</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DateTimePicker
                    label="วันที่เบิก"
                    value={withdraw ? dayjs(withdraw) : null}
                    onChange={(newValue) => {
                      if (newValue && newValue.isAfter(dayjs())) {
                        alert("ไม่สามารถเลือกเวลาในอนาคตได้");
                        return;
                      }
                      setWithdraw(newValue?.toISOString() || "");
                    }}
                    maxDateTime={dayjs()}
                    ampm={false}
                    timeSteps={{ minutes: 1 }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: "small",
                        required: true
                      }
                    }}
                  />
                </LocalizationProvider>
                <Button
                  variant="outlined"
                  onClick={() => {
                    const now = new Date();
                    now.setHours(now.getHours() + 7); // เวลาไทย
                    const formattedDateTime = now.toISOString().slice(0, 16);
                    setWithdraw(formattedDateTime);
                  }}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  เลือกเวลาตอนนี้
                </Button>
              </Box>
            </Box> */}

            {/* สถานที่จัดส่ง */}
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ mb: 1 }}>สถานที่จัดส่ง</Typography>
              <RadioGroup
                row
                name="location"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                sx={{ flexWrap: 'wrap' }}
              >
                <FormControlLabel value="จุดเตรียม" control={<Radio />} label="จุดเตรียม" />
              </RadioGroup>
            </Box>
            {/* น้ำหนักรวม Emulsion */}

          </>

          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={onClose}
              startIcon={<CancelIcon />}
            >
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirm}
              disabled={!isFormComplete() || isLoading}
              startIcon={<CheckCircleIcon />}
            >
              {isLoading ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
            </Button>
          </Box>
        </ModalContent>
      </Dialog>

      <ConfirmProdModal
        open={isConfirmProdOpen}
        onClose={() => setIsConfirmProdOpen(false)}
        material={material}
        materialName={materialName}
        batch={batch}
        selectedPlanSets={selectedPlanSets.filter(set => set.plan && set.line && set.group)}
        deliveryLocation={deliveryLocation}
        emulsion={emulsion}
        operator={operator}
        // withdraw={withdraw}
        weighttotal={weighttotal}
        level_eu={level_eu} 
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        onSuccess={handleSaveSuccess}
        emulsionweightTotal={currentEmulsionWeight}
        selectedMaterials={currentSelectedMaterials}
      />


      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        planName={planToDelete?.planName}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSnackbarOpen(false)}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default DataReviewSAP;