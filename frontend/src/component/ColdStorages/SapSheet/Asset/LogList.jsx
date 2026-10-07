import { Box, Typography } from "@mui/material";
import { STAMP_LABEL } from "./sapApi";

// plain-language log of what was just done / why it was refused
const LogList = ({ log, filterKind, max = 30 }) => {
  const items = (log || []).filter((l) => !filterKind || l.kind === filterKind).slice(0, max);
  if (!items.length) {
    return <Typography variant="body2" color="text.secondary">ยังไม่มีรายการ</Typography>;
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      {items.map((l) => (
        <Box
          key={l.id}
          sx={{
            display: "flex", gap: 1.25, alignItems: "flex-start", p: "6px 10px", borderRadius: "10px", fontSize: 13.5,
            background: l.ok ? "#ECFDF5" : "#FEF2F2", border: `1px solid ${l.ok ? "#A7F3D0" : "#FECACA"}`,
          }}
        >
          <span style={{ fontWeight: 700, color: l.ok ? "#047857" : "#B91C1C", minWidth: 62 }}>{l.ok ? "สำเร็จ" : "ไม่สำเร็จ"}</span>
          <span style={{ color: "#6B7489", minWidth: 48 }}>{l.time}</span>
          <span style={{ flex: 1 }}>
            <b>{STAMP_LABEL[l.kind]}</b>{l.hu ? ` · HU ${l.hu}` : ""} — {l.text}
          </span>
        </Box>
      ))}
    </Box>
  );
};

export default LogList;
