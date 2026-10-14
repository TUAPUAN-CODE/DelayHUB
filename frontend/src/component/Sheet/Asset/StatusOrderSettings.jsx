import { Box, Button, IconButton, Typography } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { STATUS_LIST } from "./statusZones";

// ลำดับสถานะบนแถบเหนือตาราง: ตั้งค่าได้ต่อบัญชี (ext.statusOrder) — สถานะที่ไม่อยู่ในรายการจะต่อท้าย
const StatusOrderSettings = ({ ext, setExt }) => {
  const base = STATUS_LIST.map(([label]) => label);
  const saved = (ext.statusOrder || []).filter((l) => base.includes(l));
  const order = [...saved, ...base.filter((l) => !saved.includes(l))];
  const move = (i, dir) => {
    const next = [...order];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setExt({ statusOrder: next });
  };
  return (
    <Box sx={{ mb: 2, p: 1.5, border: "1px solid #E3E9F6", borderRadius: 2, background: "#F8FAFF" }}>
      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>ลำดับสถานะบนแถบเหนือตาราง (ขึ้นก่อน → ขึ้นหลัง)</Typography>
      {order.map((label, i) => (
        <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.25 }}>
          <Typography sx={{ minWidth: 28, color: "text.secondary" }}>{i + 1}.</Typography>
          <Typography sx={{ flex: 1 }}>{label}</Typography>
          <IconButton size="small" aria-label="ขึ้น" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton>
          <IconButton size="small" aria-label="ลง" disabled={i === order.length - 1} onClick={() => move(i, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton>
        </Box>
      ))}
      <Button size="small" sx={{ mt: 1 }} onClick={() => setExt({ statusOrder: [] })}>คืนค่าลำดับเริ่มต้น</Button>
    </Box>
  );
};

export default StatusOrderSettings;
