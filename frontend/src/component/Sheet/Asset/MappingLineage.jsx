import { Alert, Box, Button, Chip, CircularProgress, Paper, Typography } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

/*
 * Page "ค้นหา mapping_id": which new mapping_ids a mapping became, and where it came from (GET /api/sheet/lineage, backend lib/mappingLineage.js).
 * Every linked mapping has a button that opens it on the same page.
 */
const KIND_COLOR = {
  reprep: "#B45309", move: "#6A1B9A", split: "#1552F0", loaf: "#0F766E", mixpeck: "#047857", mixinclude: "#047857", sameplan: "#6B7489",
};
// the same link read from the new mapping's side ("มาจากรายการ …")
const PARENT_LABEL = { reprep: "กลับมาเตรียมจากรายการนี้", move: "ย้ายมาจากรายการนี้", split: "สร้างจากรายการนี้", loaf: "Loaf ทำจากรายการนี้" };

const fmtTime = (v) => (v === null || v === undefined || v === "" ? "-" : String(v).replace("T", " ").slice(0, 16));
const fmtKg = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : `${Number(v).toLocaleString("th-TH", { maximumFractionDigits: 2 })} kg`);

/** one linked mapping: what it is, where it is now, and a button to open it */
const LinkRow = ({ item, label, onOpen }) => {
  const open = () => onOpen(item.mapping_id);
  const what = [
    item.mat_name || item.mat, item.batch && `Batch ${item.batch}`, item.tro_id && `รถเข็น ${item.tro_id}`, fmtKg(item.weight_RM),
    item.doc_no && `แผน ${item.doc_no}${item.rmm_line_name ? ` (${item.rmm_line_name})` : ""}`,
  ].filter(Boolean).join(" · ");
  const when = [item.created_at && `สร้าง ${fmtTime(item.created_at)}`, item.linked_by && `โดย ${item.linked_by}`].filter(Boolean).join(" · ");
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1, px: 1.5, borderTop: "1px solid #EEF2F9", flexWrap: "wrap" }}>
      <Box sx={{ flex: 1, minWidth: 240 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{`mapping_id ${item.mapping_id}`}</Typography>
          <Chip size="small" label={label || item.kind_label} sx={{ bgcolor: KIND_COLOR[item.kind] || "#6B7489", color: "#fff", fontWeight: 600 }} />
          {!item.exists && <Chip size="small" color="warning" variant="outlined" label="ไม่มีในระบบแล้ว" />}
        </Box>
        {item.exists && what && <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.25 }}>{what}</Typography>}
        {item.exists && (
          <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
            rm_status: <b>{item.rm_status || "-"}</b> · stay_place: <b>{item.stay_place || "-"}</b> · dest: <b>{item.dest || "-"}</b>
          </Typography>
        )}
        {when && <Typography sx={{ fontSize: 12, color: "#8A94A6" }}>{when}</Typography>}
      </Box>
      <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon fontSize="small" />} onClick={open}>ดูรายละเอียด</Button>
    </Box>
  );
};

/** "มาจากรายการ" of the open mapping: chips that open the earlier mapping */
export const ParentLinks = ({ parents, onOpen }) => {
  if (!parents?.length) return null;
  return (
    <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap", mt: 0.75 }}>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>มาจากรายการ:</Typography>
      {parents.map((p) => (
        <Chip
          key={p.mapping_id} size="small" clickable variant="outlined" onClick={() => onOpen(p.mapping_id)}
          label={`${p.mapping_id} · ${PARENT_LABEL[p.kind] || p.kind_label}${p.exists ? "" : " (ไม่มีในระบบแล้ว)"}`}
        />
      ))}
    </Box>
  );
};

/**
 * The tab "ถูกนำไปเป็นรายการใหม่": the mappings made from this one (กลับมาเตรียม, ย้ายไปรถเข็นอื่น, แบ่ง, ผสม …), then — apart, as "may be related" —
 * the mappings of the same production plan made after it (a new trolley put from the plan instead of "กลับมาเตรียม" keeps no link).
 * state = { loading, data: { children, same_plan }, error }
 */
export const LineagePanel = ({ state, onOpen }) => {
  if (state.loading) return <Box sx={{ p: 2 }}><CircularProgress size={22} /></Box>;
  if (state.error) return <Alert severity="error">{state.error}</Alert>;
  const d = state.data;
  if (!d) return null;
  return (
    <>
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Typography sx={{ px: 1.5, py: 1.25, fontWeight: 700 }}>{`รายการใหม่ที่ทำจากรายการนี้ (${d.children.length})`}</Typography>
        {d.children.length
          ? d.children.map((x) => <LinkRow key={x.mapping_id} item={x} onOpen={onOpen} />)
          : <Typography sx={{ px: 1.5, pb: 1.5, color: "text.secondary", fontSize: 14 }}>ยังไม่พบรายการใหม่ที่ทำจากรายการนี้</Typography>}
      </Paper>
      {d.same_plan.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 1 }}>
          <Typography sx={{ px: 1.5, pt: 1.25, fontWeight: 700 }}>{`อาจเกี่ยวข้อง: รายการจากแผนผลิตเดียวกันที่สร้างหลังรายการนี้ (${d.same_plan.length})`}</Typography>
          <Typography sx={{ px: 1.5, pb: 1, fontSize: 12.5, color: "text.secondary" }}>
            ไม่ได้ผูกกับรายการนี้โดยตรง — เช่น ถ้ากด &quot;ใส่รถเข็นใหม่จากแผน&quot; แทน &quot;กลับมาเตรียม&quot; วัตถุดิบของรายการนี้อาจอยู่ในรายการเหล่านี้
          </Typography>
          {d.same_plan.map((x) => <LinkRow key={x.mapping_id} item={x} onOpen={onOpen} />)}
        </Paper>
      )}
      <Typography sx={{ fontSize: 12, color: "#8A94A6" }}>
        &quot;กลับมาเตรียม&quot; และ &quot;ย้ายไปรถเข็นอื่น&quot; ในห้องเย็น เริ่มบันทึกความเชื่อมโยงตั้งแต่อัปเดตนี้ รายการที่ทำก่อนหน้านั้นจะไม่แสดงที่นี่
      </Typography>
    </>
  );
};
