import { Box, Typography } from "@mui/material";

// ค่าทั้งหมดของแถวที่เลือก ตามคอลัมน์ของตาราง (รวมคอลัมน์ที่ซ่อนอยู่) — ใช้หัวคอลัมน์เป็นป้ายชื่อ
const hidden = (k) => k.startsWith("__");
const shown = (v) => {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

const RowDetail = ({ row, columns = [], title = "รายละเอียดแถว" }) => {
  const labelOf = Object.fromEntries(columns.map((c) => [c.key, c.label]));
  const keys = columns.map((c) => c.key).filter((k) => !hidden(k) && labelOf[k] && k in row && typeof row[k] !== "function");

  return (
    <Box sx={{ p: 2 }}>
      <Typography sx={{ fontWeight: 700, mb: 1.5, color: "#1552F0" }}>{title}</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(120px, 40%) 1fr", columnGap: 1.5, rowGap: 1 }}>
        {keys.map((k) => (
          <Box key={k} sx={{ display: "contents" }}>
            <Typography variant="caption" sx={{ color: "#5B6B8C", fontWeight: 600, wordBreak: "break-word", alignSelf: "center" }}>
              {labelOf[k]}
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: "break-word", fontWeight: 500 }}>{shown(row[k])}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default RowDetail;
