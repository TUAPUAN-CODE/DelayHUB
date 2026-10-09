import { Autocomplete, Box, Button, Chip, IconButton, TextField, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import { LINE_PALETTE } from "./lineGroups";

/** Column settings: which production lines belong to which group and who looks after them. Saved per account in ext.lineGroups. */
const LineGroupSettings = ({ ext, setExt, lines }) => {
  const groups = ext.lineGroups || [];
  const save = (next) => setExt({ lineGroups: next });
  const patch = (id, change) => save(groups.map((g) => (g.id === id ? { ...g, ...change } : g)));
  const add = () => save([...groups, { id: `g${Date.now().toString(36)}`, name: `กลุ่มที่ ${groups.length + 1}`, owners: [], lines: [] }]);
  const used = new Set(groups.flatMap((g) => g.lines || []));
  const free = lines.filter((l) => !used.has(l));
  const knownOwners = [...new Set(groups.flatMap((g) => g.owners || []))];

  return (
    <Box sx={{ p: 1.5, border: "1px solid #E3E9F6", borderRadius: 2, background: "#F8FAFF" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>ไลน์นี้ใครดูแล (ใช้จัดกลุ่มและแบ่งสีในเมนูคอลัมน์ "ไลน์")</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={add}>เพิ่มกลุ่ม</Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        ตั้งชื่อกลุ่ม ใส่รายชื่อผู้ดูแล แล้วเลือกไลน์ที่อยู่ในกลุ่ม · ไลน์หนึ่งอยู่ได้กลุ่มเดียว · ในเมนูคอลัมน์ไลน์ กดที่ชื่อกลุ่มเพื่อเลือกทุกไลน์ในกลุ่มนั้น · ไลน์ที่ยังไม่จัดกลุ่ม ({free.length}) จะอยู่ท้ายสุด
      </Typography>
      {!groups.length && <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>ยังไม่มีกลุ่ม — กด "เพิ่มกลุ่ม"</Typography>}
      {groups.map((g, i) => {
        const pal = LINE_PALETTE[i % LINE_PALETTE.length];
        return (
          <Box key={g.id} sx={{ mb: 1.5, p: 1.25, borderRadius: 2, background: "#fff", border: `2px solid ${pal.bg}` }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: pal.bg, flexShrink: 0 }} />
              <TextField size="small" label="ชื่อกลุ่ม" value={g.name} onChange={(e) => patch(g.id, { name: e.target.value })} sx={{ width: 220 }} />
              <Box sx={{ flex: 1 }} />
              <IconButton size="small" color="error" title="ลบกลุ่มนี้" onClick={() => save(groups.filter((x) => x.id !== g.id))}><DeleteOutlineIcon fontSize="small" /></IconButton>
            </Box>
            <Autocomplete
              multiple freeSolo size="small" options={knownOwners.filter((o) => !(g.owners || []).includes(o))} value={g.owners || []}
              onChange={(_, v) => patch(g.id, { owners: v.map((x) => String(x).trim()).filter(Boolean) })}
              renderTags={(v, getProps) => v.map((o, idx) => { const { key, ...rest } = getProps({ index: idx }); return <Chip key={key} size="small" label={o} {...rest} />; })}
              renderInput={(p) => <TextField {...p} label="ผู้ดูแล (พิมพ์ชื่อแล้วกด Enter)" />} sx={{ mb: 1 }}
            />
            <Autocomplete
              multiple size="small" disableCloseOnSelect options={[...(g.lines || []), ...free].filter((v, idx, a) => a.indexOf(v) === idx)} value={g.lines || []}
              onChange={(_, v) => patch(g.id, { lines: v })}
              renderTags={(v, getProps) => v.map((o, idx) => { const { key, ...rest } = getProps({ index: idx }); return <Chip key={key} size="small" label={o} {...rest} />; })}
              renderInput={(p) => <TextField {...p} label={`ไลน์ในกลุ่มนี้ (${(g.lines || []).length})`} />}
            />
          </Box>
        );
      })}
    </Box>
  );
};

export default LineGroupSettings;
