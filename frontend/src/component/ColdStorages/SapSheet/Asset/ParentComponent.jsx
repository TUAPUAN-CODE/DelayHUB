import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Chip, Collapse, MenuItem, Select, Snackbar, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import SapTable from "./SapTable";
import ScanStampDialog from "./ScanStampDialog";
import PromptDialog from "./PromptDialog";
import LogList from "./LogList";
import okSound from "./ok.mp3";
import { analyzeRow, formatTime, parseTag, planStamp, simplifyServerMessage } from "./sapTimeline";
import { fetchSapRows, postCheckin, postStamp, STAMP_LABEL } from "./sapApi";

const REFRESH_MS = 60000;

const STATUS_FILTERS = [
  ["all", "ทั้งหมด"],
  ["pending", "รอรับเข้าห้องเย็น"],
  ["incold", "อยู่ในห้องเย็น"],
  ["thawing", "กำลังละลาย"],
  ["thawed", "ละลายเสร็จแล้ว"],
  ["dispatched", "จ่ายลงไลน์แล้ว"],
  ["online", "อยู่ที่ไลน์"],
];

const SOURCE_FILTERS = [
  ["all", "ทุกรายการ"],
  ["own", "รายการที่ทำเอง (ละลาย / จ่ายลงไลน์ / อยู่ในห้องเย็น)"],
  ["receivable", "รายการที่แสดงเพราะรับเข้าห้องเย็นได้"],
];

const nowText = () => new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const playOk = () => {
  try { new Audio(okSound).play().catch(() => {}); } catch { /* sound is optional */ }
};

const ParentComponent = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState(14);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [scanKind, setScanKind] = useState(null);
  const [log, setLog] = useState([]);
  const [showLog, setShowLog] = useState(true);
  const [prompt, setPrompt] = useState(null); // {type:'weight'|'supervisor', kind, tag, resolve}
  const [toast, setToast] = useState("");
  const rowsRef = useRef([]);
  const logId = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSapRows(days);
      rowsRef.current = data;
      setRows(data);
      setError("");
    } catch (err) {
      console.error("[SapSheet] load error:", err);
      setError(err.response?.data?.error || err.message || "โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const derived = useMemo(() => rows.map((r) => {
    const a = analyzeRow(r);
    return {
      ...r,
      _a: a,
      status_label: a.status.label,
      source_label: a.statusKey === "pending" ? "รับเข้าได้" : "ทำเอง",
    };
  }), [rows]);

  const visible = useMemo(() => derived.filter((r) => {
    if (statusFilter !== "all" && r._a.statusKey !== statusFilter) return false;
    if (sourceFilter === "own" && r._a.statusKey === "pending") return false;
    if (sourceFilter === "receivable" && r._a.statusKey !== "pending") return false;
    return true;
  }), [derived, statusFilter, sourceFilter]);

  const counts = useMemo(() => {
    const c = { all: derived.length };
    derived.forEach((r) => { c[r._a.statusKey] = (c[r._a.statusKey] || 0) + 1; });
    return c;
  }, [derived]);

  const addLog = useCallback((entry) => {
    logId.current += 1;
    setLog((prev) => [{ id: logId.current, time: nowText(), ...entry }, ...prev].slice(0, 100));
  }, []);

  const askPrompt = useCallback((cfg) => new Promise((resolve) => setPrompt({ ...cfg, resolve })), []);

  const findRow = (hu) => rowsRef.current.find((r) => String(r.hu) === String(hu));

  /** one stamp (from a scan or a row button) — returns {ok,message} for the dialog banner */
  const doStamp = useCallback(async (kind, tag) => {
    const row = findRow(tag.hu);
    const plan = planStamp(kind, row);
    if (row && !plan.ok) {
      addLog({ kind, hu: tag.hu, ok: false, text: plan.reason });
      return { ok: false, message: `HU ${tag.hu}: ${plan.reason}` };
    }

    let weight = tag.weight ?? (row?.weight ? Number(row.weight) : null);
    if ((kind === "start" || kind === "end") && !(weight > 0)) {
      const v = await askPrompt({ type: "weight", kind, tag });
      if (v === null) return { ok: false, message: "ยกเลิก — ต้องใส่น้ำหนักก่อนบันทึก" };
      weight = parseFloat(v);
    }

    const res = await postStamp(kind, { mat: tag.mat, batch: tag.batch, hu: tag.hu, weight });
    await load();
    if (res.ok) {
      playOk();
      const text = `${res.message || "บันทึกสำเร็จ"} เมื่อ ${formatTime(new Date())}`;
      addLog({ kind, hu: tag.hu, ok: true, text });
      return { ok: true, message: `HU ${tag.hu}: ${text}` };
    }
    // explain with the row we know about; otherwise translate the server message
    const fresh = findRow(tag.hu);
    const freshPlan = fresh ? planStamp(kind, fresh) : null;
    const text = freshPlan && !freshPlan.ok ? freshPlan.reason : simplifyServerMessage(res.message);
    addLog({ kind, hu: tag.hu, ok: false, text });
    return { ok: false, message: `HU ${tag.hu}: ${text}` };
  }, [addLog, askPrompt, load]);

  const handleScan = useCallback(async (kind, text) => {
    const tag = parseTag(text);
    if (tag.error) {
      addLog({ kind, hu: "", ok: false, text: tag.error });
      return { ok: false, message: tag.error };
    }
    return doStamp(kind, tag);
  }, [addLog, doStamp]);

  const handleRowStamp = useCallback((kind, row) => {
    doStamp(kind, { mat: row.mat, batch: row.batch, hu: String(row.hu), weight: row.weight ? Number(row.weight) : null })
      .then((r) => setToast(r.message));
  }, [doStamp]);

  const handleRowCheckin = useCallback(async (row) => {
    const plan = planStamp("checkin", row);
    if (!plan.ok) { setToast(`HU ${row.hu}: ${plan.reason}`); return; }
    const supervisor = await askPrompt({ type: "supervisor", kind: "checkin", tag: { hu: String(row.hu) } });
    if (supervisor === null) return;
    const res = await postCheckin({ hu: row.hu, supervisor });
    await load();
    if (res.ok) {
      playOk();
      const text = `รับเข้าห้องเย็นรอบที่ ${plan.round} เมื่อ ${formatTime(new Date())} (ผู้รับ: ${supervisor})`;
      addLog({ kind: "checkin", hu: String(row.hu), ok: true, text });
      setToast(`HU ${row.hu}: ${text}`);
    } else {
      const text = simplifyServerMessage(res.message);
      addLog({ kind: "checkin", hu: String(row.hu), ok: false, text });
      setToast(`HU ${row.hu}: ${text}`);
    }
  }, [addLog, askPrompt, load]);

  const closePrompt = (value) => {
    prompt?.resolve(value);
    setPrompt(null);
  };

  return (
    <div>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1.5 }}>
        {["start", "end", "dispatch"].map((k) => (
          <Button key={k} variant="contained" startIcon={<QrCodeScannerIcon />} onClick={() => setScanKind(k)}>
            สแกน {STAMP_LABEL[k]}
          </Button>
        ))}
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">แสดงความเคลื่อนไหวย้อนหลัง</Typography>
        <Select size="small" value={days} onChange={(e) => setDays(e.target.value)} sx={{ minWidth: 100 }}>
          {[3, 7, 14, 30, 90].map((d) => <MenuItem key={d} value={d}>{d} วัน</MenuItem>)}
        </Select>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>รีเฟรช</Button>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1 }}>
        {STATUS_FILTERS.map(([key, label]) => (
          <Chip
            key={key} label={`${label} (${counts[key] || 0})`} clickable
            color={statusFilter === key ? "primary" : "default"} variant={statusFilter === key ? "filled" : "outlined"}
            onClick={() => setStatusFilter(key)}
          />
        ))}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
        {SOURCE_FILTERS.map(([key, label]) => (
          <Chip
            key={key} label={label} clickable size="small"
            color={sourceFilter === key ? "secondary" : "default"} variant={sourceFilter === key ? "filled" : "outlined"}
            onClick={() => setSourceFilter(key)}
          />
        ))}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1.5 }} action={<Button color="inherit" size="small" onClick={load}>ลองใหม่</Button>}>{error}</Alert>}

      <SapTable data={visible} onStamp={handleRowStamp} onCheckin={handleRowCheckin} />

      <Box sx={{ mt: 1.5 }}>
        <Button size="small" onClick={() => setShowLog((v) => !v)}>{showLog ? "ซ่อน" : "แสดง"}ประวัติการทำรายการล่าสุด ({log.length})</Button>
        <Collapse in={showLog}><Box sx={{ mt: 1 }}><LogList log={log} max={20} /></Box></Collapse>
      </Box>

      <ScanStampDialog open={!!scanKind} kind={scanKind} onClose={() => setScanKind(null)} onScan={handleScan} log={log} />

      <PromptDialog
        open={prompt?.type === "weight"}
        title="ใส่น้ำหนักวัตถุดิบ"
        description={`ป้ายนี้ไม่มีน้ำหนัก (HU ${prompt?.tag?.hu || ""}) กรุณาใส่น้ำหนักก่อนบันทึก${prompt ? ` ${STAMP_LABEL[prompt.kind]}` : ""}`}
        label="น้ำหนัก (กก.)" type="number"
        onCancel={() => closePrompt(null)} onConfirm={(v) => closePrompt(v)}
      />
      <PromptDialog
        open={prompt?.type === "supervisor"}
        title="รับเข้าห้องเย็น"
        description={`HU ${prompt?.tag?.hu || ""} — กรอกชื่อหัวหน้าผู้รับเข้า`}
        label="ชื่อหัวหน้าผู้รับเข้า"
        onCancel={() => closePrompt(null)} onConfirm={(v) => closePrompt(v)}
      />

      <Snackbar open={!!toast} autoHideDuration={6000} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="info" onClose={() => setToast("")} sx={{ width: "100%" }}>{toast}</Alert>
      </Snackbar>
    </div>
  );
};

export default ParentComponent;
