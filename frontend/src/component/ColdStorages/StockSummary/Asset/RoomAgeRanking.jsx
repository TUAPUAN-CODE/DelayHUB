import React, { useMemo, useState } from "react";
import { FormControlLabel, Switch, Tooltip } from "@mui/material";
import { Hourglass } from "lucide-react";
import { CARD, FONT, TOKENS, SectionTitle, SegmentSwitch } from "./StockTheme";
import { STATUS_META, SOURCE_LABEL, formatKg } from "./buildStockSummary";
import { calculateCSDelayTime, formatTime, getLatestCsComeCold, isNoDcsRoom } from "../../RoomMonitor/Asset/csDelay";

const TOPS = [
  { value: 10, label: "10" },
  { value: 20, label: "20" },
  { value: 0, label: "ทั้งหมด" },
];

const statusKey = (row) => {
  const d = calculateCSDelayTime(row);
  if (d.noDcs) return "nodcs";
  return ["red", "orange", "green"].includes(d.color) ? d.color : "wait";
};

const Stat = ({ label, value, note, color }) => (
  <div className="min-w-0 rounded-xl px-3 py-2.5" style={{ backgroundColor: "#F7F9FE", border: `1px solid ${TOKENS.border}` }}>
    <div className="flex items-center gap-2 text-sm" style={{ color: TOKENS.muted }}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-1 truncate text-xl font-bold tabular-nums" style={{ color: TOKENS.text }}>{value ?? "-"}</div>
    {note && <div className="truncate text-xs" style={{ color: TOKENS.muted }}>{note}</div>}
  </div>
);

/**
 * The raw materials parked in the large cold rooms right now, the longest stay first (the ones already cleared are not here).
 * rows: the in-room rows of the page (fetchSlotRawMatsend + .source); time = now - the latest cs_come_cold_date*.
 * tick: re-render every minute. overdueNow: trolleys over their limit right now.
 */
const RoomAgeRanking = ({ rows, tick, overdueNow, className = "" }) => {
  const [top, setTop] = useState(10);
  const [withFreezer, setWithFreezer] = useState(false);

  const all = useMemo(() => {
    const now = Date.now();
    return rows
      .filter((r) => !r.isPending)
      .map((r) => {
        const since = getLatestCsComeCold(r);
        if (!since) return null;
        return { row: r, since, minutes: (now - since.getTime()) / 60000, key: statusKey(r), delay: calculateCSDelayTime(r) };
      })
      .filter(Boolean)
      .sort((a, b) => b.minutes - a.minutes);
  }, [rows, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = withFreezer ? all : all.filter((x) => !isNoDcsRoom(x.row));
  const shown = top ? list.slice(0, top) : list;
  const maxMin = shown.length ? shown[0].minutes : 1;
  const avg = list.length ? list.reduce((a, x) => a + x.minutes, 0) / list.length : null;
  const freezerCount = all.length - all.filter((x) => !isNoDcsRoom(x.row)).length;

  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      <SectionTitle icon={Hourglass} title="วัตถุดิบที่อยู่ในห้องเย็นใหญ่นานสุด" subtitle="เฉพาะที่ยังอยู่ในห้อง (เคลียร์ออกแล้วไม่แสดง) · เรียงจากนานสุด">
        <SegmentSwitch value={top} options={TOPS} onChange={setTop} />
      </SectionTitle>

      <div className="flex flex-1 flex-col px-4 py-4" style={CARD}>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Stat label="อยู่ในห้องตอนนี้" value={`${list.length} รายการ`} color={TOKENS.primary} note={withFreezer ? "รวมห้องที่ไม่คำนวณ DCS" : "เฉพาะห้องที่คำนวณ DCS"} />
          <Stat label="นานสุด" value={list[0] ? formatTime(list[0].minutes) : "-"} color="#EB6834" note={list[0] ? (list[0].row.mat_name || list[0].row.mat) : ""} />
          <Stat label="เฉลี่ย" value={avg != null ? formatTime(avg) : "-"} color={TOKENS.primary} note="ของที่อยู่ในห้องตอนนี้" />
          <Stat label="ค้างเกินเวลาอยู่ตอนนี้" value={`${overdueNow} คัน`} color="#DC2626" note="ยังอยู่ในห้องและเลยกำหนด" />
        </div>

        <div className="mt-4 mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: TOKENS.text }}>
            {["red", "orange", "green", "nodcs"].map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_META[k].color }} />
                {STATUS_META[k].label}
              </span>
            ))}
          </div>
          <FormControlLabel
            control={<Switch size="small" checked={withFreezer} onChange={(e) => setWithFreezer(e.target.checked)} />}
            label={<span className="text-sm">{`รวมห้องที่ไม่คำนวณ DCS (${freezerCount})`}</span>}
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-1" style={{ maxHeight: 420 }}>
          {shown.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: TOKENS.muted }}>ไม่มีวัตถุดิบในห้องเย็นใหญ่</div>
          ) : (
            <ol className="space-y-1.5">
              {shown.map((x, i) => {
                const meta = STATUS_META[x.key];
                const r = x.row;
                return (
                  <li key={r.mapping_id} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2">
                    <span
                      className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold tabular-nums"
                      style={i < 3 ? { backgroundColor: "#FFF1E6", color: "#C2410C" } : { backgroundColor: "#F1F5F9", color: TOKENS.muted }}
                    >
                      {i + 1}
                    </span>
                    <Tooltip
                      arrow
                      title={
                        <div style={{ ...FONT, fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{r.mat_name || r.mat}</div>
                          <div>{`รถเข็น ${r.tro_id} · ${r.cs_name || "-"} · ${formatKg(r.weight_RM)} kg · ${SOURCE_LABEL[r.source] || ""}`}</div>
                          <div>{`เข้า ${x.since.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · ${x.delay.statusMessage}`}</div>
                        </div>
                      }
                    >
                      <div className="min-w-0">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate" style={{ color: TOKENS.text }}>
                            <span className="font-semibold">{r.mat_name || r.mat}</span>
                            <span style={{ color: TOKENS.muted }}>{`  ·  ${r.tro_id} · ${r.cs_name || "-"}`}</span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums" style={{ color: TOKENS.text }}>{formatTime(x.minutes)}</span>
                        </div>
                        <div className="mt-1 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: "#EEF2F7" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(2, (x.minutes / maxMin) * 100)}%`, background: `linear-gradient(90deg, ${meta.bg}, ${meta.color})` }}
                          />
                        </div>
                      </div>
                    </Tooltip>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        {top > 0 && list.length > top && (
          <div className="mt-2 text-xs" style={{ color: TOKENS.muted }}>{`แสดง ${top} จาก ${list.length} รายการ`}</div>
        )}
      </div>
    </section>
  );
};

export default RoomAgeRanking;
