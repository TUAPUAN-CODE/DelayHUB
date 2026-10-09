import { useState } from "react";
import { Alert, Box, Button, TextField } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

// The password of the day = today's date as day + month + year without leading zeros (9 Oct 2026 -> 9102026). It changes every day.
const todayKey = () => { const d = new Date(); return `${d.getDate()}${d.getMonth() + 1}${d.getFullYear()}`; };
const STORE = "sheetSettingsUnlock";
const readUnlocked = () => { try { return sessionStorage.getItem(STORE) === todayKey(); } catch { return false; } };

/** Locks a settings page until the password of the day is typed (kept for this browser tab, and only for that day). Locked = the content cannot be clicked or focused, so nothing can be saved. */
const PasswordGate = ({ children }) => {
  const [open, setOpen] = useState(readUnlocked);
  const [value, setValue] = useState("");
  const [bad, setBad] = useState(false);
  const submit = () => {
    if (value.trim() === todayKey()) {
      try { sessionStorage.setItem(STORE, todayKey()); } catch (e) { console.error("[Sheet] unlock store error:", e.message); }
      setOpen(true); setBad(false);
    } else setBad(true);
  };
  return (
    <>
      {!open && (
        <Alert severity="warning" icon={<LockOutlinedIcon fontSize="inherit" />} sx={{ mb: 1.5 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
            <span>หน้านี้ต้องใส่รหัสยืนยันก่อนจึงแก้ไขและบันทึกได้ (รหัสเปลี่ยนทุกวัน)</span>
            <TextField
              size="small" type="password" label="รหัสยืนยัน" value={value} error={bad} helperText={bad ? "รหัสไม่ถูกต้อง" : ""} autoComplete="off"
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
