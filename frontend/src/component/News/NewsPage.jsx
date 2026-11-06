import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Chip, CircularProgress, Collapse, Paper, Typography } from "@mui/material";
import { LogOut } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";
import Buttom from "../Layout/Buttom";

const API_URL = import.meta.env.VITE_API_URL;
const REFRESH_MS = 60000;
const PAGE = 20;
const SHOW_FIRST = 3;   // rows of an alert shown before "ดูทั้งหมด"

// kind -> label / colour (the same kinds as backend/lib/alertFeed.js)
const KINDS = {
  red: { label: "สีแดง", color: "#DC2626", bg: "#FEF2F2" },
  fish: { label: "ปลา คนละ Batch", color: "#0369A1", bg: "#F0F9FF" },
  transit_late: { label: "ห้องเย็นใหญ่ · เกินเวลา", color: "#B45309", bg: "#FFFBEB" },
  transit_arrived: { label: "ห้องเย็นใหญ่ · รับเข้าแล้ว", color: "#15803D", bg: "#F0FDF4" },
};
const FILTERS = [["", "ทั้งหมด"], ["red", "สีแดง"], ["fish", "ปลา คนละ Batch"], ["transit_late", "ห้องเย็นใหญ่ · เกินเวลา"], ["transit_arrived", "ห้องเย็นใหญ่ · รับเข้าแล้ว"]];

const p2 = (n) => String(n).padStart(2, "0");
const fmtAt = (ms) => { const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear() + 543} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const ago = (ms, now) => {
  const m = Math.max(0, Math.round((now - ms) / 60000));
  if (m < 1) return "เมื่อสักครู่";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} ชั่วโมงที่แล้ว` : `${Math.floor(h / 24)} วันที่แล้ว`;
};
const lineText = (line) => {
  if (line === "sent") return "ส่ง LINE แล้ว";
  if (line === "not-configured") return "ยังไม่ได้ตั้งค่า LINE (ดูได้ในหน้านี้)";
  if (String(line).startsWith("failed 429")) return "ส่ง LINE ไม่สำเร็จ (โควตา LINE เต็ม) · ดูได้ในหน้านี้";
  return "ส่ง LINE ไม่สำเร็จ · ดูได้ในหน้านี้";
};

const Entry = ({ e, now }) => {
  const k = KINDS[e.kind] || { label: e.kind, color: "#475569", bg: "#F8FAFC" };
  const [open, setOpen] = useState(false);
  const rest = e.blocks.slice(SHOW_FIRST);
  return (
    <Paper variant="outlined" sx={{ mb: 1.5, borderLeft: `6px solid ${k.color}`, overflow: "hidden" }}>
      <Box sx={{ px: 2, py: 1.25, bgcolor: k.bg }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
          <Chip size="small" label={k.label} sx={{ bgcolor: k.color, color: "#fff", fontWeight: 600 }} />
          <Typography variant="caption" color="text.secondary">{`${ago(e.at, now)} · ${fmtAt(e.at)}`}</Typography>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color={e.line === "sent" ? "text.secondary" : "warning.main"}>{lineText(e.line)}</Typography>
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{e.title}</Typography>
      </Box>
      <Box sx={{ px: 2, py: 1 }}>
        {e.blocks.slice(0, SHOW_FIRST).map((b, i) => (
          <Box key={i} component="pre" sx={{ m: 0, mb: 1, p: 1, bgcolor: "#F8FAFC", borderRadius: 1, fontFamily: "inherit", fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{b}</Box>
        ))}
        {rest.length > 0 && (
          <>
            <Collapse in={open}>
              {rest.map((b, i) => (
                <Box key={i} component="pre" sx={{ m: 0, mb: 1, p: 1, bgcolor: "#F8FAFC", borderRadius: 1, fontFamily: "inherit", fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{b}</Box>
              ))}
              {e.more > 0 && <Typography variant="caption" color="text.secondary">{`…และอีก ${e.more} รายการ`}</Typography>}
            </Collapse>
            <Button size="small" onClick={() => setOpen((v) => !v)}>{open ? "ซ่อน" : `ดูทั้งหมด (${e.count} รายการ)`}</Button>
          </>
        )}
      </Box>
    </Paper>
  );
};

/** "การแจ้งเตือนล่าสุด": every alert the LINE alert worker made (red / fish / big cold room), readable by everybody who is logged in — no LINE quota. */
const NewsPage = () => {
  const navigate = useNavigate();
  const [kind, setKind] = useState("");
  const [entries, setEntries] = useState(null);   // null = loading
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sheet/delay-alert/feed`, { params: { limit: PAGE, kind } });
      if (!res.data?.success) throw new Error(res.data?.error || "โหลดการแจ้งเตือนไม่สำเร็จ");
      setEntries(res.data.entries || []);
      setHasMore(!!res.data.hasMore);
      setError("");
      setNow(Date.now());
      const newest = res.data.entries?.[0]?.at;
      if (!kind && newest) { try { localStorage.setItem("news_seen_at", String(newest)); } catch { /* storage blocked: the dot just stays */ } }
    } catch (err) {
      console.error("News feed error:", err);
      setError(err.response?.data?.error || err.message || "โหลดการแจ้งเตือนไม่สำเร็จ");
      setEntries((v) => v ?? []);
    }
  }, [kind]);

  useEffect(() => {
    setEntries(null);
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const more = async () => {
    if (!entries?.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await axios.get(`${API_URL}/api/sheet/delay-alert/feed`, { params: { limit: PAGE, kind, before: entries[entries.length - 1].at } });
      setEntries((v) => [...v, ...(res.data.entries || [])]);
      setHasMore(!!res.data.hasMore);
    } catch (err) {
      console.error("News feed (more) error:", err);
    } finally { setLoadingMore(false); }
  };

  const menu = useMemo(() => [
    { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
  ], []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AppSidebar title="DelayHUB" subtitle="การแจ้งเตือน" items={menu} />
      <div style={{ backgroundColor: "#fff" }} className="flex-1 overflow-auto relative z-10">
        <main className="max-w-3xl mx-auto py-3 px-2 lg:px-8">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography sx={{ fontSize: 22, fontWeight: 700, flex: 1 }}>การแจ้งเตือนล่าสุด</Typography>
            <Button size="small" variant="outlined" onClick={() => navigate(-1)}>ย้อนกลับ</Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>ข่าวสารจากระบบแจ้งเตือน Delay ทุกรายการที่ส่งเข้า LINE จะแสดงที่นี่ด้วย (อัปเดตอัตโนมัติทุก 1 นาที)</Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
            {FILTERS.map(([v, label]) => (
              <Chip key={v || "all"} label={label} clickable color={kind === v ? "primary" : "default"} variant={kind === v ? "filled" : "outlined"} onClick={() => setKind(v)} />
            ))}
          </Box>
          {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
          {entries === null && <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} /></Box>}
          {entries && entries.length === 0 && !error && <Alert severity="info">ยังไม่มีการแจ้งเตือน</Alert>}
          {entries && entries.map((e) => <Entry key={e.id} e={e} now={now} />)}
          {hasMore && (
            <Box sx={{ display: "flex", justifyContent: "center", my: 1 }}>
              <Button onClick={more} disabled={loadingMore}>{loadingMore ? "กำลังโหลด..." : "ดูการแจ้งเตือนก่อนหน้า"}</Button>
            </Box>
          )}
        </main>
        <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
          <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
        </main>
      </div>
    </div>
  );
};

export default NewsPage;
