import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { Alert, Box, Button, Paper, Chip, Dialog, DialogContent, DialogTitle, Snackbar, TextField, Tooltip, Typography } from "@mui/material";
import { IoBarcodeSharp } from "react-icons/io5";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import AllInclusiveIcon from "@mui/icons-material/AllInclusive";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PersonPinCircleOutlinedIcon from "@mui/icons-material/PersonPinCircleOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import BlenderOutlinedIcon from "@mui/icons-material/BlenderOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import DataGrid from "../../Layout/DataGrid/DataGrid";
import ColorSettings, { DEFAULT_EXT, rowColorOf } from "./ColorSettings";
import StatusZoneSettings from "./StatusZoneSettings";
import LineGroupSettings from "./LineGroupSettings";
import PasswordGate from "./PasswordGate";
import DonePanel from "./DonePanel";
import EditCellDialog from "./EditCellDialog";
import { prepareSheetRows } from "./prepareRows";
import useHuStamps from "./useHuStamps";
import { columnsForRole, defaultVisible, GROUPS } from "./columns";
import { buildRows, statusOf } from "./buildRows";
import StatusOrderSettings, { fullStatusOrder } from "./StatusOrderSettings";
import StatusStyleSettings, { statusLook } from "./StatusStyleSettings";
import { planStamp } from "../../ColdStorages/SapSheet/Asset/sapTimeline";
// tools that already exist as flows of each Role
import PackFlows from "../../Pack/ManageRawmat/Asset/flow/PackFlows";
import TrolleyFlows from "../../ColdStorage/RoomTableSupervisor/Asset/flow/TrolleyFlows";
import CheckoutFlow from "../../ColdStorage/RoomTableSupervisor/Asset/flow/CheckoutFlow";
import LargeFlows from "../../ColdStorages/RoomMonitor/Asset/flow/LargeFlows";
import PackMoreFlows from "./pack/PackMoreFlows";
import { BatchCartDialog, BatchDeleteDialog, BatchEditPlanDialog } from "./pack/PackBatchDialogs";
import GatherSelected from "./cold/GatherSelected";
import LinePicker from "./pack/LinePicker";
import ReworkFlows from "./prep/ReworkFlows";
import ModalStampReceive from "../../Prep/TimeStampMain/Asset/stamp/ModalStampReceive";
import ModalStampBoil from "../../Prep/TimeStampMain/Asset/stamp/ModalStampBoil";
import ModalStampReturn from "../../Prep/TimeStampMain/Asset/stamp/ModalStampReturn";
import { EmulsionFlows, BatchFlows, MixPackFlows, LoafFlows, MIX_KINDS } from "./prep/mixVariants";
import ManageModals from "../../Prep/TimeStampMain/Asset/ManageModals";
import { formatDateTime } from "../../Prep/TimeStampMain/Asset/timeFields";
import CameraActivationModal from "../../Prep/ScanSAP/Asset/ModalScanSAP";
import DataReviewSAP from "../../Prep/ScanSAP/Asset/ModalConfirmSAP";
import { CHECKIN_DEST } from "./pack/checkinData";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;
const REFRESH_MS = 60000;
const DAYS = 7; // the work table shows the last 7 days by default; the user can pick another range or load everything
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// default range of "ดึงข้อมูล": today and yesterday (rows that are on a trolley are always shown, whatever their date)
const RANGE_DAYS = 1;
const defaultRange = () => ({ from: ymd(new Date(Date.now() - RANGE_DAYS * 86400000)), to: ymd(new Date()), all: false });
const prepPlan = (r) => ({ ...r, CookedDateTime: r.CookedDateTime ? formatDateTime(r.CookedDateTime) : null, withdraw_date: r.withdraw_date ? formatDateTime(r.withdraw_date) : null });

/** "จัดการ" of a SAP row: one button, a menu per production-plan row → trolley / slip / complete / change plan */
// Pack: แถวสถานะ "รอบรรจุเสร็จ" ติ๊ก / ใส่น้ำหนัก / บรรจุเสร็จ ได้ทั้งหมด ไม่ดูสถานะวัตถุดิบ (rm_status)
// icon of a per-row tool that does not bring its own (matched on the start of its key)
const TOOL_ICONS = [
  ["in", LoginOutlinedIcon], ["out", LogoutOutlinedIcon], ["move", SwapHorizOutlinedIcon], ["qc", FactCheckOutlinedIcon],
  ["send", LocalShippingOutlinedIcon], ["checkin", HowToRegOutlinedIcon], ["cart", ShoppingCartOutlinedIcon], ["rw-cart", ShoppingCartOutlinedIcon],
  ["im-cart", ShoppingCartOutlinedIcon], ["edit", EditOutlinedIcon], ["rw-edit", EditOutlinedIcon], ["ok", CheckCircleOutlineIcon], ["del", DeleteOutlineIcon],
  ["ps-", PlayArrowOutlinedIcon],
];
const toolIcon = (it) => {
  if (it.icon) return it.icon;
  const hit = TOOL_ICONS.find(([k]) => it.key === k || it.key.startsWith(`${k}-`) || (k.endsWith("-") && it.key.startsWith(k)));
  if (!hit) return undefined;
  const Icon = hit[1];
  return <Icon fontSize="small" />;
};
// Pack: the "ผสมวัตถุดิบ" button is hidden (asked by the users); set to true to bring it back — the mixing flow itself is unchanged
const SHOW_PACK_MIX = false;
const canPack = (r) => r.__kind === "map" && !!r.mapping_id && !r.sc_pack_date && (r.__stage === "ready" || r.__status?.label === "รอบรรจุเสร็จ");

const CS1_DEST = ["เข้าห้องเย็น", "รอCheckin", "ห้องเย็น", "ส่งกลับจากห้องเย็นใหญ่"];
const CS2_DEST = ["ห้องเย็นใหญ่", "เข้าห้องเย็นใหญ่"];
const PREP_STAMPS = { receive: ModalStampReceive, boil: ModalStampBoil, return: ModalStampReturn };
// ประเภทวัตถุดิบของผู้ใช้ (ใช้ซ่อนปุ่มสแกน SAP ของบางตำแหน่งเท่านั้น — ไม่กรองข้อมูลในตารางแล้ว)
const MY_TYPES = (() => { try { return (JSON.parse(localStorage.getItem("rm_type_id")) || []).map(Number); } catch { return []; } })();
// "เพิ่ม RM" (หน้า managedelaymaster เดิม) เห็นเฉพาะตำแหน่งเหล่านี้
const CAN_ADD_RM = ["3", "4", "5", "6"].includes(localStorage.getItem("pos_id"));

/** "น้ำหนัก (kg)" of the Pack confirm: typed per row, only for the rows that are ticked */
const WeightInput = ({ value, disabled, onChange }) => {
  const bad = value !== "" && value !== undefined && !(parseFloat(value) > 0);
  return (
    <TextField
      size="small" type="number" value={value ?? ""} disabled={disabled} error={bad} onChange={(e) => onChange(e.target.value)}
      title={disabled ? "ติ๊กเลือกแถวก่อน แล้วกรอกน้ำหนัก" : bad ? "น้ำหนักต้องมากกว่า 0" : ""}
      sx={{ width: 96, "& input": { py: "4px", px: "6px", textAlign: "center", fontSize: 13 } }}
    />
  );
};

const ParentComponent = ({ role, view = "work" }) => {
  const [data, setData] = useState({ hus: [], mappings: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [range, setRange] = useState(defaultRange); // the range that is loaded (and refreshed every minute)
  const [pick, setPick] = useState(defaultRange);   // what is typed in the date boxes, loaded when the button is pressed
  // the line of this packing tablet (picked in the toolbar; kept on the device)
  const [lineId, setLineId] = useState(() => localStorage.getItem("line_id") || "");
  const MY_LINE = parseInt(lineId, 10);
  const changeLine = (id) => {
    try { if (id) localStorage.setItem("line_id", id); else localStorage.removeItem("line_id"); } catch (err) { console.error("[Sheet] save line error:", err); }
    setLineId(id);
    setMyLine(!!id);
  };
  const [myLine, setMyLine] = useState(role === "pack" && !Number.isNaN(MY_LINE));
  const [batch, setBatch] = useState(null); // { kind: "cart" | "edit" | "delete", rows }
  const [selected, setSelected] = useState(() => new Set());
  const [weights, setWeights] = useState({});
  const [toast, setToast] = useState("");
  const [mix, setMix] = useState({});
  const [plans, setPlans] = useState([]);
  const [mixed, setMixed] = useState([]); // mixed lots that are not in a trolley yet
  const [now, setNow] = useState(() => Date.now()); // the running DBS clocks follow this, once a minute
  const [gatherOpen, setGatherOpen] = useState(false); // cold room: "จัดชุด" dialog of the ticked rows
  const [activeKey, setActiveKey] = useState(null); // the row chosen by a click: the action bar above the table works on it
  const [scan, setScan] = useState({ camera: false, review: false, mat: "", batch: "", hu: "" });
  const [editMode, setEditMode] = useState(false); // Supervisor: double-click a cell to edit it (server allows role 6 / 8 only)
  const [editTarget, setEditTarget] = useState(null);
  const [planPick, setPlanPick] = useState(null);
  // ลำดับสถานะบนแถบเหนือตาราง: ค่ากลางที่ทุกบัญชีใช้ร่วมกัน (GET /api/sheet/global-settings)
  // ค่ากลางของทุกบัญชี: ลำดับสถานะ (statusOrder), ชื่อที่แสดง (statusLabels), สีปุ่ม/ตัวอักษร (statusStyles)
  const [globalSettings, setGlobalSettings] = useState({});
  const globalOrder = useMemo(() => globalSettings.statusOrder || [], [globalSettings]);
  useEffect(() => {
    const loadGlobal = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/sheet/global-settings`);
        setGlobalSettings(res.data.data || {});
      } catch (err) {
        console.error("[Sheet] global settings error:", err.message);
      }
    };
    loadGlobal();
  }, []); // { action: "cart" | "edit", plans } — แถวที่มีหลายแผนการผลิต ให้เลือกแผนก่อน
  const [pstamp, setPstamp] = useState(null); // { kind, hu } — Prep time stamp of a SAP/HU row (receive / boil done / return)

  const columns = useMemo(() => columnsForRole(role), [role]);
  const defVisible = useMemo(() => defaultVisible(role), [role]);

  const huRef = useRef([]);
  const revRef = useRef("");        // rev (signature) of the data on screen: the server answers "unchanged" when it still matches
  const running = useRef(false);    // one load at a time ...
  const again = useRef(false);      // ... a request that comes while one is running makes ONE more run afterwards
  const loadOnceRef = useRef(null); // always the latest loadOnce (the range / role may change while a load is running)
  const rangeKeyRef = useRef("");   // the answer of an old range must not replace the data of the new one
  const lastLoadAt = useRef(0);
  const trolleyRef = useRef(null);
  const checkoutRef = useRef(null);
  const largeRef = useRef(null);
  const packRef = useRef(null);
  const moreRef = useRef(null);
  const reworkRef = useRef(null);
  const manageRef = useRef(null);
  const mixRefs = { emu: useRef(null), batch: useRef(null), pack: useRef(null), loaf: useRef(null) };

  rangeKeyRef.current = `${role}|${range.all ? "all" : `${range.from}|${range.to}`}`;

  const loadOnce = useCallback(async () => {
    lastLoadAt.current = Date.now();
    const myKey = rangeKeyRef.current;
    if (!revRef.current) setLoading(true); // first load shows the spinner; the minute refresh does not flicker
    try {
      const params = range.all ? { days: DAYS } : { days: DAYS, open_from: range.from, open_to: range.to };
      if (revRef.current) params.rev = revRef.current;
      const res = await axios.get(`${API_URL}/api/sheet/rows`, { params });
      if (!res.data?.success) throw new Error(res.data?.error || "โหลดตารางไม่สำเร็จ");
      if (myKey !== rangeKeyRef.current) return; // the range / role changed while this was loading: a newer load is queued, drop this answer
      const unchanged = !!res.data.unchanged;
      // nothing changed since the last load (same rev): keep the same data, so thousands of rows are not rebuilt and rendered again for nothing
      if (!unchanged) {
        revRef.current = res.data.rev || "";
        huRef.current = res.data.hus || [];
        setData({ hus: res.data.hus || [], mappings: res.data.mappings || [] });
        setMixed(res.data.mixed || []);
      }
      setError("");
      if (role === "prep") {
        // lists of the old mixing pages (a failing list must not break the sheet)
        const kinds = Object.keys(MIX_KINDS);
        const mixParams = range.all ? {} : { date_from: range.from, date_to: range.to }; // the mixing lists follow the chosen date range (default: 1 day)
        const results = await Promise.allSettled(kinds.map((k) => axios.get(`${API_URL}${MIX_KINDS[k].url}`, { params: mixParams })));
        const next = {};
        results.forEach((r, i) => {
          if (r.status === "fulfilled") { const d = r.value.data; next[kinds[i]] = Array.isArray(d) ? d : (d?.success ? d.data : []); }
          else console.error(`[Sheet] mix list ${kinds[i]} error:`, r.reason?.message);
        });
        if (myKey !== rangeKeyRef.current) return;
        setMix(next);
        if (!unchanged) setPlans((res.data.plans || []).map(prepPlan)); // scanned production-plan rows (all raw material types) that are not in a trolley yet
      }
    } catch (err) {
      console.error("[Sheet] load error:", err);
      setError(err.response?.data?.error || err.message || "โหลดตารางไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [role, range]);
  loadOnceRef.current = loadOnce;

  // the socket event, the minute timer and the buttons can all ask for a load at the same moment: run one, and one more afterwards if asked meanwhile
  // (an older answer can no longer arrive after a newer one and bring back the status the user just changed)
  const load = useCallback(async () => {
    if (running.current) { again.current = true; return; }
    running.current = true;
    try {
      do { again.current = false; await loadOnceRef.current(); } while (again.current);
    } finally {
      running.current = false;
    }
  }, [loadOnce]); // eslint-disable-line react-hooks/exhaustive-deps -- new identity when the range / role changes, so the effects below load again

  // the work table refreshes by itself; the Done table is only read when the user presses its button
  useEffect(() => { if (view === "work") load(); }, [load, view]);
  useEffect(() => { if (view !== "work") return undefined; const t = setInterval(load, REFRESH_MS); return () => clearInterval(t); }, [load, view]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

  // real-time: reload when another user changes data (same events as the old pages)
  useEffect(() => {
    if (!API_URL || view !== "work") return undefined;
    let timer = null;
    // never give up reconnecting (a pm2 reload or a network drop must not freeze the live updates until the page is refreshed)
    const socket = io(API_URL, { transports: ["websocket"], reconnectionAttempts: Infinity, reconnectionDelay: 2000, reconnectionDelayMax: 10000, timeout: 10000 });
    const refresh = () => { if (Date.now() - lastLoadAt.current < 4000) return; clearTimeout(timer); timer = setTimeout(load, 800); }; // an event right after our own load is an echo: ignore it
    // "sheetChanged": the server sends it after ANY successful write of any page, so a save on another device / Role shows here without a refresh (backend/sheetRealtime.js)
    // the server only sends these events to the rooms: join the ones that tell the table something changed.
    // (not saveRMForProdRoom: the server also pushes to it each time ANY page loads the plan list, which would make this table reload for ever)
    const ROOMS = ["QcCheckRoom", "trolleyUpdatesRoom", "sheetRoom"];
    ROOMS.forEach((room) => socket.emit("joinRoom", room));
    socket.on("connect", () => { ROOMS.forEach((room) => socket.emit("joinRoom", room)); refresh(); }); // after a re-connect, load what was missed meanwhile
    socket.on("disconnect", (reason) => { if (reason === "io server disconnect") socket.connect(); }); // the server closed it: socket.io does not retry by itself in that case
    socket.on("sheetChanged", refresh);
    socket.on("trolleyUpdated", refresh);
    socket.on("rawMaterialSaved", refresh);
    socket.on("qcDateTimeUpdated", refresh);
    socket.on("dataUpdated", refresh);
    socket.on("dataDelete", refresh);
    socket.on("connect_error", (err) => console.error("[Sheet] socket error:", err.message));
    return () => { clearTimeout(timer); socket.off("sheetChanged", refresh); socket.off("dataUpdated", refresh); socket.off("trolleyUpdated", refresh); socket.off("rawMaterialSaved", refresh); socket.off("qcDateTimeUpdated", refresh); socket.off("dataDelete", refresh); socket.disconnect(); };
  }, [load, view]);

  const hu = useHuStamps({ findHu: (h) => huRef.current.find((r) => String(r.hu) === String(h)), reload: load });

  // ── the tools a Role has on one row; every item says which tool column (col) it belongs to ──
  const tools = useCallback((r) => {
    const out = [];
    const h = r.__hu;
    if (role === "cs2" && h) {
      const mk = (kind, label, color, icon) => {
        const plan = planStamp(kind, h);
        return { col: "t_stamp", key: kind, label, color, icon, ok: plan.ok, title: plan.ok ? `${label}${plan.round ? ` (รอบที่ ${plan.round})` : ""}` : plan.reason, run: () => (kind === "checkin" ? hu.rowCheckin(h) : hu.rowStamp(kind, h)) };
      };
      out.push(
        mk("start", "เริ่มละลาย", "#0277BD", <AcUnitIcon fontSize="small" />),
        mk("end", "ละลายเสร็จ", "#047857", <CheckCircleOutlineIcon fontSize="small" />),
        mk("dispatch", "จ่ายลงไลน์", "#1552F0", <LocalShippingOutlinedIcon fontSize="small" />),
        mk("checkin", "รับเข้าห้องเย็น", "#6A1B9A", <WarehouseOutlinedIcon fontSize="small" />),
      );
    }
    if (role === "prep") {
      if (h && h.sap_re_id !== undefined) {
        // รับ / ต้ม/อบเสร็จ / ส่งคืน ตามสถานะของแถว: จ่ายลงไลน์แล้ว = กด "รับ" ได้อย่างเดียว · อยู่ที่ไลน์ = ต้ม/อบเสร็จ และส่งคืนได้ · สถานะอื่นทั้งหมด = กดไม่ได้
        const stLabel = statusOf(r).label;
        const allowed = stLabel === "จ่ายลงไลน์แล้ว" ? ["receive"] : stLabel === "อยู่ที่ไลน์" ? ["boil", "return"] : [];
        const reason = stLabel === "จ่ายลงไลน์แล้ว" ? "ต้องกด รับ ก่อน" : stLabel === "อยู่ที่ไลน์" ? "รับวัตถุดิบแล้ว" : `สถานะ ${stLabel} ทำรายการนี้ไม่ได้`;
        [["receive", "รับ", "#2e7d32", "บันทึกเวลารับวัตถุดิบ"], ["boil", "ต้ม/อบเสร็จ", "#e65100", "บันทึกเวลาต้มอบเสร็จ"], ["return", "ส่งคืน", "#6a1b9a", "บันทึกเวลาส่งคืนวัตถุดิบ"]].forEach(([k, label, color, title]) => {
          const ok = allowed.includes(k);
          out.push({ col: "t_pstamp", key: `ps-${k}`, label, color, ok, title: ok ? title : reason, run: () => { if (ok) setPstamp({ kind: k, hu: h }); } });
        });
        // ไลน์รับเข้า (SAP HU): same rule as the scan button — after ละลายเสร็จ of the round, once per round
        // สถานะ "รอใส่รถเข็น" ไม่ต้องมีปุ่มไลน์รับเข้า
        const plan = planStamp("linein", h);
        if (statusOf(r).label !== "รอใส่รถเข็น") out.push({ col: "t_pstamp", key: "linein", label: "ไลน์รับเข้า", color: "#1552F0", icon: <LocalShippingOutlinedIcon fontSize="small" />, ok: plan.ok, title: plan.ok ? `ไลน์รับเข้า${plan.round ? ` (รอบที่ ${plan.round})` : ""}` : plan.reason, run: () => hu.rowStamp("linein", h) });
      }
      // ปุ่มของแผนการผลิตอยู่ในแถบ "แถวที่เลือก" (col t_bar ไม่ใช่คอลัมน์ในตาราง) — ปุ่มละ 1 อัน; ถ้ามีหลายแผนจะให้เลือกแผนก่อน
      if (r.__plans?.length) {
        const pick = (action) => {
          if (r.__plans.length === 1) return (action === "cart" ? manageRef.current?.openCart : manageRef.current?.openEdit)?.(r.__plans[0]);
          setPlanPick({ action, plans: r.__plans });
        };
        out.push({ col: "t_bar", key: "cart-plan", label: "ใส่รถเข็น", color: "#1552F0", title: "ใส่รถเข็น", run: () => pick("cart") });
        out.push({ col: "t_bar", key: "edit-plan", label: "เปลี่ยนแผนการผลิต", color: "#B45309", title: "เปลี่ยนแผนการผลิต", run: () => pick("edit") });
      }
      // a plan can fill several trolleys: it stays "รอใส่รถเข็น" until the last one is done, then it is closed here
      if (r.__kind === "plan" && r.__trolleys > 0) {
        out.push({ col: "t_bar", key: "ok-plan", label: `ใส่รถเข็นครบแล้ว (${r.__trolleys} คัน)`, color: "#2E7D32", title: "ปิดแผนนี้: ไม่ใส่รถเข็นเพิ่มแล้ว", run: () => manageRef.current?.openComplete(r.__plans[0]) });
      }
      const kind = r.__kind === "mix" ? r.__mix : r.__loaf ? "loaf" : null;
      if (kind) {
        const ref = mixRefs[kind];
        out.push({ col: "t_mix", key: `cart-${kind}`, label: "ใส่รถเข็น", color: "#1552F0", title: `${MIX_KINDS[kind].label}: ใส่รถเข็น`, run: () => ref.current?.cart(r.__loaf || r) });
        out.push({ col: "t_mix", key: `ok-${kind}`, label: "เสร็จ", color: "#2E7D32", run: () => ref.current?.success(r.__loaf || r) });
        if (kind !== "loaf") out.push({ col: "t_mix", key: `del-${kind}`, label: "ลบ", color: "#C62828", run: () => ref.current?.remove(r) });
      }
      const rk = r.__rework;
      if (rk) {
        out.push({ col: "t_rework", key: "rw-cart", label: "ใส่รถเข็น (รอแก้ไข)", color: "#B91C1C", run: () => reworkRef.current?.cart(r, "rework") });
        if (rk === "B") out.push({ col: "t_rework", key: "im-cart", label: "กลับมาเตรียม", color: "#B45309", run: () => reworkRef.current?.cart(r, "import") });
        out.push({ col: "t_rework", key: "rw-edit", label: "แก้ไข", color: "#B26A00", run: () => reworkRef.current?.edit(r, rk === "B" ? "import" : "rework") });
      }
    }
    if (r.__kind !== "map") return out;
    const st = String(r.rm_status || "");
    if (role === "cs1") {
      if (!r.cs_id && r.tro_id && CS1_DEST.includes(r.dest)) out.push({ col: "t_cs1", key: "in", label: "รับเข้า", color: "#E65100", run: () => trolleyRef.current?.checkin(r) });
      if (r.cs_id && r.cs_id < 10) {
        out.push({ col: "t_cs1", key: "move", label: "ย้ายช่อง", color: "#0F3FC4", run: () => trolleyRef.current?.move(r) });
        out.push({ col: "t_cs1", key: "out", label: "ส่งออก", color: "#2E7D32", run: () => checkoutRef.current?.open(r) });
      }
    }
    if (role === "cs2") {
      if (!r.cs_id && r.tro_id && CS2_DEST.includes(r.dest)) out.push({ col: "t_cs2", key: "in", label: "รับเข้า", color: "#E65100", run: () => largeRef.current?.checkin(r) });
      if (r.cs_id && r.cs_id >= 10 && r.dest === "ในห้องเย็นใหญ่") out.push({ col: "t_cs2", key: "out", label: "ส่งออก", color: "#2E7D32", run: () => largeRef.current?.checkout(r) });
    }
    const stage = r.__stage;
    if (role === "qc" || role === "pack" || role === "prep") {
      if (stage === "qc") out.push({ col: "t_qc", key: "qc", label: "ตรวจ QC", color: "#B45309", run: () => packRef.current?.qc(r) });
    }
    if (role === "pack") {
      const confirmable = stage === "ready" && !r.sc_pack_date;
      // ใส่รถเข็น / แก้ไข / ลบ ทำจากแถวที่ติ๊กไว้ (ได้หลายแถวในครั้งเดียว) ที่ packBar
      if (stage === "trolley") out.push({ col: "t_send", key: "send", label: "ส่งไป", color: "#047857", run: () => packRef.current?.send(r.tro_id) });
      if (confirmable || canPack(r)) {
        out.push({ col: "t_kg", key: "kg", passive: true, node: <WeightInput value={weights[r.mapping_id]} disabled={!selected.has(r.__key)} onChange={(v) => setWeights((w) => ({ ...w, [r.mapping_id]: v }))} /> });
      }
      if (r.tro_id && CHECKIN_DEST.includes(r.dest)) out.push({ col: "t_checkin", key: "checkin", label: "Check In", color: "#6A1B9A", run: () => moreRef.current?.checkin(r, allRowsRef.current) });
    }
    return out;
  }, [role, hu, weights, selected]);
  // ctx must keep the same identity, otherwise every row of the grid renders again at each click: the grid reads the latest tools() through a ref
  const toolsRef = useRef(tools);
  toolsRef.current = tools;
  const ctx = useMemo(() => ({ tools: (r) => toolsRef.current(r) }), []);
  // a row only has to render again when what its cells show changed: the weight input of the Pack confirm
  const rowSig = useCallback((r) => (role === "pack" ? `${weights[r.mapping_id] ?? ""}|${selected.has(r.__key) ? 1 : 0}` : ""), [role, weights, selected]);

  // built-in colour of each status (for the settings page) + the global names / colours put on every row (the original label stays for the rules)
  const { allRows, statusDefaults } = useMemo(() => {
    const built = buildRows(data.hus, data.mappings, mix, plans, now, mixed);
    const defaults = {};
    const names = globalSettings.statusLabels || {};
    const styles = globalSettings.statusStyles || {};
    built.forEach((r) => {
      const st = r.__status;
      if (!st?.label) return;
      if (!defaults[st.label]) defaults[st.label] = { color: st.color, bg: st.bg };
      const look = statusLook(st.label, st, styles);
      const styled = !!styles[st.label];
      r.__status = { ...st, name: names[st.label] || st.label, color: look.fg, bg: look.bg, onBg: look.onBg, onFg: look.onFg, styled };
    });
    return { allRows: built, statusDefaults: defaults };
  }, [data, mix, plans, now, mixed, globalSettings]);
  const allRowsRef = useRef([]);
  allRowsRef.current = allRows;
  const rows = useMemo(() => {
    let list = allRows;
    if (myLine && role === "pack") list = list.filter((r) => r.__kind === "map" && (r.line_id === MY_LINE || (r.__stage === "trolley" && Number(r.pack_line_id) === MY_LINE)));
    return list;
  }, [allRows, myLine, role, MY_LINE]);

  // ── action bar above the table: the tools of the chosen row ──
  const activeRow = useMemo(() => (activeKey ? rows.find((r) => r.__key === activeKey) || null : null), [rows, activeKey]);
  const barItems = useMemo(() => (activeRow ? tools(activeRow).filter((i) => i.col !== "t_kg") : []), [activeRow, tools]);
  // Prep: tick several rows, then pick the kind of mixing here (rows of that kind that are ticked go into the mix)
  const mixPicked = useMemo(() => {
    const out = { emu: [], batch: [], pack: [], loaf: [] };
    if (role !== "prep") return out;
    rows.forEach((r) => {
      if (!selected.has(r.__key)) return;
      if (r.__kind === "mix") out[r.__mix]?.push(r[MIX_KINDS[r.__mix].idField]);
      else if (r.__loaf) out.loaf.push(r.__loaf.mapping_id);
    });
    return out;
  }, [rows, selected, role]);
  // Cold room (v1: cs_id < 10, v2: cs_id >= 10): tick several materials that are in the room, then "จัดชุด" into one trolley of the room
  const inMyRoom = (r) => r.__kind === "map" && r.cs_id && r.tro_id && (role === "cs1" ? r.cs_id < 10 : r.cs_id >= 10);
  const gatherRows = useMemo(() => (role === "cs1" || role === "cs2" ? rows.filter((r) => selected.has(r.__key) && inMyRoom(r) && Number(r.weight_RM) > 0) : []), [rows, selected, role]);
  const coldTrolleys = useMemo(() => {
    if (role !== "cs1" && role !== "cs2") return [];
    const m = new Map();
    data.mappings.forEach((r) => { if (r.cs_id && r.tro_id && (role === "cs1" ? r.cs_id < 10 : r.cs_id >= 10) && !m.has(r.tro_id)) m.set(r.tro_id, { tro_id: r.tro_id, slot_id: r.slot_id, cs_name: r.cs_name }); });
    return [...m.values()].sort((a, b) => String(a.tro_id).localeCompare(String(b.tro_id)));
  }, [data.mappings, role]);
  const gatherBar = (role === "cs1" || role === "cs2") && (
    <>
      <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", whiteSpace: "nowrap" }}>จัดชุด (ติ๊กหลายแถวที่อยู่ในห้องเย็นก่อน):</Typography>
      <Tooltip title={gatherRows.length ? "" : "ติ๊กวัตถุดิบที่สถานะ \"อยู่ในห้องเย็น\" ในตารางก่อน"} arrow>
        <span>
          <Button size="small" variant="contained" color="secondary" startIcon={<Inventory2OutlinedIcon />} disabled={!gatherRows.length} onClick={() => setGatherOpen(true)} sx={{ textTransform: "none", whiteSpace: "nowrap" }}><span>จัดชุด</span>&nbsp;({gatherRows.length})</Button>
        </span>
      </Tooltip>
    </>
  );
  const mixBar = role === "prep" && (
    <>
      <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", whiteSpace: "nowrap" }}>ผสม (ติ๊กหลายแถวก่อน):</Typography>
      {Object.entries(MIX_KINDS).map(([k, v]) => (
        <Tooltip key={k} title={mixPicked[k].length ? "" : `ติ๊กแถว "${v.status}" ในตารางก่อน`} arrow>
          <span>
            <Button size="small" variant="contained" color="secondary" startIcon={<BlenderOutlinedIcon />} disabled={!mixPicked[k].length} onClick={() => mixRefs[k].current?.add(mixPicked[k])} sx={{ textTransform: "none", whiteSpace: "nowrap" }}>
              {v.label} ({mixPicked[k].length})
            </Button>
          </span>
        </Tooltip>
      ))}
    </>
  );
  // Pack: ปุ่มของแถวที่ติ๊กไว้ อยู่ในแท็บ "เครื่องมือ" (onClick เป็น arrow: ฟังก์ชันถูกประกาศด้านล่าง)
  const packBar = role === "pack" && (
    <>
      <Button variant="contained" size="small" color="secondary" startIcon={<TaskAltOutlinedIcon />} disabled={!selected.size} onClick={() => confirmSelected()}><span>บรรจุเสร็จ</span>&nbsp;({selected.size})</Button>
      {SHOW_PACK_MIX && <Button variant="contained" size="small" startIcon={<BlenderOutlinedIcon />} disabled={!selected.size} onClick={() => mixSelected()}><span>ผสมวัตถุดิบ</span>&nbsp;({selected.size})</Button>}
      <Button variant="contained" size="small" startIcon={<ShoppingCartCheckoutOutlinedIcon />} disabled={!selected.size} onClick={() => openBatch("cart")}><span>ใส่รถเข็น</span>&nbsp;({selected.size})</Button>
      <Button variant="outlined" size="small" startIcon={<EditNoteOutlinedIcon />} disabled={!selected.size} onClick={() => openBatch("edit")}><span>แก้ไขแผนการผลิต</span>&nbsp;({selected.size})</Button>
      <Button variant="contained" size="small" color="error" startIcon={<DeleteOutlineIcon />} disabled={!selected.size} onClick={() => openBatch("delete")}><span>ลบ</span>&nbsp;({selected.size})</Button>
      {CAN_ADD_RM && <Button variant="outlined" size="small" startIcon={<AddCircleOutlineIcon />} onClick={() => moreRef.current?.addRM()}>เพิ่ม RM</Button>}
    </>
  );
  const actionBar = (
    <Paper variant="outlined" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, px: 1.5, py: 1, mb: 1, flexShrink: 0, borderColor: activeRow ? "#F26B1D" : undefined, background: activeRow ? "#FFF7F0" : undefined }}>
      <Typography variant="body2" sx={{ fontWeight: 700, color: activeRow ? "#D95A10" : "text.secondary" }}>
        {activeRow ? `แถวที่เลือก: ${[activeRow.hu && `HU ${activeRow.hu}`, activeRow.tro_id && `รถเข็น ${activeRow.tro_id}`, activeRow.mat_name || activeRow.batch].filter(Boolean).join(" · ") || `รายการ ${activeRow.mapping_id ?? ""}`}` : "คลิกที่แถวในตารางเพื่อเลือก แล้วเลือกรายการที่ต้องการทำตรงนี้"}
      </Typography>
      {mixBar}
      {gatherBar}
      {packBar}
      {activeRow && !barItems.length && <Typography variant="body2" color="text.secondary">แถวนี้ไม่มีรายการที่ทำได้ในขั้นตอนนี้</Typography>}
      {barItems.map((it) => (it.node ? <Box key={it.key}>{it.node}</Box> : (
        <Tooltip key={it.key} title={it.ok === false ? it.title || "ยังทำรายการนี้ไม่ได้" : it.title || ""} arrow>
          <span>
            <Button size="small" variant="contained" disabled={it.ok === false} onClick={it.run} startIcon={toolIcon(it)}
              sx={{ textTransform: "none", whiteSpace: "nowrap", background: it.color, "&:hover": { background: it.color, filter: "brightness(.92)" } }}>{it.label}</Button>
          </span>
        </Tooltip>
      )))}
    </Paper>
  );

  const rowKey = useCallback((r) => r.__key, []);
  const afterMix = () => { setSelected(new Set()); load(); };
  const confirmSelected = () => {
    const picked = rows.filter((r) => selected.has(r.__key));
    if (!picked.length) return;
    if (picked.some((r) => !(parseFloat(weights[r.mapping_id]) > 0))) { setToast("กรุณากรอกน้ำหนัก (kg) ให้ครบทุกแถวที่เลือก"); return; }
    moreRef.current?.confirmRows(picked, weights);
  };
  // ผสมวัตถุดิบจากแถวที่ติ๊ก + น้ำหนักที่กรอกในตาราง แล้วเปิดหน้าสแกน QR ทันที
  const mixSelected = () => {
    const picked = rows.filter((r) => selected.has(r.__key));
    if (!picked.length) return;
    if (picked.some((r) => !(parseFloat(weights[r.mapping_id]) > 0))) { setToast("กรุณากรอกน้ำหนัก (kg) ให้ครบทุกแถวที่เลือก"); return; }
    const over = picked.find((r) => parseFloat(weights[r.mapping_id]) > Number(r.weight_RM || 0));
    if (over) { setToast(`น้ำหนักเกินที่มีอยู่ (${over.weight_RM} kg): ${over.mat_name || over.batch || ""}`); return; }
    const docOf = (p) => String(p || "").split(" (")[0].trim();
    if (new Set(picked.map((r) => docOf(r.code))).size > 1) { setToast("ไม่สามารถผสมได้เนื่องจากคนละ Doc"); return; }
    const materials = picked.map((r) => ({
      mapping_id: r.mapping_id, mat: r.mat, batch: r.batch_after || r.batch, hu: r.hu, weight: parseFloat(weights[r.mapping_id]), level_eu: r.level_eu,
    }));
    packRef.current?.mixRows(materials, materials.reduce((sum, m) => sum + m.weight, 0));
  };
  // ใส่รถเข็น / แก้ไขแผน / ลบ: ใช้ได้กับแถวที่รอบรรจุเสร็จ (ยังไม่บรรจุ) เท่านั้น
  const openBatch = (kind) => {
    const picked = rows.filter((r) => selected.has(r.__key));
    if (!picked.length) return;
    const notReady = picked.filter((r) => r.__stage !== "ready" || r.sc_pack_date);
    if (notReady.length) { setToast(`มี ${notReady.length} แถวที่ทำรายการนี้ไม่ได้ (ต้องเป็นสถานะรอบรรจุเสร็จ) กรุณาเอาเครื่องหมายถูกออกก่อน`); return; }
    if (kind === "edit" && new Set(picked.map((r) => String(r.mat_id || r.mat))).size > 1) { setToast("แก้ไขแผนการผลิตพร้อมกันได้เฉพาะวัตถุดิบ (Mat) เดียวกัน"); return; }
    setBatch({ kind, rows: picked });
  };
  const closeBatch = () => { setBatch(null); setSelected(new Set()); setWeights({}); };
  const afterConfirm = () => { setSelected(new Set()); setWeights({}); load(); };

  const applyRange = (next) => { setRange(next); setPick(next); };
  const rangeBar = (
    <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
      <TextField size="small" type="date" value={pick.from} onChange={(e) => setPick((p) => ({ ...p, from: e.target.value, all: false }))} InputLabelProps={{ shrink: true }} sx={{ width: 150 }} />
      <Typography variant="body2" color="text.secondary">-</Typography>
      <TextField size="small" type="date" value={pick.to} onChange={(e) => setPick((p) => ({ ...p, to: e.target.value, all: false }))} InputLabelProps={{ shrink: true }} sx={{ width: 150 }} />
      <Button size="small" variant="contained" color="secondary" startIcon={<CloudDownloadOutlinedIcon />} disabled={!pick.from || !pick.to || pick.from > pick.to} onClick={() => applyRange({ ...pick, all: false })}>ดึงข้อมูล</Button>
      <Button size="small" variant={range.all ? "contained" : "outlined"} startIcon={<AllInclusiveIcon />} onClick={() => applyRange({ ...pick, all: true })}>ดึงทั้งหมด</Button>
      {range.all && <Button size="small" startIcon={<RestartAltIcon />} onClick={() => applyRange(defaultRange())}>{RANGE_DAYS} วัน</Button>}
    </Box>
  );

  const openCellEdit = useCallback((row, col) => {
    if (row.__kind !== "map" || !row.mapping_id) { setToast("แก้ไขได้เฉพาะแถววัตถุดิบที่อยู่ในรถเข็น (มี รายการ)"); return; }
    setEditTarget({ row, col });
  }, []);
  const afterCellEdit = (msg) => {
    setEditTarget(null);
    setToast(msg);
    load();
    window.dispatchEvent(new Event("sheet-edited")); // the Done table searches again
  };

  // ชิปสถานะ: เรียงตามลำดับกระบวนการ (STATUS_LIST) และแสดงเฉพาะสถานะที่มีแถว พร้อมจำนวน
  const statusChips = useMemo(() => {
    const count = new Map();
    const look = new Map();
    rows.forEach((r) => {
      const st = r.__status;
      if (!st?.label) return;
      count.set(st.label, (count.get(st.label) || 0) + 1);
      if (!look.has(st.label)) look.set(st.label, st);
    });
    const order = [...new Set([...fullStatusOrder(globalOrder), ...count.keys()])];
    return order.filter((label) => count.get(label)).map((label) => {
      const st = look.get(label);
      return { label, name: st.name, count: count.get(label), color: st.color, bg: st.bg, onBg: st.onBg, onFg: st.onFg };
    });
  }, [rows, globalOrder]);
  const toolbarExtra = (
    <>
      {rangeBar}
      {role === "sup" && (
        <Chip
          label={editMode ? "โหมดแก้ไข: ดับเบิลคลิกเซลล์เพื่อแก้" : "โหมดแก้ไข"} clickable color={editMode ? "warning" : "default"} variant={editMode ? "filled" : "outlined"}
          onClick={() => setEditMode((v) => !v)}
        />
      )}
      {role === "prep" && (
        <>
          {!MY_TYPES.some((id) => id === 998 || id === 999) && (
            <Button variant="contained" size="small" startIcon={<IoBarcodeSharp />} onClick={() => setScan({ camera: true, review: false, mat: "", batch: "", hu: "" })}>สแกนป้าย SAP</Button>
          )}
          <Button variant="contained" size="small" startIcon={<QrCodeScannerIcon />} onClick={() => hu.openScan("linein")}>สแกนไลน์รับเข้า</Button>
        </>
      )}
      {role === "cs2" && ["start", "end", "dispatch"].map((k) => (
        <Button key={k} variant="contained" size="small" startIcon={<QrCodeScannerIcon />} onClick={() => hu.openScan(k)}>
          สแกน {{ start: "เริ่มละลาย", end: "ละลายเสร็จ", dispatch: "จ่ายลงไลน์" }[k]}
        </Button>
      ))}
      {role === "pack" && (
        <>
          <LinePicker lineId={lineId} onChange={changeLine} />
          {!Number.isNaN(MY_LINE) && <Chip icon={<PersonPinCircleOutlinedIcon />} label="ไลน์ของฉัน" clickable color={myLine ? "primary" : "default"} variant={myLine ? "filled" : "outlined"} onClick={() => setMyLine((v) => !v)} />}
        </>
      )}
    </>
  );

  // everything the two tables share: the same columns and the same account settings (tabs of the "ตั้งค่าคอลัมน์ที่แสดง" dialog)
  const lineNames = useMemo(() => [...new Set(allRows.map((r) => r.rmm_line_name).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "th", { numeric: true })), [allRows]);
  // tabs 2-4 of the settings dialog: they change what everybody on the account sees, so they are locked with the password of the day
  const settingPages = useCallback((ext, setExt) => [
    { key: "color", label: "สีแถว", node: <PasswordGate><ColorSettings ext={ext} setExt={setExt} /></PasswordGate> },
    { key: "status", label: "พื้นที่สถานะ", node: <PasswordGate><StatusZoneSettings ext={ext} setExt={setExt} /></PasswordGate> },
    { key: "line", label: "ผู้ดูแลไลน์", node: <PasswordGate><LineGroupSettings ext={ext} setExt={setExt} lines={lineNames} /></PasswordGate> },
    { key: "statusOrder", label: "ลำดับสถานะ", node: <StatusOrderSettings savedOrder={globalOrder} labels={globalSettings.statusLabels} onSaved={setGlobalSettings} /> },
    { key: "statusStyle", label: "ชื่อและสีสถานะ", node: <StatusStyleSettings settings={globalSettings} defaults={statusDefaults} onSaved={setGlobalSettings} /> },
  ], [lineNames, globalOrder, globalSettings, statusDefaults]);
  const sharedGrid = { columns, groups: GROUPS, defaultVisible: defVisible, prepareRows: prepareSheetRows, colorSettings: settingPages, onCellEdit: role === "sup" && editMode ? openCellEdit : undefined };

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      {view === "done" ? (
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}><div style={{ position: "absolute", inset: 0 }}><DonePanel gridKey={`sheet-${role}`} gridProps={sharedGrid} /></div></div>
      ) : (
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0 }}>
      <DataGrid
        fill detail statusChips={statusChips} actionBar={actionBar} activeKey={activeKey} onRowClick={(r) => setActiveKey((k) => (k === r.__key ? null : r.__key))}
        gridKey={`sheet-${role}`} title="ตารางรวมวัตถุดิบ" defaultExt={DEFAULT_EXT} {...sharedGrid}
        rows={rows} rowKey={rowKey} rowSig={rowSig} loading={loading} error={error} onReload={load} hideReload ctx={ctx}
        searchPlaceholder="ค้นหา HU / รถเข็น / Batch / วัตถุดิบ / รายการ ..."
        rowColor={rowColorOf}
        toolbarExtra={toolbarExtra}
        selectable={role === "pack" || role === "prep" || role === "cs1" || role === "cs2"} selected={selected} onSelectedChange={setSelected} isSelectable={(r) => (role === "prep" ? r.__kind === "mix" || !!r.__loaf : role === "cs1" || role === "cs2" ? inMyRoom(r) && Number(r.weight_RM) > 0 : canPack(r))}
      />
      </div>
      </div>
      )}

      {role === "sup" && <EditCellDialog target={editTarget} onClose={() => setEditTarget(null)} onSaved={afterCellEdit} />}
      {/* tool dialogs (each one is the flow of the old page of that Role) */}
      {hu.layer}
      <PackFlows ref={packRef} onDone={load} onNotify={setToast} />
      {pstamp && (() => {
        const M = PREP_STAMPS[pstamp.kind];
        const sap = pstamp.hu;
        return <M open onClose={() => { setPstamp(null); load(); }} onSuccess={load} data={sap} material={sap.mat} batch={sap.batch} sap_re_id={sap.sap_re_id} withdraw_date={sap.withdraw_date} hu={sap.hu} remark={sap.remark} />;
      })()}
      {role === "prep" && (
        <>
          <ManageModals ref={manageRef} onRefresh={load} />
          <Dialog open={!!planPick} onClose={() => setPlanPick(null)} maxWidth="xs" fullWidth>
            <DialogTitle>เลือกแผนการผลิต</DialogTitle>
            <DialogContent dividers>
              {planPick?.plans.map((p) => (
                <Button
                  key={p.rmfp_id} fullWidth variant="outlined"
                  sx={{ justifyContent: "flex-start", mb: 1, textTransform: "none" }}
                  onClick={() => { const m = manageRef.current; const open = planPick.action === "cart" ? m?.openCart : m?.openEdit; setPlanPick(null); open?.(p); }}
                >
                  {[p.production, p.rm_group_name, p.level_eu && `EU ${p.level_eu}`].filter(Boolean).join(" · ") || `แผน ${p.rmfp_id}`}
                </Button>
              ))}
            </DialogContent>
          </Dialog>
          <CameraActivationModal
            open={scan.camera} onClose={() => setScan((s) => ({ ...s, camera: false }))}
            onConfirm={(m, b, h) => setScan({ camera: false, review: true, mat: m, batch: b, hu: h })}
            primaryBatch={scan.mat} secondaryBatch={scan.batch} hu={scan.hu}
            setPrimaryBatch={(v) => setScan((s) => ({ ...s, mat: v }))} setSecondaryBatch={(v) => setScan((s) => ({ ...s, batch: v }))} setHu={(v) => setScan((s) => ({ ...s, hu: v }))}
          />
          {scan.review && <DataReviewSAP open onClose={() => { setScan((s) => ({ ...s, review: false })); load(); }} material={scan.mat} batch={scan.batch} hu={scan.hu} />}
          <ReworkFlows ref={reworkRef} onDone={load} onNotify={setToast} />
          <EmulsionFlows ref={mixRefs.emu} onDone={afterMix} />
          <BatchFlows ref={mixRefs.batch} onDone={afterMix} />
          <MixPackFlows ref={mixRefs.pack} onDone={afterMix} />
          <LoafFlows ref={mixRefs.loaf} onDone={afterMix} />
        </>
      )}
      <PackMoreFlows ref={moreRef} onDone={afterConfirm} onNotify={setToast} />
      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="info" onClose={() => setToast("")} sx={{ width: "100%" }}>{toast}</Alert>
      </Snackbar>
      <GatherSelected open={gatherOpen} onClose={() => setGatherOpen(false)} rows={gatherRows} trolleys={coldTrolleys} onDone={(n) => { setToast(`จัดชุดเรียบร้อย ${n} รายการ`); setSelected(new Set()); load(); }} />
      <TrolleyFlows ref={trolleyRef} rows={data.mappings} onDone={load} />
      <CheckoutFlow ref={checkoutRef} onDone={load} />
      <LargeFlows ref={largeRef} onDone={load} />
      {batch?.kind === "cart" && <BatchCartDialog rows={batch.rows} weights={weights} onClose={closeBatch} onDone={load} />}
      {batch?.kind === "edit" && <BatchEditPlanDialog rows={batch.rows} onClose={closeBatch} onDone={load} />}
      {batch?.kind === "delete" && <BatchDeleteDialog rows={batch.rows} onClose={closeBatch} onDone={load} />}
    </div>
  );
};

export default ParentComponent;
