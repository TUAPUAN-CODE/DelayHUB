import React, { useState, useEffect, useRef } from "react";
import {
  Table, TableContainer, TableHead, TableBody, TableRow, TableCell,
  Paper, Box, TextField, TablePagination, Divider, Typography, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, Alert, LinearProgress, Chip, Tooltip,
} from "@mui/material";
import { InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { IoIosAddCircleOutline } from "react-icons/io";
import axios from "axios";
import * as XLSX from "xlsx";

import TableToolbar from "../../../../Layout/TableToolbar";
import useTableTools from "../../../../../hooks/useTableTools";
const API_URL = import.meta.env.VITE_API_URL;
const ENDPOINT = `${API_URL}/api/PkgDgSupp`;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const initialForm = {
  batch_prefix: "",
  start_pos: "",
  length: "",
  supp: "",
  vender: "",
};

const validateForm = (form) => {
  const errors = {};
  if (!form.batch_prefix?.toString().trim()) errors.batch_prefix = "กรุณาระบุ Batch Prefix";
  if (form.start_pos === "" || form.start_pos === null) errors.start_pos = "กรุณาระบุ Start Position";
  else if (isNaN(Number(form.start_pos)) || Number(form.start_pos) < 0) errors.start_pos = "ต้องเป็นตัวเลข ≥ 0";
  if (form.length === "" || form.length === null) errors.length = "กรุณาระบุ Length";
  else if (isNaN(Number(form.length)) || Number(form.length) <= 0) errors.length = "ต้องเป็นตัวเลข > 0";
  if (!form.supp?.toString().trim()) errors.supp = "กรุณาระบุ Supplier Code";
  if (!form.vender?.toString().trim()) errors.vender = "กรุณาระบุ Vendor";
  return errors;
};

// ─────────────────────────────────────────────────────────────
// ADD MODAL
// ─────────────────────────────────────────────────────────────
const AddModal = ({ open, onClose, onSuccess }) => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(initialForm);
      setErrors({});
      setSubmitError("");
    }
  }, [open]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    const v = validateForm(form);
    if (Object.keys(v).length > 0) { setErrors(v); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      await axios.post(ENDPOINT, {
        batch_prefix: form.batch_prefix.trim(),
        start_pos: Number(form.start_pos),
        length: Number(form.length),
        supp: form.supp.trim(),
        vender: form.vender.trim(),
      });
      onSuccess?.();
    } catch (err) {
      setSubmitError(err?.response?.data?.error || err.message || "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? null : onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{
        background: "linear-gradient(135deg, #1552F0 0%, #1552F0 100%)",
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px",
      }}>
        <Typography sx={{ fontSize: "18px", fontWeight: 600 }}>เพิ่มข้อมูล Supplier</Typography>
        <IconButton onClick={onClose} disabled={submitting} sx={{ color: "#fff" }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ padding: "24px !important", backgroundColor: "#fafbff" }}>
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField label="Batch Prefix" required fullWidth size="small" value={form.batch_prefix}
            onChange={handleChange("batch_prefix")} error={!!errors.batch_prefix} helperText={errors.batch_prefix}
            placeholder="เช่น A1B, XY2" />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField label="Start Position" required type="number" fullWidth size="small"
              value={form.start_pos} onChange={handleChange("start_pos")}
              error={!!errors.start_pos} helperText={errors.start_pos} inputProps={{ min: 0 }} />
            <TextField label="Length" required type="number" fullWidth size="small"
              value={form.length} onChange={handleChange("length")}
              error={!!errors.length} helperText={errors.length} inputProps={{ min: 1 }} />
          </Box>
          <TextField label="Supplier Code (supp)" required fullWidth size="small"
            value={form.supp} onChange={handleChange("supp")}
            error={!!errors.supp} helperText={errors.supp} placeholder="เช่น SUP001" />
          <TextField label="Vendor Name" required fullWidth size="small"
            value={form.vender} onChange={handleChange("vender")}
            error={!!errors.vender} helperText={errors.vender} placeholder="ชื่อ vendor" />
        </Box>
      </DialogContent>
      <DialogActions sx={{ padding: "16px 24px", backgroundColor: "#fafbff" }}>
        <Button onClick={onClose} disabled={submitting} sx={{ color: "#666" }}>ยกเลิก</Button>
        <Button onClick={handleSubmit} disabled={submitting} variant="contained"
          sx={{ background: "linear-gradient(135deg, #1552F0 0%, #1552F0 100%)", minWidth: 120 }}
          startIcon={submitting ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : null}>
          {submitting ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────
// EDIT MODAL
// ─────────────────────────────────────────────────────────────
const EditModal = ({ open, onClose, onSuccess, selected }) => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (open && selected) {
      setForm({
        batch_prefix: selected.batch_prefix ?? "",
        start_pos: selected.start_pos ?? "",
        length: selected.length ?? "",
        supp: selected.supp ?? "",
        vender: selected.vender ?? "",
      });
      setErrors({});
      setSubmitError("");
    }
  }, [open, selected]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    const v = validateForm(form);
    if (Object.keys(v).length > 0) { setErrors(v); return; }
    if (!selected?.pkg_dg_supp_id) { setSubmitError("ไม่พบ ID ของรายการที่ต้องการแก้ไข"); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      await axios.put(`${ENDPOINT}/${selected.pkg_dg_supp_id}`, {
        batch_prefix: form.batch_prefix.trim(),
        start_pos: Number(form.start_pos),
        length: Number(form.length),
        supp: form.supp.trim(),
        vender: form.vender.trim(),
      });
      onSuccess?.();
    } catch (err) {
      setSubmitError(err?.response?.data?.error || err.message || "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? null : onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{
        background: "linear-gradient(135deg, #FFA726 0%, #F57C00 100%)",
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px",
      }}>
        <Typography sx={{ fontSize: "18px", fontWeight: 600 }}>แก้ไข Supplier #{selected?.pkg_dg_supp_id}</Typography>
        <IconButton onClick={onClose} disabled={submitting} sx={{ color: "#fff" }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ padding: "24px !important", backgroundColor: "#fffbf5" }}>
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField label="Batch Prefix" required fullWidth size="small" value={form.batch_prefix}
            onChange={handleChange("batch_prefix")} error={!!errors.batch_prefix} helperText={errors.batch_prefix} />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField label="Start Position" required type="number" fullWidth size="small"
              value={form.start_pos} onChange={handleChange("start_pos")}
              error={!!errors.start_pos} helperText={errors.start_pos} inputProps={{ min: 0 }} />
            <TextField label="Length" required type="number" fullWidth size="small"
              value={form.length} onChange={handleChange("length")}
              error={!!errors.length} helperText={errors.length} inputProps={{ min: 1 }} />
          </Box>
          <TextField label="Supplier Code (supp)" required fullWidth size="small"
            value={form.supp} onChange={handleChange("supp")} error={!!errors.supp} helperText={errors.supp} />
          <TextField label="Vendor Name" required fullWidth size="small"
            value={form.vender} onChange={handleChange("vender")} error={!!errors.vender} helperText={errors.vender} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ padding: "16px 24px", backgroundColor: "#fffbf5" }}>
        <Button onClick={onClose} disabled={submitting} sx={{ color: "#666" }}>ยกเลิก</Button>
        <Button onClick={handleSubmit} disabled={submitting} variant="contained"
          sx={{ background: "linear-gradient(135deg, #FFA726 0%, #F57C00 100%)", minWidth: 120 }}
          startIcon={submitting ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : null}>
          {submitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────
// DELETE MODAL
// ─────────────────────────────────────────────────────────────
const DeleteModal = ({ open, onClose, onSuccess, selected }) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => { if (open) setSubmitError(""); }, [open]);

  const handleConfirm = async () => {
    if (!selected?.pkg_dg_supp_id) { setSubmitError("ไม่พบ ID"); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      await axios.delete(`${ENDPOINT}/${selected.pkg_dg_supp_id}`);
      onSuccess?.();
    } catch (err) {
      setSubmitError(err?.response?.data?.error || err.message || "ลบไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? null : onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{
        background: "linear-gradient(135deg, #EF5350 0%, #C62828 100%)",
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px",
      }}>
        <Typography sx={{ fontSize: "18px", fontWeight: 600 }}>ยืนยันการลบ</Typography>
        <IconButton onClick={onClose} disabled={submitting} sx={{ color: "#fff" }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ padding: "24px !important" }}>
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, py: 1 }}>
          <ErrorIcon sx={{ fontSize: 56, color: "#EF5350" }} />
          <Typography sx={{ fontSize: "16px", textAlign: "center" }}>
            คุณต้องการลบรายการนี้ใช่หรือไม่?
          </Typography>
          {selected && (
            <Box sx={{ width: "100%", backgroundColor: "#FFF5F5", p: 2, borderRadius: 2, border: "1px solid #FFCDD2" }}>
              <Typography sx={{ fontSize: "13px", color: "#666" }}>
                <strong>ID:</strong> {selected.pkg_dg_supp_id}
              </Typography>
              <Typography sx={{ fontSize: "13px", color: "#666" }}>
                <strong>Batch Prefix:</strong> {selected.batch_prefix}
              </Typography>
              <Typography sx={{ fontSize: "13px", color: "#666" }}>
                <strong>Supplier:</strong> {selected.supp} - {selected.vender}
              </Typography>
            </Box>
          )}
          <Typography sx={{ fontSize: "12px", color: "#C62828", fontWeight: 500 }}>
            ⚠️ การลบไม่สามารถย้อนกลับได้
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ padding: "16px 24px" }}>
        <Button onClick={onClose} disabled={submitting} sx={{ color: "#666" }}>ยกเลิก</Button>
        <Button onClick={handleConfirm} disabled={submitting} variant="contained" color="error"
          sx={{ minWidth: 100 }}
          startIcon={submitting ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : <DeleteIcon />}>
          {submitting ? "กำลังลบ..." : "ลบ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────
// IMPORT MODAL (Excel / CSV)
// ─────────────────────────────────────────────────────────────
const REQUIRED_COLUMNS = ["batch_prefix", "start_pos", "length", "supp", "vender"];

const ImportModal = ({ open, onClose, onSuccess }) => {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState("");
  const [validationIssues, setValidationIssues] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (open) {
      setFile(null); setParsedRows([]); setParseError("");
      setValidationIssues([]); setUploadResult(null); setUploadError("");
    }
  }, [open]);

  const handleFileSelect = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsing(true);
    setParseError("");
    setParsedRows([]);
    setValidationIssues([]);
    setUploadResult(null);

    try {
      const data = await f.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

      if (rows.length === 0) {
        setParseError("ไฟล์ว่างเปล่า ไม่มีข้อมูลให้นำเข้า");
        setParsing(false); return;
      }

      // Normalize keys: lowercase + trim
      const normalized = rows.map((r) => {
        const out = {};
        Object.keys(r).forEach((k) => {
          const key = String(k).trim().toLowerCase().replace(/\s+/g, "_");
          out[key] = typeof r[k] === "string" ? r[k].trim() : r[k];
        });
        return out;
      });

      // Check required columns
      const firstRowKeys = Object.keys(normalized[0]);
      const missing = REQUIRED_COLUMNS.filter((c) => !firstRowKeys.includes(c));
      if (missing.length > 0) {
        setParseError(`ไฟล์ขาดคอลัมน์: ${missing.join(", ")}\nคอลัมน์ที่ต้องมี: ${REQUIRED_COLUMNS.join(", ")}`);
        setParsing(false); return;
      }

      // Validate each row
      const issues = [];
      const valid = [];
      normalized.forEach((row, idx) => {
        const rowNum = idx + 2; // header is row 1
        const cleaned = {
          batch_prefix: String(row.batch_prefix ?? "").trim(),
          start_pos: row.start_pos,
          length: row.length,
          supp: String(row.supp ?? "").trim(),
          vender: String(row.vender ?? "").trim(),
        };
        const errs = validateForm(cleaned);
        if (Object.keys(errs).length > 0) {
          issues.push({ row: rowNum, errors: errs, data: cleaned });
        } else {
          valid.push({
            ...cleaned,
            start_pos: Number(cleaned.start_pos),
            length: Number(cleaned.length),
          });
        }
      });

      setParsedRows(valid);
      setValidationIssues(issues);
    } catch (err) {
      console.error(err);
      setParseError("ไม่สามารถอ่านไฟล์ได้: " + (err.message || "unknown error"));
    } finally {
      setParsing(false);
    }
  };

  const handleUpload = async () => {
    if (parsedRows.length === 0) return;
    setUploading(true);
    setUploadError("");
    setUploadResult(null);
    try {
      const res = await axios.post(`${ENDPOINT}/bulkImport`, { rows: parsedRows });
      setUploadResult(res.data);
    } catch (err) {
      setUploadError(err?.response?.data?.error || err.message || "นำเข้าไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { batch_prefix: "A1B", start_pos: 0, length: 3, supp: "SUP001", vender: "Vendor Co., Ltd." },
      { batch_prefix: "X2Y", start_pos: 0, length: 3, supp: "SUP002", vender: "Another Vendor" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PKG_DG_Supp");
    XLSX.writeFile(wb, "PKG_DG_Supp_template.xlsx");
  };

  const handleClose = () => {
    if (uploading || parsing) return;
    onClose();
    if (uploadResult) onSuccess?.();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{
        background: "linear-gradient(135deg, #66BB6A 0%, #2E7D32 100%)",
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px",
      }}>
        <Typography sx={{ fontSize: "18px", fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
          <UploadFileIcon /> นำเข้าข้อมูลจาก Excel / CSV
        </Typography>
        <IconButton onClick={handleClose} disabled={uploading || parsing} sx={{ color: "#fff" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ padding: "24px !important", backgroundColor: "#f5fff5" }}>
        {/* Instructions */}
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: "13px", fontWeight: 600, mb: 0.5 }}>คำแนะนำ:</Typography>
          <Typography sx={{ fontSize: "12px" }}>
            • รองรับไฟล์ <strong>.xlsx, .xls, .csv</strong><br />
            • คอลัมน์ที่ต้องมี: <strong>{REQUIRED_COLUMNS.join(", ")}</strong><br />
            • ระบบจะ <strong>upsert</strong> (มี batch_prefix+supp อยู่แล้ว = update / ไม่มี = insert)
          </Typography>
          <Button size="small" onClick={handleDownloadTemplate} startIcon={<DownloadIcon />}
            sx={{ mt: 1, textTransform: "none" }}>
            ดาวน์โหลด Template
          </Button>
        </Alert>

        {/* File picker */}
        <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}
            disabled={parsing || uploading}
            sx={{ textTransform: "none" }}>
            เลือกไฟล์
            <input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect} />
          </Button>
          {file && (
            <Chip label={file.name} onDelete={() => { setFile(null); setParsedRows([]); setValidationIssues([]); setParseError(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              disabled={uploading} sx={{ maxWidth: 300 }} />
          )}
          {parsing && <CircularProgress size={20} />}
        </Box>

        {/* Parse error */}
        {parseError && (
          <Alert severity="error" sx={{ mb: 2, whiteSpace: "pre-line" }}>{parseError}</Alert>
        )}

        {/* Summary */}
        {(parsedRows.length > 0 || validationIssues.length > 0) && !uploadResult && (
          <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
            <Chip icon={<CheckCircleIcon />} label={`พร้อมนำเข้า: ${parsedRows.length} แถว`}
              color="success" sx={{ fontWeight: 600 }} />
            {validationIssues.length > 0 && (
              <Chip icon={<WarningAmberIcon />} label={`มีปัญหา: ${validationIssues.length} แถว`}
                color="warning" sx={{ fontWeight: 600 }} />
            )}
          </Box>
        )}

        {/* Validation issues table */}
        {validationIssues.length > 0 && !uploadResult && (
          <Box sx={{ mb: 2, maxHeight: 200, overflow: "auto", border: "1px solid #FFE0B2", borderRadius: 2 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ backgroundColor: "#FFF3E0", fontWeight: 600 }}>แถว</TableCell>
                  <TableCell sx={{ backgroundColor: "#FFF3E0", fontWeight: 600 }}>ปัญหา</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {validationIssues.map((iss, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ color: "#E65100", fontWeight: 600 }}>{iss.row}</TableCell>
                    <TableCell sx={{ fontSize: "12px", color: "#BF360C" }}>
                      {Object.entries(iss.errors).map(([k, v]) => `${k}: ${v}`).join(" | ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Preview valid rows */}
        {parsedRows.length > 0 && !uploadResult && (
          <Box sx={{ maxHeight: 300, overflow: "auto", border: "1px solid #C8E6C9", borderRadius: 2 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {REQUIRED_COLUMNS.map((c) => (
                    <TableCell key={c} sx={{ backgroundColor: "#E8F5E9", fontWeight: 600, fontSize: "12px" }}>
                      {c}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {parsedRows.slice(0, 100).map((r, i) => (
                  <TableRow key={i}>
                    {REQUIRED_COLUMNS.map((c) => (
                      <TableCell key={c} sx={{ fontSize: "12px" }}>{String(r[c] ?? "")}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {parsedRows.length > 100 && (
              <Box sx={{ p: 1, textAlign: "center", color: "#666", fontSize: "12px", backgroundColor: "#fafafa" }}>
                ...แสดง 100 จาก {parsedRows.length} แถว (ทั้งหมดจะถูกนำเข้า)
              </Box>
            )}
          </Box>
        )}

        {/* Upload progress */}
        {uploading && (
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontSize: "13px", color: "#666", mb: 1 }}>กำลังบันทึกข้อมูล...</Typography>
            <LinearProgress />
          </Box>
        )}

        {/* Upload result */}
        {uploadResult && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>นำเข้าสำเร็จ!</Typography>
            <Typography sx={{ fontSize: "13px" }}>
              • เพิ่มใหม่: <strong>{uploadResult.inserted ?? 0}</strong> แถว<br />
              • อัปเดต: <strong>{uploadResult.updated ?? 0}</strong> แถว<br />
              {uploadResult.failed > 0 && <>• ล้มเหลว: <strong>{uploadResult.failed}</strong> แถว<br /></>}
              รวม: <strong>{uploadResult.total ?? parsedRows.length}</strong> แถว
            </Typography>
          </Alert>
        )}

        {uploadError && <Alert severity="error" sx={{ mt: 2 }}>{uploadError}</Alert>}
      </DialogContent>
      <DialogActions sx={{ padding: "16px 24px", backgroundColor: "#f5fff5" }}>
        <Button onClick={handleClose} disabled={uploading || parsing} sx={{ color: "#666" }}>
          {uploadResult ? "ปิด" : "ยกเลิก"}
        </Button>
        {!uploadResult && (
          <Button onClick={handleUpload} disabled={uploading || parsing || parsedRows.length === 0}
            variant="contained"
            sx={{ background: "linear-gradient(135deg, #66BB6A 0%, #2E7D32 100%)", minWidth: 160 }}
            startIcon={uploading ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : <UploadFileIcon />}>
            {uploading ? "กำลังนำเข้า..." : `นำเข้า ${parsedRows.length} แถว`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
const MainLineType = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [baseRows, setFilteredRows] = useState([]);
  const tableTools = useTableTools(baseRows);
  const filteredRows = tableTools.result;
  useEffect(() => { setPage(0); }, [tableTools.search, tableTools.sorts]);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [selected, setSelected] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(ENDPOINT);
      const rows = Array.isArray(res.data) ? res.data : res.data.data || [];
      setData(rows);
      setFilteredRows(rows);
    } catch (err) {
      console.error("Fetch error:", err);
      setData([]); setFilteredRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!loading && Array.isArray(data)) {
      const term = searchTerm.toLowerCase();
      setFilteredRows(
        data.filter((row) =>
          Object.values(row).join(" ").toLowerCase().includes(term)
        )
      );
      setPage(0);
    }
  }, [searchTerm, data, loading]);

  const handleChangePage = (e, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); };

  const handleModalSuccess = () => {
    fetchData();
    setAddOpen(false); setEditOpen(false); setDeleteOpen(false);
    // ไม่ปิด importOpen — ให้ user เห็น result ก่อน
  };

  const columns = [
    { key: "pkg_dg_supp_id", label: "ID", width: "8%", minWidth: "70px" },
    { key: "batch_prefix", label: "Batch Prefix", width: "15%", minWidth: "130px" },
    { key: "start_pos", label: "Start Pos", width: "10%", minWidth: "90px" },
    { key: "length", label: "Length", width: "10%", minWidth: "80px" },
    { key: "supp", label: "Supplier Code", width: "15%", minWidth: "130px" },
    { key: "vender", label: "Vendor", width: "27%", minWidth: "200px" },
    { key: "_edit", label: "แก้ไข", width: "7%", minWidth: "75px", action: true },
    { key: "_delete", label: "ลบ", width: "7%", minWidth: "75px", action: true },
  ];

  return (
    <>
      <Paper sx={{
        width: "86vw", height: "100%",
        display: "flex", flexDirection: "column", overflow: "hidden",
        margin: 0, padding: 0, borderRadius: 0, boxShadow: "none",
        position: "relative", left: 0, right: 0,
      }}>
        {/* Toolbar */}
        <Box sx={{
          display: "flex", alignItems: "center", gap: 1,
          padding: "10px 15px", height: "70px", minHeight: "70px",
          flexShrink: 0, width: "100%", margin: 0,
        }}>
          <TextField variant="outlined" fullWidth placeholder="พิมพ์เพื่อค้นหา..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              sx: { height: "45px" },
            }}
            sx={{
              "& .MuiOutlinedInput-root": { height: "45px", fontSize: "16px", borderRadius: "8px", color: "#6B7489" },
              "& input": { padding: "10px" },
            }} />

          <Tooltip title="นำเข้าจากไฟล์ Excel/CSV">
            <Button variant="outlined" onClick={() => setImportOpen(true)}
              sx={{
                border: "1px solid #cbcbcb", padding: "8px 16px", margin: "3px",
                borderRadius: "8px", cursor: "pointer", display: "inline-flex",
                alignItems: "center", gap: "8px", whiteSpace: "nowrap",
                fontSize: "16px", color: "#6B7489", backgroundColor: "transparent",
                minWidth: "auto", height: "45px",
                "&:hover": { backgroundColor: "#16a34a", color: "white", borderColor: "#16a34a",
                  "& .imp-icon": { color: "white !important" } },
              }}>
              <UploadFileIcon className="imp-icon" sx={{ color: "#16a34a", fontSize: "22px", transition: "color 0.2s" }} />
              <span>Import</span>
            </Button>
          </Tooltip>

          <Button variant="outlined" onClick={() => setAddOpen(true)}
            sx={{
              border: "1px solid #cbcbcb", padding: "8px 16px", margin: "3px",
              borderRadius: "8px", cursor: "pointer", display: "inline-flex",
              alignItems: "center", gap: "8px", whiteSpace: "nowrap",
              fontSize: "16px", color: "#6B7489", backgroundColor: "transparent",
              minWidth: "auto", height: "45px",
              "&:hover": { backgroundColor: "#22c55e", color: "white", borderColor: "#22c55e",
                "& .add-icon": { color: "white !important" } },
            }}>
            <IoIosAddCircleOutline className="add-icon"
              style={{ color: "#12D300", fontSize: "25px", transition: "color 0.2s" }} />
            <span>เพิ่ม Supplier</span>
          </Button>
        </Box>

        {/* Table */}
        <TableToolbar tools={tableTools} resultCount={filteredRows.length} />
      <TableContainer sx={{ flex: 1, overflow: "auto", padding: "0 15px", width: "100%" }}>
          <Table stickyHeader sx={{ minWidth: "100%", width: "100%" }}>
            <TableHead>
              <TableRow sx={{ height: "50px" }}>
                {columns.map((col, i) => (
                  <TableCell key={col.key} align="center"
                    sx={{
                      backgroundColor: "#1552F0", border: "1px solid #E3E8F2",
                      padding: "16px", minWidth: col.minWidth, width: col.width,
                      borderRadius: i === 0 ? "8px 0 0 8px" : i === columns.length - 1 ? "0 8px 8px 0" : "0",
                      position: "sticky", top: 0, zIndex: 2,
                    }}>
                    <Typography sx={{ fontSize: "16px", color: "#fff", fontWeight: 500 }}>{col.label}</Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={columns.length} align="center" sx={{ padding: "40px" }}>
                  <CircularProgress size={32} />
                  <Typography sx={{ mt: 1, fontSize: "14px", color: "#888" }}>กำลังโหลด...</Typography>
                </TableCell></TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length} align="center" sx={{ padding: "40px" }}>
                  <Typography sx={{ fontSize: "16px", color: "#aaa" }}>ไม่พบข้อมูล</Typography>
                </TableCell></TableRow>
              ) : (
                filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, idx) => (
                  <TableRow key={row.pkg_dg_supp_id ?? idx}
                    sx={{
                      backgroundColor: idx % 2 === 0 ? "#fff" : "#EAF0FF",
                      "&:hover": { backgroundColor: "#EAF0FF" },
                      height: "55px",
                    }}>
                    <TableCell align="center" sx={{ fontSize: "14px", padding: "12px", color: "#666" }}>
                      {row.pkg_dg_supp_id}
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: "15px", padding: "12px", fontWeight: 600, color: "#1552F0" }}>
                      {row.batch_prefix}
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: "14px", padding: "12px" }}>
                      {row.start_pos}
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: "14px", padding: "12px" }}>
                      {row.length}
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: "14px", padding: "12px" }}>
                      {row.supp}
                    </TableCell>
                    <TableCell align="left" sx={{ fontSize: "14px", padding: "12px 16px" }}>
                      {row.vender}
                    </TableCell>
                    <TableCell align="center" sx={{ padding: 0,
                      "&:hover": { backgroundColor: "rgba(234, 179, 8, 0.1)" } }}
                      onClick={() => { setSelected(row); setEditOpen(true); }}>
                      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer", padding: "12px" }}>
                        <EditIcon sx={{ fontSize: "22px", color: "#eab308", "&:hover": { color: "#ca8a04" } }} />
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={{ padding: 0,
                      "&:hover": { backgroundColor: "rgba(239, 68, 68, 0.1)" } }}
                      onClick={() => { setSelected(row); setDeleteOpen(true); }}>
                      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer", padding: "12px" }}>
                        <DeleteIcon sx={{ fontSize: "22px", color: "#ef4444", "&:hover": { color: "#dc2626" } }} />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box sx={{ flexShrink: 0 }}>
          <Divider />
          <TablePagination
            sx={{
              "& .MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows, .MuiTablePagination-toolbar": {
                fontSize: "12px", color: "#6B7489", padding: "8px",
              },
              padding: "0 15px",
            }}
            rowsPerPageOptions={[20, 50, 100, 200]}
            component="div" count={filteredRows.length} rowsPerPage={rowsPerPage} page={page}
            onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="แถวต่อหน้า:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} จาก ${count}`}
          />
        </Box>
      </Paper>

      {/* All Modals */}
      <AddModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleModalSuccess} />
      <EditModal open={editOpen} onClose={() => setEditOpen(false)} onSuccess={handleModalSuccess} selected={selected} />
      <DeleteModal open={deleteOpen} onClose={() => setDeleteOpen(false)} onSuccess={handleModalSuccess} selected={selected} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onSuccess={() => { fetchData(); setImportOpen(false); }} />
    </>
  );
};

export default MainLineType;