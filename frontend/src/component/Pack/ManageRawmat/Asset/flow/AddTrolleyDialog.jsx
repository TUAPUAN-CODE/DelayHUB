import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogActions, Typography, TextField, Button, Alert, CircularProgress } from "@mui/material";
import axios from "axios";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

// เพิ่มรถเข็นเข้าไลน์ (พิมพ์หรือสแกนด้วย USB scanner) — รวมขั้นตอน ตรวจสอบ → จอง → เพิ่ม ไว้ในที่เดียว
const AddTrolleyDialog = ({ open, onClose, onAdded }) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const releaseTrolley = async (troId) => {
    try {
      await axios.post(`${API_URL}/api/re/reserveTrolley`, { tro_id: troId });
    } catch (err) {
      console.error("[AddTrolleyDialog] release error:", err);
    }
  };

  const handleAdd = async () => {
    const troId = value.trim();
    if (!troId) {
      setError("กรุณากรอกหรือสแกนป้ายทะเบียนรถเข็น");
      return;
    }
    const lineId = localStorage.getItem("line_id");
    if (!lineId) {
      setError("ไม่พบไลน์ที่เลือก กรุณาเลือกสถานที่ทำงานใหม่");
      return;
    }

    setBusy(true);
    setError("");
    let reserved = false;
    try {
      const check = await axios.get(`${API_URL}/api/checkTrolley`, { params: { tro: troId } });
      const message = check.data?.message;
      if (check.data?.success === false) {
        setError(message || "ไม่มีรถเข็นคันนี้ในระบบ");
        return;
      }
      if (message !== "รถเข็นพร้อมใช้งาน") {
        setError(message && message.trim() ? message : "รถเข็นไม่พร้อมใช้งาน");
        return;
      }

      const reserve = await axios.post(`${API_URL}/api/reserveTrolley`, { tro_id: troId });
      if (!reserve.data?.success) {
        setError("รถเข็นถูกจองแล้ว");
        return;
      }
      reserved = true;

      const add = await axios.post(`${API_URL}/api/pack/Add/Trolley`, { tro_id: troId, line_id: lineId });
      if (!add.data?.success) {
        throw new Error(add.data?.message || "เพิ่มรถเข็นไม่สำเร็จ");
      }
      reserved = false;
      onAdded?.(troId);
      onClose();
    } catch (err) {
      console.error("[AddTrolleyDialog] error:", err);
      setError(err.response?.data?.message || err.message || "เกิดข้อผิดพลาดในการเพิ่มรถเข็น");
    } finally {
      if (reserved) await releaseTrolley(troId);
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogContent>
        <Typography variant="h6" sx={{ fontSize: 18, mb: 1.5 }}>เพิ่มรถเข็น</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          พิมพ์หรือสแกนป้ายทะเบียนรถเข็น แล้วกด Enter
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          inputRef={inputRef}
          fullWidth
          label="ป้ายทะเบียนรถเข็น"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          disabled={busy}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>ยกเลิก</Button>
        <Button variant="contained" onClick={handleAdd} disabled={busy} startIcon={busy ? <CircularProgress size={16} /> : null}>
          เพิ่มรถเข็น
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddTrolleyDialog;
