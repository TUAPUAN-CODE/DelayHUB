import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, Box, Typography, Divider, Button, Stack,
  Alert, RadioGroup, FormControlLabel, Radio, TextField,
  TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody
} from "@mui/material";
import PrintModal from "./PrintModal";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import axios from "axios";
axios.defaults.withCredentials = true;
import ModalAlert from "../../../../Popup/AlertSuccess";

const API_URL = import.meta.env.VITE_API_URL;

// ─── QcCheck ──────────────────────────────────────────────────────────────────
const QcCheck = ({
  open, onClose, material_code, materialName, ptc_time, standard_ptc, cold,
  rm_cold_status, rm_status, ComeColdDateTime, slot_id, tro_id, batch, rmfp_id,
  onSuccess, Location, ColdOut, operator, level_eu, formattedDelayTime,
  latestComeColdDate, cooked_date, rmit_date, materials, qccheck, sq_remark,
  mdcheck, md_remark, defect_remark, defectcheck, machine_MD, sq_acceptance,
  defect_acceptance, weight_RM, tray_count, rmm_line_name, withdraw_date,
  name_edit_prod_two, name_edit_prod_three, first_prod, two_prod, three_prod,
  qccheck_cold, receiver_qc_cold, approver, production, remark_rework,
  remark_rework_cold, edit_rework, prepare_mor_night,
  storage_purpose, histamineMap,     
}) => {
  const [showAlert, setShowAlert] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const formatThaiDateTime = (v) => {
    if (!v) return "-";
    try {
      return new Date(v).toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch { return "-"; }
  };

  const formatSpecialChars = (v) => (!v || v === "/") ? "-" : v;

  const calculateTimeDifference = (s, e) => {
    if (!s || !e) return "-";
    try {
      const diff = (new Date(e) - new Date(s)) / (1000 * 60);
      const h = Math.floor(diff / 60), m = Math.floor(diff % 60);
      return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
    } catch { return "-"; }
  };

  const calculateDBS = (standardPtc, ptcTime) => {
    if (!standardPtc || !ptcTime) return "-";
    try {
      const toMin = (v) => {
        const p = v.toString().split('.');
        return parseInt(p[0]) * 60 + (p[1] ? parseInt(p[1]) : 0);
      };
      let diff = toMin(standardPtc) - toMin(ptcTime);
      if (diff < 0) diff = 0;
      const h = Math.floor(diff / 60), m = diff % 60;
      return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
    } catch { return "-"; }
  };

  const convertDelayTimeToHHMM = (text) => {
    if (!text || text === "-") return 0;
    const isExceeded = text.includes("เลยกำหนด");
    let t = text.replace("เลยกำหนด ", "").replace("เหลืออีก ", "");
    let days = 0, hours = 0, minutes = 0;
    if (t.includes("วัน")) { days = parseInt(t.split("วัน")[0].trim()); t = t.split("วัน")[1].trim(); }
    if (t.includes("ชม.")) { hours = parseInt(t.split("ชม.")[0].trim()); t = t.split("ชม.")[1].trim(); }
    if (t.includes("นาที")) { minutes = parseInt(t.split("นาที")[0].trim()); }
    const totalHours = (days * 24) + hours;
    const result = totalHours + (minutes / 100);
    return isExceeded ? -result : result;
  };

  const handleConfirm = async () => {
    const processedMaterials = materials ? materials.map(item => {
      // ✅ แนบ histamine แยกแต่ละ mapping_id
      const histamineValue = histamineMap?.[item.mapping_id];
      const itemWithHistamine = {
        ...item,
        histamine: histamineValue ? parseFloat(histamineValue) : null,
      };

      if (item.rawMatType === "mixed" && item.delayTime) {
        return { ...itemWithHistamine, mix_time: convertDelayTimeToHHMM(item.delayTime) };
      } else if (item.delayTime && item.remaining_rework_time != null) {
        return { ...itemWithHistamine, rework_delay_time: convertDelayTimeToHHMM(item.delayTime) };
      } else if (item.delayTime) {
        return { ...itemWithHistamine, cold: convertDelayTimeToHHMM(item.delayTime) };
      }
      return itemWithHistamine;
    }) : [];

    const payload = {
      mat: material_code,
      rmfpID: rmfp_id ? parseInt(rmfp_id, 10) : null,
      cold: formattedDelayTime,
      ptc_time,
      ColdOut,
      dest: Location,
      operator,
      rm_status,
      tro_id,
      slot_id,
      rm_cold_status,
      batch,
      level_eu,
      weight_RM,
      tray_count,
      rmm_line_name,
      storage_purpose: storage_purpose || null,
      materials: processedMaterials.length > 0 ? processedMaterials : materials,
    };

    console.log("📤 Payload:", JSON.stringify(payload, null, 2));

    try {
      const response = await axios.put(`${API_URL}/api/coldstorage/outcoldstorage`, payload);
      if (response.status === 200) {
        setShowPrintModal(true);
        onSuccess();
        onClose();
        setShowAlert(true);
      }
    } catch (error) {
      console.error("❌ API Error:", error);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={(_, r) => { if (r !== 'backdropClick') onClose(); }}
        fullWidth maxWidth="xs">
        <DialogContent>
          <Typography variant="h6" sx={{ fontSize: "18px", color: "#787878", mb: 2 }}>
            กรุณาตรวจสอบข้อมูลก่อนทำรายการ
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Typography sx={{ fontSize: "16px", color: "#505050", mb: 1 }}>
            รายการวัตถุดิบในรถเข็น: {tro_id}
          </Typography>

          <Box sx={{ mb: 2, maxHeight: 350, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: '4px', p: 2 }}>
            {materials?.length > 0 ? materials.map((item, i) => (
              <Box key={i} sx={{ mb: 3, pb: 2, borderBottom: i < materials.length - 1 ? '1px dashed #ccc' : 'none' }}>
                <Typography sx={{ fontWeight: 'bold', mb: 1, color: '#2388d1', fontSize: '14px' }}>
                  วัตถุดิบที่ {i + 1}
                </Typography>
                <Stack spacing={0.5}>
                  {[
                    ['Batch', item.batch],
                    ['Material', item.material_code],
                    ['รายชื่อวัตถุดิบ', item.materialName],
                    ['Level EU', item.levelEu],
                    ['สถานะ', item.materialStatus],
                    ['เบิกจากห้องเย็นใหญ่', formatThaiDateTime(item.withdraw_date)],
                    ['ต้มเสร็จ', formatThaiDateTime(item.cooked_date)],
                    ['เตรียมเสร็จ', formatThaiDateTime(item.rmit_date)],
                    ['เข้าห้องเย็น 1', formatThaiDateTime(item.come_cold_date)],
                    ...(item.out_cold_date ? [['ออกห้องเย็น 1', formatThaiDateTime(item.out_cold_date)]] : []),
                    ...(item.come_cold_date && item.out_cold_date ? [['DCS 1', calculateTimeDifference(item.come_cold_date, item.out_cold_date)]] : []),
                    ['Qc Sensory', item.qccheck],
                    ['MD Check', item.mdcheck],
                    ['Defect Check', item.defectcheck],
                    ['หมายเลขเครื่อง', formatSpecialChars(item.machine_MD)],
                    // ✅ แสดง histamine ที่กรอกสำหรับ mapping_id นี้
                    ...(histamineMap?.[item.mapping_id] ? [['Histamine', `${histamineMap[item.mapping_id]} ppm`]] : []),
                  ].map(([label, val]) => (
                    <Typography key={label} color="rgba(0,0,0,0.6)" sx={{ fontSize: '13px' }}>
                      {label}: {val || '-'}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )) : (
              <Stack spacing={1}>
                <Typography color="rgba(0,0,0,0.6)">Batch: {batch}</Typography>
                <Typography color="rgba(0,0,0,0.6)">Material: {material_code}</Typography>
                <Typography color="rgba(0,0,0,0.6)">รายชื่อวัตถุดิบ: {materialName}</Typography>
              </Stack>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <Typography color="rgba(0,0,0,0.6)">ป้ายทะเบียน: {tro_id}</Typography>
            <Typography color="rgba(0,0,0,0.6)">สถานที่จัดส่ง: {Location}</Typography>
            {storage_purpose && (
              <Typography color="rgba(0,0,0,0.6)">วัตถุประสงค์: {storage_purpose}</Typography>
            )}
            <Typography color="rgba(0,0,0,0.6)">ไลน์ผลิต: {rmm_line_name || "-"}</Typography>
            <Typography color="rgba(0,0,0,0.6)">ผู้ดำเนินการ: {operator}</Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Button variant="contained" onClick={onClose}
              sx={{ width: "45%", height: "50px", backgroundColor: "#ff4444" }}>
              ยกเลิก
            </Button>
            <Button variant="contained" onClick={handleConfirm}
              sx={{ width: "45%", height: "50px", backgroundColor: "#2388d1" }}>
              ยืนยัน
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {showPrintModal && (
        <PrintModal open={showPrintModal} onClose={() => setShowPrintModal(false)}
          data={{ material_code, materialName, batch, Location, operator, tro_id, slot_id,
            rm_status, rm_cold_status, level_eu, rmm_line_name, materials }} />
      )}
      <ModalAlert open={showAlert} onClose={() => setShowAlert(false)} />
    </>
  );
};

// ─── ModalEditPD ──────────────────────────────────────────────────────────────
const ModalEditPD = ({ open, onClose, data, onSuccess }) => {
  const [errorMessage, setErrorMessage] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [Location, setLocation] = useState("");
  const [operator, setoperator] = useState("");
  const [isConfirmProdOpen, setIsConfirmProdOpen] = useState(false);
  const [processedMaterials, setProcessedMaterials] = useState([]);
  const [showLocationError, setShowLocationError] = useState(false);
  const [storagePurpose, setStoragePurpose] = useState("");
  const [showColdStorageOptions, setShowColdStorageOptions] = useState(false);
  // ✅ histamineMap — { [mapping_id]: string }
  const [histamineMap, setHistamineMap] = useState({});

  const {
    batch, mat, rmfp_id, rm_cold_status, rm_status, tro_id, slot_id,
    ComeColdDateTime, cold, ptc_time, standard_ptc, batch_after, level_eu,
    formattedDelayTime, latestComeColdDate, sq_remark, md_remark, defect_remark,
    qccheck, mdcheck, defectcheck, cooked_date, withdraw_date, rmit_date,
    machine_MD, sq_acceptance, defect_acceptance, rmm_line_name, tray_count,
    weight_RM, name_edit_prod_two, name_edit_prod_three, first_prod, two_prod,
    three_prod, remark_rework, remark_rework_cold, edit_rework, receiver_qc_cold,
    approver, production, qccheck_cold, prepare_mor_night, mapping_id,
    materials = []
  } = data || {};

  useEffect(() => {
    if (open) {
      setLocation(""); setoperator(""); setStoragePurpose("");
      setShowColdStorageOptions(false); setHistamineMap({}); setErrorMessage("");
      const firstName = localStorage.getItem('first_name') || '';
      if (firstName) setoperator(firstName.trim());
    }
  }, [open]);

  useEffect(() => {
    if (mat) fetchMaterialName();
  }, [mat]);

  const fetchMaterialName = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/fetchRawMatName`, { params: { mat } });
      if (res.data.success) setMaterialName(res.data.data[0]?.mat_name || "ไม่พบชื่อวัตถุดิบ");
    } catch (e) { console.error(e); }
  };

  const calculateDelayTimeForItem = (item) => {
    if (!item.latestComeColdDate) return formattedDelayTime;
    return Number(((new Date() - new Date(item.latestComeColdDate)) / (1000 * 60 * 60)).toFixed(2));
  };

  const formatSpecialChars = (v) => (!v || v === "/") ? "-" : v;
  const formatThaiDateTime = (v) => {
    if (!v) return "-";
    try {
      return new Date(v).toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch { return "-"; }
  };
  const calculateDBS = (standardPtc, ptcTime) => {
    if (!standardPtc || !ptcTime) return "-";
    try {
      const toMin = (v) => { const p = v.toString().split('.'); return parseInt(p[0]) * 60 + (p[1] ? parseInt(p[1]) : 0); };
      let diff = toMin(standardPtc) - toMin(ptcTime);
      if (diff < 0) diff = 0;
      const h = Math.floor(diff / 60), m = diff % 60;
      return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
    } catch { return "-"; }
  };

  const handleConfirm = () => {
    if (!operator || !Location) {
      setErrorMessage("กรุณากรอกข้อมูลให้ครบถ้วน");
      if (!Location) setShowLocationError(true);
      return;
    }
    if (Location === "ห้องเย็นใหญ่" && !storagePurpose) {
      setErrorMessage("กรุณาเลือกวัตถุประสงค์การจัดเก็บ");
      return;
    }
    setErrorMessage(""); setShowLocationError(false);
    const processedMats = materials.length > 0
      ? materials.map(item => item.formattedDelayTime !== undefined
        ? item : { ...item, formattedDelayTime: calculateDelayTimeForItem(item) })
      : materials;
    setProcessedMaterials(processedMats);
    setIsConfirmProdOpen(true);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={(_, r) => { if (r !== 'backdropClick') onClose(); }}
        fullWidth maxWidth="md">
        <DialogContent>
          <Typography variant="h6" sx={{ fontSize: "18px", color: "#787878", mb: 2 }}>
            กรุณาระบุข้อมูลในการส่งออก
          </Typography>

          {errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>}

          <Stack spacing={2}>
            <Divider />
            <Typography sx={{ fontSize: "16px", color: "#505050" }}>
              รายการวัตถุดิบในรถเข็น: {tro_id}
            </Typography>

            {/* ── Table ── */}
            <TableContainer component={Paper} sx={{ maxHeight: 300, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Batch','Material','รายชื่อวัตถุดิบ','Level EU','สถานะ','เบิกจาก CS',
                      'ต้มเสร็จ','เตรียมเสร็จ','เข้าห้องเย็น','DBS','Sensory','หมาย S',
                      'MD','หมาย MD','Defect','หมาย D','เครื่อง MD','แผน 1','แผน 2',
                      'ผู้อนุมัติ 2','แผน 3','ผู้อนุมัติ 3','Sensory CS','หมายเหตุ',
                      'หมายเหตุแก้ไข','ประวัติแก้ไข'
                    ].map(h => (
                      <TableCell key={h} sx={{ fontSize: '11px', fontWeight: 600,
                        whiteSpace: 'nowrap', backgroundColor: '#f5f5f5' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {materials?.length > 0 ? materials.map((item, i) => (
                    <TableRow key={i}>
                      {[item.batch, item.material_code, item.materialName, item.levelEu,
                        item.materialStatus, formatThaiDateTime(item.withdraw_date),
                        formatThaiDateTime(item.cooked_date), formatThaiDateTime(item.rmit_date),
                        formatThaiDateTime(item.come_cold_date),
                        calculateDBS(item.standard_ptc, item.ptc_time),
                        item.qccheck, item.sq_remark, item.mdcheck, item.md_remark,
                        item.defectcheck, item.defect_remark, formatSpecialChars(item.machine_MD),
                        item.first_prod, item.two_prod, item.name_edit_prod_two,
                        item.three_prod, item.name_edit_prod_three, item.qccheck_cold,
                        item.remark_rework_cold, item.remark_rework, item.edit_rework,
                      ].map((val, j) => (
                        <TableCell key={j} sx={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {val || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell>{batch}</TableCell>
                      <TableCell>{mat}</TableCell>
                      <TableCell>{materialName}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider />
            <Typography color="rgba(0,0,0,0.6)">เลขรถเข็น: {tro_id}</Typography>
            <Typography color="rgba(0,0,0,0.6)">สถานะห้องเย็น: {rm_cold_status}</Typography>
            <Typography color="rgba(0,0,0,0.6)">ไลน์ผลิต: {rmm_line_name || "-"}</Typography>
            <Divider />

            {/* ── Location ── */}
            <Box sx={{ pl: 1.5 }}>
              <Typography sx={{ color: "#666", mb: 1 }}>
                สถานที่จัดส่ง <span style={{ color: 'red' }}>*</span>
              </Typography>
              <RadioGroup row value={Location} onChange={(e) => {
                const val = e.target.value;
                setLocation(val);
                setShowLocationError(false);
                setErrorMessage("");
                setShowColdStorageOptions(val === "ห้องเย็นใหญ่");
                if (val !== "ห้องเย็นใหญ่") { setStoragePurpose(""); setHistamineMap({}); }
              }}>
                {[
                  { value: 'บรรจุ', color: '#09af00' },
                  { value: 'จุดเตรียม', color: '#ff0000' },
                ].map(({ value, color }) => (
                  <Box key={value} sx={{ bgcolor: color, borderRadius: '4px', px: 1, py: 0.5, mr: 2 }}>
                    <FormControlLabel value={value}
                      control={<Radio sx={{ color: "#000", '&.Mui-checked': { color: "#000" } }} />}
                      label={<Typography sx={{ color: "#fff", fontWeight: 500 }}>{value}</Typography>}
                    />
                  </Box>
                ))}
              </RadioGroup>
              {showLocationError && (
                <Typography sx={{ fontSize: '12px', color: '#d32f2f', mt: 0.5 }}>
                  กรุณาเลือกสถานที่จัดส่ง
                </Typography>
              )}

              {/* ── ห้องเย็นใหญ่ options ── */}
              {showColdStorageOptions && (
                <Box sx={{ mt: 2, p: 2, border: '2px solid rgb(0,174,255)',
                  borderRadius: '8px', bgcolor: '#f0f9ff' }}>

                  {/* 1. วัตถุประสงค์ */}
                  <Typography sx={{ color: '#0077aa', fontWeight: 700, mb: 1.5, fontSize: '15px' }}>
                    1. วัตถุประสงค์การจัดเก็บ <span style={{ color: 'red' }}>*</span>
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                    {[
                      { value: 'ฝากเก็บเพื่อรอผลิต', color: '#1976d2' },
                      { value: 'ฟรีสเพื่อจัดเก็บ', color: '#7b1fa2' },
                      { value: 'ส่งคืน', color: '#c62828' },
                    ].map(({ value, color }) => {
                      const selected = storagePurpose === value;
                      return (
                        <button key={value} onClick={() => setStoragePurpose(value)} style={{
                          padding: '8px 20px', borderRadius: '8px', fontSize: '14px',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                          border: selected ? `2px solid ${color}` : '1.5px solid #ccc',
                          backgroundColor: selected ? color : '#fff',
                          color: selected ? '#fff' : '#444',
                          fontWeight: selected ? 700 : 400, transition: 'all 0.18s ease',
                          boxShadow: selected ? `0 3px 8px ${color}55` : 'none',
                        }}>{value}</button>
                      );
                    })}
                  </Box>

                  {/* 2. Histamine แยกแต่ละ mapping_id */}
                  <Typography sx={{ color: '#0077aa', fontWeight: 700, mb: 1.5, fontSize: '15px' }}>
                    2. ผล Histamine (แยกแต่ละวัตถุดิบ)
                  </Typography>
                  <Stack spacing={1.5}>
                    {(materials?.length > 0 ? materials : [{ mapping_id, batch, materialName }])
                      .map((item, i) => (
                        <Box key={item.mapping_id || i} sx={{
                          display: 'flex', alignItems: 'center', gap: 2,
                          bgcolor: '#fff', border: '1px solid #BBDEFB',
                          borderRadius: '8px', p: 1.5
                        }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#1565C0' }}>
                              วัตถุดิบที่ {i + 1}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#555' }}>
                              {item.batch || batch} — {item.materialName || materialName}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#999' }}>
                              mapping_id: {item.mapping_id}
                            </Typography>
                          </Box>
                          <TextField
                            size="small"
                            label="Histamine"
                            value={histamineMap[item.mapping_id] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                setHistamineMap(prev => ({
                                  ...prev,
                                  [item.mapping_id]: val
                                }));
                              }
                            }}
                            inputProps={{ inputMode: 'decimal' }}
                            sx={{ width: '160px' }}
                            InputProps={{
                              endAdornment: histamineMap[item.mapping_id]
                                ? <Typography sx={{ fontSize: '12px', color: '#888', pr: 0.5 }}>ppm</Typography>
                                : null
                            }}
                          />
                        </Box>
                      ))}
                  </Stack>
                </Box>
              )}
            </Box>

            {/* ── Operator ── */}
            <Box sx={{ pl: 1.5 }}>
              <Typography sx={{ color: "#666", mb: 1 }}>ผู้ดำเนินการ</Typography>
              <TextField label="กรอกชื่อผู้ทำรายการ" variant="outlined" fullWidth
                value={operator} size="small" onChange={(e) => setoperator(e.target.value)}
                sx={{ mb: 2 }} />
            </Box>

            <Divider />
            <Box sx={{ display: "flex", justifyContent: "space-between", pt: 1 }}>
              <Button variant="contained" startIcon={<CancelIcon />}
                style={{ backgroundColor: "#E74A3B", color: "#fff" }} onClick={onClose}>
                ยกเลิก
              </Button>
              <Button variant="contained" startIcon={<CheckCircleIcon />}
                style={{ backgroundColor: "#41a2e6", color: "#fff" }} onClick={handleConfirm}>
                ยืนยัน
              </Button>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      <QcCheck
        open={isConfirmProdOpen}
        onClose={() => setIsConfirmProdOpen(false)}
        material_code={mat} materialName={materialName}
        ColdOut="" Location={Location} operator={operator}
        rm_cold_status={rm_cold_status} tro_id={tro_id} slot_id={slot_id}
        rm_status={rm_status} batch={batch} rmfp_id={rmfp_id}
        ComeColdDateTime={ComeColdDateTime} cold={cold} ptc_time={ptc_time}
        onSuccess={onSuccess} batch_after={batch_after} level_eu={level_eu}
        formattedDelayTime={formattedDelayTime} latestComeColdDate={latestComeColdDate}
        cooked_date={cooked_date} withdraw_date={withdraw_date} rmit_date={rmit_date}
        sq_remark={sq_remark} md_remark={md_remark} defect_remark={defect_remark}
        qccheck={qccheck} mdcheck={mdcheck} defectcheck={defectcheck}
        machine_MD={machine_MD} rmm_line_name={rmm_line_name}
        weight_RM={weight_RM} tray_count={tray_count}
        name_edit_prod_two={name_edit_prod_two} name_edit_prod_three={name_edit_prod_three}
        first_prod={first_prod} two_prod={two_prod} three_prod={three_prod}
        remark_rework={remark_rework} remark_rework_cold={remark_rework_cold}
        edit_rework={edit_rework} receiver_qc_cold={receiver_qc_cold}
        approver={approver} production={production} qccheck_cold={qccheck_cold}
        prepare_mor_night={prepare_mor_night} mapping_id={mapping_id}
        storage_purpose={storagePurpose}
        histamineMap={histamineMap}       // ✅ ส่ง map ทั้งก้อน
        materials={processedMaterials.length > 0 ? processedMaterials : materials}
      />
    </>
  );
};

export default ModalEditPD;