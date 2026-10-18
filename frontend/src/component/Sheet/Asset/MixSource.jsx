import { useEffect, useState } from "react";
import axios from "axios";
import { Alert, Box, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import HamsterLoader from "../../Layout/DataGrid/HamsterLoader";

const API_URL = import.meta.env.VITE_API_URL;

const p2 = (n) => String(n).padStart(2, "0");
const fmt = (v) => {
  if (!v) return "-";
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? String(v) : `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
const kg = (v) => (v === null || v === undefined || v === "" ? "-" : `${Number(v).toLocaleString("th-TH", { maximumFractionDigits: 2 })} kg`);

const CELL = { fontSize: 12.5, py: 0.5, px: 1 };

/**
 * แท็บ "ผสมจาก" ของกล่อง Detail: วัตถุดิบในแถวนี้ผสมมาจากอะไรบ้าง (แทนหน้า "รายการผสมวัตถุดิบ" เดิม)
 * อ่านจาก GET /api/sheet/mix-source?mapping_id=
 */
const MixSource = ({ row }) => {
  const id = row?.mapping_id;
  const [state, setState] = useState({ loading: false, data: null, error: "" });

  useEffect(() => {
    if (!id) { setState({ loading: false, data: null, error: "" }); return undefined; }
    let cancel = false;
    setState({ loading: true, data: null, error: "" });
    axios.get(`${API_URL}/api/sheet/mix-source`, { params: { mapping_id: id } })
      .then((res) => { if (!cancel) setState({ loading: false, data: res.data?.data || null, error: "" }); })
      .catch((err) => {
        console.error("[Sheet] mix source error:", err);
        if (!cancel) setState({ loading: false, data: null, error: err.response?.data?.error || err.message });
      });
    return () => { cancel = true; };
  }, [id]);

  // แถวที่ยังไม่ใช่รายการในรถเข็น (แผน / HU / Emulsion ที่ผสมแล้ว): ใช้ข้อความ Emulsion ของแถว
  if (!id) {
    return (
      <Box sx={{ p: 1.5 }}>
        {row?.emulsion_text
          ? <><Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>Emulsion ที่ผสม</Typography><Typography sx={{ fontSize: 13 }}>{row.emulsion_text}</Typography></>
          : <Typography sx={{ color: "#90A4AE", fontSize: 13 }}>แถวนี้ยังไม่มีรายการผสม</Typography>}
      </Box>
    );
  }
  if (state.loading) return <Box sx={{ py: 3, display: "flex", justifyContent: "center" }}><HamsterLoader /></Box>;
  if (state.error) return <Alert severity="error" sx={{ m: 1.5 }}>{state.error}</Alert>;
  const d = state.data;
  if (!d) return null;

  return (
    <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{d.head.mat_name || "-"}</Typography>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Mat {d.head.mat || "-"} · {kg(d.head.weight_RM)} · รายการ {d.head.mapping_id}</Typography>
      </Box>
      {!d.mixed && <Alert severity="info">วัตถุดิบนี้ไม่ได้ผสมจากวัตถุดิบอื่น</Alert>}
      {d.groups.map((g) => (
        <Box key={g.key}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{g.label}</Typography>
            <Chip size="small" label={`${g.rows.length} รายการ`} />
            <Chip size="small" color="primary" variant="outlined" label={kg(g.rows.reduce((s, r) => s + (Number(r.weight) || 0), 0))} />
          </Box>
          <Box sx={{ overflowX: "auto", border: "1px solid #E1E9FA", borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { ...CELL, fontWeight: 700, background: "#F4F7FD", whiteSpace: "nowrap" } }}>
                  <TableCell>วัตถุดิบ</TableCell><TableCell>Batch</TableCell><TableCell align="right">น้ำหนัก</TableCell><TableCell>เวลา</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {g.rows.map((r, i) => (
                  <TableRow key={`${r.mapping_id ?? r.ref_id}-${i}`} sx={{ "& td": CELL }}>
                    <TableCell><b>{r.mat_name || "-"}</b><div style={{ fontSize: 11.5, color: "#6B7489" }}>{r.mat || ""}{r.mapping_id ? ` · #${r.mapping_id}` : ""}</div></TableCell>
                    <TableCell sx={{ fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap" }}>{r.batch || "-"}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{kg(r.weight)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", fontSize: 12 }}>
                      {r.withdraw_date ? <>เบิก {fmt(r.withdraw_date)}</> : null}
                      {r.rmit_date ? <>เตรียมเสร็จ {fmt(r.rmit_date)}</> : null}
                      {r.out_cold_date ? <div>ออกห้องเย็น {fmt(r.out_cold_date)}</div> : null}
                      {!r.withdraw_date && !r.rmit_date && !r.out_cold_date ? "-" : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default MixSource;
