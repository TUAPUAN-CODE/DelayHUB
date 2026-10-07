import useTableTools from "../../hooks/useTableTools";
import TableToolbar from "./TableToolbar";

// Wraps a table component: search/sort run over the full `prop` array, then the table paginates the result.
const withTableTools = (Table, prop = "data") => {
  const Wrapped = (props) => {
    const tools = useTableTools(props[prop]);
    const resetKey = `${tools.search}|${tools.sorts.map((s) => s.key + s.dir).join(",")}`;
    return (
      <>
        <TableToolbar tools={tools} resultCount={tools.result.length} />
        <Table key={resetKey} {...props} {...{ [prop]: tools.result }} />
      </>
    );
  };
  Wrapped.displayName = `withTableTools(${Table.displayName || Table.name || "Table"})`;
  return Wrapped;
};

export default withTableTools;
