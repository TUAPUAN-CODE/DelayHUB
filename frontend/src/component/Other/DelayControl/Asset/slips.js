// What each slip of a lot shows: who / what at the top, then one row per time stamp of the lot (เตรียมเสร็จ, เข้าห้องเย็น, เปิดฝา, จัดชุด, ออกห้องเย็น)
// and the deadline that matters next. A slip = { key, title, code, lot, kg, rows: [{ label, at, note? }], by } — rendered by LotSlip.jsx
import { msOf, setCode } from "./lotCalc";

const row = (label, at, note) => (at === null || at === undefined || at === "" ? null : { label, at, note });
// the kg of a slip may have gone into the cold room in several steps: one row per step then
const inRows = (parts) => {
  const times = [...new Set(parts.map((p) => p.inAt))];
  if (times.length <= 1) return [row("เข้าห้องเย็น", times[0])];
  return parts.map((p) => row(`เข้าห้องเย็น (${p.kg} kg)`, p.inAt));
};
const packRow = (packBy, packLeftMin) => row("ต้องบรรจุเสร็จภายใน", packBy, packLeftMin !== null && packLeftMin !== undefined && packLeftMin <= 0 ? "ไม่เหลือเวลา" : undefined);
const clean = (rows) => rows.filter(Boolean);

/** slip of one "เข้าห้องเย็น" stamp */
export const inSlip = (lot, move) => ({
  key: `in-${move.move_id}`,
  title: "สลิปเข้าห้องเย็น",
  code: `#${lot.lot_id}`,
  lot,
  kg: Number(move.qty_kg),
  rows: clean([row("เตรียมเสร็จ", lot.prep_done_at), row("เข้าห้องเย็น", move.moved_at)]),
  by: move.created_by,
});

/** slip of a set: before it leaves = "ชุดย่อย" (must leave by) · after = "ออกห้องเย็น" (must be packed by). set = an item of calcSets().sets */
export const setSlip = (lot, set) => ({
  key: `set-${set.set_id}-${set.out ? "out" : "in"}`,
  title: set.out ? "สลิปออกห้องเย็น" : "สลิปชุดย่อย",
  code: setCode(lot, set),
  lot,
  kg: set.kg,
  rows: clean([
    row("เตรียมเสร็จ", lot.prep_done_at),
    ...inRows(set.parts),
    row("เปิดฝา", lot.lid_open_at),
    row("จัดชุด", set.made_at),
    ...(set.out ? [row("ออกห้องเย็น", set.out_at), packRow(set.packBy, set.packLeftMin)] : [row("ต้องออกห้องเย็นภายใน", set.deadline)]),
  ]),
  by: set.out ? set.out_by || set.created_by : set.created_by,
});

/** slip of an OUT of the whole lot (before the lid was opened — afterwards the kg leave by set). c = calcLot(lot) */
export const outSlip = (lot, c, moveId) => {
  const chunks = c.coldChunks.filter((k) => k.outMoveId === moveId);
  const move = lot.moves.find((m) => m.move_id === moveId);
  const outAt = move ? msOf(move.moved_at) : chunks[0]?.outAt;
  const tight = chunks.reduce((m, k) => (!m || k.packBy < m.packBy ? k : m), null);
  return {
    key: `out-${moveId}`,
    title: "สลิปออกห้องเย็น",
    code: `#${lot.lot_id}`,
    lot,
    kg: Math.round(chunks.reduce((s, k) => s + k.kg, 0) * 100) / 100,
    rows: clean([
      row("เตรียมเสร็จ", lot.prep_done_at),
      ...inRows(chunks),
      lot.lid_open_at && msOf(lot.lid_open_at) <= outAt ? row("เปิดฝา", lot.lid_open_at) : null,
      row("ออกห้องเย็น", outAt),
      tight ? packRow(tight.packBy, tight.packLeftMin) : null,
    ]),
    by: move?.created_by,
  };
};
