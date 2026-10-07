import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogContent, DialogTitle, IconButton, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import QrScanner from "qr-scanner";
import { STAMP_LABEL } from "./sapApi";
import LogList from "./LogList";

const HINT = {
  start: "สแกนป้าย Tag ของวัตถุดิบที่นำออกมาละลาย ระบบจะบันทึกเวลาเริ่มละลาย",
  end: "สแกนป้าย Tag ของวัตถุดิบที่ละลายเสร็จแล้ว ระบบจะบันทึกเวลาละลายเสร็จ",
  dispatch: "สแกนป้าย Tag ของวัตถุดิบที่จ่ายลงไลน์ ระบบจะบันทึกเวลาจ่ายลงไลน์",
};

/** Scan tags one after another (USB scanner types the tag + Enter; camera optional). onScan(kind, tagText) -> Promise<{ok,message}> */
const ScanStampDialog = ({ open, kind, onClose, onScan, log }) => {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const [camera, setCamera] = useState(false);
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const lastAt = useRef(0);

  const submit = useCallback(async (raw) => {
    const value = String(raw || "").trim();
    if (!value || busy) return;
    const now = Date.now();
    if (now - lastAt.current < 1000) return;
    lastAt.current = now;
    setBusy(true);
    try {
      setLast(await onScan(kind, value));
    } finally {
      setBusy(false);
      setText("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [busy, kind, onScan]);

  useEffect(() => {
    if (open) { setText(""); setLast(null); setCamera(false); setTimeout(() => inputRef.current?.focus(), 200); }
  }, [open, kind]);

  useEffect(() => {
    if (!open || !camera || !videoRef.current) return undefined;
    const scanner = new QrScanner(videoRef.current, (r) => submit(r.data), { highlightScanRegion: true, highlightCodeOutline: true });
    scannerRef.current = scanner;
    scanner.start().catch((err) => {
      console.error("[ScanStampDialog] camera error:", err);
      setLast({ ok: false, message: "เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง หรือใช้เครื่องสแกน/พิมพ์แทน" });
      setCamera(false);
    });
    return () => { scanner.stop(); scanner.destroy(); scannerRef.current = null; };
  }, [open, camera, submit]);

  if (!kind) return null;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Chip label={STAMP_LABEL[kind]} color="primary" />
        <span style={{ flex: 1, fontSize: 16 }}>สแกนป้าย Tag</span>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{HINT[kind]}</Typography>
        <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
          <TextField
            inputRef={inputRef} fullWidth size="small" value={text} disabled={busy}
            placeholder="สแกนด้วยเครื่องสแกน หรือพิมพ์ รหัสวัตถุดิบ|Batch|HU|น้ำหนัก แล้วกด Enter"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(text); } }}
          />
          <Button variant={camera ? "contained" : "outlined"} startIcon={<QrCodeScannerIcon />} onClick={() => setCamera((v) => !v)} sx={{ whiteSpace: "nowrap" }}>
            กล้อง
          </Button>
        </Box>
        {camera && <video ref={videoRef} style={{ width: "100%", maxHeight: 260, borderRadius: 8, background: "#000", marginBottom: 12 }} />}
        {last && (
          <Alert severity={last.ok ? "success" : "error"} sx={{ mb: 1.5, fontSize: 15 }}>
            {last.message}
          </Alert>
        )}
        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>รายการที่สแกนล่าสุด</Typography>
        <LogList log={log} filterKind={kind} max={12} />
      </DialogContent>
    </Dialog>
  );
};

export default ScanStampDialog;
