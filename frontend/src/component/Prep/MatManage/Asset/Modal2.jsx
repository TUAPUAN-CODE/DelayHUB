import React, { useState, useEffect } from "react";
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
  Select,
  RadioGroup,
  Radio,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
} from "@mui/material";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import axios from "axios";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

const convertToThaiTime = (dateTimeStr) => {
  if (!dateTimeStr) return "";
  const date = new Date(dateTimeStr);
  const thaiDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return thaiDate.toISOString().slice(0, 16);
};

const convertToLocalTime = (dateTimeStr) => {
  if (!dateTimeStr) return "";
  try {
    if (typeof dateTimeStr === "string" && dateTimeStr.match(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)) {
      const [datePart, timePart] = dateTimeStr.split(" ");
      const [day, month, year] = datePart.split("/");
      const date = new Date(year, month - 1, day, ...timePart.split(":"));
      if (isNaN(date.getTime())) return "";
      const pad = (num) => num.toString().padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return "";
    const pad = (num) => num.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch (error) {
    return "";
  }
};

const Modal2 = ({ open, onClose, onNext, data, CookedDateTime, dest, rm_type_id }) => {
  const [oldBatchAfter, setOldBatchAfter] = useState([]);
  const [rmTypeId, setRmTypeId] = useState(rm_type_id ?? 3);
  const [batchAfter, setBatchAfter] = useState([]);
  const [euOptions, setEuOptions] = useState([]);
  const [weightPerCart, setWeightPerCart] = useState("");
  const [operator, setOperator] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [numberOfTrays, setNumberOfTrays] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [processTypes, setProcessTypes] = useState([]);
  const [deliveryLocation, setDeliveryLocation] = useState([]);
  const [deliveryType, setDeliveryType] = useState("Qc ตรวจสอบ");
  const [selectedProcessType, setSelectedProcessType] = useState("");
  const [cookedTime, setCookedTime] = useState("");
  const [weightError, setWeightError] = useState(false);
  const [trayError, setTrayError] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [processTypeError, setProcessTypeError] = useState(false);
  const [operatorError, setOperatorError] = useState(false);
  const [preparedTimeError, setPreparedTimeError] = useState(false);
  const [preparedTime, setPreparedTime] = useState("");
  const [mixtime, setMixtime] = useState("");
  const [grindtime, setGrindtime] = useState("");
  const [temp, setTemp] = useState("");
  const [viscosity, setViscosity] = useState("");
  const [weightPerCup, setWeightPerCup] = useState("");
  const [timeValid, setTimeValid] = useState(true);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [historyDetail, setHistoryDetail] = useState("");
  const [storagePurpose, setStoragePurpose] = useState("");
  const [histamine, setHistamine] = useState("");
  const [storagePurposeError, setStoragePurposeError] = useState(false);

  // ✅ ถ้า rm_type_id เป็น 2 หรือ 3 ให้ทั้งสอง DateTimePicker เป็น read-only
  const isReadOnlyTime = [999, 888].includes(rmTypeId);

  useEffect(() => {
    if (open && data) {
      if (data.batchAfterArray && Array.isArray(data.batchAfterArray)) {
        const oldBatches = data.batchAfterArray.map((item) => item.batch_after || "");
        setOldBatchAfter(oldBatches);
        const newBatches = data.batchAfterArray.map((item) => item.new_batch_after || item.batch_after || "");
        setBatchAfter(newBatches);
      }
    }
  }, [open, data]);

  useEffect(() => {
    setRmTypeId(rm_type_id ?? 3);
  }, [rm_type_id]);

  // ✅ เมื่อ CookedDateTime เปลี่ยน set cookedTime และถ้าเป็น read-only ให้ sync preparedTime ด้วย
  useEffect(() => {
    if (open && CookedDateTime) {
      const formattedDateTime = convertToLocalTime(CookedDateTime);
      if (formattedDateTime) {
        setCookedTime(formattedDateTime);
        if ([999, 888].includes(rmTypeId)) {
          setPreparedTime(formattedDateTime);
        }
      }
    }
  }, [open, CookedDateTime, rmTypeId]);

  useEffect(() => {
    const fetchUserDataFromLocalStorage = () => {
      try {
        const firstName = localStorage.getItem("first_name") || "";
        if (firstName) setOperator(`${firstName}`.trim());
      } catch (error) {}
    };

    const fetchProcessTypes = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/fetchProcess`);
        if (response.status === 200 && Array.isArray(response.data.data)) {
          setProcessTypes(response.data.data);
          const numbers = [
            { id: 0, value: "-" },
            ...Array.from({ length: 10 }, (_, i) => ({ id: i + 1, value: `Eu ${i + 1}` })),
          ];
          setEuOptions(numbers);
        }
      } catch (error) {}
    };

    fetchProcessTypes();
    if (open) {
      fetchUserDataFromLocalStorage();
      // ✅ ตั้งเวลาเตรียมเสร็จเฉพาะเมื่อไม่ใช่ read-only mode
      if (![999, 888].includes(rmTypeId)) {
        const now = new Date();
        setPreparedTime(convertToThaiTime(now.toISOString()));
      }
    }
  }, [open, rmTypeId]);

  useEffect(() => {
    if (open && data && data.input2) {
      setWeightPerCart(data.input2.weightPerCart || "");
      if (data.input2.operator) setOperator(data.input2.operator);
      setNumberOfTrays(data.input2.numberOfTrays || "");
      setSelectedProcessType(data.input2.selectedProcessType || "");
      setDeliveryLocation(data.input2.deliveryLocation || "");
      setDeliveryType(data.input2.deliveryType || "Qc ตรวจสอบ");
      setHistoryDetail(data.input2.historyDetail || "");
      setStoragePurpose(data.input2.storagePurpose || "");
      setHistamine(data.input2.histamine || "");
      setTemp(data.input2.temp ?? "");
      setViscosity(data.input2.viscosity ?? "");
      setWeightPerCup(data.input2.weightPerCup ?? "");

      if (data.input2.mixtime) {
        try {
          const [datePart, timePart] = data.input2.mixtime.split(" ");
          const [day, month, year] = datePart.split("/");
          setMixtime(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timePart}`);
        } catch { setMixtime(""); }
      } else { setMixtime(""); }

      if (data.input2.grindtime) {
        try {
          const [datePart, timePart] = data.input2.grindtime.split(" ");
          const [day, month, year] = datePart.split("/");
          setGrindtime(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timePart}`);
        } catch { setGrindtime(""); }
      } else { setGrindtime(""); }

      // ✅ restore preparedTime เฉพาะเมื่อไม่ใช่ read-only
      if (![2, 3].includes(rmTypeId)) {
        if (data.input2.preparedTime) {
          try {
            const [datePart, timePart] = data.input2.preparedTime.split(" ");
            const [day, month, year] = datePart.split("/");
            setPreparedTime(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timePart}`);
          } catch { setPreparedTime(convertToThaiTime(new Date().toISOString())); }
        } else {
          setPreparedTime(convertToThaiTime(new Date().toISOString()));
        }
      }
    } else if (open) {
      setWeightPerCart("");
      setNumberOfTrays("");
      setSelectedProcessType("");
      setDeliveryLocation("");
      setDeliveryType("Qc ตรวจสอบ");
      setMixtime("");
      setGrindtime("");
      setTemp("");
      setViscosity("");
      setWeightPerCup("");
      setHistoryDetail("");
      setStoragePurpose("");
      setHistamine("");
      if (![2, 3].includes(rmTypeId)) {
        setPreparedTime(convertToThaiTime(new Date().toISOString()));
      }
    }
  }, [open, data, rmTypeId]);

  // ✅ sync preparedTime ทุกครั้งที่ cookedTime เปลี่ยนใน read-only mode
  useEffect(() => {
    if (isReadOnlyTime && cookedTime) {
      setPreparedTime(cookedTime);
    }
  }, [cookedTime, isReadOnlyTime]);

  useEffect(() => {
    if (open && CookedDateTime) {
      try {
        const [datePart, timePart] = CookedDateTime.split(" ");
        const [day, month, year] = datePart.split("/");
        const formattedDateTime = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timePart}`;
        setCookedTime(formattedDateTime);
      } catch (error) {}
    }
  }, [open, CookedDateTime]);

  const clearData = () => {
    setWeightPerCart("");
    setSelectedItem(null);
    setNumberOfTrays("");
    setSelectedProcessType("");
    setDeliveryLocation("");
    setDeliveryType("Qc ตรวจสอบ");
    setErrorMessage("");
    setWeightError(false);
    setTrayError(false);
    setLocationError(false);
    setProcessTypeError(false);
    setOperatorError(false);
    setPreparedTimeError(false);
    setBatchAfter([]);
    setMixtime("");
    setGrindtime("");
    setTemp("");
    setViscosity("");
    setWeightPerCup("");
    setHistoryDetail("");
    setStoragePurpose("");
    setHistamine("");
    setStoragePurposeError(false);
  };

  const isFutureTime = (selectedTime) => {
    if (!selectedTime) return false;
    return new Date(selectedTime) > new Date();
  };

  const validateInputs = () => {
    let isValid = true;

    if (!operator) { setOperatorError(true); isValid = false; } else { setOperatorError(false); }
    if (!weightPerCart || isNaN(parseFloat(weightPerCart))) { setWeightError(true); isValid = false; } else { setWeightError(false); }
    if (!selectedProcessType) { setProcessTypeError(true); isValid = false; } else { setProcessTypeError(false); }
    if (!numberOfTrays || isNaN(parseInt(numberOfTrays, 10))) { setTrayError(true); isValid = false; } else { setTrayError(false); }

    if (deliveryType === "ส่งห้องเย็นใหญ่" && !storagePurpose) {
      setStoragePurposeError(true); isValid = false;
    } else { setStoragePurposeError(false); }

    if (!preparedTime) {
      setPreparedTimeError(true); isValid = false;
    } else if (isFutureTime(preparedTime)) {
      setPreparedTimeError(true);
      setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาการเตรียมเสร็จได้");
      return false;
    } else { setPreparedTimeError(false); }

    if (cookedTime && isFutureTime(cookedTime)) {
      setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาอบเสร็จ/ต้มเสร็จได้");
      return false;
    }
    if (mixtime && isFutureTime(mixtime)) {
      setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาเริ่มผสมได้");
      return false;
    }
    if (grindtime && isFutureTime(grindtime)) {
      setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาเริ่มบดเนื้อได้");
      return false;
    }

    return isValid;
  };

  const formatDT = (dt) => dt
    ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(dt))
    : "";

  const handleNext = () => {
    if (!validateInputs()) { setSnackbarOpen(true); return; }
    setErrorMessage("");

    // ✅ ถ้าเป็น read-only mode ให้ preparedTime = cookedTime เสมอ
    const effectivePreparedTime = isReadOnlyTime ? cookedTime : preparedTime;

    const updatedData = {
      ...data,
      input2: {
        weightPerCart: parseFloat(weightPerCart),
        operator,
        selectedItem,
        numberOfTrays: parseInt(numberOfTrays, 10),
        selectedProcessType,
        deliveryLocation: "รอCheckin",
        deliveryType,
        preparedTime: formatDT(effectivePreparedTime),
        mixtime: formatDT(mixtime),
        grindtime: formatDT(grindtime),
        temp: temp === "" ? null : temp,
        viscosity: viscosity === "" ? null : viscosity,
        weightPerCup: weightPerCup === "" ? null : weightPerCup,
        historyDetail: historyDetail || null,
        storagePurpose: deliveryType === "ส่งห้องเย็นใหญ่" ? storagePurpose : null,
        histamine: deliveryType === "ส่งห้องเย็นใหญ่" ? (histamine || null) : null,
      },
      batch: data?.batch || "",
      newBatch: data?.newBatch || "",
      batchAfterArray: data?.batchAfterArray || [],
      batchArray: data?.batchArray || [],
      rmfp_id: data?.rmfp_id || "",
      inputValues: data?.inputValues || [],
      cookedDateTimeNew: formatDT(cookedTime),
      preparedDateTimeNew: formatDT(effectivePreparedTime), // ✅ ส่งค่าเดียวกับ cooked สำหรับ rm_type 2,3
      mixtimeNew: formatDT(mixtime),
      grindtimeNew: formatDT(grindtime),
      dest: "รอCheckin",
    };

    onNext(updatedData);
  };

  const handleClose = async () => {
    const troId = data?.inputValues?.[0];
    if (troId) {
      const success = await returnreserveTrolley(troId);
      if (!success) { setErrorDialogOpen(true); return; }
    }
    clearData();
    onClose();
  };

  const returnreserveTrolley = async (tro_id) => {
    try {
      const response = await axios.post(`${API_URL}/api/re/reserveTrolley`, { tro_id });
      return response.data.success;
    } catch { return false; }
  };

  const handleWeightChange = (e) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) { setWeightPerCart(value); setWeightError(false); }
  };

  const handleTrayChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) { setNumberOfTrays(value); setTrayError(false); }
  };

  const handleSnackbarClose = () => setSnackbarOpen(false);

  // ✅ style สำหรับ input ที่เป็น read-only
  const readOnlyTextFieldSx = (base = {}) => ({
    ...base,
    "& .MuiInputBase-root": {
      backgroundColor: isReadOnlyTime ? "#f5f5f5" : "inherit",
    },
  });

  return (
    <Dialog open={open} onClose={(e, reason) => { if (reason === "backdropClick") return; onClose(); }} fullWidth maxWidth="xs">
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, fontSize: "15px", color: "#555" }}>
        <DialogContent sx={{ padding: "8px 16px" }}>
          {errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>}

          <Box sx={{ display: "flex", alignItems: "center", marginTop: "10px" }}>
            <Typography sx={{ fontSize: "18px", fontWeight: 500, color: "#545454", marginBottom: "10px" }}>
              กรุณากรอกข้อมูล
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography style={{ fontSize: "15px" }} color="rgba(0, 0, 0, 0.6)">ป้ายทะเบียน:</Typography>
            {data?.inputValues?.length > 0
              ? <Typography variant="body1" color="rgba(0, 0, 0, 0.6)">{data.inputValues.join(", ")}</Typography>
              : <Typography variant="body2">ไม่มีข้อมูลจาก Modal1</Typography>
            }
          </Box>

          <Typography sx={{ fontSize: "16px", fontWeight: 400, color: "#333", marginTop: "8px", marginBottom: "8px" }}>
            เทียบ Batch Array กับ Batch ใหม่:
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 2 }}>
            {data?.batchArray && data.batchArray.length > 0 ? (
              data.batchArray.map((batchItem, idx) => {
                const newBatch = batchAfter?.[idx] || "N/A";
                return (
                  <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ padding: "4px 8px", backgroundColor: "#f0f0f0", borderRadius: "4px", fontSize: "14px", minWidth: "120px", textAlign: "center", color: "#666" }}>
                      {batchItem}
                    </Box>
                    <Typography sx={{ fontSize: "16px", color: "#666" }}>→</Typography>
                    <Box sx={{ padding: "4px 8px", backgroundColor: "#d0f0d0", borderRadius: "4px", fontSize: "14px", minWidth: "120px", textAlign: "center", fontWeight: "bold" }}>
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

          {/* ✅ เวลาอบเสร็จ — read-only เมื่อ rm_type_id 2,3 */}
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateTimePicker
              label="เวลาอบเสร็จ/ต้มเสร็จ"
              value={cookedTime ? dayjs(cookedTime) : null}
              onChange={(newValue) => {
                if (isReadOnlyTime) return;
                if (newValue && newValue.isAfter(dayjs())) {
                  setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาอบเสร็จ/ต้มเสร็จได้");
                  setSnackbarOpen(true);
                  return;
                }
                setCookedTime(newValue ? newValue.format("YYYY-MM-DDTHH:mm") : "");
              }}
              maxDateTime={isReadOnlyTime ? undefined : dayjs()}
              ampm={false}
              timeSteps={{ minutes: 1 }}
              readOnly={isReadOnlyTime}
              slotProps={{
                textField: {
                  fullWidth: true, size: "small", required: true,
                  sx: readOnlyTextFieldSx({ marginBottom: "16px" }),
                  InputProps: { readOnly: isReadOnlyTime },
                },
              }}
            />
          </LocalizationProvider>

          {/* ✅ เวลาเตรียมเสร็จ — read-only และ sync กับ cookedTime เมื่อ rm_type_id 2,3 */}
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateTimePicker
              label="เวลาเตรียมเสร็จ/ผสมเสร็จ"
              value={isReadOnlyTime ? (cookedTime ? dayjs(cookedTime) : null) : (preparedTime ? dayjs(preparedTime) : null)}
              onChange={(newValue) => {
                if (isReadOnlyTime) return;
                if (newValue && newValue.isAfter(dayjs())) {
                  setPreparedTimeError(true); setTimeValid(false);
                  setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาการเตรียมเสร็จได้");
                  setSnackbarOpen(true);
                  return;
                }
                setPreparedTime(newValue ? newValue.format("YYYY-MM-DDTHH:mm") : "");
                setPreparedTimeError(false); setTimeValid(true);
              }}
              maxDateTime={isReadOnlyTime ? undefined : dayjs()}
              ampm={false}
              timeSteps={{ minutes: 1 }}
              readOnly={isReadOnlyTime}
              slotProps={{
                textField: {
                  fullWidth: true, size: "small", required: true,
                  sx: readOnlyTextFieldSx({ marginBottom: "16px" }),
                  error: preparedTimeError,
                  helperText: preparedTimeError ? "กรุณากรอกวันที่เตรียมเสร็จที่ถูกต้อง และไม่ใช่เวลาอนาคต" : "",
                  InputProps: { readOnly: isReadOnlyTime },
                },
              }}
            />
          </LocalizationProvider>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateTimePicker
              label="เวลาเริ่มผสม(สำหรับ Loaf)"
              value={mixtime ? dayjs(mixtime) : null}
              onChange={(newValue) => {
                if (newValue && newValue.isAfter(dayjs())) {
                  setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาเริ่มผสมได้");
                  setSnackbarOpen(true); return;
                }
                setMixtime(newValue ? newValue.format("YYYY-MM-DDTHH:mm") : "");
              }}
              maxDateTime={dayjs()} ampm={false} timeSteps={{ minutes: 1 }}
              slotProps={{ textField: { fullWidth: true, size: "small", required: false, sx: { marginBottom: "16px" } } }}
            />
          </LocalizationProvider>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateTimePicker
              label="เวลาเริ่มบดเนื้อ(สำหรับ Loaf)"
              value={grindtime ? dayjs(grindtime) : null}
              onChange={(newValue) => {
                if (newValue && newValue.isAfter(dayjs())) {
                  setErrorMessage("ไม่สามารถเลือกเวลาอนาคตเป็นเวลาเริ่มบดเนื้อได้");
                  setSnackbarOpen(true); return;
                }
                setGrindtime(newValue ? newValue.format("YYYY-MM-DDTHH:mm") : "");
              }}
              maxDateTime={dayjs()} ampm={false} timeSteps={{ minutes: 1 }}
              slotProps={{ textField: { fullWidth: true, size: "small", required: false, sx: { marginBottom: "16px" } } }}
            />
          </LocalizationProvider>

          <TextField
            label="น้ำหนักวัตถุดิบ/รถเข็น (กก.)" variant="outlined" fullWidth value={weightPerCart}
            size="small" onChange={handleWeightChange} sx={{ marginBottom: "16px" }}
            error={weightError} helperText={weightError ? "กรุณากรอกน้ำหนักเป็นตัวเลขที่ถูกต้อง" : ""}
            inputProps={{ inputMode: "decimal", pattern: "[0-9]*\\.?[0-9]*" }}
          />

          <TextField
            label="จำนวนถาด" variant="outlined" fullWidth size="small" value={numberOfTrays}
            onChange={handleTrayChange} sx={{ marginBottom: "16px" }}
            error={trayError} helperText={trayError ? "กรุณากรอกจำนวนเป็นตัวเลขเต็มที่ถูกต้อง" : ""}
            inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
          />

          <FormControl fullWidth size="small" sx={{ marginBottom: "16px" }} variant="outlined" error={processTypeError}>
            <InputLabel>ประเภทการแปรรูป</InputLabel>
            <Select value={selectedProcessType} onChange={(e) => { setSelectedProcessType(e.target.value); setProcessTypeError(false); }} label="ประเภทการแปรรูป">
              {processTypes.map((process) => (
                <MenuItem key={process.process_id} value={process}>{process.process_name}</MenuItem>
              ))}
            </Select>
            {processTypeError && <Typography variant="caption" color="error" sx={{ ml: 2 }}>กรุณาเลือกประเภทการแปรรูป</Typography>}
          </FormControl>

          <TextField
            label="ผู้ดำเนินการ" variant="outlined" fullWidth size="small" value={operator}
            onChange={(e) => { setOperator(e.target.value); setOperatorError(false); }}
            sx={{ marginBottom: "16px" }} error={operatorError}
            helperText={operatorError ? "กรุณากรอกชื่อผู้ดำเนินการ" : ""}
          />

          <Box sx={{ display: "flex", gap: 1, marginBottom: "16px" }}>
            <TextField label="Temp (°C)" variant="outlined" fullWidth size="small" value={temp} onChange={(e) => setTemp(e.target.value)} inputProps={{ maxLength: 50 }} />
            <TextField label="ความหนืด" variant="outlined" fullWidth size="small" value={viscosity} onChange={(e) => setViscosity(e.target.value)} inputProps={{ maxLength: 50 }} />
          </Box>

          <TextField
            label="น้ำหนักต่อถ้วย" variant="outlined" fullWidth size="small" value={weightPerCup}
            onChange={(e) => setWeightPerCup(e.target.value)} sx={{ marginBottom: "16px" }} inputProps={{ maxLength: 50 }}
          />

          <TextField
            label="Hist. /ความหนืด / อุณหภูมิ Hist./Viscosity /temp ©"
            variant="outlined" fullWidth multiline rows={3} value={historyDetail} size="small"
            onChange={(e) => setHistoryDetail(e.target.value)} sx={{ marginBottom: "16px" }}
            placeholder="กรอกข้อมูล History (ถ้ามี)" inputProps={{ maxLength: 500 }}
          />

          {/* สถานที่จัดส่ง (QC) */}
          <Box sx={{ border: "1px solid #e0e0e0", borderRadius: "4px", padding: "12px", backgroundColor: "#f8f9fa", marginTop: "8px", marginBottom: deliveryType === "ส่งห้องเย็นใหญ่" ? "8px" : "16px" }}>
            <Typography style={{ color: "#333", fontWeight: 500, fontSize: "15px", marginBottom: "4px" }}>
              การตรวจสอบ:
            </Typography>
            <RadioGroup name="deliveryType" value={deliveryType} onChange={(e) => { setDeliveryType(e.target.value); setStoragePurposeError(false); }}>
              <FormControlLabel value="Qc ตรวจสอบ" control={<Radio size="small" />} style={{ color: "#666" }} label="Qc ตรวจสอบ" />
              <FormControlLabel value="รอกลับมาเตรียม" control={<Radio size="small" />} style={{ color: "#666" }} label="รอกลับมาเตรียม" />
              <FormControlLabel value="ส่งห้องเย็นใหญ่" control={<Radio size="small" />} style={{ color: "#666" }} label="ส่งห้องเย็นใหญ่" />
            </RadioGroup>
          </Box>

          {deliveryType === "ส่งห้องเย็นใหญ่" && (
            <Box sx={{ border: "1px solid #1565C0", borderRadius: "4px", padding: "12px", backgroundColor: "#e3f2fd", marginBottom: "16px" }}>
              <Typography sx={{ fontSize: "14px", fontWeight: 600, color: "#1565C0", marginBottom: "10px" }}>
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
            </Box>
          )}

          <Divider />
        </DialogContent>

        <Box sx={{ padding: "0px 16px 16px 16px", display: "flex", justifyContent: "space-between" }}>
          <Button style={{ backgroundColor: "#E74A3B", color: "#fff" }} variant="contained" startIcon={<CancelIcon />} onClick={handleClose}>
            ยกเลิก
          </Button>
          <Button
            style={{ backgroundColor: !timeValid || preparedTimeError ? "#A0A0A0" : "#41a2e6", color: "#fff" }}
            variant="contained" startIcon={<CheckCircleIcon />} onClick={handleNext}
            disabled={!timeValid || preparedTimeError}
          >
            ยืนยัน
          </Button>
        </Box>
      </Box>

      <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert onClose={handleSnackbarClose} severity="error" sx={{ width: "100%" }}>
          {errorMessage || "กรุณากรอกข้อมูลให้ครบถ้วน"}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default Modal2;