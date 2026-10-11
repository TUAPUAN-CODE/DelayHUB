import { useEffect, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";

const API_URL = import.meta.env.VITE_API_URL;
const NUMBER_KEYS = new Set(["tray_count", "weight_RM"]);

const toInput = (type, v) => {
  if (v === null || v === undefined || v === "-") return "";
  return type === "time" ? String(v).replace(" ", "T").slice(0, 16) : String(v);
};

/**
 * Supervisor edit of ONE cell of the in-process / done table (opened by a double-click while "โหมดแก้ไข" is on).
 * Sends the value it saw (expected) with the new one, so a row somebody else changed meanwhile is refused by the server (409) instead of being overwritten.
 * Every change is written to SheetEditLog on the server (who / old / new / reason).
 */
const EditCellDialog = ({ target, onClose, onSaved }) => {
  const row = target?.row;
  const col = target?.col;
  const oldRaw = row && col ? row[col.key] : null;
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!target) return;
    setValue(toInput(col.type, oldRaw));
    setReason("");
    setError("");
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const isTime = col?.type === "time";
  const isNumber = col && NUMBER_KEYS.has(col.key);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const next = value === "" ? null : (isTime ? value.replace("T", " ") : value);
      const res = await axios.patch(`${API_URL}/api/sheet/edit`, {
        mapping_id: row.mapping_id,
        changes: { [col.key]: next },
        expected: { [col.key]: oldRaw === undefined || oldRaw === "-" ? null : oldRaw },
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
            <Typography variant="body2">ค่าเดิม: <b>{oldRaw === null || oldRaw === undefined || oldRaw === "" ? "(ว่าง)" : String(oldRaw)}</b></Typography>
            <TextField
              autoFocus size="small" label="ค่าใหม่ (เว้นว่าง = ล้างค่า)" value={value} onChange={(e) => setValue(e.target.value)}
              type={isTime ? "datetime-local" : isNumber ? "number" : "text"} InputLabelProps={{ shrink: true }}
              inputProps={isTime ? { step: 60 } : isNumber ? { min: 0, step: col.key === "tray_count" ? 1 : "any" } : { maxLength: col.key === "tro_id" ? 4 : 500 }}
            />
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
