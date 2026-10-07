import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogActions, Button, TextField, Typography } from "@mui/material";

// small "ask one value" dialog: weight for thaw stamps, supervisor name for cold-room check-in
const PromptDialog = ({ open, title, description, label, type = "text", initial = "", confirmText = "ยืนยัน", onCancel, onConfirm }) => {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setValue(initial ?? ""); setError(""); }
  }, [open, initial]);

  const submit = () => {
    const v = String(value).trim();
    if (!v) { setError("กรุณากรอกข้อมูล"); return; }
    if (type === "number" && !(parseFloat(v) > 0)) { setError("ต้องเป็นตัวเลขมากกว่า 0"); return; }
    onConfirm(v);
  };

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogContent>
        <Typography sx={{ fontSize: 18, fontWeight: 600, mb: 0.5 }}>{title}</Typography>
        {description && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{description}</Typography>}
        <TextField
          autoFocus fullWidth label={label} type={type} value={value} error={!!error} helperText={error}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          inputProps={type === "number" ? { min: 0, step: "0.01" } : undefined}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit}>{confirmText}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PromptDialog;
