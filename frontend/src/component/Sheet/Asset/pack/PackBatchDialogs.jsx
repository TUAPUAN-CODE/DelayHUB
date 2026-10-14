import { useEffect, useState } from "react";
import axios from "axios";
import {
  Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import AddTrolleyDialog from "../../../Pack/ManageRawmat/Asset/flow/AddTrolleyDialog";

const API_URL = import.meta.env.VITE_API_URL;

// Pack: ทำรายการ ใส่รถเข็น / แก้ไขแผน / ลบ กับแถวที่ติ๊กไว้หลายแถวในครั้งเดียว
// เรียก API เดิมของหน้าจัดการวัตถุดิบทีละแถว (ตามลำดับ) แล้วสรุปผลว่าแถวไหนสำเร็จ/ไม่สำเร็จ

const batchOf = (r) => r.batch_after || r.batch || "";
const errText = (err) => err.response?.data?.message || err.response?.data?.error || err.message || "ไม่ทราบสาเหตุ";

/** run fn on each row in order; returns the rows that failed with their reason */
const runEach = async (rows, fn, onStep) => {
  const failed = [];
  for (let i = 0; i < rows.length; i += 1) {
    try {
      await fn(rows[i]);
    } catch (err) {
      console.error("[PackBatch] row error:", rows[i].mapping_id, err);
      failed.push({ row: rows[i], reason: errText(err) });
    }
    onStep(i + 1);
  }
  return failed;
};

const RowList = ({ rows, extra }) => (
  <Box sx={{ maxHeight: 320, overflow: "auto", border: "1px solid rgba(255,255,255,.14)", borderRadius: 1 }}>
    <Table size="small" stickyHeader>
      <TableHead>
        <TableRow>
          <TableCell>วัตถุดิบ</TableCell>
          <TableCell>Batch</TableCell>
          <TableCell>แผนการผลิต</TableCell>
          {extra?.head}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.mapping_id}>
            <TableCell>{r.mat_name || r.mat}</TableCell>
            <TableCell>{batchOf(r)}</TableCell>
            <TableCell>{r.code || "-"}</TableCell>
            {extra?.cells(r)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Box>
);

const Result = ({ total, failed }) => (
  <Box sx={{ mt: 1.5 }}>
    {failed.length === 0
      ? <Alert severity="success">ทำรายการสำเร็จ {total} แถว</Alert>
      : (
        <Alert severity="warning">
          สำเร็จ {total - failed.length} แถว · ไม่สำเร็จ {failed.length} แถว
          {failed.map((f) => <div key={f.row.mapping_id}>• {f.row.mat_name || f.row.mat} {batchOf(f.row)}: {f.reason}</div>)}
        </Alert>
      )}
  </Box>
);

/** shell shared by the 3 dialogs: progress while running, result at the end, the buttons */
const BatchShell = ({ open, title, onClose, children, running, done, total, step, failed, canRun, onRun, runLabel, runColor }) => (
  <Dialog open={open} onClose={(e, reason) => { if (reason !== "backdropClick" && !running) onClose(); }} fullWidth maxWidth="md">
    <DialogTitle>{title} ({total} แถว)</DialogTitle>
    <DialogContent dividers>
      {children}
      {running && <Box sx={{ mt: 1.5 }}><LinearProgress variant="determinate" value={(step / total) * 100} /><Typography variant="caption">กำลังทำรายการ {step}/{total}</Typography></Box>}
      {done && <Result total={total} failed={failed} />}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={running}>{done ? "ปิด" : "ยกเลิก"}</Button>
      {!done && <Button variant="contained" color={runColor || "primary"} disabled={!canRun || running} onClick={onRun}>{runLabel}</Button>}
    </DialogActions>
  </Dialog>
);

const useRunner = (rows, onDone) => {
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState([]);
  const [done, setDone] = useState(false);
  const run = async (fn) => {
    setRunning(true);
    setStep(0);
    const bad = await runEach(rows, fn, setStep);
    setFailed(bad);
    setRunning(false);
    setDone(true);
    onDone?.();
  };
  return { running, step, failed, done, run };
};

// ─── ใส่รถเข็น: เลือกรถเข็นคันเดียว แล้วกรอกน้ำหนัก/จำนวนถาดของแต่ละแถว ───
export const BatchCartDialog = ({ rows, weights, onClose, onDone }) => {
  const [trolleys, setTrolleys] = useState([]);
  const [trolley, setTrolley] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(() => Object.fromEntries(rows.map((r) => [r.mapping_id, {
    weight: weights[r.mapping_id] || String(Number(r.weight_RM) || ""), ntray: "",
  }])));
  const runner = useRunner(rows, onDone);

  const fetchTrolleys = async () => {
    try {
      const line = localStorage.getItem("line_id");
      if (!line) return;
      const res = await axios.get(`${API_URL}/api/pack/Trolley/${line}`);
      setTrolleys(res.data.success ? res.data.data : []);
    } catch (err) {
      console.error("[BatchCartDialog] fetch trolleys:", err);
    }
  };
  useEffect(() => { fetchTrolleys(); }, []);

  const set = (id, key, value) => setForm((f) => ({ ...f, [id]: { ...f[id], [key]: value } }));
  const problem = (r) => {
    const f = form[r.mapping_id];
    const w = parseFloat(f.weight);
    if (!(w > 0)) return "กรอกน้ำหนัก";
    if (w > Number(r.weight_RM || 0)) return `เกิน ${r.weight_RM} kg`;
    if (!(parseInt(f.ntray, 10) >= 1)) return "กรอกจำนวนถาด";
    return "";
  };
  const allValid = !!trolley && rows.every((r) => !problem(r));

  const submit = () => runner.run((r) => axios.put(`${API_URL}/api/pack/matmanage/Add/rm/TrolleyMapping`, {
    tro_id: trolley.tro_id,
    rmfpID: r.rmfp_id,
    mapping_id: r.mapping_id,
    weight_per_tro: form[r.mapping_id].weight,
    ntray: form[r.mapping_id].ntray,
    batch_after: batchOf(r),
  }));

  return (
    <>
      <BatchShell open title="ใส่รถเข็น" onClose={onClose} total={rows.length} {...runner} canRun={allValid} onRun={submit} runLabel={`ใส่รถเข็น ${trolley?.tro_id || ""}`.trim()}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1.5, flexWrap: "wrap" }}>
          <Autocomplete
            sx={{ width: 220 }} size="small" options={trolleys} value={trolley} disabled={runner.running || runner.done}
            getOptionLabel={(o) => `${o.tro_id}`} isOptionEqualToValue={(o, v) => o.tro_id === v.tro_id}
            onChange={(e, v) => setTrolley(v)} renderInput={(params) => <TextField {...params} label="เลือกรถเข็น (คันเดียวสำหรับทุกแถว)" />}
          />
          <Button size="small" onClick={() => setAddOpen(true)} disabled={runner.running || runner.done}>+ เพิ่มรถเข็นใหม่</Button>
        </Box>
        <RowList rows={rows} extra={{
          head: <><TableCell>มีอยู่ (kg)</TableCell><TableCell>น้ำหนักที่ใส่ (kg)</TableCell><TableCell>จำนวนถาด</TableCell><TableCell /></>,
          cells: (r) => (
            <>
              <TableCell>{r.weight_RM}</TableCell>
              <TableCell><TextField size="small" type="number" sx={{ width: 100 }} value={form[r.mapping_id].weight} disabled={runner.running || runner.done} inputProps={{ min: 0, step: 0.01 }} onChange={(e) => set(r.mapping_id, "weight", e.target.value)} /></TableCell>
              <TableCell><TextField size="small" type="number" sx={{ width: 80 }} value={form[r.mapping_id].ntray} disabled={runner.running || runner.done} inputProps={{ min: 1 }} onChange={(e) => set(r.mapping_id, "ntray", e.target.value)} /></TableCell>
              <TableCell sx={{ color: "#FCA5A5", whiteSpace: "nowrap" }}>{problem(r)}</TableCell>
            </>
          ),
        }} />
      </BatchShell>
      <AddTrolleyDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={async (troId) => { await fetchTrolleys(); setTrolley({ tro_id: troId }); }} />
    </>
  );
};

// ─── แก้ไขแผนการผลิต: ทุกแถวต้องเป็นวัตถุดิบ (mat) เดียวกัน เพราะรายการแผนขึ้นกับ mat ───
export const BatchEditPlanDialog = ({ rows, onClose, onDone }) => {
  const mat = rows[0]?.mat_id || rows[0]?.mat;
  const [plans, setPlans] = useState([]);
  const [linesByType, setLinesByType] = useState({});
  const [plan, setPlan] = useState(null);
  const [line, setLine] = useState(null);
  const [editor, setEditor] = useState("");
  const [limited, setLimited] = useState({}); // mapping_id -> แก้ครบ 3 ครั้งแล้ว
  const [loading, setLoading] = useState(true);
  const runner = useRunner(rows.filter((r) => !limited[r.mapping_id]), onDone);

  useEffect(() => {
    const load = async () => {
      try {
        const [prod, ...hist] = await Promise.all([
          axios.get(`${API_URL}/api/fetchProduction`, { params: { mat } }),
          ...rows.map((r) => axios.get(`${API_URL}/api/checkEditHistoryOnTrolley/${r.mapping_id}`).catch((err) => {
            console.error("[BatchEditPlanDialog] edit history:", err);
            return null;
          })),
        ]);
        if (prod.data.success) {
          setPlans(prod.data.data || []);
          setLinesByType(prod.data.allLinesByType || {});
        }
        setLimited(Object.fromEntries(rows.map((r, i) => [r.mapping_id, !!hist[i]?.data?.editLimitReached])));
      } catch (err) {
        console.error("[BatchEditPlanDialog] load:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [mat, rows]);

  const blocked = rows.filter((r) => limited[r.mapping_id]);
  const canRun = !loading && !!plan && !!line && !!editor.trim() && rows.length > blocked.length;

  const submit = () => runner.run((r) => {
    const [code, doc] = String(r.code || "").split(" (");
    const before = `${code || ""}${doc ? ` (${doc.replace(")", "")})` : ""}${(r.rmm_line_name || r.line_name) ? ` - ${r.rmm_line_name || r.line_name}` : ""}`;
    return axios.put(`${API_URL}/api/MatOnTrolley/updateProduction/pack`, {
      mat: r.mat_id || r.mat,
      rmfpID: r.rmfp_id ? parseInt(r.rmfp_id, 10) : null,
      ProdID: parseInt(plan.prod_id, 10),
      mapping_id: parseInt(r.mapping_id, 10),
      lineID: line.line_id,
      groupID: null,
      line_name: line.line_name,
      name_edit_prod: editor.trim(),
      before_prod: before,
      after_prod: `${plan.code} (${plan.doc_no}) - ${line.line_name}`,
    });
  });

  const locked = runner.running || runner.done;
  return (
    <BatchShell open title="แก้ไขแผนการผลิต" onClose={onClose} total={rows.length - blocked.length} {...runner} canRun={canRun} onRun={submit} runLabel="บันทึกแผนใหม่">
      {loading ? <LinearProgress /> : (
        <>
          {blocked.length > 0 && <Alert severity="warning" sx={{ mb: 1.5 }}>{blocked.length} แถวแก้ไขครบ 3 ครั้งแล้ว จะไม่ถูกแก้ไข</Alert>}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
            <Autocomplete
              sx={{ flex: 2, minWidth: 220 }} size="small" options={plans} value={plan} disabled={locked}
              getOptionLabel={(o) => `${o.code} (${o.doc_no})`} onChange={(e, v) => { setPlan(v); setLine(null); }}
              renderInput={(params) => <TextField {...params} label="แผนการผลิตใหม่" required />}
            />
            <Autocomplete
              sx={{ flex: 1, minWidth: 160 }} size="small" options={plan?.line_type_id ? (linesByType[plan.line_type_id] || []) : []} value={line} disabled={!plan || locked}
              getOptionLabel={(o) => o.line_name} onChange={(e, v) => setLine(v)}
              renderInput={(params) => <TextField {...params} label="ไลน์ผลิต" required />}
            />
            <TextField size="small" label="ชื่อผู้อนุมัติ" required value={editor} disabled={locked} onChange={(e) => setEditor(e.target.value)} sx={{ flex: 1, minWidth: 160 }} />
          </Box>
          <RowList rows={rows} extra={{
            head: <TableCell />,
            cells: (r) => <TableCell sx={{ color: "#FCD34D", whiteSpace: "nowrap" }}>{limited[r.mapping_id] ? "แก้ครบ 3 ครั้งแล้ว" : ""}</TableCell>,
          }} />
        </>
      )}
    </BatchShell>
  );
};

// ─── ลบ (บรรจุสำเร็จ / เอาออกจากรายการ) ───
export const BatchDeleteDialog = ({ rows, onClose, onDone }) => {
  const runner = useRunner(rows, onDone);
  const submit = () => runner.run(async (r) => {
    const res = await axios.post(`${API_URL}/api/pack/success/packing`, { mapping_id: r.mapping_id });
    if (!res.data.success) throw new Error(res.data.message || "ลบไม่สำเร็จ");
  });
  return (
    <BatchShell open title="ลบรายการ" onClose={onClose} total={rows.length} {...runner} canRun onRun={submit} runLabel={`ยืนยันลบ ${rows.length} แถว`} runColor="error">
      <Typography sx={{ mb: 1, color: "rgba(241,244,250,.62)" }}>กรุณาตรวจสอบรายการก่อนลบ</Typography>
      <RowList rows={rows} />
    </BatchShell>
  );
};
