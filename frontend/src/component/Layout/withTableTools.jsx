import useTableTools from "../../hooks/useTableTools";
import useTableToolsPlus from "../../hooks/useTableToolsPlus";
import TableToolbar from "./TableToolbar";
import TableToolbarPlus from "./TableToolbarPlus";

// Supervisor pages keep the original toolbar; every other Role gets the standard toolbar (search, per-column sort/filter, Excel / PDF).
const isSupervisorPage = () => /^\/sup(\/|$)/i.test(window.location.pathname);
const pageTitle = (name) => {
  const seg = window.location.pathname.split("/").filter(Boolean).pop() || "table";
  return `${seg}_${name}`;
};

// keepState: do not remount the table when search/sort change (use when the table holds selections/edits).
// Wraps a table component: search/sort/filter run over the full `prop` array, then the table paginates the result.
const withTableTools = (Table, prop = "data", { keepState = false } = {}) => {
  const name = Table.displayName || Table.name || "Table";

  const Legacy = (props) => {
    const tools = useTableTools(props[prop]);
    const resetKey = `${tools.search}|${tools.sorts.map((s) => s.key + s.dir).join(",")}`;
    return (
      <>
        <TableToolbar tools={tools} resultCount={tools.result.length} />
        <Table key={keepState ? undefined : resetKey} {...props} {...{ [prop]: tools.result }} />
      </>
    );
  };

  const Plus = (props) => {
    const tools = useTableToolsPlus(props[prop], `${window.location.pathname}|${name}`.slice(0, 120));
    const resetKey = `${tools.search}|${tools.sorts.map((s) => s.key + s.dir).join(",")}|${Object.entries(tools.filters).map(([k, v]) => k + v.length).join(",")}`;
    return (
      <>
        <TableToolbarPlus tools={tools} resultCount={tools.result.length} title={pageTitle(name)} />
        <Table key={keepState ? undefined : resetKey} {...props} {...{ [prop]: tools.result }} />
      </>
    );
  };

  const Wrapped = (props) => (isSupervisorPage() ? <Legacy {...props} /> : <Plus {...props} />);
  Wrapped.displayName = `withTableTools(${name})`;
  return Wrapped;
};

export default withTableTools;
