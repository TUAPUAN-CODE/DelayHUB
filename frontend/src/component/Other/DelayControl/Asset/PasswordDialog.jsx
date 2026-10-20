import { useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";

/**
 * A change that needs the edit password (the server checks it): edit the weight of a lot, cancel a set.
 * field (optional): { label, defaultValue } — a number to type · onSubmit({ password, value }) -> Promise (error text to show, or "")
 * Mounted once per opening, like StampDialog: nothing typed is reset while it is open, a tap outside does not close it.
 */
const PasswordDialog = ({ title, hint, field, submitLabel = "บันทึก", onClose, onSubmit }) => {
  const [value, setValue] = useState(() => (field ? String(field.defaultValue ?? "") : ""));
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (field && !(Number(value) > 0)) { setError(`กรุณากรอก ${field.label}`); return; }
    if (!password) { setError("กรุณาใส่รหัส"); return; }
    setSaving(true);
    setError("");
    try {
      const msg = await onSubmit({ password, value: field ? Number(value) : undefined });
      if (msg) { setError(msg); setSaving(false); } else onClose();
    } catch (err) {
      console.error("[Other] password action error:", err);
      setError(err.response?.data?.error || err.message || "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={(e, reason) => { if (!saving && reason !== "backdropClick") onClose(); }} disableEscapeKeyDown fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {hint && <Alert severity="info">{hint}</Alert>}
        {field && (
          <TextField size="small" label={field.label} type="number" value={value} onChange={(e) => setValue(e.target.value)} inputProps={{ min: 0, step: "any" }} />
        )}
        <TextField
          size="small" label="รหัสแก้ไข" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>{saving ? "กำลังบันทึก..." : submitLabel}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PasswordDialog;
