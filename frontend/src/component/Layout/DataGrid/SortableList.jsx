import { useRef, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

/**
 * A list whose order is changed by dragging the handle (mouse or finger: pointer events, so it also works on the floor tablets)
 * or with the up / down buttons. items: [{ key, label, sub?, node? }] · onChange(keys in the new order)
 */
const SortableList = ({ items, onChange, disabled = false }) => {
  const [drag, setDrag] = useState(null); // { from, over }
  const rowRefs = useRef([]);

  const move = (from, to) => {
    if (from === to || to < 0 || to >= items.length) return;
    const keys = items.map((i) => i.key);
    const [k] = keys.splice(from, 1);
    keys.splice(to, 0, k);
    onChange(keys);
  };

  const overIndex = (clientY) => {
    const rects = rowRefs.current.map((el) => el?.getBoundingClientRect()).filter(Boolean);
    const i = rects.findIndex((r) => clientY < r.top + r.height / 2);
    return i === -1 ? rects.length - 1 : i;
  };
  const start = (e, i) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: i, over: i });
  };
  const moveDrag = (e) => { if (drag) setDrag((d) => ({ ...d, over: overIndex(e.clientY) })); };
  const end = () => {
    if (drag) move(drag.from, drag.over);
    setDrag(null);
  };

  return (
    <Box>
      {items.map((it, i) => {
        const dragging = drag && drag.from === i;
        const target = drag && drag.over === i && drag.from !== i;
        return (
          <Box
            key={it.key} ref={(el) => { rowRefs.current[i] = el; }}
            sx={{
              display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.5, mb: 0.5, borderRadius: 2, background: "#fff",
              border: "1px solid #E1E9FA", opacity: dragging ? 0.5 : 1, transition: "box-shadow .12s",
              boxShadow: target ? (drag.over < drag.from ? "inset 0 3px 0 #F26B1D" : "inset 0 -3px 0 #F26B1D") : "none",
            }}
          >
            <Box
              role="button" aria-label="ลากเพื่อย้าย" title="ลากเพื่อย้าย"
              onPointerDown={(e) => start(e, i)} onPointerMove={moveDrag} onPointerUp={end} onPointerCancel={() => setDrag(null)}
              sx={{ display: "flex", alignItems: "center", cursor: disabled ? "default" : "grab", touchAction: "none", color: "#8A9AB8", p: 0.5, "&:active": { cursor: "grabbing" } }}
            >
              <DragIndicatorIcon fontSize="small" />
            </Box>
            <Typography sx={{ minWidth: 26, color: "text.secondary", fontSize: 13 }}>{i + 1}.</Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {it.node || <Typography sx={{ fontSize: 14 }}>{it.label}</Typography>}
              {it.sub && <Typography variant="caption" color="text.secondary">{it.sub}</Typography>}
            </Box>
            <IconButton size="small" aria-label="ขึ้น" disabled={disabled || i === 0} onClick={() => move(i, i - 1)}><ArrowUpwardIcon fontSize="small" /></IconButton>
            <IconButton size="small" aria-label="ลง" disabled={disabled || i === items.length - 1} onClick={() => move(i, i + 1)}><ArrowDownwardIcon fontSize="small" /></IconButton>
          </Box>
        );
      })}
    </Box>
  );
};

export default SortableList;
