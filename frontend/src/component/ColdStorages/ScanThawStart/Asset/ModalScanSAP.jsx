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

// ทุก timestamp field พร้อม label และ color ตามประเภท
const ALL_TIME_FIELDS = [
  { key: 'start_defrost_date',       label: 'เริ่มละลาย',               color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date',         label: 'ละลายเสร็จ',               color: '#0277bd', bg: '#e3f2fd' },
  { key: 'start_defrost_date_two',   label: 'เริ่มละลาย (รอบ 2)',       color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date_two',     label: 'ละลายเสร็จ (รอบ 2)',       color: '#0277bd', bg: '#e3f2fd' },
  { key: 'start_defrost_date_three', label: 'เริ่มละลาย (รอบ 3)',       color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date_three',   label: 'ละลายเสร็จ (รอบ 3)',       color: '#0277bd', bg: '#e3f2fd' },
  { key: 'start_defrost_date_four',  label: 'เริ่มละลาย (รอบ 4)',       color: '#0277bd', bg: '#e3f2fd' },
  { key: 'end_defrost_date_four',    label: 'ละลายเสร็จ (รอบ 4)',       color: '#0277bd', bg: '#e3f2fd' },
  { key: 'withdraw_date',            label: 'ส่งออกห้องเย็น',            color: '#1565C0', bg: '#e8eaf6' },
  { key: 'input_pd_date',            label: 'ไลน์รับเข้า รอบ 1',        color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date',           label: 'ไลน์ส่งคืน รอบ 1',         color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date',            label: 'ห้องเย็นรับเข้า รอบ 1',    color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_two',        label: 'ส่งออกห้องเย็น รอบ 2',     color: '#1565C0', bg: '#e8eaf6' },
  { key: 'input_pd_date_two',        label: 'ไลน์รับเข้า รอบ 2',        color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date_two',       label: 'ไลน์ส่งคืน รอบ 2',         color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date_two',        label: 'ห้องเย็นรับเข้า รอบ 2',    color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_three',      label: 'ส่งออกห้องเย็น รอบ 3',     color: '#1565C0', bg: '#e8eaf6' },
  { key: 'input_pd_date_three',      label: 'ไลน์รับเข้า รอบ 3',        color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'output_pd_date_three',     label: 'ไลน์ส่งคืน รอบ 3',         color: '#e65100', bg: '#fff3e0' },
  { key: 'input_cd_date_three',      label: 'ห้องเย็นรับเข้า รอบ 3',    color: '#6a1b9a', bg: '#f3e5f5' },
  { key: 'withdraw_date_four',       label: 'ส่งออกห้องเย็น รอบ 4',     color: '#1565C0', bg: '#e8eaf6' },
];

// ─── TimeSubRow ───────────────────────────────────────────────────────────────
const TimeSubRow = ({ row, colSpan }) => {
  const sorted = ALL_TIME_FIELDS
    .filter(f => row[f.key])
    .map(f => ({ ...f, value: row[f.key] }))
    .sort((a, b) => new Date(a.value.replace(' ', 'T')) - new Date(b.value.replace(' ', 'T')));

  return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ p: 0, border: 'none' }}>
        <Collapse in timeout="auto" unmountOnExit>
          <Box sx={{ py: 1.5, px: 2, backgroundColor: '#f8fafc', borderBottom: '1px solid #e0e0e0', overflowX: 'auto' }}>
            {sorted.length === 0 ? (
              <Typography sx={{ fontSize: '13px', color: '#9e9e9e', fontStyle: 'italic' }}>
                ยังไม่มีข้อมูลเวลา
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}>
                {sorted.map((item, idx) => (
                  <React.Fragment key={item.key}>
                    <Box sx={{
                      border: `1.5px solid ${item.color}50`,
                      borderRadius: '8px',
                      backgroundColor: item.bg,
                      px: 1.5, py: 0.8,
                      minWidth: '120px', maxWidth: '160px',
                      textAlign: 'center',
                      flexShrink: 0,
                      position: 'relative',
                    }}>
                      <Box sx={{
                        position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
                        backgroundColor: item.color, color: '#fff', borderRadius: '50%',
                        width: '18px', height: '18px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 700, lineHeight: 1,
                      }}>
                        {idx + 1}
                      </Box>
                      <Typography sx={{ fontSize: '10px', color: item.color, fontWeight: 600, lineHeight: 1.3, mt: 0.3 }}>
                        {item.label}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', color: '#333', fontWeight: 500, mt: 0.4, lineHeight: 1.2 }}>
                        {item.value}
                      </Typography>
                    </Box>
                    {idx < sorted.length - 1 && (
                      <Box sx={{ color: '#bdbdbd', fontSize: '20px', px: 0.3, flexShrink: 0, lineHeight: 1 }}>›</Box>
                    )}
                  </React.Fragment>
                ))}
              </Box>
            )}
          </Box>
        </Collapse>
      </TableCell>
    </TableRow>
  );
};

// ─── DataRow ──────────────────────────────────────────────────────────────────
const DataRow = ({ row, index }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <TableRow hover>
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
              sx={{ cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', py: 1 }}
            >
              {expanded
                ? <VisibilityOffIcon sx={{ color: '#1565C0', fontSize: '20px' }} />
                : <VisibilityIcon sx={{ color: '#9e9e9e', fontSize: '20px' }} />
              }
            </Box>
          </Tooltip>
        </TableCell>
      </TableRow>
      {expanded && <TimeSubRow row={row} colSpan={7} />}
    </>
  );
};

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
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const CameraActivationModal = ({ open, onClose }) => {
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const scannedSetRef = useRef(new Set());
  const isInitializedRef = useRef(false);
  const scannerInputRef = useRef("");
  const processingRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const tableDataRef = useRef([]); // ✅ ref แก้ stale closure

  const [scanMode, setScanMode] = useState("usb");
  const [scannerActive, setScannerActive] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [primaryBatch, setPrimaryBatch] = useState("");
  const [secondaryBatch, setSecondaryBatch] = useState("");
  const [hu, setHu] = useState("");
  const [weight, setWeight] = useState("");
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
        `${API_URL}/api/coldstorages/scan/sap/start/defrost?date=${date}`,
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
      tableDataRef.current = uniqueData; // ✅ sync ref ทุกครั้ง
      setFilteredData(uniqueData);
      scannedSetRef.current = new Set(uniqueData.map((item) => `${item.mat}_${item.batch}_${item.hu}`));
    } catch (error) {
      console.error("Error fetching data:", error);
      setTableData([]);
      tableDataRef.current = [];
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
    const weightValue = parts.length > 3 ? parseWeight(parts[3]) : null;

    if (batch.length !== 10 || huValue.length !== 9) {
      setError(`ข้อมูลไม่ครบ - Batch: ${batch.length}/10, HU: ${huValue.length}/9`);
      return;
    }

    // แสดงข้อมูลที่สแกนใน field เสมอ
    setPrimaryBatch(rawMat);
    setSecondaryBatch(batch);
    setHu(huValue);
    setWeight(weightValue !== null ? String(weightValue) : "");
    setInputValue(rawMat);

    const uniqueKey = `${rawMat}_${batch}_${huValue}`;

    // ✅ ใช้ tableDataRef เพื่อหลีกเลี่ยง stale closure
    const existingRow = tableDataRef.current.find((row) => String(row.hu) === String(huValue));

    // // ✅ เช็ค 1: HU ไม่มีในระบบเลย (ยังไม่ผ่านขั้นตอน "ออกห้องเย็น -18 องศา")
    // if (!existingRow) {
    //   setError(`❌ ไม่พบ HU: ${huValue} ในระบบ — กรุณาบันทึกเวลาออกห้องเย็น -18 องศา ก่อน`);
    //   return;
    // }

    // // ✅ เช็ค 2: HU มีอยู่แต่ยังไม่มีค่า cs_out_datetime_minus_18 → ยังไม่ได้บันทึกออกห้องเย็น
    // if (!existingRow.cs_out_datetime_minus_18) {
    //   setError(`❌ HU: ${huValue} ยังไม่มีการบันทึกเวลาออกห้องเย็น -18 องศา — ไม่สามารถบันทึกเวลาเริ่มละลายได้`);
    //   return;
    // }

    // // ✅ เช็ค 3: HU นี้บันทึกเวลาเริ่มละลายไปแล้ว
    // if (existingRow.start_defrost_date) {
    //   setError(`⚠️ HU: ${huValue} บันทึกเวลาเริ่มละลายไปแล้ว (${existingRow.start_defrost_date})`);
    //   return;
    // }

    // ✅ ผ่านทุกเงื่อนไข → ส่ง POST
    processingRef.current = true;
    setProcessing(true);
    setError("");
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

  const handleConfirmData = async (mat, batch, huValue, weightValue, uniqueKey) => {
    try {
      const response = await fetch(`${API_URL}/api/coldstorages/scan/sap/start/defrost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mat,
          batch,
          hu: huValue,
          weight: weightValue,
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
    <Box sx={{ display: "flex", height: "100vh", gap: 2, p: 2, bgcolor: "#007934" }}>
      <Paper sx={{ flex: "0 0 400px", p: 3, overflow: "auto", boxShadow: "0px 2px 8px rgba(0,0,0,0.1)" }}>
        <Typography variant="h6" sx={{ mb: 2, color: "#545454" }}>สแกน QR Code เพื่อบันทึกเวลาเริ่มละลาย</Typography>

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
                  {/* <TableCell><TableSortLabel active={orderBy === "start_defrost_date"} direction={orderBy === "start_defrost_date" ? order : "asc"} onClick={() => handleSort("start_defrost_date")}><strong>วันที่/เวลา เริ่มละลาย</strong></TableSortLabel></TableCell> */}
                  <TableCell align="center" sx={{ width: '48px' }}>
                    <Tooltip title="ดูข้อมูลเวลา" placement="top">
                      <VisibilityIcon sx={{ fontSize: '18px', color: '#9e9e9e' }} />
                    </Tooltip>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
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