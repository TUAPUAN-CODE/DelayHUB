// ModalSlipPrint.jsx
import React, { useEffect } from 'react';
import { Box, Button, Typography, Dialog } from '@mui/material';
import PrintIcon from "@mui/icons-material/Print";
import CancelIcon from "@mui/icons-material/CancelOutlined";

const ModalSlipPrint = ({ open, onClose, data }) => {
  useEffect(() => {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.media = 'print';

    const css = `
      @page {
        size: 72.1mm 297mm !important;
        margin: 0mm !important;
        padding: 0mm !important;
      }
      
      html, body {
        width: 72.1mm !important;
        margin: 0mm !important;
        padding: 0mm !important;
        overflow: hidden !important;
      }
      
      .print-container {
        width: 72.1mm !important;
        padding: 1mm !important;
        margin: 0mm !important;
      }
      
      @media print {
        .MuiDialog-paper {
          margin: 0mm !important;
          padding: 0mm !important;
          width: 72.1mm !important;
          max-width: 72.1mm !important;
          box-shadow: none !important;
        }
        
        .no-print {
          display: none !important;
        }
        
        .print-text {
          font-size: 10px !important;
        }
        
        .print-title {
          font-size: 12px !important;
          font-weight: bold !important;
        }
        
        .print-header {
          font-size: 14px !important;
          font-weight: bold !important;
          text-align: center !important;
        }
      }
    `;

    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handleAfterPrint = () => {
    onClose();
  };

  useEffect(() => {
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  if (!data) {
    return null;
  }

  // ดึงข้อมูลจาก data
  const { input2 = {}, batchAfterArray = [], batchArray = [] } = data;
  
  const materialName = data?.mat_name || "ไม่มีข้อมูล";
  const materialCode = data?.mat || "ไม่มีข้อมูล";
  const withdraw_date = data?.withdraw_date || "ไม่มีข้อมูล";
  const productionValue = data?.production || "ไม่มีข้อมูล";
  const level_eu = data?.level_eu || input2?.level_eu || "-";
  const processName = input2?.selectedProcessType?.process_name || "ไม่มีข้อมูล";
  const weightPerCart = input2?.weightPerCart || "ไม่มีข้อมูล";
  const numberOfTrays = input2?.numberOfTrays || "ไม่มีข้อมูล";
  const cookedDateTime = data?.cookedDateTimeNew || "ไม่มีข้อมูล";
  const preparedDateTime = data?.preparedDateTimeNew || "ไม่มีข้อมูล";
  const operator = input2?.operator || "ไม่มีข้อมูล";
  const deliveryLocation = input2?.deliveryLocation || "ไม่มีข้อมูล";
  const deliveryType = input2?.deliveryType || "-";

  return (
    <Dialog
      open={open}
      onClose={(e, reason) => {
        if (reason === 'backdropClick') return;
        onClose();
      }}
      sx={{
        '& .MuiDialog-paper': {
          width: '850px',
          '@media print': {
            width: '72.1mm !important',
            maxWidth: '72.1mm !important',
            margin: '0mm !important',
            padding: '0mm !important',
          },
        },
      }}
    >
      <Box className="print-container" sx={{
        backgroundColor: "#fff",
        width: "600px",
        borderRadius: "4px",
        padding: "10px",
        '@media print': {
          width: '72.1mm !important',
          padding: '1mm !important',
        },
      }}>
        {/* ปุ่มควบคุม - ซ่อนตอนพิมพ์ */}
        <Box className="no-print" sx={{
          display: "flex",
          flexDirection: "row",
          gap: 1,
          mb: 2,
        }}>
          <Button
            variant="contained"
            onClick={onClose}
            startIcon={<CancelIcon />}
            sx={{
              width: "250px",
              height: "50px",
              margin: "5px",
              backgroundColor: "#ff4444",
              '&:hover': { backgroundColor: "#cc0000" }
            }}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            onClick={handlePrint}
            startIcon={<PrintIcon />}
            sx={{
              width: "250px",
              height: "50px",
              margin: "5px",
              backgroundColor: "#2388d1",
              '&:hover': { backgroundColor: "#1976d2" }
            }}
          >
            กดที่นี่เพื่อ พิมพ์
          </Button>
        </Box>

        {/* เนื้อหาสลิป */}
        <Box sx={{
          width: "100%",
          padding: "10px",
          '@media print': {
            padding: '1mm',
          },
        }}>
          {/* Header */}
          <Typography className="print-header" sx={{
            fontSize: "22px",
            fontWeight: "bold",
            textAlign: "center",
            mb: 2,
            '@media print': {
              fontSize: '14px',
              marginBottom: '2mm',
            },
          }}>
            ใบส่งวัตถุดิบ
          </Typography>

          {/* ข้อมูลวัตถุดิบ */}
          <Typography className="print-title" sx={{ 
            fontSize: "22px", 
            // fontWeight: "bold",
            color: "#000",
            padding: "5px 0 5px 0",
            margin: "10px",
            '@media print': {
              fontSize: '12px',
              fontWeight: 'bold',
              margin: '4px 0',
              padding: '2px 0',
            },
          }}>
            ข้อมูลวัตถุดิบ
          </Typography>

          <Typography className="print-text" sx={{ 
            fontSize: "22px",
            color: "#464646",
            margin: "10px",
            '@media print': {
              fontSize: '10px',
              margin: '2px 0',
            },
          }}>
            ชื่อวัตถุดิบ : {materialName}
          </Typography>

          {/* รายการ Batch */}
          {batchArray && batchArray.length > 0 && (
            <Box sx={{ mt: 1, mb: 1, margin: "10px", '@media print': { margin: '2px 0' } }}>
              <Typography className="print-title" sx={{ 
              fontSize: "22px",
              color: "#464646", 
              margin: "10px",
              '@media print': {
              fontSize: '10px',
              margin: '2px 0',
            },
              }}>
                Batch: 
                {batchAfterArray.map((afterBatch, idx) => {
                  const newBatch = afterBatch?.batch_after || afterBatch?.new_batch_after || "N/A";
                  return (
                    <span key={idx} style={{ fontWeight: 'normal', marginLeft: idx === 0 ? '4px' : '0' }}>
                      {idx > 0 && ', '}{newBatch}
                    </span>
                  );
                })}
              </Typography>
            </Box>
          )}

          <Typography className="print-text" sx={{ 
            fontSize: "22px",
            color: "#464646",
            margin: "10px",
            '@media print': {
              fontSize: '10px',
              margin: '2px 0',
            },
          }}>
            แผนการผลิต : {productionValue}
          </Typography>

          <Typography className="print-text" sx={{ 
            fontSize: "22px",
            color: "#464646",
            margin: "10px",
            '@media print': {
              fontSize: '10px',
              margin: '2px 0',
            },
          }}>
            Level EU (สำหรับปลา) : {level_eu}
          </Typography>

          <Typography className="print-text" sx={{ 
            fontSize: "22px",
            color: "#464646",
            margin: "10px",
            '@media print': {
              fontSize: '10px',
              margin: '2px 0',
            },
          }}>
            ประเภทการแปรรูป : {processName}
          </Typography>

          <Typography className="print-text" sx={{ 
            fontSize: "22px",
            color: "#464646",
            margin: "10px",
            '@media print': {
              fontSize: '10px',
              margin: '2px 0',
            },
          }}>
            จำนวนถาด : {numberOfTrays} ถาด
          </Typography>

          <Typography className="print-text" sx={{ 
            fontSize: "22px",
            color: "#464646",
            margin: "10px",
            '@media print': {
              fontSize: '10px',
              margin: '2px 0',
            },
          }}>
            น้ำหนักสุทธิ : {weightPerCart} กก.
          </Typography>

          <Typography className="print-text" sx={{ 
            fontSize: "22px",
            color: "#464646",
            margin: "10px",
            '@media print': {
              fontSize: '10px',
              margin: '2px 0',
            },
          }}>
            เวลาเบิกจากห้องเย็นใหญ่ : {withdraw_date}
          </Typography>

          <Typography className="print-text" sx={{ 
            fontSize: "22px",
            color: "#464646",
            margin: "10px",
            '@media print': {
              fontSize: '10px',
              margin: '2px 0',
            },
          }}>
            เวลาอบ/ต้มเสร็จ : {cookedDateTime}
          </Typography>

          <Typography className="print-text" sx={{ 
            fontSize: "22px",
            color: "#464646",
            margin: "10px",
            '@media print': {
              fontSize: '10px',
              margin: '2px 0',
            },
          }}>
            วันที่เตรียมเสร็จ : {preparedDateTime}
          </Typography>

          <Typography className="print-text" sx={{ 
            fontSize: "22px",
            color: "#464646",
            margin: "10px",
            '@media print': {
              fontSize: '10px',
              margin: '2px 0',
            },
          }}>
            ผู้ดำเนินการ : {operator}
          </Typography>

          {/* <Typography className="print-text" sx={{ 
            fontSize: "22px",
            color: "#464646",
            margin: "10px",
            '@media print': {
              fontSize: '10px',
              margin: '2px 0',
              marginBottom: '10px',
            },
          }}>
            วันที่เข้าห้องเย็น : ______/______/___________
          </Typography>

          <Typography className="print-text" sx={{ 
            fontSize: "22px",
            color: "#464646",
            margin: "10px",
            marginLeft: '110px',
            '@media print': {
              fontSize: '10px',
              margin: '2px 0',
              marginBottom: '10px',
              marginLeft: '45px',
            },
          }}>
            เวลา : _______:_______ น.
          </Typography> */}
        </Box>
      </Box>
    </Dialog>
  );
};

export default ModalSlipPrint;