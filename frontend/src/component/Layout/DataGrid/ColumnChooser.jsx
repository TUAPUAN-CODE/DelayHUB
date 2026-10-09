import { useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, Tab, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import SearchIcon from "@mui/icons-material/Search";

/** Dialog "ตั้งค่าคอลัมน์ที่แสดง": tick the columns and tools to show. `extra` is page specific settings: a node (shown on top) or an array of pages [{ key, label, node }] that become tabs next to the column list. */
const ColumnChooser = ({ open, onClose, columns, groups, visible, onChange, onReset, storage, warning, extra, pins = [], onPinsChange }) => {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(0);
  const pages = Array.isArray(extra) ? extra : null;
  const set = useMemo(() => new Set(visible), [visible]);
  const pinSet = useMemo(() => new Set(pins), [pins]);
  const pinnedWidth = useMemo(() => columns.filter((c) => pinSet.has(c.key) && set.has(c.key)).reduce((sum, c) => sum + (c.width || 100), 0), [columns, pinSet, set]);
  const togglePin = (key) => {
    if (!onPinsChange) return;
    const next = new Set(pinSet);
    if (next.has(key)) next.delete(key); else next.add(key);
    onPinsChange(columns.filter((c) => next.has(c.key)).map((c) => c.key));
  };

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
      {pages && (
        <Tabs value={Math.min(tab, pages.length)} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ px: 2, borderBottom: "1px solid #E3E9F6" }}>
          <Tab label="1. จัดการคอลัมน์ที่จะแสดง / tool ต่างๆ" sx={{ textTransform: "none", fontWeight: 600 }} />
          {pages.map((p, i) => <Tab key={p.key} label={`${i + 2}. ${p.label}`} sx={{ textTransform: "none", fontWeight: 600 }} />)}
        </Tabs>
      )}
      {pages && tab > 0 && pages[tab - 1] ? (
        <DialogContent dividers sx={{ minHeight: "55vh" }}>{pages[tab - 1].node}</DialogContent>
      ) : (
      <DialogContent dividers sx={pages ? { minHeight: "55vh" } : undefined}>
        {warning && <Alert severity="warning" sx={{ mb: 1.5 }}>{warning}</Alert>}
        {!warning && storage === "server" && <Alert severity="success" sx={{ mb: 1.5 }}>บันทึกตามบัญชีของคุณในฐานข้อมูลแล้ว (ใช้ได้ทุกเครื่อง)</Alert>}
        {!pages && extra}
        {onPinsChange && (
          <Alert severity={pinnedWidth > 900 ? "warning" : "info"} sx={{ mb: 1.5 }}>
            ไอคอนหมุด <PushPinIcon sx={{ fontSize: 15, verticalAlign: "text-bottom" }} /> = ตรึงคอลัมน์ไว้ทางซ้าย (ไม่เลื่อนตามเมื่อเลื่อนดูคอลัมน์อื่น) · ตรึงอยู่ {pins.length} คอลัมน์ กว้างรวมประมาณ {pinnedWidth}px
            {pinnedWidth > 900 ? " — กว้างมาก อาจเหลือที่ให้ดูคอลัมน์อื่นน้อย" : ""}
          </Alert>
        )}
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
                  <Box key={c.key} sx={{ display: "flex", alignItems: "center" }}>
                    <FormControlLabel sx={{ m: 0, flex: 1 }} control={<Checkbox size="small" checked={set.has(c.key)} onChange={() => toggle(c.key)} />} label={<span style={{ fontSize: 13 }}>{c.label}</span>} />
                    {onPinsChange && (
                      <Tooltip title={pinSet.has(c.key) ? "ยกเลิกการตรึง" : "ตรึงไว้ทางซ้าย"} arrow>
                        <IconButton size="small" onClick={() => togglePin(c.key)} sx={{ color: pinSet.has(c.key) ? "#1552F0" : "#B0BAC9" }}>
                          {pinSet.has(c.key) ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })}
      </DialogContent>
      )}
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button color="inherit" onClick={onReset}>คืนค่าเริ่มต้น</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={onClose}>เสร็จสิ้น</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ColumnChooser;
