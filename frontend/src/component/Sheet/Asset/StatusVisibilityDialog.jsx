import { Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { STATUS_LIST, ZONES } from "./statusZones";
import { KNOWN_STATUSES, defaultStatuses } from "./statusVisibility";

/**
 * "สถานะที่ดู": which statuses this account wants in the table (saved per account and per page).
 * selected = labels that are shown · counts = Map(label -> rows loaded) · onChange(labels)
 */
const StatusVisibilityDialog = ({ open, onClose, role, selected, counts, onChange }) => {
  const on = new Set(selected);
  const toggle = (label) => {
    const next = new Set(on);
    if (next.has(label)) { if (next.size <= 1) return; next.delete(label); } else next.add(label); // at least one status stays
    onChange(KNOWN_STATUSES.filter((l) => next.has(l)));
  };
  const zones = ZONES.filter((z) => STATUS_LIST.some(([l, zid]) => zid === z.id && l !== "Done"));
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <span>สถานะที่ต้องการดู</span>
        <Chip size="small" color="primary" variant="outlined" label={`${selected.length}/${KNOWN_STATUSES.length}`} />
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
          เลือกสถานะที่ต้องการให้แสดงในตารางของคุณ (บันทึกต่อบัญชี) ค่าเริ่มต้นแสดงเฉพาะสถานะที่เกี่ยวข้องกับพื้นที่นี้ เพื่อให้ตารางโหลดและเลื่อนเร็วขึ้น
        </Typography>
        {zones.map((z) => (
          <Box key={z.id} sx={{ mb: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.25, display: "flex", alignItems: "center", gap: 0.75 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: z.dot, display: "inline-block" }} />{z.title}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 2 }}>
              {STATUS_LIST.filter(([l, zid]) => zid === z.id && l !== "Done").map(([label]) => (
                <FormControlLabel key={label} sx={{ mr: 0 }}
                  control={<Checkbox size="small" checked={on.has(label)} onChange={() => toggle(label)} />}
                  label={<span style={{ fontSize: 13.5 }}>{label === "-" ? "ไม่มีสถานะ (-)" : label}<span style={{ color: "#8A94AB", marginLeft: 6 }}>{counts?.get(label) ? `(${counts.get(label)})` : ""}</span></span>} />
              ))}
            </Box>
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        <Button onClick={() => onChange(KNOWN_STATUSES)}>เลือกทั้งหมด</Button>
        <Button onClick={() => onChange(defaultStatuses(role))}>ค่าเริ่มต้นของพื้นที่นี้</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={onClose}>ปิด</Button>
      </DialogActions>
    </Dialog>
  );
};

export default StatusVisibilityDialog;
