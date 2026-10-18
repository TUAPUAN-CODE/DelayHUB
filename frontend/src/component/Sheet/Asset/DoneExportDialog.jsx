import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField, Typography } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import GridOnIcon from "@mui/icons-material/GridOn";
import { buildDelayReportPdf } from "../../Pack/ReportRawmatNotEditTIME/Asset/delayReportPdf";
import { exportDelayReportExcel } from "../../Pack/ReportRawmatNotEditTIME/Asset/delayReportExcel";

const API_URL = import.meta.env.VITE_API_URL;
const p2 = (n) => String(n).padStart(2, "0");
const toMs = (v) => { const d = new Date(String(v || "").replace(" ", "T")); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); };
const userName = () => [localStorage.getItem("first_name"), localStorage.getItem("last_name")].filter((v) => v && v !== "null").join(" ");

/** แถวของตาราง Done → แถวของรายงาน F3PFPF67 (ชื่อฟิลด์เดียวกับหน้า Report) */
const toReportRow = (r) => ({
  ...r,
  production: r.doc_no ?? r.production ?? "",
  detail: r.qc_detail ?? r.detail ?? "",
  color: r.qc_color ?? "",
  odor: r.qc_odor ?? "",
  texture: r.qc_texture ?? "",
});

/**
 * ออกรายงาน Delay จากหน้าดำเนินการเสร็จสิ้น: PDF (แบบเดียวกับหน้า Report, บันทึกเข้า "ประวัติ Report" ได้) หรือ Excel ตามแบบฟอร์ม F3PFPV04
 * rows = แถวที่ดึงมาในตาราง Done
 */
const DoneExportDialog = ({ open, kind, rows, onClose }) => {
  const lines = useMemo(() => [...new Set((rows || []).map((r) => r.rmm_line_name).filter(Boolean))].sort(), [rows]);
  const [f, setF] = useState({});
  const [saveHistory, setSaveHistory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    if (!open) return;
    const d = new Date();
    setF({ date: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`, shift: "", line: "", plant: "", recordedBy: userName(), reviewedBy: "", qcManager: "" });
    setMsg({ type: "", text: "" });
    setBusy(false);
  }, [open]);

  const chosen = useMemo(() => (rows || [])
    .filter((r) => !f.line || r.rmm_line_name === f.line)
    .map(toReportRow)
    .sort((a, b) => toMs(a.sc_pack_date) - toMs(b.sc_pack_date)), [rows, f.line]);

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  const thaiDate = (ymd) => { if (!ymd) return ""; const [y, m, d] = ymd.split("-"); return `${d}/${m}/${Number(y) + 543}`; };

  const run = async () => {
    if (!chosen.length) { setMsg({ type: "error", text: "ไม่มีแถวที่จะออกรายงาน" }); return; }
    const meta = { exportDate: thaiDate(f.date), exportShift: f.shift, exportLine: f.line || lines.join(", "), exportPlant: f.plant };
    const sig = { recordedBy: f.recordedBy, reviewedBy: f.reviewedBy, qcManager: f.qcManager };
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      if (kind === "excel") {
        await exportDelayReportExcel(chosen, { ...meta, ...sig });
        setMsg({ type: "success", text: `ส่งออก Excel ${chosen.length} แถว` });
      } else {
        const doc = buildDelayReportPdf(chosen, sig, meta);
        doc.save(`F3PFPF67_${f.date || new Date().toISOString().slice(0, 10)}.pdf`);
        if (saveHistory) {
          const fd = new FormData();
          fd.append("pdf", doc.output("blob"), "report.pdf");
          fd.append("recorded_by", sig.recordedBy || "");
          fd.append("reviewed_by", sig.reviewedBy || "");
          fd.append("qc_manager", sig.qcManager || "");
          fd.append("date", meta.exportDate || "");
          fd.append("shift", meta.exportShift || "");
          fd.append("line", meta.exportLine || "");
          fd.append("plant", meta.exportPlant || "");
          fd.append("mapping_ids", JSON.stringify(chosen.map((r) => r.mapping_id).filter((v) => v !== null && v !== undefined)));
          await axios.post(`${API_URL}/api/pack/data/pdf`, fd);
        }
        setMsg({ type: "success", text: `ส่งออก PDF ${chosen.length} แถว${saveHistory ? " และบันทึกเข้าประวัติ Report แล้ว" : ""}` });
      }
    } catch (err) {
      console.error("[Sheet] Done export error:", err);
      setMsg({ type: "error", text: err.response?.data?.error || err.message || "ส่งออกไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>{kind === "excel" ? "Export รายงาน Delay (Excel F3PFPV04)" : "Export รายงาน Delay (PDF F3PFPF67)"}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          <TextField size="small" type="date" label="Date" value={f.date || ""} onChange={set("date")} InputLabelProps={{ shrink: true }} />
          <TextField size="small" select label="Shift" value={f.shift || ""} onChange={set("shift")}>
            {["", "A", "B", "C", "เช้า", "ดึก"].map((s) => <MenuItem key={s} value={s}>{s || "-"}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="Line (กรองแถวตามไลน์)" value={f.line || ""} onChange={set("line")}>
            <MenuItem value="">ทุกไลน์</MenuItem>
            {lines.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Plant" value={f.plant || ""} onChange={set("plant")} />
          <TextField size="small" label="Recorded by" value={f.recordedBy || ""} onChange={set("recordedBy")} />
          <TextField size="small" label="Reviewed by" value={f.reviewedBy || ""} onChange={set("reviewedBy")} />
          <TextField size="small" label="QC Section manager" value={f.qcManager || ""} onChange={set("qcManager")} />
        </Box>
        {kind !== "excel" && (
          <FormControlLabel control={<Checkbox checked={saveHistory} onChange={(e) => setSaveHistory(e.target.checked)} />} label="บันทึก PDF เข้า ประวัติ Report" />
        )}
        <Typography variant="body2" color="text.secondary">
          จะออกรายงาน {chosen.length} แถว (แถวที่ดึงมาในตาราง Done{f.line ? ` ไลน์ ${f.line}` : ""} เรียงตามเวลาบรรจุเสร็จ){kind === "excel" ? " · 17 แถวต่อหน้า เกินแล้วขึ้นชีตใหม่" : ""}
        </Typography>
        {msg.text && <Alert severity={msg.type || "info"}>{msg.text}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>ปิด</Button>
        <Button variant="contained" onClick={run} disabled={busy} startIcon={kind === "excel" ? <GridOnIcon /> : <PictureAsPdfIcon />}>
          {busy ? "กำลังสร้างไฟล์..." : kind === "excel" ? "ดาวน์โหลด Excel" : "ดาวน์โหลด PDF"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DoneExportDialog;
