import { useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";

/** "yyyy-MM-dd HH:mm:ss" (from the API) -> "yyyy-MM-ddTHH:mm" (input type datetime-local); empty stays empty */
export const toInputAt = (v) => (v ? String(v).slice(0, 16).replace(" ", "T") : "");

/**
 * Edit data of a lot / a stamp / a set (needs the unlock of the button "แก้ไขข้อมูล"; the server checks the permit and writes the old → new value to the log).
 * fields: [{ key, label, type?: "text" | "number" | "datetime", required?, multiline? }] · values = the current values · onSubmit(values) -> Promise<error text or "">
 * Mounted once per opening (key), like StampDialog: what is typed is never reset while it is open; a tap outside does not close it.
 */
const EditDialog = ({ title, hint, fields, values: initial, onClose, onSubmit }) => {
  const [values, setValues] = useState(() => ({ ...initial, reason: "" }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const missing = fields.find((f) => f.required && String(values[f.key] ?? "").trim() === "");
    if (missing) { setError(`กรุณากรอก ${missing.label}`); return; }
    const bad = fields.find((f) => f.type === "number" && !(Number(values[f.key]) > 0));
    if (bad) { setError(`${bad.label} ต้องมากกว่า 0`); return; }
    setSaving(true);
    setError("");
    try {
      const msg = await onSubmit(values);
      if (msg) { setError(msg); setSaving(false); } else onClose();
    } catch (err) {
      console.error("[Other] edit error:", err);
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
            key={f.key} size="small" label={f.label} required={f.required} multiline={f.multiline} minRows={f.multiline ? 2 : undefined}
            type={f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : "text"}
            value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            InputLabelProps={f.type === "datetime" ? { shrink: true } : undefined} inputProps={f.type === "number" ? { min: 0, step: "any" } : undefined}
          />
        ))}
        <TextField size="small" label="เหตุผลที่แก้ (ไม่บังคับ)" value={values.reason} onChange={(e) => setValues((v) => ({ ...v, reason: e.target.value }))} inputProps={{ maxLength: 200 }} />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditDialog;
