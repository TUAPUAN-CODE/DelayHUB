import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import { buildRows } from "./buildRows";

const API_URL = import.meta.env.VITE_API_URL;

// What a status is made of: rm_status + stay_place + dest (+ the trolley). A preset only FILLS the fields (the user can change them) and the status
// that the table would show is calculated from the new values before saving, with the same rules as the table (buildRows).
const PRESETS = [
  { label: "รอบรรจุเสร็จ", note: "ไม่อยู่บนรถเข็น", values: { rm_status: "QcCheck", stay_place: "จุดเตรียม", dest: "บรรจุ" }, noTrolley: true },
  { label: "รอ QC Check", note: "อยู่บนรถเข็น", values: { rm_status: "รอQCตรวจสอบ", stay_place: "จุดเตรียม", dest: "รอCheckin" } },
  { label: "รอห้องเย็นรับเข้า", note: "อยู่บนรถเข็น", values: { rm_status: "QcCheck", stay_place: "จุดเตรียม", dest: "เข้าห้องเย็น" } },
  { label: "รอเตรียมวัตถุดิบใหม่", note: "ส่งกลับแก้ไข", values: { rm_status: "รอแก้ไข" } },
  { label: "Done (สำเร็จ)", note: "ปิดงานแล้ว", values: { rm_status: "สำเร็จ", dest: "บรรจุเสร็จ" } },
];
const KNOWN_RM_STATUS = ["QcCheck", "QcCheck รอ MD", "QcCheck รอแก้ไข", "รอQCตรวจสอบ", "รอ MD", "รอแก้ไข", "รอกลับมาเตรียม", "สำเร็จ"];
const NO_TROLLEY = { value: "", label: "ไม่อยู่บนรถเข็น (ถอดออก)" };

const withCurrent = (list, cur) => (cur && !list.some((o) => o.value === cur) ? [{ value: cur, label: cur }, ...list] : list);

/**
 * Fix a wrong entry: change the fields that make up the status of ONE mapping. Saved with PATCH /api/sheet/edit (needs the Setting permit);
 * every changed field is written to SheetEditLog with the reason.
 */
const StatusFixDialog = ({ open, row, hu, onClose, onSaved }) => {
  const [vals, setVals] = useState({ rm_status: "", stay_place: "", dest: "", tro_id: "" });
  const [opts, setOpts] = useState({ dest: [], stay: [], tro: [] });
  const [release, setRelease] = useState(true);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !row) return;
    setVals({ rm_status: row.rm_status ?? "", stay_place: row.stay_place ?? "", dest: row.dest ?? "", tro_id: row.tro_id ?? "" });
    setReason(""); setError(""); setRelease(true);
  }, [open, row]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    Promise.allSettled(["dest", "stay", "tro"].map((f) => axios.get(`${API_URL}/api/sheet/edit-options`, { params: { field: f } }))).then((rs) => {
      if (!alive) return;
      const get = (i) => (rs[i].status === "fulfilled" ? rs[i].value.data?.data ?? [] : []);
      setOpts({ dest: get(0), stay: get(1), tro: get(2) });
    });
    return () => { alive = false; };
  }, [open]);

  const set = (k) => (v) => setVals((s) => ({ ...s, [k]: v ?? "" }));
  const changes = useMemo(() => {
    if (!row) return {};
    const out = {};
    ["rm_status", "stay_place", "dest", "tro_id"].forEach((k) => {
      const cur = row[k] === null || row[k] === undefined ? "" : String(row[k]);
      if (String(vals[k] ?? "") !== cur) out[k] = vals[k] === "" ? null : vals[k];
    });
    return out;
  }, [row, vals]);

  // the status the table will show after the change (same rules as the table); "-" / hidden when no rule matches
  const preview = useMemo(() => {
    if (!row) return null;
    const m = { ...row, rm_status: vals.rm_status, stay_place: vals.stay_place, dest: vals.dest, tro_id: vals.tro_id === "" ? null : vals.tro_id };
    if (String(vals.tro_id ?? "") !== String(row.tro_id ?? "")) { m.cs_id = null; m.cs_name = null; m.slot_id = null; } // the room / slot follow the trolley
    const built = buildRows(hu ? [hu] : [], [m], {}, [], Date.now(), []);
    return built.find((r) => r.mapping_id === row.mapping_id)?.__status || null;
  }, [row, hu, vals]);

  const apply = (p) => { setVals((s) => ({ ...s, ...p.values, ...(p.noTrolley ? { tro_id: "" } : {}) })); };
  const clearsTrolley = "tro_id" in changes && changes.tro_id === null;
  const save = async () => {
    if (!Object.keys(changes).length) { setError("ยังไม่ได้เปลี่ยนค่าใด"); return; }
    if (!reason.trim()) { setError("กรุณาระบุเหตุผลที่แก้ไข (บันทึกในประวัติ)"); return; }
    setSaving(true); setError("");
    try {
      const expected = {};
      Object.keys(changes).forEach((k) => { expected[k] = row[k] === undefined ? null : row[k]; });
      const res = await axios.patch(`${API_URL}/api/sheet/edit`, {
        mapping_id: row.mapping_id, changes, expected, reason: reason.trim(),
        ...(clearsTrolley ? { allow_clear_tro: true, release_trolley: release } : {}),
      });
      if (!res.data?.success) throw new Error(res.data?.error || "แก้ไขไม่สำเร็จ");
      onSaved?.(res.data.message || "แก้ไขสถานะสำเร็จ");
    } catch (err) {
      console.error("[MappingTool] status fix error:", err);
      setError(err.response?.data?.error || err.message || "แก้ไขไม่สำเร็จ");
    } finally { setSaving(false); }
  };

  const pick = (k, label, options) => (
    <Autocomplete size="small" options={withCurrent(options, vals[k])} value={vals[k] ? { value: vals[k], label: vals[k] } : null}
      onChange={(_, v) => set(k)(v?.value)} getOptionLabel={(o) => o.label} isOptionEqualToValue={(a, b) => a.value === b.value}
      renderInput={(p) => <TextField {...p} label={label} />} noOptionsText="ไม่พบในรายการ" />
  );

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>เปลี่ยนสถานะ · รายการ {row?.mapping_id}</DialogTitle>
      <DialogContent>
        {row && (
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              {row.mat_name || row.mat || ""}{row.tro_id ? ` · รถเข็น ${row.tro_id}` : ""} · rm_status <b>{row.rm_status || "-"}</b> · {row.stay_place || "-"} → {row.dest || "-"}
            </Typography>
            <Box>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 0.5 }}>เลือกสถานะที่ต้องการ (เติมค่าให้ แล้วปรับเองได้)</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                {PRESETS.map((p) => <Chip key={p.label} clickable label={`${p.label} · ${p.note}`} onClick={() => apply(p)} variant="outlined" color="primary" size="small" />)}
              </Box>
            </Box>
            <Autocomplete size="small" freeSolo options={KNOWN_RM_STATUS} value={vals.rm_status} inputValue={vals.rm_status}
              onInputChange={(_, v) => set("rm_status")(v)} renderInput={(p) => <TextField {...p} label="rm_status (สถานะวัตถุดิบ)" />} />
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              {pick("stay_place", "stay_place (สถานที่)", opts.stay)}
              {pick("dest", "dest (ปลายทาง)", opts.dest)}
            </Box>
            <Autocomplete size="small" options={[NO_TROLLEY, ...withCurrent(opts.tro, vals.tro_id)]} value={vals.tro_id ? { value: vals.tro_id, label: `รถเข็น ${vals.tro_id}` } : NO_TROLLEY}
              onChange={(_, v) => set("tro_id")(v?.value)} getOptionLabel={(o) => o.label} isOptionEqualToValue={(a, b) => a.value === b.value}
              renderInput={(p) => <TextField {...p} label="รถเข็น" />} />
            {clearsTrolley && <FormControlLabel control={<Checkbox size="small" checked={release} onChange={(e) => setRelease(e.target.checked)} />} label="คืนรถเข็นให้ว่าง (ถ้าไม่มีวัตถุดิบอื่นอยู่บนรถเข็นนั้น)" />}

            <Alert severity={preview && preview.label !== "-" ? "info" : "warning"} icon={false}>
              สถานะที่ตารางจะแสดง: {preview ? <Chip size="small" label={preview.label} sx={{ ml: 0.5, background: preview.bg, color: preview.color, fontWeight: 700 }} /> : <b>(ไม่แสดงในตาราง)</b>}
              {Object.keys(changes).length > 0 && <Box sx={{ mt: 0.5, fontSize: 12 }}>เปลี่ยน: {Object.entries(changes).map(([k, v]) => `${k} ${row[k] ?? "(ว่าง)"} → ${v ?? "(ว่าง)"}`).join(" · ")}</Box>}
            </Alert>
            <TextField size="small" label="เหตุผลที่แก้ไข (จำเป็น · บันทึกในประวัติ)" value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 300 }} />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>ยกเลิก</Button>
        <Button variant="contained" onClick={save} disabled={saving || !Object.keys(changes).length}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default StatusFixDialog;
