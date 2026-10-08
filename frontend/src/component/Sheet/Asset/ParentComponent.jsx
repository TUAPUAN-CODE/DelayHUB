import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { Alert, Box, Button, Paper, Chip, ListSubheader, Menu, MenuItem, Select, Snackbar, TextField, Tooltip, Typography } from "@mui/material";
import { IoBarcodeSharp } from "react-icons/io5";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import DataGrid from "../../Layout/DataGrid/DataGrid";
import ColorSettings, { DEFAULT_EXT, rowColorOf } from "./ColorSettings";
import useHuStamps from "./useHuStamps";
import { columnsForRole, defaultVisible, GROUPS, ROLE_LABEL } from "./columns";
import { buildRows } from "./buildRows";
import { planStamp } from "../../ColdStorages/SapSheet/Asset/sapTimeline";
// tools that already exist as flows of each Role
import PackFlows from "../../Pack/ManageRawmat/Asset/flow/PackFlows";
import CartModal from "../../Pack/ManageRawmat/Asset/ModalEditPD";
import TrolleyFlows from "../../ColdStorage/RoomTableSupervisor/Asset/flow/TrolleyFlows";
import CheckoutFlow from "../../ColdStorage/RoomTableSupervisor/Asset/flow/CheckoutFlow";
import LargeFlows from "../../ColdStorages/RoomMonitor/Asset/flow/LargeFlows";
import PackMoreFlows from "./pack/PackMoreFlows";
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
const prepPlan = (r) => ({ ...r, CookedDateTime: r.CookedDateTime ? formatDateTime(r.CookedDateTime) : null, withdraw_date: r.withdraw_date ? formatDateTime(r.withdraw_date) : null });

/** "จัดการ" of a SAP row: one button, a menu per production-plan row → trolley / slip / complete / change plan */
const ManageMenu = ({ plans, onAction }) => {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <Button size="small" variant="outlined" onClick={(e) => setAnchor(e.currentTarget)} sx={{ whiteSpace: "nowrap", minWidth: 0, px: 1, fontSize: 12 }}>จัดการ ({plans.length}) ▾</Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {plans.flatMap((p) => [
          <ListSubheader key={`h${p.rmfp_id}`} sx={{ lineHeight: "28px", fontSize: 12 }}>{[p.production, p.rm_group_name, p.level_eu && `EU ${p.level_eu}`].filter(Boolean).join(" · ") || `แผน ${p.rmfp_id}`}</ListSubheader>,
          ...[["cart", "ใส่รถเข็น"], ["slip", "สลิป"], ["complete", "เสร็จสิ้น"], ["editPlan", "เปลี่ยนแผนการผลิต"]].map(([a, label]) => (
            <MenuItem key={`${p.rmfp_id}-${a}`} dense onClick={() => { setAnchor(null); onAction(a, p); }}>{label}</MenuItem>
          )),
        ])}
      </Menu>
    </>
  );
};

const CS1_DEST = ["เข้าห้องเย็น", "รอCheckin", "ห้องเย็น", "ส่งกลับจากห้องเย็นใหญ่"];
const CS2_DEST = ["ห้องเย็นใหญ่", "เข้าห้องเย็นใหญ่"];
const PREP_STAMPS = { receive: ModalStampReceive, boil: ModalStampBoil, return: ModalStampReturn };
const MY_LINE = parseInt(localStorage.getItem("line_id"), 10);
// ประเภทวัตถุดิบของผู้ใช้ (หน้า QC / จุดเตรียมเดิมกรองด้วยค่านี้)
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

const ParentComponent = ({ role }) => {
  const [data, setData] = useState({ hus: [], mappings: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState(7);
  const [includeOpen, setIncludeOpen] = useState(true);
  const [mine, setMine] = useState(false);
  const [myLine, setMyLine] = useState(role === "pack" && !Number.isNaN(MY_LINE));
  const [myType, setMyType] = useState((role === "qc" || role === "prep") && MY_TYPES.length > 0);
  const [cart, setCart] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [weights, setWeights] = useState({});
  const [toast, setToast] = useState("");
  const [mix, setMix] = useState({});
  const [plans, setPlans] = useState([]);
  const [activeKey, setActiveKey] = useState(null); // the row chosen by a click: the action bar above the table works on it
  const [scan, setScan] = useState({ camera: false, review: false, mat: "", batch: "", hu: "" });
  const [mixMenu, setMixMenu] = useState(null);
  const [pstamp, setPstamp] = useState(null); // { kind, hu } — Prep time stamp of a SAP/HU row (receive / boil done / return)

  const columns = useMemo(() => columnsForRole(role), [role]);
  const defVisible = useMemo(() => defaultVisible(role), [role]);

  const huRef = useRef([]);
  const trolleyRef = useRef(null);
  const checkoutRef = useRef(null);
  const largeRef = useRef(null);
  const packRef = useRef(null);
  const moreRef = useRef(null);
  const reworkRef = useRef(null);
  const manageRef = useRef(null);
  const mixRefs = { emu: useRef(null), batch: useRef(null), pack: useRef(null), loaf: useRef(null) };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/sheet/rows`, { params: { days, include_open: includeOpen ? 1 : 0 } });
      if (!res.data?.success) throw new Error(res.data?.error || "โหลดตารางไม่สำเร็จ");
      huRef.current = res.data.hus || [];
      setData({ hus: res.data.hus || [], mappings: res.data.mappings || [] });
      setError("");
      if (role === "prep") {
        // lists of the old mixing pages (a failing list must not break the sheet)
        const kinds = Object.keys(MIX_KINDS);
        const results = await Promise.allSettled(kinds.map((k) => axios.get(`${API_URL}${MIX_KINDS[k].url}`)));
        const next = {};
        results.forEach((r, i) => {
          if (r.status === "fulfilled") { const d = r.value.data; next[kinds[i]] = Array.isArray(d) ? d : (d?.success ? d.data : []); }
          else console.error(`[Sheet] mix list ${kinds[i]} error:`, r.reason?.message);
        });
        setMix(next);
        if (MY_TYPES.length) {
          try {
            const pr = await axios.get(`${API_URL}/api/prep/manage/fetchRMForProd`, { params: { rm_type_ids: MY_TYPES.join(",") } });
            setPlans((pr.data?.data ?? []).map(prepPlan));
          } catch (e) { console.error("[Sheet] plan list error:", e.message); }
        }
      }
    } catch (err) {
      console.error("[Sheet] load error:", err);
      setError(err.response?.data?.error || err.message || "โหลดตารางไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [days, includeOpen, role]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, REFRESH_MS); return () => clearInterval(t); }, [load]);

  // real-time: reload when another user changes data (same events as the old pages)
  useEffect(() => {
    if (!API_URL) return undefined;
    let timer = null;
    const socket = io(API_URL, { transports: ["websocket"], reconnectionAttempts: 5, reconnectionDelay: 2000, timeout: 10000 });
    const refresh = () => { clearTimeout(timer); timer = setTimeout(load, 800); };
    socket.on("dataUpdated", refresh);
    socket.on("dataDelete", refresh);
    socket.on("connect_error", (err) => console.error("[Sheet] socket error:", err.message));
    return () => { clearTimeout(timer); socket.off("dataUpdated", refresh); socket.off("dataDelete", refresh); socket.disconnect(); };
  }, [load]);

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
        [["receive", "รับ", "#2e7d32", "บันทึกเวลารับวัตถุดิบ"], ["boil", "ต้ม/อบเสร็จ", "#e65100", "บันทึกเวลาต้มอบเสร็จ"], ["return", "ส่งคืน", "#6a1b9a", "บันทึกเวลาส่งคืนวัตถุดิบ"]].forEach(([k, label, color, title]) => {
          out.push({ col: "t_pstamp", key: `ps-${k}`, label, color, title, run: () => setPstamp({ kind: k, hu: h }) });
        });
      }
      if (r.__plans?.length) {
        out.push({ col: "t_manage", key: "manage", passive: true, node: <ManageMenu plans={r.__plans} onAction={(a, p) => { const m = manageRef.current; ({ cart: m?.openCart, slip: m?.openSlip, complete: m?.openComplete, editPlan: m?.openEdit })[a]?.(p); }} /> });
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
    if (role === "qc" || role === "pack") {
      if (stage === "qc") out.push({ col: "t_qc", key: "qc", label: "ตรวจ QC", color: "#B45309", run: () => packRef.current?.qc(r) });
    }
    if (role === "pack") {
      const confirmable = stage === "ready" && !r.sc_pack_date;
      if (stage === "ready") out.push({ col: "t_cart", key: "cart", label: "ใส่รถเข็น", color: "#1552F0", run: () => setCart({ ...r, mat: r.mat, production: r.code, rm_cold_status: r.rm_status }) });
      if (stage === "trolley") out.push({ col: "t_send", key: "send", label: "ส่งไป", color: "#047857", run: () => packRef.current?.send(r.tro_id) });
      if (stage === "ready") {
        out.push({ col: "t_edit", key: "edit", label: "แก้ไข", color: "#B26A00", run: () => moreRef.current?.edit(r) });
        out.push({ col: "t_confirm", key: "confirm", label: "ยืนยัน", color: "#2E7D32", run: () => moreRef.current?.confirmOne(r) });
      }
      if (confirmable || stage === "ready") {
        out.push({ col: "t_kg", key: "kg", passive: true, node: <WeightInput value={weights[r.mapping_id]} disabled={!selected.has(r.__key)} onChange={(v) => setWeights((w) => ({ ...w, [r.mapping_id]: v }))} /> });
      }
      if (r.tro_id && CHECKIN_DEST.includes(r.dest)) out.push({ col: "t_checkin", key: "checkin", label: "Check In", color: "#6A1B9A", run: () => moreRef.current?.checkin(r, allRowsRef.current) });
    }
    return out;
  }, [role, hu, weights, selected]);
  const ctx = useMemo(() => ({ tools }), [tools]);

  const allRows = useMemo(() => buildRows(data.hus, data.mappings, mix, plans), [data, mix, plans]);
  const allRowsRef = useRef([]);
  allRowsRef.current = allRows;
  const rows = useMemo(() => {
    let list = allRows;
    if (myLine && role === "pack") list = list.filter((r) => r.__kind === "map" && (r.line_id === MY_LINE || (r.__stage === "trolley" && Number(r.pack_line_id) === MY_LINE)));
    if (myType && (role === "qc" || role === "prep")) list = list.filter((r) => (role === "prep" && r.__kind !== "map") || (r.__kind === "map" && MY_TYPES.includes(Number(r.rm_type_id))));
    if (mine) list = list.filter((r) => tools(r).some((t) => !t.passive && t.ok !== false));
    return list;
  }, [allRows, mine, myLine, myType, role, tools]);

  // ── action bar above the table: the tools of the chosen row ──
  const activeRow = useMemo(() => (activeKey ? rows.find((r) => r.__key === activeKey) || null : null), [rows, activeKey]);
  const barItems = useMemo(() => (activeRow ? tools(activeRow).filter((i) => i.col !== "t_kg") : []), [activeRow, tools]);
  const actionBar = (
    <Paper variant="outlined" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, px: 1.5, py: 1, mb: 1, flexShrink: 0, borderColor: activeRow ? "#1552F0" : undefined, background: activeRow ? "#F3F7FF" : undefined }}>
      <Typography variant="body2" sx={{ fontWeight: 700, color: activeRow ? "#1552F0" : "text.secondary" }}>
        {activeRow ? `แถวที่เลือก: ${[activeRow.hu && `HU ${activeRow.hu}`, activeRow.tro_id && `รถเข็น ${activeRow.tro_id}`, activeRow.mat_name || activeRow.batch].filter(Boolean).join(" · ") || `รายการ ${activeRow.mapping_id ?? ""}`}` : "คลิกที่แถวในตารางเพื่อเลือก แล้วเลือกรายการที่ต้องการทำตรงนี้"}
      </Typography>
      {activeRow && !barItems.length && <Typography variant="body2" color="text.secondary">แถวนี้ไม่มีรายการที่ทำได้ในขั้นตอนนี้</Typography>}
      {barItems.map((it) => (it.node ? <Box key={it.key}>{it.node}</Box> : (
        <Tooltip key={it.key} title={it.ok === false ? it.title || "ยังทำรายการนี้ไม่ได้" : it.title || ""} arrow>
          <span>
            <Button size="small" variant="contained" disabled={it.ok === false} onClick={it.run} startIcon={it.icon}
              sx={{ textTransform: "none", whiteSpace: "nowrap", background: it.color, "&:hover": { background: it.color, filter: "brightness(.92)" } }}>{it.label}</Button>
          </span>
        </Tooltip>
      )))}
      {activeRow && <Button size="small" onClick={() => setActiveKey(null)}>ยกเลิกการเลือก</Button>}
    </Paper>
  );

  const confirmSelected = () => {
    const picked = rows.filter((r) => selected.has(r.__key));
    if (!picked.length) return;
    if (picked.some((r) => !(parseFloat(weights[r.mapping_id]) > 0))) { setToast("กรุณากรอกน้ำหนัก (kg) ให้ครบทุกแถวที่เลือก"); return; }
    moreRef.current?.confirmRows(picked, weights);
  };
  const afterConfirm = () => { setSelected(new Set()); setWeights({}); load(); };

  const toolbarExtra = (
    <>
      <Chip label={`งานของ ${ROLE_LABEL[role] || "ฉัน"}`} clickable color={mine ? "primary" : "default"} variant={mine ? "filled" : "outlined"} onClick={() => setMine((v) => !v)} />
      <Typography variant="body2" color="text.secondary">ย้อนหลัง</Typography>
      <Select size="small" value={days} onChange={(e) => setDays(e.target.value)}>
        {[3, 7, 14, 30, 90].map((d) => <MenuItem key={d} value={d}>{d} วัน</MenuItem>)}
      </Select>
      <Tooltip title="รวมรายการที่ยังไม่ปิด แม้เก่ากว่าช่วงวันที่เลือก (กันของตกค้าง)" arrow>
        <Chip label="รวมรายการที่ยังไม่ปิด" clickable size="small" color={includeOpen ? "secondary" : "default"} variant={includeOpen ? "filled" : "outlined"} onClick={() => setIncludeOpen((v) => !v)} />
      </Tooltip>
      {(role === "qc" || role === "prep") && MY_TYPES.length > 0 && (
        <Tooltip title="แสดงเฉพาะวัตถุดิบประเภทที่บัญชีของคุณรับผิดชอบ (เหมือนหน้าเดิม) — กดอีกครั้งเพื่อดูทั้งหมด" arrow>
          <Chip label="ประเภทของฉัน" clickable color={myType ? "primary" : "default"} variant={myType ? "filled" : "outlined"} onClick={() => setMyType((v) => !v)} />
        </Tooltip>
      )}
      {role === "prep" && (
        <>
          {!MY_TYPES.some((id) => id === 998 || id === 999) && (
            <Button variant="contained" size="small" startIcon={<IoBarcodeSharp />} onClick={() => setScan({ camera: true, review: false, mat: "", batch: "", hu: "" })}>สแกนป้าย SAP</Button>
          )}
          <Button variant="contained" size="small" onClick={(e) => setMixMenu(e.currentTarget)}>เพิ่มรายการผสม ▾</Button>
          <Menu anchorEl={mixMenu} open={!!mixMenu} onClose={() => setMixMenu(null)}>
            {Object.entries(MIX_KINDS).map(([k, v]) => (
              <MenuItem key={k} onClick={() => { setMixMenu(null); mixRefs[k].current?.add(); }}>{v.label}</MenuItem>
            ))}
          </Menu>
        </>
      )}
      {role === "cs2" && ["start", "end", "dispatch"].map((k) => (
        <Button key={k} variant="contained" size="small" startIcon={<QrCodeScannerIcon />} onClick={() => hu.openScan(k)}>
          สแกน {{ start: "เริ่มละลาย", end: "ละลายเสร็จ", dispatch: "จ่ายลงไลน์" }[k]}
        </Button>
      ))}
      {role === "pack" && (
        <>
          {!Number.isNaN(MY_LINE) && <Chip label="ไลน์ของฉัน" clickable color={myLine ? "primary" : "default"} variant={myLine ? "filled" : "outlined"} onClick={() => setMyLine((v) => !v)} />}
          <Button variant="contained" size="small" disabled={!selected.size} onClick={confirmSelected}>ยืนยันที่เลือก ({selected.size})</Button>
          {CAN_ADD_RM && <Button variant="contained" size="small" onClick={() => moreRef.current?.addRM()}>เพิ่ม RM</Button>}
          <Button variant="contained" size="small" onClick={() => packRef.current?.mix()}>ผสมวัตถุดิบ</Button>
          <Button variant="contained" size="small" onClick={() => packRef.current?.addTrolley()}>เพิ่มรถเข็น</Button>
        </>
      )}
    </>
  );

  return (
    <div style={{ height: "100%", minHeight: 0 }}>
      <DataGrid
        fill actionBar={actionBar} activeKey={activeKey} onRowClick={(r) => setActiveKey((k) => (k === r.__key ? null : r.__key))}
        gridKey={`sheet-${role}`} title="ตารางรวมวัตถุดิบ" columns={columns} groups={GROUPS} defaultVisible={defVisible} defaultExt={DEFAULT_EXT}
        rows={rows} rowKey={(r) => r.__key} loading={loading} error={error} onReload={load} ctx={ctx}
        searchPlaceholder="ค้นหา HU / รถเข็น / Batch / วัตถุดิบ / รายการ ..."
        rowColor={rowColorOf} colorSettings={(ext, setExt) => <ColorSettings ext={ext} setExt={setExt} />}
        toolbarExtra={toolbarExtra}
        selectable={role === "pack"} selected={selected} onSelectedChange={setSelected} isSelectable={(r) => r.__stage === "ready" && !r.sc_pack_date}
        caption="คลิกแถวเพื่อเลือกแล้วทำรายการที่แถบด้านบนตาราง · ช่องว่าง (-) คือขั้นตอนที่ยังไม่มีเวลา · สีแถวและ DBS ตั้งค่าได้ที่ปุ่มตั้งค่าคอลัมน์"
      />

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
          <CameraActivationModal
            open={scan.camera} onClose={() => setScan((s) => ({ ...s, camera: false }))}
            onConfirm={(m, b, h) => setScan({ camera: false, review: true, mat: m, batch: b, hu: h })}
            primaryBatch={scan.mat} secondaryBatch={scan.batch} hu={scan.hu}
            setPrimaryBatch={(v) => setScan((s) => ({ ...s, mat: v }))} setSecondaryBatch={(v) => setScan((s) => ({ ...s, batch: v }))} setHu={(v) => setScan((s) => ({ ...s, hu: v }))}
          />
          {scan.review && <DataReviewSAP open onClose={() => { setScan((s) => ({ ...s, review: false })); load(); }} material={scan.mat} batch={scan.batch} hu={scan.hu} />}
          <ReworkFlows ref={reworkRef} onDone={load} onNotify={setToast} />
          <EmulsionFlows ref={mixRefs.emu} onDone={load} />
          <BatchFlows ref={mixRefs.batch} onDone={load} />
          <MixPackFlows ref={mixRefs.pack} onDone={load} />
          <LoafFlows ref={mixRefs.loaf} onDone={load} />
        </>
      )}
      <PackMoreFlows ref={moreRef} onDone={afterConfirm} onNotify={setToast} />
      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="info" onClose={() => setToast("")} sx={{ width: "100%" }}>{toast}</Alert>
      </Snackbar>
      <TrolleyFlows ref={trolleyRef} rows={data.mappings} onDone={load} />
      <CheckoutFlow ref={checkoutRef} onDone={load} />
      <LargeFlows ref={largeRef} onDone={load} />
      {cart && <CartModal open data={cart} onClose={() => setCart(null)} onSuccess={() => { setCart(null); load(); }} />}
    </div>
  );
};

export default ParentComponent;
