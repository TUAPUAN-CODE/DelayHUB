import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  TextField,
  Box,
  Typography,
  FormControlLabel,
  Alert,
  Divider,
  Select,
  RadioGroup,
  Radio,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar
} from '@mui/material';
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import axios from "axios";
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

const convertToThaiTime = (dateTimeStr) => {
  if (!dateTimeStr) return '';
  const date = new Date(dateTimeStr);
  const thaiDate = new Date(date.getTime() + (7 * 60 * 60 * 1000));
  return thaiDate.toISOString().slice(0, 16);
};

const convertToLocalTime = (dateTimeStr) => {
  if (!dateTimeStr) return '';

  try {
    if (typeof dateTimeStr === 'string' && dateTimeStr.match(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)) {
      const [datePart, timePart] = dateTimeStr.split(' ');
      const [day, month, year] = datePart.split('/');
      const date = new Date(year, month - 1, day, ...timePart.split(':'));

      if (isNaN(date.getTime())) {
        console.warn("Invalid date format:", dateTimeStr);
        return '';
      }

      const pad = num => num.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) {
      console.warn("Invalid date format:", dateTimeStr);
      return '';
    }

    const pad = num => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch (error) {
    console.error("Error converting date:", error);
    return '';
  }
};

const ModalSlip2 = ({ 
  open, 
  onClose, 
  onNext, 
  data, 
  CookedDateTime, 
  batchAfterArray = [],
  batchArray = [],
  rm_type_id 
}) => {
  const [batchAfter, setBatchAfter] = useState([]);
  const [rmTypeId, setRmTypeId] = useState(rm_type_id ?? 3);

  // ✅ ถ้า rm_type_id เป็น 2 หรือ 3 ให้ทั้งสอง DateTimePicker เป็น read-only
  const isReadOnlyTime = [2, 3].includes(rmTypeId);

  const [weightPerCart, setWeightPerCart] = useState('');
  const [operator, setOperator] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [numberOfTrays, setNumberOfTrays] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [processTypes, setProcessTypes] = useState([]);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [deliveryType, setDeliveryType] = useState('');
  const [selectedProcessType, setSelectedProcessType] = useState('');
  const [cookedTime, setCookedTime] = useState('');
  const [weightError, setWeightError] = useState(false);
  const [trayError, setTrayError] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [processTypeError, setProcessTypeError] = useState(false);
  const [operatorError, setOperatorError] = useState(false);
  const [preparedTimeError, setPreparedTimeError] = useState(false);
  const [preparedTime, setPreparedTime] = useState('');
  const [timeValid, setTimeValid] = useState(true);

  useEffect(() => {
    console.log("Data received in ModalSlip2:", data);
    console.log("batchAfterArray:", batchAfterArray);
    console.log("batchArray:", batchArray);

    if (open && batchAfterArray && Array.isArray(batchAfterArray)) {
      const newBatches = batchAfterArray.map(item => item.batch_after || '');
      setBatchAfter(newBatches);
      console.log("Batch After Array:", newBatches);
    }
  }, [open, data, batchAfterArray, batchArray]);

  useEffect(() => {
    console.log("rm_type_id updated:", rm_type_id);
    setRmTypeId(rm_type_id ?? 3);
  }, [rm_type_id]);

  useEffect(() => {
    if (open && CookedDateTime) {
      const formattedDateTime = convertToLocalTime(CookedDateTime);
      if (formattedDateTime) {
        setCookedTime(formattedDateTime);

        // ✅ ถ้าเป็น rm_type_id 2 หรือ 3 ให้ sync preparedTime = cookedTime ทันที
        if ([2, 3].includes(rmTypeId)) {
          setPreparedTime(formattedDateTime);
        }
      }
    }
  }, [open, CookedDateTime, rmTypeId]);

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

    const fetchProcessTypes = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/fetchProcess`);
        console.log("API Response:", response.data);

        if (response.status === 200 && Array.isArray(response.data.data)) {
          setProcessTypes(response.data.data);
        } else {
          console.error("Unexpected API response format:", response.data);
        }
      } catch (error) {
        console.error("Error fetching process types:", error);
      }
    };

    fetchProcessTypes();
    if (open) {
      fetchUserDataFromLocalStorage();

      // ✅ ถ้า rm_type_id ไม่ใช่ 2 หรือ 3 ค่อยตั้ง preparedTime เป็นเวลาปัจจุบัน
      if (![2, 3].includes(rmTypeId)) {
        const now = new Date();
        const thaiTime = convertToThaiTime(now.toISOString());
        setPreparedTime(thaiTime);
      }
    }
  }, [open, rmTypeId]);

  useEffect(() => {
    if (open && data && data.input2) {
      setWeightPerCart(data.input2.weightPerCart || '');
      if (data.input2.operator) {
        setOperator(data.input2.operator);
      }
      setNumberOfTrays(data.input2.numberOfTrays || '');
      setSelectedProcessType(data.input2.selectedProcessType || '');
      setDeliveryLocation(data.input2.deliveryLocation || '');
      setDeliveryType(data.input2.deliveryType || '');

      if (data.input2.preparedTime) {
        try {
          const [datePart, timePart] = data.input2.preparedTime.split(" ");
          const [day, month, year] = datePart.split("/");
          const formattedDateTime = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timePart}`;
          // ✅ ถ้าเป็น rm_type_id 2 หรือ 3 ไม่ต้อง restore ค่าเดิม เพราะ sync กับ cookedTime
          if (![2, 3].includes(rmTypeId)) {
            setPreparedTime(formattedDateTime);
          }
        } catch (error) {
          if (![2, 3].includes(rmTypeId)) {
            setPreparedTime(convertToThaiTime(new Date().toISOString()));
          }
        }
      } else {
        if (![2, 3].includes(rmTypeId)) {
          setPreparedTime(convertToThaiTime(new Date().toISOString()));
        }
      }
    } else if (open) {
      setWeightPerCart('');
      setNumberOfTrays('');
      setSelectedProcessType('');
      setDeliveryLocation('');
      setDeliveryType('');
      if (![2, 3].includes(rmTypeId)) {
        setPreparedTime(convertToThaiTime(new Date().toISOString()));
      }
    }
  }, [open, data, rmTypeId]);

  // ✅ เมื่อ cookedTime เปลี่ยน และเป็น rm_type_id 2 หรือ 3 ให้ sync preparedTime ด้วย
  useEffect(() => {
    if (isReadOnlyTime && cookedTime) {
      setPreparedTime(cookedTime);
    }
  }, [cookedTime, isReadOnlyTime]);

  const clearData = () => {
    setWeightPerCart('');
    setSelectedItem(null);
    setNumberOfTrays('');
    setSelectedProcessType('');
    setDeliveryLocation('');
    setDeliveryType('');
    setErrorMessage('');
    setWeightError(false);
    setTrayError(false);
    setProcessTypeError(false);
    setOperatorError(false);
    setPreparedTimeError(false);
    setBatchAfter([]);
  };

  const isFutureTime = (selectedTime) => {
    if (!selectedTime) return false;
    const selectedDate = new Date(selectedTime);
    const now = new Date();
    return selectedDate > now;
  };

  const validateInputs = () => {
    let isValid = true;

    if (!operator) {
      setOperatorError(true);
      isValid = false;
    } else {
      setOperatorError(false);
    }

    if (!weightPerCart || isNaN(parseFloat(weightPerCart))) {
      setWeightError(true);
      isValid = false;
    } else {
      setWeightError(false);
    }

    if (!selectedProcessType) {
      setProcessTypeError(true);
      isValid = false;
    } else {
      setProcessTypeError(false);
    }

    if (!numberOfTrays || isNaN(parseInt(numberOfTrays, 10))) {
      setTrayError(true);
      isValid = false;
    } else {
      setTrayError(false);
    }

    if (!preparedTime) {
      setPreparedTimeError(true);
      isValid = false;
    } else if (isFutureTime(preparedTime)) {
      setPreparedTimeError(true);
      setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาการเตรียมเสร็จได้");
      isValid = false;
      return false;
    } else {
      setPreparedTimeError(false);
    }

    if (cookedTime && isFutureTime(cookedTime)) {
      setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาอบเสร็จ/ต้มเสร็จได้");
      isValid = false;
      return false;
    }

    return isValid;
  };

  const handleNext = () => {
    if (!validateInputs()) {
      setSnackbarOpen(true);
      return;
    }

    setErrorMessage('');

    if (isFutureTime(preparedTime) || (cookedTime && isFutureTime(cookedTime))) {
      setErrorMessage("ไม่สามารถใช้เวลาอนาคตในการบันทึกข้อมูล");
      setSnackbarOpen(true);
      return;
    }

    const formattedCookedTime = cookedTime
      ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(cookedTime))
      : "";

    // ✅ ถ้า rm_type_id เป็น 2 หรือ 3 ให้ preparedTime = cookedTime เสมอ
    const effectivePreparedTime = isReadOnlyTime ? cookedTime : preparedTime;

    const preparedTimeUTC = effectivePreparedTime ? new Date(effectivePreparedTime) : null;
    const formattedPreparedTime = preparedTimeUTC
      ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(preparedTimeUTC)
      : "";

    const updatedData = {
      ...data,
      input2: {
        weightPerCart: parseFloat(weightPerCart),
        operator,
        selectedItem,
        numberOfTrays: parseInt(numberOfTrays, 10),
        selectedProcessType: selectedProcessType,
        deliveryLocation: String(deliveryLocation),
        deliveryType: String(deliveryType),
        preparedTime: formattedPreparedTime,
        level_eu: data?.level_eu || "",
      },
      batch: data?.batch || '',
      batchAfterArray: batchAfterArray,
      batchArray: batchArray,
      rmfp_id: data?.rmfp_id || '',
      cookedDateTimeNew: formattedCookedTime,
      preparedDateTimeNew: formattedPreparedTime, // ✅ ส่งค่า preparedTime = cookedTime สำหรับ rm_type_id 2,3
      level_eu: data?.level_eu || "",
    };

    console.log("ส่งข้อมูลจาก ModalSlip2:", updatedData);
    onNext(updatedData);
  };

  const handleClose = () => {
    clearData();
    onClose();
  };

  const handleDeliveryLocationChange = (event) => {
    setDeliveryLocation(event.target.value);
    if (event.target.value !== "เข้าห้องเย็น") {
      setDeliveryType("");
    }
  };

  const handleDeliveryTypeChange = (event) => {
    setDeliveryType(event.target.value);
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

          {/* แสดงการเทียบ Batch Array กับ Batch ใหม่ */}
          <Typography sx={{ fontSize: "16px", fontWeight: 400, color: "#333", marginTop: "8px", marginBottom: "8px" }}>
            เทียบ Batch Array กับ Batch ใหม่:
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 2 }}>
            {batchArray && batchArray.length > 0 ? (
              batchArray.map((batchItem, idx) => {
                const newBatch = batchAfter?.[idx] || "N/A";
                return (
                  <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        padding: "4px 8px",
                        backgroundColor: "#f0f0f0",
                        borderRadius: "4px",
                        fontSize: "14px",
                        minWidth: "120px",
                        textAlign: "center",
                        color: "#666"
                      }}
                    >
                      {batchItem}
                    </Box>

                    <Typography sx={{ fontSize: "16px", color: "#666" }}>→</Typography>

                    <Box
                      sx={{
                        padding: "4px 8px",
                        backgroundColor: "#d0f0d0",
                        borderRadius: "4px",
                        fontSize: "14px",
                        minWidth: "120px",
                        textAlign: "center",
                        fontWeight: "bold"
                      }}
                    >
                      {newBatch}
                    </Box>
                  </Box>
                );
              })
            ) : (
              <Typography sx={{ fontSize: "14px", color: "#999" }}>ไม่มีข้อมูล</Typography>
            )}
          </Box>

          <Divider sx={{ mt: 1, mb: 2 }} />

          {/* ✅ เวลาอบเสร็จ/ต้มเสร็จ — read-only เมื่อ rm_type_id เป็น 2 หรือ 3 */}
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateTimePicker
              label="เวลาอบเสร็จ/ต้มเสร็จ"
              value={cookedTime ? dayjs(cookedTime) : null}
              onChange={(newValue) => {
                if (isReadOnlyTime) return; // ✅ ป้องกันการเปลี่ยนค่า
                if (newValue && newValue.isAfter(dayjs())) {
                  setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาอบเสร็จ/ต้มเสร็จได้");
                  setSnackbarOpen(true);
                  return;
                }
                setCookedTime(newValue?.toISOString() || "");
              }}
              maxDateTime={isReadOnlyTime ? undefined : dayjs()}
              ampm={false}
              timeSteps={{ minutes: 1 }}
              readOnly={isReadOnlyTime}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: "small",
                  required: true,
                  sx: {
                    marginBottom: '16px',
                    // ✅ แสดง visual ว่า read-only
                    '& .MuiInputBase-root': {
                      backgroundColor: isReadOnlyTime ? '#F5F8FF' : 'inherit',
                    }
                  },
                  InputProps: {
                    readOnly: isReadOnlyTime,
                  }
                }
              }}
            />
          </LocalizationProvider>

          {/* ✅ วันที่เตรียมเสร็จ — read-only และ sync กับ cookedTime เมื่อ rm_type_id เป็น 2 หรือ 3 */}
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateTimePicker
              label="วันที่เตรียมเสร็จ"
              value={
                isReadOnlyTime
                  ? (cookedTime ? dayjs(cookedTime) : null) // ✅ แสดงค่าเดียวกับ cookedTime
                  : (preparedTime ? dayjs(preparedTime) : null)
              }
              onChange={(newValue) => {
                if (isReadOnlyTime) return; // ✅ ป้องกันการเปลี่ยนค่า
                if (newValue && newValue.isAfter(dayjs())) {
                  setPreparedTimeError(true);
                  setTimeValid(false);
                  setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาการเตรียมเสร็จได้");
                  setSnackbarOpen(true);
                  return;
                }
                setPreparedTime(newValue?.toISOString() || "");
                setPreparedTimeError(false);
                setTimeValid(true);
              }}
              maxDateTime={isReadOnlyTime ? undefined : dayjs()}
              ampm={false}
              timeSteps={{ minutes: 1 }}
              readOnly={isReadOnlyTime}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: "small",
                  required: true,
                  sx: {
                    marginBottom: '16px',
                    '& .MuiInputBase-root': {
                      backgroundColor: isReadOnlyTime ? '#F5F8FF' : 'inherit',
                    }
                  },
                  error: preparedTimeError,
                  helperText: preparedTimeError ? "กรุณากรอกวันที่เตรียมเสร็จที่ถูกต้อง และไม่ใช่เวลาอนาคต" : "",
                  InputProps: {
                    readOnly: isReadOnlyTime,
                  }
                }
              }}
            />
          </LocalizationProvider>

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
            error={processTypeError}
          >
            <InputLabel>ประเภทการแปรรูป</InputLabel>
            <Select
              value={selectedProcessType}
              onChange={(e) => {
                setSelectedProcessType(e.target.value);
                setProcessTypeError(false);
              }}
              label="ประเภทการแปรรูป"
            >
              {processTypes.map((process) => (
                <MenuItem key={process.process_id} value={process}>
                  {process.process_name}
                </MenuItem>
              ))}
            </Select>
            {processTypeError && (
              <Typography variant="caption" color="error" sx={{ ml: 2 }}>
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
            onChange={(e) => {
              setOperator(e.target.value);
              setOperatorError(false);
            }}
            sx={{ marginBottom: '16px' }}
            error={operatorError}
            helperText={operatorError ? "กรุณากรอกชื่อผู้ดำเนินการ" : ""}
          />

          <Box sx={{
            display: "flex",
            alignItems: "center",
            paddingLeft: "12px",
          }}>
          </Box>

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
          {errorMessage || "กรุณากรอกข้อมูลให้ครบถ้วน"}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default ModalSlip2;