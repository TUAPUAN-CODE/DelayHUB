import { Alert, Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";

/**
 * FIFO of the cold rooms of /coldStorage: the materials with the same mat / Code / line that entered a cold room before the trolley
 * being sent out (GET /api/coldstorage/fifo-check) — a warning only: the trolley can still be sent out ("จ่ายไม่ FIFO" on its slip).
 * list: [{ mapping_id, mat_name, mat, doc_no, line_name, in_at, first_mapping_id, first_tro_id, first_cs_name, first_slot_id, first_in_at }]
 */
const FifoNotice = ({ message, list }) => (
  <Alert severity="warning" icon={false} sx={{ "& .MuiAlert-message": { width: "100%" } }}>
    <Typography sx={{ fontWeight: 700, mb: 1 }}>{message}</Typography>
    {list?.length > 0 && (
      <Box sx={{ maxHeight: 300, overflow: "auto", bgcolor: "#fff", borderRadius: 1 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ "& th": { whiteSpace: "nowrap" } }}>
              <TableCell>วัตถุดิบในรถเข็นนี้</TableCell>
              <TableCell>Code / ไลน์</TableCell>
              <TableCell>เข้าห้องเย็น</TableCell>
              <TableCell>เข้าก่อน: รถเข็น</TableCell>
              <TableCell>ห้อง / ช่อง</TableCell>
              <TableCell>เข้าห้องเย็น</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((x) => (
              <TableRow key={`${x.mapping_id}-${x.first_mapping_id}`}>
                <TableCell>{x.mat_name || x.mat} <span style={{ color: "#6B7489" }}>({x.mapping_id})</span></TableCell>
                <TableCell>{x.doc_no || "-"} / {x.line_name || "-"}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{x.in_at || "-"}</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#B42318" }}>{x.first_tro_id} <span style={{ color: "#6B7489", fontWeight: 400 }}>({x.first_mapping_id})</span></TableCell>
                <TableCell>{x.first_cs_name || "-"} / {x.first_slot_id || "-"}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>{x.first_in_at || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    )}
  </Alert>
);

export default FifoNotice;
