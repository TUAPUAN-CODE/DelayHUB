import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Alert, Box, Button, IconButton, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ReplayIcon from "@mui/icons-material/Replay";
import SearchIcon from "@mui/icons-material/Search";
import LotSlip from "../DelayControl/Asset/LotSlip";
import LotDetail from "../DelayControl/Asset/LotDetail";
import { calcLot, calcSets, fmtAt } from "../DelayControl/Asset/lotCalc";
import { apiError, DIM, HEAD, LotId, userName } from "../DelayControl/Asset/lotUi";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;
const COLS = 9;

// History of the Role "Other": the lots closed with "ปิด" on the Delay page (newest closed first). Read only + print the slips again;
// "Recall" puts a lot back on the Delay page.
const DelayHistoryPage = () => {
  const navigate = useNavigate();
  const [lots, setLots] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const [slips, setSlips] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (text) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/other/lots`, { params: { scope: "history", q: text || undefined } });
      if (!res.data?.success) throw new Error(res.data?.error || "โหลดข้อมูลไม่สำเร็จ");
      setLots(res.data.data || []);
      setNow(Date.now());
      setError("");
    } catch (err) {
      console.error("[Other history] load error:", err);
      setError(apiError(err, "โหลดข้อมูลไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, []);

  // search while typing (after a short pause)
  useEffect(() => { const t = setTimeout(() => load(q.trim()), 400); return () => clearTimeout(t); }, [q, load]);

  const rows = useMemo(() => lots.map((lot) => {
    const c = calcLot(lot, now);
    return { lot, c, s: calcSets(lot, c, now) };
  }), [lots, now]);
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const recall = async (lot) => {
    if (!window.confirm(`Recall รายการ #${lot.lot_id} "${lot.lot_name}" กลับไปหน้าคุม Delay ?`)) return;
    try {
      const res = await axios.put(`${API_URL}/api/other/lots/${lot.lot_id}/recall`, { user: userName() });
      if (!res.data?.success) { setError(res.data?.error || "recall ไม่สำเร็จ"); return; }
      await load(q.trim());
    } catch (err) {
      console.error("[Other history] recall error:", err);
      setError(apiError(err, "recall ไม่สำเร็จ"));
    }
  };

  return (
    <div style={{ backgroundColor: "#fff" }} className="flex-1 min-h-0 flex flex-col overflow-hidden relative z-10">
      <main className="max-w-8xl w-full mx-auto pt-2 pb-1 px-1 lg:px-8 flex-1 min-h-0 flex flex-col" style={{ color: "#1B2333" }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 1, flexShrink: 0 }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/other/delay")} sx={{ textTransform: "none" }}>คุม Delay</Button>
          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>History — รายการที่ปิดแล้ว</Typography>
          <Box sx={{ flex: 1 }} />
          <TextField
            size="small" placeholder="ค้นหา ID / ชื่อ / Batch" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 260 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
        </Box>
        {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError("")}>{error}</Alert>}
        <Paper sx={{ borderRadius: "16px", overflow: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <TableContainer sx={{ flex: 1, minHeight: 0 }}>
            <Table stickyHeader size="small" sx={{ minWidth: 1100 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...HEAD, width: 44 }} />
                  <TableCell sx={HEAD}>ID</TableCell>
                  <TableCell sx={HEAD}>รายการ</TableCell>
                  <TableCell sx={HEAD} align="right">เตรียม (kg)</TableCell>
                  <TableCell sx={HEAD}>เตรียมเสร็จ</TableCell>
                  <TableCell sx={HEAD} align="right">ออกแล้ว (kg)</TableCell>
                  <TableCell sx={HEAD}>ปิดเมื่อ</TableCell>
                  <TableCell sx={HEAD}>ปิดโดย</TableCell>
                  <TableCell sx={HEAD} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(({ lot, c, s }) => {
                  const isOpen = open.has(lot.lot_id);
                  return (
                    <Fragment key={lot.lot_id}>
                      <TableRow hover>
                        <TableCell><IconButton size="small" onClick={() => toggle(lot.lot_id)}>{isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}</IconButton></TableCell>
                        <TableCell><LotId lot={lot} /></TableCell>
                        <TableCell><strong>{lot.lot_name}</strong>{lot.ref_code ? <div style={{ fontSize: 12, color: "#6B7489" }}>{lot.ref_code}</div> : null}</TableCell>
                        <TableCell align="right">{c.weight}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtAt(lot.prep_done_at)}</TableCell>
                        <TableCell align="right">{c.outKg}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{lot.closed_at ? fmtAt(lot.closed_at) : <span style={DIM}>-</span>}</TableCell>
                        <TableCell>{lot.closed_by || <span style={DIM}>-</span>}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          <Button size="small" variant="outlined" startIcon={<ReplayIcon />} onClick={() => recall(lot)} sx={{ textTransform: "none" }}>Recall</Button>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={COLS - 1} sx={{ background: "#FAFBFF" }}>
                            <LotDetail lot={lot} c={c} s={s} readOnly onPrint={setSlips} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                {!rows.length && <TableRow><TableCell colSpan={COLS} align="center" sx={{ py: 5, color: "#90A4AE" }}>{loading ? "กำลังโหลด..." : "ไม่มีรายการที่ปิดแล้ว"}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </main>
      <LotSlip slips={slips} onClose={() => setSlips(null)} />
    </div>
  );
};

export default DelayHistoryPage;
