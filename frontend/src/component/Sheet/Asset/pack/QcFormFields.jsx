import { useEffect, useState } from "react";
import axios from "axios";
import { Autocomplete, Box, Button, Checkbox, FormControlLabel, Radio, RadioGroup, TextField, Typography } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

const PASS_FAIL = (value, onChange, labels = ["ผ่าน", "ไม่ผ่าน"], error) => (
  <RadioGroup row value={value} onChange={(e) => onChange(e.target.value)}>
    <FormControlLabel value="1" control={<Radio size="small" />} label={labels[0]} />
    <FormControlLabel value="0" control={<Radio size="small" />} label={labels[1]} />
    {error && <Typography color="error" variant="caption" sx={{ alignSelf: "center", ml: 1 }}>กรุณาเลือก</Typography>}
  </RadioGroup>
);

const Section = ({ title, children, bad }) => (
  <Box sx={{ border: "1px solid", borderColor: bad ? "error.main" : "#E3E8F2", borderRadius: "10px", p: 1.5, mb: 1.5 }}>
    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>{title}</Typography>
    {children}
  </Box>
);

/**
 * The QC check form of the QC page, as fields: Sensory (colour / odour / texture) · Metal Detector · Defect · Moisture / Temp / %fine · remark · shift.
 * qc = state from qcForm.emptyQc() · onChange(patch) · errors = validateQc().errors (shown after the user pressed confirm)
 */
const QcFormFields = ({ qc, onChange, errors = {} }) => {
  const [workAreas, setWorkAreas] = useState([]);
  const [detectors, setDetectors] = useState([]);
  useEffect(() => {
    let cancel = false;
    Promise.allSettled([axios.get(`${API_URL}/api/work-areas`), axios.get(`${API_URL}/api/metal-detectors`)]).then(([a, d]) => {
      if (cancel) return;
      if (a.status === "fulfilled" && a.value.data?.success) setWorkAreas(a.value.data.data || []);
      else console.error("[QcFormFields] work areas error:", a.reason?.message);
      if (d.status === "fulfilled" && d.value.data?.success) setDetectors((d.value.data.data || []).filter((m) => m.Status === true));
      else console.error("[QcFormFields] metal detectors error:", d.reason?.message);
    });
    return () => { cancel = true; };
  }, []);

  const sensoryFail = [qc.color, qc.odor, qc.texture].includes("0");
  const set = (k) => (v) => onChange({ [k]: v });
  const text = (k, label, props = {}) => (
    <TextField size="small" fullWidth label={label} value={qc[k]} onChange={(e) => onChange({ [k]: e.target.value })} {...props} />
  );

  return (
    <Box>
      <Section title="Sensory" bad={errors.color || errors.odor || errors.texture || errors.sq_remark}>
        {[["color", "สี"], ["odor", "กลิ่น"], ["texture", "เนื้อสัมผัส"]].map(([k, label]) => (
          <Box key={k} sx={{ display: "flex", alignItems: "center" }}>
            <Typography sx={{ width: 100, color: "#666", fontSize: 14 }}>{label}</Typography>
            {PASS_FAIL(qc[k], set(k), undefined, errors[k])}
          </Box>
        ))}
        {sensoryFail && (
          <>
            {text("sq_remark", "หมายเหตุ Sensory (ที่ไม่ผ่าน)", { sx: { mt: 1 }, error: !!errors.sq_remark, helperText: errors.sq_remark })}
            <FormControlLabel control={<Checkbox size="small" checked={qc.Sensoryacceptance} onChange={(e) => onChange({ Sensoryacceptance: e.target.checked })} />} label="ยอมรับ (Sensory acceptance)" />
          </>
        )}
      </Section>

      <Section title="Metal Detector (MD)" bad={errors.md || errors.workArea || errors.mdNo}>
        {PASS_FAIL(qc.md, (v) => onChange({ md: v, ...(v === "0" ? { workArea: null, mdNo: null, md_time: null } : {}) }), ["ผ่าน", "รอผ่าน MD"], errors.md)}
        {qc.md === "1" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 0.5 }}>
            <Autocomplete size="small" options={workAreas} value={qc.workArea} onChange={(_, v) => onChange({ workArea: v, mdNo: null })}
              getOptionLabel={(o) => o.DisplayName || `${o.WorkAreaCode} - ${o.WorkAreaName}`} isOptionEqualToValue={(o, v) => o.WorkAreaCode === v.WorkAreaCode}
              noOptionsText="ไม่พบพื้นที่" renderInput={(p) => <TextField {...p} label="พื้นที่เครื่อง MD" error={!!errors.workArea} helperText={errors.workArea} />} />
            <Autocomplete size="small" options={detectors} value={qc.mdNo} onChange={(_, v) => onChange({ mdNo: v })}
              getOptionLabel={(o) => o.md_no || ""} isOptionEqualToValue={(o, v) => o.md_no === v.md_no}
              noOptionsText="ไม่พบเครื่อง MD" renderInput={(p) => <TextField {...p} label="เลือกเครื่อง MD" error={!!errors.mdNo} helperText={errors.mdNo} />} />
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DateTimePicker label="เวลาตรวจ MD" ampm={false} maxDateTime={dayjs()} value={qc.md_time} onChange={(v) => onChange({ md_time: v })}
                slotProps={{ textField: { size: "small", fullWidth: true } }} />
            </LocalizationProvider>
          </Box>
        )}
        {text("md_remark", "หมายเหตุ MD", { sx: { mt: 1 } })}
      </Section>

      <Section title="Defect" bad={errors.defect || errors.defect_remark}>
        {PASS_FAIL(qc.defect, set("defect"), undefined, errors.defect)}
        {qc.defect === "0" && (
          <>
            {text("defect_remark", "หมายเหตุ Defect (ที่ไม่ผ่าน)", { sx: { mt: 1 }, error: !!errors.defect_remark, helperText: errors.defect_remark })}
            <FormControlLabel control={<Checkbox size="small" checked={qc.Defectacceptance} onChange={(e) => onChange({ Defectacceptance: e.target.checked })} />} label="ยอมรับ (Defect acceptance)" />
          </>
        )}
      </Section>

      <Section title="ค่าที่วัดได้ / หมายเหตุทั่วไป">
        <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
          {text("Moisture", "Moisture")}
          {text("Temp", "Temp (°C)")}
          {text("percent_fine", "% Fine")}
        </Box>
        {text("general_remark", "หมายเหตุทั่วไป", { multiline: true, minRows: 2 })}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
          <Typography sx={{ fontSize: 14, color: "#666" }}>เตรียมงานให้กะ</Typography>
          {["DS", "NS"].map((s) => (
            <Button key={s} size="small" variant={qc.shift === s ? "contained" : "outlined"} onClick={() => onChange({ shift: qc.shift === s ? "" : s })}>{s}</Button>
          ))}
        </Box>
      </Section>
    </Box>
  );
};

export default QcFormFields;
