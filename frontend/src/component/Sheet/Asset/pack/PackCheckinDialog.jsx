import { useState } from "react";
import axios from "axios";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

const operatorName = () => [localStorage.getItem("first_name"), localStorage.getItem("last_name")].filter((v) => v && v !== "null").join(" ");
const errText = (err) => err.response?.data?.error || err.response?.data?.message || err.message || "Check In ไม่สำเร็จ";

/**
 * Pack "Check In" of a trolley in ONE step (before: trolley number -> details -> confirm, three dialogs):
 * the materials on the trolley are listed, "ยืนยัน Check In" sends PUT /api/checkin/pack — they go to บรรจุ off the trolley ("รอบรรจุเสร็จ")
 * and the trolley is free again. Mounted once per opening.
 * row = the row whose button was pressed · rows = every row of the Sheet (the other materials of the same trolley)
 */
const PackCheckinDialog = ({ row, rows, onClose, onDone }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const onTrolley = rows.filter((r) => r.__kind === "map" && r.tro_id && String(r.tro_id) === String(row.tro_id));
  const list = onTrolley.length ? onTrolley : [row];
  const total = list.reduce((s, r) => s + (Number(r.weight_RM) || 0), 0);

  const confirm = async () => {
    setSaving(true);
    setError("");
    try {
      await axios.put(`${API_URL}/api/checkin/pack`, { tro_id: row.tro_id, operator: operatorName() });
      onDone(`Check In รถเข็น ${row.tro_id} แล้ว — ${list.length} รายการไปที่ "รอบรรจุเสร็จ"`);
    } catch (err) {
      console.error("[PackCheckinDialog] check-in error:", err);
      setError(errText(err));
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={() => { if (!saving) onClose(); }} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LocalShippingOutlinedIcon sx={{ color: "#6A1B9A" }} />
        Check In รถเข็น {row.tro_id}
      </DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ mb: 1, color: "#6B7489", fontSize: 14 }}>
          วัตถุดิบบนรถเข็นนี้ {list.length} รายการ · รวม {total.toLocaleString("th-TH", { maximumFractionDigits: 2 })} kg — ยืนยันแล้วจะไปที่สถานะ &quot;รอบรรจุเสร็จ&quot; และรถเข็นว่าง
        </Typography>
        <Box sx={{ border: "1px solid #E3E9F6", borderRadius: 1, overflow: "auto", maxHeight: 360 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ "& th": { whiteSpace: "nowrap" } }}>
                <TableCell>รายการ</TableCell><TableCell>วัตถุดิบ</TableCell><TableCell>Batch</TableCell>
                <TableCell>แผนผลิต</TableCell><TableCell>ไลน์</TableCell><TableCell align="right">น้ำหนัก (kg)</TableCell><TableCell>สถานะวัตถุดิบ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.mapping_id ?? r.__key}>
                  <TableCell>{r.mapping_id}</TableCell>
                  <TableCell>{r.mat_name || r.mat || "-"}</TableCell>
                  <TableCell>{r.batch_after || r.batch || "-"}</TableCell>
                  <TableCell>{r.code || "-"}</TableCell>
                  <TableCell>{r.rmm_line_name || "-"}</TableCell>
                  <TableCell align="right">{r.weight_RM ?? "-"}</TableCell>
                  <TableCell>{r.rm_status || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>ยกเลิก</Button>
        <Button variant="contained" onClick={confirm} disabled={saving} sx={{ minWidth: 160 }}>{saving ? "กำลังบันทึก..." : "ยืนยัน Check In"}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PackCheckinDialog;
