import { Box, MenuItem, Select, TextField, Typography } from "@mui/material";
import { stageDbsIndex } from "./dbs";

// colorMode: "stage" = the DBS of the stage the row is in (default) · 0..3 = always that DBS (DBS1..DBS4) · -1 = no row colour
export const DEFAULT_EXT = { colorMode: "stage", greenPct: 50, yellowPct: 0, statusZones: {} };

export const colorFromDbs = (d, ext) => {
  if (!d || d.text === "-" || d.minutes === null || d.minutes === undefined || !d.std) return null;
  const remaining = ((d.std - d.minutes) / d.std) * 100;
  if (remaining > (ext?.greenPct ?? DEFAULT_EXT.greenPct)) return "green";
  if (remaining > (ext?.yellowPct ?? DEFAULT_EXT.yellowPct)) return "yellow";
  return "red";
};

/**
 * Row colour by delay: remaining time compared with the standard time of the DBS that applies to the row.
 *   remaining % > green%  -> green · remaining % > yellow% -> yellow · otherwise (used up / over the standard) -> red
 * Rows without any DBS value / standard (HU rows, rows waiting to be mixed) are not coloured. A row whose stage DBS has no value falls back to DBS4.
 */
export const rowColorOf = (row, ext) => {
  const mode = ext?.colorMode ?? DEFAULT_EXT.colorMode;
  if (mode === -1 || !row.__dbs?.length) return null;
  const idx = mode === "stage" ? stageDbsIndex(row) : Number(mode);
  return colorFromDbs(row.__dbs[idx], ext) ?? (mode === "stage" ? colorFromDbs(row.__dbs[3], ext) : null);
};

const ColorSettings = ({ ext, setExt }) => {
  const mode = ext.colorMode ?? DEFAULT_EXT.colorMode;
  const off = mode === -1;
  const num = (v, fallback) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
  return (
    <Box sx={{ mb: 2, p: 1.5, border: "1px solid #E3E9F6", borderRadius: 2, background: "#F8FAFF" }}>
      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>สีของแถว (เขียว / เหลือง / แดง) ตาม Delay</Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
        <Box>
          <Typography variant="caption" color="text.secondary">อ้างอิง</Typography>
          <Select size="small" fullWidth value={mode} onChange={(e) => setExt({ colorMode: e.target.value })}>
            <MenuItem value="stage">ตามขั้นตอนของแถว (แนะนำ)</MenuItem>
            <MenuItem value={-1}>ไม่ใส่สีแถว</MenuItem>
            <MenuItem value={0}>DBS1 เตรียม → ห้องเย็น</MenuItem>
            <MenuItem value={1}>DBS2 อยู่ห้องเย็น</MenuItem>
            <MenuItem value={2}>DBS3 ห้องเย็น → บรรจุ</MenuItem>
            <MenuItem value={3}>DBS4 รวม</MenuItem>
          </Select>
        </Box>
        <TextField size="small" type="number" label="เขียว เมื่อเหลือเวลา มากกว่า (%)" value={ext.greenPct ?? DEFAULT_EXT.greenPct} disabled={off}
          onChange={(e) => setExt({ greenPct: num(e.target.value, DEFAULT_EXT.greenPct) })} sx={{ width: 230 }} />
        <TextField size="small" type="number" label="เหลือง เมื่อเหลือเวลา มากกว่า (%)" value={ext.yellowPct ?? DEFAULT_EXT.yellowPct} disabled={off}
          onChange={(e) => setExt({ yellowPct: num(e.target.value, DEFAULT_EXT.yellowPct) })} sx={{ width: 230 }} />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        เวลาที่เหลือ = (มาตรฐานของกลุ่มวัตถุดิบ − เวลาที่ใช้จริง) ÷ มาตรฐาน · ต่ำกว่าเกณฑ์เหลือง (เช่น เกินมาตรฐานแล้ว) = แดง · ตามขั้นตอน: ก่อนเข้าห้องเย็น = DBS1 · อยู่ในห้องเย็น = DBS2 · ออกห้องเย็นแล้ว = DBS3 · เสร็จแล้ว = DBS4 · แถวที่ไม่มีค่า/มาตรฐานจะไม่ใส่สี
      </Typography>
    </Box>
  );
};

export default ColorSettings;
