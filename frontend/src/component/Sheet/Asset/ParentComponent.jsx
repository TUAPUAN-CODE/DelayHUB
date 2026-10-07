import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Alert, Box, Button, Chip, IconButton, InputAdornment, MenuItem, Select, TablePagination, TextField, Tooltip, Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import SheetTable from "./SheetTable";
import ColumnSettings from "./ColumnSettings";
import useSheetPrefs from "./useSheetPrefs";
import useHuStamps from "./useHuStamps";
import { DEFAULT_VISIBLE, ROLE_LABEL } from "./columns";
import { buildTree, filterTree, flattenText } from "./buildTree";
import { planStamp } from "../../ColdStorages/SapSheet/Asset/sapTimeline";
// tools that already exist as flows of each Role
import PackFlows from "../../Pack/ManageRawmat/Asset/flow/PackFlows";
import CartModal from "../../Pack/ManageRawmat/Asset/ModalEditPD";
import TrolleyFlows from "../../ColdStorage/RoomTableSupervisor/Asset/flow/TrolleyFlows";
import CheckoutFlow from "../../ColdStorage/RoomTableSupervisor/Asset/flow/CheckoutFlow";
import LargeFlows from "../../ColdStorages/RoomMonitor/Asset/flow/LargeFlows";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;
const REFRESH_MS = 60000;
const PAGE = 100;

const CS1_DEST = ["เข้าห้องเย็น", "รอCheckin", "ห้องเย็น", "ส่งกลับจากห้องเย็นใหญ่"];
const CS2_DEST = ["ห้องเย็นใหญ่", "เข้าห้องเย็นใหญ่"];
const PACK_STATUS = ["QcCheck", "เหลือจากไลน์ผลิต", "QcCheck รอ MD", "รอแก้ไข"];

const Btn = ({ label, color, onClick }) => (
  <Button size="small" variant="outlined" onClick={onClick} sx={{ py: 0, px: 1, minWidth: 0, fontSize: 12, textTransform: "none", color, borderColor: color, mr: 0.5 }}>
    {label}
  </Button>
);

const ParentComponent = ({ role }) => {
  const [data, setData] = useState({ hus: [], mappings: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState(7);
  const [includeOpen, setIncludeOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cart, setCart] = useState(null);

  const defaults = DEFAULT_VISIBLE[role] || DEFAULT_VISIBLE.sup;
  const prefs = useSheetPrefs(defaults);

  const huRef = useRef([]);
  const trolleyRef = useRef(null);
  const checkoutRef = useRef(null);
  const largeRef = useRef(null);
  const packRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/sheet/rows`, { params: { days, include_open: includeOpen ? 1 : 0 } });
      if (!res.data?.success) throw new Error(res.data?.error || "โหลดตารางไม่สำเร็จ");
      huRef.current = res.data.hus || [];
      setData({ hus: res.data.hus || [], mappings: res.data.mappings || [] });
      setError("");
    } catch (err) {
      console.error("[Sheet] load error:", err);
      setError(err.response?.data?.error || err.message || "โหลดตารางไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [days, includeOpen]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, REFRESH_MS); return () => clearInterval(t); }, [load]);

  const hu = useHuStamps({ findHu: (h) => huRef.current.find((r) => String(r.hu) === String(h)), reload: load });

  // ── which tools does this role have on a row? ──
  const toolsFor = useCallback((node) => {
    const r = node.row;
    if (node.kind === "hu") {
      if (role !== "cs2" || node.synthetic) return [];
      const mk = (kind, label, color, icon) => {
        const plan = planStamp(kind, r);
        return { key: kind, label, color, icon, ok: plan.ok, title: plan.ok ? `${label}${plan.round ? ` (รอบที่ ${plan.round})` : ""}` : plan.reason, run: () => (kind === "checkin" ? hu.rowCheckin(r) : hu.rowStamp(kind, r)) };
      };
      return [
        mk("start", "เริ่มละลาย", "#0277BD", <AcUnitIcon fontSize="small" />),
        mk("end", "ละลายเสร็จ", "#047857", <CheckCircleOutlineIcon fontSize="small" />),
        mk("dispatch", "จ่ายลงไลน์", "#1552F0", <LocalShippingOutlinedIcon fontSize="small" />),
        mk("checkin", "รับเข้าห้องเย็น", "#6A1B9A", <WarehouseOutlinedIcon fontSize="small" />),
      ];
    }
    const t = [];
    const st = String(r.rm_status || "");
    if (role === "cs1") {
      if (!r.cs_id && r.tro_id && CS1_DEST.includes(r.dest)) t.push({ key: "in", label: "รับเข้า", color: "#E65100", run: () => trolleyRef.current?.checkin(r) });
      if (r.cs_id && r.cs_id < 10) {
        t.push({ key: "move", label: "ย้ายช่อง", color: "#0F3FC4", run: () => trolleyRef.current?.move(r) });
        t.push({ key: "out", label: "ส่งออก", color: "#2E7D32", run: () => checkoutRef.current?.open(r) });
      }
    }
    if (role === "cs2") {
      if (!r.cs_id && r.tro_id && CS2_DEST.includes(r.dest)) t.push({ key: "in", label: "รับเข้า", color: "#E65100", run: () => largeRef.current?.checkin(r) });
      if (r.cs_id && r.cs_id >= 10 && r.dest === "ในห้องเย็นใหญ่") t.push({ key: "out", label: "ส่งออก", color: "#2E7D32", run: () => largeRef.current?.checkout(r) });
    }
    if (role === "qc" || role === "pack") {
      if (st.includes("รอQC") || st.includes("รอ MD")) t.push({ key: "qc", label: "ตรวจ QC", color: "#B45309", run: () => packRef.current?.qc(r) });
    }
    if (role === "pack") {
      const ready = !r.tro_id && PACK_STATUS.includes(st) && ["จุดเตรียม", "ออกห้องเย็น", "create_manual"].includes(r.stay_place)
        && ["ไปบรรจุ", "บรรจุ", "create_manual", "รอCheckin"].includes(r.dest) && Number(r.weight_RM) !== 0;
      if (ready) t.push({ key: "cart", label: "ใส่รถเข็น", color: "#1552F0", run: () => setCart({ ...r, mat: r.mat, production: r.code, rm_cold_status: r.rm_status }) });
      if (r.tro_id && ["บรรจุ", "รถเข็นรอจัดส่ง"].includes(r.dest)) t.push({ key: "send", label: "ส่งไป", color: "#047857", run: () => packRef.current?.send(r.tro_id) });
    }
    return t;
  }, [role, hu]);

  const renderTools = useCallback((node) => {
    const tools = toolsFor(node);
    if (!tools.length) return <span style={{ color: "#C5CCD9" }}>-</span>;
    if (node.kind === "hu") {
      return tools.map((t) => (
        <Tooltip key={t.key} title={t.title} arrow>
          <span><IconButton size="small" onClick={t.run} sx={{ color: t.ok ? t.color : "#C5CCD9" }}>{t.icon}</IconButton></span>
        </Tooltip>
      ));
    }
    return tools.map((t) => <Btn key={t.key} label={t.label} color={t.color} onClick={t.run} />);
  }, [toolsFor]);

  const roots = useMemo(() => buildTree(data.hus, data.mappings), [data]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    let tree = roots;
    if (q) {
      const terms = q.split(/\s+/);
      tree = filterTree(tree, (n) => { const text = flattenText(n); return terms.every((x) => text.includes(x)); });
    }
    if (mine) tree = filterTree(tree, (n) => toolsFor(n).some((t) => t.ok !== false));
    return tree;
  }, [roots, search, mine, toolsFor]);

  useEffect(() => { setPage(0); }, [search, mine, days, includeOpen]);
  const pageRoots = useMemo(() => shown.slice(page * PAGE, page * PAGE + PAGE), [shown, page]);

  const toggle = useCallback((id) => setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const expandAll = () => {
    const ids = new Set();
    const walk = (nodes) => nodes.forEach((n) => { if (n.children.length) { ids.add(n.id); walk(n.children); } });
    walk(pageRoots);
    setExpanded(ids);
  };

  const total = useMemo(() => {
    let hus = 0; let maps = 0;
    const walk = (nodes) => nodes.forEach((n) => { if (n.kind === "hu") hus += 1; else maps += 1; walk(n.children); });
    walk(shown);
    return { hus, maps };
  }, [shown]);

  return (
    <div>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1.25 }}>
        <TextField
          size="small" placeholder="ค้นหา HU / รถเข็น / Batch / วัตถุดิบ / Mapping ..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <Chip label={`งานของ ${ROLE_LABEL[role] || "ฉัน"}`} clickable color={mine ? "primary" : "default"} variant={mine ? "filled" : "outlined"} onClick={() => setMine((v) => !v)} />
        <Typography variant="body2" color="text.secondary">ย้อนหลัง</Typography>
        <Select size="small" value={days} onChange={(e) => setDays(e.target.value)}>
          {[3, 7, 14, 30, 90].map((d) => <MenuItem key={d} value={d}>{d} วัน</MenuItem>)}
        </Select>
        <Chip label="รวมรายการที่ยังไม่ปิด" clickable size="small" color={includeOpen ? "secondary" : "default"} variant={includeOpen ? "filled" : "outlined"} onClick={() => setIncludeOpen((v) => !v)} />
        <Tooltip title="ขยายทุกแถวแม่"><IconButton onClick={expandAll}><UnfoldMoreIcon /></IconButton></Tooltip>
        <Tooltip title="ย่อทั้งหมด"><IconButton onClick={() => setExpanded(new Set())}><UnfoldLessIcon /></IconButton></Tooltip>
        <Button variant="outlined" startIcon={<ViewColumnIcon />} onClick={() => setSettingsOpen(true)}>ตั้งค่าคอลัมน์</Button>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>รีเฟรช</Button>
      </Box>

      {(role === "cs2" || role === "pack") && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1.25 }}>
          {role === "cs2" && ["start", "end", "dispatch"].map((k) => (
            <Button key={k} variant="contained" size="small" startIcon={<QrCodeScannerIcon />} onClick={() => hu.openScan(k)}>
              สแกน {{ start: "เริ่มละลาย", end: "ละลายเสร็จ", dispatch: "จ่ายลงไลน์" }[k]}
            </Button>
          ))}
          {role === "pack" && (
            <>
              <Button variant="contained" size="small" onClick={() => packRef.current?.mix()}>ผสมวัตถุดิบ</Button>
              <Button variant="contained" size="small" onClick={() => packRef.current?.addTrolley()}>เพิ่มรถเข็น</Button>
            </>
          )}
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 1.25 }} action={<Button color="inherit" size="small" onClick={load}>ลองใหม่</Button>}>{error}</Alert>}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        {total.hus} HU · {total.maps} mapping — ช่องว่าง (-) คือขั้นตอนที่ยังไม่มีเวลา · สีแดงที่ DBS = เกินมาตรฐานของกลุ่มวัตถุดิบ
      </Typography>

      <SheetTable roots={pageRoots} expanded={expanded} onToggle={toggle} visible={prefs.visible} renderTools={renderTools} />
      <TablePagination
        component="div" count={shown.length} page={page} rowsPerPage={PAGE} rowsPerPageOptions={[PAGE]} onPageChange={(_, p) => setPage(p)}
        labelDisplayedRows={({ from, to, count }) => `แถวหลัก ${from}-${to} จาก ${count}`}
      />

      <ColumnSettings
        open={settingsOpen} onClose={() => setSettingsOpen(false)} visible={prefs.visible} onChange={prefs.setVisible} onReset={prefs.reset}
        storage={prefs.storage} warning={prefs.warning}
      />

      {/* tool dialogs (each one is the flow of the old page of that Role) */}
      {hu.layer}
      <PackFlows ref={packRef} onDone={load} onNotify={() => {}} />
      <TrolleyFlows ref={trolleyRef} rows={data.mappings} onDone={load} />
      <CheckoutFlow ref={checkoutRef} onDone={load} />
      <LargeFlows ref={largeRef} onDone={load} />
      {cart && <CartModal open data={cart} onClose={() => setCart(null)} onSuccess={() => { setCart(null); load(); }} />}
    </div>
  );
};

export default ParentComponent;
