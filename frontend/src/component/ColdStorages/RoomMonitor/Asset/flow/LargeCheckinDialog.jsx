import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Tooltip, Typography, CircularProgress } from "@mui/material";
import { ROOM_CONFIG } from "./largeRooms";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

const naturalSort = (a, b) => String(a.slot_id).localeCompare(String(b.slot_id), "en", { numeric: true });
const slotState = (s) => {
  if (s.tro_id === "rsrv") return "reserved";
  if (s.tro_id) return "used";
  if (s.slot_status === false || s.slot_status === 0) return "off";
  return "free";
};
const SLOT_LOOK = {
  free: { bg: "#F0FBF3", border: "#BFE8C9", color: "#16A34A", text: "ว่าง" },
  used: { bg: "#F5F7FB", border: "#E3E8F2", color: "#9AA3B5" },
  reserved: { bg: "#FFF8E6", border: "#FDE2A7", color: "#B45309", text: "จองอยู่" },
  off: { bg: "#F5F5F5", border: "#E3E8F2", color: "#B0BAC9", text: "ปิดใช้งาน" },
};

/**
 * Check a trolley into a large cold room (cs_id 10 - 46): pick the room, then the slot on the layout of that room
 * (or leave it on "ช่องว่างช่องแรก") → PUT /largecold/checkin/update/Trolley
 */
const LargeCheckinDialog = ({ open, row, onClose, onDone }) => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [csId, setCsId] = useState(null);
  const [slotId, setSlotId] = useState(null); // null = the first free slot of the room
  const [leader, setLeader] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadSlots = () => {
    setLoading(true);
    return axios.get(`${API_URL}/api/coldstorage/room`)
      .then((res) => setSlots(res.data?.slot || []))
      .catch((err) => { console.error("[LargeCheckinDialog] slots error:", err); setSlots([]); setError("โหลดช่องจอดไม่สำเร็จ"); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    setCsId(null); setSlotId(null); setLeader(""); setError("");
    loadSlots();
  }, [open]);

  const stats = useMemo(() => {
    const m = new Map();
    slots.forEach((s) => {
      const v = m.get(s.cs_id) || { total: 0, free: 0 };
      v.total += 1;
      if (slotState(s) === "free") v.free += 1;
      m.set(s.cs_id, v);
    });
    return m;
  }, [slots]);

  const roomSlots = useMemo(() => slots.filter((s) => s.cs_id === csId).sort(naturalSort), [slots, csId]);
  const roomName = ROOM_CONFIG.find((r) => r.cs_id === csId)?.cs_name;

  const pickRoom = (id) => { setCsId(id); setSlotId(null); setError(""); };

  const submit = async () => {
    if (!csId) { setError("กรุณาเลือกห้องเย็น"); return; }
    setBusy(true); setError("");
    try {
      const res = await axios.put(`${API_URL}/api/largecold/checkin/update/Trolley`, {
        tro_id: row.tro_id, cs_id: csId, slot_id: slotId ?? undefined, section_leader: leader.trim(),
      });
      onDone?.(`รับรถเข็น ${row.tro_id} เข้า ${roomName || `ห้อง ${csId}`} แล้ว (ช่อง ${res.data?.slot_id ?? slotId ?? "-"})`);
      onClose();
    } catch (err) {
      console.error("[LargeCheckinDialog] checkin error:", err);
      setError(err.response?.data?.message || "รับเข้าไม่สำเร็จ");
      loadSlots(); // the slot may have been taken meanwhile: show the room as it is now
    } finally {
      setBusy(false);
    }
  };

  if (!row) return null;
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: 18 }}>
        รับเข้าห้องเย็น · รถเข็น {row.tro_id}
        <Typography variant="body2" color="text.secondary">
          {[row.mat_name, row.mat, row.batch_after && `Batch ${row.batch_after}`].filter(Boolean).join(" · ") || "เลือกห้อง แล้วเลือกช่องจอด"}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        <Typography sx={{ fontWeight: 600, mb: 1 }}>1. เลือกห้อง</Typography>
        {loading && !slots.length ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 4 }}><CircularProgress /></Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 1, mb: 2 }}>
            {ROOM_CONFIG.map((room) => {
              const st = stats.get(room.cs_id);
              const full = !st || st.free === 0;
              const active = csId === room.cs_id;
              return (
                <Box
                  key={room.cs_id}
                  onClick={() => !full && pickRoom(room.cs_id)}
                  sx={{
                    p: "8px 10px", borderRadius: "10px", textAlign: "center", fontSize: 13, cursor: full ? "not-allowed" : "pointer",
                    border: active ? "2px solid #1552F0" : "1.5px solid #E3E8F2",
                    background: active ? "#EAF0FF" : full ? "#F5F5F5" : "#fff", color: full ? "#B0BAC9" : "#1B2333", fontWeight: active ? 700 : 500,
                  }}
                >
                  {room.cs_name}
                  <div style={{ fontSize: 11, color: full ? "#E5484D" : "#6B7489", fontWeight: 400 }}>
                    {!st ? "ไม่มีช่องจอด" : st.free === 0 ? "เต็ม" : `ว่าง ${st.free} / ${st.total}`}
                  </div>
                </Box>
              );
            })}
          </Box>
        )}

        {csId && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>2. เลือกช่องจอดใน {roomName}</Typography>
              <Button size="small" variant={slotId === null ? "contained" : "outlined"} onClick={() => setSlotId(null)}>ช่องว่างช่องแรก (อัตโนมัติ)</Button>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(82px, 1fr))", gap: 0.75, maxHeight: 320, overflowY: "auto", p: 0.5 }}>
              {roomSlots.map((s) => {
                const st = slotState(s);
                const look = SLOT_LOOK[st];
                const active = slotId !== null && String(slotId) === String(s.slot_id);
                return (
                  <Tooltip key={s.slot_id} title={st === "used" ? `รถเข็น ${s.tro_id}` : look.text}>
                    <span>
                      <Button
                        fullWidth disabled={st !== "free"} onClick={() => setSlotId(s.slot_id)}
                        sx={{
                          height: 50, borderRadius: 2, flexDirection: "column", lineHeight: 1.2, border: active ? "2px solid #1552F0" : `1px solid ${look.border}`,
                          bgcolor: active ? "#EAF0FF" : look.bg, color: active ? "#1552F0" : look.color,
                          "&:hover": { bgcolor: st === "free" ? "#DDF5E4" : undefined }, "&.Mui-disabled": { color: look.color },
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{s.slot_id}</span>
                        <span style={{ fontSize: 11 }}>{st === "used" ? s.tro_id : look.text}</span>
                      </Button>
                    </span>
                  </Tooltip>
                );
              })}
            </Box>
          </>
        )}
        <TextField fullWidth size="small" label="ชื่อหัวหน้าส่วน (ถ้ามี)" value={leader} onChange={(e) => setLeader(e.target.value)} sx={{ mt: 2 }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mr: "auto" }}>
          {csId ? `${roomName} · ${slotId === null ? "ช่องว่างช่องแรก" : `ช่อง ${slotId}`}` : "ยังไม่ได้เลือกห้อง"}
        </Typography>
        <Button onClick={onClose} disabled={busy}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !csId} startIcon={busy ? <CircularProgress size={16} /> : null}>
          ยืนยันรับเข้า
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LargeCheckinDialog;
