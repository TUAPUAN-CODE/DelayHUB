import React, { useState, useEffect } from 'react';
import axios from "axios";
axios.defaults.withCredentials = true;
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar
} from '@mui/material';
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";

const API_URL = import.meta.env.VITE_API_URL;

const Modal2 = ({ open, onClose, onNext, data, rmfp_id, CookedDateTime, level_eu, rm_type_id }) => {
  const [processTypes, setProcessTypes] = useState([]);
  const [levelEuState, setLevelEuState] = useState(level_eu || '');
  const [euOptions, setEuOptions] = useState([]);
  const [weightPerCart, setWeightPerCart] = useState('');
  const [operator, setOperator] = useState('');
  const [numberOfTrays, setNumberOfTrays] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [rmTypeId, setRmTypeId] = useState(null);
  const [weightError, setWeightError] = useState(false);
  const [trayError, setTrayError] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    const fetchProcessTypes = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/fetchProcess`);
        if (response.status === 200 && Array.isArray(response.data.data)) {
          setProcessTypes(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching process types:", error);
      }
    };

    if (open) {
      fetchProcessTypes();
      console.log("Modal opened, rm_type_id:", rm_type_id);

      if (data && data.input2) {
        setWeightPerCart(data.input2.weightPerCart || '');
        // setOperator(data.input2.operator || '');
        if (data.input2.operator) {
          setOperator(data.input2.operator);
        }
        setNumberOfTrays(data.input2.numberOfTrays || '');
        setRmTypeId(data.input2.rm_type_id || null);
      } else {
        resetForm();
      }
    }
  }, [open, data]);



  const returnreserveTrolley = async (tro_id) => {
    try {
      const response = await axios.post(`${API_URL}/api/re/reserveTrolley`, {
        tro_id: tro_id,
      });
      return response.data.success;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  useEffect(() => {
    const fetchUserDataFromLocalStorage = () => {
      try {
        const firstName = localStorage.getItem('first_name') || '';

        if (firstName) {
          setOperator(`${firstName}`.trim());
        }
      } catch (error) {
        console.error("Error fetching user data from localStorage:", error);
      }
    };

    if (open) {
      fetchUserDataFromLocalStorage();
    }
  }, [open]);

  useEffect(() => {
    if (rm_type_id === 3 || rm_type_id === 6 || rm_type_id === 7 || rm_type_id === 8) {
      const numbers = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        value: `Eu ${i + 1}`,
      }));
      setEuOptions(numbers);
      setLevelEuState(numbers[0]?.value || '');
    } else {
      setEuOptions([]);
      setLevelEuState('');
    }
  }, [rm_type_id]);

  const resetForm = () => {
    setRmTypeId(null);
    setWeightPerCart('');
    // setOperator('');
    setNumberOfTrays('');
    setWeightError(false);
    setTrayError(false);
  };

  const validateInputs = () => {
    let isValid = true;

    // Validate weight per cart
    const weight = parseFloat(weightPerCart);
    if (!weightPerCart || isNaN(weight) || weight <= 0) {
      setWeightError(true);
      isValid = false;
    } else {
      setWeightError(false);
    }

    // Validate number of trays
    const trays = parseInt(numberOfTrays, 10);
    if (!numberOfTrays || isNaN(trays) || trays <= 0) {
      setTrayError(true);
      isValid = false;
    } else {
      setTrayError(false);
    }

    // Validate operator
    if (!operator) {
      isValid = false;
    }

    return isValid;
  };

  const handleNext = () => {
    if (!validateInputs()) {
      setErrorMessage("กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง");
      setSnackbarOpen(true);
      return;
    }

    const weight = parseFloat(weightPerCart);
    const trays = parseInt(numberOfTrays, 10);

    const updatedData = {
      ...data,
      input2: {
        weightPerCart: weight,
        operator,
        numberOfTrays: trays,
        level_eu: levelEuState || ''
      },
      rmfp_id: rmfp_id,
      cookedDateTime: CookedDateTime,
    };

    console.log("Sending data to Modal3:", updatedData);
    onNext(updatedData);
  };

 const handleClose = async () => {
  const troId = data?.inputValues?.[0];

  if (troId) {
    const success = await returnreserveTrolley(troId);
    if (!success) {
      // setErrorDialogOpen(true); // 🛑 ฟังก์ชันนี้ก็ไม่ประกาศไว้เช่นกัน
      setErrorMessage("ไม่สามารถคืนรถเข็นได้");
      setSnackbarOpen(true);
      return;
    }
  }

  resetForm();  // ✅ ใช้ฟังก์ชันนี้แทน clearData()
  onClose();
};


  const handleWeightChange = (e) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setWeightPerCart(value);
      setWeightError(false);
    }
  };

  const handleTrayChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setNumberOfTrays(value);
      setTrayError(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={(e, reason) => {
        if (reason === 'backdropClick') return;
        onClose();
      }}
      fullWidth
      maxWidth="xs"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: "15px", color: "#555" }}>
        <DialogContent sx={{ padding: '8px 16px' }}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', marginTop: "10px" }}>
            <Typography sx={{ fontSize: "18px", fontWeight: 500, color: "#545454", marginBottom: "10px" }}>
              กรุณากรอกข้อมูล
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography style={{ fontSize: "15px" }} color="rgba(0, 0, 0, 0.6)">
              ป้ายทะเบียน:
            </Typography>
            {data?.inputValues?.length > 0 ? (
              <Typography variant="body1" color="rgba(0, 0, 0, 0.6)" sx={{ fontWeight: 'solid' }}>
                {data.inputValues.join(", ")}
              </Typography>
            ) : (
              <Typography variant="body2">ไม่มีข้อมูลจาก Modal1</Typography>
            )}
          </Box>

          <Divider sx={{ mt: 1, mb: 2 }} />

          <TextField
            label="น้ำหนักวัตถุดิบ/รถเข็น (กก.)"
            variant="outlined"
            fullWidth
            value={weightPerCart}
            size="small"
            onChange={handleWeightChange}
            sx={{ marginBottom: '16px' }}
            error={weightError}
            helperText={weightError ? "กรุณากรอกน้ำหนักเป็นตัวเลขที่ถูกต้อง" : ""}
            inputProps={{
              inputMode: 'decimal',
              pattern: '[0-9]*\\.?[0-9]*'
            }}
          />

          <TextField
            label="จำนวนถาด"
            variant="outlined"
            fullWidth
            size="small"
            value={numberOfTrays}
            onChange={handleTrayChange}
            sx={{ marginBottom: '16px' }}
            error={trayError}
            helperText={trayError ? "กรุณากรอกจำนวนเป็นตัวเลขเต็มที่ถูกต้อง" : ""}
            inputProps={{
              inputMode: 'numeric',
              pattern: '[0-9]*'
            }}
          />

          {rm_type_id === 3 && rm_type_id === 6 && rm_type_id === 7 && rm_type_id === 8(
            <FormControl fullWidth size="small" sx={{ marginBottom: '16px' }} variant="outlined">
              <InputLabel>กรุณาเลือกค่า Eu (สำหรับวัตถุดิบปลา)</InputLabel>
              <Select
                value={levelEuState}
                onChange={(e) => setLevelEuState(e.target.value)}
                label="กรุณาเลือกค่า Eu (สำหรับวัตถุดิบปลา)"
              >
                <MenuItem value="">
                  <em>ไม่เลือก</em>
                </MenuItem>
                {euOptions.map((eu) => (
                  <MenuItem key={eu.id} value={eu.value}>
                    {eu.value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            label="ผู้ดำเนินการ"
            variant="outlined"
            fullWidth
            size="small"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            sx={{ marginBottom: '16px' }}
          />

          <Divider />
        </DialogContent>

        <Box sx={{ padding: "0px 16px 16px 16px", display: "flex", justifyContent: "space-between" }}>
          <Button
            style={{ backgroundColor: "#E74A3B", color: "#fff" }}
            variant="contained"
            startIcon={<CancelIcon />}
            onClick={handleClose}
          >
            ยกเลิก
          </Button>
          <Button
            style={{ backgroundColor: "#41a2e6", color: "#fff" }}
            variant="contained"
            startIcon={<CheckCircleIcon />}
            onClick={handleNext}
          >
            ยืนยัน
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity="error" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default Modal2;