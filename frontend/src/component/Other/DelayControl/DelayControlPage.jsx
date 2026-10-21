import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { Alert, Box, Button, Chip, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import StampDialog from "./Asset/StampDialog";
import SplitDialog from "./Asset/SplitDialog";
import PasswordDialog from "./Asset/PasswordDialog";
import LotSlip from "./Asset/LotSlip";
import LotDetail from "./Asset/LotDetail";
import { calcLot, calcSets, fmtAt, fmtMin, setCode, LIMIT_INSIDE_MIN, LIMIT_OUTSIDE_MIN, LIMIT_AFTER_LID_MIN } from "./Asset/lotCalc";
import { inSlip, outSlip, setSlip } from "./Asset/slips";
import { apiError, Clock, DIM, HEAD, LEVEL, LotId, userName } from "./Asset/lotUi";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;
const REFRESH_MS = 60000;
const COLS = 10;

const DelayControlPage = () => {
  const navigate = useNavigate();
  const [lots, setLots] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(() => new Set());
  const [dialog, setDialog] = useState(null); // { kind: "new" | "IN" | "OUT" | "LID" | "SPLIT" | "SET_OUT" | "WEIGHT" | "SET_CANCEL", lot?, set?, seq }
  const [slips, setSlips] = useState(null);   // slips to print: right after a stamp, or again from the opened row
  const lastLoad = useRef(0);

  const load = useCallback(async () => {
    lastLoad.current = Date.now();
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/other/lots`, { params: { scope: "open" } });
      if (!res.data?.success) throw new Error(res.data?.error || "โหลดข้อมูลไม่สำเร็จ");
      setLots(res.data.data || []);
      setError("");
      return res.data.data || [];
    } catch (err) {
      console.error("[Other] load error:", err);
      setError(apiError(err, "โหลดข้อมูลไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => { setNow(Date.now()); load(); }, REFRESH_MS); return () => clearInterval(t); }, [load]);
  // another device saved something: reload (the server sends "sheetChanged" after every successful write).
  // An open dialog is not touched by a reload: it keeps what is being typed (StampDialog / SplitDialog are set once when they open)
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

  const rows = useMemo(() => lots.map((lot) => {
    const c = calcLot(lot, now);
    return { lot, c, s: calcSets(lot, c, now) };
  }), [lots, now]);
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const openDialog = (d) => setDialog({ ...d, seq: Date.now() });

  // every write: the error text to show in the dialog, or "" (then the list is read again)
  const send = async (method, url, body) => {
    const res = await axios[method](`${API_URL}${url}`, { ...body, user: userName() });
    if (!res.data?.success) return { error: res.data?.error || "บันทึกไม่สำเร็จ" };
    const list = await load();
    return { error: "", data: res.data, list: list || [] };
  };
  const freshLot = (list, lotId) => list.find((l) => l.lot_id === lotId);

  const stampIn = async (lot, values, at) => {
    const r = await send("post", `/api/other/lots/${lot.lot_id}/move`, { kind: "IN", qty_kg: values.qty_kg, moved_at: at });
    if (r.error) return r.error;
    const l = freshLot(r.list, lot.lot_id);
    const move = l?.moves.find((m) => m.move_id === r.data.move_id);
    if (l && move) setSlips([inSlip(l, move)]); // print the slip right after the stamp
    return "";
  };
  const stampOut = async (lot, values, at) => {
    const r = await send("post", `/api/other/lots/${lot.lot_id}/move`, { kind: "OUT", qty_kg: values.qty_kg, moved_at: at });
    if (r.error) return r.error;
    const l = freshLot(r.list, lot.lot_id);
    if (l && r.data.move_id) setSlips([outSlip(l, calcLot(l, Date.now()), r.data.move_id)]);
    return "";
  };
  const split = async (lot, sets, at) => {
    const r = await send("post", `/api/other/lots/${lot.lot_id}/sets`, { sets, made_at: at });
    if (r.error) return r.error;
    const l = freshLot(r.list, lot.lot_id);
    if (l) {
      const ids = new Set((r.data.sets || []).map((x) => x.set_id));
      const all = calcSets(l, calcLot(l, Date.now()), Date.now()).sets;
      const made = all.filter((x) => ids.has(x.set_id));
      if (made.length) setSlips(made.map((x) => setSlip(l, x))); // the slip of every new set, print all or one by one
    }
    return "";
  };
  const setOut = async (lot, set, at) => {
    const r = await send("post", `/api/other/lots/${lot.lot_id}/sets/${set.set_id}/out`, { moved_at: at });
    if (r.error) return r.error;
    const l = freshLot(r.list, lot.lot_id);
    const done = l && calcSets(l, calcLot(l, Date.now()), Date.now()).sets.find((x) => x.set_id === set.set_id);
    if (done) setSlips([setSlip(l, done)]);
    return "";
  };
  const closeLot = async (lot) => {
    if (!window.confirm(`ปิดรายการ #${lot.lot_id} "${lot.lot_name}" ?\nรายการจะย้ายไปหน้า History (recall กลับมาได้)`)) return;
    try {
      const r = await send("put", `/api/other/lots/${lot.lot_id}/close`, {});
      if (r.error) setError(r.error);
    } catch (err) {
      console.error("[Other] close error:", err);
      setError(apiError(err));
    }
  };

  const renderDialog = () => {
    if (!dialog) return null;
    const { kind, seq } = dialog;
    const close = () => setDialog(null);
    if (kind === "new") {
      return (
        <StampDialog
          key={seq} title="เพิ่มรายการ (เตรียมเสร็จ)" timeLabel="เวลาเตรียมเสร็จ" onClose={close}
          fields={[{ key: "lot_name", label: "ชื่อวัตถุดิบ / รายการ", required: true }, { key: "ref_code", label: "Batch / รหัสอ้างอิง" }, { key: "weight_kg", label: "น้ำหนักที่เตรียม (kg)", type: "number", required: true }, { key: "note", label: "หมายเหตุ" }]}
          onSubmit={async ({ values, at }) => (await send("post", "/api/other/lots", { ...values, prep_done_at: at })).error}
        />
      );
    }
    // the newest copy of the lot (another device may have saved meanwhile); the dialog itself keeps what was typed
    const lot = lots.find((l) => l.lot_id === dialog.lot.lot_id) || dialog.lot;
    const c = calcLot(lot, now);
    const s = calcSets(lot, c, now);
    const label = `#${lot.lot_id} ${lot.lot_name}`;
    if (kind === "LID") {
      return (
        <StampDialog
          key={seq} title={`เปิดฝา — ${label}`} timeLabel="เวลาเปิดฝา" submitLabel="บันทึกเปิดฝา" onClose={close} fields={[]}
          hint={`เปิดฝาแล้วต้องเอาออกห้องเย็นภายใน ${fmtMin(LIMIT_AFTER_LID_MIN)} (และไม่เกิน ${fmtMin(LIMIT_INSIDE_MIN)} นับจากเข้าห้องเย็น) — จากนั้นกด "จัดชุด" แล้วออกห้องเย็นทีละชุด`}
          onSubmit={async ({ at }) => (await send("post", `/api/other/lots/${lot.lot_id}/lid`, { opened_at: at })).error}
        />
      );
    }
    if (kind === "SPLIT") {
      return <SplitDialog key={seq} lotLabel={label} available={s.unassigned} onClose={close} onSubmit={({ sets, at }) => split(lot, sets, at)} />;
    }
    if (kind === "SET_OUT") {
      const set = s.sets.find((x) => x.set_id === dialog.set.set_id) || dialog.set;
      return (
        <StampDialog
          key={seq} title={`ออกห้องเย็น — ชุด ${setCode(lot, set)}`} timeLabel="เวลาออกห้องเย็น" submitLabel="บันทึกออกห้องเย็น" onClose={close} fields={[]}
          hint={`${lot.lot_name} · ชุด ${setCode(lot, set)} · ${set.kg} kg (ออกทั้งชุด) — พิมพ์สลิปได้หลังบันทึก`}
          onSubmit={({ at }) => setOut(lot, set, at)}
        />
      );
    }
    if (kind === "WEIGHT") {
      return (
        <PasswordDialog
          key={seq} title={`แก้ไขน้ำหนัก — ${label}`} submitLabel="บันทึกน้ำหนัก" onClose={close}
          hint={`น้ำหนักเดิม ${c.weight} kg · เข้าห้องเย็นแล้ว ${Math.round((c.weight - c.unplaced) * 100) / 100} kg (แก้ให้น้อยกว่านี้ไม่ได้)`}
          field={{ label: "น้ำหนักที่เตรียม (kg)", defaultValue: c.weight }}
          onSubmit={async ({ password, value }) => (await send("put", `/api/other/lots/${lot.lot_id}/weight`, { weight_kg: value, password })).error}
        />
      );
    }
    if (kind === "SET_CANCEL") {
      const set = dialog.set;
      return (
        <PasswordDialog
          key={seq} title={`ยกเลิกชุด ${setCode(lot, set)}`} submitLabel="ยกเลิกชุด" onClose={close}
          hint={`${set.kg} kg ของชุดนี้จะกลับไปเป็น "ยังไม่จัดชุด" (จัดชุดใหม่ได้)`}
          onSubmit={async ({ password }) => (await send("put", `/api/other/lots/${lot.lot_id}/sets/${set.set_id}/cancel`, { password })).error}
        />
      );
    }
    const isIn = kind === "IN";
    const max = isIn ? c.unplaced : s.unassigned;
    return (
      <StampDialog
        key={seq} title={`${isIn ? "เข้าห้องเย็น" : "ออกห้องเย็น"} — ${label}`} timeLabel={isIn ? "เวลาเข้าห้องเย็น" : "เวลาออกห้องเย็น"} onClose={close}
        hint={isIn ? `ยังไม่เข้าห้องเย็น ${c.unplaced} kg — พิมพ์สลิปได้หลังบันทึก` : `อยู่ในห้องเย็น ${c.inCold} kg (ออกได้ทีละบางส่วน)`}
        fields={[{ key: "qty_kg", label: isIn ? "น้ำหนักที่เข้า (kg)" : "น้ำหนักที่ออก (kg)", type: "number", required: true, defaultValue: String(max) }]}
        onSubmit={({ values, at }) => (isIn ? stampIn(lot, values, at) : stampOut(lot, values, at))}
      />
    );
  };

  return (
    <div style={{ backgroundColor: "#fff" }} className="flex-1 min-h-0 flex flex-col overflow-hidden relative z-10">
      <main className="max-w-8xl w-full mx-auto pt-2 pb-1 px-1 lg:px-8 flex-1 min-h-0 flex flex-col" style={{ color: "#1B2333" }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 1, flexShrink: 0 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog({ kind: "new" })}>เพิ่มรายการ</Button>
          <Typography variant="body2" color="text.secondary">
            ควบคุม Delay: นอกห้องเย็น {fmtMin(LIMIT_OUTSIDE_MIN)} · ในห้องเย็นก่อนเปิดฝา {fmtMin(LIMIT_INSIDE_MIN)} · หลังเปิดฝา {fmtMin(LIMIT_AFTER_LID_MIN)}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => navigate("/other/history")} sx={{ textTransform: "none" }}>History (รายการที่ปิดแล้ว)</Button>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError("")} action={<Button color="inherit" size="small" onClick={load}>ลองใหม่</Button>}>{error}</Alert>}
        <Paper sx={{ borderRadius: "16px", overflow: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <TableContainer sx={{ flex: 1, minHeight: 0 }}>
            <Table stickyHeader size="small" sx={{ minWidth: 1250 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...HEAD, width: 44 }} />
                  <TableCell sx={HEAD}>ID</TableCell>
                  <TableCell sx={HEAD}>รายการ</TableCell>
                  <TableCell sx={HEAD} align="right">เตรียม (kg)</TableCell>
                  <TableCell sx={HEAD}>เตรียมเสร็จ</TableCell>
                  <TableCell sx={HEAD}>ในห้องเย็น</TableCell>
                  <TableCell sx={HEAD}>เปิดฝา</TableCell>
                  <TableCell sx={HEAD}>ชุดย่อย</TableCell>
                  <TableCell sx={HEAD} align="right">ออกแล้ว (kg)</TableCell>
                  <TableCell sx={HEAD}>ทำรายการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(({ lot, c, s }) => {
                  const lv = LEVEL[c.worst];
                  const isOpen = open.has(lot.lot_id);
                  const lid = !!lot.lid_open_at;
                  const setsIn = s.sets.filter((x) => !x.out).length;
                  const setsOut = s.sets.length - setsIn;
                  return (
                    <Fragment key={lot.lot_id}>
                      <TableRow hover sx={{ background: c.done ? "#DCEBFF" : lv.bg }}>
                        <TableCell><IconButton size="small" onClick={() => toggle(lot.lot_id)}>{isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}</IconButton></TableCell>
                        <TableCell><LotId lot={lot} /></TableCell>
                        <TableCell><strong>{lot.lot_name}</strong>{lot.ref_code ? <div style={{ fontSize: 12, color: "#6B7489" }}>{lot.ref_code}</div> : null}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          {c.weight}
                          <IconButton size="small" title="แก้ไขน้ำหนัก (ต้องใส่รหัส)" onClick={() => openDialog({ kind: "WEIGHT", lot })} sx={{ ml: 0.25 }}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtAt(lot.prep_done_at)}</TableCell>
                        <TableCell>{c.inCold > 0 ? <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}><b>{c.inCold} kg</b><Clock chunk={c.runningCold} limit={LIMIT_INSIDE_MIN} /></Box> : <span style={DIM}>-</span>}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{lid ? <Chip size="small" color="warning" variant="outlined" label={fmtAt(lot.lid_open_at)} /> : <span style={DIM}>ยังไม่เปิด</span>}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", fontSize: 13 }}>
                          {s.sets.length ? <>ในห้องเย็น <b>{setsIn}</b> · ออกแล้ว <b>{setsOut}</b></> : <span style={DIM}>-</span>}
                          {lid && s.unassigned > 0 ? <div style={{ color: "#B26A00", fontSize: 12 }}>ยังไม่จัดชุด {s.unassigned} kg</div> : null}
                        </TableCell>
                        <TableCell align="right">{c.outKg}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          <Button size="small" variant="outlined" disabled={c.unplaced <= 0} onClick={() => openDialog({ kind: "IN", lot })} sx={{ mr: 0.5, textTransform: "none" }}>เข้าห้องเย็น</Button>
                          <Button size="small" variant="outlined" color="warning" disabled={c.inCold <= 0 || lid} onClick={() => openDialog({ kind: "LID", lot })} sx={{ mr: 0.5, textTransform: "none" }}>เปิดฝา</Button>
                          {lid ? (
                            <Button size="small" variant="contained" disabled={s.unassigned <= 0} onClick={() => openDialog({ kind: "SPLIT", lot })} sx={{ mr: 0.5, textTransform: "none" }}>จัดชุด</Button>
                          ) : (
                            <Button size="small" variant="outlined" disabled={c.inCold <= 0} onClick={() => openDialog({ kind: "OUT", lot })} sx={{ mr: 0.5, textTransform: "none" }}>ออกห้องเย็น</Button>
                          )}
                          <Button size="small" color="inherit" onClick={() => closeLot(lot)} sx={{ textTransform: "none" }}>ปิด</Button>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={COLS - 1} sx={{ background: "#FAFBFF" }}>
                            <LotDetail
                              lot={lot} c={c} s={s} onPrint={setSlips}
                              onSetOut={(set) => openDialog({ kind: "SET_OUT", lot, set })}
                              onSetCancel={(set) => openDialog({ kind: "SET_CANCEL", lot, set })}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                {!rows.length && <TableRow><TableCell colSpan={COLS} align="center" sx={{ py: 5, color: "#90A4AE" }}>{loading ? "กำลังโหลด..." : "ไม่มีรายการ — กด \"เพิ่มรายการ\""}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </main>
      <LotSlip slips={slips} onClose={() => setSlips(null)} />
      {renderDialog()}
    </div>
  );
};

export default DelayControlPage;
