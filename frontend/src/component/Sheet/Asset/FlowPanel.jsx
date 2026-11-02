import { useEffect, useState } from "react";
import axios from "axios";
import { Alert, Box, Chip, CircularProgress, Link, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { STAGES_CK, STAGES_TUNA, STAGE_BUTTON, parseStages } from "./flowStages";

const API_URL = import.meta.env.VITE_API_URL;
const fmt = (v) => (v ? String(v).slice(0, 16).replace("T", " ") : "-");
const mins = (a, b) => { const x = new Date(String(a).replace(" ", "T")).getTime(); const y = new Date(String(b).replace(" ", "T")).getTime(); return Number.isNaN(x) || Number.isNaN(y) ? null : Math.round((y - x) / 60000); };
const dur = (m) => (m === null ? "-" : `${Math.floor(m / 60)} h ${m % 60} m`);

/**
 * The whole story of one flow item of Tuna scrap / CK bone (page "ค้นหา mapping_id", search "F<number>"): the time of every step (table FlowStage),
 * how long each step took, and the mappings made from it. GET /api/sheet/flow
 * `rmfpId` = the number after the F · `flowStages` (optional) = the steps already on a mapping row, shown while the server answers.
 */
const FlowPanel = ({ rmfpId, onOpenMapping }) => {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: "", data: null });
    axios.get(`${API_URL}/api/sheet/flow`, { params: { rmfp_id: rmfpId } })
      .then((res) => { if (alive) setState({ loading: false, error: "", data: res.data }); })
      .catch((err) => { console.error("[FlowPanel] load error:", err); if (alive) setState({ loading: false, error: err.response?.data?.error || err.message || "โหลดไม่สำเร็จ", data: null }); });
    return () => { alive = false; };
  }, [rmfpId]);

  if (state.loading) return <Box sx={{ p: 2 }}><CircularProgress size={22} /></Box>;
  if (state.error) return <Alert severity="error" sx={{ mb: 2 }}>{state.error}</Alert>;
  const { plan, stages = [], mappings = [] } = state.data || {};
  if (!plan) return <Alert severity="error" sx={{ mb: 2 }}>ไม่พบข้อมูลเลขรายการ Flow นี้</Alert>;
  const hasPetfood = plan.cs_to_freeze !== null;
  const order = hasPetfood ? STAGES_TUNA : STAGES_CK;
  const stamps = parseStages(stages.map((s) => `${s.stage}|${s.at}`).join(","));
  const by = Object.fromEntries(stages.map((s) => [s.stage, s.created_by]));
  const rows = [{ key: "start", label: hasPetfood ? "อบเสร็จ" : "เตรียมเสร็จ CK bone", at: plan.cooked_date, by: null }, ...order.map((k) => ({ key: k, label: STAGE_BUTTON[k], at: stamps[k], by: by[k] }))];

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{plan.mat_name || plan.mat}</Typography>
        <Chip size="small" color="primary" label={`เลขรายการ Flow F${plan.rmfp_id}`} />
        <Chip size="small" label={plan.rm_group_name} />
      </Box>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>
        {[plan.mat && `Mat ${plan.mat}`, plan.batch && `Batch ${plan.batch}`, plan.hu && `HU ${plan.hu}`, plan.weight !== null && plan.weight !== undefined && `${plan.weight} kg`].filter(Boolean).join(" · ")}
      </Typography>
      <Table size="small" sx={{ mt: 1.5 }}>
        <TableHead><TableRow><TableCell>ขั้นตอน</TableCell><TableCell>เวลา</TableCell><TableCell>ใช้เวลาจากขั้นก่อน</TableCell><TableCell>บันทึกโดย</TableCell></TableRow></TableHead>
        <TableBody>
          {rows.map((r, i) => {
            const prev = i > 0 ? rows[i - 1].at : null;
            return (
              <TableRow key={r.key}>
                <TableCell sx={{ fontWeight: 600 }}>{r.label}</TableCell>
                <TableCell sx={{ fontFamily: "ui-monospace,monospace", color: r.at ? "inherit" : "#B0B8C9" }}>{fmt(r.at)}</TableCell>
                <TableCell>{r.at && prev ? dur(mins(prev, r.at)) : "-"}</TableCell>
                <TableCell>{r.by || "-"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Typography sx={{ fontSize: 13.5, fontWeight: 700, mt: 2 }}>รายการ (mapping) ที่สร้างจากรายการนี้</Typography>
      {mappings.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>ยังไม่ได้ใส่รถเข็น (จะใส่ได้หลังออก Freeze ครั้งที่ 2)</Typography>
      ) : mappings.map((m) => (
        <Typography key={m.mapping_id} sx={{ fontSize: 13.5 }}>
          <Link component="button" onClick={() => onOpenMapping(m.mapping_id)} sx={{ fontWeight: 700 }}>{`mapping_id ${m.mapping_id}`}</Link>
          {` · รถเข็น ${m.tro_id || "-"} · ${m.rm_status || "-"} · ${m.dest || "-"}`}
        </Typography>
      ))}
    </Paper>
  );
};

export default FlowPanel;
