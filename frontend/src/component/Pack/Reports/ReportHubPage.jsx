import { useState } from "react";
import { Box, ToggleButton, ToggleButtonGroup, TextField, Button, Typography, Paper } from "@mui/material";
import { LockOutlined } from "@mui/icons-material";
import Header from "../../Layout/Header";
import Buttom from "../../Layout/Buttom";
import ReportUser from "../ReportRawmatNotEditTIME/Asset/ParentComponent";
import ReportHistory from "../ReportPull/Asset/ParentComponent";
import ReportSup from "../ReportRawmatEditTIME/Asset/ParentComponent";

// รหัสผ่านนี้เป็นเพียงด่านกันกดผิดฝั่งหน้าเว็บ (ไม่ใช่การรักษาความปลอดภัยจริง)
const SUP_PASSWORD = "Qcpm";
const UNLOCK_KEY = "pack_report_sup_unlocked";

const readUnlocked = () => {
  try { return sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch { return false; }
};

const VIEWS = [
  { key: "report", label: "Report" },
  { key: "history", label: "ประวัติ Report" },
  { key: "sup", label: "Report (หัวหน้า / แก้ไขเวลา)" },
];

const PasswordGate = ({ onUnlock }) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (value === SUP_PASSWORD) {
      try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch { /* ignore */ }
      onUnlock();
    } else {
      setError("รหัสผ่านไม่ถูกต้อง");
    }
  };

  return (
    <Paper sx={{ maxWidth: 380, mx: "auto", mt: 6, p: 3, textAlign: "center" }}>
      <LockOutlined sx={{ fontSize: 36, color: "#1552F0" }} />
      <Typography sx={{ fontSize: 17, fontWeight: 600, mb: 0.5 }}>ต้องใช้รหัสผ่านเพื่อเข้าหน้านี้</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Report สำหรับหัวหน้า (แก้ไขเวลาได้)</Typography>
      <TextField
        fullWidth
        type="password"
        label="รหัสผ่าน"
        value={value}
        autoFocus
        error={!!error}
        helperText={error}
        onChange={(e) => { setValue(e.target.value); setError(""); }}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
      />
      <Button fullWidth variant="contained" sx={{ mt: 2 }} onClick={submit}>ยืนยัน</Button>
    </Paper>
  );
};

const ReportHubPage = ({ initialView = "report" }) => {
  const [view, setView] = useState(initialView);
  const [unlocked, setUnlocked] = useState(readUnlocked());

  return (
    <div style={{ backgroundColor: "#fff" }} className="flex-1 overflow-auto relative z-10">
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Header title="Report" />
      </main>
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", mb: 1.5 }}>
          <Typography sx={{ fontWeight: 600 }}>เลือกดู:</Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            color="primary"
            value={view}
            onChange={(_, next) => { if (next) setView(next); }}
          >
            {VIEWS.map((v) => (
              <ToggleButton key={v.key} value={v.key} sx={{ textTransform: "none", px: 2 }}>
                {v.key === "sup" && !unlocked ? <LockOutlined sx={{ fontSize: 16, mr: 0.5 }} /> : null}
                {v.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {view === "report" && <ReportUser />}
        {view === "history" && <ReportHistory />}
        {view === "sup" && (unlocked ? <ReportSup /> : <PasswordGate onUnlock={() => setUnlocked(true)} />)}
      </main>
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
      </main>
    </div>
  );
};

export default ReportHubPage;
