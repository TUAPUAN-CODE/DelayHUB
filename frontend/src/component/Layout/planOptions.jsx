// Production plan Autocomplete (the list of /api/fetchProduction), spread into the <Autocomplete>: {...PLAN_OPTION_PROPS}
//  - the same code + doc_no exists once per line type (e.g. "M251" can / cup): the label shows the line type and the option key is prod_id
//    (MUI keys the options by their label: two options with the same label left stale rows in the list while typing,
//    so typing a code brought up other codes)
//  - the typed words match code / doc_no / line type in any order: exact code / doc_no first, then starts with, then contains;
//    the plans linked to the material (prod_rm_id) before the others; at most PLAN_LIMIT options are drawn (type to find the rest)
const PLAN_LIMIT = 300;

const norm = (v) => String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export const planLabel = (p) => {
  if (!p) return "";
  const type = p.line_type_name ? ` - ${p.line_type_name}` : "";
  return `${p.code ?? ""} (${p.doc_no ?? ""}${type})`;
};

const isLinked = (p) => p.prod_rm_id !== null && p.prod_rm_id !== undefined;

const rankOf = (p, q) => {
  const code = norm(p.code);
  const doc = norm(p.doc_no);
  if (code === q || doc === q) return 0;
  if (code.startsWith(q) || doc.startsWith(q)) return 1;
  return 2;
};

export const filterPlans = (options, { inputValue }) => {
  const q = norm(inputValue);
  if (!q) return options.slice(0, PLAN_LIMIT);
  const words = q.split(" ");
  const hits = [];
  options.forEach((p, i) => {
    const hay = `${norm(p.code)} ${norm(p.doc_no)} ${norm(p.line_type_name)}`;
    if (words.every((w) => hay.includes(w))) hits.push({ p, i, rank: rankOf(p, q), linked: isLinked(p) ? 0 : 1 });
  });
  hits.sort((a, b) => a.rank - b.rank || a.linked - b.linked || a.i - b.i);
  return hits.slice(0, PLAN_LIMIT).map((h) => h.p);
};

const LINKED_TAG = { marginLeft: "auto", paddingLeft: 8, fontSize: 11, fontWeight: 700, color: "#15803D", whiteSpace: "nowrap" };

const renderPlanOption = (props, option) => {
  const { key, ...rest } = props;
  return (
    <li key={key} {...rest}>
      <span>{planLabel(option)}</span>
      {isLinked(option) && <span style={LINKED_TAG}>ผูกกับวัตถุดิบนี้</span>}
    </li>
  );
};

export const PLAN_OPTION_PROPS = {
  getOptionLabel: planLabel,
  getOptionKey: (o) => o.prod_id,
  isOptionEqualToValue: (a, b) => String(a.prod_id) === String(b.prod_id),
  filterOptions: filterPlans,
  renderOption: renderPlanOption,
};
