import React, { useEffect, useMemo, useState } from "react";
import {
  Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";
import { ROOM_CONFIG } from "../../RoomMonitor/Asset/flow/largeRooms";
import { calculateCSDelayTime, formatTime, getLatestCsComeCold } from "../../RoomMonitor/Asset/csDelay";
import { STATUS_META, SOURCE_LABEL, formatKg } from "./buildStockSummary";

// what this viewer chose to see (this browser only): show the layout at all, rooms hidden, only rooms with trolleys
const PREFS_KEY = "stockSummary.layoutPrefs";
const DEFAULT_PREFS = { show: true, hidden: [], onlyUsed: true };
const loadPrefs = () => {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    if (!p || typeof p !== "object") return DEFAULT_PREFS;
    return {
      show: p.show !== false,
      hidden: Array.isArray(p.hidden) ? p.hidden.map(Number).filter(Number.isFinite) : [],
      onlyUsed: p.onlyUsed !== false,
    };
  } catch (err) {
    console.error("StockSummary layout prefs read error:", err);
    return DEFAULT_PREFS;
  }
};
const savePrefs = (prefs) => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (err) { console.error("StockSummary layout prefs save error:", err); }
};

const LARGE_ROOM_IDS = new Set(ROOM_CONFIG.map((r) => r.cs_id));
const naturalSort = (a, b) => String(a.slot_id).localeCompare(String(b.slot_id), "en", { numeric: true });

// the worst status of a trolley decides its colour: overdue first, then near the limit, then on time
const RANK = { red: 0, orange: 1, green: 2, nodcs: 3, wait: 4 };

const delayOf = (row) => {
  const d = calculateCSDelayTime(row);
  const key = d.noDcs ? "nodcs" : ["red", "orange", "green"].includes(d.color) ? d.color : "wait";
  return { key, message: d.statusMessage, minutes: typeof d.minutes === "number" ? d.minutes : null };
};

const worse = (a, b) => {
  if (RANK[a.key] !== RANK[b.key]) return RANK[a.key] < RANK[b.key] ? a : b;
  if (a.minutes === null) return b;
  if (b.minutes === null) return a;
  return a.minutes <= b.minutes ? a : b; // less time left / more time over
};

const shortText = (delay) => {
  if (delay.key === "nodcs") return "ไม่คำนวณ DCS";
  if (delay.key === "wait" || delay.minutes === null) return "รอดำเนินการ";
  if (delay.minutes < 0) return `เลย ${formatTime(-delay.minutes)}`;
  return `เหลือ ${formatTime(delay.minutes)}`;
};

const FONT = { fontFamily: "Prompt, Kanit, sans-serif" };

// minutes since the trolley came into the large room (latest cs_come_cold_date*), null when unknown
const minutesInRoom = (row) => {
  const t = getLatestCsComeCold(row);
  return t ? (Date.now() - t.getTime()) / 60000 : null;
};
const formatDateTime = (d) => (d ? d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-");

// slot ids of the large rooms are "<row letters><number>" (aaa1 ... aaa10, aab1 ...): one line per row like the room itself
const SLOT_RE = /^([^\d]+)(\d+)$/;
const toGrid = (tiles) => {
  const rowsByKey = new Map();
  let maxCol = 0;
  for (const t of tiles) {
    const m = SLOT_RE.exec(String(t.slot.slot_id));
    if (!m) return null; // another naming: plain grid
    const col = Number(m[2]);
    maxCol = Math.max(maxCol, col);
    if (!rowsByKey.has(m[1])) rowsByKey.set(m[1], []);
    rowsByKey.get(m[1]).push({ ...t, col });
  }
  if (maxCol > 20) return null;
  return { maxCol, lines: [...rowsByKey.entries()].map(([key, cells]) => ({ key, cells })) };
};

const EMPTY_LOOK = {
  free: { bg: "#FFFFFF", border: "#E2E8F0", color: "#94A3B8", text: "ว่าง" },
  reserved: { bg: "#FFF8E6", border: "#FDE2A7", color: "#B45309", text: "จองอยู่" },
  off: { bg: "#F1F5F9", border: "#E2E8F0", color: "#CBD5E1", text: "ปิดใช้งาน" },
  unknown: { bg: "#F8FAFC", border: "#CBD5E1", color: "#64748B", text: "ไม่มีข้อมูลวัตถุดิบ" },
};

const slotKind = (s, trolley) => {
  if (s.tro_id === "rsrv") return "reserved";
  if (s.tro_id) return trolley ? "trolley" : "unknown";
  if (s.slot_status === false || s.slot_status === 0) return "off";
  return "free";
};

const TrolleyTip = ({ trolley }) => (
  <div style={{ ...FONT, fontSize: 12 }}>
    <div style={{ fontWeight: 600 }}>รถเข็น {trolley.tro_id}</div>
    <div style={{ marginBottom: 4, opacity: 0.8 }}>กดเพื่อดูรายละเอียด</div>
    {trolley.items.map((it) => (
      <div key={it.row.mapping_id} style={{ marginBottom: 2 }}>
        {it.row.mat_name || it.row.mat} · {formatKg(it.row.weight_RM)} kg · {SOURCE_LABEL[it.row.source]} · {it.delay.message}
      </div>
    ))}
  </div>
);

const SlotTile = ({ slot, trolley, dimmed, onOpen }) => {
  const kind = slotKind(slot, trolley);
  if (kind !== "trolley") {
    const look = EMPTY_LOOK[kind];
    return (
      <div
        className="rounded-lg px-1.5 py-1 flex flex-col justify-center min-h-[92px]"
        style={{ backgroundColor: look.bg, border: `1px dashed ${look.border}`, color: look.color }}
      >
        <span className="text-[11px]">{slot.slot_id}</span>
        <span className="text-xs font-medium truncate">{kind === "unknown" ? slot.tro_id : look.text}</span>
        {kind === "unknown" && <span className="text-[10px]">{look.text}</span>}
      </div>
    );
  }
  const meta = STATUS_META[trolley.delay.key];
  const first = trolley.items[0].row;
  const weight = trolley.items.reduce((sum, it) => sum + (Number.parseFloat(it.row.weight_RM) || 0), 0);
  const stay = minutesInRoom(first);
  return (
    <Tooltip title={<TrolleyTip trolley={trolley} />} arrow>
      <button
        type="button"
        onClick={() => onOpen(trolley, slot)}
        className="w-full text-left rounded-lg px-1.5 py-1 flex flex-col justify-center min-h-[92px] leading-tight hover:shadow-md"
        style={{ backgroundColor: meta.bg, border: `2px solid ${meta.color}`, opacity: dimmed ? 0.3 : 1 }}
      >
        <span className="flex justify-between text-[11px] text-slate-500">
          <span>{slot.slot_id}</span>
          {trolley.items.length > 1 && <span>{trolley.items.length} รายการ</span>}
        </span>
        <span className="text-sm font-semibold text-slate-800 truncate">{trolley.tro_id}</span>
        <span className="text-[11px] text-slate-700 truncate">{first.mat_name || first.mat}</span>
        <span className="text-[11px] text-slate-500 tabular-nums">{formatKg(weight)} kg</span>
        {stay !== null && <span className="text-[11px] text-slate-500">{`อยู่ ${formatTime(stay)}`}</span>}
        <span className="text-[11px] font-semibold" style={{ color: meta.color }}>{shortText(trolley.delay)}</span>
      </button>
    </Tooltip>
  );
};

// every raw material on one trolley (closes from its own button only, as every dialog of the system)
const TrolleyDialog = ({ open, data, onClose }) => {
  if (!data) return null;
  const { trolley, slot, roomName } = data;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={FONT}>รถเข็น {trolley.tro_id} · {roomName} ช่อง {slot.slot_id}</DialogTitle>
      <DialogContent dividers sx={{ ...FONT, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {trolley.items.map(({ row, delay }) => {
          const meta = STATUS_META[delay.key];
          const stay = minutesInRoom(row);
          const fields = [
            ["รหัสวัตถุดิบ", row.mat],
            ["Batch", row.batch],
            ["แผนการผลิต", row.production],
            ["กลุ่ม", row.rm_group_name],
            ["น้ำหนัก (kg)", formatKg(row.weight_RM)],
            ["ถาด", row.tray_count],
            ["แหล่งที่มา", SOURCE_LABEL[row.source]],
            ["เข้าห้องเย็นใหญ่", formatDateTime(getLatestCsComeCold(row))],
            ["อยู่มาแล้ว", stay !== null ? formatTime(stay) : null],
            ["มาตรฐาน (ชม.)", row.standard_cold],
            ["สถานะ", row.rm_status],
            ["หมายเหตุ", row.remark],
            ["mapping_id", row.mapping_id],
          ];
          return (
            <div key={row.mapping_id} className="rounded-lg p-3" style={{ border: `2px solid ${meta.color}`, backgroundColor: meta.bg }}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-slate-800">{row.mat_name || row.mat || "-"}</span>
                <span className="font-semibold" style={{ color: meta.color }}>{delay.message}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                {fields.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <div className="text-[11px] text-slate-500">{label}</div>
                    <div className="text-sm text-slate-800 break-words">{value === null || value === undefined || value === "" ? "-" : value}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={FONT}>ปิด</Button>
      </DialogActions>
    </Dialog>
  );
};

// trolleys that need action first: overdue, then near the limit, the least time left first
const UrgentList = ({ items, onOpen }) => {
  if (items.length === 0) return null;
  const head = { ...FONT, fontWeight: 600, whiteSpace: "nowrap", backgroundColor: "#FEF2F2", py: 0.75 };
  const cell = { ...FONT, py: 0.5 };
  return (
    <div className="rounded-xl border border-red-200 bg-white shadow-sm p-3">
      <div className="mb-2 font-semibold text-slate-800">{`รถเข็นที่เลยกำหนด / ใกล้ครบกำหนด ${items.length} คัน`}</div>
      <TableContainer sx={{ maxHeight: 300 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {["สถานะ", "ห้อง", "ช่อง", "รถเข็น", "วัตถุดิบ", "น้ำหนัก (kg)", "เข้าห้องเย็นใหญ่"].map((h) => (
                <TableCell key={h} sx={head}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((u) => {
              const meta = STATUS_META[u.trolley.delay.key];
              const weight = u.trolley.items.reduce((sum, it) => sum + (Number.parseFloat(it.row.weight_RM) || 0), 0);
              return (
                <TableRow key={`${u.roomName}-${u.slot.slot_id}`} hover sx={{ cursor: "pointer" }} onClick={() => onOpen(u.trolley, u.slot, u.roomName)}>
                  <TableCell sx={{ ...cell, color: meta.color, fontWeight: 600, whiteSpace: "nowrap" }}>{shortText(u.trolley.delay)}</TableCell>
                  <TableCell sx={cell}>{u.roomName}</TableCell>
                  <TableCell sx={cell}>{u.slot.slot_id}</TableCell>
                  <TableCell sx={{ ...cell, fontWeight: 600 }}>{u.trolley.tro_id}</TableCell>
                  <TableCell sx={cell}>{u.trolley.items.map((it) => it.row.mat_name || it.row.mat).join(", ")}</TableCell>
                  <TableCell sx={{ ...cell, textAlign: "right" }}>{formatKg(weight)}</TableCell>
                  <TableCell sx={{ ...cell, whiteSpace: "nowrap" }}>{formatDateTime(getLatestCsComeCold(u.trolley.items[0].row))}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

const RoomGrid = ({ room, onOpen }) => {
  const grid = toGrid(room.tiles);
  const open = (trolley, slot) => onOpen(trolley, slot, room.cs_name);
  if (!grid) {
    return (
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
        {room.tiles.map((t) => <SlotTile key={t.slot.slot_id} slot={t.slot} trolley={t.trolley} dimmed={t.dimmed} onOpen={open} />)}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1.5 min-w-[900px]" style={{ gridTemplateColumns: `44px repeat(${grid.maxCol}, minmax(0, 1fr))` }}>
        {grid.lines.map((line) => (
          <React.Fragment key={line.key}>
            <div className="flex items-center justify-center text-xs font-semibold text-slate-400 uppercase">{line.key}</div>
            {Array.from({ length: grid.maxCol }, (_, i) => {
              const t = line.cells.find((c) => c.col === i + 1);
              return t
                ? <SlotTile key={t.slot.slot_id} slot={t.slot} trolley={t.trolley} dimmed={t.dimmed} onOpen={open} />
                : <div key={`${line.key}${i + 1}`} />;
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const CountPill = ({ k, n }) => (n > 0 ? (
  <span className="rounded-full px-2 text-xs font-semibold tabular-nums" style={{ color: STATUS_META[k].color, backgroundColor: STATUS_META[k].bg }}>
    {STATUS_META[k].label} {n}
  </span>
) : null);

/**
 * One layout per large cold room (cs_id 10 - 46): every slot of the room, a trolley coloured by its worst delay
 * (red = overdue, orange = near the limit, green = on time) with the time over / left.
 * rows: the rows of the page (with .source); slots: GET /api/coldstorage/room; source: the source filter of the page.
 */
const RoomLayouts = ({ rows, slots, source, tick }) => {
  const [prefs, setPrefs] = useState(loadPrefs);
  const { show, onlyUsed } = prefs;
  const hidden = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);

  useEffect(() => { savePrefs(prefs); }, [prefs]);

  const setShow = (e) => setPrefs((p) => ({ ...p, show: e.target.checked }));
  const setOnlyUsed = (e) => setPrefs((p) => ({ ...p, onlyUsed: e.target.checked }));
  const toggleRoom = (csId) => setPrefs((p) => ({
    ...p,
    hidden: p.hidden.includes(csId) ? p.hidden.filter((id) => id !== csId) : [...p.hidden, csId],
  }));
  const [detail, setDetail] = useState(null);
  const openDetail = (trolley, slot, roomName) => setDetail({ trolley, slot, roomName });
  const closeDetail = () => setDetail(null);
  const showAllRooms = () => setPrefs((p) => ({ ...p, hidden: [] }));
  const hideAllRooms = (ids) => () => setPrefs((p) => ({ ...p, hidden: [...new Set([...p.hidden, ...ids])] }));

  const rooms = useMemo(() => {
    const trolleys = new Map();
    rows.forEach((row) => {
      if (!row.tro_id) return;
      const key = String(row.tro_id);
      const delay = delayOf(row);
      const t = trolleys.get(key) || { tro_id: key, items: [], delay, sources: new Set() };
      t.items.push({ row, delay });
      t.delay = t.items.length === 1 ? delay : worse(t.delay, delay);
      t.sources.add(row.source);
      trolleys.set(key, t);
    });

    const byRoom = new Map();
    slots.forEach((s) => {
      if (!LARGE_ROOM_IDS.has(Number(s.cs_id))) return;
      if (!byRoom.has(Number(s.cs_id))) byRoom.set(Number(s.cs_id), []);
      byRoom.get(Number(s.cs_id)).push(s);
    });

    return ROOM_CONFIG.filter((r) => byRoom.has(r.cs_id)).map((r) => {
      const roomSlots = byRoom.get(r.cs_id).slice().sort(naturalSort);
      const count = { red: 0, orange: 0, green: 0, nodcs: 0, wait: 0 };
      let used = 0;
      const tiles = roomSlots.map((s) => {
        const trolley = s.tro_id && s.tro_id !== "rsrv" ? trolleys.get(String(s.tro_id)) : null;
        if (s.tro_id && s.tro_id !== "rsrv") used += 1;
        if (trolley) count[trolley.delay.key] += 1;
        const dimmed = !!trolley && source !== "all" && !trolley.sources.has(source);
        return { slot: s, trolley, dimmed };
      });
      const weight = tiles.reduce((sum, t) => sum + (t.trolley ? t.trolley.items.reduce((w, it) => w + (Number.parseFloat(it.row.weight_RM) || 0), 0) : 0), 0);
      return { ...r, tiles, used, count, weight };
    });
    // tick: the delay is recalculated every minute
  }, [rows, slots, source, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const choosable = onlyUsed ? rooms.filter((r) => r.used > 0) : rooms;
  const shown = choosable.filter((r) => !hidden.has(r.cs_id));

  // every overdue / near-limit trolley of every room (also the hidden ones: a hidden room must not hide a late trolley)
  const urgent = useMemo(() => {
    const list = [];
    rooms.forEach((r) => r.tiles.forEach((t) => {
      if (t.trolley && !t.dimmed && (t.trolley.delay.key === "red" || t.trolley.delay.key === "orange")) {
        list.push({ trolley: t.trolley, slot: t.slot, roomName: r.cs_name });
      }
    }));
    return list.sort((a, b) => RANK[a.trolley.delay.key] - RANK[b.trolley.delay.key] || (a.trolley.delay.minutes ?? 0) - (b.trolley.delay.minutes ?? 0));
  }, [rooms]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800">Layout แต่ละห้อง</h2>
          <FormControlLabel
            control={<Switch size="small" checked={show} onChange={setShow} />}
            label={<span className="text-sm">แสดง Layout</span>}
          />
        </div>
        {show && <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          {["red", "orange", "green"].map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: STATUS_META[k].bg, border: `2px solid ${STATUS_META[k].color}` }} />
              {STATUS_META[k].label}
            </span>
          ))}
          <FormControlLabel
            control={<Switch size="small" checked={onlyUsed} onChange={setOnlyUsed} />}
            label={<span className="text-sm">เฉพาะห้องที่มีรถเข็น</span>}
          />
        </div>}
      </div>

      {show && choosable.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-slate-500 mr-1">ห้องที่แสดง:</span>
          {choosable.map((r) => {
            const on = !hidden.has(r.cs_id);
            return (
              <Chip
                key={r.cs_id}
                size="small"
                label={r.count.red > 0 ? `${r.cs_name} (${r.count.red})` : r.cs_name}
                color={on ? "primary" : "default"}
                variant={on ? "filled" : "outlined"}
                onClick={() => toggleRoom(r.cs_id)}
                sx={{ fontFamily: "Prompt, Kanit, sans-serif", ...(r.count.red > 0 && !on ? { borderColor: STATUS_META.red.color, color: STATUS_META.red.color } : {}) }}
              />
            );
          })}
          <Button size="small" onClick={showAllRooms} sx={{ fontFamily: "Prompt, Kanit, sans-serif" }}>แสดงทุกห้อง</Button>
          <Button size="small" onClick={hideAllRooms(choosable.map((r) => r.cs_id))} sx={{ fontFamily: "Prompt, Kanit, sans-serif" }}>ซ่อนทุกห้อง</Button>
        </div>
      )}

      {show && <UrgentList items={urgent} onOpen={openDetail} />}

      {!show ? null : shown.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-8 text-center text-slate-500">{choosable.length === 0 ? "ไม่มีรถเข็นจอดในห้องเย็นใหญ่" : "ไม่ได้เลือกห้องที่จะแสดง"}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {shown.map((room) => (
            <div key={room.cs_id} className="rounded-xl border border-slate-200 bg-white shadow-sm p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800">{room.cs_name}</span>
                <span className="text-xs text-slate-500">ใช้ {room.used} / {room.tiles.length} ช่อง · {formatKg(room.weight)} kg</span>
                <span className="ml-auto flex flex-wrap gap-1">
                  <CountPill k="red" n={room.count.red} />
                  <CountPill k="orange" n={room.count.orange} />
                  <CountPill k="green" n={room.count.green} />
                </span>
              </div>
              <RoomGrid room={room} onOpen={openDetail} />
            </div>
          ))}
        </div>
      )}

      <TrolleyDialog open={!!detail} data={detail} onClose={closeDetail} />
    </section>
  );
};

export default RoomLayouts;
