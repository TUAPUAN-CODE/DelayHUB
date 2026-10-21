import { FormControlLabel, Radio, RadioGroup, TextField } from "@mui/material";
import { toLocalInput } from "./lotCalc";

/** time of a stamp: "now" (taken by the server when saved) or typed by hand. value = { mode: "now" | "manual", manual: "yyyy-MM-ddTHH:mm" } */
export const newTime = () => ({ mode: "now", manual: toLocalInput() });
/** what the API expects: "" (= now) or "yyyy-MM-dd HH:mm:00" */
export const timeValue = (t) => (t.mode === "now" ? "" : `${t.manual.replace("T", " ")}:00`);

const TimeChoice = ({ label, value, onChange }) => (
  <div>
    <strong style={{ fontSize: 13 }}>{label}</strong>
    <RadioGroup value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value })}>
      <FormControlLabel value="now" control={<Radio size="small" />} label="เวลาตอนนี้ (stamp)" />
      <FormControlLabel value="manual" control={<Radio size="small" />} label="ใส่เวลาเอง" />
    </RadioGroup>
    {value.mode === "manual" && (
      <TextField size="small" type="datetime-local" fullWidth value={value.manual} onChange={(e) => onChange({ ...value, manual: e.target.value })} InputLabelProps={{ shrink: true }} />
    )}
  </div>
);

export default TimeChoice;
