import { useEffect, useState } from "react";
import axios from "axios";
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography, createFilterOptions } from "@mui/material";

const API_URL = import.meta.env.VITE_API_URL;
const limitOptions = createFilterOptions({ limit: 200 });
const WEIGHT_RE = /^\d+(\.\d{1,2})?$/;

/**
 * "แก้ไข Code / Line / น้ำหนัก" of a material that is in a cold room (status อยู่ในห้องเย็น / อยู่ในห้องเย็นใหญ่) — the tools of the chosen row.
 * Code = the production plan (picked from the list, never typed), Line = picked from the list, weight = typed (2 decimals).
 * PATCH /api/sheet/cold-edit: the server only takes these three columns and only while the trolley is in a cold room slot; it refuses (409) a row
 * somebody changed meanwhile, and writes every change to SheetEditLog.
 * Mounted once per opening (key): nothing typed is reset by the table reloading; a tap outside does not close it.
 */
const ColdEditDialog = ({ row, onClose, onSaved }) => {
  const [prods, setProds] = useState([]);
  const [lines, setLines] = useState([]);
  const [prod, setProd] = useState(null);
  const [line, setLine] = useState(null);
  const [weight, setWeight] = useState(() => (row.weight_RM === null || row.weight_RM === undefined ? "" : String(row.weight_RM)));
  const [reason, setReason] = useState("");
  const [loadingOpt, setLoadingOpt] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all(["prod", "line"].map((field) => axios.get(`${API_URL}/api/sheet/edit-options`, { params: { field } })))
      .then(([p, l]) => {
        if (!alive) return;
        const pl = p.data?.data ?? [];
        const ll = l.data?.data ?? [];
        setProds(pl);
        setLines(ll);
        setProd(pl.find((o) => String(o.value) === String(row.prod_id ?? "")) || null);
        setLine(ll.find((o) => String(o.value) === String(row.rmm_line_name ?? "")) || null);
      })
      .catch((err) => { console.error("[Sheet] cold edit options error:", err); if (alive) setError("โหลดรายการ Code / Line ไม่สำเร็จ"); })
      .finally(() => { if (alive) setLoadingOpt(false); });
    return () => { alive = false; };
  }, [row]);

  const save = async () => {
    const w = weight.trim();
    if (!WEIGHT_RE.test(w)) { setError("น้ำหนักต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง"); return; }
    if (!prod) { setError("กรุณาเลือก Code (แผนผลิต)"); return; }
    if (!line) { setError("กรุณาเลือก Line"); return; }
    // only what really changed is sent, with the value seen when the dialog opened (the server refuses a row changed meanwhile)
    const changes = {};
    const expected = {};
    if (String(prod.value) !== String(row.prod_id ?? "")) { changes.prod_id = prod.value; expected.prod_id = row.prod_id ?? null; }
    if (String(line.value) !== String(row.rmm_line_name ?? "")) { changes.rmm_line_name = line.value; expected.rmm_line_name = row.rmm_line_name ?? null; }
    if (Number(w) !== Number(row.weight_RM)) { changes.weight_RM = w; expected.weight_RM = row.weight_RM ?? null; }
    if (!Object.keys(changes).length) { setError("ยังไม่ได้เปลี่ยนค่าใด"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await axios.patch(`${API_URL}/api/sheet/cold-edit`, { mapping_id: row.mapping_id, changes, expected, reason: reason.trim() });
      if (!res.data?.success) throw new Error(res.data?.error || "แก้ไขไม่สำเร็จ");
      onSaved(res.data.message || "แก้ไขข้อมูลสำเร็จ");
    } catch (err) {
      console.error("[Sheet] cold edit error:", err);
      setError(err.response?.data?.error || err.message || "แก้ไขไม่สำเร็จ");
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={(e, reason2) => { if (!saving && reason2 !== "backdropClick") onClose(); }} disableEscapeKeyDown fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>แก้ไข Code / Line / น้ำหนัก</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 1.5, color: "text.secondary" }}>
          รายการ {row.mapping_id} · รถเข็น {row.tro_id || "-"} · {row.mat_name || row.mat || ""}{row.cs_name ? ` · ${row.cs_name}${row.slot_id ? ` ช่อง ${row.slot_id}` : ""}` : ""}
        </Typography>
        <Stack spacing={1.75}>
          <Autocomplete
            options={prods} value={prod} onChange={(_, v) => setProd(v)} loading={loadingOpt} filterOptions={limitOptions}
            getOptionLabel={(o) => o.label || String(o.value)} isOptionEqualToValue={(a, b) => String(a.value) === String(b.value)}
            renderInput={(params) => <TextField {...params} size="small" label={`Code (แผนผลิต) — เดิม ${row.code || row.doc_no || "-"}`} />}
          />
          <Autocomplete
            options={lines} value={line} onChange={(_, v) => setLine(v)} loading={loadingOpt} filterOptions={limitOptions}
            getOptionLabel={(o) => o.label || String(o.value)} isOptionEqualToValue={(a, b) => String(a.value) === String(b.value)}
            renderInput={(params) => <TextField {...params} size="small" label={`Line — เดิม ${row.rmm_line_name || "-"}`} />}
          />
          <TextField
            size="small" label={`น้ำหนัก (kg) — เดิม ${row.weight_RM ?? "-"}`} type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
            inputProps={{ min: 0, step: "any" }}
          />
          <TextField size="small" label="เหตุผล (ไม่บังคับ)" value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 300 }} />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>ยกเลิก</Button>
        <Button variant="contained" onClick={save} disabled={saving || loadingOpt}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ColdEditDialog;
