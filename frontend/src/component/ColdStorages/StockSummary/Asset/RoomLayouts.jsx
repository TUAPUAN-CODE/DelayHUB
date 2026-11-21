import React, { useMemo, useState } from "react";
import { FormControlLabel, Switch, Tooltip } from "@mui/material";
import { ROOM_CONFIG } from "../../RoomMonitor/Asset/flow/largeRooms";
import { calculateCSDelayTime, formatTime } from "../../RoomMonitor/Asset/csDelay";
import { STATUS_META, SOURCE_LABEL, formatKg } from "./buildStockSummary";

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
  <div style={{ fontFamily: "Prompt, Kanit, sans-serif", fontSize: 12 }}>
    <div style={{ fontWeight: 600, marginBottom: 4 }}>รถเข็น {trolley.tro_id}</div>
    {trolley.items.map((it) => (
      <div key={it.row.mapping_id} style={{ marginBottom: 2 }}>
        {it.row.mat_name || it.row.mat} · {formatKg(it.row.weight_RM)} kg · {SOURCE_LABEL[it.row.source]} · {it.delay.message}
      </div>
    ))}
  </div>
);

const SlotTile = ({ slot, trolley, dimmed }) => {
  const kind = slotKind(slot, trolley);
  if (kind !== "trolley") {
    const look = EMPTY_LOOK[kind];
    return (
      <div
        className="rounded-lg px-1.5 py-1 flex flex-col justify-center min-h-[64px]"
        style={{ backgroundColor: look.bg, border: `1px dashed ${look.border}`, color: look.color }}
      >
        <span className="text-[11px]">{slot.slot_id}</span>
        <span className="text-xs font-medium truncate">{kind === "unknown" ? slot.tro_id : look.text}</span>
        {kind === "unknown" && <span className="text-[10px]">{look.text}</span>}
      </div>
    );
  }
  const meta = STATUS_META[trolley.delay.key];
  return (
    <Tooltip title={<TrolleyTip trolley={trolley} />} arrow>
      <div
        className="rounded-lg px-1.5 py-1 flex flex-col justify-center min-h-[64px] cursor-default"
        style={{ backgroundColor: meta.bg, border: `2px solid ${meta.color}`, opacity: dimmed ? 0.3 : 1 }}
      >
        <span className="text-[11px] text-slate-500">{slot.slot_id}</span>
        <span className="text-sm font-semibold text-slate-800 truncate">{trolley.tro_id}</span>
        <span className="text-[11px] font-semibold leading-tight" style={{ color: meta.color }}>{shortText(trolley.delay)}</span>
      </div>
    </Tooltip>
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
  const [onlyUsed, setOnlyUsed] = useState(true);

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
      return { ...r, tiles, used, count };
    });
    // tick: the delay is recalculated every minute
  }, [rows, slots, source, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = onlyUsed ? rooms.filter((r) => r.used > 0) : rooms;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Layout แต่ละห้อง</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          {["red", "orange", "green"].map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: STATUS_META[k].bg, border: `2px solid ${STATUS_META[k].color}` }} />
              {STATUS_META[k].label}
            </span>
          ))}
          <FormControlLabel
            control={<Switch size="small" checked={onlyUsed} onChange={(e) => setOnlyUsed(e.target.checked)} />}
            label={<span className="text-sm">เฉพาะห้องที่มีรถเข็น</span>}
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-8 text-center text-slate-500">ไม่มีรถเข็นจอดในห้องเย็นใหญ่</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {shown.map((room) => (
            <div key={room.cs_id} className="rounded-xl border border-slate-200 bg-white shadow-sm p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800">{room.cs_name}</span>
                <span className="text-xs text-slate-500">ใช้ {room.used} / {room.tiles.length} ช่อง</span>
                <span className="ml-auto flex flex-wrap gap-1">
                  <CountPill k="red" n={room.count.red} />
                  <CountPill k="orange" n={room.count.orange} />
                  <CountPill k="green" n={room.count.green} />
                </span>
              </div>
              <div className="grid gap-1.5 max-h-[420px] overflow-y-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}>
                {room.tiles.map((t) => (
                  <SlotTile key={t.slot.slot_id} slot={t.slot} trolley={t.trolley} dimmed={t.dimmed} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default RoomLayouts;
