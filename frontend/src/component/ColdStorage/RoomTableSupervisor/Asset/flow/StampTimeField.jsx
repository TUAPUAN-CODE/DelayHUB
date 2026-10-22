import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import dayjs from "dayjs";

/**
 * Date + time of a cold room check-in / check-out (/coldStorage Sheet): the page puts "now" in when the dialog opens, the user can change it.
 * 24 h clock (no AM / PM), not in the future. The server takes it as come_cold_at / out_cold_at ("YYYY-MM-DD HH:mm:ss", see stampText).
 */
export const stampText = (v) => (v && dayjs(v).isValid() ? dayjs(v).format("YYYY-MM-DD HH:mm:ss") : null);

/** "" when the value can be sent, else why not */
export const stampProblem = (v) => {
  if (!v || !dayjs(v).isValid()) return "กรุณาเลือกวันเวลา";
  if (dayjs(v).isAfter(dayjs().add(1, "minute"))) return "เลือกวันเวลาในอนาคตไม่ได้";
  if (dayjs(v).isBefore(dayjs().subtract(30, "day"))) return "เลือกย้อนหลังได้ไม่เกิน 30 วัน";
  return "";
};

const LOCALE_TEXT = { cancelButtonLabel: "ยกเลิก", okButtonLabel: "ตกลง", clearButtonLabel: "ล้าง", todayButtonLabel: "วันนี้" };

const StampTimeField = ({ label, value, onChange, disabled }) => {
  const problem = stampProblem(value);
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} localeText={LOCALE_TEXT}>
      <DateTimePicker
        label={label} value={value} onChange={onChange} disabled={disabled}
        ampm={false} format="DD/MM/YYYY HH:mm" views={["year", "month", "day", "hours", "minutes"]} timeSteps={{ minutes: 1 }}
        maxDateTime={dayjs().add(1, "minute")} minDateTime={dayjs().subtract(30, "day")}
        slotProps={{ textField: { size: "small", fullWidth: true, required: true, error: Boolean(problem), helperText: problem || " " } }}
      />
    </LocalizationProvider>
  );
};

export default StampTimeField;
