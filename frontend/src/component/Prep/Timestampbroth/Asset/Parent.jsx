import React, { useState, useEffect } from "react";
import {
  Button, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Typography, Box, Tooltip, IconButton, Chip
} from "@mui/material";
import CameraActivationModal from "./timestamp";
import DataReviewSAP from "./ModalConfirmSAP";
import { IoBarcodeSharp } from "react-icons/io5";
import PrintIcon from "@mui/icons-material/Print";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import axios from "axios";
axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

const printBrothSlip = () => {
  const now = new Date();
  const cool = new Date(now.getTime() + 30 * 60 * 1000);
  const delay = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const fmt = (d) =>
    d.toLocaleString("th-TH", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });

  execPrint(`
    <div class="bs-title">น้ำอบไก่</div>
    <div class="bs-row"><span class="bs-label">เก็บ</span><span class="bs-value">${fmt(now)}</span></div>
    <div class="bs-row"><span class="bs-label">ทำเย็นเสร็จ</span><span class="bs-value">${fmt(cool)}</span></div>
    <div class="bs-row"><span class="bs-label">Delay</span><span class="bs-value">${fmt(delay)}</span></div>
  `);
};

const SLIP_STYLE = `
  #__broth_slip__ { display: none; }
  @media print {
    @page { size: 80mm auto; margin: 4mm; }
    body > *:not(#__broth_slip__) { display: none !important; visibility: hidden !important; }
    #__broth_slip__ {
      display: block !important; visibility: visible !important;
      font-family: 'Sarabun', Arial, sans-serif; font-size: 40px; padding: 14px;
    }
    #__broth_slip__ .bs-title {
      font-size: 89px; font-weight: 700; text-align: center;
      margin-bottom: 70px; border-bottom: 2px solid #000; padding-bottom: 18px;
    }
    #__broth_slip__ .bs-row {
      display: flex; justify-content: space-between;
      padding: 40px 0; border-bottom: 1px dashed #ccc;
    }
    #__broth_slip__ .bs-label { font-weight: 600; color: #333; }
    #__broth_slip__ .bs-value { color: #000; }
  }
`;

const execPrint = (innerHTML) => {
  document.getElementById("__broth_slip__")?.remove();
  document.getElementById("__broth_slip_style__")?.remove();

  const slipEl = document.createElement("div");
  slipEl.id = "__broth_slip__";
  slipEl.innerHTML = innerHTML;

  const styleEl = document.createElement("style");
  styleEl.id = "__broth_slip_style__";
  styleEl.innerHTML = SLIP_STYLE;

  document.body.appendChild(styleEl);
  document.body.appendChild(slipEl);
  window.print();

  const cleanup = () => {
    document.getElementById("__broth_slip__")?.remove();
    document.getElementById("__broth_slip_style__")?.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
};

// slip หลัง stamp start — แสดงเฉพาะเวลาเก็บ
const printStartSlip = (row) => {
  execPrint(`
    <div class="bs-title">น้ำอบไก่</div>
    <div class="bs-row"><span class="bs-label">NO</span><span class="bs-value">${row.time_stamp_ck ?? "-"}</span></div>
    <div class="bs-row"><span class="bs-label">เก็บ</span><span class="bs-value">${row.start_datetime ?? "-"}</span></div>
  `);
};

// slip หลัง stamp cooling — แสดงครบ 3 เวลา
const printFullSlip = (row) => {
  execPrint(`
    <div class="bs-title">น้ำอบไก่</div>
    <div class="bs-row"><span class="bs-label">NO</span><span class="bs-value">${row.time_stamp_ck ?? "-"}</span></div>
    <div class="bs-row"><span class="bs-label">เก็บ</span><span class="bs-value">${row.start_datetime ?? "-"}</span></div>
    <div class="bs-row"><span class="bs-label">ทำเย็นเสร็จ</span><span class="bs-value">${row.cooling_datetime ?? "-"}</span></div>
    <div class="bs-row"><span class="bs-label">Delay</span><span class="bs-value">${row.end_datetime ?? "-"}</span></div>
  `);
};

const Parent = () => {
  const [openCameraModal, setOpenCameraModal] = useState(false);
  const [primaryBatch, setPrimaryBatch] = useState("");
  const [secondaryBatch, setSecondaryBatch] = useState("");
  const [hu, setHu] = useState("");
  const [openDataReview, setOpenDataReview] = useState(false);

  const [rows, setRows] = useState([]);
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingCooling, setLoadingCooling] = useState(null);

  const fetchRows = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/prep/timestamp-ck`);
      if (res.data.success) setRows(res.data.data ?? []);
    } catch (err) {
      console.error("fetchRows error:", err);
    }
  };

  useEffect(() => { fetchRows(); }, []);

  const handleStart = async () => {
    try {
      setLoadingStart(true);
      await axios.post(`${API_URL}/api/prep/timestamp-ck/start`);
      await fetchRows();
    } catch (err) {
      console.error("handleStart error:", err);
    } finally {
      setLoadingStart(false);
    }
  };

  const handleCooling = async (id) => {
    try {
      setLoadingCooling(id);
      await axios.put(`${API_URL}/api/prep/timestamp-ck/cooling`, { id });
      await fetchRows();
    } catch (err) {
      console.error("handleCooling error:", err);
    } finally {
      setLoadingCooling(null);
    }
  };

  const handleConfirmCameraModal = (a, b, c) => {
    setPrimaryBatch(a); setSecondaryBatch(b); setHu(c);
    setOpenDataReview(true);
    setOpenCameraModal(false);
  };

  return (
    <div style={{ padding: "16px" }}>
      {/* ── Top action bar ── */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        {/* พิมพ์สลิป */}
        {/* <Button
          variant="contained"
          onClick={printBrothSlip}
          style={{
            backgroundColor: "#fff", color: "#6B7489",
            padding: "10px 24px", display: "flex", justifyContent: "space-between",
            alignItems: "center", borderLeft: "8px solid #e65100",
            width: "220px", boxShadow: "0 1px 4px rgba(0,0,0,.12)"
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ color: "#e65100", fontSize: "13px", fontWeight: 600 }}>พิมพ์สลิป</div>
            <div style={{ color: "#6B7489", fontSize: "12px" }}>น้ำอบไก่</div>
          </div>
          <PrintIcon style={{ color: "#e65100", fontSize: "32px", marginLeft: "16px" }} />
        </Button> */}

        {/* Timestamp เก็บ (Start) */}
        <Button
          variant="contained"
          onClick={handleStart}
          disabled={loadingStart}
          style={{
            backgroundColor: "#fff", color: "#6B7489",
            padding: "10px 24px", display: "flex", justifyContent: "space-between",
            alignItems: "center", borderLeft: "8px solid #2e7d32",
            width: "220px", boxShadow: "0 1px 4px rgba(0,0,0,.12)"
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ color: "#2e7d32", fontSize: "13px", fontWeight: 600 }}>
              {loadingStart ? "กำลังบันทึก..." : "Timestamp เก็บ"}
            </div>
            <div style={{ color: "#6B7489", fontSize: "12px" }}>บันทึกเวลา Start</div>
          </div>
          <AcUnitIcon style={{ color: "#2e7d32", fontSize: "32px", marginLeft: "16px" }} />
        </Button>
      </Box>

      {/* ── Table ── */}
      <TableContainer component={Paper} sx={{ maxHeight: "60vh", boxShadow: "0 1px 4px rgba(0,0,0,.15)" }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {["#", "เวลาเก็บ", "เวลาทำเย็น", "Delay", "ทำเย็น", "Print"].map((h, i) => (
                <TableCell key={i} align="center"
                  sx={{ bgcolor: "#0F3FC4", color: "#fff", fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap" }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ color: "#aaa", py: 4 }}>
                  ไม่มีข้อมูล
                </TableCell>
              </TableRow>
            ) : rows.map((row, idx) => (
              <TableRow key={row.time_stamp_ck}
                sx={{ bgcolor: idx % 2 === 0 ? "#fff" : "#F5F8FF", "&:hover": { bgcolor: "#EAF0FF" } }}>
                <TableCell align="center" sx={{ fontSize: "13px", color: "#555" }}>{idx + 1}</TableCell>
                <TableCell align="center" sx={{ fontSize: "13px", color: "#2e7d32", fontWeight: 600 }}>
                  {row.start_datetime ?? "-"}
                </TableCell>
                <TableCell align="center" sx={{ fontSize: "13px", color: "#0F3FC4", fontWeight: 600 }}>
                  {row.cooling_datetime ?? (
                    <Chip label="รอ" size="small" sx={{ bgcolor: "#fff3e0", color: "#e65100", fontSize: "11px" }} />
                  )}
                </TableCell>
                <TableCell align="center" sx={{ fontSize: "13px", color: "#6a1b9a", fontWeight: 600 }}>
                  {row.end_datetime ?? "-"}
                </TableCell>
                <TableCell align="center">
                  {!row.cooling_datetime ? (
                    <Tooltip title="Timestamp เวลาทำเย็น">
                      <IconButton
                        size="small"
                        onClick={() => handleCooling(row.time_stamp_ck)}
                        disabled={loadingCooling === row.time_stamp_ck}
                        sx={{ color: "#0F3FC4", "&:hover": { bgcolor: "#EAF0FF" } }}
                      >
                        <AcUnitIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <AcUnitIcon fontSize="small" sx={{ color: "#bbb" }} />
                  )}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title={row.cooling_datetime ? "พิมพ์สลิป (ครบ 3 เวลา)" : "พิมพ์สลิป (เวลาเก็บ)"}>
                    <IconButton
                      size="small"
                      onClick={() => row.cooling_datetime ? printFullSlip(row) : printStartSlip(row)}
                      sx={{ color: "#e65100", "&:hover": { bgcolor: "#fff3e0" } }}
                    >
                      <PrintIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

    </div>
  );
};

export default Parent;