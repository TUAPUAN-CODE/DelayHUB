import { Box, Button, Dialog, DialogActions, DialogContent, Divider, Typography } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import { fmtAt, fmtThaiMin, LIMIT_INSIDE_MIN, LIMIT_OUTSIDE_MIN, LIMIT_OUTSIDE_TOTAL_MIN } from "./lotCalc";

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

// one step of the timeline: "02:07 > 03:07 = 1 ชม ผ่าน"
const Step = ({ no, title, limit, from, to, minutes, limitMin }) => {
  const pass = minutes <= limitMin;
  return (
    <Box sx={{ py: 0.5 }}>
      <div style={{ fontWeight: 700, fontSize: 12.5 }}>{no}. {title} <span style={{ fontWeight: 500 }}>· คุม {limit}</span></div>
      <div style={{ fontSize: 12.5 }}>
        {fmtAt(from)} &gt; {fmtAt(to)} = {fmtThaiMin(minutes)}{" "}
        <b style={{ color: pass ? "#2E7D32" : "#C62828" }}>{pass ? "ผ่าน" : "เกิน"}</b>
      </div>
    </Box>
  );
};

/** slip: { lot, outAt (ms), kg, chunks: [{ kg, inAt, outAt, minutes, prepAt, prepMin, packLeftMin, packBy }], by } */
const OutSlip = ({ slip, onClose }) => {
  if (!slip) return null;
  const { lot, outAt, kg, chunks, by } = slip;
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
          {chunks.map((c, i) => (
            <Box key={i} sx={{ pb: 0.5, ...(i ? { borderTop: "1px dashed #bbb", pt: 0.5 } : {}) }}>
              {chunks.length > 1 && <div style={{ fontWeight: 700, fontSize: 13 }}>ส่วนที่ {i + 1}: {c.kg} kg</div>}
              <Step no={1} title="เตรียมเสร็จ → เข้าห้องเย็น" limit={fmtThaiMin(LIMIT_OUTSIDE_MIN)} from={c.prepAt} to={c.inAt} minutes={c.prepMin} limitMin={LIMIT_OUTSIDE_MIN} />
              <Step no={2} title={c.lidAt ? "ในห้องเย็น (เปิดฝาแล้ว)" : "ในห้องเย็น"} limit={fmtThaiMin(c.limit ?? LIMIT_INSIDE_MIN)} from={c.inAt} to={c.outAt} minutes={c.minutes} limitMin={c.limit ?? LIMIT_INSIDE_MIN} />
              {c.lidAt ? <div style={{ fontSize: 11.5, color: "#555" }}>เปิดฝา {fmtAt(c.lidAt)} → ต้องออกภายใน 12 ชม (ไม่เกิน 24 ชม นับจากเข้าห้องเย็น)</div> : null}
              <Box sx={{ py: 0.5 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5 }}>3. ออกห้องเย็น → บรรจุเสร็จ <span style={{ fontWeight: 500 }}>· คุม {fmtThaiMin(c.packLeftMin)}</span></div>
                <div style={{ fontSize: 11.5, color: "#555" }}>
                  (นอกห้องเย็นรวม {fmtThaiMin(LIMIT_OUTSIDE_TOTAL_MIN)} − ช่วงที่ 1 ใช้ {fmtThaiMin(c.prepMin)} = เหลือ {fmtThaiMin(c.packLeftMin)})
                </div>
                {c.packLeftMin > 0 ? (
                  <div style={{ fontSize: 12.5 }}>{fmtAt(c.outAt)} &gt; ต้องบรรจุเสร็จภายใน <b>{fmtAt(c.packBy)}</b></div>
                ) : (
                  <div style={{ fontSize: 12.5, color: "#C62828", fontWeight: 700 }}>ไม่เหลือเวลา: ใช้เวลานอกห้องเย็นครบ {fmtThaiMin(LIMIT_OUTSIDE_TOTAL_MIN)} แล้ว</div>
                )}
              </Box>
            </Box>
          ))}
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
