import { useEffect } from "react";
import { Box, Button, Dialog, Typography } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import { useRemarkCs } from "../../../Layout/RemarkCs";
import { STAGE_BUTTON, flowState } from "../flowStages";

const fmt = (v) => (v ? String(v).slice(0, 16).replace("T", " ") : "");

// 80 mm slip (the same print rules as the other slips of the system)
const PRINT_CSS = `
  @page { size: 80mm 297mm !important; margin: 0mm !important; padding: 0mm !important; }
  html, body { width: 80mm !important; margin: 0mm !important; padding: 0mm !important; overflow: hidden !important; }
  .print-container { width: 80mm !important; padding: 1mm !important; margin: 0mm !important; }
  @media print {
    .MuiDialog-paper { margin: 0mm !important; padding: 0mm !important; width: 80mm !important; max-width: 80mm !important; box-shadow: none !important; }
    .no-print { display: none !important; }
    .print-text { font-size: 10px !important; }
    .print-title { font-size: 12px !important; font-weight: bold !important; }
    .print-header { font-size: 14px !important; font-weight: bold !important; text-align: center !important; }
    .print-big { font-size: 22px !important; font-weight: bold !important; text-align: center !important; }
  }
`;

// only what has data is printed
const Line = ({ label, value }) => (value === null || value === undefined || value === "" ? null : (
  <Typography className="print-text" sx={{ fontSize: "20px", color: "#464646", margin: "6px 10px", overflowWrap: "anywhere", "@media print": { fontSize: "10px", margin: "2px 0" } }}>
    {label} : {value}
  </Typography>
));

const RemarkLine = ({ hu, mat, batch }) => {
  const text = useRemarkCs([{ mappingId: null, hu, mat, batch }]);
  return <Line label="Remark CS" value={text} />;
};

/**
 * "ปริ้นสลีป" of a Tuna scrap / CK bone plan row (it has no trolley and no mapping_id yet): the label that tells the cold room which material it is —
 * the flow number F…, the material, Batch, HU, weight, the steps done so far and the next one (a blank line to write the time by hand).
 */
const FlowSlip = ({ row, onClose }) => {
  useEffect(() => {
    const style = document.createElement("style");
    style.media = "print";
    style.appendChild(document.createTextNode(PRINT_CSS));
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);
  useEffect(() => {
    window.addEventListener("afterprint", onClose);
    return () => window.removeEventListener("afterprint", onClose);
  }, [onClose]);

  const { order, stamps } = flowState(row);
  const status = row.__status?.name || row.__status?.label || "";
  return (
    <Dialog open onClose={(e, reason) => { if (reason !== "backdropClick") onClose(); }}
      sx={{ "& .MuiDialog-paper": { width: "600px", "@media print": { width: "80mm !important", maxWidth: "80mm !important", margin: "0mm !important", padding: "0mm !important" } } }}>
      <Box className="print-container" sx={{ backgroundColor: "#fff", padding: "10px", "@media print": { width: "80mm !important", padding: "1mm !important" } }}>
        <Box className="no-print" sx={{ display: "flex", gap: 1, mb: 2 }}>
          <Button variant="contained" onClick={onClose} startIcon={<CancelIcon />} sx={{ flex: 1, height: 50, backgroundColor: "#ff4444", "&:hover": { backgroundColor: "#cc0000" } }}>ยกเลิก</Button>
          <Button variant="contained" onClick={() => window.print()} startIcon={<PrintIcon />} sx={{ flex: 1, height: 50, backgroundColor: "#1552F0", "&:hover": { backgroundColor: "#1552F0" } }}>กดที่นี่เพื่อ พิมพ์</Button>
        </Box>

        <Typography className="print-header" sx={{ fontSize: "22px", fontWeight: "bold", textAlign: "center", mb: 1, "@media print": { fontSize: "14px", marginBottom: "1mm" } }}>
          ป้ายระบุวัตถุดิบ (Flow)
        </Typography>
        <Typography className="print-big" sx={{ fontSize: "40px", fontWeight: "bold", textAlign: "center", mb: 1, "@media print": { fontSize: "22px", marginBottom: "1mm" } }}>
          {row.flow_id}
        </Typography>

        <Line label="วัตถุดิบ" value={row.mat_name} />
        <Line label="Mat" value={row.mat} />
        <Line label="Batch" value={row.batch} />
        <Line label="HU" value={row.hu} />
        <Line label="น้ำหนัก (kg)" value={row.weight_RM ?? row.weight} />
        <Line label="กลุ่มวัตถุดิบ" value={row.rm_group_name} />
        <Line label="แผนผลิต" value={row.code || row.production} />
        <Line label="เวลาอบเสร็จ/เตรียมเสร็จ" value={fmt(row.cooked_date)} />
        <RemarkLine hu={row.hu} mat={row.mat} batch={row.batch} />
        <Line label="สถานะ" value={status} />

        {order.some((k) => stamps[k]) && (
          <Typography className="print-title" sx={{ fontSize: "20px", color: "#000", margin: "10px", "@media print": { fontSize: "12px", fontWeight: "bold", margin: "4px 0" } }}>ขั้นตอน</Typography>
        )}
        {order.filter((k) => stamps[k]).map((k) => <Line key={k} label={STAGE_BUTTON[k]} value={fmt(stamps[k])} />)}
      </Box>
    </Dialog>
  );
};

export default FlowSlip;
