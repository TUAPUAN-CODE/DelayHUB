import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import QrScanner from 'qr-scanner';
import {
  Box, Paper, TextField, Autocomplete, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress,
  Dialog, IconButton,
} from '@mui/material';
import { Close, QrCodeScanner } from '@mui/icons-material';
import ModalSlipPrint from './ModalSlipPrint';

const API_URL = import.meta.env.VITE_API_URL;

const TYPES = ['CUP', 'CAN', 'LID', 'POUCH', 'SACHET', 'SPOUT', 'CHOKE', 'JERKY'];

const EMPTY_FORM = {
  type_choice: '',
  send_date: '',
  seq_use: '',
  line_id: null,
  line_name: '',
  code_mat: '',
  batch_no: '',
  receive_date: '',
  produce_date: '',
  produce_time: '00:00',
  box_no: '',
  lot: '',
  roll_no: '',
  hu: '',
  size: '',
  te: '',
  qty: '',
  remark: '',
  code: '',
};

// ─── Thailand date helpers ─────────────────────────────────────────────────
// Used to restrict "ประวัติการบันทึก" (records history) to today's date only,
// filtered by "วันที่ส่ง / กะ" (send_date) — NOT created_at.
// Always resolved against Asia/Bangkok, regardless of the browser/device's
// own timezone, so "today" means the same thing for everyone using the app.
const getTodayThaiDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

// Extracts just the date part (YYYY-MM-DD) from a send_date value, which may
// arrive as a plain "YYYY-MM-DD" / "YYYY-MM-DD HH:mm:ss" string, or as an
// ISO string carrying explicit timezone info (e.g. "...Z"). In the latter
// case, convert to Asia/Bangkok before taking the date part, so the
// comparison against "today" lines up with Thai wall-clock time.
const getSendDatePart = (d) => {
  if (!d) return '';
  const s = String(d);
  const hasTzTag = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  if (hasTzTag) {
    const dateObj = new Date(s);
    if (!isNaN(dateObj.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(dateObj);
    }
  }
  return s.slice(0, 10);
};

// ─── QR Scanner inner view ────────────────────────────────────────────────────
const QrScannerView = ({ onScan, onError }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        const text = typeof result === 'object' ? result.data : result;
        if (text) onScan(text);
      },
      {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
        returnDetailedScanResult: true,
        onDecodeError: () => { },
      }
    );
    scanner.start().catch((err) => onError(err.message || 'ไม่สามารถเข้าถึงกล้องได้'));
    return () => { scanner.stop(); scanner.destroy(); };
  }, []);

  return <video ref={videoRef} style={{ width: '100%', display: 'block', borderRadius: '6px' }} muted playsInline />;
};

// ─── QR Scan Modal ────────────────────────────────────────────────────────────
const QrScanModal = ({ open, onClose, onScan }) => {
  const [scanError, setScanError] = useState('');
  const handleClose = () => { setScanError(''); onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold', fontSize: '16px' }}>
          <QrCodeScanner sx={{ color: '#1976D2' }} />
          Scan QR Code
        </Box>
        <IconButton onClick={handleClose} size="small"><Close /></IconButton>
      </Box>
      <Box sx={{ p: 2 }}>
        <Box sx={{ borderRadius: '8px', overflow: 'hidden', border: '2px solid #e3f2fd', mb: 1.5 }}>
          {open && (
            <QrScannerView
              onScan={(text) => { onScan(text); handleClose(); }}
              onError={setScanError}
            />
          )}
        </Box>
        {scanError && (
          <Box sx={{ mb: 1.5, p: 1.5, borderRadius: '6px', backgroundColor: '#ffebee', color: '#c62828', fontSize: '12px' }}>
            ❌ {scanError}
          </Box>
        )}
        <Box sx={{ p: 1.5, borderRadius: '6px', backgroundColor: '#f5f5f5', fontSize: '11px', color: '#666' }}>
          <Box sx={{ fontWeight: 'bold', mb: 0.5 }}>Format ที่รองรับ:</Box>
          <Box sx={{ fontFamily: 'monospace', color: '#1976D2' }}>MAT|BATCH|HU|Quantity|PC</Box>
          <Box sx={{ mt: 0.5 }}>ชี้กล้องไปที่ QR Code — อ่านอัตโนมัติแล้วปิด</Box>
        </Box>
      </Box>
    </Dialog>
  );
};

// ─── Shared input styles ──────────────────────────────────────────────────────
const TypeButton = ({ type, selected, onClick }) => (
  <Box onClick={onClick} sx={{
    border: selected ? '2px solid #1565C0' : '1.5px solid #ccc',
    borderRadius: '8px', px: 2, py: 0.8,
    cursor: 'pointer', fontWeight: selected ? 'bold' : 'normal',
    fontSize: '13px',
    backgroundColor: selected ? '#1976D2' : '#f5f5f5',
    color: selected ? '#fff' : '#444',
    userSelect: 'none', transition: 'all 0.15s',
    '&:hover': { backgroundColor: selected ? '#1565C0' : '#e3f2fd', borderColor: '#1976D2' },
    whiteSpace: 'nowrap',
  }}>
    {type}
  </Box>
);

const FieldLabel = ({ children, required }) => (
  <Box sx={{ fontSize: '10px', fontWeight: 'bold', color: '#555', mb: 0.3, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
    {children}{required && <span style={{ color: 'red' }}> *</span>}
  </Box>
);

const inputSx = {
  '& .MuiInputBase-root': { height: '34px', fontSize: '13px', backgroundColor: '#fff' },
  '& .MuiInputBase-input': { padding: '6px 10px' },
};

const dateInputStyle = {
  width: '100%', height: '34px', fontSize: '13px',
  padding: '0 8px', border: '1px solid #c4c4c4',
  borderRadius: '4px', outline: 'none', backgroundColor: '#fff',
};

// ─── Main Component ───────────────────────────────────────────────────────────
const TableMainPrep = () => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [lineInput, setLineInput] = useState(null);
  const [lines, setLines] = useState([]);
  const [records, setRecords] = useState([]);
  const [saving, setSaving] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [slipData, setSlipData] = useState(null);

  useEffect(() => {
    fetchLines();
    fetchRecords();
  }, []);

  const fetchLines = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/pack/printmaster/lines`);
      if (res.data.success) setLines(res.data.data);
    } catch (err) {
      console.error('fetchLines error:', err);
    }
  };

  // ตารางประวัติ ("ประวัติการบันทึก") แสดงเฉพาะรายการที่ "วันที่ส่ง / กะ"
  // (send_date) ตรงกับวันนี้เท่านั้น — ไม่ดึงข้อมูลของวันอื่นมาแสดง
  // เผื่อ backend รองรับ query param `send_date` (กรองที่ฝั่งเซิร์ฟเวอร์ ลด
  // ปริมาณข้อมูลที่ต้องโหลด) จึงส่งไปด้วย แต่ยังกรองซ้ำที่ฝั่ง client เสมอ
  // เพื่อความชัวร์ ไม่ว่า backend จะรองรับ param นี้หรือไม่ก็ตาม
  const fetchRecords = async () => {
    try {
      const today = getTodayThaiDate();
      const res = await axios.get(`${API_URL}/api/pack/printmaster/list`, {
        params: { send_date: today },
      });
      if (res.data.success) {
        const onlyToday = (res.data.data || []).filter(
          r => getSendDatePart(r.send_date) === today
        );
        setRecords(onlyToday);
      }
    } catch (err) {
      console.error('fetchRecords error:', err);
    }
  };

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleClear = () => {
    setForm(EMPTY_FORM);
    setLineInput(null);
  };

  const handleQrScan = (text) => {
    const parts = text.split('|');
    if (parts.length < 3) return;
    setForm(prev => ({
      ...prev,
      code_mat: (parts[0] || '').trim().slice(0, 12),
      batch_no: (parts[1] || '').trim().slice(0, 10),
      hu: (parts[2] || '').trim(),
    }));
    setQrOpen(false);
  };

  const handleSave = async (andPrint = false) => {
    if (!form.type_choice) { alert('กรุณาเลือก Type ก่อน'); return; }
     if (!form.code || !form.code.trim()) { alert('กรุณากรอก Code ก่อนบันทึก'); return; }  
    setSaving(true);
    try {
      const produceDateTime = form.produce_date
        ? `${form.produce_date} ${form.produce_time || '00:00'}:00`
        : '';
      // ตัด produce_time ออกจาก payload เพราะถูกรวมเข้าไปใน produce_date
      // (แบบเต็ม YYYY-MM-DD HH:mm:ss) แล้วด้านบน ถ้าส่ง produce_time ("00:00")
      // ติดไปด้วย backend จะพยายาม insert ค่านี้ลงคอลัมน์ DATETIME แล้วเกิด
      // error "Validation failed for parameter 'produce_time'. Invalid date."
      const { produce_time, ...formWithoutTime } = form;
      const payload = {
        ...formWithoutTime,
        produce_date: produceDateTime,
        shift: form.send_date,
        line_name: lineInput?.line_name || form.line_name,
      };
      const res = await axios.post(`${API_URL}/api/pack/printmaster/save`, payload);
      if (res.data.success) {
        await fetchRecords();
        handleClear();
        if (andPrint) setSlipData({ ...payload, slip_id: res.data.slip_id });
      }
    } catch (err) {
      console.error('save error:', err);
      alert('เกิดข้อผิดพลาด: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleRowClick = (row) => {
    setForm({
      type_choice: row.type_choice || '',
      send_date: row.send_date ? String(row.send_date).slice(0, 10) : '',
      seq_use: row.seq_use ?? '',
      line_id: row.line_id ?? null,
      line_name: row.line_name || '',
      code_mat: row.code_mat || '',
      batch_no: row.batch_no || '',
      receive_date: row.receive_date ? String(row.receive_date).slice(0, 10) : '',
      produce_date: row.produce_date ? String(row.produce_date).slice(0, 10) : '',
      produce_time: row.produce_date ? (String(row.produce_date).slice(11, 16) || '00:00') : '00:00',
      box_no: row.box_no ?? '',
      lot: row.lot ?? '',
      roll_no: row.roll_no ?? '',
      hu: row.hu ?? '',
      size: row.size || '',
      te: row.te || '',
      qty: row.qty ?? '',
      remark: row.remark || '',
      code: row.code || '',
    });
    setLineInput(lines.find(l => l.line_id === row.line_id) || null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Dialogs */}
      <QrScanModal open={qrOpen} onClose={() => setQrOpen(false)} onScan={handleQrScan} />
      <ModalSlipPrint open={slipData !== null} onClose={() => setSlipData(null)} data={slipData} />

      {/* ─── Form Card ─── */}
      <Paper sx={{ p: 2.5, borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>

        {/* Type Selection */}
        <Box sx={{ mb: 2 }}>
          <FieldLabel required>Type</FieldLabel>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {TYPES.map(t => (
              <TypeButton key={t} type={t} selected={form.type_choice === t} onClick={() => setField('type_choice', t)} />
            ))}
          </Box>
        </Box>

        {/* Row: วันที่ส่ง / กะ | ลำดับการใช้ | Line */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 1.5, mb: 1.5 }}>
          <Box>
            <FieldLabel>วันที่ส่ง / กะ</FieldLabel>
            <input type="date" value={form.send_date} onChange={e => setField('send_date', e.target.value)} style={dateInputStyle} />
          </Box>
          <Box>
            <FieldLabel>ลำดับการใช้</FieldLabel>
            <TextField type="number" value={form.seq_use} onChange={e => setField('seq_use', e.target.value)} fullWidth sx={inputSx} inputProps={{ min: 1 }} />
          </Box>
          <Box>
            <FieldLabel>Line</FieldLabel>
            <Autocomplete
              options={lines}
              getOptionLabel={o => o.line_name || ''}
              value={lineInput}
              onChange={(_, v) => { setLineInput(v); setField('line_id', v?.line_id ?? null); setField('line_name', v?.line_name || ''); }}
              renderInput={params => <TextField {...params} placeholder="พิมพ์ค้นหา Line..." sx={inputSx} />}
              size="small"
              noOptionsText="ไม่พบข้อมูล"
              isOptionEqualToValue={(o, v) => o.line_id === v.line_id}
            />
          </Box>
        </Box>

        {/* QR Scan Button */}
        <Box sx={{ mb: 1.5 }}>
          <Box onClick={() => setQrOpen(true)} sx={{
            display: 'inline-flex', alignItems: 'center', gap: 1,
            px: 2.5, py: 1, borderRadius: '8px',
            border: '1.5px solid #1976D2',
            backgroundColor: '#e3f2fd', color: '#1565C0',
            cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
            userSelect: 'none', transition: 'all 0.15s',
            '&:hover': { backgroundColor: '#1976D2', color: '#fff' },
          }}>
            <QrCodeScanner sx={{ fontSize: '18px' }} />
            Scan QR Code → ใส่ CODE MAT / BATCH / HU อัตโนมัติ
          </Box>
        </Box>

        {/* Row: CODE MAT | BATCH NO */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1.5 }}>
          <Box>
            <FieldLabel>CODE MAT. (12 หลัก)</FieldLabel>
            <TextField
              value={form.code_mat}
              onChange={e => { if (e.target.value.length <= 12) setField('code_mat', e.target.value); }}
              fullWidth sx={inputSx}
              inputProps={{ maxLength: 12, style: { fontFamily: 'monospace', letterSpacing: '4px', fontWeight: 'bold' } }}
              placeholder="____________"
              helperText={`${(form.code_mat || '').length} / 12 หลัก`}
            />
          </Box>
          <Box>
            <FieldLabel>BATCH NO. (10 หลัก)</FieldLabel>
            <TextField
              value={form.batch_no}
              onChange={e => { if (e.target.value.length <= 10) setField('batch_no', e.target.value); }}
              fullWidth sx={inputSx}
              inputProps={{ maxLength: 10, style: { fontFamily: 'monospace', letterSpacing: '4px', fontWeight: 'bold' } }}
              placeholder="__________"
              helperText={`${(form.batch_no || '').length} / 10 หลัก`}
            />
          </Box>
        </Box>

        {/* Row: วันที่รับเข้า | วันที่ผลิต | BOX NO. | LOT */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1.5, mb: 1.5 }}>
          <Box>
            <FieldLabel>วันที่รับเข้า</FieldLabel>
            <input type="date" value={form.receive_date} onChange={e => setField('receive_date', e.target.value)} style={dateInputStyle} />
          </Box>
          <Box>
            <FieldLabel>วันที่ผลิต</FieldLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <input type="date" value={form.produce_date} onChange={e => setField('produce_date', e.target.value)} style={dateInputStyle} />
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                height: '34px', border: '1px solid #c4c4c4', borderRadius: '4px',
                px: 1, backgroundColor: '#fff',
              }}>
                <input
                  type="number" min="0" max="23"
                  value={parseInt(form.produce_time?.split(':')[0] ?? '0', 10)}
                  onChange={e => {
                    const h = Math.max(0, Math.min(23, parseInt(e.target.value) || 0)).toString().padStart(2, '0');
                    const m = form.produce_time?.split(':')[1] ?? '00';
                    setField('produce_time', `${h}:${m}`);
                  }}
                  style={{ width: '36px', border: 'none', outline: 'none', fontSize: '13px', textAlign: 'center', padding: 0 }}
                />
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555', lineHeight: 1 }}>:</span>
                <input
                  type="number" min="0" max="59"
                  value={parseInt(form.produce_time?.split(':')[1] ?? '0', 10)}
                  onChange={e => {
                    const h = form.produce_time?.split(':')[0] ?? '00';
                    const m = Math.max(0, Math.min(59, parseInt(e.target.value) || 0)).toString().padStart(2, '0');
                    setField('produce_time', `${h}:${m}`);
                  }}
                  style={{ width: '36px', border: 'none', outline: 'none', fontSize: '13px', textAlign: 'center', padding: 0 }}
                />
                <span style={{ fontSize: '11px', color: '#999', marginLeft: '2px' }}>น. (0-23)</span>
              </Box>
            </Box>
          </Box>
          <Box>
            <FieldLabel>BOX NO.</FieldLabel>
            <TextField type="number" value={form.box_no} onChange={e => setField('box_no', e.target.value)} fullWidth sx={inputSx} />
          </Box>
          <Box>
            <FieldLabel>LOT</FieldLabel>
            <TextField value={form.lot} onChange={e => setField('lot', e.target.value)} fullWidth sx={inputSx} />
          </Box>
        </Box>

        {/* Row: ROLL NO. | HU | SIZE | TE */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1.5, mb: 1.5 }}>
          <Box>
            <FieldLabel>ROLL NO.</FieldLabel>
            <TextField type="number" value={form.roll_no} onChange={e => setField('roll_no', e.target.value)} fullWidth sx={inputSx} />
          </Box>
          <Box>
            <FieldLabel>HU</FieldLabel>
            <TextField type="number" value={form.hu} onChange={e => setField('hu', e.target.value)} fullWidth sx={inputSx} />
          </Box>
          <Box>
            <FieldLabel>SIZE</FieldLabel>
            <TextField value={form.size} onChange={e => { if (e.target.value.length <= 30) setField('size', e.target.value); }} fullWidth sx={inputSx} inputProps={{ maxLength: 30 }} />
          </Box>
          <Box>
            <FieldLabel>TE</FieldLabel>
            <TextField value={form.te} onChange={e => { if (e.target.value.length <= 30) setField('te', e.target.value); }} fullWidth sx={inputSx} inputProps={{ maxLength: 30 }} />
          </Box>
        </Box>

        {/* Row: จำนวน | หมายเหตุ | Code */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 1.5, mb: 2.5 }}>
          <Box>
            <FieldLabel>จำนวน</FieldLabel>
            <TextField type="number" value={form.qty} onChange={e => setField('qty', e.target.value)} fullWidth sx={inputSx} />
          </Box>
          <Box>
            <FieldLabel>หมายเหตุ</FieldLabel>
            <TextField value={form.remark} onChange={e => { if (e.target.value.length <= 100) setField('remark', e.target.value); }}
              fullWidth sx={inputSx} inputProps={{ maxLength: 100 }} placeholder="สูงสุด 100 ตัวอักษร" />
          </Box>
          <Box>
            <FieldLabel required>Code</FieldLabel>
            <TextField
              value={form.code}
              onChange={e => setField('code', e.target.value)}
              fullWidth
              sx={inputSx}
              error={!form.code?.trim()}
              placeholder="กรุณากรอก Code"
            />
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', borderTop: '1px solid #e0e0e0', pt: 2 }}>
          <Box onClick={handleClear} sx={{
            px: 3, py: 1, borderRadius: '8px', border: '1.5px solid #bbb',
            cursor: 'pointer', fontSize: '14px', color: '#555',
            '&:hover': { backgroundColor: '#f0f0f0' },
          }}>
            ล้างข้อมูล
          </Box>
          <Box onClick={() => !saving && handleSave(true)} sx={{
            px: 3, py: 1, borderRadius: '8px',
            backgroundColor: saving ? '#81C784' : '#2E7D32',
            color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: 'bold',
            display: 'flex', alignItems: 'center', gap: 1,
            '&:hover': { backgroundColor: saving ? '#81C784' : '#1B5E20' },
          }}>
            {saving && <CircularProgress size={14} color="inherit" />}
            🖨️ บันทึก + ปริ้น
          </Box>
        </Box>
      </Paper>

      {/* ─── Records Table ─── */}
      <Paper sx={{ borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ fontWeight: 'bold', fontSize: '15px', color: '#1976D2' }}>
            ประวัติการบันทึก — วันนี้ ({records.length} รายการ)
          </Box>
          <Box sx={{ fontSize: '11px', color: '#999' }}>คลิกแถวเพื่อโหลดข้อมูลมาแก้ไข → บันทึกใหม่</Box>
        </Box>
        <TableContainer sx={{ maxHeight: '420px' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {['#', 'Slip ID', 'Type', 'วันที่ส่ง / กะ', 'ลำดับ', 'Line', 'CODE MAT.', 'BATCH NO.', 'จำนวน', 'ปริ้น'].map(h => (
                  <TableCell key={h} sx={{
                    backgroundColor: '#1976D2', color: '#fff',
                    fontSize: '12px', fontWeight: 'bold',
                    whiteSpace: 'nowrap', py: 1, px: 1.5,
                  }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4, color: '#999', fontSize: '14px' }}>
                    วันนี้ยังไม่มีประวัติการบันทึก
                  </TableCell>
                </TableRow>
              ) : records.map((row, i) => (
                <TableRow
                  key={row.slip_id}
                  onClick={() => handleRowClick(row)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#e3f2fd' },
                    backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa',
                  }}
                >
                  <TableCell sx={{ fontSize: '12px', py: 0.8, px: 1.5, color: '#888' }}>{i + 1}</TableCell>
                  <TableCell sx={{ fontSize: '12px', py: 0.8, px: 1.5, fontFamily: 'monospace', color: '#666' }}>{row.slip_id ?? '-'}</TableCell>
                  <TableCell sx={{ py: 0.8, px: 1.5 }}>
                    <Chip label={row.type_choice || '-'} size="small"
                      sx={{ fontSize: '11px', height: '20px', backgroundColor: '#e3f2fd', color: '#1976D2', fontWeight: 'bold' }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: '12px', py: 0.8, px: 1.5, whiteSpace: 'nowrap' }}>
                    {row.send_date ? String(row.send_date).slice(0, 10) : '-'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '12px', py: 0.8, px: 1.5 }}>{row.seq_use ?? '-'}</TableCell>
                  <TableCell sx={{ fontSize: '12px', py: 0.8, px: 1.5, whiteSpace: 'nowrap' }}>{row.line_name || '-'}</TableCell>
                  <TableCell sx={{ fontSize: '12px', py: 0.8, px: 1.5, fontFamily: 'monospace', letterSpacing: '1px' }}>{row.code_mat || '-'}</TableCell>
                  <TableCell sx={{ fontSize: '12px', py: 0.8, px: 1.5, fontFamily: 'monospace', letterSpacing: '1px' }}>{row.batch_no || '-'}</TableCell>
                  <TableCell sx={{ fontSize: '12px', py: 0.8, px: 1.5 }}>{row.qty ?? '-'}</TableCell>
                  <TableCell sx={{ py: 0.8, px: 1.5 }}>
                    <Box
                      onClick={e => { e.stopPropagation(); setSlipData(row); }}
                      sx={{
                        fontSize: '11px', px: 1.5, py: 0.3,
                        borderRadius: '4px', backgroundColor: '#1976D2',
                        color: '#fff', cursor: 'pointer', display: 'inline-block',
                        whiteSpace: 'nowrap',
                        '&:hover': { backgroundColor: '#1565C0' },
                      }}
                    >
                      🖨️ ปริ้น
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default TableMainPrep;