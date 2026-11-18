const alignClass = { right: "text-right", center: "text-center" };

const DataTable = ({ columns, rows, empty = "ไม่มีข้อมูล" }) => {
  if (!rows.length) {
    return <div className="py-6 text-center text-sm text-slate-400">{empty}</div>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 font-semibold whitespace-nowrap ${alignClass[c.align] || "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-blue-50/40">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 ${alignClass[c.align] || "text-left"} ${c.align === "right" ? "tabular-nums" : ""}`}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
