import { useMemo } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { findSameCodeDifferentBatch } from "./fishBatch";

/**
 * ตรวจ (ปลา): Code เดียวกัน (แผนผลิต + ไลน์) แต่ Batch แปลง (2x) คนละ Batch — จากแถวที่ดึงมาในหน้าดำเนินการเสร็จสิ้น
 * rows = แถวดิบจาก /api/sheet/done (หลังเลือกกะแล้ว)
 */
// สีพื้นหลังแยกตาม Batch ตั้งต้น (วนสีตามลำดับ Batch ในแต่ละ Code) — แถวของ Batch เดียวกันได้สีเดียวกัน
const BATCH_COLORS = [
  { bg: "#DBEAFE", bar: "#2563EB" },
  { bg: "#FCE7F3", bar: "#DB2777" },
  { bg: "#DCFCE7", bar: "#16A34A" },
  { bg: "#FEF3C7", bar: "#D97706" },
  { bg: "#EDE9FE", bar: "#7C3AED" },
  { bg: "#CCFBF1", bar: "#0D9488" },
];
const fmtDay = (d) => { const [y, m, x] = String(d || "").split("-"); return y ? `${x}/${m}/${y}` : "-"; };

const SameCodeBatchDialog = ({ open, rows, onClose }) => {
  const groups = useMemo(() => (open ? findSameCodeDifferentBatch(rows) : []), [open, rows]);
  const total = useMemo(() => groups.reduce((n, sec) => n + sec.groups.length, 0), [groups]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700 }}>ตรวจ Code เดียวกัน ไลน์เดียวกัน คนละ Batch (ปลา)</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          ตรวจเฉพาะวัตถุดิบกลุ่มปลาในแถวที่ดึงมา: Code (แผนผลิต + ไลน์) และวัตถุดิบ (Mat) เดียวกัน ที่มี Batch ตั้งต้น 2 Batch ขึ้นไป — แยกตามวันและกะของโรงงาน (เวลาบรรจุเสร็จ · 00:00–05:59 นับเป็นกะ NS ของวันก่อนหน้า)
        </Typography>
        {groups.length === 0 ? (
          <Alert severity="success">ไม่พบ Code ที่เดินคนละ Batch ในข้อมูลที่ดึงมา</Alert>
        ) : (
          <>
            <Alert severity="warning" sx={{ mb: 1.5 }}>{`พบ ${total} Code ที่เดินหลาย Batch`}</Alert>
            {groups.map((sec) => (
              <Box key={`${sec.day}|${sec.shift}`} sx={{ mb: 2.5 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 1, px: 1.25, py: 0.5, borderRadius: "8px", background: sec.shift === "NS" ? "#E0E7FF" : "#FEF3C7", color: sec.shift === "NS" ? "#3730A3" : "#92400E" }}>
                  {`วันที่ ${fmtDay(sec.day)} · กะ ${sec.shift || "-"}${sec.shift === "NS" ? " (17:30–06:00)" : sec.shift === "DS" ? " (06:00–17:30)" : ""}`}
                </Typography>
                {sec.groups.map((g) => (
                  <Box key={`${g.code}|${g.mat}`} sx={{ mb: 2 }}>
                    <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{`${g.code} · ${g.mat_name || g.mat} (${g.mat}) — ${g.batches.length} Batch`}</Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow><TableCell>Batch ตั้งต้น</TableCell><TableCell>Batch แปลง (2x)</TableCell><TableCell>รายการ</TableCell><TableCell>วัตถุดิบ</TableCell><TableCell>บรรจุเสร็จ</TableCell></TableRow>
                      </TableHead>
                      <TableBody>
                        {g.batches.flatMap((b, bi) => b.rows.map((r) => (
                          <TableRow key={r.mapping_id} sx={{ background: BATCH_COLORS[bi % BATCH_COLORS.length].bg }}>
                            <TableCell sx={{ fontWeight: 600, borderLeft: `6px solid ${BATCH_COLORS[bi % BATCH_COLORS.length].bar}` }}>{b.batch}</TableCell>
                            <TableCell>{r.batch_after || "-"}</TableCell>
                            <TableCell>{r.mapping_id}</TableCell>
                            <TableCell>{r.mat_name || r.mat || "-"}</TableCell>
                            <TableCell>{String(r.sc_pack_date || "").slice(0, 16).replace("T", " ") || "-"}</TableCell>
                          </TableRow>
                        )))}
                      </TableBody>
                    </Table>
                  </Box>
                ))}
              </Box>
            ))}
          </>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>ปิด</Button></DialogActions>
    </Dialog>
  );
};

export default SameCodeBatchDialog;
