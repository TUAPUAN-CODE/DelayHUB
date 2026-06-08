import React, { useState, useEffect } from "react";
import {
  Modal,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Alert,
  useTheme,
  Divider,
} from "@mui/material";
import { styled } from "@mui/system";
import { IoClose } from "react-icons/io5";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

const StyledModal = styled(Modal)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const ModalContent = styled(Box)(({ theme }) => ({
  position: "relative",
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  maxWidth: "600px",
  width: "100%",
  boxShadow: theme.shadows[5],
  height: "auto",
  maxHeight: "90vh",
  overflowY: "auto",
}));

const CloseButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  top: theme.spacing(1),
  right: theme.spacing(1),
  color: theme.palette.grey[600],
  zIndex: 1,
}));

const ModalSlip = ({
  open,
  onClose,
  onConfirm,
  oldBatch,
  batchArray = [],
  rm_type_id,
}) => {
  const theme = useTheme();
  const [batchInputs, setBatchInputs] = useState({});
  const [batchErrors, setBatchErrors] = useState({});

  // Reset form เมื่อเปิด modal
  useEffect(() => {
    if (open) {
      const initialBatchInputs = {};
      const initialBatchErrors = {};
      
      if (batchArray && batchArray.length > 0) {
        batchArray.forEach((b) => {
          initialBatchInputs[b] = "";
          initialBatchErrors[b] = false;
        });
      }
      
      setBatchInputs(initialBatchInputs);
      setBatchErrors(initialBatchErrors);
    }
  }, [open, batchArray]);

  // ตรวจสอบว่าฟอร์มถูกต้องหรือไม่
  const isFormValid = () => {
    // ต้องกรอก batch ครบทุก batch ใน batchArray
    const allBatchesFilled = batchArray.every((b) => {
      const input = batchInputs[b] || "";
      return input.trim() !== "" && input.length === 10;
    });
    return allBatchesFilled;
  };

  // Handle batch input change
  const handleBatchInputChange = (batchValue, newValue) => {
    const upperValue = newValue.toUpperCase();
    if (upperValue.length <= 10) {
      setBatchInputs((prev) => ({
        ...prev,
        [batchValue]: upperValue,
      }));
      setBatchErrors((prev) => ({
        ...prev,
        [batchValue]: false,
      }));
    }
  };

  // Use old batch for specific input
  const useOldBatch = (batchValue) => {
    setBatchInputs((prev) => ({
      ...prev,
      [batchValue]: batchValue.toUpperCase(),
    }));
    setBatchErrors((prev) => ({
      ...prev,
      [batchValue]: false,
    }));
  };

  const handleConfirm = () => {
    // ตรวจสอบ batch inputs
    const newBatchErrors = {};
    let hasError = false;

    batchArray.forEach((b) => {
      const input = batchInputs[b] || "";
      if (input.trim() === "" || input.length !== 10) {
        newBatchErrors[b] = true;
        hasError = true;
      }
    });

    if (hasError) {
      setBatchErrors(newBatchErrors);
      return;
    }

    // สร้าง array ของ batch_after สำหรับแต่ละ batch
    const batchAfterArray = batchArray.map((b) => ({
      batch_before: b,
      batch_after: batchInputs[b] || "",
    }));

    onConfirm(batchAfterArray);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <StyledModal
      open={open}
      onClose={(e, reason) => {
        if (reason === "backdropClick") return;
        onClose();
      }}
    >
      <ModalContent>
        <CloseButton aria-label="close" onClick={handleClose}>
          <IoClose />
        </CloseButton>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Typography
            sx={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#333",
            }}
          >
            กรุณากรอก Batch ใหม่
          </Typography>

          <Typography
            sx={{
              fontSize: "16px",
              fontWeight: 500,
              color: "#555",
            }}
          >
            Old Batch: {oldBatch || "ไม่มีข้อมูล"}
          </Typography>

          <Divider />

          {/* Batch Array Display */}
          <Box>
            <Typography
              sx={{
                fontSize: "16px",
                fontWeight: 500,
                color: "#333",
                marginBottom: "12px",
              }}
            >
              Batch Array:
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {batchArray && batchArray.length > 0 ? (
                batchArray.map((b, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      padding: "6px 12px",
                      backgroundColor: "#f0f0f0",
                      borderRadius: "4px",
                      fontSize: "14px",
                      fontWeight: 500,
                    }}
                  >
                    {b}
                  </Box>
                ))
              ) : (
                <Typography sx={{ fontSize: "14px", color: "#999" }}>
                  ไม่มีข้อมูล
                </Typography>
              )}
            </Box>
          </Box>

          {/* Validation Error */}
          {Object.values(batchErrors).some((e) => e) && (
            <Alert severity="error">
              กรุณากรอก Batch ใหม่ให้ครบ 10 ตัวอักษรสำหรับทุก Batch
            </Alert>
          )}

          {/* Multiple Batch Inputs */}
          {batchArray && batchArray.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography
                sx={{
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "#333",
                }}
              >
                กรอก Batch ใหม่สำหรับแต่ละ Batch:
              </Typography>
              {batchArray.map((b, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    padding: 2,
                    backgroundColor: "#f9f9f9",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#666",
                    }}
                  >
                    Batch เดิม: {b}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TextField
                      fullWidth
                      label={`Batch ใหม่ ${idx + 1} (10 ตัวอักษร)`}
                      value={batchInputs[b] || ""}
                      onChange={(e) => handleBatchInputChange(b, e.target.value)}
                      size="small"
                      error={batchErrors[b]}
                      inputProps={{
                        maxLength: 10,
                        style: { textTransform: "uppercase" },
                      }}
                      sx={{
                        "& .MuiInputBase-root": {
                          height: "42px",
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={() => useOldBatch(b)}
                      sx={{
                        backgroundColor: "#41b0e6",
                        color: "#fff",
                        height: "42px",
                        minWidth: "80px",
                        px: 2,
                        fontSize: "0.875rem",
                        whiteSpace: "nowrap",
                        fontWeight: 500,
                        "&:hover": {
                          backgroundColor: "#2c8fcc",
                        },
                      }}
                    >
                      ใช้เดิม
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          <Divider sx={{ mt: 1 }} />

          {/* Action Buttons */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
              pt: 1,
            }}
          >
            <Button
              variant="contained"
              startIcon={<CancelIcon />}
              onClick={handleClose}
              sx={{
                backgroundColor: "#E74A3B",
                color: "#fff",
                height: "42px",
                px: 3,
                "&:hover": {
                  backgroundColor: "#c9302c",
                },
              }}
            >
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              startIcon={<CheckCircleIcon />}
              onClick={handleConfirm}
              disabled={!isFormValid()}
              sx={{
                backgroundColor: isFormValid() ? "#41a2e6" : "#e0e0e0",
                color: "#fff",
                height: "42px",
                px: 3,
                "&:hover": {
                  backgroundColor: isFormValid() ? "#2c8fcc" : "#e0e0e0",
                },
                "&.Mui-disabled": {
                  color: "#fff",
                },
              }}
            >
              ยืนยัน
            </Button>
          </Box>
        </Box>
      </ModalContent>
    </StyledModal>
  );
};

export default ModalSlip;

// ตัวอย่างการใช้งานใน Parent Component:
/*
import ModalSlip from './ModalSlip';
import { LiaFileInvoiceSolid } from 'react-icons/lia';

// ใน Component
const [openSlipModal, setOpenSlipModal] = useState(false);
const [selectedRow, setSelectedRow] = useState(null);

const handleOpenSlipModal = (row) => {
  setSelectedRow(row);
  setOpenSlipModal(true);
};

const handleConfirmSlip = (batchAfterArray) => {
  console.log('Batch After Array:', batchAfterArray);
  // ทำการ submit ข้อมูลหรือประมวลผลต่อ
  // batchAfterArray = [
  //   { batch_before: "1111111111", batch_after: "2222222222" },
  //   ...
  // ]
};

// ในส่วน JSX
<SlipViewCell
  onClick={(e) => {
    e.stopPropagation();
    handleOpenSlipModal(row);
  }}
  icon={<LiaFileInvoiceSolid style={{ color: '#828282ff', fontSize: '25px' }} />}
  backgroundColor={backgroundColor}
/>

<ModalSlip
  open={openSlipModal}
  onClose={() => setOpenSlipModal(false)}
  onConfirm={handleConfirmSlip}
  oldBatch={selectedRow?.batch || ""}
  batchArray={selectedRow?.batchArray || []}
  rm_type_id={selectedRow?.rm_type_id || 3}
/>
*/