import { useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import TimeChoice, { newTime, timeValue } from "./TimeChoice";

/**
 * One dialog for the stamps of a lot: new lot (prepared at), into / out of the cold room, lid opened, a set out of the cold room.
 * The time is "now" (stamped when the button is pressed) or typed by hand.
 * fields: [{ key, label, type?, required?, defaultValue? }] · onSubmit({ values, at }) -> Promise (throws / returns an error text to show)
 *
 * The parent mounts it once per opening (key): what is typed is set ONCE from the defaults and never reset while it is open.
 * (It used to be reset every time the page re-rendered — the minute timer, a save on another device — so the weight / time being typed
 *  changed back by itself.) A tap outside / Esc does not close it: only "ยกเลิก" or a successful save.
 */
const StampDialog = ({ title, fields, timeLabel, hint, submitLabel = "บันทึก", onClose, onSubmit }) => {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? ""])));
  const [time, setTime] = useState(newTime);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const missing = fields.find((f) => f.required && String(values[f.key] ?? "").trim() === "");
    if (missing) { setError(`กรุณากรอก ${missing.label}`); return; }
    if (time.mode === "manual" && !time.manual) { setError("กรุณาเลือกเวลา"); return; }
    setSaving(true);
    setError("");
    try {
      const msg = await onSubmit({ values, at: timeValue(time) });
      if (msg) { setError(msg); setSaving(false); } else onClose();
    } catch (err) {
      console.error("[Other] stamp error:", err);
      setError(err.response?.data?.error || err.message || "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={(e, reason) => { if (!saving && reason !== "backdropClick") onClose(); }} disableEscapeKeyDown fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {hint && <Alert severity="info">{hint}</Alert>}
        {fields.map((f) => (
          <TextField
            key={f.key} size="small" label={f.label} type={f.type || "text"} required={f.required} value={values[f.key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} inputProps={f.type === "number" ? { min: 0, step: "any" } : undefined}
          />
        ))}
        <TimeChoice label={timeLabel} value={time} onChange={setTime} />
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
