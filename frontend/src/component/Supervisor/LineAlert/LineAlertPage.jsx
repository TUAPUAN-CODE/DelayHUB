import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, CircularProgress, Paper, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import Header from "../../Layout/Header";
import Buttom from "../../Layout/Buttom";

const API_URL = import.meta.env.VITE_API_URL;
const POLL_MS = 2000;
const POLL_MAX = 30;   // 30 x 2 s = 60 s

/**
 * Supervisor: send the LINE alerts NOW (do not wait for the hourly round). The backend leaves a command in Redis; the alert worker (PM2 delay-alert-worker)
 * checks and sends at once, and writes the result back — this page polls for it.
 */
const LineAlertPage = () => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { severity, text }
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const poll = useCallback((id, n) => {
    timerRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/sheet/delay-alert/status`, { params: { id } });
        if (res.data?.state === "done") {
          const r = res.data.result || {};
          setResult({ severity: r.ok ? "success" : "warning", text: r.message || "เสร็จสิ้น" });
          setBusy(false);
          return;
        }
      } catch (err) {
        console.error("LINE alert status error:", err);
      }
      if (n + 1 >= POLL_MAX) {
        setResult({ severity: "warning", text: "ยังไม่ได้รับผลจากตัวส่งแจ้งเตือน (อาจไม่ได้ทำงานอยู่ หรือกำลังตรวจสอบนาน) ลองดูในกลุ่ม LINE หรือกดใหม่ภายหลัง" });
        setBusy(false);
        return;
      }
      poll(id, n + 1);
    }, POLL_MS);
  }, []);

  const sendNow = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await axios.post(`${API_URL}/api/sheet/delay-alert/send-now`);
      if (!res.data?.success) throw new Error(res.data?.error || "ส่งคำสั่งไม่สำเร็จ");
      poll(res.data.id, 0);
    } catch (err) {
      console.error("LINE alert send-now error:", err);
      setResult({ severity: "error", text: err.response?.data?.error || err.message || "ส่งคำสั่งไม่สำเร็จ" });
      setBusy(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#fff" }} className="flex-1 overflow-auto relative z-10">
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Header title="แจ้งเตือน LINE | ส่งทันที" />
      </main>
      <main className="max-w-3xl mx-auto py-2 px-2 lg:px-8">
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 600, mb: 1 }}>ตรวจสอบรายการล่าสุดแล้วส่งเข้ากลุ่ม LINE ทันที โดยไม่ต้องรอรอบ 1 ชั่วโมง</Typography>
          <Box component="ul" sx={{ m: 0, mb: 2, pl: 3, color: "text.secondary", fontSize: 14 }}>
            <li>ส่งรายการที่เปลี่ยนเป็นสีแดงที่รออยู่ทันที (รวมเป็น 1 ข้อความ)</li>
            <li>ตรวจปลา Code เดียวกัน คนละ Batch ของรายการที่เสร็จสิ้น 2 วันล่าสุดทันที</li>
            <li>รายการที่แจ้งไปแล้วจะไม่ส่งซ้ำ</li>
          </Box>
          <Button
            variant="contained" size="large" onClick={sendNow} disabled={busy}
            startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
            sx={{ bgcolor: "#06C755", "&:hover": { bgcolor: "#05a647" } }}
          >
            {busy ? "กำลังตรวจสอบและส่ง..." : "ส่งแจ้งเตือน LINE ทันที"}
          </Button>
          {result && <Alert severity={result.severity} sx={{ mt: 2 }}>{result.text}</Alert>}
        </Paper>
      </main>
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
      </main>
    </div>
  );
};

export default LineAlertPage;
