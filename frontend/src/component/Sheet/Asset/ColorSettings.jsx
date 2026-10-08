import { Box, MenuItem, Select, TextField, Typography } from "@mui/material";

export const DEFAULT_EXT = { colorDbs: 3, greenPct: 50, yellowPct: 0 };

/**
 * Row colour by delay: remaining time compared with the standard time of the DBS the account picked.
 *   remaining % > green%  -> green · remaining % > yellow% -> yellow · otherwise (used up / over the standard) -> red
 * Rows whose DBS has no value or no standard yet are not coloured.
 */
export const rowColorOf = (row, ext) => {
  const idx = ext?.colorDbs ?? DEFAULT_EXT.colorDbs;
  if (idx < 0) return null;
  const d = row.__dbs?.[idx];
  if (!d || d.text === "-" || d.minutes === null || d.minutes === undefined || !d.std) return null;
  const remaining = ((d.std - d.minutes) / d.std) * 100;
  if (remaining > (ext?.greenPct ?? DEFAULT_EXT.greenPct)) return "green";
  if (remaining > (ext?.yellowPct ?? DEFAULT_EXT.yellowPct)) return "yellow";
  return "red";
};

const ColorSettings = ({ ext, setExt }) => {
  const dbs = ext.colorDbs ?? DEFAULT_EXT.colorDbs;
  const num = (v, fallback) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
  return (
    <Box sx={{ mb: 2, p: 1.5, border: "1px solid #E3E9F6", borderRadius: 2, background: "#F8FAFF" }}>
      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>สีของแถว (เขียว / เหลือง / แดง) ตาม Delay</Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
        <Box>
          <Typography variant="caption" color="text.secondary">อ้างอิง</Typography>
          <Select size="small" fullWidth value={dbs} onChange={(e) => setExt({ colorDbs: e.target.value })}>
            <MenuItem value={-1}>ไม่ใส่สีแถว</MenuItem>
            <MenuItem value={0}>DBS1 เตรียม → ห้องเย็น</MenuItem>
            <MenuItem value={1}>DBS2 อยู่ห้องเย็น</MenuItem>
            <MenuItem value={2}>DBS3 ห้องเย็น → บรรจุ</MenuItem>
            <MenuItem value={3}>DBS4 รวม</MenuItem>
          </Select>
        </Box>
        <TextField size="small" type="number" label="เขียว เมื่อเหลือเวลา มากกว่า (%)" value={ext.greenPct ?? DEFAULT_EXT.greenPct} disabled={dbs < 0}
          onChange={(e) => setExt({ greenPct: num(e.target.value, DEFAULT_EXT.greenPct) })} sx={{ width: 230 }} />
        <TextField size="small" type="number" label="เหลือง เมื่อเหลือเวลา มากกว่า (%)" value={ext.yellowPct ?? DEFAULT_EXT.yellowPct} disabled={dbs < 0}
          onChange={(e) => setExt({ yellowPct: num(e.target.value, DEFAULT_EXT.yellowPct) })} sx={{ width: 230 }} />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        เวลาที่เหลือ = (มาตรฐานของกลุ่มวัตถุดิบ − เวลาที่ใช้จริง) ÷ มาตรฐาน · ต่ำกว่าเกณฑ์เหลือง (เช่น เกินมาตรฐานแล้ว) = แดง · แถวที่ DBS นั้นยังไม่มีค่า/ไม่มีมาตรฐานจะไม่ใส่สี
      </Typography>
    </Box>
  );
};

export default ColorSettings;
