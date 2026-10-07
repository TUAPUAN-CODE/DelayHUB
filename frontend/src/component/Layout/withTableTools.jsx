import useTableTools from "../../hooks/useTableTools";
import TableToolbar from "./TableToolbar";

// keepState: do not remount the table when search/sort change (use when the table holds selections/edits).
// Wraps a table component: search/sort run over the full `prop` array, then the table paginates the result.
const withTableTools = (Table, prop = "data", { keepState = false } = {}) => {
  const Wrapped = (props) => {
    const tools = useTableTools(props[prop]);
    const resetKey = `${tools.search}|${tools.sorts.map((s) => s.key + s.dir).join(",")}`;
    return (
      <>
        <TableToolbar tools={tools} resultCount={tools.result.length} />
        <Table key={keepState ? undefined : resetKey} {...props} {...{ [prop]: tools.result }} />
      </>
    );
  };
  Wrapped.displayName = `withTableTools(${Table.displayName || Table.name || "Table"})`;
  return Wrapped;
};

export default withTableTools;
