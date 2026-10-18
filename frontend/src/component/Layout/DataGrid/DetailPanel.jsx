import { useEffect, useRef, useState } from "react";
import { Box, Paper, Tab, Tabs, Typography } from "@mui/material";
import RowDetail from "./RowDetail";

// กล่องขวาของตาราง: แท็บ "เครื่องมือ" (ปุ่มทำรายการของหน้า — เปิดเป็นแท็บแรก) และ "รายละเอียด" (ค่าทั้งหมดของแถวที่เลือก)
// จอกว้าง: ลากขอบซ้ายเพื่อปรับความกว้าง (จำไว้ในเบราว์เซอร์) · จอแคบ: อยู่ใต้ตาราง เต็มความกว้าง
const WIDTH_KEY = "dg_detail_width";
const MIN_W = 260;
const DEFAULT_W = 380;

const readWidth = () => {
  try {
    const n = Number(localStorage.getItem(WIDTH_KEY));
    return n >= MIN_W ? n : DEFAULT_W;
  } catch (err) {
    console.error("[DetailPanel] read width:", err);
    return DEFAULT_W;
  }
};

// extraTabs: [{ key, label, render(row) }] แท็บเพิ่มของหน้านั้นๆ (เช่น "ผสมจาก") · ไม่มีเครื่องมือ = ไม่แสดงแท็บเครื่องมือ
const DetailPanel = ({ row, columns, tools, narrow, fill, maxHeight, extraTabs = [] }) => {
  const tabs = [...(tools ? [{ key: "tools", label: "เครื่องมือ" }] : []), { key: "detail", label: "รายละเอียด" }, ...extraTabs];
  const [tabKey, setTabKey] = useState(tabs[0].key);
  const tab = tabs.some((t) => t.key === tabKey) ? tabKey : tabs[0].key;
  const [width, setWidth] = useState(readWidth);
  const drag = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(Math.round(width)));
    } catch (err) {
      console.error("[DetailPanel] save width:", err);
    }
  }, [width]);

  const startDrag = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: width };
  };
  const moveDrag = (e) => {
    if (!drag.current) return;
    const max = Math.max(MIN_W, window.innerWidth * 0.7);
    setWidth(Math.min(max, Math.max(MIN_W, drag.current.w + (drag.current.x - e.clientX))));
  };
  const endDrag = () => { drag.current = null; };

  const size = narrow
    ? { width: "100%", ...(fill ? { flex: "0 0 45%" } : { height: 360 }) }
    : { width, ...(fill ? {} : { maxHeight }) };

  return (
    <Box sx={{ position: "relative", display: "flex", flexShrink: 0, minHeight: 0, ...size }}>
      {!narrow && (
        <Box
          role="separator" aria-orientation="vertical" title="ลากเพื่อปรับความกว้าง"
          onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
          sx={{
            position: "absolute", left: -6, top: 0, bottom: 0, width: 10, cursor: "col-resize", zIndex: 2, touchAction: "none",
            "&::after": { content: '""', position: "absolute", left: 4, top: "45%", height: 40, width: 3, borderRadius: 2, background: "#B8C4DA" },
            "&:hover::after": { background: "#1552F0" },
          }}
        />
      )}
      <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, borderRadius: "16px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Tabs value={tab} onChange={(_, v) => setTabKey(v)} variant="fullWidth" sx={{ minHeight: 40, borderBottom: "1px solid #E3E9F6", flexShrink: 0, "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 700 } }}>
          {tabs.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
        </Tabs>
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {extraTabs.map((t) => (tab === t.key ? <Box key={t.key}>{row ? t.render(row) : <Typography sx={{ p: 2, color: "#90A4AE" }}>คลิกแถวในตารางก่อน</Typography>}</Box> : null))}
          {tab === "detail" && (row
            ? <RowDetail row={row} columns={columns} />
            : <Typography sx={{ p: 2, color: "#90A4AE" }}>คลิกแถวในตารางเพื่อดูรายละเอียดทั้งหมดของแถวนั้น</Typography>)}
          {tab === "tools" && (
            <Box sx={{
              p: 1.5,
              // เรียงทีละแถว: ข้อความ/ปุ่มแต่ละอันเต็มความกว้างของกล่อง
              "& > .MuiPaper-root": { border: "none", background: "transparent", boxShadow: "none", p: 0, mb: 0, gap: 1, flexDirection: "column", alignItems: "stretch", flexWrap: "nowrap" },
              "& > .MuiPaper-root > span, & > .MuiPaper-root > div": { width: "100%" },
              "& > .MuiPaper-root > .MuiTypography-root": { fontSize: 12.5, fontWeight: 600, color: "text.secondary", mt: 0.5 },
              // ปุ่มเครื่องมือ: การ์ดสูง กดง่ายบนแท็บเล็ต ไอคอนอยู่ในกรอบมนด้านซ้าย
              "& .MuiButton-root": {
                width: "100%", justifyContent: "flex-start", minHeight: 46, borderRadius: "14px !important", px: 1.25, py: 0.75,
                fontSize: 14, fontWeight: 600, letterSpacing: 0, textAlign: "left", lineHeight: 1.3,
                boxShadow: "0 1px 2px rgba(19,33,63,.06), 0 4px 12px rgba(19,33,63,.06)", transition: "transform .12s, box-shadow .12s, filter .12s",
                "&:hover": { transform: "translateY(-1px)", boxShadow: "0 6px 16px rgba(19,33,63,.12)" },
                "&.Mui-disabled": { boxShadow: "none", transform: "none" },
              },
              "& .MuiButton-startIcon": {
                width: 30, height: 30, borderRadius: "9px", ml: 0, mr: 1.25, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.22)",
              },
              "& .MuiButton-outlined .MuiButton-startIcon": { background: "#EAF0FF" },
              "& .Mui-disabled .MuiButton-startIcon": { background: "rgba(163,175,198,.18)" },
            }}>
              {tools}
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default DetailPanel;
