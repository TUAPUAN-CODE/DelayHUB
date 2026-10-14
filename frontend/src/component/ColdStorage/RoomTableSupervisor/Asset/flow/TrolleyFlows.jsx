import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import SlotPickerDialog from "./SlotPickerDialog";
import { announceSlot, checkinOptionOf, checkinTrolley, fetchSlots, moveTrolley, releaseSlot, reserveSlot, roomName } from "./coldApi";

/**
 * The two actions that used to be separate pages: check a trolley in to a cold room, and move it to another slot.
 * The page opens them through the ref:  ref.current.checkin(row) · ref.current.move(row)
 * `rows` = every row of the table (to list the other materials on the same trolley). `onDone` reloads the table.
 */
const TrolleyFlows = forwardRef(function TrolleyFlows({ rows, onDone }, ref) {
  const [flow, setFlow] = useState(null);        // { kind: 'checkin' | 'move', row }
  const [target, setTarget] = useState(null);    // { cs_id, slot_id } chosen in the picker
  const [option, setOption] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const tro = flow?.row?.tro_id;
  const sameTrolley = useMemo(() => (tro ? rows.filter((r) => r.tro_id === tro) : []), [rows, tro]);
  const options = useMemo(() => [...new Set(sameTrolley.map((r) => checkinOptionOf(r.rm_status)).filter(Boolean))], [sameTrolley]);

  const reset = useCallback(() => { setFlow(null); setTarget(null); setOption(null); setError(""); setBusy(false); }, []);
  useImperativeHandle(ref, () => ({
    checkin: (row) => { reset(); setFlow({ kind: "checkin", row }); },
    move: (row) => { reset(); setFlow({ kind: "move", row }); },
  }), [reset]);

  const cancelConfirm = async () => {
    if (target && flow?.kind === "checkin") await releaseSlot(target);   // give the held slot back
    setTarget(null); setOption(null); setError("");
  };

  const pick = async (slot) => {
    setError(""); setBusy(true);
    try {
      if (flow.kind === "checkin") {
        await reserveSlot(slot);
        setOption(options.length === 1 ? options[0] : null);
      } else {
        // the existing move API only receives the slot id: refuse when the same id exists in more than one room
        const all = await fetchSlots();
        if (all.filter((s) => s.slot_id === slot.slot_id).length > 1) throw new Error(`รหัสช่อง ${slot.slot_id} ซ้ำกันหลายห้อง ระบบย้ายเดิมระบุห้องไม่ได้ จึงไม่อนุญาตให้ย้ายจากหน้านี้`);
      }
      setTarget(slot);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true); setError("");
    try {
      if (flow.kind === "checkin") {
        await checkinTrolley({ tro_id: tro, ...target, selectedOption: option });
      } else {
        await moveTrolley({ tro_id: tro, new_slot_id: target.slot_id });
        if (flow.row.cs_id && flow.row.slot_id) announceSlot({ cs_id: flow.row.cs_id, slot_id: flow.row.slot_id });
      }
      announceSlot(target);
      reset();
      onDone?.();
    } catch (err) {
      if (flow.kind === "checkin") await releaseSlot(target);
      setError(err.message);
      setTarget(null);
      setBusy(false);
    }
  };

  const picking = flow && !target;
  const confirming = flow && target;
  const isCheckin = flow?.kind === "checkin";

  return (
    <>
      <SlotPickerDialog
        open={Boolean(picking)}
        title={isCheckin ? `รับเข้าห้องเย็น — เลือกห้องและช่องจอดให้รถเข็น ${tro}` : `ย้ายรถเข็น ${tro} — เลือกช่องจอดใหม่`}
        subtitle={error || undefined}
        currentSlot={isCheckin ? null : { cs_id: flow?.row?.cs_id, slot_id: flow?.row?.slot_id }}
        onPick={pick}
        onClose={reset}
      />

      <Dialog open={Boolean(confirming)} fullWidth maxWidth="xs" onClose={(_, reason) => { if (reason !== "backdropClick" && !busy) { void cancelConfirm(); reset(); } }}>
        <DialogTitle>{isCheckin ? "ยืนยันรับเข้าห้องเย็น" : "ยืนยันย้ายช่องจอด"}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 1, columnGap: 1, fontSize: 14 }}>
            <Typography color="text.secondary">ป้ายทะเบียน</Typography><Typography fontWeight={600}>{tro}</Typography>
            {!isCheckin && <><Typography color="text.secondary">ช่องเดิม</Typography><Typography>{flow?.row?.cs_name ? `${flow.row.cs_name} · ` : ""}{flow?.row?.slot_id}</Typography></>}
            <Typography color="text.secondary">{isCheckin ? "ช่องที่เลือก" : "ช่องใหม่"}</Typography>
            <Typography fontWeight={600}>{target ? `${roomName(target.cs_id)} · ${target.slot_id}` : ""}</Typography>
            {isCheckin && (
              <>
                <Typography color="text.secondary">ประเภทรับเข้า</Typography>
                {options.length > 1 ? (
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {options.map((o) => <Chip key={o} label={o} clickable color={o === option ? "primary" : "default"} onClick={() => setOption(o)} />)}
                  </Box>
                ) : <Typography>{option || "ไม่พบประเภทที่รองรับ"}</Typography>}
              </>
            )}
          </Box>
          <Typography sx={{ mt: 2, mb: 0.5, fontSize: 13, color: "#6B7489" }}>วัตถุดิบบนรถเข็นคันนี้ ({sameTrolley.length} รายการ)</Typography>
          <Box sx={{ maxHeight: 160, overflow: "auto", border: "1px solid #E3E8F2", borderRadius: 2 }}>
            {sameTrolley.map((r) => (
              <Box key={r.mapping_id} sx={{ px: 1.5, py: 0.75, borderBottom: "1px solid #EEF2F9", fontSize: 13 }}>
                <b>{r.mat_name}</b> <span style={{ color: "#6B7489" }}>· {r.batch} · {r.weight_RM ?? "-"} kg</span>
              </Box>
            ))}
          </Box>
          {isCheckin && !option && <Alert severity="warning" sx={{ mt: 2 }}>สถานะวัตถุดิบบนรถเข็นนี้ไม่ตรงกับประเภทรับเข้าที่ระบบรองรับ</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={async () => { await cancelConfirm(); reset(); }}>ยกเลิก</Button>
          <Button variant="contained" disabled={busy || (isCheckin && !option)} onClick={confirm} startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}>ยืนยัน</Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

export default TrolleyFlows;
