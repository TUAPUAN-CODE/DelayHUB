import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import axios from "axios";
import { fullStatusOrder } from "./StatusOrderSettings";

const API_URL = import.meta.env.VITE_API_URL;
const FALLBACK = { color: "#5B6B8C", bg: "#EEF2FA" };
const HEX = /^#[0-9a-fA-F]{6}$/;

/** colours of a status chip: normal (bg / fg) and pressed (onBg / onFg). An empty value = the built-in colour. */
export const statusLook = (label, base, styles) => {
  const s = (styles || {})[label] || {};
  const bg = s.bg || base?.bg || FALLBACK.bg;
  const fg = s.fg || base?.color || FALLBACK.color;
  // pressed: by default the two colours swap, so the text never disappears into the background (a white text on a white button)
  return { bg, fg, onBg: s.onBg || fg, onFg: s.onFg || bg };
};

const ColorInput = ({ label, value, fallback, onChange }) => (
  <Tooltip title={label} arrow>
    <Box component="label" sx={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 0.25, cursor: "pointer" }}>
      <Box component="input" type="color" value={HEX.test(value || "") ? value : fallback} onChange={(e) => onChange(e.target.value)}
        sx={{ width: 34, height: 26, p: 0, border: "1px solid #D5DFF2", borderRadius: 1, background: "none", cursor: "pointer" }} />
      <Typography sx={{ fontSize: 10, color: value ? "text.primary" : "text.secondary" }}>{label}</Typography>
    </Box>
  </Tooltip>
);

const Chip = ({ text, bg, fg }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: bg, color: fg, border: `1px solid ${fg}55`, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: fg }} />{text}
  </span>
);

/**
 * หน้าตั้งค่า "ชื่อและสีสถานะ": เปลี่ยนชื่อที่แสดงของแต่ละสถานะ และสีปุ่ม/ตัวอักษร (ปกติ และตอนกดเลือก)
 * ค่ากลางของทุกบัญชี (GET/PUT /api/sheet/global-settings) — บันทึกได้เมื่อใส่รหัสผ่านถูกต้อง (server ตรวจ)
 * ชื่อเดิมยังใช้ในกฎของระบบเหมือนเดิม; เปลี่ยนแค่สิ่งที่แสดง
 */
const StatusStyleSettings = ({ settings, defaults = {}, onSaved }) => {
  const order = useMemo(() => fullStatusOrder(settings?.statusOrder), [settings]);
  const [labels, setLabels] = useState(settings?.statusLabels || {});
  const [styles, setStyles] = useState(settings?.statusStyles || {});
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => { setLabels(settings?.statusLabels || {}); setStyles(settings?.statusStyles || {}); }, [settings]);

  const setStyle = (label, field, value) => { setStyles((s) => ({ ...s, [label]: { ...(s[label] || {}), [field]: value } })); setMessage(null); };
  const resetOne = (label) => {
    setLabels((l) => { const n = { ...l }; delete n[label]; return n; });
    setStyles((s) => { const n = { ...s }; delete n[label]; return n; });
    setMessage(null);
  };

  const save = async () => {
    if (!password.trim()) { setMessage({ ok: false, text: "กรุณาใส่รหัสผ่านก่อนบันทึก" }); return; }
    // only real changes are kept: an empty name / the same name = the built-in one
    const cleanLabels = Object.fromEntries(Object.entries(labels).filter(([k, v]) => v && v.trim() && v.trim() !== k).map(([k, v]) => [k, v.trim()]));
    const cleanStyles = Object.fromEntries(Object.entries(styles)
      .map(([k, v]) => [k, Object.fromEntries(Object.entries(v || {}).filter(([, c]) => HEX.test(c || "")))])
      .filter(([, v]) => Object.keys(v).length));
    try {
      setSaving(true);
      const res = await axios.put(`${API_URL}/api/sheet/global-settings`, { password: password.trim(), statusLabels: cleanLabels, statusStyles: cleanStyles });
      onSaved?.(res.data.data);
      setPassword("");
      setMessage({ ok: true, text: "บันทึกแล้ว ทุกบัญชีจะเห็นชื่อและสีนี้" });
    } catch (err) {
      console.error("[StatusStyleSettings] save error:", err);
      setMessage({ ok: false, text: err.response?.data?.error || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>ชื่อและสีของสถานะ</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        เปลี่ยนชื่อที่แสดง และสีปุ่ม/ตัวอักษร ทั้งตอนปกติและตอนกดเลือก · ใช้ร่วมกันทุกบัญชี · ต้องใส่รหัสผ่านก่อนบันทึก
      </Typography>
      {order.map((label) => {
        const look = statusLook(label, defaults[label], styles);
        const name = labels[label] ?? "";
        const changed = !!labels[label] || !!styles[label];
        return (
          <Box key={label} sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.25, py: 1, borderBottom: "1px solid #EEF2FA" }}>
            <Box sx={{ width: 170 }}>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>ชื่อเดิม</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{label}</Typography>
            </Box>
            <TextField size="small" label="ชื่อที่แสดง" placeholder={label} value={name} onChange={(e) => { setLabels((l) => ({ ...l, [label]: e.target.value })); setMessage(null); }} sx={{ width: 190 }} inputProps={{ maxLength: 100 }} />
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-end" }}>
              <ColorInput label="ปุ่ม" value={styles[label]?.bg} fallback={look.bg} onChange={(v) => setStyle(label, "bg", v)} />
              <ColorInput label="ตัวอักษร" value={styles[label]?.fg} fallback={look.fg} onChange={(v) => setStyle(label, "fg", v)} />
              <ColorInput label="ปุ่ม (กด)" value={styles[label]?.onBg} fallback={look.onBg} onChange={(v) => setStyle(label, "onBg", v)} />
              <ColorInput label="อักษร (กด)" value={styles[label]?.onFg} fallback={look.onFg} onChange={(v) => setStyle(label, "onFg", v)} />
            </Box>
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
              <Chip text={name.trim() || label} bg={look.bg} fg={look.fg} />
              <Chip text={name.trim() || label} bg={look.onBg} fg={look.onFg} />
            </Box>
            {changed && <Tooltip title="คืนค่าเดิมของสถานะนี้" arrow><IconButton size="small" onClick={() => resetOne(label)}><RestartAltIcon fontSize="small" /></IconButton></Tooltip>}
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

export default StatusStyleSettings;
