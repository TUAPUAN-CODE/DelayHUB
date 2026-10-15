import { useEffect, useState } from "react";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import axios from "axios";
import { STATUS_LIST } from "./statusZones";
import SortableList from "../../Layout/DataGrid/SortableList";

const API_URL = import.meta.env.VITE_API_URL;
const BASE = STATUS_LIST.map(([label]) => label);

/** saved order first, then the statuses not in it yet (a new status is added at the end) */
export const fullStatusOrder = (saved) => {
  const known = (saved || []).filter((l) => BASE.includes(l));
  return [...known, ...BASE.filter((l) => !known.includes(l))];
};

// ลำดับสถานะบนแถบเหนือตาราง: ค่ากลางที่ทุกบัญชีใช้ร่วมกัน — ลากวางหรือกดลูกศรเพื่อจัดลำดับ แล้วบันทึกเมื่อใส่รหัสถูกต้อง (server เป็นคนตรวจ)
const StatusOrderSettings = ({ savedOrder, labels = {}, onSaved }) => {
  const [order, setOrder] = useState(() => fullStatusOrder(savedOrder));
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  useEffect(() => { setOrder(fullStatusOrder(savedOrder)); }, [savedOrder]);

  const save = async (nextOrder) => {
    if (!password.trim()) { setMessage({ ok: false, text: "กรุณาใส่รหัสผ่านก่อนบันทึก" }); return; }
    try {
      setSaving(true);
      const res = await axios.put(`${API_URL}/api/sheet/global-settings`, { password: password.trim(), statusOrder: nextOrder });
      onSaved?.(res.data.data || { statusOrder: nextOrder });
      setPassword("");
      setMessage({ ok: true, text: "บันทึกแล้ว ทุกบัญชีจะเห็นลำดับนี้" });
    } catch (err) {
      console.error("[StatusOrderSettings] save error:", err);
      setMessage({ ok: false, text: err.response?.data?.error || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setSaving(false);
    }
  };

  const items = order.map((label) => ({ key: label, label: labels[label] || label, sub: labels[label] && labels[label] !== label ? `ชื่อเดิม: ${label}` : "" }));
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>ลำดับสถานะบนแถบเหนือตาราง (ขึ้นก่อน → ขึ้นหลัง)</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>ลากที่ไอคอนด้านซ้าย หรือกดลูกศร · ใช้ร่วมกันทุกบัญชี · ต้องใส่รหัสผ่านก่อนบันทึก</Typography>
      <SortableList items={items} onChange={(keys) => { setOrder(keys); setMessage(null); }} />
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mt: 1.5 }}>
        <TextField
          size="small" type="password" label="รหัสผ่าน" value={password} autoComplete="off"
          onChange={(e) => { setPassword(e.target.value); setMessage(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") save(order); }}
          sx={{ width: 180 }}
        />
        <Button variant="contained" color="secondary" size="small" disabled={saving} onClick={() => save(order)}>บันทึก</Button>
        <Button size="small" disabled={saving} onClick={() => save(BASE)}>คืนค่าลำดับเริ่มต้น</Button>
      </Box>
      {message && <Alert severity={message.ok ? "success" : "error"} sx={{ mt: 1 }}>{message.text}</Alert>}
    </Box>
  );
};

export default StatusOrderSettings;
