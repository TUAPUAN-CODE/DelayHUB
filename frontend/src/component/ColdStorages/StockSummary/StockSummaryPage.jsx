import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CircularProgress, InputAdornment, TextField, Alert } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { ArrowRightLeft, Gauge, Layers, Package, RefreshCw, Scale, Truck, Warehouse } from "lucide-react";
import Header from "../../Layout/Header";
import Buttom from "../../Layout/Buttom";
import { buildStockSummary, formatKg, getSource, SOURCE_COLD, SOURCE_PREP, SOURCE_LABEL } from "./Asset/buildStockSummary";
import { MaterialTable, RoomTable } from "./Asset/SummaryParts";
import { CARD, FONT, TOKENS, KpiCard, SectionTitle, SegmentSwitch, StatusDonut } from "./Asset/StockTheme";
import TrolleyBoard from "./Asset/TrolleyBoard";
import RoomAgeRanking from "./Asset/RoomAgeRanking";
import DelayShareChart from "./Asset/DelayShareChart";
import { calculateCSDelayTime } from "../RoomMonitor/Asset/csDelay";

const API_URL = import.meta.env.VITE_API_URL;

const TABLE_TABS = [
  { value: "mat", label: "แยกตามวัตถุดิบ" },
  { value: "room", label: "แยกตามห้อง" },
];

// Stock summary of the large cold rooms: every trolley sent to / parked in a room with cs_id >= 10,
// split by where it came from (cold room or preparation), by material, by room and by time status.
const StockSummaryPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingError, setPendingError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotError, setSlotError] = useState(false);
  const [tick, setTick] = useState(0); // the time left / over moves every minute without reloading

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [inCold, pending, room] = await Promise.allSettled([
        axios.get(`${API_URL}/api/coldstorages/incold/fetchSlotRawMatsend`),
        axios.get(`${API_URL}/api/coldstorages/pending/checkin`),
        axios.get(`${API_URL}/api/coldstorage/room`),
      ]);
      if (room.status === "fulfilled") {
        setSlots(room.value.data?.slot || []);
        setSlotError(false);
      } else {
        console.error("StockSummary slot layout error:", room.reason);
        setSlotError(true);
      }
      if (inCold.status === "rejected") throw inCold.reason;
      const inRoom = Array.isArray(inCold.value.data) ? inCold.value.data : (inCold.value.data?.data ?? []);
      let pendingRows = [];
      if (pending.status === "fulfilled" && pending.value.data?.success) {
        const known = new Set(inRoom.map((r) => r.mapping_id));
        pendingRows = (pending.value.data.data || [])
          .filter((r) => !known.has(r.mapping_id))
          .map((r) => ({ ...r, isPending: true }));
        setPendingError(false);
      } else {
        console.error("StockSummary pending list error:", pending.reason || pending.value?.data?.error);
        setPendingError(true);
      }
      setRows([...pendingRows, ...inRoom]);
      setUpdatedAt(new Date());
    } catch (err) {
      console.error("StockSummary fetch error:", err);
      setError("โหลดข้อมูล Stock ห้องเย็นใหญ่ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // tick: the time status is recalculated every minute
  const summary = useMemo(() => buildStockSummary(rows, source), [rows, source, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const layoutRows = useMemo(() => rows.map((r) => ({ ...r, source: getSource(r) })), [rows]);
  // trolleys in a large room over their limit right now (same rule as the red trolleys on the page)
  const overdueNow = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (!r.tro_id || r.isPending) return;
      const d = calculateCSDelayTime(r);
      if (!d.noDcs && d.color === "red") set.add(String(r.tro_id));
    });
    return set.size;
  }, [rows, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const [historyKey, setHistoryKey] = useState(0);
  const [tableTab, setTableTab] = useState("mat");
  const handleRefresh = () => {
    fetchData();
    setHistoryKey((k) => k + 1);
  };

  const materials = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summary.materials;
    return summary.materials.filter((m) => `${m.mat} ${m.mat_name}`.toLowerCase().includes(q));
  }, [summary.materials, search]);

  const sourceOptions = [
    { value: "all", label: "ทั้งหมด" },
    { value: SOURCE_COLD, label: SOURCE_LABEL[SOURCE_COLD] },
    { value: SOURCE_PREP, label: SOURCE_LABEL[SOURCE_PREP] },
  ];
  const handleSearchChange = (e) => setSearch(e.target.value);

  const { total, trolleysBySource } = summary;
  const showSource = source === "all";

  return (
    <div className="flex-1 overflow-auto relative z-10">
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Header title="สรุป Stock ห้องเย็นใหญ่" />
      </main>

      <main className="max-w-8xl mx-auto py-2 px-2 lg:px-8 space-y-4" style={FONT}>
        <div className="flex flex-wrap items-center gap-3 px-3 py-2.5" style={CARD}>
          <SegmentSwitch value={source} options={sourceOptions} onChange={setSource} />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-1.5 text-sm transition disabled:opacity-60"
            style={{ border: `1px solid ${TOKENS.primary}`, color: TOKENS.primary, backgroundColor: "#fff" }}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            โหลดข้อมูลใหม่
          </button>
          {updatedAt && (
            <span className="ml-auto text-sm" style={{ color: TOKENS.muted }}>
              อัปเดตล่าสุด {updatedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard icon={Truck} label="รถเข็นทั้งหมด" value={total.trolleys} unit="คัน" sub={`วัตถุดิบ ${total.rows} รายการ`} />
          <KpiCard icon={Scale} label="น้ำหนักรวม" value={formatKg(total.weight)} unit="kg" sub={`ถาด ${formatKg(total.trays)}`} accent="#0EA5E9" />
          <KpiCard icon={ArrowRightLeft} label="กำลังส่ง / รอรับเข้า" value={total.transitTrolleys} unit="คัน" accent={TOKENS.accent} />
          <KpiCard icon={Warehouse} label="อยู่ในห้องแล้ว" value={total.roomTrolleys} unit="คัน" accent={TOKENS.success} />
          <KpiCard
            icon={Layers}
            label="แหล่งที่มา"
            value={`${trolleysBySource[SOURCE_COLD]} / ${trolleysBySource[SOURCE_PREP]}`}
            unit="คัน"
            sub={`ห้องเย็น ${formatKg(total.bySource[SOURCE_COLD])} kg · จุดเตรียม ${formatKg(total.bySource[SOURCE_PREP])} kg`}
            accent="#7C3AED"
          />
        </div>

        {error && <Alert severity="error" sx={FONT}>{error}</Alert>}
        {pendingError && (
          <Alert severity="warning" sx={FONT}>โหลดรายการที่กำลังส่งไม่สำเร็จ ตัวเลขกำลังส่งอาจไม่ครบ</Alert>
        )}

        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-16"><CircularProgress /></div>
        ) : (
          <>
            {/* history (2/3) beside the time status (1/3), the two cards the same height */}
            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
              <RoomAgeRanking className="lg:col-span-2" rows={layoutRows} tick={tick} overdueNow={overdueNow} />
              <section className="flex flex-col gap-3">
                <SectionTitle icon={Gauge} title="สถานะเวลาในห้องเย็นใหญ่" subtitle="นับตามรายการวัตถุดิบ" />
                <div className="flex-1">
                  <StatusDonut status={total.status} />
                </div>
              </section>
            </div>

            <DelayShareChart reloadKey={historyKey} />

            {slotError ? (
              <Alert severity="warning" sx={FONT}>โหลดข้อมูลช่องจอดไม่สำเร็จ</Alert>
            ) : (
              <TrolleyBoard rows={layoutRows} slots={slots} source={source} tick={tick} />
            )}

            {/* the two summary tables in one card with tabs (shorter page) */}
            <section className="space-y-3">
              <SectionTitle icon={tableTab === "room" ? Warehouse : Package} title={tableTab === "room" ? "แยกตามห้อง" : "แยกตามวัตถุดิบ"}>
                <div className="flex flex-wrap items-center gap-2">
                  {tableTab === "mat" && (
                    <TextField
                      size="small"
                      value={search}
                      onChange={handleSearchChange}
                      placeholder="ค้นหารหัส / ชื่อวัตถุดิบ"
                      sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "#fff" } }}
                      InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>, sx: FONT }}
                    />
                  )}
                  <SegmentSwitch value={tableTab} options={TABLE_TABS} onChange={setTableTab} />
                </div>
              </SectionTitle>
              {tableTab === "room"
                ? <RoomTable rooms={summary.rooms} showSource={showSource} />
                : <MaterialTable materials={materials} showSource={showSource} />}
            </section>
          </>
        )}
      </main>

      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
      </main>
    </div>
  );
};

export default StockSummaryPage;
