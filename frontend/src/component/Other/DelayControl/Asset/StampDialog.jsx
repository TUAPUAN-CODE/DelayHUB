import { useEffect, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup, TextField } from "@mui/material";
import { toLocalInput } from "./lotCalc";

/**
 * One dialog for the three stamps of a lot: new lot (prepared at), into the cold room, out of the cold room.
 * The time is "now" (stamped when the button is pressed) or typed by hand.
 * fields: [{ key, label, type?, required?, defaultValue? }] · onSubmit({ values, at }) -> Promise (throws / returns an error text to show)
 */
const StampDialog = ({ open, title, fields, timeLabel, hint, submitLabel = "บันทึก", onClose, onSubmit }) => {
  const [values, setValues] = useState({});
  const [mode, setMode] = useState("now");
  const [manual, setManual] = useState(toLocalInput());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? ""])));
    setMode("now"); setManual(toLocalInput()); setError(""); setSaving(false);
  }, [open, fields]);

  const submit = async () => {
    const missing = fields.find((f) => f.required && String(values[f.key] ?? "").trim() === "");
    if (missing) { setError(`กรุณากรอก ${missing.label}`); return; }
    if (mode === "manual" && !manual) { setError("กรุณาเลือกเวลา"); return; }
    setSaving(true);
    setError("");
    try {
      const msg = await onSubmit({ values, at: mode === "now" ? "" : manual.replace("T", " ") + ":00" });
      if (msg) setError(msg); else onClose();
    } catch (err) {
      console.error("[Other] stamp error:", err);
      setError(err.response?.data?.error || err.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {hint && <Alert severity="info">{hint}</Alert>}
        {fields.map((f) => (
          <TextField
            key={f.key} size="small" label={f.label} type={f.type || "text"} required={f.required} value={values[f.key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} inputProps={f.type === "number" ? { min: 0, step: "any" } : undefined}
          />
        ))}
        <div>
          <strong style={{ fontSize: 13 }}>{timeLabel}</strong>
          <RadioGroup value={mode} onChange={(e) => setMode(e.target.value)}>
            <FormControlLabel value="now" control={<Radio size="small" />} label="เวลาตอนนี้ (stamp)" />
            <FormControlLabel value="manual" control={<Radio size="small" />} label="ใส่เวลาเอง" />
          </RadioGroup>
          {mode === "manual" && (
            <TextField size="small" type="datetime-local" fullWidth value={manual} onChange={(e) => setManual(e.target.value)} InputLabelProps={{ shrink: true }} />
          )}
        </div>
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>{saving ? "กำลังบันทึก..." : submitLabel}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default StampDialog;
