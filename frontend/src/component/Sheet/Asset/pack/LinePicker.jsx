import { useEffect, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";

const API_URL = import.meta.env.VITE_API_URL;
const ALL_LINES = "1001"; // line_type "All Line": returns every line

/**
 * The line of this packing tablet (localStorage "line_id", kept across logins: it belongs to the device).
 * Replaces the "select line" page after login: the packing Role now opens the Sheet straight away and picks / changes its line here.
 * Only the tools that need a line (trolley list, add trolley) ask for it.
 */
const LinePicker = ({ lineId, onChange }) => {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await axios.get(`${API_URL}/api/linetype/line`, { params: { line_type_id: ALL_LINES } });
        setLines(res.data.data ?? []);
      } catch (err) {
        console.error("[LinePicker] fetch lines error:", err);
        setError("โหลดรายการไลน์ไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const current = lines.find((l) => String(l.line_id) === String(lineId));
  const pick = (id) => { onChange(id); setOpen(false); };

  return (
    <>
      <Chip
        icon={<PlaceOutlinedIcon />} clickable onClick={() => setOpen(true)}
        color={lineId ? "secondary" : "default"} variant={lineId ? "filled" : "outlined"}
        label={lineId ? `ไลน์: ${current?.line_name || lineId}` : "เลือกไลน์"}
      />
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>เลือกไลน์ของเครื่องนี้</DialogTitle>
        <DialogContent>
          {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress /></Box>}
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 1, mt: 1.5 }}>
            {lines.map((l) => (
              <Button key={l.line_id} variant={String(l.line_id) === String(lineId) ? "contained" : "outlined"} onClick={() => pick(String(l.line_id))} sx={{ minHeight: 48 }}>
                {l.line_name}
              </Button>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          {lineId && <Button color="inherit" onClick={() => pick("")}>ไม่ระบุไลน์</Button>}
          <Button onClick={() => setOpen(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LinePicker;
