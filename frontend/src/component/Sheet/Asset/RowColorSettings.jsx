import { useEffect, useState } from "react";
import { Alert, Box, Button, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import axios from "axios";
import { ROW_BG, ROW_FG } from "../../Layout/DataGrid/rowColors";

const API_URL = import.meta.env.VITE_API_URL;
const HEX = /^#[0-9a-fA-F]{6}$/;
const LEVELS = [
  ["green", "เขียว", "เหลือเวลามากกว่า 50%"],
  ["yellow", "เหลือง", "ยังเหลือเวลา"],
  ["red", "แดง", "หมดเวลาแล้ว"],
  ["blue", "ฟ้า", "Done (เสร็จแล้ว)"],
];

const ColorInput = ({ label, value, onChange }) => (
  <Box component="label" sx={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 0.25, cursor: "pointer" }}>
    <Box component="input" type="color" value={value} onChange={(e) => onChange(e.target.value)}
      sx={{ width: 44, height: 32, p: 0, border: "1px solid #D5DFF2", borderRadius: 1, background: "none", cursor: "pointer" }} />
    <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{label}</Typography>
  </Box>
);

/**
 * หน้าตั้งค่า "สีแถวเขียว/เหลือง/แดง": สีพื้นแถวและสีตัวอักษรของแต่ละระดับ
 * ค่ากลางของทุกบัญชี (PUT /api/sheet/global-settings · rowColors) — บันทึกได้เมื่อใส่รหัสผ่านถูกต้อง (server ตรวจ)
 */
const RowColorSettings = ({ settings, onSaved }) => {
  const [colors, setColors] = useState(settings?.rowColors || {});
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => { setColors(settings?.rowColors || {}); }, [settings]);

  const valueOf = (k, f) => colors[k]?.[f] || (f === "bg" ? ROW_BG[k] : ROW_FG[k]);
  const set = (k, f, v) => { setColors((c) => ({ ...c, [k]: { ...(c[k] || {}), [f]: v } })); setMessage(null); };
  const reset = (k) => { setColors((c) => { const n = { ...c }; delete n[k]; return n; }); setMessage(null); };

  const save = async () => {
    if (!password.trim()) { setMessage({ ok: false, text: "กรุณาใส่รหัสผ่านก่อนบันทึก" }); return; }
    // only the colours that differ from the built-in ones are kept
    const clean = Object.fromEntries(Object.entries(colors)
      .map(([k, v]) => [k, Object.fromEntries(Object.entries(v || {}).filter(([f, c]) => HEX.test(c || "") && c.toLowerCase() !== (f === "bg" ? ROW_BG[k] : ROW_FG[k]).toLowerCase()))])
      .filter(([, v]) => Object.keys(v).length));
    try {
      setSaving(true);
      const res = await axios.put(`${API_URL}/api/sheet/global-settings`, { password: password.trim(), rowColors: clean });
      onSaved?.(res.data.data);
      setPassword("");
      setMessage({ ok: true, text: "บันทึกแล้ว ทุกบัญชีจะเห็นสีแถวนี้" });
    } catch (err) {
      console.error("[RowColorSettings] save error:", err);
      setMessage({ ok: false, text: err.response?.data?.error || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>สีแถวเขียว / เหลือง / แดง</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        เลือกสีพื้นแถวและสีตัวอักษรของแต่ละระดับ · ใช้ร่วมกันทุกบัญชี · ต้องใส่รหัสผ่านก่อนบันทึก
      </Typography>
      {LEVELS.map(([k, name, hint]) => {
        const bg = valueOf(k, "bg");
        const fg = valueOf(k, "fg");
        return (
          <Box key={k} sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, py: 1.25, borderBottom: "1px solid #EEF2FA" }}>
            <Box sx={{ width: 150 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{name}</Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{hint}</Typography>
            </Box>
            <ColorInput label="สีแถว" value={bg} onChange={(v) => set(k, "bg", v)} />
            <ColorInput label="สีตัวอักษร" value={fg} onChange={(v) => set(k, "fg", v)} />
            <Box sx={{ flex: 1, minWidth: 180, px: 1.5, py: 1, background: bg, color: fg, border: "1px solid #334155", borderRadius: 1, fontSize: 13, fontWeight: 500 }}>
              ตัวอย่างแถว · Batch 6050123 · 12.5 kg
            </Box>
            {colors[k] && <Tooltip title="คืนค่าเดิม" arrow><IconButton size="small" onClick={() => reset(k)}><RestartAltIcon fontSize="small" /></IconButton></Tooltip>}
          </Box>
        );
      })}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mt: 2 }}>
        <TextField size="small" type="password" label="รหัสผ่าน" value={password} autoComplete="off"
          onChange={(e) => { setPassword(e.target.value); setMessage(null); }} onKeyDown={(e) => { if (e.key === "Enter") save(); }} sx={{ width: 180 }} />
        <Button variant="contained" color="secondary" size="small" disabled={saving} onClick={save}>บันทึก</Button>
      </Box>
      {message && <Alert severity={message.ok ? "success" : "error"} sx={{ mt: 1 }}>{message.text}</Alert>}
    </Box>
  );
};

export default RowColorSettings;
