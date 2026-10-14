import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, LinearProgress, TextField, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { AddShoppingCart as AddShoppingCartIcon } from "@mui/icons-material";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : "-");

/**
 * "จัดชุด" from the Master Sheet: the rows ticked in the table (materials that are in a cold room) are put into ONE trolley that is in a cold room.
 * The dialog asks for the weight of every ticked material (full weight by default) and the target trolley, then moves them one by one with the
 * same call as the old Room page (PUT /api/coldstorage/addRawMatToTrolley).
 *
 * rows      the ticked mapping rows of the Sheet
 * trolleys  trolleys that are in a cold room: [{ tro_id, slot_id, cs_name }]
 */
const GatherSelected = ({ open, onClose, rows, trolleys, onDone }) => {
  const [target, setTarget] = useState(null);
  const [weights, setWeights] = useState({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failed, setFailed] = useState([]);

  useEffect(() => {
    if (!open) return;
    setTarget(null); setFailed([]); setProgress({ done: 0, total: 0 });
    setWeights(Object.fromEntries(rows.map((r) => [r.mapping_id, String(r.weight_RM)])));
  }, [open, rows]);

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
  const hasError = rows.some((r) => weightError(r));
  const total = useMemo(() => rows.reduce((s, r) => s + (parseFloat(weights[r.mapping_id]) || 0), 0), [rows, weights]);

  const run = async (list) => {
    setRunning(true); setFailed([]); setProgress({ done: 0, total: list.length });
    const bad = []; let ok = 0;
    for (const r of list) {
      try {
        const res = await axios.put(`${API_URL}/api/coldstorage/addRawMatToTrolley`, {
          source_tro_id: r.tro_id, target_tro_id: target.tro_id, weight: parseFloat(weights[r.mapping_id]), slot_id: target.slot_id,
          rmfp_id: r.rmfp_id, mix_code: r.mix_code, mapping_id: r.mapping_id, isMixed: Boolean(r.mix_code),
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
    <Dialog open={open} onClose={running ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <AddShoppingCartIcon sx={{ color: "#1552F0" }} />
        <span>จัดชุดวัตถุดิบ</span>
        <Chip size="small" label={`${rows.length} รายการ · ${fmt(total)} kg`} color="primary" variant="outlined" />
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} disabled={running}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Autocomplete
          options={trolleys} value={target} onChange={(_, v) => setTarget(v)} disabled={running}
          getOptionLabel={(o) => `รถเข็น ${o.tro_id} · ${o.cs_name || "ห้องเย็น"} · ช่อง ${o.slot_id ?? "-"}`}
          isOptionEqualToValue={(a, b) => a.tro_id === b.tro_id}
          noOptionsText="ไม่พบรถเข็นที่อยู่ในห้องเย็น"
          renderInput={(params) => (
            <TextField {...params} label="รถเข็นปลายทาง (รถเข็นที่อยู่ในห้องเย็น)" size="small" autoFocus
              InputProps={{ ...params.InputProps, startAdornment: (<><InputAdornment position="start"><LocalShippingIcon fontSize="small" /></InputAdornment>{params.InputProps.startAdornment}</>) }} />
          )}
        />
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
