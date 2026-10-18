import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { Alert, Box, Button, Chip, FormControlLabel, IconButton, Paper, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import AddIcon from "@mui/icons-material/Add";
import PrintIcon from "@mui/icons-material/Print";
import StampDialog from "./Asset/StampDialog";
import OutSlip from "./Asset/OutSlip";
import { calcLot, fmtAt, fmtMin, msOf, LIMIT_INSIDE_MIN, LIMIT_OUTSIDE_MIN, LIMIT_AFTER_LID_MIN } from "./Asset/lotCalc";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;
const REFRESH_MS = 60000;
const LEVEL = {
  green: { bg: "#E8F5E9", fg: "#2E7D32", border: "#2E7D32" },
  yellow: { bg: "#FFF8E1", fg: "#B26A00", border: "#B26A00" },
  red: { bg: "#FDECEA", fg: "#C62828", border: "#C62828" },
};
// small tables inside an opened row
const SUB = { background: "#fff", border: "1px solid #E1E9FA", borderRadius: 2, "& .MuiTableHead-root .MuiTableCell-root": { fontWeight: 700, fontSize: 12.5, color: "#5B6B8C", backgroundColor: "#F4F7FD", borderColor: "#E1E9FA" }, "& td": { fontSize: 13 } };
const HEAD = { background: "#1552F0", color: "#fff", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" };
const userName = () => [localStorage.getItem("first_name"), localStorage.getItem("last_name")].filter((v) => v && v !== "null").join(" ") || localStorage.getItem("user_id") || "";

/** "2 h 5 m / 2 h" — green / yellow / red by the time that is left of the limit */
const Clock = ({ chunk, limit }) => {
  if (!chunk) return <span style={{ color: "#B0BAC9" }}>-</span>;
  const c = LEVEL[chunk.level];
  const lim = chunk.limit ?? limit;
  return (
    <Chip
      size="small" label={`${fmtMin(chunk.minutes)} / ${fmtMin(lim)}${chunk.lidAt ? " (เปิดฝา)" : ""}`}
      sx={{ fontWeight: 700, background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    />
  );
};

const DelayControlPage = () => {
  const [lots, setLots] = useState([]);
  const [withClosed, setWithClosed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(() => new Set());
  const [dialog, setDialog] = useState(null); // { kind: "new" | "IN" | "OUT" | "LID", lot? }
  const [slip, setSlip] = useState(null); // slip of an "ออกห้องเย็น" stamp (opens right after the stamp, or again from the table)
  const lastLoad = useRef(0);

  const load = useCallback(async () => {
    lastLoad.current = Date.now();
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/other/lots`, { params: { closed: withClosed ? 1 : 0 } });
      if (!res.data?.success) throw new Error(res.data?.error || "โหลดข้อมูลไม่สำเร็จ");
      setLots(res.data.data || []);
      setError("");
      return res.data.data || [];
    } catch (err) {
      console.error("[Other] load error:", err);
      setError(err.response?.data?.error || err.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
    return null;
  }, [withClosed]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => { setNow(Date.now()); load(); }, REFRESH_MS); return () => clearInterval(t); }, [load]);
  // another device saved something: reload (the server sends "sheetChanged" after every successful write)
  useEffect(() => {
    if (!API_URL) return undefined;
    let timer = null;
    const socket = io(API_URL, { transports: ["websocket"], reconnectionAttempts: 5, reconnectionDelay: 2000, timeout: 10000 });
    const refresh = () => { if (Date.now() - lastLoad.current < 3000) return; clearTimeout(timer); timer = setTimeout(load, 600); };
    socket.emit("joinRoom", "sheetRoom");
    socket.on("connect", () => socket.emit("joinRoom", "sheetRoom"));
    socket.on("sheetChanged", refresh);
    socket.on("connect_error", (err) => console.error("[Other] socket error:", err.message));
    return () => { clearTimeout(timer); socket.off("sheetChanged", refresh); socket.disconnect(); };
  }, [load]);

  const rows = useMemo(() => lots.map((lot) => ({ lot, c: calcLot(lot, now) })), [lots, now]);
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const post = async (url, body) => {
    const res = await axios.post(`${API_URL}${url}`, { ...body, user: userName() });
    if (!res.data?.success) return res.data?.error || "บันทึกไม่สำเร็จ";
    await load();
    return "";
  };
  // the slip of the OUT stamp made at outAt (ms): the kg it took from the cold room (first in, first out) and how long they were in / outside
  const openSlip = (lot, outAt) => {
    const c = calcLot(lot, Date.now());
    const chunks = c.coldChunks.filter((k) => k.outAt === outAt);
    const move = lot.moves.find((m) => m.kind === "OUT" && msOf(m.moved_at) === outAt);
    setSlip({
      lot, outAt, kg: Math.round(chunks.reduce((sum, k) => sum + k.kg, 0) * 100) / 100, chunks, by: move?.created_by || userName(),
    });
  };
  const stampOut = async (lot, values, at) => {
    const res = await axios.post(`${API_URL}/api/other/lots/${lot.lot_id}/move`, { kind: "OUT", qty_kg: values.qty_kg, moved_at: at, user: userName() });
    if (!res.data?.success) return res.data?.error || "บันทึกไม่สำเร็จ";
    const list = await load();
    const fresh = (list || []).find((l) => l.lot_id === lot.lot_id);
    if (fresh && res.data.moved_at) openSlip(fresh, msOf(res.data.moved_at)); // print the slip right after the stamp
    return "";
  };
  const closeLot = async (lot) => {
    if (!window.confirm(`ปิดรายการ "${lot.lot_name}" ?`)) return;
    try { await axios.put(`${API_URL}/api/other/lots/${lot.lot_id}/close`); await load(); } catch (err) { console.error("[Other] close error:", err); setError(err.response?.data?.error || err.message); }
  };

  const dlg = dialog && (() => {
    const { kind, lot } = dialog;
    if (kind === "new") {
      return {
        title: "เพิ่มรายการ (เตรียมเสร็จ)", timeLabel: "เวลาเตรียมเสร็จ",
        fields: [{ key: "lot_name", label: "ชื่อวัตถุดิบ / รายการ", required: true }, { key: "ref_code", label: "Batch / รหัสอ้างอิง" }, { key: "weight_kg", label: "น้ำหนักที่เตรียม (kg)", type: "number", required: true }, { key: "note", label: "หมายเหตุ" }],
        onSubmit: ({ values, at }) => post("/api/other/lots", { ...values, prep_done_at: at }),
      };
    }
    const c = calcLot(lot, now);
    if (kind === "LID") {
      return {
        title: `เปิดฝา — ${lot.lot_name}`, timeLabel: "เวลาเปิดฝา", submitLabel: "บันทึกเปิดฝา",
        hint: `เปิดฝาแล้วต้องเอาออกห้องเย็นภายใน ${fmtMin(LIMIT_AFTER_LID_MIN)} (และไม่เกิน ${fmtMin(LIMIT_INSIDE_MIN)} นับจากเข้าห้องเย็น)`,
        fields: [],
        onSubmit: ({ at }) => post(`/api/other/lots/${lot.lot_id}/lid`, { opened_at: at }),
      };
    }
    const isIn = kind === "IN";
    const max = isIn ? c.unplaced : c.inCold;
    return {
      title: `${isIn ? "เข้าห้องเย็น" : "ออกห้องเย็น"} — ${lot.lot_name}`, timeLabel: isIn ? "เวลาเข้าห้องเย็น" : "เวลาออกห้องเย็น",
      hint: isIn ? `ยังไม่เข้าห้องเย็น ${c.unplaced} kg` : `อยู่ในห้องเย็น ${c.inCold} kg (ออกได้ทีละบางส่วน)`,
      fields: [{ key: "qty_kg", label: isIn ? "น้ำหนักที่เข้า (kg)" : "น้ำหนักที่ออก (kg)", type: "number", required: true, defaultValue: String(max) }],
      onSubmit: ({ values, at }) => (isIn ? post(`/api/other/lots/${lot.lot_id}/move`, { kind, qty_kg: values.qty_kg, moved_at: at }) : stampOut(lot, values, at)),
    };
  })();

  return (
    <div style={{ backgroundColor: "#fff" }} className="flex-1 min-h-0 flex flex-col overflow-hidden relative z-10">
      <main className="max-w-8xl w-full mx-auto pt-2 pb-1 px-1 lg:px-8 flex-1 min-h-0 flex flex-col" style={{ color: "#1B2333" }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 1, flexShrink: 0 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({ kind: "new" })}>เพิ่มรายการ</Button>
          <Typography variant="body2" color="text.secondary">
            ควบคุม Delay: นอกห้องเย็น {fmtMin(LIMIT_OUTSIDE_MIN)} · ในห้องเย็นก่อนเปิดฝา {fmtMin(LIMIT_INSIDE_MIN)} · หลังเปิดฝา {fmtMin(LIMIT_AFTER_LID_MIN)}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <FormControlLabel control={<Switch size="small" checked={withClosed} onChange={(e) => setWithClosed(e.target.checked)} />} label="แสดงรายการที่ปิดแล้ว" />
        </Box>
        {error && <Alert severity="error" sx={{ mb: 1 }} action={<Button color="inherit" size="small" onClick={load}>ลองใหม่</Button>}>{error}</Alert>}
        <Paper sx={{ borderRadius: "16px", overflow: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <TableContainer sx={{ flex: 1, minHeight: 0 }}>
            <Table stickyHeader size="small" sx={{ minWidth: 1100 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...HEAD, width: 44 }} />
                  <TableCell sx={HEAD}>รายการ</TableCell>
                  <TableCell sx={HEAD} align="right">เตรียม (kg)</TableCell>
                  <TableCell sx={HEAD}>เตรียมเสร็จ</TableCell>
                  <TableCell sx={HEAD}>ในห้องเย็น</TableCell>
                  <TableCell sx={HEAD}>เปิดฝา</TableCell>
                  <TableCell sx={HEAD} align="right">ออกแล้ว (kg)</TableCell>
                  <TableCell sx={HEAD}>ทำรายการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(({ lot, c }) => {
                  const lv = LEVEL[c.worst];
                  const isOpen = open.has(lot.lot_id);
                  return (
                    <Fragment key={lot.lot_id}>
                      <TableRow hover sx={{ background: lot.closed ? "#F3F4F6" : c.done ? "#DCEBFF" : lv.bg, opacity: lot.closed ? 0.7 : 1 }}>
                        <TableCell><IconButton size="small" onClick={() => toggle(lot.lot_id)}>{isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}</IconButton></TableCell>
                        <TableCell><strong>{lot.lot_name}</strong>{lot.ref_code ? <div style={{ fontSize: 12, color: "#6B7489" }}>{lot.ref_code}</div> : null}</TableCell>
                        <TableCell align="right">{c.weight}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtAt(lot.prep_done_at)}</TableCell>
                        <TableCell>{c.inCold > 0 ? <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}><b>{c.inCold} kg</b><Clock chunk={c.runningCold} limit={LIMIT_INSIDE_MIN} /></Box> : <span style={{ color: "#B0BAC9" }}>-</span>}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{lot.lid_open_at ? <Chip size="small" color="warning" variant="outlined" label={fmtAt(lot.lid_open_at)} /> : <span style={{ color: "#B0BAC9" }}>ยังไม่เปิด</span>}</TableCell>
                        <TableCell align="right">{c.outKg}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {!lot.closed && (
                            <>
                              <Button size="small" variant="outlined" disabled={c.unplaced <= 0} onClick={() => setDialog({ kind: "IN", lot })} sx={{ mr: 0.5, textTransform: "none" }}>เข้าห้องเย็น</Button>
                              <Button size="small" variant="outlined" color="warning" disabled={c.inCold <= 0 || !!lot.lid_open_at} onClick={() => setDialog({ kind: "LID", lot })} sx={{ mr: 0.5, textTransform: "none" }}>เปิดฝา</Button>
                              <Button size="small" variant="outlined" disabled={c.inCold <= 0} onClick={() => setDialog({ kind: "OUT", lot })} sx={{ mr: 0.5, textTransform: "none" }}>ออกห้องเย็น</Button>
                              <Button size="small" color="inherit" onClick={() => closeLot(lot)} sx={{ textTransform: "none" }}>ปิด</Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={7} sx={{ background: "#FAFBFF" }}>
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.4fr" }, gap: 2, py: 1 }}>
                              <div>
                                <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>นอกห้องเย็น (เตรียมเสร็จ → เข้าห้องเย็น)</Typography>
                                <Table size="small" sx={SUB}>
                                  <TableHead><TableRow><TableCell align="right">น้ำหนัก</TableCell><TableCell>เวลา / เกณฑ์</TableCell><TableCell>เตรียมเสร็จ → เข้าห้องเย็น</TableCell></TableRow></TableHead>
                                  <TableBody>
                                    {c.outsideChunks.map((k, i) => (
                                      <TableRow key={i}>
                                        <TableCell align="right">{k.kg} kg</TableCell>
                                        <TableCell><Clock chunk={k} limit={LIMIT_OUTSIDE_MIN} /></TableCell>
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtAt(k.fromAt)} → {k.toAt ? fmtAt(k.toAt) : <span style={{ color: "#B26A00" }}>ยังไม่เข้าห้องเย็น</span>}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              <div>
                                <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>ในห้องเย็น (เข้า → ออก)</Typography>
                                {c.coldChunks.length ? (
                                  <Table size="small" sx={SUB}>
                                    <TableHead><TableRow><TableCell align="right">น้ำหนัก</TableCell><TableCell>เวลา / เกณฑ์</TableCell><TableCell>เข้าห้องเย็น</TableCell><TableCell>ออกห้องเย็น</TableCell><TableCell>บรรจุเสร็จภายใน</TableCell><TableCell /></TableRow></TableHead>
                                    <TableBody>
                                      {c.coldChunks.map((k, i) => (
                                        <TableRow key={i}>
                                          <TableCell align="right">{k.kg} kg</TableCell>
                                          <TableCell><Clock chunk={k} limit={LIMIT_INSIDE_MIN} /></TableCell>
                                          <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtAt(k.inAt)}</TableCell>
                                          <TableCell sx={{ whiteSpace: "nowrap" }}>{k.outAt ? fmtAt(k.outAt) : <span style={{ color: "#1552F0" }}>ยังอยู่ในห้องเย็น</span>}</TableCell>
                                          <TableCell sx={{ whiteSpace: "nowrap" }}>{k.outAt ? (k.packLeftMin > 0 ? fmtAt(k.packBy) : <span style={{ color: "#C62828" }}>ไม่เหลือเวลา</span>) : "-"}</TableCell>
                                          <TableCell>{k.outAt && <IconButton size="small" title="พิมพ์สลิปออกห้องเย็น" onClick={() => openSlip(lot, k.outAt)}><PrintIcon fontSize="small" /></IconButton>}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : <span style={{ color: "#B0BAC9" }}>ยังไม่เข้าห้องเย็น</span>}
                                {lot.note ? <div style={{ fontSize: 13, marginTop: 6, color: "#6B7489" }}>หมายเหตุ: {lot.note}</div> : null}
                              </div>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                {!rows.length && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5, color: "#90A4AE" }}>{loading ? "กำลังโหลด..." : "ไม่มีรายการ — กด \"เพิ่มรายการ\""}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </main>
      <OutSlip slip={slip} onClose={() => setSlip(null)} />
      {dlg && <StampDialog open title={dlg.title} fields={dlg.fields} timeLabel={dlg.timeLabel} hint={dlg.hint} submitLabel={dlg.submitLabel} onClose={() => setDialog(null)} onSubmit={dlg.onSubmit} />}
    </div>
  );
};

export default DelayControlPage;
