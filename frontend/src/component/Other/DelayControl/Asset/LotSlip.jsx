import { useState } from "react";
import { createPortal } from "react-dom";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import { fmtAt } from "./lotCalc";

// Slips of the Role "Other" for the 72.1 mm thermal printer (same paper as the QC Check slip): one or several (e.g. every set of a "จัดชุด"),
// one paper each. The printed copy is a separate block at the end of <body>: printing hides everything else (also this dialog),
// so a long list is not cut at the height of the dialog.
const PRINT_CSS = `
.other-print-root { display: none; }
@media print {
  @page { size: 80mm auto; margin: 0; }
  body > *:not(.other-print-root) { display: none !important; }
  .other-print-root { display: block !important; }
  .other-print-root .other-slip { width: 80mm; box-sizing: border-box; padding: 0; color: #000; background: #fff; break-after: page; page-break-after: always; }
  .other-print-root .other-slip:last-child { break-after: auto; page-break-after: auto; }
}`;

const Info = ({ label, value, bold }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "1px 0" }}>
    <span style={{ color: "#444" }}>{label}</span>
    <span style={{ fontWeight: bold ? 700 : 500, textAlign: "right" }}>{value}</span>
  </div>
);

/** one slip: what it is, then one row per time stamp */
const SlipBody = ({ slip }) => (
  <div style={{ fontFamily: "'Prompt', sans-serif", color: "#000" }}>
    <div style={{ fontWeight: 700, fontSize: 17, textAlign: "center" }}>{slip.title}</div>
    <div style={{ fontWeight: 700, fontSize: 22, textAlign: "center", letterSpacing: 1 }}>ID {slip.code}</div>
    <Divider sx={{ my: 0.75, borderStyle: "dashed", borderColor: "#999" }} />
    <Info label="รายการ" value={slip.lot.lot_name} bold />
    {slip.lot.ref_code ? <Info label="Batch / รหัส" value={slip.lot.ref_code} /> : null}
    <Info label="น้ำหนัก" value={`${slip.kg} kg`} bold />
    <Divider sx={{ my: 0.75, borderStyle: "dashed", borderColor: "#999" }} />
    {slip.rows.map((r, i) => (
      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13.5, padding: "3px 0", borderBottom: i < slip.rows.length - 1 ? "1px dotted #bbb" : "none" }}>
        <span>{r.label}</span>
        <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fmtAt(r.at)}{r.note ? ` (${r.note})` : ""}</span>
      </div>
    ))}
    <Divider sx={{ my: 0.75, borderStyle: "dashed", borderColor: "#999" }} />
    <div style={{ fontSize: 11, color: "#444" }}>ผู้บันทึก {slip.by || "-"} · พิมพ์ {fmtAt(Date.now())}</div>
  </div>
);

/** slips: [slip] (see slips.js) or null */
const LotSlip = ({ slips, onClose }) => {
  const [only, setOnly] = useState(null); // print one slip of the list
  if (!slips?.length) return null;
  const printed = only ? slips.filter((s) => s.key === only) : slips;
  const print = (key) => {
    setOnly(key);
    setTimeout(() => { window.print(); setOnly(null); }, 50); // let the print copy show only that slip first
  };
  return (
    <>
      <style>{PRINT_CSS}</style>
      <Dialog open onClose={(e, reason) => { if (reason !== "backdropClick") onClose(); }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{slips.length > 1 ? `สลิป ${slips.length} ใบ` : slips[0].title}</DialogTitle>
        <DialogContent dividers sx={{ background: "#F4F6FA" }}>
          {slips.map((s) => (
            <Box key={s.key} sx={{ position: "relative", background: "#fff", border: "1px dashed #B0BAC9", borderRadius: 1, p: 1.5, mb: 1.5, maxWidth: 300, mx: "auto" }}>
              {slips.length > 1 && (
                <IconButton size="small" title="พิมพ์ใบนี้" onClick={() => print(s.key)} sx={{ position: "absolute", top: 4, right: 4 }}><PrintIcon fontSize="small" /></IconButton>
              )}
              <SlipBody slip={s} />
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>ปิด</Button>
          <Button variant="contained" color="secondary" startIcon={<PrintIcon />} onClick={() => print(null)}>
            {slips.length > 1 ? `พิมพ์ทั้งหมด ${slips.length} ใบ` : "พิมพ์สลิป"}
          </Button>
        </DialogActions>
      </Dialog>
      {createPortal(
        <div className="other-print-root">{printed.map((s) => <div className="other-slip" key={s.key}><SlipBody slip={s} /></div>)}</div>,
        document.body,
      )}
    </>
  );
};

export default LotSlip;
