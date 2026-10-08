import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import axios from 'axios';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField } from '@mui/material';
import Close from '@mui/icons-material/Close';
import QrCodeScanner from '@mui/icons-material/QrCodeScanner';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import QrScanner from 'qr-scanner';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';
// forms that already exist as modals of the old Pack pages
import ModalEditLine from '../../../Pack/ManageRawmat/Asset/ModalEditLine';
import ModalDelete from '../../../Pack/ManageRawmat/Asset/ModalDelete';
import ModalInputRM from '../../../Pack/ManageDelay/Asset/ModalInputRM';
import CheckinEditModal from '../../../Pack/CheckIn/Asset/ModalEditPD';
import { toCheckinEditData } from './checkinData';

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

// ─────────────────────────────────────────────
// QR Scanner
// ─────────────────────────────────────────────
const QrScannerView = ({ onScan, onError }) => {
  const videoRef = useRef(null);
  useEffect(() => {
    if (!videoRef.current) return;
    const scanner = new QrScanner(videoRef.current, (result) => {
      const text = typeof result === 'object' ? result.data : result;
      if (text) onScan(text);
    }, {
      preferredCamera: 'environment',
      highlightScanRegion: true,
      returnDetailedScanResult: true,
      onDecodeError: () => {},
    });
    scanner.start().catch((err) => onError(err.message || 'ไม่สามารถเข้าถึงกล้องได้'));
    return () => { scanner.stop(); scanner.destroy(); };
  }, []);
  return <video ref={videoRef} style={{ width: '100%', display: 'block', borderRadius: '6px' }} muted playsInline />;
};

const QrScanDialog = ({ open, onClose, onScan, title }) => {
  const [error, setError] = useState('');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid #E3E8F2' }}>
        <Box sx={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: 1 }}>
          <QrCodeScanner sx={{ color: '#1552F0' }} />
          {title}
        </Box>
        <IconButton onClick={onClose} size="small"><Close fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ p: 2 }}>
        {open && <QrScannerView onScan={(text) => { onScan(text); onClose(); }} onError={setError} />}
        {error && <Box sx={{ mt: 1, color: '#c62828', fontSize: '12px' }}>❌ {error}</Box>}
      </Box>
    </Dialog>
  );
};

// ─────────────────────────────────────────────
// Action Cell Components

// WoBasketEntryRow — 1 แถวของ WONo + ช่วง Basket
// ─────────────────────────────────────────────
const EMPTY_WO_ENTRY = () => ({ wo_no: '', basket_from: '', basket_to: '' });

const WoBasketEntryRow = ({ entry, index, onChange, onRemove, onScanWo, canRemove }) => {
  const set = (field, val) => onChange(index, { ...entry, [field]: val });
  return (
    <Box sx={{
      display: 'flex', gap: 1, alignItems: 'flex-start', marginBottom: 1.5,
      padding: '10px', backgroundColor: '#F5F8FF', borderRadius: '10px', border: '1px solid #EAF0FF'
    }}>
      {/* Input 1: WONo */}
      <Box sx={{ flex: 2 }}>
        <Box sx={{ fontSize: '11px', color: '#666', marginBottom: 0.5 }}>WONo</Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <TextField
            fullWidth size="small" value={entry.wo_no}
            onChange={(e) => set('wo_no', e.target.value)}
            placeholder="พิมพ์ หรือ Scan WONo..."
            InputProps={{ sx: { height: '38px', fontSize: '13px', borderRadius: '8px', backgroundColor: '#fff' } }}
            sx={{ '& .MuiOutlinedInput-root': { height: '38px' }, '& input': { padding: '8px 10px' } }}
          />
          <IconButton
            onClick={() => onScanWo(index)}
            size="small"
            sx={{ border: '1.5px solid #1552F0', borderRadius: '8px', color: '#1552F0', width: '38px', height: '38px' }}
          >
            <QrCodeScanner fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Input 2: Basket จาก */}
      <Box sx={{ flex: 1 }}>
        <Box sx={{ fontSize: '11px', color: '#666', marginBottom: 0.5 }}>Basket (จาก)</Box>
        <TextField
          fullWidth size="small" type="number" value={entry.basket_from}
          onChange={(e) => set('basket_from', e.target.value)}
          placeholder="เช่น 3"
          InputProps={{ sx: { height: '38px', fontSize: '13px', borderRadius: '8px', backgroundColor: '#fff' } }}
          sx={{ '& .MuiOutlinedInput-root': { height: '38px' }, '& input': { padding: '8px 10px' } }}
        />
      </Box>

      {/* Input 3: Basket ถึง (ไม่บังคับ — ถ้าไม่กรอกถือว่ามี basket เดียว) */}
      <Box sx={{ flex: 1 }}>
        <Box sx={{ fontSize: '11px', color: '#666', marginBottom: 0.5 }}>Basket (ถึง)</Box>
        <TextField
          fullWidth size="small" type="number" value={entry.basket_to}
          onChange={(e) => set('basket_to', e.target.value)}
          placeholder="ไม่บังคับ"
          InputProps={{ sx: { height: '38px', fontSize: '13px', borderRadius: '8px', backgroundColor: '#fff' } }}
          sx={{ '& .MuiOutlinedInput-root': { height: '38px' }, '& input': { padding: '8px 10px' } }}
        />
      </Box>

      {/* ลบแถว */}
      <Box sx={{ paddingTop: '20px' }}>
        <IconButton
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          size="small"
          sx={{ color: canRemove ? '#f44336' : '#ccc' }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
};

// ─────────────────────────────────────────────
// MultiConfirmDialog
// ─────────────────────────────────────────────
const MultiConfirmDialog = ({
  open, onClose, selectedCount, onConfirm,
  group, setGroup, prepDateTime, setPrepDateTime,
  remark, setRemark,
  woEntries, setWoEntries,
  matPkg, setMatPkg,
  errors
}) => {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrField, setQrField] = useState(null); // { type: 'wo', index } หรือ { type: 'matPkg' }

  const handleQrScan = (text) => {
    if (qrField?.type === 'wo') {
      const updated = [...woEntries];
      updated[qrField.index] = { ...updated[qrField.index], wo_no: text.trim() };
      setWoEntries(updated);
    } else if (qrField?.type === 'matPkg') {
      setMatPkg(text.trim());
    }
    setQrOpen(false);
  };

  const openQrForWo = (index) => { setQrField({ type: 'wo', index }); setQrOpen(true); };
  const openQrForMatPkg = () => { setQrField({ type: 'matPkg' }); setQrOpen(true); };

  const handleEntryChange = (index, newEntry) => {
    const updated = [...woEntries];
    updated[index] = newEntry;
    setWoEntries(updated);
  };

  const handleAddEntry = () => setWoEntries([...woEntries, EMPTY_WO_ENTRY()]);
  const handleRemoveEntry = (index) => {
    if (woEntries.length <= 1) return;
    setWoEntries(woEntries.filter((_, i) => i !== index));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: '16px', boxShadow: '0 8px 32px rgba(33, 150, 243, 0.2)' }
      }}
    >
      <DialogTitle sx={{
        background: 'linear-gradient(135deg, #1552F0 0%, #1552F0 100%)',
        color: '#fff', fontSize: '18px', fontWeight: '600', padding: '20px 24px'
      }}>
        ยืนยันข้อมูลสำหรับ {selectedCount} รายการ
      </DialogTitle>

      <DialogContent sx={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* หม้อที่ */}
        <Box>
          <Box sx={{ marginBottom: 1, color: '#333', fontSize: '14px', fontWeight: '500' }}>
            หม้อที่ <span style={{ color: '#f44336' }}>*</span>
          </Box>
          <TextField
            fullWidth type="number" value={group}
            onChange={(e) => setGroup(e.target.value)}
            error={!!errors.group} helperText={errors.group}
            placeholder="กรุณาระบุหม้อที่"
            InputProps={{ sx: { height: '44px', fontSize: '14px', borderRadius: '8px' } }}
            sx={{ '& .MuiOutlinedInput-root': { height: '44px', fontSize: '14px' }, '& input': { padding: '10px 14px' } }}
          />
        </Box>

        {/* เวลาบรรจุเสร็จ */}
        <Box>
          <Box sx={{ marginBottom: 1, color: '#333', fontSize: '14px', fontWeight: '500' }}>
            เวลาบรรจุเสร็จ <span style={{ color: '#f44336' }}>*</span>
          </Box>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateTimePicker
              ampm={false} minutesStep={1} timeSteps={{ minutes: 1 }} maxDateTime={dayjs()}
              value={prepDateTime ? dayjs(prepDateTime) : null}
              onChange={(newValue) => setPrepDateTime(newValue ? newValue.format('YYYY-MM-DDTHH:mm') : '')}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.prepDateTime, helperText: errors.prepDateTime,
                  sx: {
                    '& .MuiOutlinedInput-root': { height: '44px', fontSize: '14px', borderRadius: '8px' },
                    '& input': { padding: '10px 14px' }
                  }
                }
              }}
            />
          </LocalizationProvider>
        </Box>

        {/* หมายเหตุ */}
        <Box>
          <Box sx={{ marginBottom: 1, color: '#333', fontSize: '14px', fontWeight: '500' }}>หมายเหตุ</Box>
          <TextField
            fullWidth multiline rows={3} value={remark}
            onChange={(e) => { if (e.target.value.length <= 300) setRemark(e.target.value); }}
            error={!!errors.remark} helperText={errors.remark || `${remark.length}/300`}
            placeholder="ระบุหมายเหตุ (ถ้ามี)..."
            InputProps={{ sx: { fontSize: '14px', borderRadius: '8px' } }}
            sx={{
              '& .MuiOutlinedInput-root': { fontSize: '14px' },
              '& .MuiFormHelperText-root': { textAlign: 'right', marginRight: 0, color: remark.length >= 300 ? '#f44336' : '#999' }
            }}
          />
        </Box>

        {/* รหัส Ingrediant (WONO) — รองรับหลายชุด แต่ละชุดมี WONo + ช่วง Basket */}
        <Box>
          <Box sx={{ marginBottom: 1, color: '#333', fontSize: '14px', fontWeight: '500' }}>
            รหัส Ingrediant (WONO)
          </Box>
          {woEntries.map((entry, index) => (
            <WoBasketEntryRow
              key={index}
              entry={entry}
              index={index}
              onChange={handleEntryChange}
              onRemove={handleRemoveEntry}
              onScanWo={openQrForWo}
              canRemove={woEntries.length > 1}
            />
          ))}
          <Button
            onClick={handleAddEntry}
            startIcon={<AddCircleOutlineIcon />}
            sx={{ color: '#1552F0', textTransform: 'none', fontSize: '13px' }}
          >
            เพิ่มชุด WONo
          </Button>
          {errors.woEntries && (
            <Box sx={{ color: '#f44336', fontSize: '12px', marginTop: 0.5 }}>{errors.woEntries}</Box>
          )}
        </Box>

        {/* รหัส Package */}
        <Box>
          <Box sx={{ marginBottom: 1, color: '#333', fontSize: '14px', fontWeight: '500' }}>รหัส Package</Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth value={matPkg} onChange={(e) => setMatPkg(e.target.value)}
              placeholder="พิมพ์ หรือ Scan รหัส Package..."
              InputProps={{ sx: { height: '44px', fontSize: '14px', borderRadius: '8px' } }}
              sx={{ '& .MuiOutlinedInput-root': { height: '44px', fontSize: '14px' }, '& input': { padding: '10px 14px' } }}
            />
            <IconButton
              onClick={openQrForMatPkg}
              sx={{ border: '1.5px solid #1552F0', borderRadius: '8px', color: '#1552F0', width: '44px', height: '44px', '&:hover': { backgroundColor: '#EAF0FF' } }}
            >
              <QrCodeScanner />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ padding: '16px', backgroundColor: '#EAF0FF', borderRadius: '8px', fontSize: '13px', color: '#1552F0' }}>
          <strong>หมายเหตุ:</strong> น้ำหนักของแต่ละรายการจะถูกใช้ตามที่ระบุในแต่ละแถว
        </Box>
      </DialogContent>

      <DialogActions sx={{ padding: '16px 24px', gap: 1 }}>
        <Button
          onClick={onClose}
          sx={{ color: '#666', borderRadius: '8px', padding: '8px 20px', textTransform: 'none', fontSize: '14px', '&:hover': { backgroundColor: '#F5F8FF' } }}
        >
          ยกเลิก
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{
            background: 'linear-gradient(135deg, #1552F0 0%, #1552F0 100%)',
            borderRadius: '8px', padding: '8px 24px', textTransform: 'none', fontSize: '14px',
            boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)',
            '&:hover': { background: 'linear-gradient(135deg, #1552F0 0%, #0F3FC4 100%)', boxShadow: '0 6px 16px rgba(33, 150, 243, 0.4)' }
          }}
        >
          ยืนยันทั้งหมด
        </Button>
      </DialogActions>

      <QrScanDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onScan={handleQrScan}
        title={qrField?.type === 'wo' ? `Scan WONo (ชุดที่ ${(qrField.index ?? 0) + 1})` : 'Scan รหัส Package'}
      />
    </Dialog>
  );
};

// ─────────────────────────────────────────────
// TableMainPrep (Main)

/**
 * Pack tools that used to live in other pages: confirm packed (many rows at once with their weights), edit the production line,
 * confirm one row, add RM (managedelaymaster) and trolley check-in. Called from the sheet through a ref.
 */
const PackMoreFlows = forwardRef(({ onDone, onNotify }, ref) => {
  const [multi, setMulti] = useState(null); // { rows, weights }
  const [group, setGroup] = useState('');
  const [prepDateTime, setPrepDateTime] = useState('');
  const [remark, setRemark] = useState('');
  const [woEntries, setWoEntries] = useState([EMPTY_WO_ENTRY()]);
  const [matPkg, setMatPkg] = useState('');
  const [errors, setErrors] = useState({ group: '', prepDateTime: '', remark: '', woEntries: '' });
  const [editLine, setEditLine] = useState(null);
  const [confirmOne, setConfirmOne] = useState(null);
  const [addRm, setAddRm] = useState(false);
  const [checkin, setCheckin] = useState(null);
  const busy = useRef(false);

  const reset = () => {
    setGroup(''); setPrepDateTime(''); setRemark(''); setWoEntries([EMPTY_WO_ENTRY()]); setMatPkg('');
    setErrors({ group: '', prepDateTime: '', remark: '', woEntries: '' });
  };

  const validate = () => {
    const e = { group: '', prepDateTime: '', remark: '', woEntries: '' };
    let ok = true;
    if (Number.isNaN(Number(group)) || Number(group) <= 0) { e.group = 'ต้องมีค่ามากกว่า 0'; ok = false; }
    if (!prepDateTime) { e.prepDateTime = 'กรุณาระบุเวลา'; ok = false; } else if (new Date(prepDateTime) > new Date()) { e.prepDateTime = 'เวลาต้องไม่เป็นอนาคต'; ok = false; }
    if (remark && remark.length > 300) { e.remark = 'หมายเหตุต้องไม่เกิน 300 ตัวอักษร'; ok = false; }
    const filled = woEntries.filter((x) => x.wo_no || x.basket_from || x.basket_to);
    for (const x of filled) {
      if (!x.wo_no || x.basket_from === '' || x.basket_from == null) { e.woEntries = 'กรุณากรอก WONo และ Basket (จาก) ให้ครบทุกชุดที่เพิ่มไว้'; ok = false; break; }
      if (x.basket_to !== '' && x.basket_to != null && Number(x.basket_to) < Number(x.basket_from)) { e.woEntries = 'Basket (ถึง) ต้องมีค่ามากกว่าหรือเท่ากับ Basket (จาก)'; ok = false; break; }
    }
    setErrors(e);
    return ok;
  };

  const submitMulti = async () => {
    if (busy.current || !validate()) return;
    busy.current = true;
    const entries = woEntries
      .filter((x) => x.wo_no && x.basket_from !== '' && x.basket_from != null)
      .map((x) => ({ wo_no: x.wo_no.trim(), basket_from: parseInt(x.basket_from, 10), basket_to: x.basket_to !== '' && x.basket_to != null ? parseInt(x.basket_to, 10) : null }));
    try {
      await Promise.all(multi.rows.map(async (row) => {
        const res = await axios.post(`${API_URL}/api/pack/mixed/delay-time/test`, {
          mapping_id: row.mapping_id,
          weight: Number(multi.weights[row.mapping_id]),
          group: Number(group),
          sc_pack_date: prepDateTime,
          remark_dalay: remark?.trim() || null,
          mat_pkg: matPkg?.trim() || null,
        }, { timeout: 15000 });
        if (!res.data?.success) throw new Error(res.data?.message || 'Confirm failed');
        if (entries.length) await axios.post(`${API_URL}/api/pack/ingredient/wo-mapping`, { mapping_id: row.mapping_id, entries });
      }));
      onNotify?.(`ยืนยันข้อมูลสำเร็จ ${multi.rows.length} รายการ`);
      setMulti(null);
      reset();
      onDone?.();
    } catch (err) {
      console.error('[PackMoreFlows] confirm error:', err);
      onNotify?.(`ยืนยันข้อมูลไม่สำเร็จ: ${err.response?.data?.message || err.message}`);
      onDone?.(); // some rows may have been saved
    } finally { busy.current = false; }
  };

  useImperativeHandle(ref, () => ({
    confirmRows: (rows, weights) => setMulti({ rows, weights }),
    edit: (row) => setEditLine({ ...row, mat: row.mat_id || row.mat, batch: row.batch_after || row.batch, production: row.code, line_name: row.rmm_line_name || row.line_name }),
    confirmOne: (row) => setConfirmOne({ ...row, production: row.code, weight_RM: row.weight_in_trolley || row.weight_RM }),
    addRM: () => setAddRm(true),
    checkin: (row, allRows) => setCheckin(toCheckinEditData(row, allRows)),
  }));

  const close = useCallback(() => { setMulti(null); }, []);

  return (
    <>
      <MultiConfirmDialog
        open={!!multi} onClose={close} selectedCount={multi?.rows.length || 0} onConfirm={submitMulti}
        group={group} setGroup={setGroup} prepDateTime={prepDateTime} setPrepDateTime={setPrepDateTime} remark={remark} setRemark={setRemark}
        woEntries={woEntries} setWoEntries={setWoEntries} matPkg={matPkg} setMatPkg={setMatPkg} errors={errors}
      />
      {editLine && <ModalEditLine open data={editLine} onClose={() => setEditLine(null)} onSuccess={() => { setEditLine(null); onDone?.(); }} />}
      {confirmOne && <ModalDelete open data={confirmOne} onClose={() => setConfirmOne(null)} onSuccess={() => { onDone?.(); }} />}
      {addRm && <ModalInputRM open data={{}} onClose={() => setAddRm(false)} onSuccess={() => { onDone?.(); }} />}
      {checkin && <CheckinEditModal open data={checkin} onClose={() => setCheckin(null)} onNext={() => setCheckin(null)} onSuccess={() => { setCheckin(null); onDone?.(); }} />}
    </>
  );
});
PackMoreFlows.displayName = 'PackMoreFlows';

export default PackMoreFlows;
