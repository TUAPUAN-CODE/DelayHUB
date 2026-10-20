import { useEffect, useState } from "react";
import axios from "axios";
import {
  Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, TextField,
} from "@mui/material";

const API_URL = import.meta.env.VITE_API_URL;
const WEIGHT_RE = /^\d+(\.\d{1,2})?$/;
const errText = (err) => err.response?.data?.message || err.response?.data?.error || err.message || "แก้ไขไม่สำเร็จ";

/**
 * "แก้ไข Code / Line / น้ำหนัก" of a material in a cold room (status อยู่ในห้องเย็น / อยู่ในห้องเย็นใหญ่) — the same edit as "แก้ไขแผนการผลิต" of Pack:
 *   Code = the production plan "code (doc_no)" (every plan, like Pack) · Line = the lines of that plan's line type · ชื่อผู้อนุมัติ is required
 *   plan / line -> PUT /api/MatOnTrolley/updateProduction/pack (the History keeps the old and new plan with the approver; at most 3 plan edits)
 *   weight      -> PATCH /api/sheet/cold-edit (only while the trolley is in a cold room slot; refused when somebody changed it meanwhile; SheetEditLog)
 * Mounted once per opening (key): nothing typed is reset by the table reloading; a tap outside does not close it.
 */
const ColdEditDialog = ({ row, onClose, onSaved }) => {
  const mat = row.mat_id || row.mat;
  const [plans, setPlans] = useState([]);
  const [linesByType, setLinesByType] = useState({});
  const [plan, setPlan] = useState(null);
  const [line, setLine] = useState(null);
  const [weight, setWeight] = useState(() => (row.weight_RM === null || row.weight_RM === undefined ? "" : String(row.weight_RM)));
  const [editor, setEditor] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [prod, hist] = await Promise.all([
          axios.get(`${API_URL}/api/fetchProduction`, { params: { mat, all: 1 } }),
          axios.get(`${API_URL}/api/checkEditHistoryOnTrolley`, { params: { mapping_id: row.mapping_id } }).catch((err) => {
            console.error("[ColdEditDialog] edit history:", err);
            return null;
          }),
        ]);
        if (!alive) return;
        const list = prod.data?.success ? prod.data.data || [] : [];
        const byType = prod.data?.allLinesByType || {};
        setPlans(list);
        setLinesByType(byType);
        // start from the plan / line the row has now: only what is changed is saved
        const cur = list.find((p) => String(p.prod_id) === String(row.prod_id ?? "")) || null;
        setPlan(cur);
        setLine(cur ? (byType[cur.line_type_id] || []).find((l) => l.line_name === row.rmm_line_name) || null : null);
        setLimitReached(!!hist?.data?.editLimitReached);
      } catch (err) {
        console.error("[ColdEditDialog] load:", err);
        if (alive) setError("โหลดรายการแผนการผลิตไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [mat, row]);

  const planChanged = !!plan && (String(plan.prod_id) !== String(row.prod_id ?? "") || (line && line.line_name !== row.rmm_line_name));
  const weightChanged = weight.trim() !== "" && Number(weight) !== Number(row.weight_RM);

  const save = async () => {
    const w = weight.trim();
    if (!plan) { setError("กรุณาเลือกแผนการผลิต (Code)"); return; }
    if (!line) { setError("กรุณาเลือกไลน์ผลิต"); return; }
    if (!WEIGHT_RE.test(w)) { setError("น้ำหนักต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง"); return; }
    if (!editor.trim()) { setError("กรุณาใส่ชื่อผู้อนุมัติ"); return; }
    if (!planChanged && !weightChanged) { setError("ยังไม่ได้เปลี่ยนค่าใด"); return; }
    if (planChanged && limitReached) { setError("แผนการผลิตของรายการนี้แก้ไขครบ 3 ครั้งแล้ว (แก้ได้เฉพาะน้ำหนัก)"); return; }
    setSaving(true);
    setError("");
    const done = [];
    try {
      if (weightChanged) {
        const res = await axios.patch(`${API_URL}/api/sheet/cold-edit`, {
          mapping_id: row.mapping_id, changes: { weight_RM: w }, expected: { weight_RM: row.weight_RM ?? null }, reason: `ผู้อนุมัติ: ${editor.trim()}`,
        });
        if (!res.data?.success) throw new Error(res.data?.error || "แก้ไขน้ำหนักไม่สำเร็จ");
        done.push("น้ำหนัก");
      }
      if (planChanged) {
        const [code, doc] = String(row.code || "").split(" (");
        const before = `${code || ""}${doc ? ` (${doc.replace(")", "")})` : ""}${row.rmm_line_name ? ` - ${row.rmm_line_name}` : ""}`;
        const res = await axios.put(`${API_URL}/api/MatOnTrolley/updateProduction/pack`, {
          mat,
          rmfpID: row.rmfp_id ? parseInt(row.rmfp_id, 10) : null,
          ProdID: parseInt(plan.prod_id, 10),
          mapping_id: parseInt(row.mapping_id, 10),
          lineID: line.line_id,
          groupID: null,
          line_name: line.line_name,
          name_edit_prod: editor.trim(),
          before_prod: before,
          after_prod: `${plan.code} (${plan.doc_no}) - ${line.line_name}`,
        });
        if (res.data?.success === false) throw new Error(res.data?.message || res.data?.error || "แก้ไขแผนการผลิตไม่สำเร็จ");
        done.push("Code / Line");
      }
      onSaved(`แก้ไข ${done.join(" และ ")} สำเร็จ`);
    } catch (err) {
      console.error("[ColdEditDialog] save:", err);
      setError(done.length ? `บันทึก${done.join(" และ ")}แล้ว แต่ส่วนที่เหลือไม่สำเร็จ: ${errText(err)}` : errText(err));
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={(e, reason) => { if (!saving && reason !== "backdropClick") onClose(); }} disableEscapeKeyDown fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>แก้ไข Code / Line / น้ำหนัก</DialogTitle>
      <DialogContent dividers>
        {loading ? <LinearProgress /> : (
          <>
            {limitReached && <Alert severity="warning" sx={{ mb: 1.5 }}>แผนการผลิตของรายการนี้แก้ไขครบ 3 ครั้งแล้ว — แก้ได้เฉพาะน้ำหนัก</Alert>}
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
              <Autocomplete
                sx={{ flex: 2, minWidth: 220 }} size="small" options={plans} value={plan} disabled={saving || limitReached}
                getOptionLabel={(o) => `${o.code} (${o.doc_no})`} isOptionEqualToValue={(a, b) => a.prod_id === b.prod_id}
                onChange={(e, v) => { setPlan(v); setLine(null); }}
                renderInput={(params) => <TextField {...params} label="แผนการผลิต (Code)" required />}
              />
              <Autocomplete
                sx={{ flex: 1, minWidth: 160 }} size="small" options={plan?.line_type_id ? (linesByType[plan.line_type_id] || []) : []} value={line}
                disabled={!plan || saving || limitReached} getOptionLabel={(o) => o.line_name} isOptionEqualToValue={(a, b) => a.line_name === b.line_name}
                onChange={(e, v) => setLine(v)}
                renderInput={(params) => <TextField {...params} label="ไลน์ผลิต (Line)" required />}
              />
              <TextField
                size="small" label="น้ำหนัก (kg)" type="number" required value={weight} disabled={saving} onChange={(e) => setWeight(e.target.value)}
                inputProps={{ min: 0, step: "any" }} sx={{ width: 140 }}
              />
              <TextField size="small" label="ชื่อผู้อนุมัติ" required value={editor} disabled={saving} onChange={(e) => setEditor(e.target.value)} sx={{ flex: 1, minWidth: 160 }} />
            </Box>
            <Box sx={{ border: "1px solid #E3E9F6", borderRadius: 1, overflow: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>รายการ</TableCell><TableCell>รถเข็น</TableCell><TableCell>วัตถุดิบ</TableCell><TableCell>Batch</TableCell>
                    <TableCell>แผนการผลิต (เดิม)</TableCell><TableCell>ไลน์ (เดิม)</TableCell><TableCell align="right">น้ำหนัก (เดิม)</TableCell><TableCell>ห้อง / ช่อง</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>{row.mapping_id}</TableCell>
                    <TableCell>{row.tro_id || "-"}</TableCell>
                    <TableCell>{row.mat_name || row.mat}</TableCell>
                    <TableCell>{row.batch_after || row.batch || "-"}</TableCell>
                    <TableCell>{row.code || "-"}</TableCell>
                    <TableCell>{row.rmm_line_name || "-"}</TableCell>
                    <TableCell align="right">{row.weight_RM ?? "-"}</TableCell>
                    <TableCell>{[row.cs_name, row.slot_id].filter(Boolean).join(" / ") || "-"}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          </>
        )}
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>ยกเลิก</Button>
        <Button variant="contained" onClick={save} disabled={saving || loading}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ColdEditDialog;
