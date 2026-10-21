import { Box, Button, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import { fmtAt, setCode, LIMIT_INSIDE_MIN, LIMIT_OUTSIDE_MIN } from "./lotCalc";
import { inSlip, outSlip, setSlip } from "./slips";
import { Clock, DIM, SUB } from "./lotUi";

const Title = ({ children }) => <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>{children}</Typography>;
const Print = ({ title, onClick }) => <IconButton size="small" title={title} onClick={onClick}><PrintIcon fontSize="small" /></IconButton>;

/**
 * The opened row of a lot: outside / in the cold room (first in, first out), every "เข้าห้องเย็น" stamp, and the sets ("จัดชุด").
 * c = calcLot(lot, now) · s = calcSets(lot, c, now) · readOnly = History page (print only)
 * onPrint([slip]) · onSetOut(set) · onSetCancel(set)
 */
const LotDetail = ({ lot, c, s, readOnly, onPrint, onSetOut, onSetCancel }) => {
  const ins = lot.moves.filter((m) => m.kind === "IN");
  const setById = new Map(s.sets.map((x) => [x.set_id, x]));
  // the slip of an OUT: the set's slip when the OUT was a set, else the slip of that OUT of the lot
  const printOut = (k) => {
    const set = k.setId ? setById.get(k.setId) : null;
    onPrint([set ? setSlip(lot, set) : outSlip(lot, c, k.outMoveId)]);
  };
  const showSets = s.sets.length > 0 || !!lot.lid_open_at;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.4fr" }, gap: 2, py: 1 }}>
      <div>
        <Title>นอกห้องเย็น (เตรียมเสร็จ → เข้าห้องเย็น)</Title>
        <Table size="small" sx={SUB}>
          <TableHead><TableRow><TableCell align="right">น้ำหนัก</TableCell><TableCell>เวลา / เกณฑ์</TableCell><TableCell>เตรียมเสร็จ → เข้าห้องเย็น</TableCell></TableRow></TableHead>
          <TableBody>
            {c.outsideChunks.map((k, i) => (
              <TableRow key={i}>
                <TableCell align="right">{k.kg} kg</TableCell>
                <TableCell><Clock chunk={k} limit={LIMIT_OUTSIDE_MIN} /></TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtAt(k.fromAt)} → {k.toAt ? fmtAt(k.toAt) : <span style={{ color: "#B26A00" }}>ยังไม่เข้าห้องเย็น</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Box sx={{ mt: 1.5 }}>
          <Title>เข้าห้องเย็น</Title>
          {ins.length ? (
            <Table size="small" sx={SUB}>
              <TableHead><TableRow><TableCell>ครั้งที่</TableCell><TableCell align="right">น้ำหนัก</TableCell><TableCell>เวลาเข้าห้องเย็น</TableCell><TableCell>ผู้บันทึก</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {ins.map((m, i) => (
                  <TableRow key={m.move_id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell align="right">{Number(m.qty_kg)} kg</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtAt(m.moved_at)}</TableCell>
                    <TableCell>{m.created_by || "-"}</TableCell>
                    <TableCell><Print title="พิมพ์สลิปเข้าห้องเย็น" onClick={() => onPrint([inSlip(lot, m)])} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <span style={DIM}>ยังไม่เข้าห้องเย็น</span>}
        </Box>
      </div>

      <div>
        <Title>ในห้องเย็น (เข้า → ออก)</Title>
        {c.coldChunks.length ? (
          <Table size="small" sx={SUB}>
            <TableHead><TableRow><TableCell align="right">น้ำหนัก</TableCell><TableCell>เวลา / เกณฑ์</TableCell><TableCell>เข้าห้องเย็น</TableCell><TableCell>ออกห้องเย็น</TableCell><TableCell>บรรจุเสร็จภายใน</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {c.coldChunks.map((k, i) => (
                <TableRow key={i}>
                  <TableCell align="right">{k.kg} kg{k.setId && setById.get(k.setId) ? <div style={{ fontSize: 11.5, color: "#6B7489" }}>ชุด {setCode(lot, setById.get(k.setId))}</div> : null}</TableCell>
                  <TableCell><Clock chunk={k} limit={LIMIT_INSIDE_MIN} /></TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtAt(k.inAt)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{k.outAt ? fmtAt(k.outAt) : <span style={{ color: "#1552F0" }}>ยังอยู่ในห้องเย็น</span>}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{k.outAt ? (k.packLeftMin > 0 ? fmtAt(k.packBy) : <span style={{ color: "#C62828" }}>ไม่เหลือเวลา</span>) : "-"}</TableCell>
                  <TableCell>{k.outMoveId ? <Print title="พิมพ์สลิปออกห้องเย็น" onClick={() => printOut(k)} /> : null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <span style={DIM}>ยังไม่เข้าห้องเย็น</span>}

        {showSets && (
          <Box sx={{ mt: 1.5 }}>
            <Title>ชุดย่อย (จัดชุดหลังเปิดฝา){s.unassigned > 0 ? <span style={{ fontWeight: 500, color: "#B26A00" }}> · ยังไม่จัดชุด {s.unassigned} kg</span> : null}</Title>
            {s.sets.length ? (
              <Table size="small" sx={SUB}>
                <TableHead><TableRow><TableCell>ID</TableCell><TableCell align="right">น้ำหนัก</TableCell><TableCell>จัดชุด</TableCell><TableCell>เวลา / เกณฑ์</TableCell><TableCell>ออกห้องเย็น</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>
                  {s.sets.map((x) => (
                    <TableRow key={x.set_id} sx={{ background: x.out ? "#F4F7FD" : undefined }}>
                      <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{setCode(lot, x)}</TableCell>
                      <TableCell align="right">{x.kg} kg</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtAt(x.made_at)}</TableCell>
                      <TableCell>{x.out ? <span style={DIM}>-</span> : <Clock chunk={x.clock} limit={LIMIT_INSIDE_MIN} />}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {x.out ? fmtAt(x.out_at) : <span style={{ color: "#1552F0" }}>ต้องออกภายใน {fmtAt(x.deadline)}</span>}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <Print title={x.out ? "พิมพ์สลิปออกห้องเย็น" : "พิมพ์สลิปชุด"} onClick={() => onPrint([setSlip(lot, x)])} />
                        {!readOnly && !x.out && (
                          <>
                            <Button size="small" variant="outlined" onClick={() => onSetOut(x)} sx={{ ml: 0.5, textTransform: "none" }}>ออกห้องเย็น</Button>
                            <Button size="small" color="inherit" onClick={() => onSetCancel(x)} sx={{ ml: 0.5, textTransform: "none" }}>ยกเลิก</Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <span style={DIM}>ยังไม่จัดชุด{readOnly ? "" : " — กด \"จัดชุด\""}</span>}
          </Box>
        )}
        {lot.note ? <div style={{ fontSize: 13, marginTop: 6, color: "#6B7489" }}>หมายเหตุ: {lot.note}</div> : null}
      </div>
    </Box>
  );
};

export default LotDetail;
