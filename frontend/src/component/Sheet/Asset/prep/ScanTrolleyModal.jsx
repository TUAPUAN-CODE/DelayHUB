// เลือกรถเข็นด้วยการสแกนเท่านั้น (พิมพ์เองไม่ได้): กล้อง (สลับกล้องหน้า/หลังได้) หรือเครื่องสแกน USB — แบบเดียวกับ modal เลือกรถเข็นของหน้าใส่รถเข็นปกติ
// ใช้กับ "ใส่รถเข็น (รอแก้ไข)" และ "กลับมาเตรียม": onConfirm(tro_id) ถูกเรียกหลังตรวจว่ารถเข็นพร้อมใช้และจองรถเข็นแล้ว
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Divider, IconButton, Modal, TextField, Typography } from "@mui/material";
import CameraswitchIcon from "@mui/icons-material/Cameraswitch";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import useQrCamera from "../../../../hooks/useQrCamera";
import { canTypeTrolley } from "../../../../utils/userPerms";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

// batches = [{ before, after, required }]: Batch ตั้งต้น + Batch แปลงเดิมของรายการนี้ — ส่งมาเมื่อต้องกรอก Batch แปลงใหม่ด้วย (เหมือนฟอร์ม "ใส่รถเข็น" ของแผนผลิต: ค่าเดิมใส่ไว้ให้แก้;
// required = บังคับครบ 10 ตัวอักษร (วัตถุดิบประเภท 3, 6, 7, 8) ไม่บังคับ = เว้นว่างได้ ใช้ค่าเดิม)
// onConfirm(tro_id, batchAfterArray) — batchAfterArray = [{ batch_before, batch_after }] (undefined เมื่อไม่มี batches)
const BATCH_LEN = 10;
const NO_BATCHES = [];
const batchOk = (b, v) => { const n = String(v ?? "").trim().length; return b.required ? n === BATCH_LEN : n <= BATCH_LEN; };

const ScanTrolleyModal = ({ open, onClose, onConfirm, batches = NO_BATCHES }) => {
  const manual = canTypeTrolley();
  const [batchInputs, setBatchInputs] = useState([]);
  const videoRef = useRef(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // ตัวอักษรจากเครื่องสแกน USB: พิมพ์ติดกันเร็วๆ แล้วปิดด้วย Enter (ช่องเป็น readOnly จึงพิมพ์ด้วยมือไม่ได้)
  const bufferRef = useRef("");
  const lastKeyRef = useRef(0);
  const lastDecodeRef = useRef({ value: "", at: 0 });

  const checkTrolley = useCallback(async (tro) => {
    try {
      const res = await axios.get(`${API_URL}/api/checkTrolley`, { params: { tro } });
      if (res.data.success === false) { setError(res.data.message || "ไม่มีรถเข็นคันนี้ในระบบ"); return false; }
      if (["รถเข็นไม่พร้อมใช้งาน", "รถเข็นถูกจองใช้งาน"].includes(res.data.message)) { setError(res.data.message); return false; }
      return true;
    } catch (err) {
      console.error("[ScanTrolleyModal] check trolley error:", err);
      setError("ไม่มีรถเข็นคันนี้ในระบบ");
      return false;
    }
  }, []);

  const handleDecode = useCallback((raw) => {
    const digits = String(raw ?? "").replace(/\D/g, "").slice(-4);
    if (!digits) { setError("QR Code / Barcode นี้ไม่มีเลขรถเข็น"); return; }
    const now = Date.now();
    if (lastDecodeRef.current.value === digits && now - lastDecodeRef.current.at < 1500) return; // กล้องอ่านซ้ำคันเดิมติดกัน
    lastDecodeRef.current = { value: digits, at: now };
    setError("");
    setValue(digits.padStart(4, "0"));
    void checkTrolley(digits.padStart(4, "0"));
  }, [checkTrolley]);

  const { start: startCamera, stop: stopCamera, switchCamera, facing, cameraError } = useQrCamera(videoRef, handleDecode);

  useEffect(() => {
    if (!open) return undefined;
    setValue(""); setError(""); setBusy(false);
    bufferRef.current = ""; lastKeyRef.current = 0; lastDecodeRef.current = { value: "", at: 0 };
    void startCamera();
    return stopCamera;
  }, [open, startCamera, stopCamera]);

  // Batch แปลงใหม่: เริ่มจากค่าเดิมของรายการ (แก้ได้) — แยกจาก effect ของกล้อง เพื่อไม่ให้กล้อง/เลขรถเข็นถูกรีเซ็ตเมื่อ batches เปลี่ยน
  useEffect(() => {
    if (open) setBatchInputs(batches.map((b) => String(b.after || b.before || "").toUpperCase()));
  }, [open, batches]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (manual && e.target?.tagName === "INPUT") return; // กำลังพิมพ์ในช่อง: Enter ของช่องยืนยันเอง
      const now = Date.now();
      if (e.key === "Enter") {
        const v = bufferRef.current;
        bufferRef.current = "";
        if (v) handleDecode(v);
        return;
      }
      if (e.key.length !== 1) return;
      if (now - lastKeyRef.current > 100) bufferRef.current = ""; // ช้าเกินไป = ไม่ใช่เครื่องสแกน
      lastKeyRef.current = now;
      bufferRef.current += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleDecode, manual]);

  const close = () => { stopCamera(); onClose(); };

  const handleTyped = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
    setValue(digits);
    setError("");
  };

  const confirm = async () => {
    if (!value || busy) return;
    const tro = manual ? value.padStart(4, "0") : value;
    if (batches.some((b, i) => !batchOk(b, batchInputs[i]))) { setError("กรุณากรอก Batch แปลงให้ครบ 10 ตัวอักษร"); return; }
    setBusy(true); setError("");
    try {
      if (!(await checkTrolley(tro))) return;
      try {
        const res = await axios.post(`${API_URL}/api/reserveTrolley`, { tro_id: tro });
        if (!res.data.success) { setError("รถเข็นถูกจองแล้ว"); return; }
      } catch (err) {
        console.error("[ScanTrolleyModal] reserve error:", err);
        setError("รถเข็นถูกจองแล้ว");
        return;
      }
      onConfirm(tro, batches.length ? batches.map((b, i) => ({ batch_before: b.before, batch_after: batchInputs[i].trim().toUpperCase() || b.after || b.before })) : undefined);
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={(e, reason) => { if (reason !== "backdropClick") close(); }} sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Box sx={{ position: "relative", bgcolor: "background.paper", p: 2, borderRadius: 2, maxWidth: 420, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: 5 }}>
        <IconButton aria-label="close" onClick={close} sx={{ position: "absolute", top: 8, right: 8 }}><CloseIcon /></IconButton>
        <Typography sx={{ fontSize: 18, fontWeight: 500, color: "#545454", mb: 1.5, pr: 4 }}>กรุณาสแกนป้ายทะเบียนรถเข็น</Typography>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {cameraError && <Alert severity="warning" sx={{ mb: 1.5 }}>{cameraError}</Alert>}
        <Divider sx={{ mb: 1.5 }} />
        <video ref={videoRef} style={{ width: "100%", borderRadius: 4, marginBottom: 8 }} autoPlay muted playsInline />
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="outlined" size="small" startIcon={<CameraswitchIcon />} onClick={switchCamera}>
            {facing === "environment" ? "กล้องหลัง · สลับเป็นกล้องหน้า" : "กล้องหน้า · สลับเป็นกล้องหลัง"}
          </Button>
        </Box>
        <TextField
          fullWidth margin="normal" size="small" label={manual ? "เลขทะเบียนรถเข็น (สแกน หรือคีย์เลข 4 หลัก)" : "เลขทะเบียนรถเข็น (สแกน QR Code หรือ Barcode Scanner)"} value={value}
          placeholder={manual ? "สแกน หรือพิมพ์เลขรถเข็น เช่น 0500" : "กรุณาสแกน QR Code หรือ Barcode Scanner"}
          onChange={manual ? handleTyped : undefined} onKeyDown={manual ? (e) => { if (e.key === "Enter") void confirm(); } : undefined} inputProps={{ inputMode: "numeric", maxLength: 4 }}
          InputProps={{ readOnly: !manual }} sx={{ "& .MuiInputBase-input": { cursor: manual ? "text" : "default" } }}
        />
        {batches.map((b, i) => (
          <Box key={`${b.before}-${i}`} sx={{ mt: 1 }}>
            <Typography sx={{ fontSize: 13, color: "#6B7489" }}>{`Batch ตั้งต้น: ${b.before || "-"} · Batch แปลงเดิม: ${b.after || "-"}`}</Typography>
            <TextField
              fullWidth margin="dense" size="small" value={batchInputs[i] ?? ""}
              label={batches.length > 1 ? `Batch แปลง ${i + 1} (10 ตัวอักษร)` : "Batch แปลง (10 ตัวอักษร)"}
              onChange={(e) => { const v = e.target.value.toUpperCase().slice(0, BATCH_LEN); setError(""); setBatchInputs((prev) => prev.map((x, j) => (j === i ? v : x))); }}
              error={!batchOk(b, batchInputs[i])}
              inputProps={{ maxLength: BATCH_LEN }}
            />
          </Box>
        ))}
        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: "flex", justifyContent: "space-between", pt: 1 }}>
          <Button variant="contained" startIcon={<CancelIcon />} onClick={close} sx={{ bgcolor: "#E5484D", "&:hover": { bgcolor: "#c73c41" } }}>ยกเลิก</Button>
          <Button variant="contained" startIcon={<CheckCircleIcon />} onClick={confirm} disabled={!value || busy || batches.some((b, i) => !batchOk(b, batchInputs[i]))} sx={{ bgcolor: "#1552F0" }}>ยืนยัน</Button>
        </Box>
      </Box>
    </Modal>
  );
};

export default ScanTrolleyModal;
