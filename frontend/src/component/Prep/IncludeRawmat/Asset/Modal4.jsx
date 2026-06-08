// SlottrolleyModal.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import MixIcon from "@mui/icons-material/Blender";
import RefreshIcon from "@mui/icons-material/Refresh";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import SearchIcon from "@mui/icons-material/Search";
import {
  AppBar,
  Backdrop,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
  Alert,
  IconButton,
  InputAdornment,
} from "@mui/material";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

const Modal4 = ({ open, onClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [filteredMaterials, setFilteredMaterials] = useState([]); // ✅ เพิ่ม state สำหรับ filter
  const [selectedWeights, setSelectedWeights] = useState({});
  const [searchTerm, setSearchTerm] = useState(""); // ✅ ช่องค้นหา

  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ ดึงข้อมูลวัตถุดิบ
  const fetchMaterials = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/prep/getMixToPack`);
      // const res = await axios.get(`${API_URL}/api/checkin/MixToPack`);
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        setMaterials(res.data.data);
        setFilteredMaterials(res.data.data); // ✅ ตั้งค่าเริ่มต้น
      } else {
        setMaterials([]);
        setFilteredMaterials([]);
        showSnackbar("ไม่พบรายการวัตถุดิบ", "warning");
      }
    } catch (err) {
      console.error("fetchMaterials error", err);
      showSnackbar("ไม่สามารถดึงข้อมูลวัตถุดิบได้", "error");
      setMaterials([]);
      setFilteredMaterials([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMaterials();
    }
  }, [open]);

  const showSnackbar = (msg, severity = "info") => {
    setSnackbarMsg(msg);
    setSnackbarSeverity(severity);
    setOpenSnackbar(true);
  };

  // ✅ ฟังก์ชันค้นหา
  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);

    if (!term) {
      setFilteredMaterials(materials);
      return;
    }

    const filtered = materials.filter((m) => {
      const mat = (m.mat ?? "").toString().toLowerCase();
      const batch = (m.batch ?? "").toString().toLowerCase();
      const hu = (m.hu ?? "").toString().toLowerCase();
      return mat.includes(term) || batch.includes(term) || hu.includes(term);
    });

    setFilteredMaterials(filtered);
  };

  const onWeightChange = (mixtp_id, value) => {
    const numValue = parseFloat(value) || 0;
    const material = materials.find((m) => m.mixtp_id === mixtp_id);

    if (material && numValue > material.weight) {
      showSnackbar(`น้ำหนักไม่สามารถเกิน ${material.weight} กก.`, "warning");
      return;
    }

    setSelectedWeights((prev) => ({
      ...prev,
      [mixtp_id]: numValue,
    }));
  };

  const onRefresh = async () => {
    await fetchMaterials();
    setSelectedWeights({});
    setSearchTerm(""); // ✅ รีเซ็ตช่องค้นหา
    showSnackbar("อัปเดตข้อมูลแล้ว", "success");
  };

  const getSelectedMaterials = () =>
    materials.filter(
      (m) => selectedWeights[m.mixtp_id] && selectedWeights[m.mixtp_id] > 0
    );

  const getTotalWeight = () =>
    Object.values(selectedWeights).reduce((sum, w) => sum + (w || 0), 0);

  const onMixClick = () => {
    const selectedMaterials = getSelectedMaterials();

    // ✅ ตรวจสอบว่าเลือกอย่างน้อย 1 รายการ
    if (selectedMaterials.length === 0) {
      showSnackbar("กรุณาเลือกวัตถุดิบและกรอกน้ำหนักอย่างน้อย 1 รายการ", "warning");
      return;
    }

    // 🔍 ฟังก์ชันแยกเอาแค่ doc_no (ตัดส่วน Line/Cup ออก)
    const getDocNo = (production) => {
      if (!production) return "";
      // ตัด "M152 (Cup1)" → เหลือ "M152"
      return production.split(' (')[0].trim();
    };

    const firstDocNo = getDocNo(selectedMaterials[0].production);
    const allSameDocNo = selectedMaterials.every(
      (m) => getDocNo(m.production) === firstDocNo
    );

    if (!allSameDocNo) {
      showSnackbar("ไม่สามารถผสมได้เนื่องจากคนละ Doc", "error");
      return;
    }

    // ✅ ผ่านเงื่อนไข ส่งข้อมูลกลับไป modal ถัดไป
    handleClose();
  };

  const handleClose = () => {
    const selectedMaterials = getSelectedMaterials().map((m) => ({
      mixtp_id: m.mixtp_id,
      mat: m.mat,
      batch: m.batch,
      hu: m.hu,
      weight: selectedWeights[m.mixtp_id],
      level_eu: m.level_eu,
    }));

    const totalWeight = getTotalWeight();

    if (typeof onClose === "function") {
      onClose({ selectedMaterials, totalWeight });
    }
  };

  return (
    <Fade in={open}>
      <Backdrop
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={open}
        onClick={(e) => e.stopPropagation()}
      >
        <Paper
          elevation={8}
          className="bg-white rounded-lg shadow-lg w-[1200px] h-[700px] overflow-hidden flex flex-col"
          style={{ color: "#585858" }}
        >
          {/* Header */}
          <AppBar position="static" sx={{ backgroundColor: "#4e73df" }}>
            <Toolbar sx={{ minHeight: "50px", px: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <WarehouseIcon sx={{ mr: 1 }} />
                <Typography variant="h6">การผสมวัตถุดิบ</Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton color="inherit" onClick={onRefresh} disabled={isLoading}>
                {isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  <RefreshIcon />
                )}
              </IconButton>
            </Toolbar>
          </AppBar>

          {/* Content */}
          <Box sx={{ flex: 1, p: 2, overflow: "auto" }}>
            {/* 🔍 ช่องค้นหา */}
            <Box sx={{ mb: 2, display: "flex", justifyContent: "flex-end" }}>
              <TextField
                size="small"
                placeholder="ค้นหารหัสวัตถุดิบ / batch / HU"
                value={searchTerm}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: 300 }}
              />
            </Box>

            <Typography variant="h6" sx={{ mb: 2 }}>
              รายการวัตถุดิบ
            </Typography>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ backgroundColor: "#f8f9fc" }}>
                  <TableRow>
                    <TableCell align="center">ลำดับ</TableCell>
                    <TableCell>รหัสวัตถุดิบ</TableCell>
                    <TableCell>Batch</TableCell>
                    <TableCell>HU</TableCell>
                    <TableCell align="right">น้ำหนักคงเหลือ (กก.)</TableCell>
                    <TableCell>ระดับ EU</TableCell>
                    <TableCell>เวลา QC ตรวจสอบ</TableCell>
                    <TableCell align="center">น้ำหนักที่เลือก (กก.)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredMaterials.map((item, index) => (
                    <TableRow key={item.mixtp_id}>
                      <TableCell align="center">{index + 1}</TableCell>
                      <TableCell>{item.mat}</TableCell>
                      <TableCell>{item.batch}</TableCell>
                      <TableCell>{item.hu}</TableCell>
                      <TableCell align="right">
                        {item.weight_RM != null ? item.weight_RM.toFixed(2) : "0.00"}
                      </TableCell>
                      <TableCell>{item.level_eu}</TableCell>
                      <TableCell>
                        {item.qc_date
                          ? new Date(item.qc_date).toLocaleString("th-TH")
                          : "-"}
                      </TableCell>

                      <TableCell align="center">
                        <TextField
                          size="small"
                          type="number"
                          value={selectedWeights[item.mixtp_id] || ""}
                          onChange={(e) =>
                            onWeightChange(item.mixtp_id, e.target.value)
                          }
                          inputProps={{
                            step: "0.01",
                            min: "0",
                            max: (item.weight_RM ?? 0).toString(),
                          }}
                          sx={{ width: 120 }}
                          placeholder="0.00"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredMaterials.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        {isLoading ? "กำลังโหลดข้อมูล..." : "ไม่มีรายการวัตถุดิบ"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Summary */}
            <Box
              sx={{
                mt: 2,
                p: 2,
                backgroundColor: "#f8f9fc",
                borderRadius: 1,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="h6">
                จำนวนรายการที่เลือก: {getSelectedMaterials().length} รายการ
              </Typography>
              <Typography variant="h6" color="primary">
                น้ำหนักรวม: {getTotalWeight().toFixed(2)} กก.
              </Typography>
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: "flex", gap: 2, mt: 2, justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                startIcon={<MixIcon />}
                onClick={onMixClick}
                disabled={isSubmitting || getSelectedMaterials().length === 0}
                size="large"
              >
                ผสมวัตถุดิบ
              </Button>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={handleClose}
                disabled={isSubmitting}
                size="large"
              >
                ยกเลิก
              </Button>
            </Box>
          </Box>

          {/* Snackbar */}
          <Snackbar
            open={openSnackbar}
            autoHideDuration={3000}
            onClose={() => setOpenSnackbar(false)}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <Alert
              onClose={() => setOpenSnackbar(false)}
              severity={snackbarSeverity}
              variant="filled"
            >
              {snackbarMsg}
            </Alert>
          </Snackbar>
        </Paper>
      </Backdrop>
    </Fade>
  );
};

export default Modal4;
