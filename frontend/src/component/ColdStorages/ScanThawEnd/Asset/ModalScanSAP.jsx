import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Alert,
  Autocomplete,
  TextField,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Chip,
  InputAdornment,
  TableSortLabel,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Stack,
  Collapse,
  Tooltip
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import QrScanner from "qr-scanner";
import okSound from "./Sound OK.mp3"

const API_URL = import.meta.env.VITE_API_URL;

const getTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// ✅ แยก weight จาก QR string เช่น "120.\n000\kg" → "120.000"
const parseWeight = (raw) => {
  if (!raw) return null;
  // ลบทุกอย่างที่ไม่ใช่ตัวเลขและจุด
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const ALL_TIME_FIELDS = [
  { key: 'start_defrost_date',       label: 'เริ่มละลาย',                color: '#0277bd', bg: '#EAF0FF' },
  { key: 'end_defrost_date',         label: 'ละลายเสร็จ',                color: '#0277bd', bg: '#EAF0FF' },
  { key: 'start_defrost_date_two',   label: 'เริ่มละลาย (รอบ 2)',        color: '#0277bd', bg: '#EAF0FF' },
  { key: 'end_defrost_date_two',     label: 'ละลายเสร็จ (รอบ 2)',        color: '#0277bd', bg: '#EAF0FF' },
  { key: 'start_defrost_date_three', label: 'เริ่มละลาย (รอบ 3)',        color: '#0277bd', bg: '#EAF0FF' },
  { key: 'end_defrost_date_three',   label: 'ละลายเสร็จ (รอบ 3)',        color: '#0277bd', bg: '#EAF0FF' },
  { key: 'start_defrost_date_four',  label: 'เริ่มละลาย (รอบ 4)',        color: '#0277bd', bg: '#EAF0FF' },
  { key: 'end_defrost_date_four',    label: 'ละลายเสร็จ (รอบ 4)',        color: '#0277bd', bg: '#EAF0FF' },
  { key: 'withdraw_date',            label: 'ส่งออกห้องเย็น',             color: '#0F3FC4', bg: '#e8eaf6' },
  { key: 'input_pd_date',            label: 'ไลน์รับเข้า รอบ 1',         color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date',           label: 'ไลน์ส่งคืน รอบ 1',          color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date',            label: 'ห้องเย็นรับเข้า รอบ 1',     color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_two',        label: 'ส่งออกห้องเย็น รอบ 2',      color: '#0F3FC4', bg: '#e8eaf6' },
  { key: 'input_pd_date_two',        label: 'ไลน์รับเข้า รอบ 2',         color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date_two',       label: 'ไลน์ส่งคืน รอบ 2',          color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date_two',        label: 'ห้องเย็นรับเข้า รอบ 2',     color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_three',      label: 'ส่งออกห้องเย็น รอบ 3',      color: '#0F3FC4', bg: '#e8eaf6' },
  { key: 'input_pd_date_three',      label: 'ไลน์รับเข้า รอบ 3',         color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date_three',     label: 'ไลน์ส่งคืน รอบ 3',          color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date_three',      label: 'ห้องเย็นรับเข้า รอบ 3',     color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_four',       label: 'ส่งออกห้องเย็น รอบ 4',      color: '#0F3FC4', bg: '#e8eaf6' },
];

const TimeSubRow = ({ row, colSpan }) => {
  const sorted = ALL_TIME_FIELDS
    .filter(f => row[f.key])
    .map(f => ({ ...f, value: row[f.key] }))
    .sort((a, b) => new Date(a.value.replace(' ', 'T')) - new Date(b.value.replace(' ', 'T')));

  if (sorted.length === 0) return null;

  return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ p: 0, border: 0 }}>
        <Box sx={{ px: 2, py: 1.5, bgcolor: '#f8f9fa', borderBottom: '1px solid #E3E8F2' }}>
          <Typography sx={{ fontSize: '11px', color: '#888', mb: 1, fontWeight: 600, letterSpacing: '0.5px' }}>
            TIMELINE
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', overflowX: 'auto', pb: 1, gap: 0 }}>
            {sorted.map((f, i) => (
              <Box key={f.key} sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <Box sx={{
                  position: 'relative', minWidth: '110px', maxWidth: '140px',
                  bgcolor: f.bg, border: `1px solid ${f.color}`,
                  borderRadius: '6px', px: 1.5, pt: 2, pb: 1,
                }}>
                  <Box sx={{
                    position: 'absolute', top: '-10px', left: '8px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    bgcolor: f.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700,
                  }}>{i + 1}</Box>
                  <Typography sx={{ fontSize: '10px', color: f.color, fontWeight: 600, lineHeight: 1.2, mb: 0.5 }}>
                    {f.label}
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: '#333', fontWeight: 500 }}>
                    {f.value}
                  </Typography>
                </Box>
                {i < sorted.length - 1 && (
                  <Typography sx={{ mx: 0.5, color: '#bbb', fontSize: '18px', flexShrink: 0 }}>›</Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </TableCell>
    </TableRow>
  );
};

const DataRow = ({ row, index }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <TableRow key={`${row.mat}_${row.batch}_${row.hu}_${index}`} hover>
        <TableCell>{index + 1}</TableCell>
        <TableCell>{row.mat || '-'}</TableCell>
        <TableCell>{row.batch || '-'}</TableCell>
        <TableCell>{row.hu || '-'}</TableCell>
        <TableCell sx={{ color: row.weight ? '#2e7d32' : '#bbb', fontWeight: row.weight ? 600 : 400 }}>
          {row.weight != null ? `${row.weight} kg` : '-'}
        </TableCell>
      
        <TableCell sx={{ p: 0, textAlign: 'center', width: '48px' }}>
          <Tooltip title={expanded ? 'ซ่อนข้อมูลเวลา' : 'ดูข้อมูลเวลา'} placement="left">
            <Box
              onClick={() => setExpanded(prev => !prev)}
              sx={{
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', width: '100%', height: '100%', py: 1,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
              }}
            >
              {expanded
                ? <VisibilityOffIcon sx={{ color: '#0F3FC4', fontSize: '20px' }} />
                : <VisibilityIcon sx={{ color: '#9e9e9e', fontSize: '20px' }} />}
            </Box>
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={8} sx={{ p: 0, border: 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <TimeSubRow row={row} colSpan={8} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const CameraActivationModal = ({ open, onClose }) => {
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const scannedSetRef = useRef(new Set());
  const isInitializedRef = useRef(false);
  const scannerInputRef = useRef("");
  const processingRef = useRef(false);
  const lastScanTimeRef = useRef(0);

  const [scanMode, setScanMode] = useState("usb");
  const [scannerActive, setScannerActive] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [primaryBatch, setPrimaryBatch] = useState("");
  const [secondaryBatch, setSecondaryBatch] = useState("");
  const [hu, setHu] = useState("");
  const [weight, setWeight] = useState(""); // ✅ เพิ่ม state น้ำหนัก
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderBy, setOrderBy] = useState("start_defrost_date");
  const [order, setOrder] = useState("desc");

  const fetchTableData = async (dateStr) => {
    setTableLoading(true);
    try {
      const date = dateStr || selectedDate;
      const response = await fetch(
        `${API_URL}/api/coldstorages/scan/sap/end/defrost?date=${date}`,
        { credentials: "include" }
      );
      const data = await response.json();
      let rawData = [];
      if (Array.isArray(data)) rawData = data;
      else if (data.success) rawData = data.data;
      else console.error("API Error:", data.message || "Unknown error");

      const uniqueData = Array.from(
        new Map(rawData.map((item) => [`${item.mat}_${item.batch}_${item.hu}`, item])).values()
      );
      setTableData(uniqueData);
      setFilteredData(uniqueData);
      scannedSetRef.current = new Set(uniqueData.map((item) => `${item.mat}_${item.batch}_${item.hu}`));
    } catch (error) {
      console.error("Error fetching data:", error);
      setTableData([]);
      setFilteredData([]);
    } finally {
      setTableLoading(false);
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setSearchQuery("");
    fetchTableData(newDate);
  };

  const fetchRawMaterials = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/rawmat/AllSearch`, { credentials: "include" });
      const data = await response.json();
      if (data.success) {
        const uniqueMaterials = Array.from(new Map(data.data.map((item) => [item.mat, item])).values());
        setRawMaterials(uniqueMaterials);
      } else {
        setError("ไม่สามารถดึงข้อมูลวัตถุดิบได้");
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const qrScanner = new QrScanner(
          videoRef.current,
          (result) => handleScannedData(result.data),
          { highlightScanRegion: true, highlightCodeOutline: true }
        );
        qrScannerRef.current = qrScanner;
        qrScanner.start();
      }
    } catch (err) {
      setError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    qrScannerRef.current?.stop();
  };

  const handleScannedData = (result) => {
    if (!scannerActive) return;
    const now = Date.now();
    if (now - lastScanTimeRef.current < 1000) return;
    lastScanTimeRef.current = now;
    if (processingRef.current) return;

    const parts = result.split("|");
    if (parts.length < 3) { setError("รูปแบบ QR Code ไม่ถูกต้อง"); return; }

    const rawMat = parts[0].trim();
    const batch = parts[1].trim().slice(0, 10).toUpperCase();
    const huValue = parts[2].trim().slice(0, 9);

    // ✅ ดึง weight จาก part ที่ 4 (ถ้ามี) เช่น "120.\n000\kg" → 120.000
    const weightValue = parts.length > 3 ? parseWeight(parts[3]) : null;

    if (batch.length !== 10 || huValue.length !== 9) {
      setError(`ข้อมูลไม่ครบ - Batch: ${batch.length}/10, HU: ${huValue.length}/9`);
      return;
    }

    const uniqueKey = `${rawMat}_${batch}_${huValue}`;

    processingRef.current = true;
    setProcessing(true);
    setError("");
    setPrimaryBatch(rawMat);
    setSecondaryBatch(batch);
    setHu(huValue);
    setWeight(weightValue !== null ? String(weightValue) : ""); // ✅ แสดงน้ำหนัก
    setInputValue(rawMat);
    handleConfirmData(rawMat, batch, huValue, weightValue, uniqueKey);
  };

  const playOkSound = () => {
    try {
      const audio = new Audio(okSound);
      audio.volume = 1;
      audio.play().catch((e) => console.warn("Sound error:", e));
    } catch (e) {
      console.warn("Sound error:", e);
    }
  };

  // ✅ ส่ง weight ไปด้วย
  const handleConfirmData = async (mat, batch, huValue, weightValue, uniqueKey) => {
    try {
      const response = await fetch(`${API_URL}/api/coldstorages/scan/sap/end/defrost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mat,
          batch,
          hu: huValue,
          weight: weightValue, // ✅ ส่ง weight ไป API (null ถ้าไม่มีใน QR)
        }),
      });
      const data = await response.json();
      if (response.ok) {
        scannedSetRef.current.add(uniqueKey);
        await fetchTableData(selectedDate);
        setError("");
        playOkSound();
      } else {
        setError(data.message || "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
      }
    } catch (err) {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const handleStartScanner = () => {
    setScannerActive(true);
    setError("");
    if (scanMode === "camera" && !videoRef.current?.srcObject) startCamera();
  };

  const handleStopScanner = () => {
    setScannerActive(false);
    scannerInputRef.current = "";
    if (scanMode === "camera") stopCamera();
  };

  const handleSearch = (query) => {
    const q = query.trim().toLowerCase();
    setSearchQuery(query);
    if (!q) { setFilteredData(tableData); return; }
    setFilteredData(tableData.filter((row) =>
      Object.values(row).some((val) => String(val || "").toLowerCase().includes(q))
    ));
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
    const sorted = [...filteredData].sort((a, b) => {
      let aValue = a[property] || "";
      let bValue = b[property] || "";
      if (property === "start_defrost_date") {
        aValue = new Date(aValue).getTime() || 0;
        bValue = new Date(bValue).getTime() || 0;
      }
      if (aValue < bValue) return isAsc ? 1 : -1;
      if (aValue > bValue) return isAsc ? -1 : 1;
      return 0;
    });
    setFilteredData(sorted);
  };

  useEffect(() => {
    if (scanMode !== "usb" || !open || !scannerActive) return;
    const handleKeyPress = (e) => {
      if (processingRef.current) { e.preventDefault(); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        if (scannerInputRef.current.trim()) {
          handleScannedData(scannerInputRef.current.trim());
          scannerInputRef.current = "";
        }
      } else if (e.key.length === 1) {
        scannerInputRef.current += e.key;
      }
    };
    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, [scanMode, open, scannerActive]);

  const handleScanModeChange = (event, newMode) => {
    if (newMode === null) return;
    setScannerActive(false);
    setScanMode(newMode);
    stopCamera();
    scannerInputRef.current = "";
  };

  useEffect(() => {
    if (open && !isInitializedRef.current) {
      isInitializedRef.current = true;
      fetchRawMaterials();
      fetchTableData(getTodayStr());
    }
    return () => {
      if (!open) {
        stopCamera();
        isInitializedRef.current = false;
        scannerInputRef.current = "";
        processingRef.current = false;
        lastScanTimeRef.current = 0;
        setScannerActive(false);
      }
    };
  }, [open]);

  useEffect(() => { setFilteredData(tableData); }, [tableData]);

  if (!open) return null;

  return (
    <Box sx={{ display: "flex", height: "100vh", gap: 2, p: 2, bgcolor: "#ffbf00" }}>
      <Paper sx={{ flex: "0 0 400px", p: 3, overflow: "auto", boxShadow: "0px 2px 8px rgba(0,0,0,0.1)" }}>
        <Typography variant="h6" sx={{ mb: 2, color: "#545454" }}>สแกน QR Code เพื่อบันทึกเวลาละลายเสร็จ</Typography>

        <ToggleButtonGroup value={scanMode} exclusive onChange={handleScanModeChange} fullWidth sx={{ mb: 2 }}>
          <ToggleButton value="usb"><QrCodeScannerIcon sx={{ mr: 1 }} />USB Scanner</ToggleButton>
          <ToggleButton value="camera"><CameraAltIcon sx={{ mr: 1 }} />กล้อง</ToggleButton>
        </ToggleButtonGroup>

        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Button variant="contained" color="success" startIcon={<PlayArrowIcon />} onClick={handleStartScanner} disabled={scannerActive} fullWidth>เริ่มสแกน</Button>
          <Button variant="contained" color="error" startIcon={<StopIcon />} onClick={handleStopScanner} disabled={!scannerActive} fullWidth>หยุดสแกน</Button>
        </Stack>

        {scannerActive
          ? <Alert severity="success" sx={{ mb: 2 }}>🟢 Scanner กำลังทำงาน - พร้อมรับข้อมูล</Alert>
          : <Alert severity="warning" sx={{ mb: 2 }}>⚪ Scanner หยุดทำงาน - กดปุ่ม "เริ่มสแกน" เพื่อเปิดใช้งาน</Alert>
        }

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
        {processing && <Alert severity="info" sx={{ mb: 2 }}>กำลังประมวลผล...</Alert>}

        {scanMode === "camera" && scannerActive && (
          <video ref={videoRef} style={{ width: "100%", margin: "15px 0", borderRadius: "8px", border: "2px solid #4caf50" }} autoPlay muted playsInline />
        )}

        <Autocomplete
          options={rawMaterials} loading={loading}
          value={rawMaterials.find((m) => m.mat === primaryBatch) || null}
          inputValue={inputValue} getOptionLabel={(o) => o.mat || ""} readOnly disabled
          renderInput={(params) => (
            <TextField {...params} label="Raw Material" size="small" margin="normal" InputProps={{ ...params.InputProps, readOnly: true }} />
          )}
        />
        <TextField fullWidth label="Batch" size="small" margin="normal" value={secondaryBatch} InputProps={{ readOnly: true }} />
        <TextField fullWidth label="HU" size="small" margin="normal" value={hu} InputProps={{ readOnly: true }} />
        {/* ✅ แสดงน้ำหนักที่อ่านได้จาก QR */}
        <TextField
          fullWidth label="น้ำหนัก (kg)" size="small" margin="normal"
          value={weight} InputProps={{ readOnly: true }}
          sx={{ "& .MuiInputBase-input": { color: weight ? "#2e7d32" : "inherit", fontWeight: weight ? 600 : 400 } }}
        />
      </Paper>

      <Paper sx={{ flex: 1, p: 3, overflow: "auto", boxShadow: "0px 2px 8px rgba(0,0,0,0.1)" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
          <Typography variant="h6" sx={{ color: "#545454" }}>ข้อมูลที่สแกนแล้ว</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <TextField type="date" size="small" label="เลือกวันที่" value={selectedDate} onChange={handleDateChange}
              inputProps={{ max: getTodayStr() }} InputLabelProps={{ shrink: true }} sx={{ width: 180 }} />
            <Chip label={`${filteredData.length} รายการ`} color="primary" size="small" />
          </Box>
        </Box>

        <TextField fullWidth size="small" placeholder="ค้นหา Raw Material, Batch, HU, วันที่..." value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)} sx={{ mb: 2 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        />

        {tableLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
        ) : (
          <TableContainer sx={{ maxHeight: "calc(100vh - 250px)" }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell><strong>ลำดับ</strong></TableCell>
                  <TableCell><TableSortLabel active={orderBy === "mat"} direction={orderBy === "mat" ? order : "asc"} onClick={() => handleSort("mat")}><strong>Raw Material</strong></TableSortLabel></TableCell>
                  <TableCell><TableSortLabel active={orderBy === "batch"} direction={orderBy === "batch" ? order : "asc"} onClick={() => handleSort("batch")}><strong>Batch</strong></TableSortLabel></TableCell>
                  <TableCell><TableSortLabel active={orderBy === "hu"} direction={orderBy === "hu" ? order : "asc"} onClick={() => handleSort("hu")}><strong>HU</strong></TableSortLabel></TableCell>
                  <TableCell><strong>น้ำหนัก (kg)</strong></TableCell>
                  <TableCell sx={{ width: '48px' }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        {searchQuery ? "ไม่พบข้อมูลที่ค้นหา" : `ไม่มีข้อมูลในวันที่ ${selectedDate}`}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((row, index) => (
                    <DataRow key={`${row.mat}_${row.batch}_${row.hu}_${index}`} row={row} index={index} />
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default CameraActivationModal;