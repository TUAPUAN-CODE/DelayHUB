import { Autocomplete, Box, Button, Chip, IconButton, TextField, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import { AREA_PALETTE, STATUS_LIST, allAreas, zonesOf } from "./statusZones";

/**
 * Column settings: the areas and which areas every status is listed in. Saved per account:
 *   ext.statusAreas = [{ id, title, color, bg, dot }]  (areas added by the account)
 *   ext.statusZones = { [status]: [areaId, ...] }       (only the statuses that differ from the default)
 */
const StatusZoneSettings = ({ ext, setExt }) => {
  const own = ext.statusZones || {};
  const custom = ext.statusAreas || [];
  const areas = allAreas(ext);

  const addArea = () => {
    const pal = AREA_PALETTE[custom.length % AREA_PALETTE.length];
    setExt({ statusAreas: [...custom, { id: `a${Date.now().toString(36)}`, title: `พื้นที่ใหม่ ${custom.length + 1}`, ...pal }] });
  };
  const renameArea = (id, title) => setExt({ statusAreas: custom.map((a) => (a.id === id ? { ...a, title } : a)) });
  const removeArea = (id) => {
    const next = {};
    Object.entries(own).forEach(([label, v]) => { const ids = (Array.isArray(v) ? v : [v]).filter((x) => x !== id); if (ids.length) next[label] = ids; });
    setExt({ statusAreas: custom.filter((a) => a.id !== id), statusZones: next });
  };
  const changeStatus = (label, list) => {
    const ids = list.map((a) => a.id);
    const next = { ...own };
    const def = zonesOf(label, { ...ext, statusZones: {} }).map((a) => a.id);
    if (!ids.length || (ids.length === def.length && ids.every((id, i) => id === def[i]))) delete next[label]; else next[label] = ids;
    setExt({ statusZones: next });
  };

  return (
    <Box sx={{ p: 1.5, border: "1px solid #E3E9F6", borderRadius: 2, background: "#F8FAFF" }}>
      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>สถานะอยู่ในพื้นที่ไหน (ใช้เรียงลำดับและแบ่งสีในเมนูสถานะ)</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        เพิ่มพื้นที่ของคุณเองได้ · หนึ่งสถานะอยู่ได้หลายพื้นที่ (จะแสดงในเมนูสถานะใต้ทุกพื้นที่ที่เลือก สีของชิปใช้พื้นที่แรก)
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 1.5 }}>
        {areas.map((a) => (
          <Box key={a.id} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {a.custom ? (
              <>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: a.bg, flexShrink: 0 }} />
                <TextField size="small" value={a.title} onChange={(e) => renameArea(a.id, e.target.value)} sx={{ width: 190, "& input": { py: "5px", fontSize: 13 } }} />
                <IconButton size="small" color="error" title="ลบพื้นที่นี้" onClick={() => removeArea(a.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
              </>
            ) : (
              <span style={{ background: a.bg, color: a.color, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{a.title}</span>
            )}
          </Box>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={addArea}>เพิ่มพื้นที่</Button>
        <Box sx={{ flex: 1 }} />
        <Button size="small" disabled={!Object.keys(own).length} onClick={() => setExt({ statusZones: {} })}>คืนค่าเริ่มต้นของสถานะ</Button>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1 }}>
        {STATUS_LIST.map(([label]) => {
          const zs = zonesOf(label, ext);
          return (
            <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <span style={{ background: zs[0].bg, color: zs[0].color, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600, minWidth: 120, textAlign: "center", whiteSpace: "nowrap" }}>{label}</span>
              <Autocomplete
                multiple disableClearable size="small" fullWidth options={areas} value={zs} getOptionLabel={(a) => a.title} isOptionEqualToValue={(a, b) => a.id === b.id}
                onChange={(_, v) => changeStatus(label, v)}
                renderTags={(v, getProps) => v.map((a, i) => {
                  const { key, ...rest } = getProps({ index: i });
                  return <Chip key={key} size="small" label={a.title} {...rest} sx={{ background: a.bg, color: a.color, "& .MuiChip-deleteIcon": { color: a.color, opacity: 0.8 } }} />;
                })}
                renderInput={(p) => <TextField {...p} />}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default StatusZoneSettings;
