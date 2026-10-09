// Production lines grouped by the people who look after them. Each account sets its own groups in the column settings (saved in the grid prefs as
// ext.lineGroups = [{ id, name, owners: [name...], lines: [line_name...] }]). The line column dropdown lists the groups, and a click on a group header ticks all its lines.

export const LINE_PALETTE = [
  { color: "#FFFFFF", bg: "#0F766E", dot: "#0F766E" },
  { color: "#FFFFFF", bg: "#B45309", dot: "#B45309" },
  { color: "#FFFFFF", bg: "#7C3AED", dot: "#7C3AED" },
  { color: "#FFFFFF", bg: "#BE185D", dot: "#BE185D" },
  { color: "#FFFFFF", bg: "#0369A1", dot: "#0369A1" },
  { color: "#FFFFFF", bg: "#4D7C0F", dot: "#4D7C0F" },
];
const NO_GROUP = { id: "__none", title: "ยังไม่จัดกลุ่ม", color: "#6B7489", bg: "#E5E7EB", dot: "#9CA3AF", order: 9999 };

const cache = new WeakMap(); // lineGroups array -> Map(line name -> { zone, rank }) so a re-render does not rebuild it

const indexOf = (groups) => {
  let map = cache.get(groups);
  if (map) return map;
  map = new Map();
  groups.forEach((g, i) => {
    const pal = LINE_PALETTE[i % LINE_PALETTE.length];
    const owners = (g.owners || []).filter(Boolean);
    const zone = { id: g.id, title: `${g.name || "กลุ่ม"}${owners.length ? ` — ผู้ดูแล: ${owners.join(", ")}` : ""}`, ...pal, order: i };
    (g.lines || []).forEach((l) => { if (!map.has(l)) map.set(l, zone); });
  });
  cache.set(groups, map);
  return map;
};

/** { zone, rank } of a line name for the given groups (lines of no group come last) */
export const lineMeta = (line, groups) => {
  const zone = (groups?.length && indexOf(groups).get(line)) || NO_GROUP;
  return { zone, rank: zone.order * 1000 };
};

/** DataGrid prepareRows step: give every row the group of its line (same array when no group is defined) */
export const applyLineGroups = (rows, ext) => {
  const groups = ext?.lineGroups;
  if (!groups?.length) return rows;
  return rows.map((r) => ({ ...r, __lgroup: lineMeta(r.rmm_line_name, groups) }));
};
