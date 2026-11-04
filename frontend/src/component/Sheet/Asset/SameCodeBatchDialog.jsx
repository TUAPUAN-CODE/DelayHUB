import { useMemo } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { findSameCodeDifferentBatch } from "./fishBatch";

/**
 * ตรวจ (ปลา): Code เดียวกัน (แผนผลิต + ไลน์) แต่ Batch แปลง (2x) คนละ Batch — จากแถวที่ดึงมาในหน้าดำเนินการเสร็จสิ้น
 * rows = แถวดิบจาก /api/sheet/done (หลังเลือกกะแล้ว)
 */
const SameCodeBatchDialog = ({ open, rows, onClose }) => {
  const groups = useMemo(() => (open ? findSameCodeDifferentBatch(rows) : []), [open, rows]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700 }}>ตรวจ Code เดียวกัน ไลน์เดียวกัน คนละ Batch (ปลา)</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          ตรวจเฉพาะวัตถุดิบกลุ่มปลาในแถวที่ดึงมา: Code (แผนผลิต + ไลน์) เดียวกันที่มี Batch ตั้งต้น 2 Batch ขึ้นไป
        </Typography>
        {groups.length === 0 ? (
          <Alert severity="success">ไม่พบ Code ที่เดินคนละ Batch ในข้อมูลที่ดึงมา</Alert>
        ) : (
          <>
            <Alert severity="warning" sx={{ mb: 1.5 }}>{`พบ ${groups.length} Code ที่เดินหลาย Batch`}</Alert>
            {groups.map((g) => (
              <Box key={g.code} sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{`${g.code} — ${g.batches.length} Batch`}</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow><TableCell>Batch ตั้งต้น</TableCell><TableCell>Batch แปลง (2x)</TableCell><TableCell>รายการ</TableCell><TableCell>วัตถุดิบ</TableCell><TableCell>บรรจุเสร็จ</TableCell></TableRow>
                  </TableHead>
                  <TableBody>
                    {g.batches.flatMap((b) => b.rows.map((r) => (
                      <TableRow key={r.mapping_id}>
                        <TableCell sx={{ fontWeight: 600 }}>{b.batch}</TableCell>
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
          </>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>ปิด</Button></DialogActions>
    </Dialog>
  );
};

export default SameCodeBatchDialog;
