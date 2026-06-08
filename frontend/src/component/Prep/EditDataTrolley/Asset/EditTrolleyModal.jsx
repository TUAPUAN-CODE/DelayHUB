import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    MenuItem,
    Grid,
    IconButton,
    Box,
    Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const EditTrolleyModal = ({ open, onClose, editingRow, formData, onInputChange, onSave }) => {
    const statusOptions = [
        'รถเข็นว่าง (ห้องเย็น)',
        'มีวัตถุดิบ',
        'รอบรรจุจัดส่ง',
        'อื่นๆ'
    ];

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '12px',
                    boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.1)'
                }
            }}
        >
            <DialogTitle sx={{
                backgroundColor: 'hsl(210, 100%, 60%)',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px'
            }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    แก้ไขข้อมูลรถเข็น
                </Typography>
                <IconButton
                    onClick={onClose}
                    sx={{
                        color: 'white',
                        '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)'
                        }
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ padding: '24px', backgroundColor: '#f8f9fa' }}>
                <Grid container spacing={3} sx={{ marginTop: '4px' }}>
                    {/* หมายเลขรถเข็น */}
                    {/* <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ marginBottom: '8px', color: '#787878', fontWeight: '500' }}>
                            หมายเลขรถเข็น
                        </Typography>
                        <TextField
                            fullWidth
                            value={formData.trolley_number}
                            onChange={(e) => onInputChange('trolley_number', e.target.value)}
                            placeholder="กรอกหมายเลขรถเข็น"
                            sx={{
                                backgroundColor: 'white',
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '8px',
                                }
                            }}
                        />
                    </Grid> */}

                    {/* สถานะรถเข็น */}
                    {/* <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ marginBottom: '8px', color: '#787878', fontWeight: '500' }}>
                            สถานะรถเข็น
                        </Typography>
                        <TextField
                            select
                            fullWidth
                            value={formData.trolley_status}
                            onChange={(e) => onInputChange('trolley_status', e.target.value)}
                            placeholder="เลือกสถานะรถเข็น"
                            sx={{
                                backgroundColor: 'white',
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '8px',
                                }
                            }}
                        >
                            {statusOptions.map((option) => (
                                <MenuItem key={option} value={option}>
                                    {option}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid> */}

                    {/* Batch */}
                    <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ marginBottom: '8px', color: '#787878', fontWeight: '500' }}>
                            Batch
                        </Typography>
                        <TextField
                            fullWidth
                            value={formData.batch}
                            onChange={(e) => onInputChange('batch', e.target.value)}
                            placeholder="กรอก Batch"
                            sx={{
                                backgroundColor: 'white',
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '8px',
                                }
                            }}
                        />
                    </Grid>

                    {/* Material */}
                    <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ marginBottom: '8px', color: '#787878', fontWeight: '500' }}>
                            Material
                        </Typography>
                        <TextField
                            fullWidth
                            value={formData.mat}
                            onChange={(e) => onInputChange('mat', e.target.value)}
                            placeholder="กรอก Material"
                            sx={{
                                backgroundColor: 'white',
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '8px',
                                }
                            }}
                        />
                    </Grid>

                    {/* รายชื่อวัตถุดิบ */}
                    <Grid item xs={12}>
                        <Typography variant="body2" sx={{ marginBottom: '8px', color: '#787878', fontWeight: '500' }}>
                            รายชื่อวัตถุดิบ
                        </Typography>
                        <TextField
                            fullWidth
                            value={formData.mat_name}
                            onChange={(e) => onInputChange('mat_name', e.target.value)}
                            placeholder="กรอกรายชื่อวัตถุดิบ"
                            sx={{
                                backgroundColor: 'white',
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '8px',
                                }
                            }}
                        />
                    </Grid>

                    {/* แผนการผลิต */}
                    <Grid item xs={12}>
                        <Typography variant="body2" sx={{ marginBottom: '8px', color: '#787878', fontWeight: '500' }}>
                            แผนการผลิต
                        </Typography>
                        <TextField
                            fullWidth
                            value={formData.production}
                            onChange={(e) => onInputChange('production', e.target.value)}
                            placeholder="กรอกแผนการผลิต"
                            sx={{
                                backgroundColor: 'white',
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '8px',
                                }
                            }}
                        />
                    </Grid>
                    

                    {/* เวลาอบเสร็จ/ต้มเสร็จ */}
                    {/* <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ marginBottom: '8px', color: '#787878', fontWeight: '500' }}>
                            เวลาอบเสร็จ/ต้มเสร็จ
                        </Typography>
                        <TextField
                            fullWidth
                            type="datetime-local"
                            value={formData.cooked_date}
                            onChange={(e) => onInputChange('cooked_date', e.target.value)}
                            sx={{
                                backgroundColor: 'white',
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '8px',
                                }
                            }}
                            InputLabelProps={{
                                shrink: true,
                            }}
                        />
                    </Grid> */}

                    {/* เวลาเตรียมเสร็จ */}
                    {/* <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ marginBottom: '8px', color: '#787878', fontWeight: '500' }}>
                            เวลาเตรียมเสร็จ
                        </Typography>
                        <TextField
                            fullWidth
                            type="datetime-local"
                            value={formData.rmit_date}
                            onChange={(e) => onInputChange('rmit_date', e.target.value)}
                            sx={{
                                backgroundColor: 'white',
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '8px',
                                }
                            }}
                            InputLabelProps={{
                                shrink: true,
                            }}
                        />
                    </Grid> */}

                    {/* สถานที่รถเข็น */}
                    {/* <Grid item xs={12}>
                        <Typography variant="body2" sx={{ marginBottom: '8px', color: '#787878', fontWeight: '500' }}>
                            สถานที่รถเข็น
                        </Typography>
                        <TextField
                            fullWidth
                            multiline
                            rows={2}
                            value={formData.trolley_location}
                            onChange={(e) => onInputChange('trolley_location', e.target.value)}
                            placeholder="กรอกสถานที่รถเข็น"
                            sx={{
                                backgroundColor: 'white',
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '8px',
                                }
                            }}
                        />
                    </Grid> */}
                </Grid>
            </DialogContent>

            <DialogActions sx={{
                padding: '16px 24px',
                backgroundColor: '#f8f9fa',
                borderTop: '1px solid #e0e0e0'
            }}>
                <Button
                    onClick={onClose}
                    sx={{
                        color: '#787878',
                        textTransform: 'none',
                        fontSize: '16px',
                        padding: '8px 24px',
                        '&:hover': {
                            backgroundColor: '#e0e0e0'
                        }
                    }}
                >
                    ยกเลิก
                </Button>
                <Button
                    onClick={onSave}
                    variant="contained"
                    sx={{
                        backgroundColor: '#007BFF',
                        textTransform: 'none',
                        fontSize: '16px',
                        padding: '8px 24px',
                        borderRadius: '8px',
                        '&:hover': {
                            backgroundColor: '#0056b3'
                        }
                    }}
                >
                    บันทึก
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditTrolleyModal;