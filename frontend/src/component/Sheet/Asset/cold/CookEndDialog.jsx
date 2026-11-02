import { useMemo, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from "@mui/material";

const API_URL = import.meta.env.VITE_API_URL;
const pad = (n) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => i + 1); // 1-24 (24-hour clock, no AM / PM) — 24 = midnight at the end of the chosen day
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const errText = (err) => err.response?.data?.message || err.response?.data?.error || err.message || "บันทึกไม่สำเร็จ";

const dayText = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** the value sent to the server: "yyyy-MM-dd HH:mm" · hour 24 = 00:00 of the next day */
const toServer = (day, hour, minute) => {
  const [y, m, d] = day.split("-").map(Number);
  const at = new Date(y, m - 1, d, hour === 24 ? 24 : hour, minute);
  return `${dayText(at)} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

/**
 * "จบ Cooking" of a material of a multi-stage flow (Tuna scrap, CK bone): the time the pressure cooking ended.
 * The day is picked, the hour is 1-24 (24-hour clock, no AM / PM) and the minute 0-59, or the button "ตอนนี้" fills the present time.
 * PATCH /api/sheet/cook-end (History.cook_end_date, written to SheetEditLog); a tap outside does not close it.
 */
const CookEndDialog = ({ row, onClose, onSaved }) => {
  const initial = useMemo(() => {
    const cur = row.cook_end_date ? new Date(String(row.cook_end_date).replace(" ", "T")) : null;
    const base = cur && !Number.isNaN(cur.getTime()) ? cur : new Date();
    return { day: dayText(base), hour: base.getHours() === 0 ? 24 : base.getHours(), minute: base.getMinutes() };
  }, [row.cook_end_date]);
  const [day, setDay] = useState(initial.day);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fillNow = () => {
    const n = new Date();
    setDay(dayText(n));
    setHour(n.getHours() === 0 ? 24 : n.getHours());
    setMinute(n.getMinutes());
  };

  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { setError("กรุณาเลือกวันที่"); return; }
    const value = toServer(day, hour, minute);
    if (new Date(value.replace(" ", "T")).getTime() > Date.now() + 5 * 60000) { setError("เวลาจบ Cooking ต้องไม่เป็นเวลาในอนาคต"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await axios.patch(`${API_URL}/api/sheet/cook-end`, {
        mapping_id: row.mapping_id, changes: { cook_end_date: value }, expected: { cook_end_date: row.cook_end_date ?? null },
      });
      if (!res.data?.success) throw new Error(res.data?.error || "บันทึกไม่สำเร็จ");
      onSaved(`บันทึกเวลาจบ Cooking ${value} แล้ว`);
    } catch (err) {
      console.error("[CookEndDialog] save:", err);
      setError(errText(err));
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={(e, reason) => { if (!saving && reason !== "backdropClick") onClose(); }} disableEscapeKeyDown fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>บันทึกเวลาจบ Cooking</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: 13, color: "#6B7489", mb: 1.5 }}>
          {row.mat_name || row.mat} · รายการ {row.mapping_id}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField size="small" type="date" label="วันที่" value={day} disabled={saving} onChange={(e) => setDay(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }} />
          <TextField select size="small" label="ชั่วโมง (1-24)" value={hour} disabled={saving} onChange={(e) => setHour(Number(e.target.value))} sx={{ width: 130 }}>
            {HOURS.map((h) => <MenuItem key={h} value={h}>{pad(h)}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="นาที" value={minute} disabled={saving} onChange={(e) => setMinute(Number(e.target.value))} sx={{ width: 100 }}>
            {MINUTES.map((m) => <MenuItem key={m} value={m}>{pad(m)}</MenuItem>)}
          </TextField>
          <Button size="small" variant="outlined" onClick={fillNow} disabled={saving}>ตอนนี้</Button>
        </Box>
        <Typography sx={{ fontSize: 12.5, color: "#6B7489", mt: 1 }}>
          เวลาที่จะบันทึก: {toServer(day || dayText(new Date()), hour, minute)} (24 = เที่ยงคืนของวันที่เลือก)
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>ยกเลิก</Button>
        <Button variant="contained" onClick={save} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CookEndDialog;
