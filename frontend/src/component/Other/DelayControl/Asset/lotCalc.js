// Delay of a lot of the Role "Other".
//   outside the cold room: from "prepared" until the kg go into the cold room (limit 2 h) — what is not in yet keeps running until now
//   inside the cold room:  from the kg going in until they come out (limit 24 h) — kg that left in several steps are matched first-in-first-out
export const LIMIT_OUTSIDE_MIN = 120;
export const LIMIT_INSIDE_MIN = 24 * 60;
// lid of the container opened while in the cold room: from then on it must leave the cold room within 12 h
// (and still within the 24 h of the cold room) — the lid has to be opened within those 24 h
export const LIMIT_AFTER_LID_MIN = 12 * 60;
// after the cold room: packing must be done within what is left of the whole outside time (2 h before + 2 h after = 4 h),
// so time used before the cold room is taken from the time after it (used 1 h before -> 3 h left; used 3 h -> 1 h left)
export const LIMIT_OUTSIDE_TOTAL_MIN = 2 * LIMIT_OUTSIDE_MIN;

const ms = (s) => new Date(String(s).replace(" ", "T")).getTime();
const r2 = (n) => Math.round(n * 100) / 100;

/** green: more than 50% of the limit is left · yellow: some is left · red: used up */
export const levelOf = (minutes, limit) => {
  const left = ((limit - minutes) / limit) * 100;
  if (left > 50) return "green";
  if (left > 0) return "yellow";
  return "red";
};
/** outside time used before the cold room, packing time left after it, and the time packing must be done by */
const packWindow = (prep, inAt, outAt) => {
  const prepMin = Math.max(0, (inAt - prep) / 60000);
  const packLeftMin = Math.max(0, LIMIT_OUTSIDE_TOTAL_MIN - prepMin);
  return { prepAt: prep, prepMin, packLeftMin, packBy: outAt + packLeftMin * 60000 };
};
const RANK = { green: 0, yellow: 1, red: 2 };
/** cold room limit of kg that went in at inAt: 24 h, or until 12 h after the lid was opened (whichever comes first) */
export const coldLimitOf = (inAt, lidAt) => {
  if (lidAt === null || lidAt === undefined || Number.isNaN(lidAt)) return { limit: LIMIT_INSIDE_MIN, lidAt: null };
  const effLid = Math.max(lidAt, inAt);
  const deadline = Math.min(inAt + LIMIT_INSIDE_MIN * 60000, effLid + LIMIT_AFTER_LID_MIN * 60000);
  return { limit: Math.max(0, (deadline - inAt) / 60000), lidAt: effLid, deadline };
};

export const calcLot = (lot, now = Date.now()) => {
  const prep = ms(lot.prep_done_at);
  const lid = lot.lid_open_at ? ms(lot.lid_open_at) : null;
  const weight = Number(lot.weight_kg);
  const ins = lot.moves.filter((m) => m.kind === "IN").map((m) => ({ at: ms(m.moved_at), kg: Number(m.qty_kg) })).sort((a, b) => a.at - b.at);
  // OUT of a set ("จัดชุด" after the lid was opened) carries its set_id; every OUT chunk keeps the move_id it came from (the slip of that OUT)
  const outs = lot.moves.filter((m) => m.kind === "OUT").map((m) => ({ at: ms(m.moved_at), kg: Number(m.qty_kg), id: m.move_id ?? null, setId: m.set_id ?? null })).sort((a, b) => a.at - b.at || (a.id ?? 0) - (b.id ?? 0));

  const outsideChunks = ins.map((i) => ({ kg: i.kg, fromAt: prep, toAt: i.at, minutes: Math.max(0, (i.at - prep) / 60000), running: false }));
  const placed = ins.reduce((s, i) => s + i.kg, 0);
  const unplaced = Math.max(0, r2(weight - placed));
  if (unplaced > 0) outsideChunks.push({ kg: unplaced, fromAt: prep, toAt: null, minutes: Math.max(0, (now - prep) / 60000), running: true });

  // first-in-first-out: every OUT takes its kg from the oldest kg that are still in the cold room
  const queue = ins.map((i) => ({ ...i }));
  const coldChunks = [];
  outs.forEach((o) => {
    let need = o.kg;
    while (need > 1e-9 && queue.length) {
      const head = queue[0];
      const take = Math.min(head.kg, need);
      coldChunks.push({ kg: take, inAt: head.at, outAt: o.at, outMoveId: o.id, setId: o.setId, minutes: Math.max(0, (o.at - head.at) / 60000), running: false, ...packWindow(prep, head.at, o.at), ...coldLimitOf(head.at, lid !== null && lid <= o.at ? lid : null) });
      head.kg = r2(head.kg - take);
      need = r2(need - take);
      if (head.kg <= 1e-9) queue.shift();
    }
  });
  queue.forEach((q) => coldChunks.push({ kg: q.kg, inAt: q.at, outAt: null, outMoveId: null, setId: null, minutes: Math.max(0, (now - q.at) / 60000), running: true, ...coldLimitOf(q.at, lid) }));

  outsideChunks.forEach((c) => { c.level = levelOf(c.minutes, LIMIT_OUTSIDE_MIN); });
  coldChunks.forEach((c) => { c.level = c.limit > 0 ? levelOf(c.minutes, c.limit) : "red"; });

  const inCold = r2(queue.reduce((s, q) => s + q.kg, 0));
  const outKg = r2(outs.reduce((s, o) => s + o.kg, 0));
  const all = [...outsideChunks, ...coldChunks];
  const worst = all.reduce((w, c) => (RANK[c.level] > RANK[w] ? c.level : w), "green");
  const done = unplaced === 0 && inCold === 0;
  const oldest = (list) => list.filter((c) => c.running).reduce((m, c) => (c.minutes > (m?.minutes ?? -1) ? c : m), null);
  return { lid, weight, unplaced, inCold, outKg, outsideChunks, coldChunks, worst, done, runningOutside: oldest(outsideChunks), runningCold: oldest(coldChunks) };
};

/** ID of a set as people read it: <lot ID>-<set no> */
export const setCode = (lot, set) => `${lot.lot_id}-${set.set_no}`;

/**
 * The sets of a lot ("จัดชุด" after the lid was opened) with what each one means for the Delay:
 *   a set that left: the kg its OUT took (first in, first out) and the time packing must be done by
 *   a set still in the cold room: the oldest kg still in the cold room, in set order, and the time it must leave by
 * c = calcLot(lot, now) · returns { sets, kgSets (kg of the sets still in the cold room), unassigned (kg in the cold room in no set) }
 */
export const calcSets = (lot, c, now = Date.now()) => {
  const list = [...(lot.sets || [])].sort((a, b) => a.set_no - b.set_no);
  const queue = c.coldChunks.filter((k) => k.running).map((k) => ({ inAt: k.inAt, kg: k.kg })).sort((a, b) => a.inAt - b.inAt);
  const sets = list.map((s) => {
    const kg = Number(s.qty_kg);
    if (s.out_move_id) {
      const parts = c.coldChunks.filter((k) => k.outMoveId === s.out_move_id).map((k) => ({ kg: k.kg, inAt: k.inAt, packBy: k.packBy, packLeftMin: k.packLeftMin }));
      const tight = parts.reduce((m, p) => (!m || p.packBy < m.packBy ? p : m), null);
      return { ...s, kg, out: true, outAt: ms(s.out_at), parts, packBy: tight ? tight.packBy : null, packLeftMin: tight ? tight.packLeftMin : null };
    }
    const parts = [];
    let need = kg;
    while (need > 1e-9 && queue.length) {
      const head = queue[0];
      const take = Math.min(head.kg, need);
      parts.push({ kg: r2(take), inAt: head.inAt });
      head.kg = r2(head.kg - take);
      need = r2(need - take);
      if (head.kg <= 1e-9) queue.shift();
    }
    const firstIn = parts.length ? Math.min(...parts.map((p) => p.inAt)) : null;
    const deadline = parts.length ? Math.min(...parts.map((p) => coldLimitOf(p.inAt, c.lid).deadline ?? p.inAt + LIMIT_INSIDE_MIN * 60000)) : null;
    const limit = firstIn !== null ? Math.max(0, (deadline - firstIn) / 60000) : LIMIT_INSIDE_MIN;
    const minutes = firstIn !== null ? Math.max(0, (now - firstIn) / 60000) : 0;
    return { ...s, kg, out: false, parts, deadline, clock: { minutes, limit, lidAt: c.lid, level: limit > 0 ? levelOf(minutes, limit) : "red" } };
  });
  const kgSets = r2(sets.filter((s) => !s.out).reduce((t, s) => t + s.kg, 0));
  return { sets, kgSets, unassigned: Math.max(0, r2(c.inCold - kgSets)) };
};

/** "yyyy-MM-dd HH:mm:ss" (Thai time, as the server sends it) -> ms */
export const msOf = ms;

export const fmtMin = (min) => {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  return `${h ? `${h} h ` : ""}${m % 60} m`.trim();
};
/** minutes -> "1 ชม 5 นาที" (for the slip) */
export const fmtThaiMin = (min) => {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  if (!h) return `${m} นาที`;
  return m % 60 ? `${h} ชม ${m % 60} นาที` : `${h} ชม`;
};
const p = (n) => String(n).padStart(2, "0");
/** "2026-10-10 08:05:00" or ms -> "10/10/2026 08:05" (the year is always shown) */
export const fmtAt = (v) => {
  const d = new Date(typeof v === "number" ? v : String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? "-" : `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
/** Date -> value of <input type="datetime-local"> */
export const toLocalInput = (d = new Date()) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
