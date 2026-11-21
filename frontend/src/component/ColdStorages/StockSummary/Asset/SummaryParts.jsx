import React from "react";
import {
  Paper, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Tooltip,
} from "@mui/material";
import { STATUS_META, SOURCE_COLD, SOURCE_PREP, formatKg } from "./buildStockSummary";
import { INK } from "./StockTheme";

const FONT = { fontFamily: "Prompt, Kanit, sans-serif" };

const StatusChips = ({ status }) => (
  <div className="flex flex-wrap justify-center gap-1">
    {["red", "orange", "green"].map((k) => (status[k] > 0 ? (
      <Tooltip key={k} title={STATUS_META[k].label}>
        <span
          className="rounded-full px-2 text-xs font-semibold tabular-nums"
          style={{ color: STATUS_META[k].color, backgroundColor: STATUS_META[k].bg }}
        >
          {status[k]}
        </span>
      </Tooltip>
    ) : null))}
  </div>
);

const headSx = { ...FONT, fontWeight: 500, backgroundColor: INK, color: "#E0F2FE", whiteSpace: "nowrap", py: 1.1, borderBottom: "none", letterSpacing: 0.2 };
const cellSx = { ...FONT, py: 0.85, borderBottomColor: "#EEF2F7" };
// the app theme paints every table head in the primary blue: this page uses its own dark head
const HEAD = { "& .MuiTableCell-root": { backgroundColor: INK, color: "#E0F2FE", fontWeight: 500, borderBottom: "none" } };
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
  <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 520, borderRadius: 4, border: "1px solid #E2E8F0", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
    <Table stickyHeader size="small">
      <TableHead sx={HEAD}>
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
  <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 520, borderRadius: 4, border: "1px solid #E2E8F0", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
    <Table stickyHeader size="small">
      <TableHead sx={HEAD}>
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

