import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, LinearProgress, MenuItem, TextField, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { AddShoppingCart as AddShoppingCartIcon } from "@mui/icons-material";

axios.defaults.withCredentials = true;
import { isHiddenRoom } from "../../../ColdStorage/RoomTableSupervisor/Asset/flow/coldApi";
const API_URL = import.meta.env.VITE_API_URL;

const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : "-");

/**
 * "จัดชุด" from the Master Sheet: the rows ticked in the table (materials that are in a cold room) are put into ONE trolley that is in a cold room.
 * The dialog asks for the weight of every ticked material (full weight by default) and the target trolley, then moves them one by one with the
 * same call as the old Room page (PUT /api/coldstorage/addRawMatToTrolley).
 *
 * The target can also be an EMPTY trolley of the system that is not in a cold room yet: it is put into the first free slot of the chosen room first
 * (PUT /api/coldstorage/gather/assignEmptyTrolley), so the gathered materials show up as "อยู่ในห้องเย็น".
 *
 * Only one Code (doc_no of the plan) and one line go into a set: the ticked materials and what is already in the target trolley must match
 * (the server checks it again: same_plan).
 *
 * Mounted once per opening (key): the rows are the ticked rows as they were when it opened, so the table reloading meanwhile
 * (somebody else saved) does not reset the chosen trolley or the typed weights.
 *
 * rows      the ticked mapping rows of the Sheet
 * trolleys  trolleys that are in a cold room: [{ tro_id, slot_id, cs_name, contents: [{ mapping_id, code, line }] }]
 * role      "cs1" (cold rooms) | "cs2" (large cold rooms): which rooms / slots the empty trolleys may go to
 */
const GROUP_IN_ROOM = "อยู่ในห้องเย็น";
const GROUP_EMPTY = "รถเข็นว่างที่ยังไม่อยู่ในห้องเย็น";

const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim().toUpperCase();
const planOf = (r) => ({ code: String(r.doc_no ?? "").trim(), line: String(r.rmm_line_name ?? "").trim() });
const planKey = (p) => `${norm(p.code)}|${norm(p.line)}`;
const planText = (p) => `Code ${p.code || "-"} · ไลน์ ${p.line || "-"}`;
const diffText = (a, b) => [norm(a.code) !== norm(b.code) && "คนละ Code", norm(a.line) !== norm(b.line) && "คนละไลน์"].filter(Boolean).join(" และ ");

/** what is already in the trolley with another Code / line than the set (null when it fits) */
const otherPlanIn = (trolley, plan, moving) => (trolley?.contents || []).find((c) => !moving.has(String(c.mapping_id)) && planKey(c) !== planKey(plan)) || null;

const GatherSelected = ({ onClose, rows, trolleys, role, onDone }) => {
  const [target, setTarget] = useState(null);
  const [targets, setTargets] = useState({ inRoom: [], free: [], rooms: [] }); // from GET /coldstorage/gather/targets
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [roomId, setRoomId] = useState("");
  const [weights, setWeights] = useState(() => Object.fromEntries(rows.map((r) => [r.mapping_id, String(r.weight_RM)])));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failed, setFailed] = useState([]);

  // empty trolleys of the system + the rooms that still have a free slot;
  // the room of the ticked materials is the room that is offered first for an empty trolley
  useEffect(() => {
    let cancel = false;
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/coldstorage/gather/targets`, { params: { v: role === "cs2" ? 2 : 1 } });
        if (cancel || !res.data?.success) return;
        // /coldStorage does not offer 4C and ห้อง 10 - 46 (same rule as its slot layout)
        const data = role === "cs1" ? { ...res.data.data, rooms: (res.data.data.rooms || []).filter((x) => !isHiddenRoom(x.cs_id)) } : res.data.data;
        setTargets(data);
        const own = rows.find((r) => data.rooms.some((x) => x.cs_id === r.cs_id))?.cs_id;
        setRoomId((cur) => (cur !== "" ? cur : own ?? data.rooms[0]?.cs_id ?? ""));
      } catch (err) {
        console.error("[Sheet] จัดชุด targets error:", err);
      } finally {
        if (!cancel) setLoadingTargets(false);
      }
    };
    load();
    return () => { cancel = true; };
  }, [rows, role]);

  // trolleys in a cold room (with materials) · empty trolleys that are already in a slot · empty trolleys that are not in a cold room yet
  const options = useMemo(() => {
    const seen = new Set();
    const list = [];
    const add = (o) => { if (!seen.has(String(o.tro_id))) { seen.add(String(o.tro_id)); list.push(o); } };
    trolleys.forEach((t) => add({ ...t, group: GROUP_IN_ROOM }));
    targets.inRoom.forEach((t) => add({ tro_id: t.tro_id, slot_id: t.slot_id, cs_name: t.cs_name, group: GROUP_IN_ROOM, empty: true }));
    targets.free.forEach((t) => add({ tro_id: t.tro_id, group: GROUP_EMPTY, isFree: true }));
    return list;
  }, [trolleys, targets]);

  const weightError = (r) => {
    const raw = weights[r.mapping_id];
    const w = parseFloat(raw);
    if (!raw) return "ใส่น้ำหนัก";
    if (Number.isNaN(w)) return "ต้องเป็นตัวเลข";
    if (w <= 0) return "ต้องมากกว่า 0";
    if (w > parseFloat(r.weight_RM)) return `เกิน (มี ${fmt(parseFloat(r.weight_RM))})`;
    if (target && String(r.tro_id) === String(target.tro_id)) return "อยู่ในรถเข็นนี้แล้ว";
    return "";
  };
  const freeRoom = targets.rooms.find((x) => x.cs_id === roomId);
  const roomError = target?.isFree && !freeRoom ? "ไม่มีห้องเย็นที่มีช่องว่าง" : "";

  // one Code and one line per set: the ticked materials among themselves, then with what is already in the target trolley
  const moving = useMemo(() => new Set(rows.map((r) => String(r.mapping_id))), [rows]);
  const plans = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const p = planOf(r);
      const g = m.get(planKey(p)) ?? { ...p, count: 0 };
      g.count += 1;
      m.set(planKey(p), g);
    });
    return [...m.values()];
  }, [rows]);
  const setPlan = plans.length === 1 ? plans[0] : null;
  // the target as it is now in the table (its contents follow the reloads)
  const liveTarget = target && !target.isFree ? options.find((o) => String(o.tro_id) === String(target.tro_id)) || target : target;
  const targetOther = setPlan && liveTarget ? otherPlanIn(liveTarget, setPlan, moving) : null;
  let planError = "";
  if (plans.length > 1) {
    planError = `วัตถุดิบที่เลือก${diffText(plans[0], plans.find((p) => planKey(p) !== planKey(plans[0])))} — จัดชุดได้เฉพาะวัตถุดิบ Code และไลน์เดียวกัน`;
  } else if (targetOther) {
    planError = `รถเข็น ${liveTarget.tro_id} มีวัตถุดิบ ${planText(targetOther)} อยู่แล้ว — ${diffText(targetOther, setPlan)} กับวัตถุดิบที่เลือก (${planText(setPlan)})`;
  }
  const hasError = rows.some((r) => weightError(r)) || Boolean(roomError) || Boolean(planError);

  // tablet: the trolley number typed in the box (not picked from the list) is lost when the box loses focus — take it when it is one trolley
  const pickTyped = (e) => {
    const typed = String(e.target?.value ?? "").trim();
    if (!typed || running) return;
    const exact = options.filter((o) => String(o.tro_id) === typed);
    const hits = exact.length ? exact : options.filter((o) => String(o.tro_id).includes(typed));
    if (hits.length === 1 && String(hits[0].tro_id) !== String(target?.tro_id ?? "")) setTarget(hits[0]);
  };
  const total = useMemo(() => rows.reduce((s, r) => s + (parseFloat(weights[r.mapping_id]) || 0), 0), [rows, weights]);

  const run = async (list) => {
    setRunning(true); setFailed([]); setProgress({ done: 0, total: list.length });
    const bad = []; let ok = 0;
    let dest = target;
    if (dest.isFree) {
      // an empty trolley that is not in a cold room: put it into a free slot of the room first (the same trolley is then an ordinary trolley of the room)
      try {
        const res = await axios.put(`${API_URL}/api/coldstorage/gather/assignEmptyTrolley`, { tro_id: dest.tro_id, cs_id: roomId });
        if (!res.data?.success) throw new Error(res.data?.error || "ไม่สำเร็จ");
        dest = { tro_id: dest.tro_id, slot_id: res.data.data.slot_id, cs_name: res.data.data.cs_name, group: GROUP_IN_ROOM };
        setTarget(dest);
      } catch (err) {
        console.error("[Sheet] จัดชุด assign empty trolley error:", err);
        setFailed(list.map((r) => ({ row: r, message: err.response?.data?.error || err.message || "นำรถเข็นว่างเข้าห้องเย็นไม่สำเร็จ" })));
        setRunning(false);
        return;
      }
    }
    for (const r of list) {
      try {
        const res = await axios.put(`${API_URL}/api/coldstorage/addRawMatToTrolley`, {
          source_tro_id: r.tro_id, target_tro_id: dest.tro_id, weight: parseFloat(weights[r.mapping_id]), slot_id: dest.slot_id,
          rmfp_id: r.rmfp_id, mix_code: r.mix_code, mapping_id: r.mapping_id, isMixed: Boolean(r.mix_code), same_plan: true,
        });
        if (!res.data?.success) throw new Error(res.data?.error || "ไม่สำเร็จ");
        ok += 1;
      } catch (err) {
        console.error("[Sheet] จัดชุด error:", err);
        bad.push({ row: r, message: err.response?.data?.error || err.message || "ไม่สำเร็จ" });
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setFailed(bad); setRunning(false);
    if (ok > 0) onDone?.(ok);
    if (bad.length === 0) onClose();
  };

  return (
    <Dialog open onClose={running ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <AddShoppingCartIcon sx={{ color: "#1552F0" }} />
        <span>จัดชุดวัตถุดิบ</span>
        <Chip size="small" label={`${rows.length} รายการ · ${fmt(total)} kg`} color="primary" variant="outlined" />
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} disabled={running}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Autocomplete
          options={options} value={target} onChange={(_, v) => setTarget(v)} disabled={running} loading={loadingTargets}
          autoHighlight onBlur={pickTyped}
          groupBy={(o) => o.group}
          getOptionLabel={(o) => (o.isFree ? `รถเข็น ${o.tro_id} · ว่าง` : `รถเข็น ${o.tro_id} · ${o.cs_name || "ห้องเย็น"} · ช่อง ${o.slot_id ?? "-"}${o.empty ? " · ว่าง" : ""}${setPlan && otherPlanIn(o, setPlan, moving) ? " · คนละ Code/ไลน์" : ""}`)}
          isOptionEqualToValue={(a, b) => String(a.tro_id) === String(b.tro_id)}
          noOptionsText="ไม่พบรถเข็น"
          renderInput={(params) => (
            <TextField {...params} label="รถเข็นปลายทาง (อยู่ในห้องเย็น หรือรถเข็นว่างในระบบ)" size="small" autoFocus
              InputProps={{ ...params.InputProps, startAdornment: (<><InputAdornment position="start"><LocalShippingIcon fontSize="small" /></InputAdornment>{params.InputProps.startAdornment}</>) }} />
          )}
        />
        {target?.isFree && (
          <Box sx={{ mt: 1.5 }}>
            <TextField select size="small" fullWidth label="ห้องเย็นที่จะนำรถเข็นว่างเข้า (ระบบเลือกช่องว่างให้อัตโนมัติ)" value={freeRoom ? roomId : ""} onChange={(e) => setRoomId(e.target.value)} disabled={running} error={Boolean(roomError)} helperText={roomError || " "}>
              {targets.rooms.map((x) => <MenuItem key={x.cs_id} value={x.cs_id}>{x.cs_name} · ช่องว่าง {x.free_slots}</MenuItem>)}
            </TextField>
          </Box>
        )}
        {planError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {planError}
            {plans.length > 1 && plans.map((p) => <div key={planKey(p)} style={{ fontSize: 12 }}>• {planText(p)}: {p.count} รายการ</div>)}
          </Alert>
        )}
        <Typography sx={{ fontWeight: 600, mt: 2, mb: 0.5 }}>น้ำหนักที่จะย้ายของแต่ละวัตถุดิบ</Typography>
        {rows.map((r) => {
          const err = weightError(r);
          return (
            <Box key={r.mapping_id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.75, borderBottom: "1px solid #EEF2F9" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 500 }} noWrap>{r.mat_name || r.mat || `รายการ ${r.mapping_id}`}</Typography>
                <Typography sx={{ fontSize: 12, color: "#6B7489" }} noWrap>
                  รายการ {r.mapping_id} · จากรถเข็น {r.tro_id} · {r.cs_name || ""} ช่อง {r.slot_id ?? "-"} · Batch {r.batch_after || r.batch || "-"} · มี {fmt(parseFloat(r.weight_RM))} kg
                </Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: plans.length > 1 ? "#B42318" : "#344054" }} noWrap>{planText(planOf(r))}</Typography>
              </Box>
              <TextField
                size="small" value={weights[r.mapping_id] ?? ""} error={Boolean(err)} helperText={err || " "} disabled={running}
                onChange={(e) => setWeights((w) => ({ ...w, [r.mapping_id]: e.target.value }))}
                sx={{ width: 130, "& .MuiFormHelperText-root": { mt: 0.25, fontSize: 11 } }} inputProps={{ inputMode: "decimal" }}
                InputProps={{ endAdornment: <InputAdornment position="end">kg</InputAdornment> }}
              />
            </Box>
          );
        })}
        {running && <Box sx={{ mt: 2 }}><LinearProgress variant="determinate" value={progress.total ? (progress.done / progress.total) * 100 : 0} /><Typography sx={{ fontSize: 12, mt: 0.5 }}>กำลังย้าย {progress.done}/{progress.total}</Typography></Box>}
        {failed.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={() => run(failed.map((f) => f.row))}>ลองใหม่</Button>}>
            ย้ายไม่สำเร็จ {failed.length} รายการ
            {failed.map((f) => <div key={f.row.mapping_id} style={{ fontSize: 12 }}>รายการ {f.row.mapping_id}: {f.message}</div>)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={running}>ยกเลิก</Button>
        <Button variant="contained" disabled={running || !target || hasError || !rows.length} onClick={() => run(rows)}>จัดชุด ({rows.length})</Button>
      </DialogActions>
    </Dialog>
  );
};

export default GatherSelected;
