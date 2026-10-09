// Column registry of the Master Delay Sheet. ONE row = one raw material (mapping) or one HU that has no mapping yet.
// Time columns use the DB field name as key, so a HU (SAP_Receive) and a mapping (History) fill the same column.
// Tool columns (kind: 'tool') are the actions of each Role; they are chosen in the column settings just like data columns.
import { Button, IconButton, Tooltip } from "@mui/material";

export const GROUPS = [
  { key: "tool", label: "เครื่องมือ", color: "#0F3FC4" },
  { key: "info", label: "ข้อมูลวัตถุดิบ", color: "#1552F0" },
  { key: "prep", label: "เตรียม / QC", color: "#B45309" },
  { key: "cs1", label: "ห้องเย็น (รอบ 1–3)", color: "#0277BD" },
  { key: "cs2", label: "ห้องเย็นใหญ่ (รอบ 1–4)", color: "#4527A0" },
  { key: "sap", label: "วัตถุดิบไม่แปรรูป (HU)", color: "#00796B" },
  { key: "pack", label: "บรรจุ", color: "#2E7D32" },
  { key: "dbs", label: "DBS (Delay)", color: "#C62828" },
];

const t = (key, label, group, width = 112) => ({ key, label, group, kind: "data", type: "time", width });
const x = (key, label, group, width = 110, extra = {}) => ({ key, label, group, kind: "data", type: "text", width, ...extra });

/** buttons of one tool column: the Role's handlers come from ctx.tools(row) */
const ToolButtons = ({ items }) => {
  if (!items.length) return <span style={{ color: "#C5CCD9" }}>-</span>;
  return items.map((it) => (it.node ? <span key={it.key}>{it.node}</span> : it.icon ? (
    <Tooltip key={it.key} title={it.title || it.label} arrow>
      <span><IconButton size="small" onClick={it.run} sx={{ color: it.ok === false ? "#C5CCD9" : it.color }}>{it.icon}</IconButton></span>
    </Tooltip>
  ) : (
    <Button key={it.key} size="small" variant="outlined" onClick={it.run} sx={{ py: 0, px: 1, minWidth: 0, fontSize: 12, textTransform: "none", whiteSpace: "nowrap", color: it.color, borderColor: it.color, mr: 0.5, mb: 0.25 }}>{it.label}</Button>
  )));
};

const tool = (key, label, width, roles) => ({
  key, label, group: "tool", kind: "tool", frozen: true, width, roles,
  render: (row, ctx) => <ToolButtons items={ctx.tools(row).filter((i) => i.col === key)} />,
});

export const STATUS_COLUMN = {
  key: "status", label: "สถานะ", group: "tool", kind: "data", type: "text", frozen: true, width: 150,
  text: (r) => r.__status?.label || "",
  sortValue: (r) => (r.__status ? r.__status.rank : null), // sort follows the areas, not the alphabet
  optionMeta: (r) => (r.__status ? { rank: r.__status.rank, zone: r.__status.zone } : null), // the dropdown groups its values by area, in this order
  render: (r) => (r.__status ? (
    <span title={r.__status.label} style={{ background: r.__status.bg, color: r.__status.color, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "middle" }}>{r.__status.label}</span>
  ) : null),
};

const stdLabel = (min) => {
  const h = Math.floor(min / 60); const m = Math.round(min % 60);
  return `${h ? `${h} h` : ""}${h && m ? " " : ""}${m ? `${m} m` : ""}` || "0";
};
/** actual time (coloured: red when over the standard) / standard time of the raw material group */
const DbsCell = ({ d }) => {
  const hasActual = d && d.text && d.text !== "-";
  const hasStd = d && d.std !== null && d.std !== undefined;
  if (!hasActual && !hasStd) return <span style={{ color: "#B0BAC9" }}>-</span>;
  return (
    <Tooltip title={hasStd ? `เวลาจริง ${hasActual ? d.text : "-"} · มาตรฐาน ${stdLabel(d.std)}` : "ไม่มีเวลามาตรฐาน"} arrow>
      <span style={{ whiteSpace: "nowrap" }}>
        {hasActual
          ? <span style={{ fontWeight: 700, color: d.over ? "#B91C1C" : "#047857", background: d.over ? "#FEE2E2" : "#ECFDF5", borderRadius: 6, padding: "1px 6px" }}>{d.text}</span>
          : <span style={{ color: "#B0BAC9" }}>-</span>}
        {hasStd && <span style={{ color: "#6B7489", fontSize: 11.5 }}> / {stdLabel(d.std)}</span>}
      </span>
    </Tooltip>
  );
};
const dbs = (i, key, label) => ({
  key, label, group: "dbs", kind: "data", type: "dbs", width: 160,
  text: (r) => { const d = r.__dbs?.[i]; return d && d.text !== "-" ? d.text : ""; },
  sortValue: (r) => { const d = r.__dbs?.[i]; return d && d.text !== "-" ? d.minutes : null; },
  render: (r) => <DbsCell d={r.__dbs?.[i]} />,
});

export const COLUMNS = [
  // tools: frozen on the left, in this order
  STATUS_COLUMN,
  tool("t_stamp", "จับเวลา HU", 170, ["cs2"]),
  tool("t_cs1", "ห้องเย็น", 210, ["cs1"]),
  tool("t_cs2", "ห้องเย็นใหญ่", 150, ["cs2"]),
  tool("t_qc", "ตรวจ QC", 90, ["qc", "pack"]),
  tool("t_cart", "ใส่รถเข็น", 100, ["pack"]),
  tool("t_send", "ส่งไป", 80, ["pack"]),
  { key: "w_total", label: "น้ำหนัก", group: "tool", kind: "data", type: "number", frozen: true, width: 80, align: "right", roles: ["pack"], get: (r) => r.weight_RM ?? r.weight },
  tool("t_kg", "น้ำหนัก (kg)", 110, ["pack"]),
  tool("t_edit", "แก้ไข", 80, ["pack"]),
  tool("t_confirm", "ยืนยัน", 80, ["pack"]),
  tool("t_checkin", "Check In", 100, ["pack"]),
  tool("t_pstamp", "Time Stamp (รับ / ต้ม / ส่งคืน)", 190, ["prep"]),
  tool("t_rework", "รอแก้ไข / กลับมาเตรียม", 200, ["prep"]),
  tool("t_mix", "ผสม", 150, ["prep"]),
  tool("t_manage", "จัดการ (รถเข็น / สลิป / เสร็จสิ้น / แผน)", 150, ["prep"]),
  // "รายการ" = mapping_id, always right after the tools
  { key: "mapping_id", label: "รายการ", group: "tool", kind: "data", type: "number", frozen: true, width: 80 },
  // ข้อมูล
  x("hu", "HU", "info", 100),
  x("from_mapping_id", "มาจากรายการ", "info", 100),
  x("mix_code", "รหัสผสม", "info", 100),
  x("tro_id", "รถเข็น", "info", 80),
  x("batch", "Batch", "info", 110, { get: (r) => r.batch_after || r.batch }),
  x("mat", "รหัสวัตถุดิบ", "info", 100),
  x("mat_name", "ชื่อวัตถุดิบ", "info", 190),
  x("code", "แผนผลิต", "info", 130),
  x("rmm_line_name", "ไลน์", "info", 90),
  x("weight_RM", "น้ำหนัก", "info", 80, { get: (r) => r.weight_RM ?? r.weight, align: "right", type: "number" }),
  x("tray_count", "ถาด", "info", 60, { align: "right", type: "number" }),
  x("rm_status", "สถานะวัตถุดิบ", "info", 130),
  x("remark", "หมายเหตุ", "info", 140),
  x("dest", "ปลายทาง", "info", 110),
  x("cs_name", "ห้อง", "info", 90),
  x("slot_id", "ช่อง", "info", 70),
  // เตรียม / QC
  t("cooked_date", "ต้ม/อบเสร็จ", "prep"),
  t("rmit_date", "เตรียมเสร็จ", "prep"),
  t("withdraw_date", "เบิก / จ่ายลงไลน์ 1", "prep"),
  t("start_mixed_date", "เริ่มผสม", "prep"),
  t("start_gravy_date", "เริ่มใส่ Gravy", "prep"),
  t("gm_date", "เริ่มบด", "prep"),
  t("qc_date", "QC ตรวจ", "prep"),
  // ห้องเย็น 1-3
  t("come_cold_date", "เข้าห้องเย็น 1", "cs1"),
  t("out_cold_date", "ออกห้องเย็น 1", "cs1"),
  t("come_cold_date_two", "เข้าห้องเย็น 2", "cs1"),
  t("out_cold_date_two", "ออกห้องเย็น 2", "cs1"),
  t("come_cold_date_three", "เข้าห้องเย็น 3", "cs1"),
  t("out_cold_date_three", "ออกห้องเย็น 3", "cs1"),
  // ห้องเย็นใหญ่ 1-4
  t("cs_come_cold_date", "เข้าห้องเย็นใหญ่ 1", "cs2"),
  t("cs_out_cold_date", "ออกห้องเย็นใหญ่ 1", "cs2"),
  t("cs_come_cold_date_two", "เข้าห้องเย็นใหญ่ 2", "cs2"),
  t("cs_out_cold_date_two", "ออกห้องเย็นใหญ่ 2", "cs2"),
  t("cs_come_cold_date_three", "เข้าห้องเย็นใหญ่ 3", "cs2"),
  t("cs_out_cold_date_three", "ออกห้องเย็นใหญ่ 3", "cs2"),
  t("cs_come_cold_date_four", "เข้าห้องเย็นใหญ่ 4", "cs2"),
  t("cs_out_cold_date_four", "ออกห้องเย็นใหญ่ 4", "cs2"),
  // HU (SAP)
  t("start_defrost_date", "เริ่มละลาย 1", "sap"),
  t("end_defrost_date", "ละลายเสร็จ 1", "sap"),
  t("input_pd_date", "ไลน์รับเข้า 1", "sap"),
  t("output_pd_date", "ไลน์ส่งคืน 1", "sap"),
  t("input_cd_date", "รับเข้าห้องเย็น 1", "sap"),
  t("withdraw_date_two", "จ่ายลงไลน์ 2", "sap"),
  t("start_defrost_date_two", "เริ่มละลาย 2", "sap"),
  t("end_defrost_date_two", "ละลายเสร็จ 2", "sap"),
  t("input_pd_date_two", "ไลน์รับเข้า 2", "sap"),
  t("output_pd_date_two", "ไลน์ส่งคืน 2", "sap"),
  t("input_cd_date_two", "รับเข้าห้องเย็น 2", "sap"),
  t("withdraw_date_three", "จ่ายลงไลน์ 3", "sap"),
  t("start_defrost_date_three", "เริ่มละลาย 3", "sap"),
  t("end_defrost_date_three", "ละลายเสร็จ 3", "sap"),
  t("input_pd_date_three", "ไลน์รับเข้า 3", "sap"),
  t("output_pd_date_three", "ไลน์ส่งคืน 3", "sap"),
  t("input_cd_date_three", "รับเข้าห้องเย็น 3", "sap"),
  t("withdraw_date_four", "จ่ายลงไลน์ 4", "sap"),
  t("start_defrost_date_four", "เริ่มละลาย 4", "sap"),
  t("end_defrost_date_four", "ละลายเสร็จ 4", "sap"),
  // บรรจุ
  t("sc_pack_date", "บรรจุเสร็จสิ้น", "pack"),
  x("remark_dalay", "หมายเหตุ Delay", "pack", 160),
  // DBS
  dbs(0, "DBS1", "DBS1 เตรียม→ห้องเย็น"),
  dbs(1, "DBS2", "DBS2 อยู่ห้องเย็น"),
  dbs(2, "DBS3", "DBS3 ห้องเย็น→บรรจุ"),
  dbs(3, "DBS4", "DBS4 รวม"),
];

/** columns a Role can see: its own tools + every data column */
// The tool (action) columns are not in the table any more: the buttons are above the table and work on the chosen row (ParentComponent).
// Only the weight input of the Pack confirm (t_kg) stays in the row, because every ticked row needs its own weight.
export const columnsForRole = (role) => COLUMNS.filter((c) => (!c.roles || c.roles.includes(role)) && (c.kind !== "tool" || c.key === "t_kg"));

const INFO = ["hu", "tro_id", "batch", "mat_name", "code", "weight_RM", "rm_status", "dest", "cs_name", "slot_id"];
const DBS = ["DBS1", "DBS2", "DBS3", "DBS4"];
const FIXED = ["status", "mapping_id"];

const TOOLS = { prep: ["t_pstamp", "t_manage", "t_rework", "t_mix"], qc: ["t_qc"], cs1: ["t_cs1"], cs2: ["t_stamp", "t_cs2"], pack: ["t_qc", "t_cart", "t_send", "w_total", "t_kg", "t_edit", "t_confirm", "t_checkin"], sup: [] };
const TIMES = {
  prep: ["cooked_date", "rmit_date", "start_mixed_date", "qc_date", "come_cold_date", "out_cold_date"],
  qc: ["cooked_date", "rmit_date", "qc_date"],
  cs1: ["rmit_date", "come_cold_date", "out_cold_date", "come_cold_date_two", "out_cold_date_two", "come_cold_date_three", "out_cold_date_three"],
  cs2: ["withdraw_date", "start_defrost_date", "end_defrost_date", "input_pd_date", "output_pd_date", "input_cd_date", "cs_come_cold_date", "cs_out_cold_date", "cs_come_cold_date_two", "cs_out_cold_date_two"],
  pack: ["rmit_date", "come_cold_date", "out_cold_date", "qc_date", "sc_pack_date"],
  sup: ["rmit_date", "come_cold_date", "out_cold_date", "cs_come_cold_date", "cs_out_cold_date", "qc_date", "sc_pack_date"],
};

/** columns shown the first time an account opens the sheet (the account can change them with the settings button) */
export const defaultVisible = (role) => {
  const info = role === "pack" ? INFO.filter((k) => k !== "weight_RM") : INFO; // Pack has its own "น้ำหนัก" tool column
  const pick = new Set([...FIXED, ...(TOOLS[role] || []), ...info, ...(TIMES[role] || []), ...(role === "cs1" ? ["DBS1", "DBS2"] : DBS)]);
  return columnsForRole(role).filter((c) => pick.has(c.key)).map((c) => c.key);
};

export const ROLE_LABEL = {
  prep: "จุดเตรียม",
  qc: "QC",
  cs1: "ห้องเย็น v1",
  cs2: "ห้องเย็น v2",
  pack: "บรรจุ",
  sup: "Supervisor",
};
