import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Box, Button, Chip, MenuItem, Select, Tooltip, Typography } from "@mui/material";
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

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;
const REFRESH_MS = 60000;

const CS1_DEST = ["เข้าห้องเย็น", "รอCheckin", "ห้องเย็น", "ส่งกลับจากห้องเย็นใหญ่"];
const CS2_DEST = ["ห้องเย็นใหญ่", "เข้าห้องเย็นใหญ่"];
const PACK_STATUS = ["QcCheck", "เหลือจากไลน์ผลิต", "QcCheck รอ MD", "รอแก้ไข"];

const ParentComponent = ({ role }) => {
  const [data, setData] = useState({ hus: [], mappings: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState(7);
  const [includeOpen, setIncludeOpen] = useState(true);
  const [mine, setMine] = useState(false);
  const [cart, setCart] = useState(null);

  const columns = useMemo(() => columnsForRole(role), [role]);
  const defVisible = useMemo(() => defaultVisible(role), [role]);

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
    if (role === "qc" || role === "pack") {
      if (st.includes("รอQC") || st.includes("รอ MD")) out.push({ col: "t_qc", key: "qc", label: "ตรวจ QC", color: "#B45309", run: () => packRef.current?.qc(r) });
    }
    if (role === "pack") {
      const ready = !r.tro_id && PACK_STATUS.includes(st) && ["จุดเตรียม", "ออกห้องเย็น", "create_manual"].includes(r.stay_place)
        && ["ไปบรรจุ", "บรรจุ", "create_manual", "รอCheckin"].includes(r.dest) && Number(r.weight_RM) !== 0;
      if (ready) out.push({ col: "t_cart", key: "cart", label: "ใส่รถเข็น", color: "#1552F0", run: () => setCart({ ...r, mat: r.mat, production: r.code, rm_cold_status: r.rm_status }) });
      if (r.tro_id && ["บรรจุ", "รถเข็นรอจัดส่ง"].includes(r.dest)) out.push({ col: "t_send", key: "send", label: "ส่งไป", color: "#047857", run: () => packRef.current?.send(r.tro_id) });
    }
    return out;
  }, [role, hu]);
  const ctx = useMemo(() => ({ tools }), [tools]);

  const allRows = useMemo(() => buildRows(data.hus, data.mappings), [data]);
  const rows = useMemo(() => (mine ? allRows.filter((r) => tools(r).some((t) => t.ok !== false)) : allRows), [allRows, mine, tools]);

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
    </>
  );

  return (
    <div>
      <DataGrid
        gridKey={`sheet-${role}`} title="ตารางรวมวัตถุดิบ" columns={columns} groups={GROUPS} defaultVisible={defVisible} defaultExt={DEFAULT_EXT}
        rows={rows} rowKey={(r) => r.__key} loading={loading} error={error} onReload={load} ctx={ctx}
        searchPlaceholder="ค้นหา HU / รถเข็น / Batch / วัตถุดิบ / รายการ ..."
        rowColor={rowColorOf} colorSettings={(ext, setExt) => <ColorSettings ext={ext} setExt={setExt} />}
        toolbarExtra={toolbarExtra}
        caption="ช่องว่าง (-) คือขั้นตอนที่ยังไม่มีเวลา · สีแถวและ DBS ตั้งค่าได้ที่ปุ่มตั้งค่าคอลัมน์"
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
