import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import ReplayIcon from "@mui/icons-material/Replay";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";

const fmtKg = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString("th-TH", { maximumFractionDigits: 2 }) : "-");
const fmtAt = (v) => {
  if (!v) return "-";
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
};

/**
 * "ใส่รถเข็น" of a production plan that has material back from a cold room (or the oven) waiting for "กลับมาเตรียม"
 * (GET /api/prep/plan/pending-return): ask first which one it is.
 *   that material  -> "กลับมาเตรียมรายการนี้" = the same form as the button of its own row: the cold-room history goes along
 *   new material   -> "ใส่รถเข็นใหม่จากแผน" = the usual form of the plan (a plan can still go into several trolleys)
 * pending: rows of the API (mapping_id, tro_id, weight_RM, out_cold_at, rm_status …)
 */
const PendingReturnDialog = ({ plan, pending, onReturn, onNewCart, onClose }) => (
  <Dialog open onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle sx={{ fontSize: 17 }}>แผนนี้มีวัตถุดิบที่กลับมา รอกลับมาเตรียม</DialogTitle>
    <DialogContent dividers>
      <Typography sx={{ fontSize: 13.5, color: "#6B7489", mb: 1 }}>
        {[plan.mat_name || plan.mat, plan.production || plan.code, plan.batch && `Batch ${plan.batch}`].filter(Boolean).join(" · ")}
      </Typography>
      {pending.map((x) => (
        <Box key={x.mapping_id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 1, borderBottom: "1px solid #EEF2F9", flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              รายการ {x.mapping_id} · รถเข็นเดิม {x.tro_id || "-"} · {fmtKg(x.weight_RM)} kg
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: "#6B7489" }}>
              ออกห้องเย็น {fmtAt(x.out_cold_at)} · {x.rm_status || "-"}{x.stay_place ? ` · ${x.stay_place}` : ""}
            </Typography>
          </Box>
          <Button variant="contained" color="secondary" size="small" startIcon={<ReplayIcon />} onClick={() => onReturn(x)}>กลับมาเตรียมรายการนี้</Button>
        </Box>
      ))}
      <Alert severity="info" sx={{ mt: 2 }}>
        ถ้าเป็นของที่ออกห้องเย็นกลับมา กด &quot;กลับมาเตรียม&quot; ที่รายการนั้น (เก็บประวัติเข้า/ออกห้องเย็น)
        <br />
        ถ้าเป็นวัตถุดิบส่วนใหม่ที่ยังไม่เคยเข้าห้องเย็น กด &quot;ใส่รถเข็นใหม่จากแผน&quot;
      </Alert>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>ยกเลิก</Button>
      <Button variant="outlined" startIcon={<AddShoppingCartIcon />} onClick={onNewCart}>ใส่รถเข็นใหม่จากแผน</Button>
    </DialogActions>
  </Dialog>
);

export default PendingReturnDialog;
