import React, { useEffect } from "react";
import { Box, Button, Typography, Dialog, Divider } from '@mui/material';
import PrintIcon from "@mui/icons-material/Print";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import { QRCodeCanvas } from "qrcode.react";

const ModalSlipPrint = ({ open, onClose, data }) => {
  useEffect(() => {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.media = 'print';

    const css = `
      @page {
        size: 90mm 100mm !important;
        margin: 2mm !important;
        padding: 0mm !important;
      }

      html, body {
        width: 86mm !important;
        margin: 0mm !important;
        padding: 0mm !important;
        overflow: hidden !important;
      }

      * { box-sizing: border-box !important; }

      .slip-print-container {
        width: 86mm !important;
        padding: 0mm !important;
        margin: 0mm !important;
      }

      @media print {
        .MuiDialog-paper {
          margin: 0mm !important;
          padding: 0mm !important;
          width: 86mm !important;
          max-width: 86mm !important;
          box-shadow: none !important;
        }

        .no-print { display: none !important; }

        .slip-print-text  { font-size: 10pt !important; font-weight: normal !important; margin: 1px 0 !important; }
        .slip-print-label { font-size: 9pt  !important; font-weight: normal !important; }
        .slip-print-title { font-size: 11pt !important; font-weight: bold !important; }
        .slip-digit-row   { height: 8mm !important; }
        .slip-digit-char  { font-size: 12pt !important; font-weight: normal !important; height: 8mm !important; }
        .slip-digit-label { font-size: 9pt  !important; font-weight: normal !important; margin-bottom: 1mm !important; }
      }
    `;

    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const handleAfterPrint = () => onClose();
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [onClose]);

  if (!data) return null;

  const f = (val) => (val !== null && val !== undefined && String(val).trim() !== '') ? String(val) : '-';

  // แสดงเฉพาะ date ตัด time / Z ออก
  const fDate = (val) => {
    if (!val) return '-';
    const s = String(val).trim().replace('T', ' ').replace('Z', '');
    return s.split(' ')[0] || '-';
  };

  const qrValue = String(data.slip_id || '-');

  const codeMatChars = (data.code_mat || '').padEnd(12).split('');
  const batchNoChars = (data.batch_no || '').padEnd(10).split('');

  const DigitRow = ({ chars }) => (
    <Box className="slip-digit-row" sx={{ display: 'flex', width: '100%' }}>
      {chars.map((c, i) => (
        <Box key={i} className="slip-digit-char" sx={{
          flex: 1, border: '1.5px solid #222',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '46px', fontSize: '24px', fontWeight: 'normal', fontFamily: 'monospace',
          backgroundColor: '#fff',
        }}>
          {c.trim() ? c : ''}
        </Box>
      ))}
    </Box>
  );

  const FieldRow = ({ label, value, multiline = false }) => (
    <Box sx={{ borderBottom: '0.5px solid #e0e0e0', py: '6px' }}>
      {multiline ? (
        <>
          <Box className="slip-print-label" sx={{
            fontSize: '14px', fontWeight: 'normal', color: '#555', textTransform: 'uppercase',
          }}>
            {label}:
          </Box>
          <Box className="slip-print-text" sx={{ fontSize: '18px', fontWeight: 'normal', color: '#000', mt: 0.5, pl: 0.5 }}>
            {f(value)}
          </Box>
        </>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px' }}>
          <Box className="slip-print-label" sx={{
            fontSize: '14px', fontWeight: 'normal', color: '#555',
            textTransform: 'uppercase', flexShrink: 0,
          }}>
            {label}:
          </Box>
          <Box className="slip-print-text" sx={{ fontSize: '18px', fontWeight: 'normal', color: '#000' }}>
            {f(value)}
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => { if (reason === 'backdropClick') return; onClose(); }}
      sx={{
        '& .MuiDialog-paper': {
          width: '780px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          '@media print': {
            width: '86mm !important',
            maxWidth: '86mm !important',
            height: 'auto',
            margin: '0mm !important',
            padding: '0mm !important',
            boxShadow: 'none',
          },
        },
      }}
    >
      <Box
        className="slip-print-container"
        sx={{
          backgroundColor: '#fff',
          width: '700px',
          borderRadius: '4px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          overflowY: 'auto',
          fontFamily: 'Prompt, Kanit, TH Sarabun New, Arial, sans-serif',
          '@media print': {
            width: '86mm !important',
            padding: '0mm !important',
            margin: '0mm !important',
            overflowY: 'visible',
          },
        }}
      >
        {/* Buttons — ซ่อนตอนพิมพ์ */}
        <Box className="no-print" sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button variant="contained" onClick={onClose} startIcon={<CancelIcon />}
            sx={{ height: '50px', px: 4, backgroundColor: '#ff4444' }}>
            ปิด
          </Button>
          <Button variant="contained" onClick={() => window.print()} startIcon={<PrintIcon />}
            sx={{ height: '50px', px: 4, backgroundColor: '#2388d1' }}>
            พิมพ์สลีป
          </Button>
        </Box>

        {/* Slip content */}
        <Box sx={{
          width: '100%', padding: '10px',
          '@media print': { padding: '1mm' },
        }}>
           <Typography className="slip-print-label" sx={{
            textAlign: 'right', fontSize: '12px', color: '#888', mb: 1,
          }}>
            F3PFST14-1-06/12/23
          </Typography>
          {/* Header */}
          <Typography className="slip-print-title" sx={{
            textAlign: 'center', fontWeight: 'bold', fontSize: '20px', mb: 0.5,
          }}>
            บริษัท ไอ-เทล คอร์ปอเรชั่น จำกัด (มหาชน)
          </Typography>
          <Typography className="slip-print-title" sx={{
            textAlign: 'center', fontWeight: 'bold', fontSize: '18px', mb: 0.5,
          }}>
            ใบแจ้ง Packaging Material และ Batch
          </Typography>
         

          <Divider sx={{ borderWidth: 1.5, borderColor: '#000', mb: 1 }} />

          <FieldRow label="Slip ID"         value={data.slip_id}         />
          <FieldRow label="Type"           value={data.type_choice}     />
          <FieldRow label="วันที่ส่ง / กะ" value={fDate(data.send_date)} />
          <FieldRow label="ลำดับการใช้"    value={data.seq_use}     />
          <FieldRow label="Line"           value={data.line_name}   />

          <Divider sx={{ borderWidth: 1.5, borderColor: '#000', my: 1 }} />

          <Typography className="slip-digit-label" sx={{
            fontSize: '16px', fontWeight: 'normal', color: '#555',
            textTransform: 'uppercase', mb: 0.5,
          }}>
            CODE MAT. (12 หลัก)
          </Typography>
          <DigitRow chars={codeMatChars} />

          <Divider sx={{ borderWidth: 1.5, borderColor: '#000', my: 1 }} />

          <Typography className="slip-digit-label" sx={{
            fontSize: '16px', fontWeight: 'normal', color: '#555',
            textTransform: 'uppercase', mb: 0.5,
          }}>
            BATCH NO. (10 หลัก)
          </Typography>
          <DigitRow chars={batchNoChars} />

          <Divider sx={{ borderWidth: 1.5, borderColor: '#000', my: 1 }} />

          <FieldRow label="วันที่ผลิต Supplier"    value={fDate(data.produce_date)} />
          <FieldRow label="วันที่รับเข้า" value={fDate(data.receive_date)} />
          <FieldRow label="BOX NO."       value={data.box_no}       />
          <FieldRow label="LOT"           value={data.lot}          />
          <FieldRow label="ROLL NO."      value={data.roll_no}      />
          <FieldRow label="HU"            value={data.hu}           />
          <FieldRow label="SIZE"          value={data.size}         />
          <FieldRow label="TE"            value={data.te}           />
          <FieldRow label="จำนวน"         value={data.qty}          />
          <FieldRow label="หมายเหตุ"      value={data.remark} multiline />

             <Typography className="slip-print-title" sx={{
            textAlign: 'center', fontWeight: 'bold', fontSize: '20px', mb: 3,mt:1,paddingBottom:4,
          }}>
            Scan QR Code โดย Scan จากมุมล่างของ QR Code
          </Typography>

          {/* QR Code */}
          <Box sx={{
            display: 'flex', justifyContent: 'center', mt: 8,
            '@media print': { mt: '8mm' },
          }}>
            <QRCodeCanvas value={qrValue || 'PFCM'} size={200} level="L" />
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
};

export default ModalSlipPrint;
