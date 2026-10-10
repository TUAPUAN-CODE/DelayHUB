// Delay of a lot of the Role "Other".
//   outside the cold room: from "prepared" until the kg go into the cold room (limit 2 h) — what is not in yet keeps running until now
//   inside the cold room:  from the kg going in until they come out (limit 24 h) — kg that left in several steps are matched first-in-first-out
export const LIMIT_OUTSIDE_MIN = 120;
export const LIMIT_INSIDE_MIN = 24 * 60;

const ms = (s) => new Date(String(s).replace(" ", "T")).getTime();
const r2 = (n) => Math.round(n * 100) / 100;

/** green: more than 50% of the limit is left · yellow: some is left · red: used up */
export const levelOf = (minutes, limit) => {
  const left = ((limit - minutes) / limit) * 100;
  if (left > 50) return "green";
  if (left > 0) return "yellow";
  return "red";
};
const RANK = { green: 0, yellow: 1, red: 2 };

export const calcLot = (lot, now = Date.now()) => {
  const prep = ms(lot.prep_done_at);
  const weight = Number(lot.weight_kg);
  const ins = lot.moves.filter((m) => m.kind === "IN").map((m) => ({ at: ms(m.moved_at), kg: Number(m.qty_kg) })).sort((a, b) => a.at - b.at);
  const outs = lot.moves.filter((m) => m.kind === "OUT").map((m) => ({ at: ms(m.moved_at), kg: Number(m.qty_kg) })).sort((a, b) => a.at - b.at);

  const outsideChunks = ins.map((i) => ({ kg: i.kg, minutes: Math.max(0, (i.at - prep) / 60000), running: false }));
  const placed = ins.reduce((s, i) => s + i.kg, 0);
  const unplaced = Math.max(0, r2(weight - placed));
  if (unplaced > 0) outsideChunks.push({ kg: unplaced, minutes: Math.max(0, (now - prep) / 60000), running: true });

  // first-in-first-out: every OUT takes its kg from the oldest kg that are still in the cold room
  const queue = ins.map((i) => ({ ...i }));
  const coldChunks = [];
  outs.forEach((o) => {
    let need = o.kg;
    while (need > 1e-9 && queue.length) {
      const head = queue[0];
      const take = Math.min(head.kg, need);
      coldChunks.push({ kg: take, inAt: head.at, outAt: o.at, minutes: Math.max(0, (o.at - head.at) / 60000), running: false });
      head.kg = r2(head.kg - take);
      need = r2(need - take);
      if (head.kg <= 1e-9) queue.shift();
    }
  });
  queue.forEach((q) => coldChunks.push({ kg: q.kg, inAt: q.at, outAt: null, minutes: Math.max(0, (now - q.at) / 60000), running: true }));

  outsideChunks.forEach((c) => { c.level = levelOf(c.minutes, LIMIT_OUTSIDE_MIN); });
  coldChunks.forEach((c) => { c.level = levelOf(c.minutes, LIMIT_INSIDE_MIN); });

  const inCold = r2(queue.reduce((s, q) => s + q.kg, 0));
  const outKg = r2(outs.reduce((s, o) => s + o.kg, 0));
  const all = [...outsideChunks, ...coldChunks];
  const worst = all.reduce((w, c) => (RANK[c.level] > RANK[w] ? c.level : w), "green");
  const done = unplaced === 0 && inCold === 0;
  const oldest = (list) => list.filter((c) => c.running).reduce((m, c) => (c.minutes > (m?.minutes ?? -1) ? c : m), null);
  return { weight, unplaced, inCold, outKg, outsideChunks, coldChunks, worst, done, runningOutside: oldest(outsideChunks), runningCold: oldest(coldChunks) };
};

export const fmtMin = (min) => {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  return `${h ? `${h} h ` : ""}${m % 60} m`.trim();
};
const p = (n) => String(n).padStart(2, "0");
/** "2026-10-10 08:05:00" or ms -> "10/10/2026 08:05" (the year is always shown) */
export const fmtAt = (v) => {
  const d = new Date(typeof v === "number" ? v : String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? "-" : `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
/** Date -> value of <input type="datetime-local"> */
export const toLocalInput = (d = new Date()) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
