import { Fragment, useMemo } from "react";
import { Box, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import { COLUMN_BY_KEY, GROUPS } from "./columns";
import { getDbs } from "./dbs";

const safeDbs = (row) => { try { return getDbs(row); } catch (err) { console.error("[SheetTable] DBS error:", err); return []; } };
import { rowStatus } from "./buildTree";

const shortTime = (v) => {
  if (!v) return null;
  const d = new Date(String(v).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(v);
  const p = (n) => String(n).padStart(2, "0");
  const year = d.getFullYear() !== new Date().getFullYear() ? `/${String(d.getFullYear()).slice(2)}` : "";
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}${year} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const HEAD = { color: "#fff", fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap", borderColor: "rgba(255,255,255,.18)", padding: "6px 8px" };

const Cell = ({ col, node }) => {
  const r = node.row;
  if (col.type === "dbs") {
    if (node.kind === "hu") return <span style={{ color: "#B0BAC9" }}>-</span>;
    const d = node.dbs[col.dbsIndex];
    if (!d || d.text === "-") return <span style={{ color: "#B0BAC9" }}>-</span>;
    return (
      <Tooltip title={d.std !== null ? `มาตรฐาน ${Math.floor(d.std / 60)} ชม. ${d.std % 60} นาที` : "ไม่มีมาตรฐาน"} arrow>
        <span style={{ fontWeight: 700, color: d.over ? "#B91C1C" : "#047857", background: d.over ? "#FEE2E2" : "#ECFDF5", borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap" }}>
          {d.text}
        </span>
      </Tooltip>
    );
  }
  const raw = col.get ? col.get(r) : r[col.key];
  if (col.type === "time") return raw ? <span style={{ whiteSpace: "nowrap" }}>{shortTime(raw)}</span> : <span className="sheet-empty" style={{ color: "#C5CCD9" }}>-</span>;
  return raw === null || raw === undefined || raw === "" ? <span style={{ color: "#C5CCD9" }}>-</span> : <span>{String(raw)}</span>;
};

/** flat list of visible rows (parents + expanded children) with their depth */
const flatten = (roots, expanded) => {
  const out = [];
  const walk = (nodes, depth) => nodes.forEach((n) => {
    if (n.kind === "map" && !n.dbs) n.dbs = safeDbs(n.row);
    out.push({ node: n, depth });
    if (n.children.length && expanded.has(n.id)) walk(n.children, depth + 1);
  });
  walk(roots, 0);
  return out;
};

const SheetTable = ({ roots, expanded, onToggle, visible, renderTools }) => {
  const cols = useMemo(() => visible.map((k) => COLUMN_BY_KEY[k]).filter(Boolean), [visible]);
  const groups = useMemo(() => GROUPS.map((g) => ({ ...g, span: cols.filter((c) => c.group === g.key).length })).filter((g) => g.span > 0), [cols]);
  const flat = useMemo(() => flatten(roots, expanded), [roots, expanded]);

  return (
    <Paper sx={{ borderRadius: "16px", overflow: "hidden" }}>
      <TableContainer sx={{ maxHeight: "68vh" }}>
        <Table stickyHeader size="small" sx={{ minWidth: 600 }}>
          <TableHead>
            <TableRow>
              <TableCell colSpan={2} sx={{ ...HEAD, background: "#0F3FC4", position: "sticky", left: 0, zIndex: 5 }}>แถว / ทำรายการ</TableCell>
              {groups.map((g) => (
                <TableCell key={g.key} colSpan={g.span} align="center" sx={{ ...HEAD, background: g.color }}>{g.label}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell sx={{ ...HEAD, background: "#1552F0", minWidth: 150, position: "sticky", left: 0, zIndex: 5 }}>สถานะ</TableCell>
              <TableCell sx={{ ...HEAD, background: "#1552F0", minWidth: 150 }}>ทำรายการ</TableCell>
              {cols.map((c) => (
                <TableCell key={c.key} align={c.align || "left"} sx={{ ...HEAD, background: "#1552F0", minWidth: c.width }}>{c.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {flat.map(({ node, depth }) => {
              const st = rowStatus(node);
              const isHu = node.kind === "hu";
              const open = expanded.has(node.id);
              const bg = isHu ? "#F5F8FF" : depth > 1 ? "#FBFCFE" : "#fff";
              return (
                <Fragment key={node.id}>
                  <TableRow hover sx={{ "& td": { background: bg, borderBottom: "1px solid #EEF2F9" } }}>
                    <TableCell sx={{ position: "sticky", left: 0, zIndex: 2, background: bg, padding: "2px 8px", minWidth: 150 }}>
                      <Box sx={{ display: "flex", alignItems: "center", pl: `${depth * 18}px`, gap: 0.5 }}>
                        {node.children.length ? (
                          <IconButton size="small" onClick={() => onToggle(node.id)} sx={{ p: 0.25 }}>
                            {open ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                          </IconButton>
                        ) : <span style={{ width: 22 }} />}
                        <span style={{ background: st.bg, color: st.color, borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>{st.label}</span>
                        {isHu && node.children.length > 0 && <span style={{ fontSize: 11, color: "#6B7489" }}>{node.children.length} mapping</span>}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ padding: "2px 8px", whiteSpace: "nowrap" }}>{renderTools(node)}</TableCell>
                    {cols.map((c) => (
                      <TableCell key={c.key} align={c.align || "left"} sx={{ fontSize: 12.5, padding: "4px 8px", fontWeight: isHu && c.group === "info" ? 600 : 400 }}>
                        <Cell col={c} node={node} />
                      </TableCell>
                    ))}
                  </TableRow>
                </Fragment>
              );
            })}
            {!flat.length && (
              <TableRow><TableCell colSpan={cols.length + 2} align="center" sx={{ py: 5, color: "#90A4AE" }}>ไม่มีรายการ</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default SheetTable;
