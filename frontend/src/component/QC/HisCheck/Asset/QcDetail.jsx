import React from 'react';
import { Box, Card, Grid, TextField, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PaletteIcon from '@mui/icons-material/Palette';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';
import StraightenIcon from '@mui/icons-material/Straighten';
import FactCheckIcon from '@mui/icons-material/FactCheck';

/** QC result of a row (Sensory / MD / Defect, who checked and when): the tab "ผลตรวจ QC" of the detail box of the table */
const QcDetail = ({ row }) => {
  const getStatusButton = (status) => {
    if (!status || status.trim() === '-') return null;

    const statusLower = status.trim().toLowerCase();
    if (statusLower === 'ผ่าน' || statusLower.includes('pass')) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 1, mb: 1 }}>
          <Box sx={{ backgroundColor: '#388e3c', color: 'white', borderRadius: '20px', padding: '4px 16px', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '14px', fontWeight: 'medium' }}>
            <CheckIcon fontSize="small" />
            ผ่าน
          </Box>
        </Box>
      );
    } else if (statusLower === 'ไม่ผ่าน' || statusLower.includes('fail') || statusLower.includes('not')) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 1, mb: 1 }}>
          <Box sx={{ backgroundColor: '#d32f2f', color: 'white', borderRadius: '20px', padding: '4px 16px', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '14px', fontWeight: 'medium' }}>
            <CloseIcon fontSize="small" />
            ไม่ผ่าน
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 1, mb: 1 }}>
        <Box sx={{ backgroundColor: '#388e3c', color: 'white', borderRadius: '20px', padding: '4px 16px', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '14px', fontWeight: 'medium' }}>
          <CheckIcon fontSize="small" />
          {status}
        </Box>
      </Box>
    );
  };


  return (
    <Box sx={{ backgroundColor: '#f8f9fa', borderRadius: '4px', padding: '16px', border: '1px solid #E3E8F2' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <FactCheckIcon fontSize="small" sx={{ color: '#1552F0' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
          ข้อมูลการตรวจสอบ QC
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%', minHeight: '180px' }}>
            <Box sx={{ backgroundColor: '#EAF0FF', px: 2, py: 1.5, borderBottom: '1px solid #bbdefb' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PaletteIcon sx={{ color: '#1552F0' }} />
                <Typography variant="subtitle1" sx={{ color: '#1552F0', fontWeight: 'bold' }}>
                  Sensory (สี, กลิ่น, เนื้อ)
                </Typography>
              </Box>
            </Box>

            <Box sx={{ p: 2 }}>
              {getStatusButton(row?.qccheck?.trim())}

              {row?.sq_remark && row.sq_remark !== '-' && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'medium', mb: 0.5, display: 'block' }}>
                    {row?.sq_acceptance === true ? "ยอมรับพิเศษ หมายเหตุ Sensory:" : "หมายเหตุ Sensory:"}
                  </Typography>
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={row.sq_remark || '-'}
                    InputProps={{
                      readOnly: true,
                      sx: { fontSize: '14px', backgroundColor: row?.sq_acceptance === true ? '#fff8e1' : '#F5F8FF' }
                    }}
                    multiline
                    minRows={2}
                  />
                </Box>
              )}

              {(!row?.sq_remark || row.sq_remark === '-') && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="textSecondary">
                    ไม่มีหมายเหตุ
                  </Typography>
                </Box>
              )}
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%', minHeight: '180px' }}>
            <Box sx={{ backgroundColor: '#fff3e0', px: 2, py: 1.5, borderBottom: '1px solid #ffe0b2' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsInputComponentIcon sx={{ color: '#ff9800' }} />
                <Typography variant="subtitle1" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
                  MD (เครื่องตรวจโลหะ)
                </Typography>
              </Box>
            </Box>

            <Box sx={{ p: 2 }}>
              {getStatusButton(row?.mdcheck?.trim())}

              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'medium', mb: 0.5, display: 'block' }}>
                  พื้นที่/หมายเลขเครื่อง:
                </Typography>
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={
                    row?.WorkAreaName
                      ? `${row.WorkAreaName} (${row.WorkAreaCode || '-'}/${row.md_no || '-'})`
                      : `${row.WorkAreaCode || '-'}/${row.md_no || '-'}`
                  }
                  InputProps={{
                    readOnly: true,
                    sx: { fontSize: '14px', backgroundColor: '#F5F8FF' }
                  }}
                />
              </Box>

              {row?.md_remark && row.md_remark !== '-' && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'medium', mb: 0.5, display: 'block' }}>
                    หมายเหตุ:
                  </Typography>
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={row.md_remark || '-'}
                    InputProps={{
                      readOnly: true,
                      sx: { fontSize: '14px', backgroundColor: '#F5F8FF' }
                    }}
                    multiline
                    minRows={2}
                  />
                </Box>
              )}
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%', minHeight: '180px' }}>
            <Box sx={{ backgroundColor: '#ffebee', px: 2, py: 1.5, borderBottom: '1px solid #ffcdd2' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StraightenIcon sx={{ color: '#f44336' }} />
                <Typography variant="subtitle1" sx={{ color: '#f44336', fontWeight: 'bold' }}>
                  Defect (ขนาด, ก้าง)
                </Typography>
              </Box>
            </Box>

            <Box sx={{ p: 2 }}>
              {getStatusButton(row?.defectcheck?.trim())}

              {row?.defect_remark && row.defect_remark !== '-' && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'medium', mb: 0.5, display: 'block' }}>
                    {row?.defect_acceptance === true ? "ยอมรับพิเศษ หมายเหตุ Defect:" : "หมายเหตุ Defect:"}
                  </Typography>
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={row.defect_remark || '-'}
                    InputProps={{
                      readOnly: true,
                      sx: { fontSize: '14px', backgroundColor: row?.defect_acceptance === true ? '#fff8e1' : '#F5F8FF' }
                    }}
                    multiline
                    minRows={2}
                  />
                </Box>
              )}

              {(!row?.defect_remark || row.defect_remark === '-') && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="textSecondary">
                    ไม่มีหมายเหตุ
                  </Typography>
                </Box>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 2, alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon sx={{ color: '#1552F0' }} />
          <Typography variant="body2" sx={{ color: '#555' }}>
            <b>ผู้ดำเนินการ:</b> {row?.receiver_qc ?? '-'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarTodayIcon sx={{ color: '#1552F0' }} />
          <Typography variant="body2" sx={{ color: '#555' }}>
            <b>วันเวลาที่ QC ตรวจสอบ:</b> {row?.qc_datetime_formatted ?? '-'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default QcDetail;
