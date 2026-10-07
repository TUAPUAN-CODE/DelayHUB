import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment,
  LinearProgress, TextField, Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { AddShoppingCart as AddShoppingCartIcon } from "@mui/icons-material";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : "-");
const textOf = (m) => [m.mat_name, m.mat, m.batch, m.tro_id, m.production, m.slot_id, m.cs_name].filter(Boolean).join(" ").toLowerCase();

/**
 * "จัดชุดวัตถุดิบ": put materials from other trolleys of the cold rooms into THIS trolley.
 * One dialog instead of the two old steps: the list is grouped by source trolley (tick a whole trolley at once), the right side keeps the
 * selection with the weight to move (full weight by default) and one button moves everything. The API call per material is the same as before
 * (PUT /api/coldstorage/addRawMatToTrolley).
 */
const GatherMaterialsDialog = ({ open, onClose, currentTroId, currentSlotId, onSuccess }) => {
  const compact = useMediaQuery("(max-width:900px)");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [term, setTerm] = useState("");
  const [room, setRoom] = useState("all");
  const [picked, setPicked] = useState({});        // mapping_id -> weight to move (string)
  const [openGroups, setOpenGroups] = useState({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failed, setFailed] = useState([]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await axios.get(`${API_URL}/api/coldstorage/fetchAvailableRawMaterials`, { params: { current_tro_id: currentTroId } });
      if (!res.data?.success) throw new Error(res.data?.error || "โหลดรายการไม่สำเร็จ");
      setItems(res.data.data ?? []);
    } catch (err) {
      console.error("โหลดวัตถุดิบในห้องเย็นไม่สำเร็จ:", err);
      setError(err.response?.data?.error || err.message || "โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [currentTroId]);

  useEffect(() => { if (open) { setPicked({}); setFailed([]); setProgress({ done: 0, total: 0 }); setTerm(""); setRoom("all"); void load(); } }, [open, load]);

  const rooms = useMemo(() => {
    const m = new Map();
    items.forEach((i) => m.set(i.cs_id ?? "?", i.cs_name || `ห้อง ${i.cs_id}`));
    return [...m.entries()];
  }, [items]);

  const groups = useMemo(() => {
    const t = term.trim().toLowerCase();
    const map = new Map();
    items.forEach((i) => {
      if (room !== "all" && String(i.cs_id) !== String(room)) return;
      if (t && !textOf(i).includes(t)) return;
      const g = map.get(i.tro_id) ?? { tro_id: i.tro_id, slot_id: i.slot_id, cs_name: i.cs_name, rows: [] };
      g.rows.push(i);
      map.set(i.tro_id, g);
    });
    return [...map.values()].sort((a, b) => String(a.tro_id).localeCompare(String(b.tro_id)));
  }, [items, term, room]);

  const byId = useMemo(() => new Map(items.map((i) => [i.mapping_id, i])), [items]);
  const selected = useMemo(() => Object.keys(picked).map((k) => byId.get(Number(k)) ?? byId.get(k)).filter(Boolean), [picked, byId]);

  const toggleRow = (row) => setPicked((p) => {
    const n = { ...p };
    if (n[row.mapping_id] !== undefined) delete n[row.mapping_id]; else n[row.mapping_id] = String(row.weight_RM);
    return n;
  });
  const toggleGroup = (g) => setPicked((p) => {
    const n = { ...p };
    const all = g.rows.every((r) => n[r.mapping_id] !== undefined);
    g.rows.forEach((r) => { if (all) delete n[r.mapping_id]; else if (n[r.mapping_id] === undefined) n[r.mapping_id] = String(r.weight_RM); });
    return n;
  });
  const selectAllShown = () => setPicked((p) => {
    const n = { ...p };
    groups.forEach((g) => g.rows.forEach((r) => { if (n[r.mapping_id] === undefined) n[r.mapping_id] = String(r.weight_RM); }));
    return n;
  });

  const weightError = (row) => {
    const w = parseFloat(picked[row.mapping_id]);
    if (!picked[row.mapping_id]) return "ใส่น้ำหนัก";
    if (Number.isNaN(w)) return "ต้องเป็นตัวเลข";
    if (w <= 0) return "ต้องมากกว่า 0";
    if (w > parseFloat(row.weight_RM)) return `เกิน (มี ${fmt(parseFloat(row.weight_RM))})`;
    return "";
  };
  const hasError = selected.some((r) => weightError(r));
  const totalWeight = selected.reduce((s, r) => s + (parseFloat(picked[r.mapping_id]) || 0), 0);

  const run = async (rows) => {
    setRunning(true); setFailed([]); setProgress({ done: 0, total: rows.length });
    const bad = []; let ok = 0;
    for (const row of rows) {
      try {
        const res = await axios.put(`${API_URL}/api/coldstorage/addRawMatToTrolley`, {
          source_tro_id: row.tro_id, target_tro_id: currentTroId, weight: parseFloat(picked[row.mapping_id]), slot_id: currentSlotId,
          rmfp_id: row.rmfp_id, mix_code: row.mix_code, mapping_id: row.mapping_id, isMixed: row.isMixed || false,
        });
        if (!res.data?.success) throw new Error(res.data?.error || "ไม่สำเร็จ");
        ok += 1;
        setPicked((p) => { const n = { ...p }; delete n[row.mapping_id]; return n; });
      } catch (err) {
        bad.push({ row, message: err.response?.data?.error || err.message || "ไม่สำเร็จ" });
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setFailed(bad); setRunning(false);
    if (ok > 0) { onSuccess?.(ok); await load(); }
    if (bad.length === 0) onClose();
  };

  return (
    <Dialog open={open} onClose={running ? undefined : onClose} fullWidth maxWidth="xl" fullScreen={compact}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <AddShoppingCartIcon sx={{ color: "#1552F0" }} />
        <span>จัดชุดวัตถุดิบ</span>
        <Chip icon={<LocalShippingIcon />} label={`รวมเข้ารถเข็น ${currentTroId}`} color="primary" variant="outlined" />
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} disabled={running}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, display: "flex", flexDirection: compact ? "column" : "row", minHeight: 420 }}>
        {/* source list */}
        <Box sx={{ flex: 1.4, minWidth: 0, p: 2, borderRight: compact ? 0 : "1px solid #E3E8F2", overflow: "auto" }}>
          <TextField fullWidth size="small" placeholder="ค้นหา: วัตถุดิบ / Batch / รถเข็น / แผนผลิต / ช่องจอด" value={term} onChange={(e) => setTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", my: 1.5, alignItems: "center" }}>
            <Chip size="small" label="ทุกห้อง" clickable color={room === "all" ? "primary" : "default"} onClick={() => setRoom("all")} />
            {rooms.map(([id, name]) => <Chip key={id} size="small" label={name} clickable color={String(room) === String(id) ? "primary" : "default"} onClick={() => setRoom(id)} />)}
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={selectAllShown} disabled={!groups.length}>เลือกทั้งหมดที่เห็น</Button>
          </Box>
          {loading && <Box sx={{ display: "grid", placeItems: "center", py: 6 }}><CircularProgress /></Box>}
          {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>ลองใหม่</Button>}>{error}</Alert>}
          {!loading && !error && groups.length === 0 && <Typography sx={{ color: "#6B7489", py: 4, textAlign: "center" }}>ไม่พบวัตถุดิบ</Typography>}
          {groups.map((g) => {
            const n = g.rows.filter((r) => picked[r.mapping_id] !== undefined).length;
            const open = openGroups[g.tro_id] ?? Boolean(term.trim());
            return (
              <Box key={g.tro_id} sx={{ border: "1px solid #E3E8F2", borderRadius: 2, mb: 1, overflow: "hidden", bgcolor: n ? "#F5F8FF" : "#fff" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.5 }}>
                  <Tooltip title="เลือกทั้งรถเข็น"><Checkbox size="small" checked={n === g.rows.length} indeterminate={n > 0 && n < g.rows.length} onChange={() => toggleGroup(g)} /></Tooltip>
                  <Box sx={{ flex: 1, cursor: "pointer" }} onClick={() => setOpenGroups((o) => ({ ...o, [g.tro_id]: !open }))}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>รถเข็น {g.tro_id}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#6B7489" }}>{g.cs_name ? `${g.cs_name} · ` : ""}ช่อง {g.slot_id ?? "-"} · {g.rows.length} รายการ{n ? ` · เลือก ${n}` : ""}</Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setOpenGroups((o) => ({ ...o, [g.tro_id]: !open }))}><ExpandMoreIcon sx={{ transform: open ? "rotate(180deg)" : "none", transition: ".2s" }} /></IconButton>
                </Box>
                <Collapse in={open} unmountOnExit>
                  {g.rows.map((r) => (
                    <Box key={r.mapping_id} onClick={() => toggleRow(r)} sx={{ display: "flex", alignItems: "center", gap: 1, pl: 2, pr: 1.5, py: 0.5, borderTop: "1px dashed #E3E8F2", cursor: "pointer", "&:hover": { bgcolor: "#F5F8FF" } }}>
                      <Checkbox size="small" checked={picked[r.mapping_id] !== undefined} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 500 }} noWrap>{r.mat_name}</Typography>
                        <Typography sx={{ fontSize: 12, color: "#6B7489" }} noWrap>{r.isMixed ? "ผสม" : `Batch ${r.batch || "-"}`} · {r.production}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{fmt(parseFloat(r.weight_RM))} kg</Typography>
                    </Box>
                  ))}
                </Collapse>
              </Box>
            );
          })}
        </Box>

        {/* selection */}
        <Box sx={{ flex: 1, minWidth: 0, p: 2, bgcolor: "#FAFBFF", overflow: "auto" }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>ที่เลือกไว้ ({selected.length} รายการ · {fmt(totalWeight)} kg)</Typography>
          {selected.length === 0 && <Typography sx={{ color: "#6B7489", fontSize: 13 }}>ติ๊กวัตถุดิบหรือทั้งรถเข็นทางซ้าย น้ำหนักที่ย้ายตั้งต้นเป็นน้ำหนักทั้งหมด แก้ได้ที่นี่</Typography>}
          {selected.map((r) => {
            const err = weightError(r);
            return (
              <Box key={r.mapping_id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.75, borderBottom: "1px solid #EEF2F9" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 500 }} noWrap>{r.mat_name}</Typography>
                  <Typography sx={{ fontSize: 12, color: "#6B7489" }} noWrap>จากรถเข็น {r.tro_id} · มี {fmt(parseFloat(r.weight_RM))} kg</Typography>
                </Box>
                <TextField size="small" value={picked[r.mapping_id]} error={Boolean(err)} helperText={err || " "} onChange={(e) => setPicked((p) => ({ ...p, [r.mapping_id]: e.target.value }))}
                  sx={{ width: 110, "& .MuiFormHelperText-root": { mt: 0.25, fontSize: 11 } }} inputProps={{ inputMode: "decimal" }}
                  InputProps={{ endAdornment: <InputAdornment position="end">kg</InputAdornment> }} />
                <IconButton size="small" onClick={() => toggleRow(r)} disabled={running}><CloseIcon fontSize="small" /></IconButton>
              </Box>
            );
          })}
          {running && <Box sx={{ mt: 2 }}><LinearProgress variant="determinate" value={progress.total ? (progress.done / progress.total) * 100 : 0} /><Typography sx={{ fontSize: 12, mt: 0.5 }}>กำลังย้าย {progress.done}/{progress.total}</Typography></Box>}
          {failed.length > 0 && (
            <Alert severity="error" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={() => run(failed.map((f) => f.row))}>ลองใหม่</Button>}>
              ย้ายไม่สำเร็จ {failed.length} รายการ
              {failed.map((f) => <div key={f.row.mapping_id} style={{ fontSize: 12 }}>• {f.row.mat_name} (รถเข็น {f.row.tro_id}): {f.message}</div>)}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={running}>ปิด</Button>
        <Button variant="contained" startIcon={<LocalShippingIcon />} disabled={!selected.length || hasError || running} onClick={() => run(selected)}>
          รวมเข้ารถเข็น {currentTroId} ({selected.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GatherMaterialsDialog;
