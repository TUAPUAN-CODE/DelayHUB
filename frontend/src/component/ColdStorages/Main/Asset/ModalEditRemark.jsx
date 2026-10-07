import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Box, Typography, CircularProgress, Alert
} from '@mui/material';
import EditNoteIcon from '@mui/icons-material/EditNote';
import axios from 'axios';
axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

const ModalEditRemark = ({ open, onClose, data, onSuccess }) => {
    const [remark, setRemark] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open && data) {
            setRemark(data.remark || '');
            setError('');
        }
    }, [open, data]);

    const handleSave = async () => {
        if (!data?.sap_re_id) {
            setError('ไม่พบรหัสรายการ (sap_re_id)');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await axios.put(
                `${API_URL}/api/coldstorages/remark/sap`,
                {
                    sap_re_id: data.sap_re_id,
                    remark: remark.trim(),
                }
            );

            if (response.data.success) {
                if (onSuccess) onSuccess();
                onClose();
            } else {
                setError(response.data.message || 'บันทึกไม่สำเร็จ');
            }
        } catch (err) {
            console.error('Error saving remark:', err);
            setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={(e, reason) => {
                if (reason === 'backdropClick' || isLoading) return;
                onClose();
            }}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: '12px', padding: '8px' }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: '#1552F0',
                fontWeight: 'bold',
                borderBottom: '1px solid #eee',
                pb: 2
            }}>
                <EditNoteIcon /> เพิ่ม / แก้ไข หมายเหตุ
            </DialogTitle>

            <DialogContent sx={{ pt: 3 }}>
                {/* ข้อมูลรายการ */}
                <Box sx={{
                    backgroundColor: '#F5F8FF',
                    padding: '12px',
                    borderRadius: '8px',
                    mb: 2,
                    mt: 1
                }}>
                    <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                        <strong>Material:</strong> {data?.mat || '-'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                        <strong>Batch:</strong> {data?.batch || '-'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#666' }}>
                        <strong>HU:</strong> {data?.hu || '-'}
                    </Typography>
                </Box>

                {/* Remark Input */}
                <TextField
                    autoFocus
                    fullWidth
                    multiline
                    rows={4}
                    label="หมายเหตุ (Remark)"
                    placeholder="กรอกหมายเหตุที่นี่..."
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    disabled={isLoading}
                    variant="outlined"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '8px',
                        }
                    }}
                />

                {error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button
                    onClick={onClose}
                    disabled={isLoading}
                    variant="outlined"
                    sx={{
                        color: '#ff4444',
                        borderColor: '#ff4444',
                        borderRadius: '8px',
                        width: '120px',
                        height: '40px',
                        '&:hover': {
                            borderColor: '#dd3333',
                            backgroundColor: '#fff5f5',
                        }
                    }}
                >
                    ยกเลิก
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    variant="contained"
                    sx={{
                        backgroundColor: '#1552F0',
                        borderRadius: '8px',
                        width: '120px',
                        height: '40px',
                        '&:hover': {
                            backgroundColor: '#1a76b5',
                        }
                    }}
                >
                    {isLoading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'บันทึก'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ModalEditRemark;