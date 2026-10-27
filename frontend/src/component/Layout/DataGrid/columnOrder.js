// Order of the columns of a DataGrid (no imports: unit-tested by tests/gridColumns.test.mjs)

/**
 * Order of the visible columns of a grid. list = the visible columns in the order the account saved them, each with `frozen`: the frozen ones come first,
 * in that order. The rest keep the saved order, or (mode 'registry') follow the column settings list: group by group (order of `groups`),
 * inside a group in the order of `columns` — a column of a group that is not in `groups` goes last.
 */
export const arrangeColumns = (list, mode, columns, groups) => {
  const frozen = list.filter((c) => c.frozen);
  const rest = list.filter((c) => !c.frozen);
  if (mode === "registry") {
    const groupAt = new Map((groups || []).map((g, i) => [g.key, i]));
    const rank = new Map(columns.map((c, i) => [c.key, (groupAt.has(c.group) ? groupAt.get(c.group) : groupAt.size) * 100000 + i]));
    rest.sort((a, b) => rank.get(a.key) - rank.get(b.key));
  }
  return [...frozen, ...rest];
};
