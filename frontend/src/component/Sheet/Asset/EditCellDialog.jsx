import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography, createFilterOptions } from "@mui/material";

const API_URL = import.meta.env.VITE_API_URL;
const NUMBER_KEYS = new Set(["tray_count", "weight_RM"]);
const TEXT_KEYS = new Set(["batch", "mix_code", "hu", "remark", "remark_dalay"]);

// Values that come from the database can only be PICKED (dropdown with search), never typed:
//   field = which list the server gives (GET /api/sheet/edit-options) · key = what is sent to PATCH /api/sheet/edit · get = the current value of the row
const PICK = {
  mat: { field: "mat", key: "mat", get: (r) => r.mat, label: "วัตถุดิบ" },
  mat_name: { field: "mat", key: "mat", get: (r) => r.mat, label: "วัตถุดิบ" },
  code: { field: "prod", key: "prod_id", get: (r) => r.prod_id, label: "แผนผลิต" },
  doc_no: { field: "prod", key: "prod_id", get: (r) => r.prod_id, label: "แผนผลิต" },
  rmm_line_name: { field: "line", key: "rmm_line_name", get: (r) => r.rmm_line_name, label: "ไลน์" },
  tro_id: { field: "tro", key: "tro_id", get: (r) => r.tro_id, label: "รถเข็น" },
  dest: { field: "dest", key: "dest", get: (r) => r.dest, label: "ปลายทาง" },
  stay_place: { field: "stay", key: "stay_place", get: (r) => r.stay_place, label: "สถานที่" },
};

/** which columns of the table can be edited (everything else — status, DBS, room / slot, ... — is computed and cannot be) */
export const canEditColumn = (col) => !!col && (col.type === "time" || NUMBER_KEYS.has(col.key) || TEXT_KEYS.has(col.key) || !!PICK[col.key]);

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const limitOptions = createFilterOptions({ limit: 200 });

const splitTime = (v) => {
  const s = v === null || v === undefined || v === "-" ? "" : String(v).replace("T", " ");
  return { date: s.slice(0, 10), hh: s.length >= 13 ? s.slice(11, 13) : "00", mm: s.length >= 16 ? s.slice(14, 16) : "00" };
};

/**
 * Edit of ONE cell of the in-process / done table (opened by a double-click while "แก้ไขข้อมูล" is on).
 *   database values (material, plan, line, trolley, destination ...) -> dropdown with search   ·  time -> date + hour 00-23 + minute (no AM / PM)
 *   weight, trays, batch, remarks ... -> typed
 * Sends the value it saw (expected) with the new one, so a row somebody else changed meanwhile is refused by the server (409) instead of being overwritten.
 * Every change is written to SheetEditLog on the server (who / old / new / reason).
 */
const EditCellDialog = ({ target, onClose, onSaved }) => {
  const row = target?.row;
  const col = target?.col;
  const pick = col ? PICK[col.key] : null;
  const isTime = col?.type === "time";
  const isNumber = col && NUMBER_KEYS.has(col.key);
  const oldRaw = row && col ? (pick ? pick.get(row) : row[col.key]) : null;
  const shownOld = row && col ? (col.key === "batch" ? (row.batch_after || row.batch) : row[col.key]) : null;

  const [value, setValue] = useState("");
  const [picked, setPicked] = useState(null);
  const [options, setOptions] = useState([]);
  const [loadingOpt, setLoadingOpt] = useState(false);
  const [time, setTime] = useState({ date: "", hh: "00", mm: "00" });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!target) return;
    setReason(""); setError(""); setPicked(null);
    if (isTime) setTime(splitTime(oldRaw));
    else setValue(col.key === "batch" ? String(shownOld ?? "") : oldRaw === null || oldRaw === undefined || oldRaw === "-" ? "" : String(oldRaw));
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!target || !pick) return undefined;
    let alive = true;
    setLoadingOpt(true);
    axios.get(`${API_URL}/api/sheet/edit-options`, { params: { field: pick.field } })
      .then((res) => {
        if (!alive) return;
        const list = res.data?.data ?? [];
        setOptions(list);
        const cur = list.find((o) => String(o.value) === String(oldRaw ?? ""));
        setPicked(cur || null);
      })
      .catch((err) => { console.error("[Sheet] edit options error:", err); if (alive) setError("โหลดรายการให้เลือกไม่สำเร็จ"); })
      .finally(() => { if (alive) setLoadingOpt(false); });
    return () => { alive = false; };
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextValue = useMemo(() => {
    if (pick) return picked ? picked.value : null;
    if (isTime) return time.date ? `${time.date} ${time.hh}:${time.mm}` : null;
    return value === "" ? null : value;
  }, [pick, picked, isTime, time, value]);

  // ข้อมูลที่ผู้ใช้พิมพ์เอง: ตรวจชนิดและจำนวนหลักก่อนบันทึก (server ตรวจซ้ำอีกชั้น)
  const checkTyped = () => {
    if (pick || isTime || nextValue === null) return "";
    const v = String(nextValue).trim();
    if (col.key === "batch") {
      const bad = v.toUpperCase().split(",").map((x) => x.trim()).filter(Boolean).find((x) => !/^[A-Z0-9]{10}$/.test(x));
      return bad ? `Batch "${bad}" ต้องเป็นตัวอักษร/ตัวเลข 10 หลัก` : "";
    }
    if (col.key === "weight_RM") return /^\d+(\.\d{1,2})?$/.test(v) ? "" : "น้ำหนักต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง";
    if (col.key === "tray_count") return /^\d+$/.test(v) ? "" : "จำนวนถาดต้องเป็นจำนวนเต็ม";
    return "";
  };

  const save = async () => {
    if (pick && !picked) { setError("กรุณาเลือกจากรายการ"); return; }
    const typedErr = checkTyped();
    if (typedErr) { setError(typedErr); return; }
    setSaving(true);
    setError("");
    try {
      const key = pick ? pick.key : col.key;
      const res = await axios.patch(`${API_URL}/api/sheet/edit`, {
        mapping_id: row.mapping_id,
        changes: { [key]: nextValue },
        expected: { [key]: oldRaw === undefined || oldRaw === "-" ? null : oldRaw },
        reason: reason.trim(),
      });
      if (!res.data?.success) throw new Error(res.data?.error || "แก้ไขไม่สำเร็จ");
      onSaved?.(res.data.message || "แก้ไขข้อมูลสำเร็จ");
    } catch (err) {
      console.error("[Sheet] edit cell error:", err);
      setError(err.response?.data?.error || err.message || "แก้ไขไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!target} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>แก้ไขข้อมูล · {col?.label}</DialogTitle>
      <DialogContent>
        {row && (
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Box sx={{ fontSize: 13, color: "text.secondary" }}>
              รายการ <b>{row.mapping_id}</b>{row.mat_name ? ` · ${row.mat_name}` : ""}{row.tro_id ? ` · รถเข็น ${row.tro_id}` : ""}
            </Box>
            <Typography variant="body2">ค่าเดิม: <b>{shownOld === null || shownOld === undefined || shownOld === "" ? "(ว่าง)" : String(shownOld)}</b></Typography>

            {pick && (
              <Autocomplete
                autoFocus openOnFocus loading={loadingOpt} options={options} value={picked} filterOptions={limitOptions}
                onChange={(_e, v) => setPicked(v)} getOptionLabel={(o) => o.label} isOptionEqualToValue={(o, v) => String(o.value) === String(v.value)}
                noOptionsText="ไม่พบในรายการ" loadingText="กำลังโหลดรายการ..."
                renderInput={(params) => <TextField {...params} size="small" label={`เลือก${pick.label} (พิมพ์เพื่อค้นหา)`} />}
              />
            )}

            {isTime && (
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <TextField size="small" type="date" label="วันที่" value={time.date} onChange={(e) => setTime((t) => ({ ...t, date: e.target.value }))} InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 150 }} />
                <TextField select size="small" label="ชม." value={time.hh} onChange={(e) => setTime((t) => ({ ...t, hh: e.target.value }))} sx={{ width: 84 }} SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 320 } } } }}>
                  {HOURS.map((h) => <MenuItem key={h} value={h}>{h}</MenuItem>)}
                </TextField>
                <Typography>:</Typography>
                <TextField select size="small" label="นาที" value={time.mm} onChange={(e) => setTime((t) => ({ ...t, mm: e.target.value }))} sx={{ width: 84 }} SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 320 } } } }}>
                  {MINUTES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
                <Button size="small" color="inherit" onClick={() => setTime({ date: "", hh: "00", mm: "00" })}>ล้างค่า</Button>
              </Box>
            )}

            {!pick && !isTime && (
              <TextField
                autoFocus size="small" label="ค่าใหม่ (เว้นว่าง = ล้างค่า)" value={value} onChange={(e) => setValue(e.target.value)}
                type={isNumber ? "number" : "text"} InputLabelProps={{ shrink: true }}
                inputProps={isNumber ? { min: 0, step: col.key === "tray_count" ? 1 : "any" } : { maxLength: 500 }}
                helperText={col?.key === "batch" ? "Batch ละ 10 หลัก (A-Z / 0-9) · หลาย Batch คั่นด้วยเครื่องหมาย ," : col?.key === "weight_RM" ? "ตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง" : col?.key === "tray_count" ? "จำนวนเต็ม" : undefined}
              />
            )}

            <TextField size="small" label="เหตุผลที่แก้ไข (บันทึกในประวัติ)" value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 300 }} />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>ยกเลิก</Button>
        <Button variant="contained" onClick={save} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditCellDialog;
