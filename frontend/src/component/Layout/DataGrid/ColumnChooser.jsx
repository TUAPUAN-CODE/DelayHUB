import { useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, InputAdornment, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

/** Dialog "ตั้งค่าคอลัมน์ที่แสดง": tick the columns and tools to show. `extra` is page specific settings (e.g. row colours) shown on top. */
const ColumnChooser = ({ open, onClose, columns, groups, visible, onChange, onReset, storage, warning, extra }) => {
  const [q, setQ] = useState("");
  const set = useMemo(() => new Set(visible), [visible]);

  const byGroup = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups.map((g) => ({
      ...g,
      cols: columns.filter((c) => c.group === g.key && (!needle || c.label.toLowerCase().includes(needle) || c.key.toLowerCase().includes(needle))),
    })).filter((g) => g.cols.length);
  }, [q, columns, groups]);

  const emit = (next) => onChange(columns.filter((c) => next.has(c.key)).map((c) => c.key)); // keep the registry order
  const toggle = (key) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); emit(next); };
  const toggleGroup = (g, on) => { const next = new Set(set); g.cols.forEach((c) => (on ? next.add(c.key) : next.delete(c.key))); emit(next); };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: 18 }}>
        ตั้งค่าคอลัมน์ที่แสดง
        <Typography variant="body2" color="text.secondary">การตั้งค่านี้จำแยกตามบัญชีของคุณ</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {warning && <Alert severity="warning" sx={{ mb: 1.5 }}>{warning}</Alert>}
        {!warning && storage === "server" && <Alert severity="success" sx={{ mb: 1.5 }}>บันทึกตามบัญชีของคุณในฐานข้อมูลแล้ว (ใช้ได้ทุกเครื่อง)</Alert>}
        {extra}
        <TextField
          size="small" fullWidth placeholder="ค้นหาคอลัมน์..." value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 1.5 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        {byGroup.map((g) => {
          const on = g.cols.filter((c) => set.has(c.key)).length;
          return (
            <Box key={g.key} sx={{ mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <span style={{ width: 4, height: 16, borderRadius: 3, background: g.color }} />
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{g.label}</Typography>
                <Typography variant="caption" color="text.secondary">{on}/{g.cols.length}</Typography>
                <Box sx={{ flex: 1 }} />
                <Button size="small" onClick={() => toggleGroup(g, true)}>เลือกทั้งกลุ่ม</Button>
                <Button size="small" color="inherit" onClick={() => toggleGroup(g, false)}>ไม่เลือก</Button>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                {g.cols.map((c) => (
                  <FormControlLabel key={c.key} sx={{ m: 0 }} control={<Checkbox size="small" checked={set.has(c.key)} onChange={() => toggle(c.key)} />} label={<span style={{ fontSize: 13 }}>{c.label}</span>} />
                ))}
              </Box>
            </Box>
          );
        })}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button color="inherit" onClick={onReset}>คืนค่าเริ่มต้น</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={onClose}>เสร็จสิ้น</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ColumnChooser;
