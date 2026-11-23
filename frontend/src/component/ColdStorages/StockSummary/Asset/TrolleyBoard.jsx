import React, { useEffect, useMemo, useState } from "react";
import {
  Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";
import { Truck, TriangleAlert, Snowflake } from "lucide-react";
import { ROOM_CONFIG } from "../../RoomMonitor/Asset/flow/largeRooms";
import { calculateCSDelayTime, formatTime, getLatestCsComeCold } from "../../RoomMonitor/Asset/csDelay";
import { STATUS_META, SOURCE_LABEL, TRANSIT_ROOM, formatKg } from "./buildStockSummary";
import { CARD, FONT, TOKENS, SectionTitle } from "./StockTheme";

// what this viewer chose to see (this browser only): the section at all, and the rooms hidden
const PREFS_KEY = "stockSummary.layoutPrefs";
const TRANSIT_KEY = "transit";
const loadPrefs = () => {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    if (!p || typeof p !== "object") return { show: true, hidden: [] };
    return { show: p.show !== false, hidden: Array.isArray(p.hidden) ? p.hidden.map(String) : [] };
  } catch (err) {
    console.error("StockSummary trolley prefs read error:", err);
    return { show: true, hidden: [] };
  }
};
const savePrefs = (prefs) => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (err) { console.error("StockSummary trolley prefs save error:", err); }
};

const ROOM_ORDER = new Map(ROOM_CONFIG.map((r, i) => [r.cs_id, i]));

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
const byUrgency = (a, b) => RANK[a.delay.key] - RANK[b.delay.key] || (a.delay.minutes ?? Infinity) - (b.delay.minutes ?? Infinity);

const shortText = (delay) => {
  if (delay.key === "nodcs") return "ไม่คำนวณ DCS";
  if (delay.key === "wait" || delay.minutes === null) return "รอดำเนินการ";
  if (delay.minutes < 0) return `เลย ${formatTime(-delay.minutes)}`;
  return `เหลือ ${formatTime(delay.minutes)}`;
};

// minutes since the trolley came into the large room (latest cs_come_cold_date*), null when unknown
const minutesInRoom = (row) => {
  const t = getLatestCsComeCold(row);
  return t ? (Date.now() - t.getTime()) / 60000 : null;
};
const formatDateTime = (d) => (d ? d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-");
const trolleyWeight = (t) => t.items.reduce((sum, it) => sum + (Number.parseFloat(it.row.weight_RM) || 0), 0);

const TrolleyCard = ({ trolley, onOpen }) => {
  const meta = STATUS_META[trolley.delay.key];
  const first = trolley.items[0].row;
  const stay = minutesInRoom(first);
  const names = [...new Set(trolley.items.map((it) => it.row.mat_name || it.row.mat))].join(", ");
  return (
    <Tooltip title="กดเพื่อดูรายละเอียด" arrow>
      <button
        type="button"
        onClick={() => onOpen(trolley)}
        className="relative w-full min-w-0 overflow-hidden rounded-xl bg-white py-2 pl-3 pr-2 text-left transition hover:-translate-y-0.5 hover:shadow-md"
        style={{ border: `1px solid ${TOKENS.border}` }}
      >
        <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: meta.color }} />
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <Truck size={15} style={{ color: TOKENS.muted }} className="shrink-0" />
            <span className="truncate font-semibold tabular-nums" style={{ color: TOKENS.text }}>{trolley.tro_id}</span>
          </span>
          {trolley.slot_id && <span className="shrink-0 text-xs" style={{ color: TOKENS.muted }}>ช่อง {trolley.slot_id}</span>}
        </div>
        <div className="mt-0.5 truncate text-sm" style={{ color: TOKENS.text }}>{names}</div>
        <div className="truncate text-xs" style={{ color: TOKENS.muted }}>
          {formatKg(trolleyWeight(trolley))} kg
          {trolley.items.length > 1 ? ` · ${trolley.items.length} รายการ` : ""}
          {stay !== null ? ` · อยู่ ${formatTime(stay)}` : ""}
        </div>
        <span
          className="mt-1.5 inline-block rounded-md px-2 py-0.5 text-xs font-semibold"
          style={{ color: meta.color, backgroundColor: meta.bg }}
        >
          {shortText(trolley.delay)}
        </span>
      </button>
    </Tooltip>
  );
};

// every raw material on one trolley (closes from its own button only, as every dialog of the system)
const TrolleyDialog = ({ trolley, onClose }) => {
  if (!trolley) return null;
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={FONT}>
        รถเข็น {trolley.tro_id} · {trolley.roomName}{trolley.slot_id ? ` ช่อง ${trolley.slot_id}` : ""}
      </DialogTitle>
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
            <div key={row.mapping_id} className="rounded-xl p-3" style={{ border: `1px solid ${TOKENS.border}`, borderLeft: `4px solid ${meta.color}` }}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold" style={{ color: TOKENS.text }}>{row.mat_name || row.mat || "-"}</span>
                <span className="rounded-md px-2 py-0.5 text-sm font-semibold" style={{ color: meta.color, backgroundColor: meta.bg }}>{delay.message}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                {fields.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <div className="text-[11px]" style={{ color: TOKENS.muted }}>{label}</div>
                    <div className="break-words text-sm" style={{ color: TOKENS.text }}>{value === null || value === undefined || value === "" ? "-" : value}</div>
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

// overdue / near-limit trolleys of every room, the least time left first
const UrgentList = ({ items, onOpen }) => {
  if (items.length === 0) return null;
  const head = { ...FONT, whiteSpace: "nowrap", py: 0.75 };
  const cell = { ...FONT, py: 0.5 };
  return (
    <div className="overflow-hidden" style={CARD}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ color: STATUS_META.red.color, borderBottom: `1px solid ${TOKENS.border}` }}>
        <TriangleAlert size={18} />
        <span className="text-base font-bold">{`รถเข็นที่เลยกำหนด / ใกล้ครบกำหนด ${items.length} คัน`}</span>
      </div>
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
            {items.map((t) => (
              <TableRow key={t.tro_id} hover sx={{ cursor: "pointer" }} onClick={() => onOpen(t)}>
                <TableCell sx={{ ...cell, color: STATUS_META[t.delay.key].color, fontWeight: 600, whiteSpace: "nowrap" }}>{shortText(t.delay)}</TableCell>
                <TableCell sx={cell}>{t.roomName}</TableCell>
                <TableCell sx={cell}>{t.slot_id || "-"}</TableCell>
                <TableCell sx={{ ...cell, fontWeight: 600 }}>{t.tro_id}</TableCell>
                <TableCell sx={cell}>{t.items.map((it) => it.row.mat_name || it.row.mat).join(", ")}</TableCell>
                <TableCell sx={{ ...cell, textAlign: "right" }}>{formatKg(trolleyWeight(t))}</TableCell>
                <TableCell sx={{ ...cell, whiteSpace: "nowrap" }}>{formatDateTime(getLatestCsComeCold(t.items[0].row))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

const CountPill = ({ k, n }) => (n > 0 ? (
  <span className="rounded-full px-2 text-xs font-semibold tabular-nums" style={{ color: STATUS_META[k].color, backgroundColor: STATUS_META[k].bg }}>
    {STATUS_META[k].label} {n}
  </span>
) : null);

/**
 * The trolleys that are in (or on the way to) the large cold rooms, one card per room, the most urgent first.
 * Only real trolleys are shown (no empty slots). rows: the rows of the page (with .source);
 * slots: GET /api/coldstorage/room (only to know the slot of a trolley); source: the source filter of the page.
 */
const TrolleyBoard = ({ rows, slots, source, tick }) => {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [detail, setDetail] = useState(null);
  const hidden = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);

  useEffect(() => { savePrefs(prefs); }, [prefs]);

  const setShow = (e) => setPrefs((p) => ({ ...p, show: e.target.checked }));
  const toggleRoom = (key) => setPrefs((p) => ({
    ...p,
    hidden: p.hidden.includes(key) ? p.hidden.filter((k) => k !== key) : [...p.hidden, key],
  }));
  const showAllRooms = () => setPrefs((p) => ({ ...p, hidden: [] }));
  const hideAllRooms = (keys) => () => setPrefs((p) => ({ ...p, hidden: [...new Set([...p.hidden, ...keys])] }));

  const rooms = useMemo(() => {
    const slotOf = new Map();
    slots.forEach((s) => { if (s.tro_id && s.tro_id !== "rsrv") slotOf.set(String(s.tro_id), s.slot_id); });

    const trolleys = new Map();
    rows.forEach((row) => {
      if (!row.tro_id || (source !== "all" && row.source !== source)) return;
      const key = String(row.tro_id);
      const delay = delayOf(row);
      if (!trolleys.has(key)) {
        const inRoom = row.cs_name && !row.isPending;
        trolleys.set(key, {
          tro_id: key,
          items: [],
          delay,
          slot_id: slotOf.get(key) || null,
          roomKey: inRoom ? String(row.cs_id) : TRANSIT_KEY,
          roomName: inRoom ? row.cs_name : TRANSIT_ROOM,
          cs_id: inRoom ? Number(row.cs_id) : null,
        });
      }
      const t = trolleys.get(key);
      t.items.push({ row, delay });
      t.delay = t.items.length === 1 ? delay : worse(t.delay, delay);
    });

    const groups = new Map();
    trolleys.forEach((t) => {
      if (!groups.has(t.roomKey)) groups.set(t.roomKey, { key: t.roomKey, name: t.roomName, cs_id: t.cs_id, trolleys: [] });
      groups.get(t.roomKey).trolleys.push(t);
    });
    return [...groups.values()]
      .map((g) => {
        const count = { red: 0, orange: 0, green: 0, nodcs: 0, wait: 0 };
        g.trolleys.forEach((t) => { count[t.delay.key] += 1; });
        return { ...g, trolleys: g.trolleys.sort(byUrgency), count, weight: g.trolleys.reduce((s, t) => s + trolleyWeight(t), 0) };
      })
      .sort((a, b) => {
        if (a.cs_id == null) return 1; // the trolleys on the way last
        if (b.cs_id == null) return -1;
        return (ROOM_ORDER.get(a.cs_id) ?? a.cs_id) - (ROOM_ORDER.get(b.cs_id) ?? b.cs_id);
      });
    // tick: the delay is recalculated every minute
  }, [rows, slots, source, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // every overdue / near-limit trolley (also in a hidden room: hiding a room must not hide a late trolley)
  const urgent = useMemo(
    () => rooms.flatMap((r) => r.trolleys.filter((t) => t.delay.key === "red" || t.delay.key === "orange")).sort(byUrgency),
    [rooms],
  );

  const shown = rooms.filter((r) => !hidden.has(r.key));

  return (
    <section className="space-y-3">
      <SectionTitle icon={Truck} title="รถเข็นในห้องเย็นใหญ่">
        <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: TOKENS.muted }}>
          {["red", "orange", "green"].map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_META[k].color }} />
              {STATUS_META[k].label}
            </span>
          ))}
          <FormControlLabel
            control={<Switch size="small" checked={prefs.show} onChange={setShow} />}
            label={<span className="text-sm">แสดงรถเข็น</span>}
          />
        </div>
      </SectionTitle>

      {prefs.show && rooms.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm" style={{ color: TOKENS.muted }}>ห้องที่แสดง:</span>
          {rooms.map((r) => {
            const on = !hidden.has(r.key);
            return (
              <Chip
                key={r.key}
                size="small"
                label={`${r.name} (${r.trolleys.length})`}
                color={on ? "primary" : "default"}
                variant={on ? "filled" : "outlined"}
                onClick={() => toggleRoom(r.key)}
                sx={{ ...FONT, ...(r.count.red > 0 && !on ? { borderColor: STATUS_META.red.color, color: STATUS_META.red.color } : {}) }}
              />
            );
          })}
          <Button size="small" onClick={showAllRooms} sx={FONT}>แสดงทุกห้อง</Button>
          <Button size="small" onClick={hideAllRooms(rooms.map((r) => r.key))} sx={FONT}>ซ่อนทุกห้อง</Button>
        </div>
      )}

      {prefs.show && <UrgentList items={urgent} onOpen={setDetail} />}

      {!prefs.show ? null : shown.length === 0 ? (
        <div className="py-10 text-center" style={{ ...CARD, color: TOKENS.muted }}>
          {rooms.length === 0 ? "ไม่มีรถเข็นในห้องเย็นใหญ่" : "ไม่ได้เลือกห้องที่จะแสดง"}
        </div>
      ) : (
        // rooms side by side, each as wide as its trolleys need (a room with one trolley takes one card's width, not half the page)
        <div className="flex flex-wrap items-start gap-3">
          {shown.map((room) => (
            <div
              key={room.key}
              className="min-w-0 max-w-full overflow-hidden"
              style={{ ...CARD, flexGrow: room.trolleys.length, flexBasis: `${Math.min(room.trolleys.length, 4) * 206 + 26}px` }}
            >
              <div className="flex flex-wrap items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ backgroundColor: TOKENS.primarySoft, color: TOKENS.primary }}>
                  <Snowflake size={16} />
                </span>
                <div className="min-w-0">
                  <div className="text-base font-bold leading-tight" style={{ color: TOKENS.text }}>{room.name}</div>
                  <div className="text-xs" style={{ color: TOKENS.muted }}>{`รถเข็น ${room.trolleys.length} คัน · ${formatKg(room.weight)} kg`}</div>
                </div>
                <span className="ml-auto flex flex-wrap gap-1">
                  <CountPill k="red" n={room.count.red} />
                  <CountPill k="orange" n={room.count.orange} />
                  <CountPill k="green" n={room.count.green} />
                </span>
              </div>
              <div className="grid max-h-[560px] gap-2 overflow-y-auto p-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
                {room.trolleys.map((t) => <TrolleyCard key={t.tro_id} trolley={t} onOpen={setDetail} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      <TrolleyDialog trolley={detail} onClose={() => setDetail(null)} />
    </section>
  );
};

export default TrolleyBoard;
