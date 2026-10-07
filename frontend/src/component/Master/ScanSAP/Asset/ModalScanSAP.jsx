import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Alert,
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
  TextField
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import QrScanner from "qr-scanner";

const API_URL = import.meta.env.VITE_API_URL;

const CameraActivationModal = ({ open, onClose }) => {
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const scannedSetRef = useRef(new Set());
  const isInitializedRef = useRef(false);
  const scannerInputRef = useRef("");
  const processingRef = useRef(false);
  const lastScanTimeRef = useRef(0);

  // Scanner Mode: "camera" หรือ "usb"
  const [scanMode, setScanMode] = useState("usb");
  
  // State สำหรับสถานะ Scanner
  const [scannerActive, setScannerActive] = useState(false);

  // Scanner States
  const [scannedMappingIds, setScannedMappingIds] = useState([]);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  // Table States
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Sorting States
  const [orderBy, setOrderBy] = useState("withdraw_date");
  const [order, setOrder] = useState("desc");

  // ดึงข้อมูลตาราง
  const fetchTableData = async () => {
    setTableLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/coldstorages/scan/sap`, {
        credentials: "include",
      });

      const data = await response.json();

      let rawData = [];
      if (Array.isArray(data)) {
        rawData = data;
      } else if (data.success) {
        rawData = data.data;
      } else {
        console.error("API Error:", data.message || "Unknown error");
      }

      const uniqueData = Array.from(
        new Map(
          rawData.map(item => [
            `${item.mat}_${item.batch}_${item.hu}`,
            item
          ])
        ).values()
      );

      setTableData(uniqueData);
      setFilteredData(uniqueData);

      scannedSetRef.current = new Set(
        uniqueData.map(item => `${item.mat}_${item.batch}_${item.hu}`)
      );

    } catch (error) {
      console.error("Error fetching data:", error);
      setTableData([]);
      setFilteredData([]);
    } finally {
      setTableLoading(false);
    }
  };

  // เปิดกล้อง
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
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

  // ปิดกล้อง
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    qrScannerRef.current?.stop();
  };

  // ฟังก์ชันแปลงเวลาเป็นรูปแบบไทย "2025-01-15 10:30:00"
  const getThaiDateTime = () => {
    const now = new Date();
    
    // แปลงเป็นเวลาไทย (UTC+7)
    const thaiTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    
    const year = thaiTime.getUTCFullYear();
    const month = String(thaiTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(thaiTime.getUTCDate()).padStart(2, '0');
    const hours = String(thaiTime.getUTCHours()).padStart(2, '0');
    const minutes = String(thaiTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(thaiTime.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  // จัดการข้อมูลที่สแกนได้
  const handleScannedData = (result) => {
    if (!scannerActive) {
      console.log("Scanner is not active");
      return;
    }

    const now = Date.now();
    if (now - lastScanTimeRef.current < 1000) {
      console.log("Scan too fast, ignored");
      return;
    }
    lastScanTimeRef.current = now;

    if (processingRef.current) {
      console.log("Still processing previous scan");
      return;
    }

    const parts = result.split("|");
    if (parts.length === 0) {
      setError("รูปแบบ Barcode ไม่ถูกต้อง");
      return;
    }

    // แปลงเป็น array ของ mapping_id
    const mappingIds = parts.map(id => id.trim()).filter(id => id !== "");

    // ตรวจสอบว่าเป็นตัวเลขทั้งหมด
    const numericIds = mappingIds.map(id => parseInt(id, 10));
    if (numericIds.some(id => isNaN(id))) {
      setError("mapping_id ต้องเป็นตัวเลขทั้งหมด");
      return;
    }

    // ตรวจสอบว่ามีค่าซ้ำในรายการที่สแกน
    const uniqueIds = [...new Set(numericIds)];
    if (uniqueIds.length !== numericIds.length) {
      setError("พบ mapping_id ซ้ำในรายการที่สแกน");
      return;
    }

    const uniqueKey = numericIds.join("_");

    if (scannedSetRef.current.has(uniqueKey)) {
      setError(`⚠️ ข้อมูลนี้ถูกสแกนไปแล้ว: ${numericIds.join(", ")}`);
      return;
    }

    processingRef.current = true;
    setProcessing(true);
    setError("");

    handleConfirmData(numericIds, uniqueKey);
  };

  // ยืนยันและส่งข้อมูลไป API
  const handleConfirmData = async (mappingIds, uniqueKey) => {
    try {
      // สร้าง timestamp ในรูปแบบไทย "2025-01-15 10:30:00"
      const selectedDateTime = getThaiDateTime();

      console.log(`Sending to API: mapping_ids = [${mappingIds.join(", ")}]`);
      console.log(`selectedDateTime: ${selectedDateTime}`);

      const response = await fetch(`${API_URL}/api/pack/mixed/delay-time/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mapping_id: mappingIds, // ส่งเป็น array
          selectedDateTime: selectedDateTime
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("API Success:", data);
        scannedSetRef.current.add(uniqueKey);
        setScannedMappingIds(prev => [...prev, { 
          ids: mappingIds, 
          timestamp: selectedDateTime,
          count: mappingIds.length 
        }]);
        await fetchTableData();
        setError("");
      } else {
        console.error("API Error:", data);
        setError(data.message || "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
      }
    } catch (err) {
      console.error("Network Error:", err);
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  // ฟังก์ชันเริ่ม Scanner
  const handleStartScanner = () => {
    setScannerActive(true);
    setError("");
    
    if (scanMode === "camera" && !videoRef.current?.srcObject) {
      startCamera();
    }
    
    console.log("Scanner Started");
  };

  // ฟังก์ชันหยุด Scanner
  const handleStopScanner = () => {
    setScannerActive(false);
    scannerInputRef.current = "";
    
    if (scanMode === "camera") {
      stopCamera();
    }
    
    console.log("Scanner Stopped");
  };

  // ฟังก์ชันค้นหา
  const handleSearch = (query) => {
    const q = query.trim().toLowerCase();
    setSearchQuery(query);

    if (!q) {
      setFilteredData(tableData);
      return;
    }

    const filtered = tableData.filter((row) =>
      Object.values(row).some((val) =>
        String(val || "").toLowerCase().includes(q)
      )
    );

    setFilteredData(filtered);
  };

  // ฟังก์ชันเรียงลำดับ
  const handleSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);

    const sorted = [...filteredData].sort((a, b) => {
      let aValue = a[property] || "";
      let bValue = b[property] || "";

      if (property === "withdraw_date") {
        aValue = new Date(aValue).getTime() || 0;
        bValue = new Date(bValue).getTime() || 0;
      }

      if (aValue < bValue) {
        return isAsc ? 1 : -1;
      }
      if (aValue > bValue) {
        return isAsc ? -1 : 1;
      }
      return 0;
    });

    setFilteredData(sorted);
  };

  // จับ keyboard input - ทำงานเฉพาะเมื่อ scannerActive = true
  useEffect(() => {
    if (scanMode !== "usb" || !open || !scannerActive) return;

    const handleKeyPress = (e) => {
      if (processingRef.current) {
        e.preventDefault();
        return;
      }

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

  // สลับโหมด Scanner
  const handleScanModeChange = (event, newMode) => {
    if (newMode === null) return;

    // หยุด Scanner เมื่อสลับโหมด
    setScannerActive(false);
    setScanMode(newMode);

    if (newMode === "camera") {
      stopCamera();
      scannerInputRef.current = "";
    } else {
      stopCamera();
      scannerInputRef.current = "";
    }
  };

  // Load ข้อมูลตอนเริ่มต้น
  useEffect(() => {
    if (open && !isInitializedRef.current) {
      isInitializedRef.current = true;
      fetchTableData();
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

  // เมื่อ tableData เปลี่ยน
  useEffect(() => {
    setFilteredData(tableData);
  }, [tableData]);

  if (!open) return null;

  return (
    <Box sx={{ display: "flex", height: "100vh", gap: 2, p: 2, bgcolor: "#F5F8FF" }}>
      {/* ฝั่งซ้าย - Scanner */}
      <Paper
        sx={{
          flex: "0 0 400px",
          p: 3,
          overflow: "auto",
          boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <Typography variant="h6" sx={{ mb: 2, color: "#545454" }}>
          สแกน Barcode (Mapping ID)
        </Typography>

        {/* Toggle Scanner Mode */}
        <ToggleButtonGroup
          value={scanMode}
          exclusive
          onChange={handleScanModeChange}
          fullWidth
          sx={{ mb: 2 }}
        >
          <ToggleButton value="usb">
            <QrCodeScannerIcon sx={{ mr: 1 }} />
            USB Scanner
          </ToggleButton>
          <ToggleButton value="camera">
            <CameraAltIcon sx={{ mr: 1 }} />
            กล้อง
          </ToggleButton>
        </ToggleButtonGroup>

        {/* ปุ่มเริ่ม/หยุด Scanner */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<PlayArrowIcon />}
            onClick={handleStartScanner}
            disabled={scannerActive}
            fullWidth
          >
            เริ่มสแกน
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<StopIcon />}
            onClick={handleStopScanner}
            disabled={!scannerActive}
            fullWidth
          >
            หยุดสแกน
          </Button>
        </Stack>

        {/* แสดงสถานะ Scanner */}
        {scannerActive ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            🟢 Scanner กำลังทำงาน - พร้อมรับข้อมูล
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            ⚪ Scanner หยุดทำงาน - กดปุ่ม "เริ่มสแกน" เพื่อเปิดใช้งาน
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {processing && (
          <Alert severity="info" sx={{ mb: 2 }}>
            กำลังประมวลผล...
          </Alert>
        )}

        {/* แสดงกล้องเฉพาะเมื่อเลือก Camera Mode และเปิด Scanner */}
        {scanMode === "camera" && scannerActive && (
          <video
            ref={videoRef}
            style={{
              width: "100%",
              margin: "15px 0",
              borderRadius: "8px",
              border: "2px solid #4caf50",
            }}
            autoPlay
            muted
            playsInline
          />
        )}

        {/* แสดงประวัติการสแกน */}
        {scannedMappingIds.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: "bold" }}>
              ประวัติการสแกน:
            </Typography>
            <Box sx={{ maxHeight: "300px", overflowY: "auto" }}>
              {scannedMappingIds.slice().reverse().map((item, index) => (
                <Paper 
                  key={index} 
                  sx={{ 
                    p: 2, 
                    mb: 1, 
                    bgcolor: index === 0 ? "#EAF0FF" : "#F5F8FF",
                    border: index === 0 ? "2px solid #1552F0" : "1px solid #E3E8F2"
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                    Mapping IDs ({item.count} รายการ):
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#1552F0", mb: 0.5 }}>
                    {item.ids.join(", ")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    เวลา: {item.timestamp}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      {/* ฝั่งขวา - Table */}
      <Paper
        sx={{
          flex: 1,
          p: 3,
          overflow: "auto",
          boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h6" sx={{ color: "#545454" }}>
            ข้อมูลที่สแกนแล้ว
          </Typography>
          <Chip
            label={`${filteredData.length} รายการ`}
            color="primary"
            size="small"
          />
        </Box>

        <TextField
          fullWidth
          size="small"
          placeholder="ค้นหา Raw Material, Batch, HU, วันที่..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        {tableLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: "calc(100vh - 250px)" }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell><strong>ลำดับ</strong></TableCell>

                  <TableCell>
                    <TableSortLabel
                      active={orderBy === "mat"}
                      direction={orderBy === "mat" ? order : "asc"}
                      onClick={() => handleSort("mat")}
                    >
                      <strong>Raw Material</strong>
                    </TableSortLabel>
                  </TableCell>

                  <TableCell>
                    <TableSortLabel
                      active={orderBy === "batch"}
                      direction={orderBy === "batch" ? order : "asc"}
                      onClick={() => handleSort("batch")}
                    >
                      <strong>Batch</strong>
                    </TableSortLabel>
                  </TableCell>

                  <TableCell>
                    <TableSortLabel
                      active={orderBy === "hu"}
                      direction={orderBy === "hu" ? order : "asc"}
                      onClick={() => handleSort("hu")}
                    >
                      <strong>HU</strong>
                    </TableSortLabel>
                  </TableCell>

                  <TableCell>
                    <TableSortLabel
                      active={orderBy === "withdraw_date"}
                      direction={orderBy === "withdraw_date" ? order : "asc"}
                      onClick={() => handleSort("withdraw_date")}
                    >
                      <strong>วันที่สแกน</strong>
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        {searchQuery ? "ไม่พบข้อมูลที่ค้นหา" : "ยังไม่มีข้อมูล"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((row, index) => (
                    <TableRow key={`${row.mat}_${row.batch}_${row.hu}_${index}`} hover>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{row.mat || "-"}</TableCell>
                      <TableCell>{row.batch || "-"}</TableCell>
                      <TableCell>{row.hu || "-"}</TableCell>
                      <TableCell>{row.withdraw_date || "-"}</TableCell>
                    </TableRow>
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