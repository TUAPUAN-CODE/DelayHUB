import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import QrScanner from 'qr-scanner';
import {
  Box, Paper, TextField, Autocomplete, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress,
  Dialog, IconButton, InputAdornment,
} from '@mui/material';
import { Close, QrCodeScanner, Search, FilterList, Language } from '@mui/icons-material';
import ModalSlipPrint from './ModalSlipPrint';

const API_URL = import.meta.env.VITE_API_URL;

const TYPES = ['CUP', 'CAN', 'LID', 'POUCH', 'SACHET', 'SPOUT', 'CHOKE', 'JERKY']
  .sort((a, b) => a.localeCompare(b));

const MAX_SEQ_RANGE = 50; // จำนวนรายการสูงสุดที่บันทึกได้ต่อครั้ง

const EMPTY_FORM = {
  type_choice: '',
  send_date: '',
  seq_use: '',
  seq_use_to: '',
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

// ─── i18n ───────────────────────────────────────────────────────────────────
const LANG_STORAGE_KEY = 'tableMainPrep_lang';

const TEXT = {
  th: {
    type: 'Type',
    sendDateShift: 'วันที่ส่ง / กะ',
    seqUse: 'ลำดับการใช้ (จาก)',
    seqUseTo: 'ถึงลำดับ',
    seqUseToHint: 'ว่าง = อันเดียว',
    line: 'Line',
    lineSearchPlaceholder: 'พิมพ์ค้นหา Line...',
    noOptions: 'ไม่พบข้อมูล',
    scanQr: 'Scan QR Code',
    scanQrHint: 'ใส่ CODE MAT / BATCH / HU / จำนวน อัตโนมัติ',
    qrSupportedFormat: 'Format ที่รองรับ:',
    qrInstructions: 'ชี้กล้องไปที่ QR Code — อ่านอัตโนมัติแล้วปิด',
    qrCameraError: 'ไม่สามารถเข้าถึงกล้องได้',
    codeMat: 'CODE MAT. (12 หลัก)',
    codeMatHelper: (n) => `${n} / 12 หลัก`,
    batchNo: 'BATCH NO. (10 หลัก)',
    batchNoHelper: (n) => `${n} / 10 หลัก`,
    receiveDate: 'วันที่รับเข้า',
    produceDate: 'วันที่ผลิต',
    hourSuffix: 'น. (0-23)',
    boxNo: 'BOX NO.',
    lot: 'LOT',
    rollNo: 'ROLL NO.',
    hu: 'HU',
    size: 'SIZE',
    te: 'TE',
    qty: 'จำนวน',
    remark: 'หมายเหตุ',
    remarkPlaceholder: 'สูงสุด 100 ตัวอักษร',
    code: 'Code',
    codePlaceholder: 'กรุณากรอก Code',
    clear: 'ล้างข้อมูล',
    save: 'บันทึก',
    saveAndPrint: 'บันทึก + ปริ้น',
    historyTitle: (n) => `ประวัติการบันทึก — วันนี้ (${n} รายการ)`,
    historyHint: 'คลิกแถวเพื่อโหลดข้อมูลมาแก้ไข → บันทึกใหม่',
    filterByType: 'กรองตาม Type...',
    searchPlaceholder: 'ค้นหา Slip ID, CODE MAT, BATCH, Line, Code, หมายเหตุ ...',
    showingCount: (shown, total) => `แสดง ${shown} / ${total} รายการ`,
    clearFilters: 'ล้างตัวกรอง',
    tableHeaders: ['#', 'Slip ID', 'Type', 'วันที่ส่ง / กะ', 'ลำดับ', 'Line', 'CODE MAT.', 'BATCH NO.', 'จำนวน', 'ปริ้น'],
    noResultsFiltered: 'ไม่พบรายการที่ตรงกับเงื่อนไข',
    noRecordsToday: 'วันนี้ยังไม่มีประวัติการบันทึก',
    printRow: 'ปริ้น',
    alertSelectType: 'กรุณาเลือก Type ก่อน',
    alertEnterCode: 'กรุณากรอก Code ก่อนบันทึก',
    alertSeqRange: `ต้องกรอกลำดับเริ่มต้น และลำดับสิ้นสุดต้องมากกว่าหรือเท่ากับลำดับเริ่มต้น (สูงสุด ${MAX_SEQ_RANGE} รายการ)`,
    alertError: 'เกิดข้อผิดพลาด: ',
  },
  en: {
    type: 'Type',
    sendDateShift: 'Send Date / Shift',
    seqUse: 'Usage Seq (From)',
    seqUseTo: 'To Seq',
    seqUseToHint: 'Empty = single',
    line: 'Line',
    lineSearchPlaceholder: 'Type to search Line...',
    noOptions: 'No data found',
    scanQr: 'Scan QR Code',
    scanQrHint: 'Auto-fill CODE MAT / BATCH / HU / Quantity',
    qrSupportedFormat: 'Supported format:',
    qrInstructions: 'Point the camera at the QR Code — it scans automatically and closes',
    qrCameraError: 'Unable to access the camera',
    codeMat: 'CODE MAT. (12 digits)',
    codeMatHelper: (n) => `${n} / 12 digits`,
    batchNo: 'BATCH NO. (10 digits)',
    batchNoHelper: (n) => `${n} / 10 digits`,
    receiveDate: 'Receive Date',
    produceDate: 'Produce Date',
    hourSuffix: 'hr (0-23)',
    boxNo: 'BOX NO.',
    lot: 'LOT',
    rollNo: 'ROLL NO.',
    hu: 'HU',
    size: 'SIZE',
    te: 'TE',
    qty: 'Quantity',
    remark: 'Remark',
    remarkPlaceholder: 'Max 100 characters',
    code: 'Code',
    codePlaceholder: 'Please enter Code',
    clear: 'Clear',
    save: 'Save',
    saveAndPrint: 'Save + Print',
    historyTitle: (n) => `Today's Records (${n} items)`,
    historyHint: 'Click a row to load it for editing → save again',
    filterByType: 'Filter by Type...',
    searchPlaceholder: 'Search Slip ID, CODE MAT, BATCH, Line, Code, Remark ...',
    showingCount: (shown, total) => `Showing ${shown} / ${total} items`,
    clearFilters: 'Clear filters',
    tableHeaders: ['#', 'Slip ID', 'Type', 'Send Date / Shift', 'Seq', 'Line', 'CODE MAT.', 'BATCH NO.', 'Qty', 'Print'],
    noResultsFiltered: 'No records match the filter',
    noRecordsToday: 'No records saved today yet',
    printRow: 'Print',
    alertSelectType: 'Please select a Type first',
    alertEnterCode: 'Please enter a Code before saving',
    alertSeqRange: `From Seq is required and To Seq must be >= From Seq (max ${MAX_SEQ_RANGE} items)`,
    alertError: 'Error: ',
  },
};

// ─── Thailand date helpers ─────────────────────────────────────────────────
const getTodayThaiDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

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

// ─── ถอดวันที่จาก BATCH NO. ────────────────────────────────────────────────
// ตำแหน่งที่ 5 = เดือน, ตำแหน่งที่ 6 = วัน  เช่น CRA9FRNN11 → F=มิ.ย. (6), R=25
const BATCH_MONTH_MAP = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 9, K: 10, L: 11, M: 12 };
const BATCH_DAY_MAP = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, J: 18, K: 19, L: 20,
  M: 21, N: 22, O: 23, P: 24, R: 25, S: 26, T: 27, V: 28, W: 29, X: 30, Z: 31,
};
// ตาราง R/M: วันที่ 23-28 ตัวอักษรเลื่อนไปหนึ่งตัว (P=23, R=24, S=25, T=26, U=27, V=28)
const BATCH_DAY_MAP_RM = { ...BATCH_DAY_MAP, P: 23, R: 24, S: 25, T: 26, U: 27, V: 28 };
const USE_RM_DAY_TABLE = false; // เปลี่ยนเป็น true ถ้า batch เป็นของ R/M

const decodeBatchDate = (batch) => {
  const s = String(batch || '').trim().toUpperCase();
  if (s.length < 6) return '';
  const month = BATCH_MONTH_MAP[s[4]];
  const dayChar = s[5];
  const dayMap = USE_RM_DAY_TABLE ? BATCH_DAY_MAP_RM : BATCH_DAY_MAP;
  const day = /[1-9]/.test(dayChar) ? Number(dayChar) : dayMap[dayChar];
  if (!month || !day) return '';

  // ใน batch ไม่มีรหัสปี → ใช้ปีปัจจุบัน (เวลาไทย) ถ้าวันที่ได้อยู่ในอนาคตให้ถอยไปปีก่อน
  const today = getTodayThaiDate(); // YYYY-MM-DD
  let year = Number(today.slice(0, 4));
  const mk = (y) => `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (mk(year) > today) year -= 1;

  // กันวันที่ไม่มีจริง เช่น 31 ก.พ.
  const d = new Date(`${mk(year)}T00:00:00Z`);
  if (d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) return '';
  return mk(year);
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
    scanner.start().catch((err) => onError(err.message || 'camera-error'));
    return () => { scanner.stop(); scanner.destroy(); };
  }, []);

  return <video ref={videoRef} style={{ width: '100%', display: 'block', borderRadius: '6px' }} muted playsInline />;
};

// ─── QR Scan Modal ────────────────────────────────────────────────────────────
const QrScanModal = ({ open, onClose, onScan, t }) => {
  const [scanError, setScanError] = useState('');
  const handleClose = () => { setScanError(''); onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold', fontSize: '16px' }}>
          <QrCodeScanner sx={{ color: '#1976D2' }} />
          {t.scanQr}
        </Box>
        <IconButton onClick={handleClose} size="small"><Close /></IconButton>
      </Box>
      <Box sx={{ p: 2 }}>
        <Box sx={{ borderRadius: '8px', overflow: 'hidden', border: '2px solid #e3f2fd', mb: 1.5 }}>
          {open && (
            <QrScannerView
              onScan={(text) => { onScan(text); handleClose(); }}
              onError={(msg) => setScanError(msg === 'camera-error' ? t.qrCameraError : msg)}
            />
          )}
        </Box>
        {scanError && (
          <Box sx={{ mb: 1.5, p: 1.5, borderRadius: '6px', backgroundColor: '#ffebee', color: '#c62828', fontSize: '12px' }}>
            ❌ {scanError}
          </Box>
        )}
        <Box sx={{ p: 1.5, borderRadius: '6px', backgroundColor: '#f5f5f5', fontSize: '11px', color: '#666' }}>
          <Box sx={{ fontWeight: 'bold', mb: 0.5 }}>{t.qrSupportedFormat}</Box>
          <Box sx={{ fontFamily: 'monospace', color: '#1976D2' }}>MAT|BATCH|HU|Quantity|PC</Box>
          <Box sx={{ mt: 0.5 }}>{t.qrInstructions}</Box>
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

// ─── Language Switch ────────────────────────────────────────────────────────
const LangSwitch = ({ lang, onChange }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: 'flex-end' }}>
    <Language sx={{ fontSize: '16px', color: '#999' }} />
    <Box sx={{ display: 'flex', border: '1.5px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
      {[
        { code: 'th', label: 'ไทย' },
        { code: 'en', label: 'EN' },
      ].map(({ code, label }) => (
        <Box
          key={code}
          onClick={() => onChange(code)}
          sx={{
            px: 1.5, py: 0.5, fontSize: '12px', cursor: 'pointer', userSelect: 'none',
            fontWeight: lang === code ? 'bold' : 'normal',
            backgroundColor: lang === code ? '#1976D2' : '#f5f5f5',
            color: lang === code ? '#fff' : '#555',
            transition: 'all 0.15s',
            '&:hover': { backgroundColor: lang === code ? '#1565C0' : '#e3f2fd' },
          }}
        >
          {label}
        </Box>
      ))}
    </Box>
  </Box>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const TableMainPrep = () => {
  const [lang, setLang] = useState(() => {
    try {
      const saved = window.localStorage?.getItem(LANG_STORAGE_KEY);
      return saved === 'en' ? 'en' : 'th';
    } catch {
      return 'th';
    }
  });
  const t = TEXT[lang];

  const handleLangChange = (code) => {
    setLang(code);
    try { window.localStorage?.setItem(LANG_STORAGE_KEY, code); } catch { /* noop */ }
  };

  const [form, setForm] = useState(EMPTY_FORM);
  const [lineInput, setLineInput] = useState(null);
  const [lines, setLines] = useState([]);
  const [records, setRecords] = useState([]);
  const [saving, setSaving] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [slipData, setSlipData] = useState(null);

  // ─── Filter state for records history ───────────────────────────────────
  const [filterType, setFilterType] = useState(null);   // Type dropdown filter
  const [searchText, setSearchText] = useState('');      // free-text search

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

  // ─── Filtered records (Type dropdown + search text) ─────────────────────
  const filteredRecords = useMemo(() => {
    let result = records;

    // 1) filter by Type dropdown
    if (filterType) {
      result = result.filter(r => r.type_choice === filterType);
    }

    // 2) filter by search text — across multiple fields
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(r => {
        const fields = [
          r.slip_id,
          r.type_choice,
          r.line_name,
          r.code_mat,
          r.batch_no,
          r.code,
          r.remark,
          r.lot,
          r.roll_no,
          r.size,
          r.te,
          r.hu,
          r.qty,
          r.seq_use,
        ];
        return fields.some(f => String(f ?? '').toLowerCase().includes(q));
      });
    }

    return result;
  }, [records, filterType, searchText]);

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleClear = () => {
    setForm(EMPTY_FORM);
    setLineInput(null);
  };

  // ─── QR scan handler ──────────────────────────────────────────────────────
  // Format QR: MAT|BATCH|HU|Quantity|PC
  // parts[0] = CODE MAT.
  // parts[1] = BATCH NO.  → ใช้ถอดวันที่รับเข้าด้วย
  // parts[2] = HU
  // parts[3] = Quantity   → เติมลงช่อง "จำนวน" (qty)
  const handleQrScan = (text) => {
    const parts = text.split('|');
    if (parts.length < 3) return;
    const batch = (parts[1] || '').trim().slice(0, 10);
    setForm(prev => ({
      ...prev,
      code_mat: (parts[0] || '').trim().slice(0, 12),
      batch_no: batch,
      hu: (parts[2] || '').trim(),
      receive_date: decodeBatchDate(batch),
      qty: (parts[3] || '').trim(),
    }));
    setQrOpen(false);
  };

  const handleSave = async (andPrint = false) => {
    if (!form.type_choice) { alert(t.alertSelectType); return; }
    if (!form.code || !form.code.trim()) { alert(t.alertEnterCode); return; }

    // ─── คำนวณรายการลำดับที่จะบันทึก ───
    const hasTo = String(form.seq_use_to ?? '') !== '';
    const hasFrom = String(form.seq_use ?? '') !== '';
    const start = Number(form.seq_use);
    const end = Number(form.seq_use_to);

    if (hasTo) {
      const invalid =
        !hasFrom ||
        !Number.isInteger(start) || !Number.isInteger(end) ||
        end < start || end - start + 1 > MAX_SEQ_RANGE;
      if (invalid) { alert(t.alertSeqRange); return; }
    }

    const isRange = hasTo;
    const seqList = isRange
      ? Array.from({ length: end - start + 1 }, (_, i) => start + i)
      : [form.seq_use];

    setSaving(true);
    const saved = [];
    try {
      const produceDateTime = form.produce_date
        ? `${form.produce_date} ${form.produce_time || '00:00'}:00`
        : '';
      const { produce_time, seq_use_to, ...formWithoutTime } = form;
      const base = {
        ...formWithoutTime,
        produce_date: produceDateTime,
        shift: form.send_date,
        line_name: lineInput?.line_name || form.line_name,
      };

      // บันทึกทีละรายการตามลำดับ
      for (const seq of seqList) {
        const payload = { ...base, seq_use: seq };
        const res = await axios.post(`${API_URL}/api/pack/printmaster/save`, payload);
        if (!res.data.success) break;
        saved.push({ ...payload, slip_id: res.data.slip_id });
      }

      await fetchRecords();

      if (saved.length === seqList.length) {
        handleClear();
        // ปริ้นอัตโนมัติเฉพาะกรณีบันทึกอันเดียว — ถ้าเป็นช่วง ให้ไปเลือกปริ้นจากประวัติ
        if (andPrint && !isRange && saved.length > 0) setSlipData(saved[0]);
      } else if (isRange) {
        // บันทึกไม่ครบ: เลื่อนลำดับเริ่มต้นไปที่อันแรกที่ยังไม่ได้บันทึก กดบันทึกซ้ำได้โดยไม่ซ้ำ
        setField('seq_use', String(start + saved.length));
      }
    } catch (err) {
      console.error('save error:', err);
      await fetchRecords();
      if (isRange && saved.length > 0) {
        setField('seq_use', String(start + saved.length));
      }
      alert(t.alertError + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleRowClick = (row) => {
    setForm({
      type_choice: row.type_choice || '',
      send_date: row.send_date ? String(row.send_date).slice(0, 10) : '',
      seq_use: row.seq_use ?? '',
      seq_use_to: '',
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
      <QrScanModal open={qrOpen} onClose={() => setQrOpen(false)} onScan={handleQrScan} t={t} />
      <ModalSlipPrint open={slipData !== null} onClose={() => setSlipData(null)} data={slipData} />

      {/* ─── Language Switch ─── */}
      <LangSwitch lang={lang} onChange={handleLangChange} />

      {/* ─── Form Card ─── */}
      <Paper sx={{ p: 2.5, borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>

        {/* Type Selection */}
        <Box sx={{ mb: 2 }}>
          <FieldLabel required>{t.type}</FieldLabel>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {TYPES.map(ty => (
              <TypeButton key={ty} type={ty} selected={form.type_choice === ty} onClick={() => setField('type_choice', ty)} />
            ))}
          </Box>
        </Box>

        {/* Row: Send Date/Shift | Seq (จาก) | Seq (ถึง) | Line */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 0.7fr 0.7fr 2fr', gap: 1.5, mb: 1.5 }}>
          <Box>
            <FieldLabel>{t.sendDateShift}</FieldLabel>
            <input type="date" value={form.send_date} onChange={e => setField('send_date', e.target.value)} style={dateInputStyle} />
          </Box>
          <Box>
            <FieldLabel>{t.seqUse}</FieldLabel>
            <TextField type="number" value={form.seq_use} onChange={e => setField('seq_use', e.target.value)} fullWidth sx={inputSx} inputProps={{ min: 1 }} />
          </Box>
          <Box>
            <FieldLabel>{t.seqUseTo}</FieldLabel>
            <TextField
              type="number"
              value={form.seq_use_to}
              onChange={e => setField('seq_use_to', e.target.value)}
              fullWidth
              sx={inputSx}
              inputProps={{ min: form.seq_use || 1 }}
              placeholder={t.seqUseToHint}
            />
          </Box>
          <Box>
            <FieldLabel>{t.line}</FieldLabel>
            <Autocomplete
              options={lines}
              getOptionLabel={o => o.line_name || ''}
              value={lineInput}
              onChange={(_, v) => { setLineInput(v); setField('line_id', v?.line_id ?? null); setField('line_name', v?.line_name || ''); }}
              renderInput={params => <TextField {...params} placeholder={t.lineSearchPlaceholder} sx={inputSx} />}
              size="small"
              noOptionsText={t.noOptions}
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
            {t.scanQr} → {t.scanQrHint}
          </Box>
        </Box>

        {/* Row: CODE MAT | BATCH NO */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1.5 }}>
          <Box>
            <FieldLabel>{t.codeMat}</FieldLabel>
            <TextField
              value={form.code_mat}
              onChange={e => { if (e.target.value.length <= 12) setField('code_mat', e.target.value); }}
              fullWidth sx={inputSx}
              inputProps={{ maxLength: 12, style: { fontFamily: 'monospace', letterSpacing: '4px', fontWeight: 'bold' } }}
              placeholder="____________"
              helperText={t.codeMatHelper((form.code_mat || '').length)}
            />
          </Box>
          <Box>
            <FieldLabel>{t.batchNo}</FieldLabel>
            <TextField
              value={form.batch_no}
              onChange={e => {
                const v = e.target.value;
                if (v.length > 10) return;
                setForm(prev => ({ ...prev, batch_no: v, receive_date: decodeBatchDate(v) }));
              }}
              fullWidth sx={inputSx}
              inputProps={{ maxLength: 10, style: { fontFamily: 'monospace', letterSpacing: '4px', fontWeight: 'bold' } }}
              placeholder="__________"
              helperText={t.batchNoHelper((form.batch_no || '').length)}
            />
          </Box>
        </Box>

        {/* Row: Receive Date | Produce Date | BOX NO. | LOT */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1.5, mb: 1.5 }}>
          <Box>
            <FieldLabel>{t.receiveDate}</FieldLabel>
            <input type="date" value={form.receive_date} onChange={e => setField('receive_date', e.target.value)} style={dateInputStyle} />
          </Box>
          <Box>
            <FieldLabel>{t.produceDate}</FieldLabel>
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
                <span style={{ fontSize: '11px', color: '#999', marginLeft: '2px' }}>{t.hourSuffix}</span>
              </Box>
            </Box>
          </Box>
          <Box>
            <FieldLabel>{t.boxNo}</FieldLabel>
            <TextField
              value={form.box_no}
              onChange={e => { if (e.target.value.length <= 50) setField('box_no', e.target.value); }}
              fullWidth
              sx={inputSx}
              inputProps={{ maxLength: 50 }}
            />
          </Box>
          <Box>
            <FieldLabel>{t.lot}</FieldLabel>
            <TextField value={form.lot} onChange={e => setField('lot', e.target.value)} fullWidth sx={inputSx} />
          </Box>
        </Box>

        {/* Row: ROLL NO. | HU | SIZE | TE */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1.5, mb: 1.5 }}>
          <Box>
            <FieldLabel>{t.rollNo}</FieldLabel>
            <TextField
              value={form.roll_no}
              onChange={e => { if (e.target.value.length <= 50) setField('roll_no', e.target.value); }}
              fullWidth
              sx={inputSx}
              inputProps={{ maxLength: 50 }}
            />
          </Box>
          <Box>
            <FieldLabel>{t.hu}</FieldLabel>
            <TextField type="number" value={form.hu} onChange={e => setField('hu', e.target.value)} fullWidth sx={inputSx} />
          </Box>
          <Box>
            <FieldLabel>{t.size}</FieldLabel>
            <TextField value={form.size} onChange={e => { if (e.target.value.length <= 30) setField('size', e.target.value); }} fullWidth sx={inputSx} inputProps={{ maxLength: 30 }} />
          </Box>
          <Box>
            <FieldLabel>{t.te}</FieldLabel>
            <TextField value={form.te} onChange={e => { if (e.target.value.length <= 30) setField('te', e.target.value); }} fullWidth sx={inputSx} inputProps={{ maxLength: 30 }} />
          </Box>
        </Box>

        {/* Row: Qty | Remark | Code */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 1.5, mb: 2.5 }}>
          <Box>
            <FieldLabel>{t.qty}</FieldLabel>
            <TextField type="number" value={form.qty} onChange={e => setField('qty', e.target.value)} fullWidth sx={inputSx} />
          </Box>
          <Box>
            <FieldLabel>{t.remark}</FieldLabel>
            <TextField value={form.remark} onChange={e => { if (e.target.value.length <= 100) setField('remark', e.target.value); }}
              fullWidth sx={inputSx} inputProps={{ maxLength: 100 }} placeholder={t.remarkPlaceholder} />
          </Box>
          <Box>
            <FieldLabel required>{t.code}</FieldLabel>
            <TextField
              value={form.code}
              onChange={e => setField('code', e.target.value)}
              fullWidth
              sx={inputSx}
              error={!form.code?.trim()}
              placeholder={t.codePlaceholder}
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
            {t.clear}
          </Box>
          <Box onClick={() => !saving && handleSave(false)} sx={{
            px: 3, py: 1, borderRadius: '8px',
            backgroundColor: saving ? '#90CAF9' : '#1976D2',
            color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: 'bold',
            display: 'flex', alignItems: 'center', gap: 1,
            '&:hover': { backgroundColor: saving ? '#90CAF9' : '#1565C0' },
          }}>
            {saving && <CircularProgress size={14} color="inherit" />}
            {t.save}
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
            🖨️ {t.saveAndPrint}
          </Box>
        </Box>
      </Paper>

      {/* ─── Records Table ─── */}
      <Paper sx={{ borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', overflow: 'hidden' }}>

        {/* Header + Filter bar */}
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Box sx={{ fontWeight: 'bold', fontSize: '15px', color: '#1976D2' }}>
              {t.historyTitle(records.length)}
            </Box>
            <Box sx={{ fontSize: '11px', color: '#999' }}>{t.historyHint}</Box>
          </Box>

          {/* ─── Filter bar: Type dropdown + Search ─── */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>

            {/* Type Dropdown Filter */}
            <Box sx={{ minWidth: 200 }}>
              <Autocomplete
                options={TYPES}
                value={filterType}
                onChange={(_, v) => setFilterType(v)}
                renderInput={params => (
                  <TextField
                    {...params}
                    placeholder={t.filterByType}
                    size="small"
                    sx={{
                      ...inputSx,
                      '& .MuiInputBase-root': {
                        ...inputSx['& .MuiInputBase-root'],
                        backgroundColor: '#f8f9fa',
                      },
                    }}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <FilterList sx={{ fontSize: '18px', color: '#1976D2' }} />
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                size="small"
                noOptionsText={t.noOptions}
                autoHighlight
              />
            </Box>

            {/* Search Text Field */}
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <TextField
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder={t.searchPlaceholder}
                size="small"
                fullWidth
                sx={{
                  ...inputSx,
                  '& .MuiInputBase-root': {
                    ...inputSx['& .MuiInputBase-root'],
                    backgroundColor: '#f8f9fa',
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: '18px', color: '#1976D2' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchText ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchText('')}>
                        <Close sx={{ fontSize: '16px' }} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Box>

            {/* Result count badge */}
            {(filterType || searchText.trim()) && (
              <Chip
                label={t.showingCount(filteredRecords.length, records.length)}
                size="small"
                sx={{
                  fontSize: '11px', height: '24px',
                  backgroundColor: filteredRecords.length > 0 ? '#e8f5e9' : '#ffebee',
                  color: filteredRecords.length > 0 ? '#2E7D32' : '#c62828',
                  fontWeight: 'bold',
                }}
              />
            )}

            {/* Clear all filters */}
            {(filterType || searchText.trim()) && (
              <Box
                onClick={() => { setFilterType(null); setSearchText(''); }}
                sx={{
                  fontSize: '12px', color: '#c62828', cursor: 'pointer',
                  textDecoration: 'underline', whiteSpace: 'nowrap',
                  '&:hover': { color: '#b71c1c' },
                }}
              >
                {t.clearFilters}
              </Box>
            )}
          </Box>
        </Box>

        {/* Table */}
        <TableContainer sx={{ maxHeight: '420px' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {t.tableHeaders.map(h => (
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
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4, color: '#999', fontSize: '14px' }}>
                    {(filterType || searchText.trim())
                      ? t.noResultsFiltered
                      : t.noRecordsToday}
                  </TableCell>
                </TableRow>
              ) : filteredRecords.map((row, i) => (
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
                      🖨️ {t.printRow}
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