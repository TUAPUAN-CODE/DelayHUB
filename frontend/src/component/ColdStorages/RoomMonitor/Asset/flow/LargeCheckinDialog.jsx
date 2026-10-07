import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography, CircularProgress } from "@mui/material";
import { ROOM_CONFIG } from "./largeRooms";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

/** Check a trolley into a large cold room: pick the room (the server picks the first free slot) → PUT /largecold/checkin/update/Trolley */
const LargeCheckinDialog = ({ open, row, onClose, onDone }) => {
  const [slots, setSlots] = useState([]);
  const [csId, setCsId] = useState(null);
  const [leader, setLeader] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCsId(null); setLeader(""); setError("");
    axios.get(`${API_URL}/api/coldstorage/room`)
      .then((res) => setSlots(res.data?.slot || []))
      .catch((err) => { console.error("[LargeCheckinDialog] slots error:", err); setSlots([]); });
  }, [open]);

  const stats = useMemo(() => {
    const m = new Map();
    slots.forEach((s) => {
      const v = m.get(s.cs_id) || { total: 0, used: 0 };
      v.total += 1;
      if (s.tro_id) v.used += 1;
      m.set(s.cs_id, v);
    });
    return m;
  }, [slots]);

  const submit = async () => {
    if (!csId) { setError("กรุณาเลือกห้องเย็น"); return; }
    setBusy(true); setError("");
    try {
      const res = await axios.put(`${API_URL}/api/largecold/checkin/update/Trolley`, {
        tro_id: row.tro_id, cs_id: csId, section_leader: leader.trim(),
      });
      onDone?.(`รับรถเข็น ${row.tro_id} เข้าห้องเย็นแล้ว (ช่อง ${res.data?.slot_id ?? "-"})`);
      onClose();
    } catch (err) {
      console.error("[LargeCheckinDialog] checkin error:", err);
      setError(err.response?.data?.message || "รับเข้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (!row) return null;
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: 18 }}>
        รับเข้าห้องเย็นใหญ่ · รถเข็น {row.tro_id}
        <Typography variant="body2" color="text.secondary">เลือกห้อง ระบบจะจัดช่องว่างช่องแรกให้อัตโนมัติ</Typography>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 1, mb: 2 }}>
          {ROOM_CONFIG.map((room) => {
            const st = stats.get(room.cs_id);
            const free = st ? st.total - st.used : null;
            const full = free === 0;
            const active = csId === room.cs_id;
            return (
              <Box
                key={room.cs_id}
                onClick={() => !full && setCsId(room.cs_id)}
                sx={{
                  p: "8px 10px", borderRadius: "10px", textAlign: "center", fontSize: 13, cursor: full ? "not-allowed" : "pointer",
                  border: active ? "2px solid #1552F0" : "1.5px solid #E3E8F2",
                  background: active ? "#EAF0FF" : full ? "#F5F5F5" : "#fff", color: full ? "#B0BAC9" : "#1B2333", fontWeight: active ? 700 : 500,
                }}
              >
                {room.cs_name}
                <div style={{ fontSize: 11, color: full ? "#E5484D" : "#6B7489", fontWeight: 400 }}>
                  {st ? (full ? "เต็ม" : `ว่าง ${free} / ${st.total}`) : "ไม่มีข้อมูลช่อง"}
                </div>
              </Box>
            );
          })}
        </Box>
        <TextField fullWidth size="small" label="ชื่อหัวหน้าส่วน (ถ้ามี)" value={leader} onChange={(e) => setLeader(e.target.value)} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !csId} startIcon={busy ? <CircularProgress size={16} /> : null}>
          ยืนยันรับเข้า
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LargeCheckinDialog;
