import { useEffect, useRef, useState } from "react";
import { Box, Paper, Tab, Tabs, Typography } from "@mui/material";
import RowDetail from "./RowDetail";

// กล่องขวาของตาราง: แท็บ "รายละเอียด" (ค่าทั้งหมดของแถวที่เลือก) และ "เครื่องมือ" (ปุ่มทำรายการของหน้า)
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

const DetailPanel = ({ row, columns, tools, narrow, fill, maxHeight }) => {
  const [tab, setTab] = useState(0);
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
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ minHeight: 40, borderBottom: "1px solid #E3E9F6", flexShrink: 0, "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 700 } }}>
          <Tab label="รายละเอียด" />
          <Tab label="เครื่องมือ" />
        </Tabs>
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {tab === 0 && (row
            ? <RowDetail row={row} columns={columns} />
            : <Typography sx={{ p: 2, color: "#90A4AE" }}>คลิกแถวในตารางเพื่อดูรายละเอียดทั้งหมดของแถวนั้น</Typography>)}
          {tab === 1 && <Box sx={{ p: 1.5, "& > .MuiPaper-root": { border: "none", background: "transparent", p: 0, mb: 0 } }}>{tools}</Box>}
        </Box>
      </Paper>
    </Box>
  );
};

export default DetailPanel;
