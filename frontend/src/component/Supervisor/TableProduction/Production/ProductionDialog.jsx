import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import MainProduction from "./Asset/MainProduction";

/**
 * The production plan table of /sup/Production, opened over another page (e.g. the prep "บันทึกการเบิกวัตถุดิบ" form)
 * so a plan that is missing can be added without the /sup menu: only this table, nothing else of the Supervisor pages.
 * onClose: the caller re-loads its plan list.
 */
const ProductionDialog = ({ open, onClose }) => (
  <Dialog open={open} onClose={onClose} fullScreen>
    <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box sx={{ flex: 1 }}>ตารางจัดการแผนการผลิต</Box>
      <Button variant="contained" color="secondary" onClick={onClose}>เสร็จแล้ว กลับไปเลือกแผน</Button>
      <IconButton aria-label="ปิด" onClick={onClose}><CloseIcon /></IconButton>
    </DialogTitle>
    <DialogContent dividers>
      {open && <MainProduction />}
    </DialogContent>
  </Dialog>
);

export default ProductionDialog;
