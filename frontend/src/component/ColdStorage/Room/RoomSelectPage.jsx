import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Box, Button, LinearProgress, Skeleton, Typography } from "@mui/material";
import { Snowflake, RefreshCw } from "lucide-react";
import Header from "../../Layout/Header";
import Buttom from "../../Layout/Buttom";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

/** Cold rooms of the old drop-down menu. cs_id is the room id in table Slot. */
const ROOMS = [
  { cs_id: 1, name: "CSR 3", href: "/coldStorage/Room/CSR3/CSR3Page" },
  { cs_id: 2, name: "Chill 2", href: "/coldStorage/Room/Chill2/Chill2Page" },
  { cs_id: 3, name: "Chill 4", href: "/coldStorage/Room/Chill4/Chill4Page" },
  { cs_id: 4, name: "Chill 5", href: "/coldStorage/Room/Chill5/Chill5Page" },
  { cs_id: 5, name: "Chill 6", href: "/coldStorage/Room/Chill6/Chill6Page" },
  { cs_id: 6, name: "4C", href: "/coldStorage/Room/4C/4CPage" },
  { cs_id: 7, name: "Ante", href: "/coldStorage/Room/AntePage/AntePage" },
  { cs_id: 8, name: "LargeRoom", href: "/coldStorage/Room/Large/LargePage" },
];

const RoomCard = ({ room, stat, loading }) => {
  const total = stat?.total ?? 0;
  const used = stat?.used ?? 0;
  const pct = total ? Math.round((used / total) * 100) : 0;
  const tone = pct >= 90 ? "#E5484D" : pct >= 70 ? "#F59E0B" : "#1552F0";
  return (
    <Link
      to={room.href}
      className="room-card"
      style={{
        display: "block", textDecoration: "none", color: "inherit", background: "#fff", border: "1px solid #E3E8F2", borderRadius: 16,
        padding: 18, boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.07)",
        transition: "transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s ease, border-color .18s ease",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: "#EAF0FF", color: "#1552F0", display: "grid", placeItems: "center" }}>
          <Snowflake size={22} />
        </Box>
        <Typography sx={{ fontSize: 18, fontWeight: 600 }}>{room.name}</Typography>
      </Box>
      {loading ? (
        <Skeleton variant="rounded" height={34} />
      ) : (
        <>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}>
            <Typography sx={{ fontSize: 13, color: "#6B7489" }}>ช่องจอดที่ใช้อยู่</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{used} / {total}</Typography>
          </Box>
          <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 8, bgcolor: "#EEF2F9", "& .MuiLinearProgress-bar": { bgcolor: tone, borderRadius: 8 } }} />
          <Typography sx={{ fontSize: 12, color: "#6B7489", mt: 0.75 }}>ว่าง {Math.max(total - used, 0)} ช่อง</Typography>
        </>
      )}
    </Link>
  );
};

const RoomSelectPage = () => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API_URL}/api/coldstorage/room`);
      setSlots(res.data?.slot ?? []);
    } catch (err) {
      console.error("โหลดสถานะห้องเย็นไม่สำเร็จ:", err);
      setError("โหลดสถานะห้องเย็นไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const map = {};
    slots.forEach((s) => {
      if (!s.slot_status) return;
      const m = (map[s.cs_id] ||= { total: 0, used: 0 });
      m.total += 1;
      if (s.tro_id && s.tro_id !== "rsrv") m.used += 1;
    });
    return map;
  }, [slots]);

  return (
    <div className="flex-1 overflow-auto relative z-10" style={{ fontFamily: "Prompt, sans-serif" }}>
      <style>{`.room-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(21,82,240,.16)!important;border-color:rgba(21,82,240,.4)!important}`}</style>
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8"><Header title="ห้องเย็น" /></main>
      <main className="max-w-8xl mx-auto py-3 px-1 lg:px-8">
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography sx={{ color: "#6B7489", fontSize: 14 }}>เลือกห้องเย็นเพื่อดูช่องจอดและวัตถุดิบ</Typography>
          <Button size="small" variant="outlined" startIcon={<RefreshCw size={14} />} onClick={load} disabled={loading}>รีเฟรช</Button>
        </Box>
        {error && <Typography sx={{ color: "#E5484D", mb: 2 }}>{error}</Typography>}
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", xl: "repeat(4, 1fr)" } }}>
          {ROOMS.map((r) => <RoomCard key={r.cs_id} room={r} stat={stats[r.cs_id]} loading={loading && !slots.length} />)}
        </Box>
      </main>
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8"><Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" /></main>
    </div>
  );
};

export default RoomSelectPage;
