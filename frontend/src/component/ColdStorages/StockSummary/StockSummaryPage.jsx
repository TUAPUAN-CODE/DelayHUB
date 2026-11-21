import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Button, CircularProgress, InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Alert } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import Header from "../../Layout/Header";
import Buttom from "../../Layout/Buttom";
import { buildStockSummary, formatKg, getSource, SOURCE_COLD, SOURCE_PREP, SOURCE_LABEL } from "./Asset/buildStockSummary";
import { KpiCard, StatusBar, MaterialTable, RoomTable } from "./Asset/SummaryParts";
import RoomLayouts from "./Asset/RoomLayouts";

const API_URL = import.meta.env.VITE_API_URL;

const FONT = { fontFamily: "Prompt, Kanit, sans-serif" };

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

  const handleSourceChange = (_e, value) => {
    if (value) setSource(value);
  };
  const handleSearchChange = (e) => setSearch(e.target.value);

  const { total, trolleysBySource } = summary;
  const showSource = source === "all";

  return (
    <div style={{ backgroundColor: "#fff" }} className="flex-1 overflow-auto relative z-10">
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Header title="สรุป Stock ห้องเย็นใหญ่" />
      </main>

      <main className="max-w-8xl mx-auto py-1 px-2 lg:px-8 space-y-4" style={FONT}>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleButtonGroup size="small" exclusive value={source} onChange={handleSourceChange} color="primary">
            <ToggleButton value="all" sx={FONT}>ทั้งหมด</ToggleButton>
            <ToggleButton value={SOURCE_COLD} sx={FONT}>{SOURCE_LABEL[SOURCE_COLD]}</ToggleButton>
            <ToggleButton value={SOURCE_PREP} sx={FONT}>{SOURCE_LABEL[SOURCE_PREP]}</ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="outlined"
            size="small"
            onClick={fetchData}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            sx={FONT}
          >
            โหลดข้อมูลใหม่
          </Button>
          {updatedAt && (
            <span className="text-sm text-slate-500">
              อัปเดตล่าสุด {updatedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>

        {error && <Alert severity="error" sx={FONT}>{error}</Alert>}
        {pendingError && (
          <Alert severity="warning" sx={FONT}>โหลดรายการที่กำลังส่งไม่สำเร็จ ตัวเลขกำลังส่งอาจไม่ครบ</Alert>
        )}

        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-16"><CircularProgress /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard label="รถเข็นทั้งหมด" value={total.trolleys} unit="คัน" sub={`วัตถุดิบ ${total.rows} รายการ`} />
              <KpiCard label="น้ำหนักรวม" value={formatKg(total.weight)} unit="kg" sub={`ถาด ${formatKg(total.trays)}`} accent="#0EA5E9" />
              <KpiCard label="กำลังส่ง / รอรับเข้า" value={total.transitTrolleys} unit="คัน" accent="#F97316" />
              <KpiCard label="อยู่ในห้องแล้ว" value={total.roomTrolleys} unit="คัน" accent="#16A34A" />
              <KpiCard
                label="แหล่งที่มา"
                value={`${trolleysBySource[SOURCE_COLD]} / ${trolleysBySource[SOURCE_PREP]}`}
                unit="คัน"
                sub={`ห้องเย็น ${formatKg(total.bySource[SOURCE_COLD])} kg · จุดเตรียม ${formatKg(total.bySource[SOURCE_PREP])} kg`}
                accent="#7C3AED"
              />
            </div>

            <StatusBar status={total.status} />

            {slotError ? (
              <Alert severity="warning" sx={FONT}>โหลด Layout ช่องจอดไม่สำเร็จ</Alert>
            ) : (
              <RoomLayouts rows={layoutRows} slots={slots} source={source} tick={tick} />
            )}

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-800">แยกตามวัตถุดิบ</h2>
                <TextField
                  size="small"
                  value={search}
                  onChange={handleSearchChange}
                  placeholder="ค้นหารหัส / ชื่อวัตถุดิบ"
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>, sx: FONT }}
                />
              </div>
              <MaterialTable materials={materials} showSource={showSource} />
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-800">แยกตามห้อง</h2>
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
