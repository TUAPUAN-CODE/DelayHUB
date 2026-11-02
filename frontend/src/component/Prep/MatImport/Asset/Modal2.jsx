import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
  Box,
  Typography,
  FormControlLabel,
  Alert,
  Divider,
  RadioGroup,
  Radio,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar
} from '@mui/material';
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import axios from "axios";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
axios.defaults.withCredentials = true; 

const API_URL = import.meta.env.VITE_API_URL;

const Modal2 = ({ open, onClose, onNext, data, mapping_id, tro_id, CookedDateTime, dest, rm_type_id }) => {
  const [weightPerCart, setWeightPerCart] = useState('');
  const [operator, setOperator] = useState('');
  const [numberOfTrays, setNumberOfTrays] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [processTypes, setProcessTypes] = useState([]);
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [selectedProcessType, setSelectedProcessType] = useState("");
  const [cookedTime, setCookedTime] = useState('');
  const [weightError, setWeightError] = useState(false);
  const [trayError, setTrayError] = useState(false);
  const [processError, setProcessError] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [preparedTimeError, setPreparedTimeError] = useState(false);
  const [preparedTime, setPreparedTime] = useState('');
  const [timeValid, setTimeValid] = useState(true);
  // Tuna scrap / CK bone (flow groups): the cooked time is the preparation time (field hidden) and the material can go to the big cold room
  const isFlow = !!data?.isFlow;
  const [storagePurpose, setStoragePurpose] = useState('');
  const [histamine, setHistamine] = useState('');
  const [coldRemark, setColdRemark] = useState('');
  const [depositDate, setDepositDate] = useState(null);
  const [storagePurposeError, setStoragePurposeError] = useState(false);

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

      if (data && data.input2) {
        setWeightPerCart(data.input2.weightPerCart || '');
        // setOperator(data.input2.operator || '');
        if (data.input2.operator) {
          setOperator(data.input2.operator);
        }
        setNumberOfTrays(data.input2.numberOfTrays || '');
        setSelectedProcessType(data.input2.selectedProcessType || '');
        setDeliveryLocation(data.input2.deliveryLocation || '');
      } else {
        resetForm();
      }
    }
  }, [open, data]);

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
    if (open) {
      // ตั้งค่าเวลาเตรียมเสร็จเป็นเวลาปัจจุบันเมื่อเปิด modal (ในเวลาไทย)
      const now = new Date();
      const thaiTime = convertToThaiTime(now.toISOString());
      setPreparedTime(thaiTime);
    }
  }, [open]);


  useEffect(() => {
    if (open && CookedDateTime) {
      try {
        const formattedDateTime = CookedDateTime.replace(" ", "T");
        setCookedTime(formattedDateTime);
      } catch (error) {
        console.error("Error formatting CookedDateTime:", error);
      }
    }
  }, [open, CookedDateTime]);



  const resetForm = () => {
    setWeightPerCart('');
    // setOperator('');
    setNumberOfTrays('');
    setSelectedProcessType('');
    setDeliveryLocation('');
    setWeightError(false);
    setTrayError(false);
    setProcessError(false);
    setLocationError(false);
  };

  const isFutureTime = (selectedTime) => {
    if (!selectedTime) return false;
    const selectedDate = new Date(selectedTime);
    const now = new Date();
    return selectedDate > now;
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

    // Validate process type
    if (!selectedProcessType) {
      setProcessError(true);
      isValid = false;
    } else {
      setProcessError(false);
    }

    // Validate operator
    if (!operator) {
      isValid = false;
    }

    if (isFlow && deliveryLocation === "ห้องเย็นใหญ่" && !storagePurpose) {
      setStoragePurposeError(true);
      isValid = false;
    } else {
      setStoragePurposeError(false);
    }

    // Validate delivery location
    if (!deliveryLocation) {
      setLocationError(true);
      isValid = false;
    } else {
      setLocationError(false);
    }

    if (!preparedTime) {
      setPreparedTimeError(true);
      isValid = false;
    } else if (isFutureTime(preparedTime)) {
      setPreparedTimeError(true);
      setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาการเตรียมเสร็จได้");
      isValid = false;
    } else {
      setPreparedTimeError(false);
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

    const formattedCookedTime = (isFlow ? preparedTime : cookedTime)
      ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(isFlow ? preparedTime : cookedTime))
      : "";

    const formattedPreparedTime = preparedTime
      ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(preparedTime))
      : "";

    // Set deliveryType automatically based on deliveryLocation
    const toBigCold = isFlow && deliveryLocation === "ห้องเย็นใหญ่";
    const deliveryType = toBigCold ? "ส่งห้องเย็นใหญ่" : (deliveryLocation === "เข้าห้องเย็น" ? "QCตรวจสอบ" : "");

    const updatedData = {
      ...data,
      input2: {
        weightPerCart: weight,
        operator,
        numberOfTrays: trays,
        selectedProcessType,
        deliveryLocation: String(deliveryLocation),
        deliveryType: String(deliveryType),
        storagePurpose: toBigCold ? storagePurpose : null,
        histamine: toBigCold ? (histamine || null) : null,
        coldRemark: toBigCold ? (coldRemark || null) : null,
        depositDate: toBigCold ? (depositDate || null) : null,
      },
      cookedDateTimeNew: formattedCookedTime,
      preparedDateTimeNew: formattedPreparedTime,
      mapping_id: mapping_id,
      tro_id: tro_id,
      dest: dest
    };

    console.log("Sending data to Modal3:", updatedData);
    onNext(updatedData);
  };

    const handleClose = async () => {
  const troId = data?.inputValues?.[0]; 

  if (troId) {
    const success = await returnreserveTrolley(troId);
    if (!success) {
      setErrorDialogOpen(true);
      return;
    }
  }
  onClose();
};

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

  const handleWeightChange = (e) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setWeightPerCart(value);
      setWeightError(false);
    }
  };

  const handlePreparedTimeChange = (e) => {
    const selectedTime = e.target.value;
    setPreparedTime(selectedTime);

    if (isFutureTime(selectedTime)) {
      setPreparedTimeError(true);
      setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาการเตรียมเสร็จได้");
      setSnackbarOpen(true);
      setTimeValid(false);
    } else {
      setPreparedTimeError(false);
      setTimeValid(true);
    }
  };

  const handleTrayChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setNumberOfTrays(value);
      setTrayError(false);
    }
  };

  const handleDeliveryLocationChange = (event) => {
    setDeliveryLocation(event.target.value);
  };

  const handleProcessTypeChange = (event) => {
    setSelectedProcessType(event.target.value);
    setProcessError(false);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const convertToThaiTime = (dateTimeStr) => {
    if (!dateTimeStr) return '';
    const date = new Date(dateTimeStr);
    const thaiDate = new Date(date.getTime() + (7 * 60 * 60 * 1000));
    return thaiDate.toISOString().slice(0, 16);
  };

  const maxDateTime = convertToThaiTime(new Date().toISOString());



  return (
    <Dialog open={open} onClose={(e, reason) => {
      if (reason === 'backdropClick') return;
      onClose();
    }} fullWidth maxWidth="xs">
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

          {/* <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: "5px" }}>
            <Typography style={{ fontSize: "15px" }} color="rgba(0, 0, 0, 0.6)">
              Batch เก่า:
            </Typography>

            {data?.batch ? (
              <Typography variant="body1" color="rgba(0, 0, 0, 0.6)" sx={{ fontWeight: 'solid' }}>
                {data.batch}
              </Typography>
            ) : (
              <Typography variant="body2">ไม่มีข้อมูล</Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: "5px" }}>
            <Typography style={{ fontSize: "15px" }} color="rgba(0, 0, 0, 0.6)">
              Batch ใหม่:
            </Typography>

            {data?.newBatch ? (
              <Typography variant="body1" color="rgba(0, 0, 0, 0.6)" sx={{ fontWeight: 'solid' }}>
                {data.newBatch}
              </Typography>
            ) : (
              <Typography variant="body2">ไม่มีข้อมูล</Typography>
            )}
          </Box> */}

          {/* <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: "5px" }}>
            <Typography style={{ fontSize: "15px" }} color="rgba(0, 0, 0, 0.6)">
              ประวัติการแก้ไข:
            </Typography>

            {data?.edit_rework ? (
              <Typography variant="body1" color="rgba(0, 0, 0, 0.6)" sx={{ fontWeight: 'solid' }}>
                {data.edit_rework}
              </Typography>
            ) : (
              <Typography variant="body2">ไม่มีข้อมูล</Typography>
            )}
          </Box> */}

          <Divider sx={{ mt: 1, mb: 2 }} />

          {!isFlow && (
          <TextField
            label="เวลาอบเสร็จ/ต้มเสร็จ"
            type="datetime-local"
            variant="outlined"
            fullWidth
            size="small"
            value={cookedTime}
            onChange={(e) => setCookedTime(e.target.value)}
            sx={{ marginBottom: '16px' }}
            inputProps={{
              max: new Date().toISOString().slice(0, 16), // ป้องกันไม่ให้เลือกเวลาในอนาคต
            }}
            InputLabelProps={{ shrink: true }}
          />
          )}

          <TextField
            label="วันที่เตรียมเสร็จ"
            type="datetime-local"
            variant="outlined"
            fullWidth
            size="small"
            value={preparedTime}
            onChange={handlePreparedTimeChange}
            sx={{ marginBottom: '16px' }}
            inputProps={{
              max: maxDateTime,
            }}
            InputLabelProps={{ shrink: true }}
            error={preparedTimeError}
            helperText={preparedTimeError ? "กรุณากรอกวันที่เตรียมเสร็จที่ถูกต้อง และไม่ใช่เวลาอนาคต" : ""}
          />

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

          <FormControl
            fullWidth
            size="small"
            sx={{ marginBottom: '16px' }}
            variant="outlined"
            error={processError}
          >
            <InputLabel>ประเภทการแปรรูป</InputLabel>
            <Select
              value={selectedProcessType}
              onChange={handleProcessTypeChange}
              label="ประเภทการแปรรูป"
            >
              {processTypes.map((process) => (
                <MenuItem key={process.process_id} value={process}>
                  {process.process_name}
                </MenuItem>
              ))}
            </Select>
            {processError && (
              <Typography variant="caption" color="error">
                กรุณาเลือกประเภทการแปรรูป
              </Typography>
            )}
          </FormControl>

          <TextField
            label="ผู้ดำเนินการ"
            variant="outlined"
            fullWidth
            size="small"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            sx={{ marginBottom: '16px' }}
          />

          <Box sx={{
            display: "flex",
            alignItems: "center",
            paddingLeft: "12px",
            border: locationError ? '1px solid red' : 'none',
            borderRadius: locationError ? '4px' : '0',
            padding: locationError ? '8px' : '0'
          }}>
            <Typography style={{ color: "#666", marginRight: "16px" }}>สถานที่จัดส่ง</Typography>
            <RadioGroup
              row
              name="location"
              value={deliveryLocation}
              onChange={handleDeliveryLocationChange}
            >
              <FormControlLabel
                value="ไปบรรจุ"
                control={<Radio />}
                style={{ color: "#666" }}
                label="บรรจุ"
              />
              <FormControlLabel
                value="เข้าห้องเย็น"
                control={<Radio />}
                style={{ color: "#666" }}
                label="ห้องเย็น"
              />
              {isFlow && (
                <FormControlLabel
                  value="ห้องเย็นใหญ่"
                  control={<Radio />}
                  style={{ color: "#666" }}
                  label="ห้องเย็นใหญ่"
                />
              )}
            </RadioGroup>
          </Box>
          {isFlow && deliveryLocation === "ห้องเย็นใหญ่" && (
            <Box sx={{ border: "1px solid #0F3FC4", borderRadius: "4px", padding: "12px", backgroundColor: "#EAF0FF", marginTop: "12px", marginBottom: "16px" }}>
              <Typography sx={{ fontSize: "14px", fontWeight: 600, color: "#0F3FC4", marginBottom: "10px" }}>
                ข้อมูลเพิ่มเติมสำหรับห้องเย็นใหญ่
              </Typography>
              <FormControl fullWidth size="small" sx={{ marginBottom: "12px" }} error={storagePurposeError}>
                <InputLabel>วัตถุประสงค์การจัดเก็บ *</InputLabel>
                <Select
                  value={storagePurpose}
                  onChange={(e) => { setStoragePurpose(e.target.value); setStoragePurposeError(false); }}
                  label="วัตถุประสงค์การจัดเก็บ *"
                >
                  <MenuItem value="ฝากเก็บเพื่อรอผลิต">ฝากเก็บเพื่อรอผลิต</MenuItem>
                  <MenuItem value="ฟรีสเพื่อจัดเก็บ">ฟรีสเพื่อจัดเก็บ</MenuItem>
                  <MenuItem value="ส่งคืน">ส่งคืน</MenuItem>
                </Select>
                {storagePurposeError && (
                  <Typography variant="caption" color="error" sx={{ ml: 1 }}>
                    กรุณาเลือกวัตถุประสงค์การจัดเก็บ
                  </Typography>
                )}
              </FormControl>
              <TextField
                label="ผล Histamine"
                variant="outlined"
                fullWidth
                size="small"
                value={histamine}
                onChange={(e) => setHistamine(e.target.value)}
                placeholder="กรอกผล Histamine (ถ้ามี)"
                inputProps={{ maxLength: 50 }}
              />
              <TextField
                label="หมายเหตุ"
                variant="outlined"
                fullWidth
                size="small"
                value={coldRemark}
                onChange={(e) => setColdRemark(e.target.value)}
                placeholder="กรอกหมายเหตุ (ถ้ามี)"
                inputProps={{ maxLength: 200 }}
                sx={{ mt: "12px" }}
              />
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="จัดเก็บถึงวันที่"
                  value={depositDate ? dayjs(depositDate) : null}
                  onChange={(newValue) => setDepositDate(newValue ? newValue.format("YYYY-MM-DD") : null)}
                  slotProps={{ textField: { fullWidth: true, size: "small", sx: { mt: "12px" } } }}
                />
              </LocalizationProvider>
            </Box>
          )}
          {locationError && (
            <Typography variant="caption" color="error" sx={{ ml: 2 }}>
              กรุณาเลือกสถานที่จัดส่ง
            </Typography>
          )}

          <Divider />
        </DialogContent>

        <Box sx={{ padding: "0px 16px 16px 16px", display: "flex", justifyContent: "space-between" }}>
          <Button
            style={{ backgroundColor: "#E5484D", color: "#fff" }}
            variant="contained"
            startIcon={<CancelIcon />}
            onClick={handleClose}
          >
            ยกเลิก
          </Button>
          <Button
            style={{
              backgroundColor: !timeValid || preparedTimeError ? "#A0A0A0" : "#1552F0",
              color: "#fff"
            }}
            variant="contained"
            startIcon={<CheckCircleIcon />}
            onClick={handleNext}
            disabled={!timeValid || preparedTimeError}
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