import { useState } from "react";
import {
  Box, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Tooltip,
} from "@mui/material";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import withTableTools from "../../../Layout/withTableTools";
import { EVENTS, eventTimes, formatTime, planStamp } from "./sapTimeline";

const HEAD = {
  background: "#1552F0", color: "#fff", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", borderColor: "rgba(255,255,255,.15)",
};

const Times = ({ row, types }) => {
  const items = types.flatMap((type) =>
    eventTimes(row, type).map((e) => ({ ...e, type, key: `${type}${e.round}` })),
  ).sort((a, b) => a.at - b.at);
  if (!items.length) return <span style={{ color: "#B0BAC9" }}>-</span>;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-start" }}>
      {items.map((e) => (
        <span key={e.key} style={{ fontSize: 12.5, whiteSpace: "nowrap", color: "#353535" }}>
          {types.length > 1 ? <b style={{ color: "#6B7489" }}>{EVENTS[e.type].label.replace("ไลน์", "")} </b> : null}
          <span style={{ color: "#6B7489" }}>ร.{e.round}</span> {formatTime(e.at)}
        </span>
      ))}
    </Box>
  );
};

const ActionButton = ({ kind, row, icon, label, color, onStamp, onCheckin }) => {
  const plan = planStamp(kind, row);
  const handle = () => (kind === "checkin" ? onCheckin(row) : onStamp(kind, row));
  return (
    <Tooltip title={plan.ok ? `${label}${plan.round ? ` (รอบที่ ${plan.round})` : ""}` : plan.reason} arrow>
      <span>
        <IconButton size="small" onClick={handle} sx={{ color: plan.ok ? color : "#C5CCD9", opacity: plan.ok ? 1 : 0.7 }}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
};

const SapTable = ({ data, onStamp, onCheckin }) => {
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(100);
  const rows = data || [];
  const shown = rows.slice(page * perPage, page * perPage + perPage);

  return (
    <Paper sx={{ borderRadius: "16px", overflow: "hidden" }}>
      <TableContainer sx={{ maxHeight: "66vh" }}>
        <Table stickyHeader size="small" sx={{ minWidth: 1500 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={HEAD}>สถานะ</TableCell>
              <TableCell sx={HEAD} align="center">ทำรายการ</TableCell>
              <TableCell sx={HEAD}>HU</TableCell>
              <TableCell sx={HEAD}>Batch</TableCell>
              <TableCell sx={HEAD}>รหัสวัตถุดิบ</TableCell>
              <TableCell sx={HEAD}>ชื่อวัตถุดิบ</TableCell>
              <TableCell sx={HEAD} align="right">น้ำหนัก (กก.)</TableCell>
              <TableCell sx={HEAD}>จ่ายลงไลน์</TableCell>
              <TableCell sx={HEAD}>เริ่มละลาย</TableCell>
              <TableCell sx={HEAD}>ละลายเสร็จ</TableCell>
              <TableCell sx={HEAD}>ไลน์รับเข้า / ส่งคืน</TableCell>
              <TableCell sx={HEAD}>รับเข้าห้องเย็น</TableCell>
              <TableCell sx={HEAD}>หมายเหตุ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((row) => (
              <TableRow key={row.sap_re_id} hover>
                <TableCell>
                  <span style={{ background: row._a.status.bg, color: row._a.status.color, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {row._a.status.label}
                  </span>
                </TableCell>
                <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                  <ActionButton kind="start" row={row} label="เริ่มละลาย" color="#0277BD" icon={<AcUnitIcon fontSize="small" />} onStamp={onStamp} onCheckin={onCheckin} />
                  <ActionButton kind="end" row={row} label="ละลายเสร็จ" color="#047857" icon={<CheckCircleOutlineIcon fontSize="small" />} onStamp={onStamp} onCheckin={onCheckin} />
                  <ActionButton kind="dispatch" row={row} label="จ่ายลงไลน์" color="#1552F0" icon={<LocalShippingOutlinedIcon fontSize="small" />} onStamp={onStamp} onCheckin={onCheckin} />
                  <ActionButton kind="checkin" row={row} label="รับเข้าห้องเย็น" color="#6A1B9A" icon={<WarehouseOutlinedIcon fontSize="small" />} onStamp={onStamp} onCheckin={onCheckin} />
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{row.hu}</TableCell>
                <TableCell>{row.batch}</TableCell>
                <TableCell>{row.mat}</TableCell>
                <TableCell>{row.mat_name || "-"}</TableCell>
                <TableCell align="right">{row.weight ?? "-"}</TableCell>
                <TableCell><Times row={row} types={["withdraw"]} /></TableCell>
                <TableCell><Times row={row} types={["start_defrost"]} /></TableCell>
                <TableCell><Times row={row} types={["end_defrost"]} /></TableCell>
                <TableCell><Times row={row} types={["input_pd", "output_pd"]} /></TableCell>
                <TableCell><Times row={row} types={["input_cd"]} /></TableCell>
                <TableCell sx={{ maxWidth: 220 }}>{row.remark || "-"}</TableCell>
              </TableRow>
            ))}
            {!shown.length && (
              <TableRow>
                <TableCell colSpan={13} align="center" sx={{ py: 5, color: "#90A4AE" }}>ไม่มีรายการ</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div" count={rows.length} page={page} rowsPerPage={perPage} rowsPerPageOptions={[50, 100, 300]}
        onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        labelRowsPerPage="แถวต่อหน้า:" labelDisplayedRows={({ from, to, count }) => `${from}-${to} จาก ${count}`}
      />
    </Paper>
  );
};

export default withTableTools(SapTable);
