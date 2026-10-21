import { useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TimeChoice, { newTime, timeValue } from "./TimeChoice";

const MAX_SETS = 100;
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * "จัดชุด": split the kg of a lot that are in the cold room (and in no set yet) into sets, after the lid was opened.
 * Quick fill: N sets of the same weight, or sets of X kg (+ what is left); every set can then be changed / removed / added.
 * available = kg that can be split · onSubmit({ sets: [kg], at }) -> Promise (error text to show, or "")
 * Mounted once per opening (nothing typed is reset while it is open), a tap outside does not close it.
 */
const SplitDialog = ({ lotLabel, available, onClose, onSubmit }) => {
  const [count, setCount] = useState("");
  const [each, setEach] = useState("");
  const [rows, setRows] = useState([]);
  const [time, setTime] = useState(newTime);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const total = r2(rows.reduce((s, x) => s + (Number(x) || 0), 0));
  const over = total > available + 1e-6;

  const byCount = () => {
    const n = parseInt(count, 10);
    if (!(n > 0) || n > MAX_SETS) { setError(`จำนวนชุดต้อง 1–${MAX_SETS}`); return; }
    const base = Math.floor((available * 100) / n) / 100;
    setRows([...Array(n - 1).fill(String(base)), String(r2(available - base * (n - 1)))]);
    setError("");
  };
  const byWeight = () => {
    const x = Number(each);
    if (!(x > 0)) { setError("กรุณาใส่น้ำหนักต่อชุด"); return; }
    const n = Math.floor(available / x + 1e-9);
    const rest = r2(available - n * x);
    const next = [...Array(n).fill(String(x)), ...(rest > 0 ? [String(rest)] : [])];
    if (!next.length) { setError(`น้ำหนักต่อชุดมากกว่าที่มี (${available} kg)`); return; }
    if (next.length > MAX_SETS) { setError(`ได้ ${next.length} ชุด — มากสุด ${MAX_SETS} ชุด`); return; }
    setRows(next);
    setError("");
  };
  const setRow = (i, v) => setRows((list) => list.map((x, k) => (k === i ? v : x)));
  const removeRow = (i) => setRows((list) => list.filter((_, k) => k !== i));
  const addRow = () => setRows((list) => (list.length >= MAX_SETS ? list : [...list, String(Math.max(0, r2(available - total)))]));

  const submit = async () => {
    const sets = rows.map(Number);
    if (!sets.length) { setError("ยังไม่มีชุด — กดแบ่งด้านบน หรือ \"เพิ่มชุด\""); return; }
    if (sets.some((x) => !(x > 0))) { setError("น้ำหนักของทุกชุดต้องมากกว่า 0"); return; }
    if (over) { setError(`รวม ${total} kg เกินที่จัดชุดได้ ${available} kg`); return; }
    if (time.mode === "manual" && !time.manual) { setError("กรุณาเลือกเวลา"); return; }
    setSaving(true);
    setError("");
    try {
      const msg = await onSubmit({ sets, at: timeValue(time) });
      if (msg) { setError(msg); setSaving(false); } else onClose();
    } catch (err) {
      console.error("[Other] split error:", err);
      setError(err.response?.data?.error || err.message || "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={(e, reason) => { if (!saving && reason !== "backdropClick") onClose(); }} disableEscapeKeyDown fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>จัดชุด — {lotLabel}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Alert severity="info">ในห้องเย็นที่ยังไม่จัดชุด <b>{available} kg</b> — แต่ละชุดพิมพ์สลิปได้หลังบันทึก</Alert>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField size="small" label="จำนวนชุด" type="number" value={count} onChange={(e) => setCount(e.target.value)} inputProps={{ min: 1, step: 1 }} sx={{ width: 130 }} />
          <Button variant="outlined" onClick={byCount} sx={{ textTransform: "none" }}>แบ่งเท่าๆ กัน</Button>
          <Box sx={{ width: 16 }} />
          <TextField size="small" label="ชุดละ (kg)" type="number" value={each} onChange={(e) => setEach(e.target.value)} inputProps={{ min: 0, step: "any" }} sx={{ width: 130 }} />
          <Button variant="outlined" onClick={byWeight} sx={{ textTransform: "none" }}>แบ่งตามน้ำหนัก</Button>
        </Box>
        <Box sx={{ border: "1px solid #E1E9FA", borderRadius: 2, p: 1, maxHeight: 280, overflowY: "auto" }}>
          {rows.map((x, i) => (
            <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.75 }}>
              <Typography sx={{ width: 70, fontSize: 13.5, fontWeight: 600 }}>ชุดที่ {i + 1}</Typography>
              <TextField size="small" type="number" value={x} onChange={(e) => setRow(i, e.target.value)} inputProps={{ min: 0, step: "any" }} sx={{ width: 140 }} InputProps={{ endAdornment: <span style={{ color: "#6B7489", fontSize: 13 }}>kg</span> }} />
              <IconButton size="small" onClick={() => removeRow(i)} title="ลบชุดนี้"><DeleteOutlineIcon fontSize="small" /></IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addRow} sx={{ textTransform: "none" }}>เพิ่มชุด</Button>
        </Box>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: over ? "#C62828" : "#1B2333" }}>
          {rows.length} ชุด · รวม {total} / {available} kg{!over && rows.length ? ` · เหลือไม่จัดชุด ${r2(available - total)} kg` : ""}
        </Typography>
        <TimeChoice label="เวลาจัดชุด" value={time} onChange={setTime} />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit} disabled={saving || over}>{saving ? "กำลังบันทึก..." : "บันทึกจัดชุด"}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SplitDialog;
