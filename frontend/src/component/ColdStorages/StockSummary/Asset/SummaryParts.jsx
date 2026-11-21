import React from "react";
import {
  Paper, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Tooltip,
} from "@mui/material";
import { STATUS_KEYS, STATUS_META, SOURCE_COLD, SOURCE_PREP, formatKg } from "./buildStockSummary";

const FONT = { fontFamily: "Prompt, Kanit, sans-serif" };

export const KpiCard = ({ label, value, unit, sub, accent = "#2563EB" }) => (
  <div className="rounded-xl bg-white border border-slate-200 shadow-sm px-4 py-3" style={{ borderTop: `4px solid ${accent}` }}>
    <div className="text-sm text-slate-500">{label}</div>
    <div className="mt-1 flex items-baseline gap-1">
      <span className="text-3xl font-semibold text-slate-800 tabular-nums">{value}</span>
      {unit && <span className="text-sm text-slate-500">{unit}</span>}
    </div>
    {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
  </div>
);

// one horizontal bar of the five time statuses (counted per raw-material row, as the LargeRooms table)
export const StatusBar = ({ status }) => {
  const total = STATUS_KEYS.reduce((s, k) => s + status[k], 0);
  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm px-4 py-3">
      <div className="text-sm text-slate-500 mb-2">สถานะเวลาในห้องเย็นใหญ่ (นับตามรายการวัตถุดิบ)</div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
        {total > 0 && STATUS_KEYS.map((k) => (status[k] > 0 ? (
          <Tooltip key={k} title={`${STATUS_META[k].label}: ${status[k]}`}>
            <div style={{ width: `${(status[k] / total) * 100}%`, backgroundColor: STATUS_META[k].color }} />
          </Tooltip>
        ) : null))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {STATUS_KEYS.map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-sm text-slate-700">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_META[k].color }} />
            {STATUS_META[k].label}
            <span className="font-semibold tabular-nums">{status[k]}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

const StatusChips = ({ status }) => (
  <div className="flex flex-wrap justify-center gap-1">
    {["red", "orange", "green"].map((k) => (status[k] > 0 ? (
      <Tooltip key={k} title={STATUS_META[k].label}>
        <span
          className="rounded px-1.5 text-xs font-semibold tabular-nums"
          style={{ color: STATUS_META[k].color, backgroundColor: STATUS_META[k].bg }}
        >
          {status[k]}
        </span>
      </Tooltip>
    ) : null))}
  </div>
);

const headSx = { ...FONT, fontWeight: 600, backgroundColor: "#EFF6FF", color: "#1E3A8A", whiteSpace: "nowrap", py: 1 };
const cellSx = { ...FONT, py: 0.75 };
const numSx = { ...cellSx, textAlign: "right", fontVariantNumeric: "tabular-nums" };

// columns shared by the material and the room table
const NumberCells = ({ b, showSource }) => (
  <>
    <TableCell sx={numSx}>{b.trolleys}</TableCell>
    <TableCell sx={numSx}>{b.transitTrolleys || "-"}</TableCell>
    <TableCell sx={numSx}>{b.roomTrolleys || "-"}</TableCell>
    <TableCell sx={numSx}>{b.trays ? formatKg(b.trays) : "-"}</TableCell>
    {showSource && <TableCell sx={numSx}>{b.bySource[SOURCE_COLD] ? formatKg(b.bySource[SOURCE_COLD]) : "-"}</TableCell>}
    {showSource && <TableCell sx={numSx}>{b.bySource[SOURCE_PREP] ? formatKg(b.bySource[SOURCE_PREP]) : "-"}</TableCell>}
    <TableCell sx={{ ...numSx, fontWeight: 600 }}>{formatKg(b.weight)}</TableCell>
    <TableCell sx={cellSx}><StatusChips status={b.status} /></TableCell>
  </>
);

const NumberHeads = ({ showSource }) => (
  <>
    <TableCell sx={{ ...headSx, textAlign: "right" }}>รถเข็น</TableCell>
    <TableCell sx={{ ...headSx, textAlign: "right" }}>กำลังส่ง</TableCell>
    <TableCell sx={{ ...headSx, textAlign: "right" }}>ในห้อง</TableCell>
    <TableCell sx={{ ...headSx, textAlign: "right" }}>ถาด</TableCell>
    {showSource && <TableCell sx={{ ...headSx, textAlign: "right" }}>จากห้องเย็น (kg)</TableCell>}
    {showSource && <TableCell sx={{ ...headSx, textAlign: "right" }}>จากจุดเตรียม (kg)</TableCell>}
    <TableCell sx={{ ...headSx, textAlign: "right" }}>น้ำหนักรวม (kg)</TableCell>
    <TableCell sx={{ ...headSx, textAlign: "center" }}>เลยกำหนด / ใกล้ / ในเวลา</TableCell>
  </>
);

export const MaterialTable = ({ materials, showSource }) => (
  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520, borderRadius: 3 }}>
    <Table stickyHeader size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={headSx}>รหัสวัตถุดิบ</TableCell>
          <TableCell sx={headSx}>ชื่อวัตถุดิบ</TableCell>
          <NumberHeads showSource={showSource} />
        </TableRow>
      </TableHead>
      <TableBody>
        {materials.length === 0 ? (
          <TableRow><TableCell colSpan={10} sx={{ ...cellSx, textAlign: "center", color: "#64748B", py: 3 }}>ไม่มีวัตถุดิบในห้องเย็นใหญ่</TableCell></TableRow>
        ) : materials.map((m) => (
          <TableRow key={m.mat} hover>
            <TableCell sx={{ ...cellSx, whiteSpace: "nowrap" }}>{m.mat}</TableCell>
            <TableCell sx={cellSx}>{m.mat_name}</TableCell>
            <NumberCells b={m} showSource={showSource} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

export const RoomTable = ({ rooms, showSource }) => (
  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520, borderRadius: 3 }}>
    <Table stickyHeader size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={headSx}>ห้อง</TableCell>
          <TableCell sx={{ ...headSx, textAlign: "right" }}>จำนวนวัตถุดิบ</TableCell>
          <NumberHeads showSource={showSource} />
        </TableRow>
      </TableHead>
      <TableBody>
        {rooms.length === 0 ? (
          <TableRow><TableCell colSpan={10} sx={{ ...cellSx, textAlign: "center", color: "#64748B", py: 3 }}>ไม่มีวัตถุดิบในห้องเย็นใหญ่</TableCell></TableRow>
        ) : rooms.map((r) => (
          <TableRow key={r.cs_name} hover sx={r.cs_id == null ? { backgroundColor: "#FFF7ED" } : undefined}>
            <TableCell sx={{ ...cellSx, whiteSpace: "nowrap" }}>{r.cs_name}</TableCell>
            <TableCell sx={numSx}>{r.rows}</TableCell>
            <NumberCells b={r} showSource={showSource} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

