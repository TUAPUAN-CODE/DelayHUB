import { Box, Button, Dialog, DialogActions, DialogContent, Divider, Typography } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import { fmtAt, fmtMin, LIMIT_INSIDE_MIN, LIMIT_OUTSIDE_MIN } from "./lotCalc";

// Slip of one "ออกห้องเย็น" stamp, for the 72.1 mm thermal printer (same paper as the QC Check slip).
// Printing hides the rest of the page; only the slip (.other-slip) is printed.
const PRINT_CSS = `
@media print {
  @page { size: 72.1mm auto; margin: 0; }
  body * { visibility: hidden !important; }
  .other-slip, .other-slip * { visibility: visible !important; }
  .other-slip { position: fixed; left: 0; top: 0; width: 72.1mm; padding: 2mm; color: #000; background: #fff; font-size: 11px; }
}`;

const Line = ({ label, value, bold }) => (
  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, fontSize: 13, py: 0.25 }}>
    <span style={{ color: "#444" }}>{label}</span>
    <span style={{ fontWeight: bold ? 700 : 500, textAlign: "right" }}>{value}</span>
  </Box>
);

/** slip: { lot, outAt (ms), kg, chunks: [{ kg, inAt, outAt, minutes }], outside: [{ kg, minutes }], by } */
const OutSlip = ({ slip, onClose }) => {
  if (!slip) return null;
  const { lot, outAt, kg, chunks, outside, by } = slip;
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <style>{PRINT_CSS}</style>
      <DialogContent>
        <Box className="other-slip" sx={{ fontFamily: "'Prompt', sans-serif" }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, textAlign: "center" }}>สลิปออกห้องเย็น</Typography>
          <Typography sx={{ fontSize: 12, textAlign: "center", color: "#555", mb: 1 }}>{fmtAt(outAt)}</Typography>
          <Divider sx={{ my: 1, borderStyle: "dashed" }} />
          <Line label="รายการ" value={lot.lot_name} bold />
          {lot.ref_code ? <Line label="Batch / รหัส" value={lot.ref_code} /> : null}
          <Line label="น้ำหนักที่ออก" value={`${kg} kg`} bold />
          <Line label="เตรียมเสร็จ" value={fmtAt(lot.prep_done_at)} />
          <Divider sx={{ my: 1, borderStyle: "dashed" }} />
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>ในห้องเย็น (เข้า → ออก)</Typography>
          {chunks.map((c, i) => (
            <Box key={i} sx={{ fontSize: 12.5, py: 0.25 }}>
              <div>{c.kg} kg · {fmtMin(c.minutes)} / {fmtMin(LIMIT_INSIDE_MIN)}</div>
              <div style={{ color: "#555" }}>{fmtAt(c.inAt)} → {fmtAt(c.outAt)}</div>
            </Box>
          ))}
          {outside.length > 0 && (
            <>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mt: 0.75 }}>นอกห้องเย็น (เตรียมเสร็จ → เข้าห้องเย็น)</Typography>
              {outside.map((c, i) => <Box key={i} sx={{ fontSize: 12.5 }}>{c.kg} kg · {fmtMin(c.minutes)} / {fmtMin(LIMIT_OUTSIDE_MIN)}</Box>)}
            </>
          )}
          <Divider sx={{ my: 1, borderStyle: "dashed" }} />
          <Line label="ผู้บันทึก" value={by || "-"} />
          <Line label="พิมพ์เมื่อ" value={fmtAt(Date.now())} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ปิด</Button>
        <Button variant="contained" color="secondary" startIcon={<PrintIcon />} onClick={() => window.print()}>พิมพ์สลิป</Button>
      </DialogActions>
    </Dialog>
  );
};

export default OutSlip;
