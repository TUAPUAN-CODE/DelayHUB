import { useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup, Typography } from "@mui/material";

const LineTypeDialog = ({ plan, lineTypes, suggestedId, onSave, onCancel }) => {
  const [selected, setSelected] = useState(String(lineTypes.some((t) => t.line_type_id === suggestedId) ? suggestedId : lineTypes[0]?.line_type_id ?? ""));

  return (
    // closes only from its own buttons (a click outside / Esc does nothing): a half-answered question must not create or skip a plan by accident
    <Dialog open maxWidth="xs" fullWidth disableEscapeKeyDown onClose={() => {}}>
      <DialogTitle>สร้างแผนการผลิตใหม่</DialogTitle>
      <DialogContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{`${plan.code} (${plan.doc_no})`}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          แผนนี้มาจากระบบสูตรและยังไม่มีใน PFCM เลือกประเภทไลน์ก่อนบันทึก
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>ประเภทไลน์</Typography>
        <RadioGroup value={selected} onChange={(e) => setSelected(e.target.value)}>
          {lineTypes.map((t) => (
            <FormControlLabel
              key={t.line_type_id}
              value={String(t.line_type_id)}
              control={<Radio size="small" />}
              label={
                <Box component="span">
                  {t.line_type_name}
                  {t.line_type_id === suggestedId && (
                    <Typography component="span" variant="caption" color="primary" sx={{ ml: 1 }}>แนะนำจากบรรจุภัณฑ์</Typography>
                  )}
                </Box>
              }
            />
          ))}
        </RadioGroup>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>ยกเลิก</Button>
        <Button variant="contained" disabled={!selected} onClick={() => onSave(Number(selected))}>บันทึกแผนการผลิต</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LineTypeDialog;
