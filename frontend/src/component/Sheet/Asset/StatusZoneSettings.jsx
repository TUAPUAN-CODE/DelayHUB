import { Box, Button, MenuItem, Select, Typography } from "@mui/material";
import { STATUS_LIST, ZONES, zoneOf } from "./statusZones";

/** Column settings: which area (zone) every status belongs to. Saved per account in ext.statusZones = { [status]: zoneId } (only the changed ones). */
const StatusZoneSettings = ({ ext, setExt }) => {
  const own = ext.statusZones || {};
  const change = (label, id) => {
    const next = { ...own };
    const def = zoneOf(label, null).id;
    if (id === def) delete next[label]; else next[label] = id;
    setExt({ statusZones: next });
  };
  return (
    <Box sx={{ mb: 2, p: 1.5, border: "1px solid #E3E9F6", borderRadius: 2, background: "#F8FAFF" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>สถานะอยู่ในพื้นที่ไหน (ใช้เรียงลำดับและแบ่งสีในเมนูสถานะ)</Typography>
        <Button size="small" disabled={!Object.keys(own).length} onClick={() => setExt({ statusZones: {} })}>คืนค่าเริ่มต้น</Button>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
        {STATUS_LIST.map(([label]) => {
          const z = zoneOf(label, own);
          return (
            <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <span style={{ background: z.bg, color: z.color, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600, minWidth: 120, textAlign: "center", whiteSpace: "nowrap" }}>{label}</span>
              <Select size="small" fullWidth value={z.id} onChange={(e) => change(label, e.target.value)} sx={{ fontSize: 13 }}>
                {ZONES.map((o) => <MenuItem key={o.id} value={o.id}>{o.title}</MenuItem>)}
              </Select>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default StatusZoneSettings;
