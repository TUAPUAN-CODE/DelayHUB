import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Snackbar, Tab, Tabs, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import EditIcon from "@mui/icons-material/Edit";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useSearchParams } from "react-router-dom";
import { buildRows } from "./buildRows";
import { COLUMNS } from "./columns";
import RowDetail from "../../Layout/DataGrid/RowDetail";
import EditCellDialog from "./EditCellDialog";
import UnlockDialog, { hasUnlock } from "./UnlockDialog";
import StatusFixDialog from "./StatusFixDialog";
import { LineagePanel, ParentLinks } from "./MappingLineage";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

const fmtTime = (v) => (v === null || v === undefined || v === "" ? "-" : String(v).replace("T", " ").slice(0, 16));
const DETAIL_COLUMNS = COLUMNS.filter((c) => c.kind === "data" && c.type !== "time");
const TIME_COLUMNS = COLUMNS.filter((c) => c.kind === "data" && c.type === "time");

/**
 * Page "ค้นหา mapping_id" (every Role): type a mapping_id, see everything about that raw material, fix a wrong entry.
 *   รายละเอียด = the columns of the Master Sheet · เวลา = every time column (edit one with the same dialog as the Sheet's "แก้ไขข้อมูล")
 *   สถานะ = change rm_status / stay_place / dest / trolley · ประวัติการแก้ไข = SheetEditLog of this mapping
 *   ถูกนำไปเป็นรายการใหม่ = the mappings made from this one (and "มาจากรายการ" at the top): open one with its button, "กลับไปรายการ …" walks back
 * Editing needs the Setting password (same permit as the "แก้ไขข้อมูล" button); the server writes every change to SheetEditLog with the reason.
 */
const MappingTool = () => {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get("id") || "");
  const [state, setState] = useState({ loading: false, error: "", mapping: null, hu: null, editable: [] });
  const [tab, setTab] = useState("detail");
  const [log, setLog] = useState({ loading: false, rows: [], error: "" });
  const [unlockAsk, setUnlockAsk] = useState(false);
  const [unlocked, setUnlocked] = useState(hasUnlock());
  const [timeTarget, setTimeTarget] = useState(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [lin, setLin] = useState({ id: null, loading: false, data: null, error: "" });
  const [trail, setTrail] = useState([]); // the mappings opened before this one through a link (button "กลับไปรายการ …")
  const linReq = useRef(0);

  // what this mapping became / came from; also asked for a mapping that is gone ("กลับมาเตรียม" deletes the old one)
  const loadLineage = useCallback(async (id) => {
    const req = ++linReq.current;
    setLin({ id, loading: true, data: null, error: "" });
    try {
      const res = await axios.get(`${API_URL}/api/sheet/lineage`, { params: { mapping_id: id } });
      if (req !== linReq.current) return; // another mapping was opened meanwhile
      setLin({ id, loading: false, data: res.data?.data ?? null, error: "" });
    } catch (err) {
      console.error("[MappingTool] lineage error:", err);
      if (req === linReq.current) setLin({ id, loading: false, data: null, error: "โหลดรายการที่เกี่ยวข้องไม่สำเร็จ" });
    }
  }, []);

  const loadLog = useCallback(async (id) => {
    setLog((l) => ({ ...l, loading: true, error: "" }));
    try {
      const res = await axios.get(`${API_URL}/api/sheet/edit-log`, { params: { mapping_id: id } });
      setLog({ loading: false, rows: res.data?.data ?? [], error: "" });
    } catch (err) {
      // the history may only be read with the permit (admin or the Setting password): the page still works without it
      console.error("[MappingTool] edit log error:", err.response?.status || err.message);
      setLog({ loading: false, rows: [], error: err.response?.status === 403 ? "ต้องปลดล็อกด้วยรหัสผ่านจึงจะดูประวัติการแก้ไขได้" : "โหลดประวัติการแก้ไขไม่สำเร็จ" });
    }
  }, []);

  const search = useCallback(async (raw, keepTab = false) => {
    const id = parseInt(String(raw).trim(), 10);
    if (Number.isNaN(id) || id <= 0) { setState({ loading: false, error: "กรุณาใส่ mapping_id เป็นตัวเลข", mapping: null, hu: null, editable: [] }); return; }
    setState((s) => ({ ...s, loading: true, error: "" }));
    if (!keepTab) setTab("detail");
    try {
      const res = await axios.get(`${API_URL}/api/sheet/mapping`, { params: { mapping_id: id } });
      if (!res.data?.success) throw new Error(res.data?.error || "ค้นหาไม่สำเร็จ");
      setState({ loading: false, error: "", mapping: res.data.mapping, hu: res.data.hu, editable: res.data.editable_dates || [] });
      setParams({ id: String(id) }, { replace: true });
      loadLog(id);
      loadLineage(id);
    } catch (err) {
      console.error("[MappingTool] search error:", err);
      setState({ loading: false, error: err.response?.data?.error || err.message || "ค้นหาไม่สำเร็จ", mapping: null, hu: null, editable: [] });
      // not found: it may have become another mapping (กลับมาเตรียม deletes the old one) — the page says which
      if (err.response?.status === 404) loadLineage(id);
      else setLin({ id: null, loading: false, data: null, error: "" });
    }
  }, [loadLog, loadLineage, setParams]);

  // typed search starts a new walk; a link keeps the way back
  const searchTyped = () => { setTrail([]); search(input); };
  const openLinked = (id) => {
    const from = state.mapping?.mapping_id ?? lin.id;
    if (from && from !== id) setTrail((t) => [...t, from]);
    setInput(String(id));
    search(id);
  };
  const goBack = () => {
    const prev = trail[trail.length - 1];
    if (!prev) return;
    setTrail((t) => t.slice(0, -1));
    setInput(String(prev));
    search(prev);
  };

  useEffect(() => { if (params.get("id")) search(params.get("id")); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the row as the table builds it (status, DBS ...); a row the table hides still gets a status from the same rules
  const row = useMemo(() => {
    const m = state.mapping;
    if (!m) return null;
    const built = buildRows(state.hu ? [state.hu] : [], [m], {}, [], Date.now(), []).find((r) => r.mapping_id === m.mapping_id);
    if (built) return { ...built, __hidden: false };
    return { ...m, __kind: "map", __status: null, __hidden: true };
  }, [state.mapping, state.hu]);

  const ask = (fn) => () => { if (hasUnlock()) { setUnlocked(true); fn(); } else { setUnlocked(false); setUnlockAsk(true); } };
  // the server refused the permit (expired / typed by another user in this tab): show "locked" again, the next edit asks the password
  useEffect(() => {
    const drop = () => setUnlocked(false);
    window.addEventListener("setting-unlock-dropped", drop);
    return () => window.removeEventListener("setting-unlock-dropped", drop);
  }, []);
  const afterSave = (msg) => { setTimeTarget(null); setStatusOpen(false); setToast(msg); search(state.mapping.mapping_id, true); };

  const editableDates = useMemo(() => new Set(state.editable), [state.editable]);
  const st = row?.__status;
  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 1, md: 2 } }}>
      <Typography sx={{ fontSize: 20, fontWeight: 700, mb: 1.5 }}>ค้นหาด้วย mapping_id</Typography>
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <TextField size="small" label="mapping_id" value={input} autoFocus onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter") searchTyped(); }} inputProps={{ inputMode: "numeric" }} sx={{ width: 200 }} />
        <Button variant="contained" startIcon={state.loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />} disabled={state.loading || !input} onClick={searchTyped}>ค้นหา</Button>
        {trail.length > 0 && <Button size="small" startIcon={<ArrowBackIcon />} onClick={goBack}>{`กลับไปรายการ ${trail[trail.length - 1]}`}</Button>}
        <Box sx={{ flex: 1 }} />
        {unlocked && hasUnlock()
          ? <Chip color="success" variant="outlined" icon={<LockOpenIcon />} label="ปลดล็อกแล้ว · แก้ไขได้" />
          : <Button size="small" startIcon={<LockOpenIcon />} onClick={() => setUnlockAsk(true)}>ใส่รหัสผ่านเพื่อแก้ไข</Button>}
      </Paper>

      {state.error && <Alert severity="error" sx={{ mb: 2 }}>{state.error}</Alert>}

      {!state.mapping && lin.id && (lin.loading || lin.data?.children?.length > 0 || lin.data?.parents?.length > 0) && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{`รายการ ${lin.id} ไม่มีในระบบแล้ว`}</Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1 }}>เช่น กด &quot;กลับมาเตรียม&quot; แล้ว ระบบสร้างรายการใหม่และลบรายการเดิม — ดูรายการใหม่ได้ด้านล่าง</Typography>
          <ParentLinks parents={lin.data?.parents} onOpen={openLinked} />
          <Box sx={{ mt: 1 }}><LineagePanel state={lin} onOpen={openLinked} /></Box>
        </Paper>
      )}

      {row && (
        <>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{row.mat_name || row.mat || `รายการ ${row.mapping_id}`}</Typography>
              <Chip size="small" label={`mapping_id ${row.mapping_id}`} />
              {st ? <Chip size="small" label={st.name || st.label} sx={{ background: st.bg, color: st.color, fontWeight: 700 }} /> : <Chip size="small" color="warning" label="ซ่อนในตาราง (ลบ / น้ำหนัก 0 / สถานะระบบ)" />}
              <Box sx={{ flex: 1 }} />
              <Button variant="outlined" startIcon={<SwapHorizIcon />} onClick={ask(() => setStatusOpen(true))}>เปลี่ยนสถานะ</Button>
            </Box>
            <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.75 }}>
              {[row.mat && `Mat ${row.mat}`, (row.batch_after || row.batch) && `Batch ${row.batch_after || row.batch}`, row.tro_id && `รถเข็น ${row.tro_id}`, row.cs_name && `${row.cs_name} ช่อง ${row.slot_id ?? "-"}`,
                row.weight_RM !== null && row.weight_RM !== undefined && `${row.weight_RM} kg`, row.code && `แผน ${row.code}`].filter(Boolean).join(" · ")}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.25 }}>rm_status: <b>{row.rm_status || "-"}</b> · stay_place: <b>{row.stay_place || "-"}</b> · dest: <b>{row.dest || "-"}</b></Typography>
            {lin.id === row.mapping_id && <ParentLinks parents={lin.data?.parents} onOpen={openLinked} />}
          </Paper>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
            <Tab value="detail" label="รายละเอียด" />
            <Tab value="times" label="เวลา (แก้ไขได้)" />
            <Tab value="log" label={`ประวัติการแก้ไข${log.rows.length ? ` (${log.rows.length})` : ""}`} />
            <Tab value="lineage" label={`ถูกนำไปเป็นรายการใหม่${lin.id === row.mapping_id && lin.data?.children?.length ? ` (${lin.data.children.length})` : ""}`} />
          </Tabs>

          {tab === "detail" && <Paper variant="outlined"><RowDetail row={row} columns={DETAIL_COLUMNS} title={`ข้อมูลของรายการ ${row.mapping_id}`} /></Paper>}

          {tab === "lineage" && <LineagePanel state={lin.id === row.mapping_id ? lin : { loading: true }} onOpen={openLinked} />}

          {tab === "times" && (
            <Paper variant="outlined" sx={{ p: 1 }}>
              {TIME_COLUMNS.map((c, i) => (
                <Box key={c.key}>
                  {i > 0 && <Divider />}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.75, px: 1 }}>
                    <Typography sx={{ flex: 1, fontSize: 13.5, color: "#5B6B8C", fontWeight: 600 }}>{c.label}</Typography>
                    <Typography sx={{ width: 150, fontSize: 14, fontFamily: "ui-monospace,monospace", color: row[c.key] ? "inherit" : "#B0B8C9" }}>{fmtTime(row[c.key])}</Typography>
                    {editableDates.has(c.key)
                      ? <Button size="small" startIcon={<EditIcon fontSize="small" />} onClick={ask(() => setTimeTarget({ row: { ...row, mapping_id: row.mapping_id }, col: c }))}>แก้ไข</Button>
                      : <Typography sx={{ fontSize: 11.5, color: "#B0B8C9", width: 64, textAlign: "center" }}>แก้ไม่ได้</Typography>}
                  </Box>
                </Box>
              ))}
            </Paper>
          )}

          {tab === "log" && (
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              {log.loading && <CircularProgress size={20} />}
              {log.error && <Alert severity="info">{log.error}</Alert>}
              {!log.loading && !log.error && !log.rows.length && <Typography sx={{ color: "text.secondary" }}>ยังไม่มีประวัติการแก้ไขของรายการนี้</Typography>}
              {log.rows.map((l) => (
                <Box key={l.edit_id} sx={{ py: 0.75, borderBottom: "1px solid #EEF2F9" }}>
                  <Typography sx={{ fontSize: 13.5 }}><b>{l.column_name}</b> ({l.table_name}): {l.old_value ?? "(ว่าง)"} → <b>{l.new_value ?? "(ว่าง)"}</b></Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{l.edited_at} · {l.username || l.user_id || "-"}{l.reason ? ` · ${l.reason}` : ""}</Typography>
                </Box>
              ))}
            </Paper>
          )}
        </>
      )}

      <UnlockDialog open={unlockAsk} onClose={() => setUnlockAsk(false)} onUnlocked={() => { setUnlockAsk(false); setUnlocked(true); setToast("ปลดล็อกแล้ว แก้ไขข้อมูลได้"); if (state.mapping) loadLog(state.mapping.mapping_id); }} />
      <EditCellDialog target={timeTarget} onClose={() => setTimeTarget(null)} onSaved={afterSave} />
      <StatusFixDialog open={statusOpen} row={state.mapping} hu={state.hu} onClose={() => setStatusOpen(false)} onSaved={afterSave} />
      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}><Alert severity="success" variant="filled" onClose={() => setToast("")}>{toast}</Alert></Snackbar>
    </Box>
  );
};

export default MappingTool;
