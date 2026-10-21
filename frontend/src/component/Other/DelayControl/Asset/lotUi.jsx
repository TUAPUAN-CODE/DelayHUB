import { Chip } from "@mui/material";
import { fmtMin } from "./lotCalc";

// shared by the work page (DelayControlPage) and the History page (DelayHistoryPage)
export const LEVEL = {
  green: { bg: "#E8F5E9", fg: "#2E7D32", border: "#2E7D32" },
  yellow: { bg: "#FFF8E1", fg: "#B26A00", border: "#B26A00" },
  red: { bg: "#FDECEA", fg: "#C62828", border: "#C62828" },
};
// small tables inside an opened row
export const SUB = { background: "#fff", border: "1px solid #E1E9FA", borderRadius: 2, "& .MuiTableHead-root .MuiTableCell-root": { fontWeight: 700, fontSize: 12.5, color: "#5B6B8C", backgroundColor: "#F4F7FD", borderColor: "#E1E9FA" }, "& td": { fontSize: 13 } };
export const HEAD = { background: "#1552F0", color: "#fff", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" };
export const DIM = { color: "#B0BAC9" };
export const userName = () => [localStorage.getItem("first_name"), localStorage.getItem("last_name")].filter((v) => v && v !== "null").join(" ") || localStorage.getItem("user_id") || "";
export const apiError = (err, fallback = "บันทึกไม่สำเร็จ") => err?.response?.data?.error || err?.message || fallback;

/** "2 h 5 m / 2 h" — green / yellow / red by the time that is left of the limit */
export const Clock = ({ chunk, limit }) => {
  if (!chunk) return <span style={DIM}>-</span>;
  const c = LEVEL[chunk.level];
  const lim = chunk.limit ?? limit;
  return (
    <Chip
      size="small" label={`${fmtMin(chunk.minutes)} / ${fmtMin(lim)}${chunk.lidAt ? " (เปิดฝา)" : ""}`}
      sx={{ fontWeight: 700, background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    />
  );
};

/** ID of a lot in the tables */
export const LotId = ({ lot }) => <span style={{ fontWeight: 700, color: "#1552F0", whiteSpace: "nowrap" }}>#{lot.lot_id}</span>;
