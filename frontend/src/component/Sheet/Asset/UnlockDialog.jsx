import { useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import axios from "axios";
import { getUnlockToken, setUnlockToken, tokenExpiresAt } from "../../../services/authClient";

const API_URL = import.meta.env.VITE_API_URL;

/** true while this tab holds a valid Setting permit (from the same password as the Setting pages) */
export const hasUnlock = () => {
  try {
    const permit = getUnlockToken();
    if (!permit || tokenExpiresAt(permit) <= Date.now()) return false;
    // the permit belongs to the user who typed the password: after a change of login in this tab it is not this user's
    const part = permit.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, "=")));
    const me = parseInt(localStorage.getItem("user_id"), 10);
    if (!Number.isNaN(me) && Number(payload.user_id) !== me) { setUnlockToken(null); return false; }
    return true;
  } catch { return false; }
};

/** Asks the Setting password (SHEET_GLOBAL_SETTING_PASSWORD); the server checks it and gives a permit that is sent with every edit (x-setting-unlock). */
const UnlockDialog = ({ open, title = "ใส่รหัสผ่านเพื่อแก้ไขข้อมูล", onClose, onUnlocked }) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!value.trim()) { setError("กรุณาใส่รหัสผ่าน"); return; }
    setBusy(true);
    try {
      const res = await axios.post(`${API_URL}/api/sheet/setting-unlock`, { password: value.trim(), user_id: parseInt(localStorage.getItem("user_id"), 10) });
      setUnlockToken(res.data.unlock);
      setValue(""); setError("");
      onUnlocked();
    } catch (err) {
      const status = err.response && err.response.status;
      console.error("[Sheet] edit unlock error:", status || err.message);
      setError(status === 429 ? "ใส่รหัสผิดหลายครั้ง กรุณารอ 15 นาที" : status === 401 ? "รหัสไม่ถูกต้อง" : status === 503 ? (err.response.data?.error || "ยังไม่ได้ตั้งรหัสที่เซิร์ฟเวอร์") : "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus fullWidth size="small" type="password" label="รหัสผ่าน" value={value} autoComplete="off" sx={{ mt: 1 }}
          error={!!error} onChange={(e) => { setValue(e.target.value); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>ยกเลิก</Button>
        <Button variant="contained" color="secondary" onClick={submit} disabled={busy}>ปลดล็อก</Button>
      </DialogActions>
    </Dialog>
  );
};

export default UnlockDialog;
