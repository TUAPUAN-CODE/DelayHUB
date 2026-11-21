import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CircularProgress, InputAdornment, TextField, Alert } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { ArrowRightLeft, Layers, Package, RefreshCw, Scale, Truck, Warehouse } from "lucide-react";
import Header from "../../Layout/Header";
import Buttom from "../../Layout/Buttom";
import { buildStockSummary, formatKg, getSource, SOURCE_COLD, SOURCE_PREP, SOURCE_LABEL } from "./Asset/buildStockSummary";
import { MaterialTable, RoomTable } from "./Asset/SummaryParts";
import { FONT, GRID_BG, HERO_BG, GlassKpi, LiveClock, PageKeyframes, SectionTitle, SegmentSwitch, StatusDonut } from "./Asset/StockTheme";
import RoomLayouts from "./Asset/RoomLayouts";

const API_URL = import.meta.env.VITE_API_URL;

const KG = (v) => formatKg(Math.round(v * 100) / 100);

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
    <div style={{ backgroundColor: "#F4F7FC" }} className="flex-1 overflow-auto relative z-10">
      <PageKeyframes />
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Header title="สรุป Stock ห้องเย็นใหญ่" />
      </main>

      <main className="max-w-8xl mx-auto py-2 px-2 lg:px-8 space-y-5" style={FONT}>
        {/* control-room band: clock, source switch, counters */}
        <section className="relative overflow-hidden rounded-3xl p-4 sm:p-6 text-white shadow-xl" style={HERO_BG}>
          <div className="pointer-events-none absolute inset-0" style={GRID_BG} />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-cyan-200">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
                </span>
                Large Cold Room · Live
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-semibold">สรุป Stock ห้องเย็นใหญ่</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <SegmentSwitch value={source} options={sourceOptions} onChange={setSource} />
                <button
                  type="button"
                  onClick={fetchData}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-60"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  โหลดข้อมูลใหม่
                </button>
                {updatedAt && (
                  <span className="text-xs text-white/70">
                    อัปเดตล่าสุด {updatedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                )}
              </div>
            </div>
            <LiveClock />
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <GlassKpi icon={Truck} label="รถเข็นทั้งหมด" value={total.trolleys} unit="คัน" sub={`วัตถุดิบ ${total.rows} รายการ`} accent="#22D3EE" />
            <GlassKpi icon={Scale} label="น้ำหนักรวม" value={total.weight} format={KG} unit="kg" sub={`ถาด ${formatKg(total.trays)}`} accent="#60A5FA" delay={60} />
            <GlassKpi icon={ArrowRightLeft} label="กำลังส่ง / รอรับเข้า" value={total.transitTrolleys} unit="คัน" accent="#FDBA74" delay={120} />
            <GlassKpi icon={Warehouse} label="อยู่ในห้องแล้ว" value={total.roomTrolleys} unit="คัน" accent="#4ADE80" delay={180} />
            <GlassKpi
              icon={Layers}
              label="แหล่งที่มา"
              display={`${trolleysBySource[SOURCE_COLD]} / ${trolleysBySource[SOURCE_PREP]}`}
              unit="คัน"
              sub={`ห้องเย็น ${formatKg(total.bySource[SOURCE_COLD])} kg · จุดเตรียม ${formatKg(total.bySource[SOURCE_PREP])} kg`}
              accent="#C4B5FD"
              delay={240}
            />
          </div>
        </section>

        {error && <Alert severity="error" sx={FONT}>{error}</Alert>}
        {pendingError && (
          <Alert severity="warning" sx={FONT}>โหลดรายการที่กำลังส่งไม่สำเร็จ ตัวเลขกำลังส่งอาจไม่ครบ</Alert>
        )}

        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-16"><CircularProgress /></div>
        ) : (
          <>
            <StatusDonut status={total.status} title="สถานะเวลาในห้องเย็นใหญ่ (นับตามรายการวัตถุดิบ)" />

            {slotError ? (
              <Alert severity="warning" sx={FONT}>โหลด Layout ช่องจอดไม่สำเร็จ</Alert>
            ) : (
              <RoomLayouts rows={layoutRows} slots={slots} source={source} tick={tick} />
            )}

            <section className="space-y-3">
              <SectionTitle icon={Package} title="แยกตามวัตถุดิบ">
                <TextField
                  size="small"
                  value={search}
                  onChange={handleSearchChange}
                  placeholder="ค้นหารหัส / ชื่อวัตถุดิบ"
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 999, backgroundColor: "#fff" } }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>, sx: FONT }}
                />
              </SectionTitle>
              <MaterialTable materials={materials} showSource={showSource} />
            </section>

            <section className="space-y-3">
              <SectionTitle icon={Warehouse} title="แยกตามห้อง" />
              <RoomTable rooms={summary.rooms} showSource={showSource} />
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
