import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import { fetchSlots, roomName } from "./coldApi";

/** Slots grouped like the old room pages: column = first character of slot_id, row = the rest. */
const buildGrid = (slots) => {
  const cols = [...new Set(slots.map((s) => String(s.slot_id)[0]))].sort();
  const rows = {};
  slots.forEach((s) => {
    const id = String(s.slot_id);
    (rows[id.slice(1)] ||= {})[id[0]] = s;
  });
  const rowKeys = Object.keys(rows).sort((a, b) => (Number(a) - Number(b)) || a.localeCompare(b));
  return { cols, rows, rowKeys };
};

const stateOf = (slot) => {
  if (!slot.tro_id) return "free";
  if (slot.tro_id === "rsrv") return "reserved";
  return "used";
};

/**
 * Pick a room and a free slot. Replaces the per-room pages of check-in and move.
 * onPick({ cs_id, slot_id })
 */
const SlotPickerDialog = ({ open, title, subtitle, currentSlot, onPick, onClose }) => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [room, setRoom] = useState(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true); setError("");
    fetchSlots()
      .then((data) => { if (alive) setSlots(data.filter((s) => s.slot_status)); })
      .catch((err) => { console.error("โหลดช่องจอดไม่สำเร็จ:", err); if (alive) setError("โหลดช่องจอดไม่สำเร็จ"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open]);

  const rooms = useMemo(() => [...new Set(slots.map((s) => s.cs_id))].sort((a, b) => a - b), [slots]);
  useEffect(() => { if (rooms.length && !rooms.includes(room)) setRoom(currentSlot?.cs_id && rooms.includes(currentSlot.cs_id) ? currentSlot.cs_id : rooms[0]); }, [rooms, room, currentSlot]);
  const free = useMemo(() => Object.fromEntries(rooms.map((r) => [r, slots.filter((s) => s.cs_id === r && !s.tro_id).length])), [rooms, slots]);
  const grid = useMemo(() => buildGrid(slots.filter((s) => s.cs_id === room)), [slots, room]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {title}
        {subtitle && <Typography sx={{ fontSize: 13, color: "#6B7489", fontWeight: 400 }}>{subtitle}</Typography>}
      </DialogTitle>
      <DialogContent dividers sx={{ minHeight: 320 }}>
        {loading && <Box sx={{ display: "grid", placeItems: "center", py: 8 }}><CircularProgress /></Box>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!loading && rooms.length > 0 && (
          <>
            <Tabs value={room ?? false} onChange={(_, v) => setRoom(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
              {rooms.map((r) => <Tab key={r} value={r} label={`${roomName(r)} · ว่าง ${free[r]}`} />)}
            </Tabs>
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: `48px repeat(${grid.cols.length}, minmax(86px, 1fr))`, minWidth: 48 + grid.cols.length * 90 }}>
                <Box />
                {grid.cols.map((c) => <Typography key={c} align="center" sx={{ fontWeight: 600, color: "#6B7489" }}>{c}</Typography>)}
                {grid.rowKeys.map((rk) => (
                  <Box key={rk} sx={{ display: "contents" }}>
                    <Typography sx={{ fontWeight: 600, color: "#6B7489", alignSelf: "center" }}>{rk}</Typography>
                    {grid.cols.map((c) => {
                      const slot = grid.rows[rk]?.[c];
                      if (!slot) return <Box key={c} />;
                      const st = stateOf(slot);
                      const isCurrent = currentSlot && slot.cs_id === currentSlot.cs_id && slot.slot_id === currentSlot.slot_id;
                      const disabled = st !== "free";
                      return (
                        <Tooltip key={c} title={st === "used" ? `รถเข็น ${slot.tro_id}` : st === "reserved" ? "กำลังมีคนจองช่องนี้" : "ว่าง"}>
                          <span>
                            <Button
                              fullWidth disabled={disabled} onClick={() => onPick({ cs_id: slot.cs_id, slot_id: slot.slot_id })}
                              sx={{
                                height: 54, borderRadius: 2, flexDirection: "column", lineHeight: 1.2, border: "1px solid",
                                borderColor: isCurrent ? "#1552F0" : st === "free" ? "#BFE8C9" : "#E3E8F2",
                                bgcolor: st === "free" ? "#F0FBF3" : st === "reserved" ? "#FFF8E6" : "#F5F7FB",
                                color: st === "free" ? "#16A34A" : "#9AA3B5",
                                "&:hover": { bgcolor: st === "free" ? "#DDF5E4" : undefined },
                                "&.Mui-disabled": { color: "#9AA3B5" },
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{slot.slot_id}</span>
                              <span style={{ fontSize: 11 }}>{st === "free" ? "ว่าง" : st === "reserved" ? "จองอยู่" : slot.tro_id}</span>
                            </Button>
                          </span>
                        </Tooltip>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        )}
        {!loading && !error && rooms.length === 0 && <Typography sx={{ color: "#6B7489" }}>ไม่พบช่องจอด</Typography>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>ยกเลิก</Button></DialogActions>
    </Dialog>
  );
};

export default SlotPickerDialog;
