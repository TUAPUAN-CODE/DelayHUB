import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, Chip, TextField, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Switch, FormControlLabel, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab
} from '@mui/material';
import { Settings as SettingsIcon, PowerSettingsNew as PowerIcon, History as HistoryIcon, ArrowBack as ArrowBackIcon, Fullscreen as FullscreenIcon, Add as AddIcon } from '@mui/icons-material';
import { io } from "socket.io-client";
import axios from "axios";
import { DEFAULT_PRINT_AGENT_URL, resolveAgentUrl, SLIP_PRINT_STATUS_EVENT, setSlipPrinterEnabled, useSlipPrinterEnabled } from './RFIDSlipPrintService';

const API_URL = import.meta.env.VITE_API_URL;

const socket = io(API_URL, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  autoConnect: true
});

socket.on('ping', () => { socket.emit('pong'); });
socket.on('connect', () => { console.log('✅ ReaderPanel socket connected:', socket.id); });
socket.on('disconnect', (reason) => { console.warn('⚠️ ReaderPanel socket disconnected:', reason); });

const STATUS_POLL_INTERVAL_MS = 8000;

// รหัสผ่านสำหรับเปิดหน้า "ตั้งค่า" (กดปุ่ม ⚙️)
const SETTINGS_PASSCODE = "Qcpm";

const playPassSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };
    playTone(660, 0, 0.12);
    playTone(880, 0.12, 0.15);
  } catch (err) {
    console.warn("ไม่สามารถเล่นเสียงได้:", err);
  }
};

// ============================================
// ReaderCard - แสดงสถานะเครื่องอ่านแต่ละตัว
// ============================================
const ReaderCard = ({ config, online, lastResult, isPrinting, onToggle, onOpenSettings, onOpenFocus, toggling }) => {
  const statusColor = online ? "#4CAF50" : "#bdbdbd";
  // ปลายทางพิมพ์ RAW ข้าม network ต้องมีทั้ง printer_host และ printer_share (ดู server.js /print-slip)
  // ถ้าขาดอันใดอันหนึ่ง → หลุด fallback ไปพิมพ์ที่ default printer ของเครื่อง print-agent (server) แทน
  const hasPrinterTarget = !!(config.printer_host && config.printer_share);

  return (
    <Paper
      elevation={2}
      sx={{
        width: 220,
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 2,
        border: lastResult ? '2px solid #4aaaec' : '1px solid #e0e0e0',
        backgroundColor: lastResult ? '#eaf5ff' : '#ffffff',
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
        opacity: config.is_active ? 1 : 0.6,
      }}
    >
      {/* Status dot */}
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: statusColor,
          boxShadow: online ? '0 0 6px #4CAF50' : 'none',
        }}
        title={online ? "เชื่อมต่อสำเร็จ" : "ไม่พบเครื่องอ่าน"}
      />

      {/* Location name badge */}
      <Chip
        size="small"
        label={config.location_name}
        sx={{
          backgroundColor: '#e3f2fd',
          color: '#1565c0',
          fontSize: '11px',
          fontWeight: 'bold',
          height: '22px',
          marginBottom: 1,
        }}
      />

      {/* Reader name */}
      <Typography sx={{ fontSize: 16, fontWeight: 'bold', color: '#333', textAlign: 'center' }}>
        {config.name}
      </Typography>

      {/* IP Address */}
      <Typography sx={{ fontSize: '10px', color: '#999', textAlign: 'center' }}>
        {config.ip}:{config.port}
      </Typography>

      {/* Online/Offline chip */}
      <Chip
        size="small"
        label={online ? "Online" : "Offline"}
        sx={{
          backgroundColor: online ? '#e6f7ec' : '#f0f0f0',
          color: online ? '#2e7d32' : '#888',
          fontSize: '11px',
          height: '20px',
          marginTop: 0.5,
        }}
      />

      {/* ปลายทางพิมพ์สลีป — บอกชัดเจนว่าจุดนี้ตั้งพิมพ์ที่เครื่องไหน กันสับสนว่าทำไมบางจุดปริ้นคนละที่ */}
      <Chip
        size="small"
        label={hasPrinterTarget ? `🖨️ ${config.printer_host}` : "⚠️ ยังไม่ตั้งเครื่องพิมพ์"}
        title={
          hasPrinterTarget
            ? `พิมพ์ RAW ข้าม network ไปที่ \\\\${config.printer_host}\\${config.printer_share}`
            : "ยังไม่ตั้ง Printer Host/Share — จะพิมพ์ผ่าน default printer ของเครื่อง print-agent (server) แทน กด \"ตั้งค่า\" เพื่อระบุเครื่องพิมพ์ปลายทางของจุดนี้"
        }
        sx={{
          backgroundColor: hasPrinterTarget ? "#fff3e0" : "#fdecea",
          color: hasPrinterTarget ? "#e65100" : "#c62828",
          fontSize: "10px",
          height: "20px",
          marginTop: 0.5,
          maxWidth: "100%",
          "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
        }}
      />

      {/* Last scan result */}
      <Box sx={{ textAlign: 'center', minHeight: '40px', marginTop: 1 }}>
        {isPrinting ? (
          <Typography sx={{ fontSize: '12px', color: '#ff9800' }}>กำลังพิมพ์...</Typography>
        ) : lastResult ? (
          <>
            <Typography sx={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
              {lastResult.tro_id}
            </Typography>
            <Typography sx={{ fontSize: '10px', color: '#999' }}>
              {new Date(lastResult.timestamp).toLocaleTimeString('th-TH')}
            </Typography>
          </>
        ) : (
          <Typography sx={{ fontSize: '11px', color: '#bbb' }}>รอสแกน...</Typography>
        )}
      </Box>

      {/* Control buttons */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 1, width: '100%' }}>
        <Button
          fullWidth
          size="medium"
          variant="outlined"
          color="primary"
          startIcon={<FullscreenIcon />}
          onClick={() => onOpenFocus(config)}
          sx={{
            fontWeight: 'bold',
            fontSize: '13px',
            textTransform: 'none',
            py: 0.75,
          }}
        >
          หน้าจอใหญ่
        </Button>
        <Button
          fullWidth
          size="medium"
          variant={config.is_active ? "outlined" : "contained"}
          color={config.is_active ? "error" : "success"}
          startIcon={toggling ? <CircularProgress size={16} /> : <PowerIcon />}
          onClick={() => onToggle(config)}
          disabled={toggling}
          sx={{
            fontWeight: 'bold',
            fontSize: '13px',
            textTransform: 'none',
            py: 0.75,
          }}
        >
          {toggling ? 'กำลังดำเนินการ...' : (config.is_active ? 'ปิดเครื่องอ่าน' : 'เปิดเครื่องอ่าน')}
        </Button>
        <Button
          fullWidth
          size="medium"
          variant="outlined"
          color="info"
          startIcon={<SettingsIcon />}
          onClick={() => onOpenSettings(config)}
          sx={{
            fontWeight: 'bold',
            fontSize: '13px',
            textTransform: 'none',
            py: 0.75,
          }}
        >
          ตั้งค่า
        </Button>
      </Box>
    </Paper>
  );
};

// ============================================
// PasswordPromptDialog - ใส่รหัสผ่านก่อนเปิดหน้าตั้งค่า
// ============================================
const PasswordPromptDialog = ({ open, onClose, onVerify, error }) => {
  const [value, setValue] = useState('');

  // รีเซ็ตรหัสทิ้งทุกครั้งที่เปิด dialog ใหม่
  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    onVerify(value);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth disableRestoreFocus>
      <DialogTitle sx={{ fontWeight: 'bold', color: '#4aaaec' }}>
        ยืนยันสิทธิ์การตั้งค่า
      </DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 1 }}>
          <TextField
            label="รหัสผ่าน"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            fullWidth
            size="small"
            autoFocus
            error={!!error}
            helperText={error || 'กรุณาใส่รหัสผ่านเพื่อเข้าแก้ไขการตั้งค่า'}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ padding: 2 }}>
        <Button onClick={onClose} color="inherit">ยกเลิก</Button>
        <Button
          onClick={() => handleSubmit()}
          variant="contained"
          sx={{ backgroundColor: '#4aaaec', '&:hover': { backgroundColor: '#3a8ac0' } }}
        >
          ยืนยัน
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================
// ReaderFocusView - หน้าจอใหญ่แสดงจุดเดียวเมื่อกดเปิดเครื่องอ่าน
// ============================================
const ReaderFocusView = ({ config, online, lastResult, isPrinting, open, onClose }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      disableRestoreFocus
      PaperProps={{
        sx: {
          backgroundColor: online ? '#eaf7ef' : '#fff8f8',
        },
      }}
    >
      <DialogContent sx={{ textAlign: 'center', padding: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        {/* Location name */}
        <Chip
          label={config?.location_name}
          sx={{
            backgroundColor: '#4aaaec',
            color: '#fff',
            fontSize: '20px',
            fontWeight: 'bold',
            height: '44px',
            marginBottom: 3,
          }}
        />

        {/* Reader name */}
        <Typography sx={{ fontSize: 56, fontWeight: 'bold', color: '#333', marginBottom: 1 }}>
          {config?.name}
        </Typography>

        {/* IP */}
        <Typography sx={{ fontSize: 20, color: '#888', marginBottom: 4 }}>
          {config?.ip}:{config?.port}
        </Typography>

        {/* Big status */}
        <Chip
          label={online ? "ONLINE" : "OFFLINE"}
          sx={{
            fontSize: '28px',
            fontWeight: 'bold',
            height: '58px',
            px: 4,
            color: '#fff',
            backgroundColor: online ? '#2e7d32' : '#c62828',
          }}
        />

        {/* Big last scan / printing */}
        <Box sx={{ marginTop: 5, minHeight: '110px' }}>
          {isPrinting ? (
            <Typography sx={{ fontSize: 42, fontWeight: 'bold', color: '#ff9800' }}>
              กำลังพิมพ์สลิป...
            </Typography>
          ) : lastResult ? (
            <>
              <Typography sx={{ fontSize: 46, fontWeight: 'bold', color: '#4aaaec' }}>
                🚚 รถเข็น: {lastResult.tro_id}
              </Typography>
              <Typography sx={{ fontSize: 26, color: '#666', marginTop: 1 }}>
                สแกนเวลา: {new Date(lastResult.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Typography>
            </>
          ) : (
            <Typography sx={{ fontSize: 34, color: '#bbb' }}>
              ยังไม่มีการสแกน — พร้อมใช้งาน
            </Typography>
          )}
        </Box>

        {/* Close button */}
        <Button
          variant="contained"
          onClick={onClose}
          sx={{
            marginTop: 5,
            backgroundColor: '#4aaaec',
            '&:hover': { backgroundColor: '#3a8ac0' },
            fontSize: '20px',
            fontWeight: 'bold',
            px: 6,
            py: 1.5,
          }}
        >
          ปิดหน้าจอ
        </Button>
      </DialogContent>
    </Dialog>
  );
};

// ============================================
// ReaderSettingsModal - Modal ตั้งค่าเครื่องอ่าน
// ============================================
const ReaderSettingsModal = ({ open, onClose, config, mode = 'edit', suggestedReaderNo, onSave }) => {
  const isCreate = mode === 'create';
  const [formData, setFormData] = useState({
    reader_no: '',
    name: '',
    ip: '',
    port: 49152,
    location_name: '',
    printer_agent_url: DEFAULT_PRINT_AGENT_URL,
    printer_host: '',
    printer_share: '',
    printer_dot_width: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('settings'); // 'settings' | 'history'

  useEffect(() => {
    if (isCreate) {
      setFormData({
        reader_no: suggestedReaderNo || '',
        name: '',
        ip: '',
        port: 49152,
        location_name: '',
        printer_agent_url: DEFAULT_PRINT_AGENT_URL,
        printer_host: '',
        printer_share: '',
        printer_dot_width: '',
      });
    } else if (config) {
      setFormData({
        reader_no: config.reader_no || '',
        name: config.name || '',
        ip: config.ip || '',
        port: config.port || 49152,
        location_name: config.location_name || '',
        printer_agent_url: config.printer_agent_url || DEFAULT_PRINT_AGENT_URL,
        printer_host: config.printer_host || '',
        printer_share: config.printer_share || '',
        printer_dot_width: config.printer_dot_width || '',
      });
    }
    setError('');
    setTab('settings');
  }, [config, isCreate, suggestedReaderNo, open]);

  const handleSave = async () => {
    if (isCreate && (!formData.reader_no || !formData.name || !formData.ip || !formData.location_name)) {
      setError('กรุณากรอกให้ครบ: หมายเลขเครื่อง, ชื่อเครื่องอ่าน, IP Address, ชื่อ Location');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(isCreate ? null : config.id, formData);
      onClose();
    } catch (err) {
      console.error("Error saving config:", err);
      setError(err.response?.data?.message || err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus>
      <DialogTitle sx={{ fontWeight: 'bold', color: '#4aaaec' }}>
        {isCreate ? 'เพิ่มเครื่องอ่าน RFID ใหม่' : `ตั้งค่าเครื่องอ่าน RFID — ${config?.location_name}`}
      </DialogTitle>
      {!isCreate && (
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          centered
          textColor="primary"
          indicatorColor="primary"
          sx={{ marginTop: 0.5 }}
        >
          <Tab label="ตั้งค่า" value="settings" />
          <Tab
            label={<>ประวัติสแกน <HistoryIcon sx={{ verticalAlign: 'middle', fontSize: 16, marginLeft: 0.5 }} /></>}
            value="history"
          />
        </Tabs>
      )}
      <DialogContent>
        {tab === 'history' && !isCreate ? (
          <ScanHistoryContent config={config} />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 1 }}>
            {isCreate && (
              <TextField
                label="หมายเลขเครื่องอ่าน (reader_no)"
                type="number"
                value={formData.reader_no}
                onChange={(e) => setFormData({ ...formData, reader_no: parseInt(e.target.value) || '' })}
                fullWidth
                size="small"
                helperText="ตัวเลขไม่ซ้ำกับเครื่องที่มีอยู่ — ใช้อ้างอิงในระบบ (เช่น URL /rfid/status/1)"
              />
            )}
            <TextField
              label="ชื่อเครื่องอ่าน"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              size="small"
              placeholder="เครื่องอ่าน RFID จุด D"
            />
            <TextField
              label="IP Address"
              value={formData.ip}
              onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
              fullWidth
              size="small"
              placeholder="10.246.145.182"
            />
            <TextField
              label="Port"
              type="number"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 49152 })}
              fullWidth
              size="small"
            />
            <TextField
              label="ชื่อ Location / จุด"
              value={formData.location_name}
              onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
              fullWidth
              size="small"
              placeholder="จุด D"
            />
            <TextField
              label="Print Agent URL"
              value={formData.printer_agent_url}
              onChange={(e) => setFormData({ ...formData, printer_agent_url: e.target.value })}
              fullWidth
              size="small"
              placeholder="http://192.168.1.101:9100"
              helperText="URL ของ print-agent ส่วนกลางที่จะยิงคำสั่งพิมพ์ไป (ปกติเป็นตัวเดียวกันทุกจุด)"
            />

            <Typography sx={{ fontSize: 12, fontWeight: 'bold', color: '#888', marginTop: 1 }}>
              ปลายทางเครื่องพิมพ์ (พิมพ์ RAW ข้าม network — ไม่ต้องรัน print-agent ที่เครื่องนั้น)
            </Typography>
            {!isCreate && (
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 'bold',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: (formData.printer_host && formData.printer_share) ? '#e6f7ec' : '#fdecea',
                  color: (formData.printer_host && formData.printer_share) ? '#2e7d32' : '#c62828',
                }}
              >
                {(formData.printer_host && formData.printer_share)
                  ? `✅ ตั้งค่าแล้ว — จุดนี้จะพิมพ์ที่เครื่อง ${formData.printer_host}`
                  : '⚠️ ยังไม่ได้ตั้งค่า — จุดนี้จะพิมพ์ผ่าน default printer ของเครื่อง server แทน (ต้องกรอก Printer Host + Printer Share ทั้งคู่)'}
              </Typography>
            )}
            <TextField
              label="Printer Host (ชื่อเครื่อง/IP ที่แชร์เครื่องพิมพ์ไว้)"
              value={formData.printer_host}
              onChange={(e) => setFormData({ ...formData, printer_host: e.target.value })}
              fullWidth
              size="small"
              placeholder="STATION-PC-01 หรือ 10.246.145.50"
            />
            <TextField
              label="Printer Share Name (ชื่อ share ที่ตั้งไว้ใน Windows)"
              value={formData.printer_share}
              onChange={(e) => setFormData({ ...formData, printer_share: e.target.value })}
              fullWidth
              size="small"
              placeholder="POS-80C"
            />
            <TextField
              label="Printer Dot Width (จุด, ไม่ใส่ = ค่าเริ่มต้น 576)"
              type="number"
              value={formData.printer_dot_width}
              onChange={(e) => setFormData({ ...formData, printer_dot_width: parseInt(e.target.value) || '' })}
              fullWidth
              size="small"
              helperText="ปรับทีหลังได้ถ้าพิมพ์ครั้งแรกแล้วภาพล้นขอบ/เล็กเกินไป (ปล่อยว่างไว้ = ใช้ print-agent local แบบเดิมแทน)"
            />
            {error && (
              <Typography sx={{ color: '#c62828', fontSize: 13 }}>{error}</Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ padding: 2 }}>
        {tab === 'history' && !isCreate ? (
          <Button onClick={onClose} color="inherit">ปิด</Button>
        ) : (
          <>
            <Button onClick={onClose} color="inherit">ยกเลิก</Button>
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={saving}
              sx={{ backgroundColor: '#4aaaec', '&:hover': { backgroundColor: '#3a8ac0' } }}
            >
              {saving ? 'กำลังบันทึก...' : (isCreate ? 'เพิ่มเครื่องอ่าน' : 'บันทึก')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

// ============================================
// ScanHistoryContent - ประวัติการสแกน (ฝังใน Tab "ประวัติสแกน" ของหน้าต่างตั้งค่า)
// Summary: รถเข็นคันเดียว/แถว กดเข้าดู Detail (mapping_id) ได้
// ============================================
const ScanHistoryContent = ({ config }) => {
  const [view, setView] = useState('summary'); // 'summary' | 'detail'
  const [scans, setScans] = useState([]);
  const [selectedTroId, setSelectedTroId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async (troId = null) => {
    setLoading(true);
    setError('');
    try {
      const url = troId
        ? `${API_URL}/api/coldstorage/rfid/history/${config.reader_no}?tro_id=${troId}&limit=100`
        : `${API_URL}/api/coldstorage/rfid/history/${config.reader_no}?limit=50`;
      const res = await axios.get(url);
      if (res.data.success) setScans(res.data.scans || []);
      else setError(res.data.message || 'ดึงประวัติไม่สำเร็จ');
    } catch (err) {
      setError('ดึงประวัติการสแกนไม่สำเร็จ: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setView('summary');
    setSelectedTroId(null);
    fetchData();
  }, [config]);

  const handleClickTro = (troId) => {
    setSelectedTroId(troId);
    fetchData(troId);
    setView('detail');
  };

  const handleBack = () => {
    setView('summary');
    setSelectedTroId(null);
    fetchData();
  };

  const formatTime = (dt) => {
    if (!dt) return '-';
    try {
      const d = new Date(dt);
      const pad = (n) => String(n).padStart(2, '0');
      // scan_time ใน ReaderScanLog ถูกเก็บเป็น wall-clock (เวลาไทย) โดยแปะท้ายเป็น UTC —
      // ต้องอ่านชั่วโมงตามที่เก็บโดยตรง (getUTC*) จะได้เวลาไทยที่ถูกต้อง ไม่บวก 7 ชม.ซ้ำ
      return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear() + 543} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    } catch {
      return String(dt);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 1 }}>
        {view === 'detail' && (
          <ArrowBackIcon
            sx={{ cursor: 'pointer', color: '#666', '&:hover': { color: '#333' } }}
            onClick={handleBack}
          />
        )}
        <Typography sx={{ fontWeight: 'bold', color: '#4aaaec' }}>
          {view === 'detail'
            ? <>รถเข็น {selectedTroId}</>
            : <>ประวัติการสแกน — {config?.name}</>
          }
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', padding: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography sx={{ color: '#c62828', fontSize: 13, padding: 2 }}>{error}</Typography>
      ) : scans.length === 0 ? (
        <Typography sx={{ color: '#999', fontSize: 13, padding: 2 }}>
          {view === 'detail'
            ? 'ไม่มีประวัติการสแกนสำหรับรถเข็นคันนี้'
            : 'ยังไม่มีประวัติการสแกนสำหรับเครื่องนี้'
          }
        </Typography>
      ) : view === 'summary' ? (
        /* Summary: รถเข็นคันเดียว/แถว กดเข้าดู detail ได้ */
        <TableContainer component={Paper} sx={{ maxHeight: 400, marginTop: 1 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>รถเข็น</TableCell>
                <TableCell>สแกนครั้งล่าสุด</TableCell>
                <TableCell align="right">จำนวนครั้ง</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scans.map((s, i) => (
                <TableRow
                  key={s.tro_id}
                  hover
                  sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#e3f2fd !important' } }}
                  onClick={() => handleClickTro(s.tro_id)}
                >
                  <TableCell>{i + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                    {s.tro_id}
                  </TableCell>
                  <TableCell>{formatTime(s.latest_scan)}</TableCell>
                  <TableCell align="right">
                    <Chip size="small" label={s.scan_count} sx={{ fontWeight: 'bold' }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        /* Detail: mapping_id ทั้งหมดของรถเข็นคันนี้ที่สแกนผ่านจุดนี้ */
        <TableContainer component={Paper} sx={{ maxHeight: 400, marginTop: 1 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>เวลาสแกน</TableCell>
                <TableCell>Mapping ID</TableCell>
                <TableCell>สถานะ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scans.map((s, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{formatTime(s.scan_time)}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{s.mapping_id ?? '-'}</TableCell>
                  <TableCell>{s.dest || s.stay_place || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

// ============================================
// ReaderPanel - Component หลัก
// ============================================
const ReaderPanel = ({ fetchedData = [] }) => {
  const [readerConfigs, setReaderConfigs] = useState([]);
  const [readers, setReaders] = useState([]);
  const [lastResults, setLastResults] = useState({});
  const [printingId, setPrintingId] = useState(null);
  const [printerError, setPrinterError] = useState(null);
  const [agentOnline, setAgentOnline] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [settingsModal, setSettingsModal] = useState({ open: false, config: null, mode: 'edit' });
  const [passwordDialog, setPasswordDialog] = useState({ open: false, config: null, mode: 'edit', error: '' });
  const [togglingId, setTogglingId] = useState(null);
  const [focusReaderId, setFocusReaderId] = useState(null);
  const slipPrinterEnabled = useSlipPrinterEnabled();

  const fetchedDataRef = useRef(fetchedData);
  useEffect(() => {
    fetchedDataRef.current = fetchedData;
  }, [fetchedData]);

  // ============================================
  // ดึงข้อมูล Config จาก Database
  // ============================================
  const fetchConfigs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/coldstorage/rfid/config`);
      if (res.data.success) {
        setReaderConfigs(res.data.data);
      }
    } catch (err) {
      console.error("ดึงข้อมูล config ไม่สำเร็จ:", err.message);
    }
  }, []);

  // ============================================
  // ดึงสถานะเครื่องอ่าน (Online/Offline)
  // ============================================
  const fetchStatuses = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/coldstorage/rfid/status`);
      if (res.data.success) {
        setReaders(res.data.readers);
      }
    } catch (err) {
      console.error("เช็คสถานะเครื่องอ่านไม่สำเร็จ:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchStatuses();
    const interval = setInterval(fetchStatuses, STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchConfigs, fetchStatuses]);

  // ============================================
  // เช็ค Print Agent (เฉพาะจุดที่เลือก)
  // ============================================
  useEffect(() => {
    const checkAgent = async () => {
      try {
        const configured = selectedLocation === 'all'
          ? null
          : readerConfigs.find(c => c.location_name === selectedLocation)?.printer_agent_url || null;
        const url = resolveAgentUrl(configured);
        const res = await fetch(`${url}/health`);
        setAgentOnline(res.ok);
      } catch {
        setAgentOnline(false);
      }
    };
    checkAgent();
    const interval = setInterval(checkAgent, 5000);
    return () => clearInterval(interval);
  }, [selectedLocation, readerConfigs]);

  // ============================================
  // Toggle เปิด/ปิด เครื่องอ่าน
  // ============================================
  const handleToggle = async (config) => {
    setTogglingId(config.id);
    try {
      await axios.post(`${API_URL}/api/coldstorage/rfid/config/${config.id}/toggle`);
      await fetchConfigs();
      await fetchStatuses();
      // ถ้ากด "เปิดเครื่องอ่าน" ให้ขึ้นหน้าจอใหญ่โชว์จุดนั้น
      if (!config.is_active) {
        setFocusReaderId(config.reader_no);
      }
    } catch (err) {
      console.error("Toggle error:", err);
      alert("เกิดข้อผิดพลาด: " + (err.response?.data?.message || err.message));
    } finally {
      setTogglingId(null);
    }
  };

  // ============================================
  // บันทึกการตั้งค่า (id === null => สร้างเครื่องอ่านใหม่, มี id => แก้ไขของเดิม)
  // ============================================
  const handleSaveConfig = async (id, data) => {
    if (id === null) {
      await axios.post(`${API_URL}/api/coldstorage/rfid/config`, data);
    } else {
      await axios.put(`${API_URL}/api/coldstorage/rfid/config/${id}`, data);
    }
    await fetchConfigs();
    await fetchStatuses();
  };

  // ============================================
  // เปิดปุ่มตั้งค่า: ต้องผ่านรหัสผ่านก่อน
  // ============================================
  const handleOpenSettings = (config) => {
    setPasswordDialog({ open: true, config, mode: 'edit', error: '' });
  };

  // ============================================
  // เปิดปุ่ม "เพิ่มเครื่องอ่านใหม่": ต้องผ่านรหัสผ่านก่อนเหมือนกัน
  // ============================================
  const handleOpenAddReader = () => {
    setPasswordDialog({ open: true, config: null, mode: 'create', error: '' });
  };

  // เลขเครื่องอ่านที่แนะนำสำหรับเครื่องใหม่ (มากสุด + 1)
  const nextSuggestedReaderNo = readerConfigs.length > 0
    ? Math.max(...readerConfigs.map((c) => c.reader_no || 0)) + 1
    : 1;

  // เปิด/ปิด หน้าจอใหญ่ได้อิสระ โดยไม่ต้องปิด-เปิดเครื่องอ่านใหม่
  const handleOpenFocus = (config) => {
    setFocusReaderId(config.reader_no);
  };

  const handleVerifyPasscode = (value) => {
    if (value === SETTINGS_PASSCODE) {
      const { config, mode } = passwordDialog;
      setPasswordDialog({ open: false, config: null, mode: 'edit', error: '' });
      setSettingsModal({ open: true, config, mode });
    } else {
      setPasswordDialog((prev) => ({ ...prev, error: 'รหัสผ่านไม่ถูกต้อง' }));
    }
  };

  // ============================================
  // Socket: รับผลการสแกน RFID
  // ============================================
  useEffect(() => {
    const handleScanUpdate = async (payload) => {
      const { readerId, tro_id, timestamp } = payload;
      if (!readerId) return;

      console.log(`✅ เครื่องอ่าน ${readerId} สแกนได้รถเข็น: ${tro_id}`);

      setLastResults((prev) => ({
        ...prev,
        [readerId]: { tro_id, timestamp: timestamp || payload.updatedAt || Date.now() },
      }));

      playPassSound();
      // การสั่งพิมพ์ย้ายไปอยู่ที่ RFIDSlipPrintService (ทำงานทุกหน้า) — หน้านี้แสดงผลอย่างเดียว
    };

    socket.on("readerScanUpdate", handleScanUpdate);
    return () => socket.off("readerScanUpdate", handleScanUpdate);
  }, []);

  // สถานะการพิมพ์จาก RFIDSlipPrintService
  useEffect(() => {
    const handleStatus = (e) => {
      const { readerId, status, error } = e.detail || {};
      if (status === "printing") setPrintingId(readerId);
      else setPrintingId(null);
      if (status === "done") setPrinterError(null);
      if (status === "error") setPrinterError(error);
    };
    window.addEventListener(SLIP_PRINT_STATUS_EVENT, handleStatus);
    return () => window.removeEventListener(SLIP_PRINT_STATUS_EVENT, handleStatus);
  }, []);

  // ============================================
  // Filter readers by selected location
  // ============================================
  const filteredReaders = selectedLocation === 'all'
    ? readers
    : readers.filter(r => {
        const config = readerConfigs.find(c => c.reader_no === r.readerId);
        return config?.location_name === selectedLocation;
      });

  const filteredConfigs = selectedLocation === 'all'
    ? readerConfigs
    : readerConfigs.filter(c => c.location_name === selectedLocation);

  // Merge config with online status for display
  const mergedData = filteredConfigs.map(config => {
    const status = readers.find(r => r.readerId === config.reader_no);
    return {
      ...config,
      online: status?.online || false,
      lastResult: lastResults[config.reader_no],
      isPrinting: printingId === config.reader_no,
    };
  });

  // Get unique locations for dropdown
  const locations = [...new Set(readerConfigs.map(c => c.location_name))];

  // ข้อมูลสำหรับหน้าจอใหญ่ (reader ที่กำลังโฟกัส)
  const focusConfig = readerConfigs.find((c) => c.reader_no === focusReaderId) || null;
  const focusStatus = readers.find((r) => r.readerId === focusReaderId);
  const focusResult = lastResults[focusReaderId];

  return (
    <Box sx={{ padding: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <Typography variant="h6" sx={{ color: '#4aaaec', fontWeight: 'bold' }}>
          แผงควบคุมเครื่องอ่าน RFID
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            size="small"
            label={agentOnline ? "Print Agent: ทำงานอยู่" : "Print Agent: ไม่ทำงาน"}
            sx={{
              backgroundColor: agentOnline ? '#e6f7ec' : '#fdecea',
              color: agentOnline ? '#2e7d32' : '#c62828',
            }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={slipPrinterEnabled}
                onChange={(e) => setSlipPrinterEnabled(e.target.checked)}
              />
            }
            label={slipPrinterEnabled ? "เครื่องนี้พิมพ์สลิปอัตโนมัติ (ทุกหน้า)" : "เครื่องนี้ไม่พิมพ์สลิป"}
            sx={{ marginRight: 1, '& .MuiFormControlLabel-label': { fontSize: 13 } }}
          />
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddReader}
            sx={{
              backgroundColor: '#4aaaec',
              '&:hover': { backgroundColor: '#3a8ac0' },
              fontWeight: 'bold',
              textTransform: 'none',
            }}
          >
            เพิ่มเครื่องอ่านใหม่
          </Button>
        </Box>
      </Box>

      {/* Location selector */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 2 }}>
        <Typography sx={{ fontSize: '13px', color: '#666', fontWeight: 'bold' }}>
          เลือกจุด:
        </Typography>
        <TextField
          select
          size="small"
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="all">ทั้งหมด</MenuItem>
          {locations.map((loc) => (
            <MenuItem key={loc} value={loc}>{loc}</MenuItem>
          ))}
        </TextField>

        <Chip
          size="small"
          label={`${mergedData.length} เครื่อง`}
          sx={{ backgroundColor: '#f0f0f0', color: '#666' }}
        />
      </Box>

      {/* Error message */}
      {printerError && (
        <Typography sx={{ color: '#c62828', fontSize: '13px', marginBottom: 2 }}>
          ⚠️ {printerError}
        </Typography>
      )}

      {/* Reader cards */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {mergedData.length === 0 ? (
          <Typography sx={{ color: '#999', fontSize: 13 }}>
            ยังไม่มีเครื่องอ่านที่ตั้งค่าไว้ — กดปุ่ม ⚙️ เพื่อเพิ่มเครื่องอ่านใหม่
          </Typography>
        ) : (
          mergedData.map((config) => (
            <ReaderCard
              key={config.id}
              config={config}
              online={config.online}
              lastResult={config.lastResult}
              isPrinting={config.isPrinting}
              onToggle={handleToggle}
              onOpenSettings={handleOpenSettings}
              onOpenFocus={handleOpenFocus}
              toggling={togglingId === config.id}
            />
          ))
        )}
      </Box>

      {/* Password prompt */}
      <PasswordPromptDialog
        open={passwordDialog.open}
        onClose={() => setPasswordDialog({ open: false, config: null, mode: 'edit', error: '' })}
        onVerify={handleVerifyPasscode}
        error={passwordDialog.error}
      />

      {/* Settings modal (ใช้ร่วมกันทั้งแก้ไขเครื่องเดิม และเพิ่มเครื่องใหม่) */}
      <ReaderSettingsModal
        open={settingsModal.open}
        onClose={() => setSettingsModal({ open: false, config: null, mode: 'edit' })}
        config={settingsModal.config}
        mode={settingsModal.mode}
        suggestedReaderNo={nextSuggestedReaderNo}
        onSave={handleSaveConfig}
      />

      {/* หน้าจอใหญ่แสดงจุดที่เปิดเครื่องอ่านอยู่ */}
      <ReaderFocusView
        open={!!focusReaderId && !!focusConfig}
        config={focusConfig}
        online={focusStatus?.online || false}
        lastResult={focusResult}
        isPrinting={printingId === focusReaderId}
        onClose={() => setFocusReaderId(null)}
      />
    </Box>
  );
};

export default ReaderPanel;
