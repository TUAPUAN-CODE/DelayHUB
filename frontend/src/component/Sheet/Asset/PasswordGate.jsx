import { useState } from "react";
import { Alert, Box, Button, TextField } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import axios from "axios";
import { getUnlockToken, setUnlockToken, tokenExpiresAt } from "../../../services/authClient";

const API_URL = import.meta.env.VITE_API_URL;

// The password of the day = today's date as day + month + year without leading zeros (9 Oct 2026 -> 9102026). It changes every day.
// The server checks it (POST /api/sheet/setting-unlock) and gives a permit that is sent with every save of these settings, so the lock also holds when the API is called directly.
// todayKey / STORE are only the fallback for a server that does not have the unlock route yet.
const todayKey = () => { const d = new Date(); return `${d.getDate()}${d.getMonth() + 1}${d.getFullYear()}`; };
const STORE = "sheetSettingsUnlock";
const readUnlocked = () => {
  try {
    const permit = getUnlockToken();
    if (permit && tokenExpiresAt(permit) > Date.now()) return true;
    return sessionStorage.getItem(STORE) === todayKey();
  } catch { return false; }
};

/** Locks a settings page until the password of the day is typed (kept for this browser tab, and only for that day). Locked = the content cannot be clicked or focused, so nothing can be saved. */
const PasswordGate = ({ children }) => {
  const [open, setOpen] = useState(readUnlocked);
  const [value, setValue] = useState("");
  const [bad, setBad] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/sheet/setting-unlock`, { password: value.trim(), user_id: parseInt(localStorage.getItem("user_id"), 10) });
      setUnlockToken(res.data.unlock);
      setOpen(true); setBad(false); setMessage("");
    } catch (err) {
      const status = err.response && err.response.status;
      if (status === 404 && value.trim() === todayKey()) { // old server without the unlock route: keep the old browser-only check
        try { sessionStorage.setItem(STORE, todayKey()); } catch (e) { console.error("[Sheet] unlock store error:", e.message); }
        setOpen(true); setBad(false); setMessage("");
        return;
      }
      console.error("[Sheet] unlock error:", status || err.message);
      setBad(true);
      setMessage(status === 429 ? "ใส่รหัสผิดหลายครั้ง กรุณารอ 15 นาที" : status === 401 || status === 404 ? "รหัสไม่ถูกต้อง" : "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  };
  return (
    <>
      {!open && (
        <Alert severity="warning" icon={<LockOutlinedIcon fontSize="inherit" />} sx={{ mb: 1.5 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
            <span>หน้านี้ต้องใส่รหัสยืนยันก่อนจึงแก้ไขและบันทึกได้ (รหัสเปลี่ยนทุกวัน)</span>
            <TextField
              size="small" type="password" label="รหัสยืนยัน" value={value} error={bad} helperText={bad ? message || "รหัสไม่ถูกต้อง" : ""} autoComplete="off"
              onChange={(e) => { setValue(e.target.value); setBad(false); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} sx={{ width: 170 }}
            />
            <Button variant="contained" size="small" onClick={submit}>ปลดล็อก</Button>
          </Box>
        </Alert>
      )}
      <div inert={!open} style={open ? undefined : { opacity: 0.5, pointerEvents: "none", userSelect: "none" }}>{children}</div>
    </>
  );
};

export default PasswordGate;
